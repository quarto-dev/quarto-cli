/*
 * cmd.ts
 *
 * Copyright (C) 2025 Posit Software, PBC
 */

import { Command } from "cliffy/command/mod.ts";
import { gitCmdOutput, gitCmds } from "../../../core/git.ts";
import { info, error } from "../../../deno_ral/log.ts";

interface SubtreeConfig {
  name: string;
  prefix: string;
  remoteUrl: string;
  remoteBranch: string;
}

interface Author {
  name: string;
  email: string;
  count: number;
}

// Subtree configurations - update these with actual repositories
const SUBTREES: SubtreeConfig[] = [
  {
    name: "example-filter",
    prefix: "src/resources/filters/example-filter",
    remoteUrl: "https://github.com/example/example-filter",
    remoteBranch: "main",
  },
  // Add more subtrees here as needed
];

async function findLastSplit(
  quartoRoot: string,
  prefix: string,
): Promise<string | null> {
  try {
    const log = await gitCmdOutput(quartoRoot, [
      "log",
      `--grep=git-subtree-dir: ${prefix}$`,
      "--all",
      "-1",
      "--pretty=%b",
    ]);

    const splitLine = log.split("\n").find((line) =>
      line.startsWith("git-subtree-split:")
    );
    if (!splitLine) return null;

    return splitLine.split(/\s+/)[1];
  } catch {
    return null;
  }
}

async function getAuthorsByCommitCount(
  quartoRoot: string,
  range: string,
): Promise<Author[] | null> {
  try {
    const log = await gitCmdOutput(quartoRoot, [
      "log",
      "--pretty=%an <%ae>",
      range,
    ]);

    if (!log.trim()) {
      return null;
    }

    // Count occurrences of each author
    const authorCounts = new Map<string, number>();
    for (const line of log.split("\n").filter((l) => l.trim())) {
      authorCounts.set(line, (authorCounts.get(line) || 0) + 1);
    }

    // Convert to Author objects and sort by count (descending)
    const authors: Author[] = Array.from(authorCounts.entries())
      .map(([authorLine, count]) => {
        const match = authorLine.match(/^(.+)\s+<(.+)>$/);
        if (!match) throw new Error(`Invalid author format: ${authorLine}`);

        return {
          name: match[1],
          email: match[2],
          count,
        };
      })
      .sort((a, b) => b.count - a.count);

    return authors;
  } catch {
    return null;
  }
}

async function getCommitMessage(quartoRoot: string): Promise<string> {
  return await gitCmdOutput(quartoRoot, ["log", "-1", "--pretty=%B"]);
}

function formatAuthor(author: Author): string {
  return `${author.name} <${author.email}>`;
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
  }

  // Check for new commits
  const commitRange = `${lastSplit}..FETCH_HEAD`;
  const authors = await getAuthorsByCommitCount(quartoRoot, commitRange);

  if (!authors) {
    info("No new commits to merge");
    return;
  }

  info(`Found ${authors.reduce((sum, a) => sum + a.count, 0)} new commit(s)`);

  const primaryAuthor = authors[0];
  const coAuthors = authors.slice(1);

  info(
    `Primary author: ${formatAuthor(primaryAuthor)} (${primaryAuthor.count} commit(s))`,
  );

  // Do the squash merge
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

  // Amend to change author and add co-author trailers
  info("Amending with proper attribution...");

  if (coAuthors.length > 0) {
    // Get existing message and append co-authors
    const existingMsg = await getCommitMessage(quartoRoot);
    const coAuthorLines = coAuthors
      .map((author) => `Co-authored-by: ${formatAuthor(author)}`)
      .join("\n");

    await gitCmds(quartoRoot, [
      [
        "commit",
        "--amend",
        `--author=${formatAuthor(primaryAuthor)}`,
        "-m",
        `${existingMsg}\n\n${coAuthorLines}`,
      ],
    ]);

    info("Co-authors:");
    coAuthors.forEach((author) => {
      info(`  ${formatAuthor(author)}`);
    });
  } else {
    // Just change author, keep message as-is
    await gitCmds(quartoRoot, [
      [
        "commit",
        "--amend",
        `--author=${formatAuthor(primaryAuthor)}`,
        "--no-edit",
      ],
    ]);
  }

  info("✓ Done!");
}

export const pullGitSubtreeCommand = new Command()
  .name("pull-git-subtree")
  .hidden()
  .arguments("[name:string]")
  .description(
    "Pull configured git subtrees with proper attribution.\n\n" +
      "This command pulls from configured subtree repositories, " +
      "using --squash and attributing the primary author " +
      "(most commits) with other authors as co-authors.\n\n" +
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
        error(`Failed to pull subtree ${config.name}: ${err.message}`);
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
