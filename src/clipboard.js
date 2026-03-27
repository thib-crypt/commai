import { execSync } from "child_process";

/**
 * Copy text to the system clipboard.
 * Uses platform-specific commands with proper escaping.
 * @param {string} text - Text to copy
 * @returns {boolean} true if successful
 */
export function copyToClipboard(text) {
  const platform = process.platform;

  try {
    if (platform === "darwin") {
      execSync("pbcopy", { input: text, stdio: ["pipe", "ignore", "ignore"] });
    } else if (platform === "linux") {
      try {
        execSync("xclip -selection clipboard", {
          input: text,
          stdio: ["pipe", "ignore", "ignore"],
        });
      } catch {
        execSync("xsel --clipboard --input", {
          input: text,
          stdio: ["pipe", "ignore", "ignore"],
        });
      }
    } else if (platform === "win32") {
      execSync("clip", { input: text, stdio: ["pipe", "ignore", "ignore"] });
    } else {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}
