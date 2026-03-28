import { GoogleGenerativeAI } from "@google/generative-ai";
import MODES from "./modes.js";

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_MODEL = "gemini-3-flash-preview";
const API_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 1000;

// ─── Singleton AI instance ────────────────────────────────────────────────────

let _genAI = null;
let _model = null;

function getModel(apiKey, modelName = DEFAULT_MODEL) {
  if (!_genAI || _model?.apiKey !== apiKey) {
    _genAI = new GoogleGenerativeAI(apiKey);
    _model = _genAI.getGenerativeModel({ model: modelName });
    _model.apiKey = apiKey; // track for cache invalidation
  }
  return _model;
}

// ─── Retry with exponential backoff ───────────────────────────────────────────

async function withRetry(fn, { retries = MAX_RETRIES, baseDelay = RETRY_BASE_DELAY_MS } = {}) {
  let lastError;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const isRetryable =
        err.message?.includes("503") ||
        err.message?.includes("429") ||
        err.message?.includes("ECONNRESET") ||
        err.message?.includes("ETIMEDOUT") ||
        err.message?.includes("fetch failed");

      if (!isRetryable || attempt === retries - 1) throw err;

      const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 500;
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastError;
}

// ─── Timeout wrapper ──────────────────────────────────────────────────────────

function withTimeout(promise, ms = API_TIMEOUT_MS) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout après ${ms / 1000}s — l'API ne répond pas.`)), ms)
    ),
  ]);
}

// ─── Build prompt ─────────────────────────────────────────────────────────────

function buildPrompt({ mode, diff, branch, scope, ticket, rules, extraInstruction, language }) {
  const modeConfig = MODES.find((m) => m.value === mode);
  if (!modeConfig) throw new Error(`Mode inconnu : ${mode}`);

  let prompt = modeConfig.prompt;

  // Add language instruction
  if (language && language !== "en") {
    prompt += `\nWrite the commit message in ${language}.`;
  }

  // Add scope hint
  if (scope) {
    prompt += `\nThe detected scope for this change is "${scope}". Use it in the conventional commit format, e.g.: feat(${scope}): ...`;
  }

  // Add branch context
  if (branch) {
    prompt += `\nCurrent branch: "${branch}". Use this context to understand the purpose of the changes.`;
  }

  // Add ticket context
  if (ticket) {
    prompt += `\nInclude the ticket reference "${ticket}" in the commit message. A common practice is to put "Ref: ${ticket}" in the footer of the message (the very last line).`;
  }

  // Add extra instruction
  if (extraInstruction) {
    prompt += `\nAdditional instruction: ${extraInstruction}`;
  }

  // Add project rules
  if (rules) {
    const rulesText = Array.isArray(rules) ? rules.join("\n- ") : rules;
    prompt += `\nProject-specific rules to follow:\n${Array.isArray(rules) ? "- " : ""}${rulesText}`;
  }

  prompt += `\n\nGit diff:\n\`\`\`\n${diff}\n\`\`\``;

  return prompt;
}

// ─── Generate commit message ──────────────────────────────────────────────────

export async function generateCommit(apiKey, diff, mode, {
  branch = null,
  scope = null,
  ticket = null,
  rules = null,
  extraInstruction = "",
  language = "en",
  modelName = DEFAULT_MODEL,
  onStream = null,
} = {}) {
  const model = getModel(apiKey, modelName);
  const prompt = buildPrompt({ mode, diff, branch, scope, ticket, rules, extraInstruction, language });

  return withRetry(async () => {
    // Use streaming if a callback is provided
    if (onStream) {
      const result = await withTimeout(
        model.generateContentStream(prompt)
      );
      let text = "";
      for await (const chunk of result.stream) {
        const part = chunk.text();
        onStream(part);
        text += part;
      }
      return text.trim();
    }

    // Standard generation
    const result = await withTimeout(model.generateContent(prompt));
    return result.response.text().trim();
  });
}

// ─── Chat session ─────────────────────────────────────────────────────────────

export function createChatSession(apiKey, diff, modelName = DEFAULT_MODEL) {
  const model = getModel(apiKey, modelName);

  const history = [
    {
      role: "user",
      parts: [
        {
          text: `You are a git commit message expert. I'll share a git diff and you'll help me craft the perfect commit message. Here's the diff:\n\`\`\`\n${diff}\n\`\`\``,
        },
      ],
    },
  ];

  const chat = model.startChat({ history });

  return {
    async send(message) {
      return withRetry(async () => {
        const result = await withTimeout(chat.sendMessage(message));
        return result.response.text().trim();
      });
    },
  };
}

// ─── Validate API key ─────────────────────────────────────────────────────────

export async function validateApiKey(apiKey) {
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: DEFAULT_MODEL });
    await withTimeout(
      model.generateContent("Reply with OK"),
      10_000
    );
    return true;
  } catch {
    return false;
  }
}

// ─── Extract commit message from chat response ───────────────────────────────

export function extractCommitFromResponse(response) {
  // Try code block first
  const codeBlockMatch = response.match(/```(?:git)?\n?([\s\S]+?)```/);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }

  // Try to find conventional commit pattern
  const lines = response.split("\n");
  const firstCommitLine = lines.findIndex((l) =>
    /^(feat|fix|chore|docs|refactor|test|style|build|ci|perf|revert)/.test(l)
  );
  if (firstCommitLine !== -1) {
    return lines.slice(firstCommitLine).join("\n").trim();
  }

  return null;
}
