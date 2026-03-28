import { t } from "./i18n.js";

const MODES = [
  {
    key: "quick",
    name: () => t("modes.quick.name"),
    value: "quick",
    prompt: `Generate a single-line git commit message (max 72 chars) using the conventional commit format (feat/fix/chore/etc). Be very concise. Only output the commit message, nothing else.`,
  },
  {
    key: "short",
    name: () => t("modes.short.name"),
    value: "short",
    prompt: `Generate a short git commit message: one subject line (max 72 chars) in conventional commit format, then optionally 1-2 short bullet points of context. No lengthy explanations. Only output the commit message.`,
  },
  {
    key: "standard",
    name: () => t("modes.standard.name"),
    value: "standard",
    prompt: `Generate a git commit message with a subject line (max 72 chars) in conventional commit format, followed by a blank line and a short paragraph explaining what changed and why. Only output the commit message.`,
  },
  {
    key: "long",
    name: () => t("modes.long.name"),
    value: "long",
    prompt: `Generate a detailed git commit message with: a subject line (conventional commit format), a blank line, a paragraph describing the changes, and bullet points listing the main changes. Be thorough but relevant. Only output the commit message.`,
  },
  {
    key: "emoji",
    name: () => t("modes.emoji.name"),
    value: "emoji",
    prompt: `Generate a git commit message using gitmoji style. Start with the appropriate emoji (e.g. ✨ feat, 🐛 fix, ♻️ refactor, 📝 docs, etc.), then a concise description. Add a short body if needed. Only output the commit message.`,
  },
  {
    key: "chat",
    name: () => t("modes.chat.name"),
    value: "chat",
    prompt: `Generate a clear, well-structured git commit message in conventional commit format with a subject line and brief description. Only output the commit message.`,
  },
];

export default MODES;
