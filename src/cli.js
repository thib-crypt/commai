import chalk from "chalk";
import inquirer from "inquirer";
import ora from "ora";
import MODES from "./modes.js";
import { loadConfig, saveConfig, getApiKey, getEffectiveConfig } from "./config.js";
import {
  createGit, isGitRepo, getSmartDiff,
  getStagedFiles, getCurrentBranch,
  parseBranchScope, detectScopeFromFiles,
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

// ─── Setup API key ────────────────────────────────────────────────────────────

async function setupApiKey() {
  console.log(
    chalk.yellow("⚠️  Aucune clé API Gemini trouvée.\n") +
      chalk.gray(
        "  Obtenez une clé gratuite sur : https://aistudio.google.com/apikey\n"
      )
  );

  const { apiKey } = await inquirer.prompt([
    {
      type: "password",
      name: "apiKey",
      message: "Collez votre clé API Gemini :",
      mask: "•",
      validate: (v) => (v.trim().length > 0 ? true : "Clé requise"),
    },
  ]);

  const key = apiKey.trim();

  const { language } = await inquirer.prompt([
    {
      type: "list",
      name: "language",
      message: "Langue par défaut des messages de commit :",
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
  const spinner = ora("Vérification de la clé...").start();
  const valid = await validateApiKey(key);
  if (!valid) {
    spinner.fail("Clé API invalide. Vérifiez votre clé et réessayez.");
    process.exit(1);
  }
  spinner.succeed("Clé API valide");

  const config = loadConfig();
  config.geminiApiKey = key;
  config.language = language;
  saveConfig(config);
  console.log(chalk.green(`✅ Configuration sauvegardée dans ~/.commai.json (Langue: ${language})\n`));
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
        message: "Que faire ?",
        choices: [
          { name: "✅ Utiliser ce message", value: "use" },
          { name: "💬 Demander une modification", value: "chat" },
          { name: "🔄 Régénérer complètement", value: "regen" },
          { name: "✏️  Éditer manuellement", value: "edit" },
        ],
      },
    ]);

    if (action === "use") return currentMessage;

    if (action === "edit") {
      const { edited } = await inquirer.prompt([
        {
          type: "editor",
          name: "edited",
          message: "Éditez le message :",
          default: currentMessage,
        },
      ]);
      return edited.trim();
    }

    if (action === "regen") {
      const spinner = ora("Régénération...").start();
      currentMessage = await generateCommit(apiKey, diff, "standard");
      spinner.succeed("Message régénéré");
      console.log(messageBox(currentMessage, { title: "Nouveau message" }));
      continue;
    }

    if (action === "chat") {
      const { userMsg } = await inquirer.prompt([
        {
          type: "input",
          name: "userMsg",
          message: chalk.cyan("Toi →"),
          prefix: "",
        },
      ]);

      if (!userMsg.trim()) continue;

      const spinner = ora("Gemini réfléchit...").start();
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
            chalk.hex(colors.success).bold("Gemini →") +
            "\n" +
            chalk.gray(response)
        );

        if (currentMessage !== initialMessage) {
          console.log(
            "\n" + compactBox(currentMessage, { title: "Message mis à jour" })
          );
        }
      } catch (err) {
        spinner.fail("Erreur Gemini : " + err.message);
      }
    }
  }
}

// ─── Commit & push ────────────────────────────────────────────────────────────

async function doCommit(git, commitMessage, autoPush) {
  // Stage all if nothing staged
  const { status } = await getStagedFiles(git);
  if (status.staged.length === 0 && status.created.length === 0) {
    const { stageAll } = await inquirer.prompt([
      {
        type: "confirm",
        name: "stageAll",
        message: "Rien n'est stagé. Veux-tu faire git add -A avant de committer ?",
        default: true,
      },
    ]);
    if (stageAll) {
      await git.add("-A");
      console.log(chalk.green("✅ Tous les fichiers stagés."));
    }
  }

  const commitSpinner = ora("Commit en cours...").start();
  try {
    await git.commit(commitMessage);
    commitSpinner.succeed(
      chalk.green("✅ Commit effectué : ") +
        chalk.bold(commitMessage.split("\n")[0])
    );
  } catch (err) {
    commitSpinner.fail("Erreur commit : " + err.message);
    process.exit(1);
  }

  // Push
  if (autoPush) {
    const pushSpinner = ora("Push...").start();
    try {
      await git.push();
      pushSpinner.succeed(chalk.green("✅ Push effectué !"));
    } catch (err) {
      pushSpinner.fail("Erreur push : " + err.message);
    }
  } else {
    const { wantPush } = await inquirer.prompt([
      {
        type: "confirm",
        name: "wantPush",
        message: "Push maintenant ?",
        default: false,
      },
    ]);
    if (wantPush) {
      const pushSpinner = ora("Push...").start();
      try {
        await git.push();
        pushSpinner.succeed(chalk.green("✅ Push effectué !"));
      } catch (err) {
        pushSpinner.fail("Erreur push : " + err.message);
      }
    }
  }
}

// ─── Handle copy action ──────────────────────────────────────────────────────

function handleCopy(commitMessage) {
  const ok = copyToClipboard(commitMessage);
  if (ok) {
    console.log(chalk.green("✅ Copié dans le presse-papier !"));
  } else {
    console.log(chalk.yellow("Impossible de copier. Voici le message :"));
    console.log(commitMessage);
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export async function main() {
  const args = process.argv.slice(2);

  // ── Handle --config ──
  if (args.includes("--config") || args.includes("-c")) {
    const { apiKey } = await inquirer.prompt([
      {
        type: "password",
        name: "apiKey",
        message: "Nouvelle clé API Gemini :",
        mask: "•",
        validate: (v) => (v.trim().length > 0 ? true : "Clé requise"),
      },
    ]);
    const config = loadConfig();
    const { language } = await inquirer.prompt([
      {
        type: "list",
        name: "language",
        message: "Langue par défaut :",
        choices: [
          { name: "English", value: "en" },
          { name: "Français", value: "fr" },
          { name: "Español", value: "es" },
          { name: "Deutsch", value: "de" },
        ],
        default: config.language || "en",
      },
    ]);

    const spinner = ora("Vérification...").start();
    const valid = await validateApiKey(key);
    if (!valid) {
      spinner.fail("Clé API invalide.");
      process.exit(1);
    }
    spinner.succeed("Clé valide");

    config.geminiApiKey = key;
    config.language = language;
    saveConfig(config);
    console.log(chalk.green(`✅ Configuration mise à jour (Langue: ${language})`));
    process.exit(0);
  }

  // ── Handle --help ──
  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
${chalk.bold.hex(colors.primary)("commai")} — Générateur de messages de commit IA

${chalk.bold("Usage:")}
  commai                    Lancer en mode interactif
  commai -q, --quick        Mode rapide (une ligne)
  commai -s, --short        Mode court
  commai -l, --long         Mode long et détaillé
  commai -e, --emoji        Mode gitmoji
  commai --lang <lang>      Forcer la langue (en, fr, es, de, etc.)
  commai --push             Générer, committer et push automatiquement
  commai --config           Reconfigurer la clé API
  commai --help             Afficher cette aide
`);
    process.exit(0);
  }

  printBanner();

  // ── Check git repo ──
  const git = createGit();
  if (!(await isGitRepo(git))) {
    console.error(chalk.red("❌ Ce dossier n'est pas un dépôt Git."));
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
  let language = effectiveConfig.language || "en";
  const langIdx = args.findIndex(a => a === "--lang" || a === "-lg");
  if (langIdx !== -1 && args[langIdx + 1]) {
    language = args[langIdx + 1];
  }

  // ── Get branch info ──
  const branch = await getCurrentBranch(git);
  const branchScope = parseBranchScope(branch);

  // ── Get diff ──
  const spinner = ora("Analyse du diff Git...").start();
  let diff, diffStats;
  try {
    const excludePatterns = (effectiveConfig.excludeFiles || []).map(
      (p) => new RegExp(p.replace(/\*/g, ".*"))
    );
    const result = await getSmartDiff(git, { extraIgnore: excludePatterns });
    diff = result.diff;
    diffStats = result.stats;
  } catch (err) {
    spinner.fail("Impossible de lire le diff : " + err.message);
    process.exit(1);
  }

  if (!diff.trim()) {
    spinner.warn(chalk.yellow("Aucun changement détecté (staged ou non stagé)."));
    const { continueAnyway } = await inquirer.prompt([
      {
        type: "confirm",
        name: "continueAnyway",
        message: "Continuer quand même ?",
        default: false,
      },
    ]);
    if (!continueAnyway) process.exit(0);
    diff = "No diff available — generate a generic commit message.";
  } else {
    const statsInfo = diffStats
      ? chalk.dim(` (+${diffStats.insertions} -${diffStats.deletions} in ${diffStats.totalFiles} files)`)
      : chalk.dim(` (${diff.length} chars)`);
    spinner.succeed(chalk.green("Diff récupéré") + statsInfo);
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
        message: "Quel style de message ?",
        choices: MODES,
        pageSize: MODES.length,
      },
    ]);
    selectedMode = mode;
  }

  // ── Detect scope ──
  const fileScope = detectScopeFromFiles(staged.length > 0 ? staged : unstaged);
  const scope = branchScope || fileScope;

  // ── Generate commit message ──
  const genSpinner = ora("Génération du message...").start();
  let commitMessage;
  try {
    commitMessage = await generateCommit(apiKey, diff, selectedMode, {
      branch,
      scope,
      language,
      onStream: (chunk) => {
        if (genSpinner.isSpinning) genSpinner.stop();
        process.stdout.write(chalk.dim(chunk));
      },
    });
    // Clear the streamed output and show the clean version
    if (!genSpinner.isSpinning) {
      process.stdout.write("\n");
      console.log(chalk.green("✓ ") + chalk.green("Message généré"));
    } else {
      genSpinner.succeed(chalk.green("Message généré"));
    }
  } catch (err) {
    genSpinner.fail("Erreur API Gemini : " + err.message);
    if (err.message.includes("API_KEY") || err.message.includes("401")) {
      console.log(
        chalk.yellow('Relancez "commai --config" pour mettre à jour votre clé.')
      );
    }
    process.exit(1);
  }

  // ── Display generated message ──
  console.log("\n" + messageBox(commitMessage, { title: "Message généré" }));

  // ── Chat mode auto-entry ──
  if (selectedMode === "chat") {
    commitMessage = await chatMode(apiKey, diff, commitMessage);
    console.log(
      "\n" + messageBox(commitMessage, { title: "Message final", borderColor: "green" })
    );
  }

  // ── Final action ──
  const autoPush = args.includes("--push");

  const { action } = await inquirer.prompt([
    {
      type: "list",
      name: "action",
      message: "Que faire avec ce message ?",
      choices: [
        { name: "✅ Committer maintenant", value: "commit" },
        ...(selectedMode !== "chat"
          ? [{ name: "💬 Affiner avec l'IA", value: "chat" }]
          : []),
        { name: "📋 Copier dans le presse-papier", value: "copy" },
        { name: "✏️  Éditer manuellement", value: "edit" },
        { name: "🔄 Régénérer", value: "regen" },
        { name: "❌ Annuler", value: "cancel" },
      ],
    },
  ]);

  if (action === "cancel") {
    console.log(chalk.dim("Annulé."));
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
        message: "Éditez le message :",
        default: commitMessage,
      },
    ]);
    commitMessage = edited.trim();
  }

  if (action === "chat") {
    commitMessage = await chatMode(apiKey, diff, commitMessage);
    console.log(
      "\n" + messageBox(commitMessage, { title: "Message final", borderColor: "green" })
    );

    // Ask again after chat
    const { finalAction } = await inquirer.prompt([
      {
        type: "list",
        name: "finalAction",
        message: "Committer ce message ?",
        choices: [
          { name: "✅ Committer", value: "commit" },
          { name: "📋 Copier", value: "copy" },
          { name: "❌ Annuler", value: "cancel" },
        ],
      },
    ]);

    if (finalAction === "cancel") {
      console.log(chalk.dim("Annulé."));
      process.exit(0);
    }
    if (finalAction === "copy") {
      handleCopy(commitMessage);
      process.exit(0);
    }
  }

  if (action === "regen") {
    const regenSpinner = ora("Régénération...").start();
    commitMessage = await generateCommit(apiKey, diff, selectedMode, {
      branch,
      scope,
      language,
    });
    regenSpinner.succeed("Message régénéré");
    console.log("\n" + messageBox(commitMessage, { title: "Nouveau message" }));
  }

  // ── Commit ──
  if (action === "commit" || action === "regen" || action === "chat" || action === "edit") {
    await doCommit(git, commitMessage, autoPush);
  }

  console.log();
}
