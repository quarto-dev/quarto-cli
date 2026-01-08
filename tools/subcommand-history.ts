/**
 * subcommand-history.ts
 *
 * Analyzes git history of a cliffy-based CLI to produce a timeline
 * of when commands/subcommands were introduced and removed.
 *
 * Usage: quarto run tools/subcommand-history.ts
 *
 * ## What this tool detects
 *
 * 1. **Top-level commands** - directories under `src/command/` (e.g., `render/`, `publish/`)
 * 2. **Cliffy subcommands** - registered via `.command()` API
 * 3. **Publish providers** - directories under `src/publish/` (e.g., `netlify/`, `gh-pages/`)
 *
 * ## What this tool cannot detect
 *
 * Commands that parse arguments internally rather than using cliffy's subcommand system.
 *
 * **Cliffy `.command()` registration** (detected):
 * ```typescript
 * // In call/cmd.ts
 * export const callCommand = new Command()
 *   .command("engine", engineCommand)        // ← Creates "quarto call engine"
 *   .command("build-ts-extension", ...)      // ← Creates "quarto call build-ts-extension"
 * ```
 * Cliffy handles routing to these subcommands automatically.
 *
 * **Internal argument parsing** (not detected):
 * ```typescript
 * // In install/cmd.ts
 * export const installCommand = new Command()
 *   .arguments("[target...]")                 // ← Just takes arguments
 *   .action(async (options, ...target) => {
 *     if (target === "tinytex") { ... }       // ← Code checks the value manually
 *     if (target === "chromium") { ... }
 *   });
 * ```
 * Here `tinytex` isn't a registered subcommand - it's just an argument value the code
 * checks for.
 *
 * Both look the same to users (`quarto call engine` vs `quarto install tinytex`), but
 * they're implemented differently. This tool can only detect the first pattern by
 * searching for `.command("..."` in the code.
 */

import { join, relative } from "https://deno.land/std/path/mod.ts";

interface CommandEntry {
  date: string;
  hash: string;
  command: string;
  message: string;
  removed?: boolean;
  parent?: string; // for subcommands, the parent command name
}

// Execute git command and return stdout
async function runGit(args: string[], cwd?: string): Promise<string> {
  const cmd = new Deno.Command("git", {
    args,
    cwd,
    stdout: "piped",
    stderr: "piped",
  });
  const { stdout, stderr, success } = await cmd.output();
  if (!success) {
    const errText = new TextDecoder().decode(stderr);
    throw new Error(`git ${args.join(" ")} failed: ${errText}`);
  }
  return new TextDecoder().decode(stdout).trim();
}

// Find the git repository root
async function findGitRoot(): Promise<string> {
  return await runGit(["rev-parse", "--show-toplevel"]);
}

// Parse git log output line: "YYYY-MM-DD hash message"
function parseGitLogLine(line: string): { date: string; hash: string; message: string } | null {
  const match = line.match(/^(\d{4}-\d{2}-\d{2})\s+([a-f0-9]+)\s+(.*)$/);
  if (!match) return null;
  return { date: match[1], hash: match[2], message: match[3] };
}

// Find when a directory was first added to git
async function findDirectoryIntroduction(
  dirPath: string,
  gitRoot: string
): Promise<CommandEntry | null> {
  const relPath = relative(gitRoot, dirPath);
  try {
    // Get the oldest commit that added files to this directory
    const output = await runGit(
      ["log", "--diff-filter=A", "--format=%as %h %s", "--reverse", "--", relPath],
      gitRoot
    );
    const lines = output.split("\n").filter((l) => l.trim());
    if (lines.length === 0) return null;

    const parsed = parseGitLogLine(lines[0]);
    if (!parsed) return null;

    const commandName = dirPath.split("/").pop() || "";
    return {
      date: parsed.date,
      hash: parsed.hash,
      command: commandName,
      message: parsed.message,
    };
  } catch {
    return null;
  }
}

// Find when a string pattern was introduced (oldest commit containing it)
async function findStringIntroduction(
  searchStr: string,
  path: string,
  gitRoot: string
): Promise<{ date: string; hash: string; message: string } | null> {
  const relPath = relative(gitRoot, path);
  try {
    // -S finds commits where the string count changed (added or removed)
    // --reverse gives oldest first
    const output = await runGit(
      ["log", "-S", searchStr, "--format=%as %h %s", "--reverse", "--", relPath],
      gitRoot
    );
    const lines = output.split("\n").filter((l) => l.trim());
    if (lines.length === 0) return null;

    return parseGitLogLine(lines[0]);
  } catch {
    return null;
  }
}

// Find when a string pattern was removed (most recent commit where it was removed)
async function findStringRemoval(
  searchStr: string,
  path: string,
  gitRoot: string
): Promise<{ date: string; hash: string; message: string } | null> {
  const relPath = relative(gitRoot, path);
  try {
    // Get most recent commit that changed this string (without --reverse, newest first)
    const output = await runGit(
      ["log", "-S", searchStr, "--format=%as %h %s", "--", relPath],
      gitRoot
    );
    const lines = output.split("\n").filter((l) => l.trim());
    if (lines.length === 0) return null;

    // The most recent commit is the removal
    return parseGitLogLine(lines[0]);
  } catch {
    return null;
  }
}

// Cliffy built-in commands that are inherited by all commands
const CLIFFY_BUILTINS = new Set(["help", "completions"]);

// Extract command names from .command("name" patterns
function extractCliffyCommandNames(content: string): string[] {
  const regex = /\.command\s*\(\s*["']([^"']+)["']/g;
  const names: string[] = [];
  let match;
  while ((match = regex.exec(content)) !== null) {
    // Extract just the command name (before any space for arguments like "install <tool:string>")
    const fullName = match[1];
    const cmdName = fullName.split(/\s+/)[0];
    // Skip cliffy built-in commands
    if (!CLIFFY_BUILTINS.has(cmdName)) {
      names.push(cmdName);
    }
  }
  return names;
}

// Get all directories in a path
async function getDirectories(path: string): Promise<string[]> {
  const dirs: string[] = [];
  try {
    for await (const entry of Deno.readDir(path)) {
      if (entry.isDirectory) {
        dirs.push(entry.name);
      }
    }
  } catch {
    // Directory doesn't exist
  }
  return dirs.sort();
}

// Scan for top-level commands (directories in src/command/)
async function scanTopLevelCommands(
  commandDir: string,
  gitRoot: string
): Promise<CommandEntry[]> {
  const entries: CommandEntry[] = [];
  const dirs = await getDirectories(commandDir);

  for (const dir of dirs) {
    const dirPath = join(commandDir, dir);
    const entry = await findDirectoryIntroduction(dirPath, gitRoot);
    if (entry) {
      entries.push(entry);
    }
  }

  return entries.sort((a, b) => a.date.localeCompare(b.date));
}

// Read all TypeScript files in a directory recursively
async function readTsFiles(dir: string): Promise<Map<string, string>> {
  const files = new Map<string, string>();

  async function walk(currentDir: string) {
    try {
      for await (const entry of Deno.readDir(currentDir)) {
        const fullPath = join(currentDir, entry.name);
        if (entry.isDirectory) {
          await walk(fullPath);
        } else if (entry.name.endsWith(".ts")) {
          try {
            const content = await Deno.readTextFile(fullPath);
            files.set(fullPath, content);
          } catch {
            // Skip unreadable files
          }
        }
      }
    } catch {
      // Skip unreadable directories
    }
  }

  await walk(dir);
  return files;
}

// Scan for cliffy subcommands in command directories
async function scanCliffySubcommands(
  commandDir: string,
  gitRoot: string
): Promise<Map<string, CommandEntry[]>> {
  const subcommandsByParent = new Map<string, CommandEntry[]>();
  const topLevelDirs = await getDirectories(commandDir);

  for (const parentCmd of topLevelDirs) {
    const parentDir = join(commandDir, parentCmd);
    const tsFiles = await readTsFiles(parentDir);

    // Collect all .command() names in this parent's directory
    const commandNames = new Set<string>();
    for (const [filePath, content] of tsFiles) {
      const names = extractCliffyCommandNames(content);
      for (const name of names) {
        commandNames.add(name);
      }
    }

    if (commandNames.size === 0) continue;

    const entries: CommandEntry[] = [];
    for (const cmdName of commandNames) {
      // Search for when this .command("name" was introduced
      const searchStr = `.command("${cmdName}`;
      const intro = await findStringIntroduction(searchStr, parentDir, gitRoot);

      // Also try single quotes
      if (!intro) {
        const searchStrSingle = `.command('${cmdName}`;
        const introSingle = await findStringIntroduction(searchStrSingle, parentDir, gitRoot);
        if (introSingle) {
          entries.push({
            date: introSingle.date,
            hash: introSingle.hash,
            command: `quarto ${parentCmd} ${cmdName}`,
            message: introSingle.message,
            parent: parentCmd,
          });
        }
      } else {
        entries.push({
          date: intro.date,
          hash: intro.hash,
          command: `quarto ${parentCmd} ${cmdName}`,
          message: intro.message,
          parent: parentCmd,
        });
      }
    }

    if (entries.length > 0) {
      entries.sort((a, b) => a.date.localeCompare(b.date));
      subcommandsByParent.set(parentCmd, entries);
    }
  }

  return subcommandsByParent;
}

// Search git history for .command() patterns that no longer exist in HEAD
async function scanRemovedCommands(
  commandDir: string,
  gitRoot: string
): Promise<CommandEntry[]> {
  const removed: CommandEntry[] = [];
  const relCommandDir = relative(gitRoot, commandDir);

  // Get all .command("X") patterns that ever existed in git history
  // Using git log -p to see actual diff content
  try {
    const output = await runGit(
      ["log", "-p", "--all", "-S", '.command("', "--", relCommandDir],
      gitRoot
    );

    // Extract all command names from the diff output (lines starting with +)
    const historicalCommands = new Set<string>();
    const addedPattern = /^\+.*\.command\s*\(\s*["']([^"']+)["']/gm;
    let match;
    while ((match = addedPattern.exec(output)) !== null) {
      const cmdName = match[1].split(/\s+/)[0];
      // Skip cliffy built-in commands
      if (!CLIFFY_BUILTINS.has(cmdName)) {
        historicalCommands.add(cmdName);
      }
    }

    // Get current commands in HEAD
    const currentCommands = new Set<string>();
    const tsFiles = await readTsFiles(commandDir);
    for (const [_, content] of tsFiles) {
      const names = extractCliffyCommandNames(content);
      for (const name of names) {
        currentCommands.add(name);
      }
    }

    // Find commands that existed historically but not now
    for (const cmd of historicalCommands) {
      if (!currentCommands.has(cmd)) {
        // Find when it was removed (most recent commit that touched this pattern)
        const searchStr = `.command("${cmd}`;
        const removal = await findStringRemoval(searchStr, commandDir, gitRoot);
        if (removal) {
          // Try to figure out the parent command from the git diff context
          // For now, just use the command name
          removed.push({
            date: removal.date,
            hash: removal.hash,
            command: `quarto ??? ${cmd}`,
            message: removal.message,
            removed: true,
          });
        }
      }
    }
  } catch (e) {
    console.error("Error scanning for removed commands:", e);
  }

  return removed.sort((a, b) => a.date.localeCompare(b.date));
}

// Format entries as markdown table with aligned columns
function formatTable(
  entries: CommandEntry[],
  columns: ("date" | "hash" | "command" | "message")[]
): string {
  if (entries.length === 0) return "_No entries found_\n";

  const headers: Record<string, string> = {
    date: "Date",
    hash: "Hash",
    command: "Command",
    message: "Commit Message",
  };

  // Build all cell values first
  const allRows: string[][] = [];

  // Header row
  allRows.push(columns.map((c) => headers[c]));

  // Data rows
  for (const e of entries) {
    const row = columns.map((c) => {
      if (c === "command" && e.removed) {
        return `~~${e[c]}~~`;
      }
      return e[c] || "";
    });
    allRows.push(row);
  }

  // Calculate max width for each column
  const colWidths = columns.map((_, i) =>
    Math.max(...allRows.map((row) => row[i].length))
  );

  // Format header row with padding
  const headerRow =
    "| " +
    columns.map((c, i) => headers[c].padEnd(colWidths[i])).join(" | ") +
    " |";

  // Format separator row with dashes
  const separatorRow =
    "|" + colWidths.map((w) => "-".repeat(w + 2)).join("|") + "|";

  // Format data rows with padding
  const dataRows = entries.map((e) => {
    const values = columns.map((c, i) => {
      let val: string;
      if (c === "command" && e.removed) {
        val = `~~${e[c]}~~`;
      } else {
        val = e[c] || "";
      }
      return val.padEnd(colWidths[i]);
    });
    return "| " + values.join(" | ") + " |";
  });

  return [headerRow, separatorRow, ...dataRows].join("\n") + "\n";
}

// Scan publish providers (directories in src/publish/)
async function scanPublishProviders(
  publishDir: string,
  gitRoot: string
): Promise<CommandEntry[]> {
  const entries: CommandEntry[] = [];
  const dirs = await getDirectories(publishDir);

  // Exclude non-provider directories/files
  const excludeDirs = new Set(["common"]);

  for (const dir of dirs) {
    if (excludeDirs.has(dir)) continue;

    const dirPath = join(publishDir, dir);
    const entry = await findDirectoryIntroduction(dirPath, gitRoot);
    if (entry) {
      entries.push({
        ...entry,
        command: `quarto publish ${dir}`,
        parent: "publish",
      });
    }
  }

  return entries.sort((a, b) => a.date.localeCompare(b.date));
}

// Find removed publish providers by checking git history
async function scanRemovedPublishProviders(
  publishDir: string,
  gitRoot: string
): Promise<CommandEntry[]> {
  const removed: CommandEntry[] = [];
  const relPublishDir = relative(gitRoot, publishDir);

  try {
    // Get all directories that ever existed in src/publish/
    const output = await runGit(
      ["log", "--all", "--name-status", "--diff-filter=D", "--", relPublishDir],
      gitRoot
    );

    // Extract deleted directory names
    const deletedDirs = new Set<string>();
    const deletePattern = /^D\s+src\/publish\/([^/]+)\//gm;
    let match;
    while ((match = deletePattern.exec(output)) !== null) {
      const dir = match[1];
      if (dir !== "common") {
        deletedDirs.add(dir);
      }
    }

    // Get current providers
    const currentDirs = new Set(await getDirectories(publishDir));

    // Find providers that were deleted
    for (const dir of deletedDirs) {
      if (!currentDirs.has(dir)) {
        // Find when it was removed
        const searchStr = `src/publish/${dir}/`;
        const removalOutput = await runGit(
          ["log", "--diff-filter=D", "--format=%as %h %s", "-1", "--", searchStr],
          gitRoot
        );
        const parsed = parseGitLogLine(removalOutput);
        if (parsed) {
          removed.push({
            date: parsed.date,
            hash: parsed.hash,
            command: `quarto publish ${dir}`,
            message: parsed.message,
            removed: true,
            parent: "publish",
          });
        }
      }
    }
  } catch (e) {
    console.error("Error scanning for removed publish providers:", e);
  }

  return removed.sort((a, b) => a.date.localeCompare(b.date));
}

// Main function
async function main() {
  const gitRoot = await findGitRoot();
  const commandDir = join(gitRoot, "src/command");
  const publishDir = join(gitRoot, "src/publish");

  console.log("# Quarto CLI Command History\n");
  console.log("_Generated by analyzing git history of cliffy `.command()` registrations and directory structure._\n");

  // 1. Top-level commands
  console.log("## Top-Level Commands (`quarto <verb>`)\n");
  const topLevel = await scanTopLevelCommands(commandDir, gitRoot);
  console.log(formatTable(topLevel, ["date", "hash", "command", "message"]));

  // 2. Subcommands grouped by parent
  console.log("\n## Subcommands (`quarto <verb> <noun>`)\n");
  console.log("_Note: Only subcommands registered via cliffy's `.command()` API are tracked. Commands that parse their arguments internally (e.g., `quarto install tinytex`, `quarto check jupyter`) are not detected._\n");
  const subcommands = await scanCliffySubcommands(commandDir, gitRoot);

  // Add publish providers as subcommands
  const publishProviders = await scanPublishProviders(publishDir, gitRoot);
  if (publishProviders.length > 0) {
    subcommands.set("publish", publishProviders);
  }

  // Sort parent commands alphabetically
  const sortedParents = [...subcommands.keys()].sort();
  for (const parent of sortedParents) {
    const entries = subcommands.get(parent)!;
    console.log(`### ${parent}\n`);
    console.log(formatTable(entries, ["date", "hash", "command"]));
    console.log("");
  }

  // 3. Removed commands
  console.log("\n## Removed Commands\n");
  const removedCliffy = await scanRemovedCommands(commandDir, gitRoot);
  const removedPublish = await scanRemovedPublishProviders(publishDir, gitRoot);
  const allRemoved = [...removedCliffy, ...removedPublish].sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  if (allRemoved.length > 0) {
    console.log(formatTable(allRemoved, ["date", "hash", "command", "message"]));
  } else {
    console.log("_No removed commands detected._\n");
  }
}

main().catch((e) => {
  console.error("Error:", e.message);
  Deno.exit(1);
});
