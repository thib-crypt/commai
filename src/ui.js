import chalk from "chalk";
import boxen from "boxen";
import { t } from "./i18n.js";

// ─── Colors ───────────────────────────────────────────────────────────────────

export const colors = {
  primary: "#A78BFA",   // violet
  success: "#6EE7B7",   // green
  warn: "#FBBF24",      // amber
  error: "#F87171",     // red
  dim: chalk.dim,
};

// ─── Banner ───────────────────────────────────────────────────────────────────

export function printBanner() {
  console.log(
    boxen(
      chalk.bold.hex(colors.primary)(t("app.name")) +
        chalk.gray(t("app.tagline")) +
        chalk.dim(`\n  ${t("app.poweredBy")}`),
      {
        padding: { top: 0, bottom: 0, left: 1, right: 1 },
        borderStyle: "round",
        borderColor: "magenta",
      }
    )
  );
  console.log();
}

// ─── Message boxes ────────────────────────────────────────────────────────────

export function messageBox(content, { title = "Message", borderColor = "magenta" } = {}) {
  return boxen(chalk.white(content), {
    title: chalk.hex(colors.primary)(title),
    titleAlignment: "left",
    padding: 1,
    borderColor,
    borderStyle: "round",
  });
}

export function compactBox(content, { title = "Message", borderColor = "magenta" } = {}) {
  return boxen(chalk.white(content), {
    title: chalk.hex(colors.primary)(title),
    titleAlignment: "left",
    padding: { top: 0, bottom: 0, left: 1, right: 1 },
    borderColor,
    borderStyle: "round",
  });
}

// ─── Chat display ─────────────────────────────────────────────────────────────

export function printChatHeader(currentMessage, aiResponse) {
  const border = chalk.hex(colors.primary);

  console.log("\n" + border.bold(`┌─ ${t("chat.header")} ─────────────────────────────────────`));
  console.log(border("│"));
  console.log(
    border("│ ") +
      chalk.bold(t("ui.currentMessage")) +
      "\n" +
      currentMessage
        .split("\n")
        .map((l) => border("│ ") + chalk.white(l))
        .join("\n")
  );
  console.log(border("│"));
  console.log(
    border("│ ") +
      chalk.hex(colors.success).bold(t("ui.aiResponse")) +
      "\n" +
      aiResponse
        .split("\n")
        .map((l) => border("│ ") + chalk.gray(l))
        .join("\n")
  );
  console.log(border("└──────────────────────────────────────────────────────────"));
}

// ─── File status display ──────────────────────────────────────────────────────

export function printFileStatus(staged, unstaged) {
  if (staged.length > 0) {
    console.log(
      chalk.green(`  ${t("ui.staged")} `) + chalk.white(staged.join(", "))
    );
  }
  if (unstaged.length > 0) {
    console.log(
      chalk.yellow(`  ${t("ui.unstaged")} `) + chalk.dim(unstaged.join(", "))
    );
  }
  console.log();
}

// ─── Branch display ───────────────────────────────────────────────────────────

export function printBranchInfo(branch, scope, language) {
  let info = chalk.hex(colors.primary)(`  ${t("ui.context")}  `) + chalk.white(branch);
  if (scope) {
    info += chalk.dim(` (${t("ui.scope")}: `) + chalk.hex(colors.success)(scope) + chalk.dim(`)`);
  }
  if (language) {
    info += chalk.dim(` | ${t("ui.language")}: `) + chalk.hex(colors.warn)(language);
  }
  console.log(info);
}
