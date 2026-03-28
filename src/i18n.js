import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { loadConfig } from "./config.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const fr = JSON.parse(readFileSync(join(__dirname, "locales/fr.json"), "utf8"));
const en = JSON.parse(readFileSync(join(__dirname, "locales/en.json"), "utf8"));

const locales = { fr, en };

let currentLocale = "en";

/**
 * Initialize the i18n system with the preferred language.
 */
export function initI18n(langOverride = null) {
  const config = loadConfig();
  // Override > interfaceLanguage > fallback to generation language > 'en'
  currentLocale = langOverride || config.interfaceLanguage || config.language || "en";
  if (!locales[currentLocale]) {
    currentLocale = "en";
  }
}

/**
 * Get a translated string.
 * @param {string} key Path to the key (e.g. "app.name")
 * @param {object} params Object with values to replace in the string (e.g. { name: "World" })
 */
export function t(key, params = {}) {
  const keys = key.split(".");
  let value = locales[currentLocale];

  for (const k of keys) {
    if (value && value[k]) {
      value = value[k];
    } else {
      // Fallback to English if key missing in current locale
      let englishValue = locales["en"];
      for (const ek of keys) {
        if (englishValue && englishValue[ek]) {
          englishValue = englishValue[ek];
        } else {
          return key; // Key not found at all
        }
      }
      value = englishValue;
      break;
    }
  }

  if (typeof value !== "string") return key;

  // Replace placeholders: {paramName}
  return value.replace(/{(\w+)}/g, (_, p) => params[p] ?? `{${p}}`);
}

/**
 * Get the current interface language.
 */
export function getInterfaceLanguage() {
  return currentLocale;
}

/**
 * Set the current interface language manually (temporary).
 */
export function setInterfaceLanguage(lang) {
  if (locales[lang]) {
    currentLocale = lang;
  }
}
