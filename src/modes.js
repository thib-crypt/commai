// ─── Commit message modes ─────────────────────────────────────────────────────

const MODES = [
  {
    name: "⚡ Rapide       — Une ligne, concise",
    value: "quick",
    prompt: `Generate a single-line git commit message (max 72 chars) using the conventional commit format (feat/fix/chore/etc). Be very concise. Only output the commit message, nothing else.`,
  },
  {
    name: "✏️  Court        — Titre + contexte bref",
    value: "short",
    prompt: `Generate a short git commit message: one subject line (max 72 chars) in conventional commit format, then optionally 1-2 short bullet points of context. No lengthy explanations. Only output the commit message.`,
  },
  {
    name: "📋 Standard     — Titre + description",
    value: "standard",
    prompt: `Generate a git commit message with a subject line (max 72 chars) in conventional commit format, followed by a blank line and a short paragraph explaining what changed and why. Only output the commit message.`,
  },
  {
    name: "📝 Long         — Détaillé avec bullets",
    value: "long",
    prompt: `Generate a detailed git commit message with: a subject line (conventional commit format), a blank line, a paragraph describing the changes, and bullet points listing the main changes. Be thorough but relevant. Only output the commit message.`,
  },
  {
    name: "🎨 Emoji        — Avec gitmoji",
    value: "emoji",
    prompt: `Generate a git commit message using gitmoji style. Start with the appropriate emoji (e.g. ✨ feat, 🐛 fix, ♻️ refactor, 📝 docs, etc.), then a concise description. Add a short body if needed. Only output the commit message.`,
  },
  {
    name: "💬 Chat         — Générer puis affiner avec l'IA",
    value: "chat",
    prompt: `Generate a clear, well-structured git commit message in conventional commit format with a subject line and brief description. Only output the commit message.`,
  },
];

export default MODES;
