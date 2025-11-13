/*
 * cmd.ts
 *
 * Copyright (C) 2025 Posit Software, PBC
 */

import { Command } from "cliffy/command/mod.ts";
import { gitCmdOutput, gitCmds } from "../../../core/git.ts";
import { debug, error, info } from "../../../deno_ral/log.ts";
import { logLevel } from "../../../core/log.ts";

interface SubtreeConfig {
  name: string;
  prefix: string;
  remoteUrl: string;
  remoteBranch: string;
}

// Subtree configurations - update these with actual repositories
const SUBTREES: SubtreeConfig[] = [
  {
    name: "julia-engine",
    prefix: "src/resources/extension-subtrees/julia-engine",
    remoteUrl: "https://github.com/gordonwoodhull/quarto-julia-engine.git",
    remoteBranch: "main",
  },
  // Add more subtrees here as needed
];

async function findLastSplit(
  quartoRoot: string,
  prefix: string,
): Promise<string | null> {
  try {
    debug(
      `Searching for last split with grep pattern: git-subtree-dir: ${prefix}$`,
    );
    const log = await gitCmdOutput(quartoRoot, [
      "log",
      `--grep=git-subtree-dir: ${prefix}$`,
      "-1",
      "--pretty=%b",
    ]);

    debug(`Git log output: ${log}`);
    const splitLine = log.split("\n").find((line) =>
      line.startsWith("git-subtree-split:")
    );
    if (!splitLine) {
      debug("No split line found in log output");
      return null;
    }

    const splitCommit = splitLine.split(/\s+/)[1];
    debug(`Found last split commit: ${splitCommit}`);
    return splitCommit;
  } catch (e) {
    debug(`Error finding last split: ${e}`);
    return null;
  }
}

async function pullSubtree(
  quartoRoot: string,
  config: SubtreeConfig,
): Promise<void> {
  info(`\n=== Pulling subtree: ${config.name} ===`);
  info(`Prefix: ${config.prefix}`);
  info(`Remote: ${config.remoteUrl}`);
  info(`Branch: ${config.remoteBranch}`);

  // Fetch from remote
  info("Fetching...");
  await gitCmds(quartoRoot, [
    ["fetch", config.remoteUrl, config.remoteBranch],
  ]);

  // Check what FETCH_HEAD points to
  const fetchHead = await gitCmdOutput(quartoRoot, ["rev-parse", "FETCH_HEAD"]);
  debug(`FETCH_HEAD resolves to: ${fetchHead.trim()}`);

  // Check if prefix directory exists
  const prefixPath = `${quartoRoot}/${config.prefix}`;
  let prefixExists = false;
  try {
    const stat = await Deno.stat(prefixPath);
    prefixExists = stat.isDirectory;
    debug(`Prefix directory exists: ${prefixExists} (${prefixPath})`);
  } catch {
    debug(`Prefix directory does not exist: ${prefixPath}`);
  }

  // Find last split point
  let lastSplit = await findLastSplit(quartoRoot, config.prefix);

  if (!lastSplit) {
    info("No previous subtree found - using 'git subtree add'");
    await gitCmds(quartoRoot, [
      [
        "subtree",
        "add",
        "--squash",
        `--prefix=${config.prefix}`,
        config.remoteUrl,
        config.remoteBranch,
      ],
    ]);
    lastSplit = await gitCmdOutput(quartoRoot, ["rev-parse", "FETCH_HEAD^"]);
    debug(`After subtree add, lastSplit set to: ${lastSplit.trim()}`);
  }

  // Check for new commits
  const commitRange = `${lastSplit}..FETCH_HEAD`;
  debug(`Checking commit range: ${commitRange}`);

  const hasNewCommits = await gitCmdOutput(quartoRoot, [
    "log",
    "--oneline",
    commitRange,
    "-1",
  ]);

  if (!hasNewCommits.trim()) {
    info("No new commits to merge");
    debug(`Commit range ${commitRange} has no commits`);
    if (!prefixExists) {
      info("WARNING: Prefix directory doesn't exist but no new commits found!");
      debug("This may indicate lastSplit was found on a different branch");
    }
    return;
  }

  debug(`Found new commits in range ${commitRange}`);

  // Do the subtree pull
  info("Running git subtree pull --squash...");
  await gitCmds(quartoRoot, [
    [
      "subtree",
      "pull",
      "--squash",
      `--prefix=${config.prefix}`,
      config.remoteUrl,
      config.remoteBranch,
    ],
  ]);

  info("✓ Done!");
}

export const pullGitSubtreeCommand = new Command()
  .name("pull-git-subtree")
  .hidden()
  .arguments("[name:string]")
  .description(
    "Pull configured git subtrees.\n\n" +
      "This command pulls from configured subtree repositories " +
      "using --squash, which creates two commits: a squash commit " +
      "containing the subtree changes and a merge commit that " +
      "integrates it into your branch.\n\n" +
      "Arguments:\n" +
      "  [name]  Name of subtree to pull (use 'all' or omit to pull all)",
  )
  .action(async (_options: unknown, nameArg?: string) => {
    // Get quarto root directory
    const quartoRoot = Deno.env.get("QUARTO_ROOT");
    if (!quartoRoot) {
      error(
        "QUARTO_ROOT environment variable not set. This command requires a development version of Quarto.",
      );
      Deno.exit(1);
    }

    // Show current branch for debugging (only if debug logging enabled)
    if (logLevel() === "DEBUG") {
      try {
        const currentBranch = await gitCmdOutput(quartoRoot, [
          "branch",
          "--show-current",
        ]);
        debug(`Current branch: ${currentBranch.trim()}`);
      } catch (e) {
        debug(`Unable to determine current branch: ${e}`);
      }
    }

    // Determine which subtrees to pull
    let subtreesToPull: SubtreeConfig[];

    if (!nameArg || nameArg === "all") {
      // Pull all subtrees
      subtreesToPull = SUBTREES;
      info(`Quarto root: ${quartoRoot}`);
      info(`Processing all ${SUBTREES.length} subtree(s)...`);
    } else {
      // Pull specific subtree by name
      const config = SUBTREES.find((s) => s.name === nameArg);
      if (!config) {
        error(`Unknown subtree name: ${nameArg}`);
        error(`Available subtrees: ${SUBTREES.map((s) => s.name).join(", ")}`);
        Deno.exit(1);
      }
      subtreesToPull = [config];
      info(`Quarto root: ${quartoRoot}`);
      info(`Processing subtree: ${nameArg}`);
    }

    let successCount = 0;
    let errorCount = 0;

    for (const config of subtreesToPull) {
      try {
        await pullSubtree(quartoRoot, config);
        successCount++;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        error(`Failed to pull subtree ${config.name}: ${message}`);
        errorCount++;
      }
    }

    info(`\n=== Summary ===`);
    info(`Success: ${successCount}`);
    info(`Failed: ${errorCount}`);

    if (errorCount > 0) {
      Deno.exit(1);
    }
  });
