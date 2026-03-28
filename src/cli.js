import chalk from "chalk";
import inquirer from "inquirer";
import ora from "ora";
import { writeFileSync, chmodSync } from "fs";
import { join } from "path";
import MODES from "./modes.js";
import { loadConfig, saveConfig, getApiKey, getEffectiveConfig } from "./config.js";
import {
  createGit, isGitRepo, getSmartDiff,
  getStagedFiles, getCurrentBranch,
  parseBranchScope, detectScopeFromFiles, stageFiles,
} from "./git.js";
import {
  generateCommit, createChatSession,
  extractCommitFromResponse, validateApiKey,
} from "./ai.js";
import { copyToClipboard } from "./clipboard.js";
import {
  printBanner, messageBox, compactBox,
  printChatHeader, printFileStatus, printBranchInfo,
  colors,
} from "./ui.js";
import { initI18n, t, setInterfaceLanguage, getInterfaceLanguage } from "./i18n.js";
import { runSettingsMenu } from "./settings.js";

async function installHook() {
  const git = createGit();
  if (!(await isGitRepo(git))) {
    console.error(chalk.red(t("git.notRepo")));
    process.exit(1);
  }

  const hookPath = join(process.cwd(), ".git", "hooks", "prepare-commit-msg");
  const hookContent = `#!/bin/sh
# Commai Git Hook
COMMIT_MSG_FILE=$1
COMMIT_SOURCE=$2

# Only run if it's a fresh commit (not merge or squash)
if [ -z "$COMMIT_SOURCE" ]; then
  exec < /dev/tty
  commai --hook "$COMMIT_MSG_FILE"
fi
`;

  try {
    writeFileSync(hookPath, hookContent);
    chmodSync(hookPath, "0755");
    console.log(chalk.green(t("git.hookInstalled")));
  } catch (err) {
    console.error(chalk.red(t("git.hookError") + err.message));
  }
}

// ─── Setup API key ────────────────────────────────────────────────────────────

async function setupApiKey() {
  console.log(
    chalk.yellow(`${t("setup.noApiKey")}\n`) +
      chalk.gray(
        `  ${t("setup.getApiKey")}\n`
      )
  );

  const { apiKey } = await inquirer.prompt([
    {
      type: "password",
      name: "apiKey",
      message: t("setup.promptApiKey"),
      mask: "•",
      validate: (v) => (v.trim().length > 0 ? true : t("setup.apiKeyRequired")),
    },
  ]);

  const key = apiKey.trim();

  const { language } = await inquirer.prompt([
    {
      type: "list",
      name: "language",
      message: t("setup.promptDefaultLanguage"),
      choices: [
        { name: "English", value: "en" },
        { name: "Français", value: "fr" },
        { name: "Español", value: "es" },
        { name: "Deutsch", value: "de" },
      ],
      default: "en",
    },
  ]);

  // Validate the key before saving
  const spinner = ora(t("setup.verifyingKey")).start();
  const valid = await validateApiKey(key);
  if (!valid) {
    spinner.fail(t("setup.invalidKey"));
    process.exit(1);
  }
  spinner.succeed(t("setup.validKey"));

  const config = loadConfig();
  config.geminiApiKey = key;
  config.language = language;
  // Linked by default
  config.interfaceLanguage = language;
  saveConfig(config);

  // Re-init i18n with new config
  initI18n();

  console.log(chalk.green(`✅ ${t("setup.configSaved", { language })}\n`));
  return key;
}

// ─── Chat mode ────────────────────────────────────────────────────────────────

async function chatMode(apiKey, diff, initialMessage) {
  const session = createChatSession(apiKey, diff);

  // Get initial AI response
  const aiResponse = await session.send(
    `Here's my initial commit message:\n\n${initialMessage}\n\nWhat do you think of this commit message? Suggest improvements if any.`
  );

  printChatHeader(initialMessage, aiResponse);

  let currentMessage = initialMessage;

  while (true) {
    const { action } = await inquirer.prompt([
      {
        type: "list",
        name: "action",
        message: t("chat.promptAction"),
        choices: [
          { name: t("chat.useMessage"), value: "use" },
          { name: t("chat.askRefinement"), value: "chat" },
          { name: t("chat.regenerate"), value: "regen" },
          { name: t("chat.editManually"), value: "edit" },
        ],
      },
    ]);

    if (action === "use") return currentMessage;

    if (action === "edit") {
      const { edited } = await inquirer.prompt([
        {
          type: "editor",
          name: "edited",
          message: t("chat.promptEdit"),
          default: currentMessage,
        },
      ]);
      return edited.trim();
    }

    if (action === "regen") {
      const spinner = ora(t("chat.regenerating")).start();
      currentMessage = await generateCommit(apiKey, diff, "standard");
      spinner.succeed(t("chat.regenerated"));
      console.log(messageBox(currentMessage, { title: t("chat.newMessage") }));
      continue;
    }

    if (action === "chat") {
      const { userMsg } = await inquirer.prompt([
        {
          type: "input",
          name: "userMsg",
          message: chalk.cyan(`${t("chat.userPrefix")} `),
          prefix: "",
        },
      ]);

      if (!userMsg.trim()) continue;

      const spinner = ora(t("chat.aiThinking")).start();
      try {
        const response = await session.send(userMsg);
        spinner.stop();

        // Try to extract updated commit message
        const extracted = extractCommitFromResponse(response);
        if (extracted) {
          currentMessage = extracted;
        }

        console.log(
          "\n" +
            chalk.hex(colors.success).bold(`${t("ui.aiResponse")} `) +
            "\n" +
            chalk.gray(response)
        );

        if (currentMessage !== initialMessage) {
          console.log(
            "\n" + compactBox(currentMessage, { title: t("chat.updatedMessage") })
          );
        }
      } catch (err) {
        spinner.fail(t("chat.error") + err.message);
      }
    }
  }
}

// ─── Commit & push ────────────────────────────────────────────────────────────

async function doCommit(git, commitMessage, autoPush) {
  // Stage interactif s'il n'y a rien de stagé
  const { staged, unstaged } = await getStagedFiles(git);
  
  if (staged.length === 0) {
    if (unstaged.length === 0) {
      console.log(chalk.yellow(t("git.noChanges")));
      process.exit(0);
    }

    const { selectedFiles } = await inquirer.prompt([
      {
        type: "checkbox",
        name: "selectedFiles",
        message: t("git.noStaged"),
        choices: [
          { name: `[${t("git.addAll")}]`, value: "all" },
          new inquirer.Separator(),
          ...unstaged.map(f => ({ name: f, value: f }))
        ],
        loop: false,
      },
    ]);

    if (selectedFiles.length === 0) {
      console.log(chalk.dim(t("actions.cancelled")));
      process.exit(0);
    }

    if (selectedFiles.includes("all")) {
      await git.add("-A");
      console.log(chalk.green(t("git.stagedAll")));
    } else {
      await stageFiles(git, selectedFiles);
      console.log(chalk.green(`✅ ${selectedFiles.length} ${t("ui.staged").toLowerCase()}`));
    }
  }

  const commitSpinner = ora(t("git.committing")).start();
  try {
    await git.commit(commitMessage);
    commitSpinner.succeed(
      chalk.green(t("git.commitSuccess")) +
        chalk.bold(commitMessage.split("\n")[0])
    );
  } catch (err) {
    commitSpinner.fail(t("git.commitError") + err.message);
    process.exit(1);
  }

  // Push
  if (autoPush) {
    const pushSpinner = ora(t("git.pushing")).start();
    try {
      await git.push();
      pushSpinner.succeed(chalk.green(t("git.pushSuccess")));
    } catch (err) {
      pushSpinner.fail(t("git.pushError") + err.message);
    }
  } else {
    const { wantPush } = await inquirer.prompt([
      {
        type: "confirm",
        name: "wantPush",
        message: t("git.wantPush"),
        default: false,
      },
    ]);
    if (wantPush) {
      const pushSpinner = ora(t("git.pushing")).start();
      try {
        await git.push();
        pushSpinner.succeed(chalk.green(t("git.pushSuccess")));
      } catch (err) {
        pushSpinner.fail(t("git.pushError") + err.message);
      }
    }
  }
}

// ─── Handle copy action ──────────────────────────────────────────────────────

function handleCopy(commitMessage) {
  const ok = copyToClipboard(commitMessage);
  if (ok) {
    console.log(chalk.green(t("actions.copied")));
  } else {
    console.log(chalk.yellow(t("actions.copyFailed")));
    console.log(commitMessage);
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export async function main() {
  const args = process.argv.slice(2);

  // ── Determine interface language early ──
  const langIdx = args.findIndex(a => a === "--lang" || a === "-lg");
  const cliLang = (langIdx !== -1 && args[langIdx + 1]) ? args[langIdx + 1] : null;

  initI18n(cliLang);

  // ── Handle --config ──
  if (args.includes("--config") || args.includes("-c")) {
    const { apiKey } = await inquirer.prompt([
      {
        type: "password",
        name: "apiKey",
        message: t("config.promptNewKey"),
        mask: "•",
        validate: (v) => (v.trim().length > 0 ? true : t("setup.apiKeyRequired")),
      },
    ]);
    const config = loadConfig();
    const { language } = await inquirer.prompt([
      {
        type: "list",
        name: "language",
        message: t("config.promptDefaultLang"),
        choices: [
          { name: "English", value: "en" },
          { name: "Français", value: "fr" },
          { name: "Español", value: "es" },
          { name: "Deutsch", value: "de" },
        ],
        default: config.language || "en",
      },
    ]);

    const spinner = ora(t("config.verifying")).start();
    const valid = await validateApiKey(apiKey);
    if (!valid) {
      spinner.fail(t("setup.invalidKey"));
      process.exit(1);
    }
    spinner.succeed(t("config.keyValid"));

    config.geminiApiKey = apiKey;
    config.language = language;
    saveConfig(config);
    console.log(chalk.green(t("config.configUpdated", { language })));
    process.exit(0);
  }

  // ── Handle --install-hook ──
  if (args.includes("--install-hook")) {
    await installHook();
    process.exit(0);
  }

  // ── Handle --settings ──
  if (args.includes("--settings") || args.includes("-s")) {
    await runSettingsMenu();
    process.exit(0);
  }

  // ── Handle --help ──
  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
${chalk.bold.hex(colors.primary)(t("app.name"))}${t("app.tagline")}

${chalk.bold(t("help.usage"))}
  commai                    ${t("help.interactive")}
  commai -q, --quick        ${t("help.quick")}
  commai -s, --short        ${t("help.short")}
  commai -l, --long         ${t("help.long")}
  commai -e, --emoji        ${t("help.emoji")}
  commai --lang <lang>      ${t("help.lang")}
  commai --push             ${t("help.push")}
  commai --install-hook     Installation du Git Hook
  commai --config           ${t("help.config")}
  commai --settings         ${t("help.settings")}
  commai --help             ${t("help.help")}
`);
    process.exit(0);
  }

  printBanner();
  // Language already initialized

  // ── Check git repo ──
  const git = createGit();
  if (!(await isGitRepo(git))) {
    console.error(chalk.red(t("git.notRepo")));
    process.exit(1);
  }

  // ── Load effective config (global + project .commairc) ──
  const effectiveConfig = getEffectiveConfig();

  // ── Get API key ──
  let apiKey = getApiKey();
  if (!apiKey) {
    apiKey = await setupApiKey();
  }

  // ── Determine language (Priority: Flag > Config > Default) ──
  let language = cliLang || effectiveConfig.language || "en";

  // ── Get branch info ──
  const branch = await getCurrentBranch(git);
  const { scope: branchScope, ticket } = parseBranchScope(branch);

  // ── Get diff ──
  const spinner = ora(t("git.analyzingDiff")).start();
  let diff, diffStats;
  try {
    const excludePatterns = (effectiveConfig.excludeFiles || []).map(
      (p) => new RegExp(p.replace(/\*/g, ".*"))
    );
    const result = await getSmartDiff(git, { extraIgnore: excludePatterns });
    diff = result.diff;
    diffStats = result.stats;
  } catch (err) {
    spinner.fail(t("git.diffError") + err.message);
    process.exit(1);
  }

  if (!diff.trim()) {
    spinner.warn(chalk.yellow(t("git.noChanges")));
    const { continueAnyway } = await inquirer.prompt([
      {
        type: "confirm",
        name: "continueAnyway",
        message: t("git.continueAnyway"),
        default: false,
      },
    ]);
    if (!continueAnyway) process.exit(0);
    diff = "No diff available — generate a generic commit message.";
  } else {
    const statsInfo = diffStats
      ? chalk.dim(t("ui.stats", { ...diffStats }))
      : chalk.dim(` (${diff.length} chars)`);
    spinner.succeed(chalk.green(t("git.diffSuccess")) + statsInfo);
  }

  // ── Show file status ──
  const { staged, unstaged } = await getStagedFiles(git);
  printFileStatus(staged, unstaged);

  // ── Show branch info ──
  if (branch) {
    // Also detect scope from staged files
    const fileScope = detectScopeFromFiles(staged.length > 0 ? staged : unstaged);
    const scope = branchScope || fileScope;
    printBranchInfo(branch, scope, language);
    console.log();
  }

  // ── Determine mode ──
  let selectedMode = effectiveConfig.defaultMode || null;

  if (args.includes("-q") || args.includes("--quick")) selectedMode = "quick";
  else if (args.includes("-s") || args.includes("--short")) selectedMode = "short";
  else if (args.includes("-l") || args.includes("--long")) selectedMode = "long";
  else if (args.includes("-e") || args.includes("--emoji")) selectedMode = "emoji";

  if (!selectedMode) {
    const { mode } = await inquirer.prompt([
      {
        type: "list",
        name: "mode",
        message: t("modes.promptMode"),
        choices: MODES.map(m => ({ name: m.name(), value: m.value })),
        pageSize: MODES.length,
      },
    ]);
    selectedMode = mode;
  }

  // ── Detect scope ──
  const fileScope = detectScopeFromFiles(staged.length > 0 ? staged : unstaged);
  const scope = branchScope || fileScope;

  // ── Generate commit message ──
  const genSpinner = ora(t("git.generating")).start();
  let commitMessage;
  try {
    commitMessage = await generateCommit(apiKey, diff, selectedMode, {
      branch,
      scope,
      ticket,
      rules: effectiveConfig.rules,
      language,
      onStream: (chunk) => {
        if (genSpinner.isSpinning) genSpinner.stop();
        process.stdout.write(chalk.dim(chunk));
      },
    });
    // Clear the streamed output and show the clean version
    if (!genSpinner.isSpinning) {
      process.stdout.write("\n");
      console.log(chalk.green("✓ ") + chalk.green(t("git.diffSuccess")));
    } else {
      genSpinner.succeed(chalk.green(t("git.diffSuccess")));
    }
  } catch (err) {
    genSpinner.fail(t("chat.error") + err.message);
    if (err.message.includes("API_KEY") || err.message.includes("401")) {
      console.log(
        chalk.yellow(t("git.diffError") + ' "commai --config"')
      );
    }
    process.exit(1);
  }

  // ── Display generated message ──
  console.log("\n" + messageBox(commitMessage, { title: t("git.diffSuccess") }));

  // ── Chat mode auto-entry ──
  if (selectedMode === "chat") {
    commitMessage = await chatMode(apiKey, diff, commitMessage);
    console.log(
      "\n" + messageBox(commitMessage, { title: t("chat.updatedMessage"), borderColor: "green" })
    );
  }

  // ── Hook mode final action ──
  const hookIdx = args.indexOf("--hook");
  if (hookIdx !== -1) {
    const hookFile = args[hookIdx + 1];
    if (hookFile) {
      try {
        writeFileSync(hookFile, commitMessage);
        process.exit(0);
      } catch (err) {
        console.error(chalk.red("Error writing to hook file: " + err.message));
        process.exit(1);
      }
    }
  }

  // ── Final action ──
  const autoPush = args.includes("--push");

  const { action } = await inquirer.prompt([
    {
      type: "list",
      name: "action",
      message: t("actions.promptAction"),
      choices: [
        { name: t("actions.commitNow"), value: "commit" },
        ...(selectedMode !== "chat"
          ? [{ name: t("actions.refineAi"), value: "chat" }]
          : []),
        { name: t("actions.copyClipboard"), value: "copy" },
        { name: t("actions.editManually"), value: "edit" },
        { name: t("chat.regenerate"), value: "regen" },
        { name: t("actions.settings"), value: "settings" },
        { name: t("actions.cancel"), value: "cancel" },
      ],
    },
  ]);

  if (action === "cancel") {
    console.log(chalk.dim(t("actions.cancelled")));
    process.exit(0);
  }

  if (action === "settings") {
    await runSettingsMenu();
    // After settings, we might want to resume or exit? 
    // For now, let's just exit to be safe as settings might have changed lang.
    process.exit(0);
  }

  if (action === "copy") {
    handleCopy(commitMessage);
    process.exit(0);
  }

  if (action === "edit") {
    const { edited } = await inquirer.prompt([
      {
        type: "editor",
        name: "edited",
        message: t("chat.promptEdit"),
        default: commitMessage,
      },
    ]);
    commitMessage = edited.trim();
  }

  if (action === "chat") {
    commitMessage = await chatMode(apiKey, diff, commitMessage);
    console.log(
      "\n" + messageBox(commitMessage, { title: t("chat.updatedMessage"), borderColor: "green" })
    );

    // Ask again after chat
    const { finalAction } = await inquirer.prompt([
      {
        type: "list",
        name: "finalAction",
        message: t("actions.confirmCommit"),
        choices: [
          { name: t("actions.commit"), value: "commit" },
          { name: t("actions.copy"), value: "copy" },
          { name: t("actions.cancel"), value: "cancel" },
        ],
      },
    ]);

    if (finalAction === "cancel") {
      console.log(chalk.dim(t("actions.cancelled")));
      process.exit(0);
    }
    if (finalAction === "copy") {
      handleCopy(commitMessage);
      process.exit(0);
    }
  }

  if (action === "regen") {
    const regenSpinner = ora(t("chat.regenerating")).start();
    commitMessage = await generateCommit(apiKey, diff, selectedMode, {
      branch,
      scope,
      language,
    });
    regenSpinner.succeed(t("chat.regenerated"));
    console.log("\n" + messageBox(commitMessage, { title: t("chat.newMessage") }));
  }

  // ── Commit ──
  if (action === "commit" || action === "regen" || action === "chat" || action === "edit") {
    await doCommit(git, commitMessage, autoPush);
  }

  console.log();
}
