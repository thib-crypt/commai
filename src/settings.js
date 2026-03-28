import inquirer from "inquirer";
import chalk from "chalk";
import { loadConfig, updateConfig, saveConfig } from "./config.js";
import { t, initI18n, setInterfaceLanguage } from "./i18n.js";
import { validateApiKey } from "./ai.js";
import ora from "ora";
import MODES from "./modes.js";

export async function runSettingsMenu() {
  const config = loadConfig();

  while (true) {
    console.clear();
    console.log(chalk.bold.hex("#A78BFA")(`\n--- ${t("settings.title")} ---`));

    const choices = [
      {
        name: `${t("settings.apiKey")} ${chalk.dim("(" + (config.geminiApiKey ? "••••" + config.geminiApiKey.slice(-4) : "None") + ")")}`,
        value: "apiKey",
      },
      {
        name: `${t("settings.interfaceLang")} ${chalk.dim("(" + (config.interfaceLanguage || config.language || "en") + ")")}`,
        value: "interfaceLang",
      },
      {
        name: `${t("settings.commitLang")} ${chalk.dim("(" + (config.language || "en") + ")")}`,
        value: "commitLang",
      },
      {
        name: `${t("settings.defaultMode")} ${chalk.dim("(" + (config.defaultMode || "None") + ")")}`,
        value: "defaultMode",
      },
      {
        name: t("settings.exit"),
        value: "exit",
      },
    ];

    const { action } = await inquirer.prompt([
      {
        type: "list",
        name: "action",
        message: t("chat.promptAction"),
        choices,
      },
    ]);

    if (action === "exit") break;

    switch (action) {
      case "apiKey":
        await updateApiKey();
        break;
      case "interfaceLang":
        await updateInterfaceLang();
        break;
      case "commitLang":
        await updateCommitLang();
        break;
      case "defaultMode":
        await updateDefaultMode();
        break;
    }
  }
}

async function updateApiKey() {
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
  const spinner = ora(t("setup.verifyingKey")).start();
  const valid = await validateApiKey(key);
  if (!valid) {
    spinner.fail(t("setup.invalidKey"));
    return;
  }
  spinner.succeed(t("setup.validKey"));
  updateConfig("geminiApiKey", key);
}

async function updateInterfaceLang() {
  const { lang } = await inquirer.prompt([
    {
      type: "list",
      name: "lang",
      message: t("settings.interfaceLang"),
      choices: [
        { name: "English", value: "en" },
        { name: "Français", value: "fr" },
      ],
      default: loadConfig().interfaceLanguage || "en",
    },
  ]);

  updateConfig("interfaceLanguage", lang);
  setInterfaceLanguage(lang);
  console.log(chalk.green(`✅ ${t("settings.updated")} !`));
}

async function updateCommitLang() {
  const { lang } = await inquirer.prompt([
    {
      type: "list",
      name: "lang",
      message: t("settings.commitLang"),
      choices: [
        { name: "English", value: "en" },
        { name: "Français", value: "fr" },
        { name: "Español", value: "es" },
        { name: "Deutsch", value: "de" },
      ],
      default: loadConfig().language || "en",
    },
  ]);

  updateConfig("language", lang);
  console.log(chalk.green(`✅ ${t("settings.updated")} !`));
}

async function updateDefaultMode() {
  const choices = [
    { name: t("actions.cancel"), value: null },
    ...MODES.map((m) => ({ name: m.name(), value: m.value })),
  ];

  const { mode } = await inquirer.prompt([
    {
      type: "list",
      name: "mode",
      message: t("settings.defaultMode"),
      choices,
    },
  ]);

  if (mode !== null) {
    updateConfig("defaultMode", mode);
    console.log(chalk.green(`✅ ${t("settings.updated")} !`));
  }
}
