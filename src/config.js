import { readFileSync, existsSync, writeFileSync } from "fs";
import { join } from "path";
import os from "os";

// ─── Config Paths ─────────────────────────────────────────────────────────────

const CONFIG_PATH = join(os.homedir(), ".commai.json");

// ─── Load / Save ──────────────────────────────────────────────────────────────

export function loadConfig() {
  if (existsSync(CONFIG_PATH)) {
    try {
      return JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
    } catch {
      // corrupted file — return defaults
    }
  }
  return {};
}

export function saveConfig(config) {
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

export function updateConfig(key, value) {
  const config = loadConfig();
  config[key] = value;
  saveConfig(config);
}

// ─── API Key ──────────────────────────────────────────────────────────────────

export function getApiKey() {
  const config = loadConfig();
  if (config.geminiApiKey) return config.geminiApiKey;
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  return null;
}

// ─── Project-level .commairc ──────────────────────────────────────────────────

export function loadProjectConfig(cwd = process.cwd()) {
  const rcPath = join(cwd, ".commairc");
  if (existsSync(rcPath)) {
    try {
      return JSON.parse(readFileSync(rcPath, "utf-8"));
    } catch {
      // invalid .commairc — ignore
    }
  }
  return {};
}

/**
 * Merge global config with project-level overrides.
 * Project config wins for overlapping keys.
 */
export function getEffectiveConfig(cwd = process.cwd()) {
  const global = loadConfig();
  const project = loadProjectConfig(cwd);
  return { ...global, ...project };
}

export { CONFIG_PATH };
