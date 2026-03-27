import { simpleGit } from "simple-git";

// ─── Patterns to ignore in smart diff ────────────────────────────────────────

const DEFAULT_IGNORE_PATTERNS = [
  /package-lock\.json$/,
  /yarn\.lock$/,
  /pnpm-lock\.yaml$/,
  /\.min\.(js|css)$/,
  /\.map$/,
  /dist\//,
  /build\//,
  /\.next\//,
  /node_modules\//,
  /\.DS_Store$/,
];

// ─── Git instance ─────────────────────────────────────────────────────────────

export function createGit(cwd = process.cwd()) {
  return simpleGit(cwd);
}

export async function isGitRepo(git) {
  return git.checkIsRepo().catch(() => false);
}

// ─── Diff retrieval ───────────────────────────────────────────────────────────

/**
 * Smart diff: ignores lockfiles/dist, prioritizes most-changed files,
 * and includes a summary header for better AI context.
 */
export async function getSmartDiff(git, {
  maxChars = 12000,
  extraIgnore = [],
} = {}) {
  const ignorePatterns = [...DEFAULT_IGNORE_PATTERNS, ...extraIgnore];

  // Try staged first, then HEAD
  let diffArgs = ["--staged"];
  let summary = await git.diffSummary(diffArgs);

  if (summary.files.length === 0) {
    diffArgs = ["HEAD"];
    summary = await git.diffSummary(diffArgs);
  }

  if (summary.files.length === 0) {
    diffArgs = ["--cached"];
    summary = await git.diffSummary(diffArgs);
  }

  if (summary.files.length === 0) {
    return { diff: "", stats: null };
  }

  // Filter and sort files by importance
  const relevantFiles = summary.files
    .filter((f) => !ignorePatterns.some((p) => p.test(f.file)))
    .sort(
      (a, b) =>
        b.insertions + b.deletions - (a.insertions + a.deletions)
    );

  const ignoredCount = summary.files.length - relevantFiles.length;

  // Build diff header with stats
  let diff = `Changes: +${summary.insertions} -${summary.deletions} in ${summary.files.length} files`;
  if (ignoredCount > 0) {
    diff += ` (${ignoredCount} auto-generated/lock files excluded)`;
  }
  diff += "\n\n";

  // Append file diffs, prioritizing most-changed files
  for (const file of relevantFiles) {
    try {
      const fileDiff = await git.diff([...diffArgs, "--", file.file]);
      if (diff.length + fileDiff.length > maxChars) {
        const remaining = relevantFiles.length - relevantFiles.indexOf(file);
        diff += `\n[... ${remaining} more files truncated for brevity]\n`;
        break;
      }
      diff += fileDiff;
    } catch {
      // file might have been deleted or renamed
      continue;
    }
  }

  return {
    diff,
    stats: {
      totalFiles: summary.files.length,
      relevantFiles: relevantFiles.length,
      insertions: summary.insertions,
      deletions: summary.deletions,
    },
  };
}

/**
 * Legacy simple diff (fallback).
 */
export async function getDiff(git) {
  let diff = await git.diff(["--staged"]);
  if (!diff.trim()) diff = await git.diff(["HEAD"]);
  if (!diff.trim()) diff = await git.diff(["--cached"]);
  return diff;
}

// ─── File status ──────────────────────────────────────────────────────────────

export async function getStagedFiles(git) {
  const status = await git.status();
  const staged = [
    ...status.staged,
    ...status.created,
    ...status.renamed.map((r) => r.to),
  ];
  const unstaged = [
    ...status.modified,
    ...status.deleted,
    ...status.not_added,
  ];
  return { staged, unstaged, status };
}

// ─── Branch detection ─────────────────────────────────────────────────────────

/**
 * Returns the current branch name.
 * Useful for giving context to the AI (e.g. feat/JIRA-123-auth).
 */
export async function getCurrentBranch(git) {
  try {
    const branchInfo = await git.branchLocal();
    return branchInfo.current;
  } catch {
    return null;
  }
}

/**
 * Try to extract a scope from the branch name.
 * e.g. "feat/auth-login" → "auth"
 * e.g. "fix/PROJ-123-api-error" → "api"
 */
export function parseBranchScope(branchName) {
  if (!branchName) return null;

  // Remove common prefixes: feat/, fix/, chore/, etc.
  const withoutPrefix = branchName.replace(
    /^(feat|fix|chore|docs|refactor|test|style|build|ci|perf|revert|hotfix|release)\//i,
    ""
  );

  // Remove ticket patterns: JIRA-123-, PROJ-456-, #789-
  const withoutTicket = withoutPrefix.replace(
    /^[A-Z]+-\d+-|^#\d+-/,
    ""
  );

  // Take the first meaningful word as scope
  const parts = withoutTicket.split(/[-_/]/);
  const scope = parts[0]?.toLowerCase();

  return scope && scope.length > 1 ? scope : null;
}

// ─── Auto scope from files ───────────────────────────────────────────────────

/**
 * Detect a scope from the modified files.
 * Looks for a common top-level directory among changed files.
 */
export function detectScopeFromFiles(files) {
  if (!files || files.length === 0) return null;

  // Extract top-level directories
  const dirs = files
    .map((f) => {
      const parts = f.split("/");
      return parts.length > 1 ? parts[0] : null;
    })
    .filter(Boolean);

  if (dirs.length === 0) return null;

  // Count occurrences
  const counts = {};
  for (const dir of dirs) {
    counts[dir] = (counts[dir] || 0) + 1;
  }

  // Find the most common directory
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);

  // If one directory has > 60% of files, use it as scope
  if (sorted[0][1] / dirs.length >= 0.6) {
    const scope = sorted[0][0];
    // Skip generic directories
    if (!["src", "lib", "app", "packages"].includes(scope)) {
      return scope;
    }
    // If it's "src", try one level deeper
    if (scope === "src") {
      const subDirs = files
        .filter((f) => f.startsWith("src/"))
        .map((f) => f.split("/")[1])
        .filter(Boolean);
      const subCounts = {};
      for (const d of subDirs) {
        subCounts[d] = (subCounts[d] || 0) + 1;
      }
      const subSorted = Object.entries(subCounts).sort(
        (a, b) => b[1] - a[1]
      );
      if (subSorted.length > 0 && subSorted[0][1] / subDirs.length >= 0.6) {
        return subSorted[0][0];
      }
    }
  }

  return null;
}
