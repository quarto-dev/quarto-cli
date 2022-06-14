/*
* ghpages.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { info } from "log/mod.ts";
import { join, relative } from "path/mod.ts";
import { copy, existsSync } from "fs/mod.ts";

import { Confirm } from "cliffy/prompt/confirm.ts";

import { removeIfExists, which } from "../../core/path.ts";
import { execProcess } from "../../core/process.ts";
import { projectContext } from "../../project/project-context.ts";
import { kProjectOutputDir, ProjectContext } from "../../project/types.ts";
import {
  AccountToken,
  anonymousAccount,
  PublishFiles,
  PublishProvider,
} from "../provider.ts";
import { PublishOptions, PublishRecord } from "../types.ts";

export const kGhpages = "gh-pages";
const kGhpagesDescription = "GitHub Pages";

export const ghpagesProvider: PublishProvider = {
  name: kGhpages,
  description: kGhpagesDescription,
  requiresServer: false,
  canPublishDocuments: false,
  listOriginOnly: false,
  accountTokens,
  authorizeToken,
  removeToken,
  publishRecord,
  resolveTarget,
  publish,
  isUnauthorized,
};

function accountTokens() {
  return Promise.resolve([]);
}

async function authorizeToken(options: PublishOptions) {
  const dir = (options.input as ProjectContext).dir;
  const ghContext = await gitHubContext(dir);

  if (!ghContext.git) {
    throwUnableToPublish("git does not appear to be installed on this system");
  }

  // validate we are in a git repo
  if (!ghContext.repo) {
    throwUnableToPublish("the target directory is not a git repository");
  }

  // validate that we have an origin
  if (!ghContext.originUrl) {
    throwUnableToPublish("the git repository does not have a remote origin");
  }

  // good to go!
  return Promise.resolve(anonymousAccount());
}

function removeToken(_token: AccountToken) {
}

async function publishRecord(dir: string): Promise<PublishRecord | undefined> {
  const ghContext = await gitHubContext(dir);
  if (ghContext.ghPages && ghContext.siteUrl) {
    return {
      id: "gh-pages",
      url: ghContext.siteUrl,
    };
  }
}

function resolveTarget(
  _account: AccountToken,
  target: PublishRecord,
) {
  return Promise.resolve(target);
}

async function publish(
  _account: AccountToken,
  _type: "document" | "site",
  input: string,
  _title: string,
  render: (siteUrl?: string) => Promise<PublishFiles>,
  _target?: PublishRecord,
): Promise<[PublishRecord | undefined, URL | undefined]> {
  // get context
  const ghContext = await gitHubContext(input);

  // create gh pages branch if there is none yet
  if (!ghContext.ghPages) {
    // confirm
    const confirmed = await Confirm.prompt({
      indent: "",
      message: `Publish site to ${ghContext.siteUrl} using gh-pages?`,
      default: true,
    });
    if (!confirmed) {
      throw new Error();
    }

    const stash = !(await gitDirIsClean(input));
    if (stash) {
      await gitStash(input);
    }
    const oldBranch = await gitCurrentBranch(input);
    try {
      await gitCreateGhPages(input);
    } finally {
      await gitCmds(input, [["checkout", oldBranch]]);
      if (stash) {
        await gitStashApply(input);
      }
    }
  }

  // sync from remote
  await gitCmds(input, [
    ["remote", "set-branches", "--add", "origin", "gh-pages"],
    ["fetch", "origin", "gh-pages"],
  ]);

  // render
  const project = (await projectContext(input))!;
  const outputDir = project.config?.project[kProjectOutputDir];
  if (outputDir === undefined) {
    throwUnableToPublish("no output-dir defined for project");
  }
  const renderResult = await render(ghContext.siteUrl);

  // allocate worktree dir
  const tempDir = Deno.makeTempDirSync({ dir: input });
  removeIfExists(tempDir);

  await withWorktree(input, relative(input, tempDir), async () => {
    // copy output to tempdir and add .nojekyll
    await copy(renderResult.baseDir, tempDir, { overwrite: true });
    Deno.writeTextFileSync(join(tempDir, ".nojekyll"), "");

    // push
    await gitCmds(tempDir, [
      ["add", "-Af", "."],
      ["commit", "--allow-empty", "-m", "Built site for gh-pages"],
      ["remote", "-v"],
      ["push", "--force", "origin", "HEAD:gh-pages"],
    ]);
  });

  info(`\nPublished: ${ghContext.siteUrl}\n`);
  info(
    "NOTE: GitHub Pages deployments normally take a few minutes\n" +
      "(your site updates will visible once the deploy completes)\n",
  );

  return Promise.resolve([undefined, undefined]);
}

function isUnauthorized(_err: Error) {
  return false;
}

async function gitStash(dir: string) {
  const result = await execProcess({
    cmd: ["git", "stash"],
    cwd: dir,
  });
  if (!result.success) {
    throw new Error();
  }
}

async function gitStashApply(dir: string) {
  const result = await execProcess({
    cmd: ["git", "stash", "apply"],
    cwd: dir,
  });
  if (!result.success) {
    throw new Error();
  }
}

async function gitDirIsClean(dir: string) {
  const result = await execProcess({
    cmd: ["git", "diff", "HEAD"],
    cwd: dir,
    stdout: "piped",
  });
  if (result.success) {
    return result.stdout!.trim().length === 0;
  } else {
    throw new Error();
  }
}

async function gitCurrentBranch(dir: string) {
  const result = await execProcess({
    cmd: ["git", "rev-parse", "--abbrev-ref", "HEAD"],
    cwd: dir,
    stdout: "piped",
  });
  if (result.success) {
    return result.stdout!.trim();
  } else {
    throw new Error();
  }
}

async function withWorktree(
  dir: string,
  siteDir: string,
  f: () => Promise<void>,
) {
  await execProcess({
    cmd: [
      "git",
      "worktree",
      "add",
      "--track",
      "-B",
      "gh-pages",
      siteDir,
      "origin/gh-pages",
    ],
    cwd: dir,
  });

  try {
    await f();
  } finally {
    await execProcess({
      cmd: ["git", "worktree", "remove", siteDir],
      cwd: dir,
    });
  }
}

async function gitCreateGhPages(dir: string) {
  await gitCmds(dir, [
    ["checkout", "--orphan", "gh-pages"],
    ["rm", "-rf", "--quiet", "."],
    ["commit", "--allow-empty", "-m", `Initializing gh-pages branch`],
    ["push", "origin", `HEAD:gh-pages`],
  ]);
}

async function gitCmds(dir: string, cmds: Array<string[]>) {
  for (const cmd of cmds) {
    if (
      !(await execProcess({
        cmd: ["git", ...cmd],
        cwd: dir,
      })).success
    ) {
      throw new Error();
    }
  }
}

// validate we have git
const throwUnableToPublish = (reason: string) => {
  throw new Error(
    `Unable to publish to GitHub Pages (${reason})`,
  );
};

type GitHubContext = {
  git: boolean;
  repo: boolean;
  originUrl?: string;
  ghPages?: boolean;
  siteUrl?: string;
};

async function gitHubContext(dir: string) {
  const context: GitHubContext = {
    git: false,
    repo: false,
  };

  // check for git
  context.git = !!(await which("git"));

  // check for a repo in this directory
  if (context.git) {
    context.repo = (await execProcess({
      cmd: ["git", "rev-parse"],
      cwd: dir,
      stdout: "piped",
      stderr: "piped",
    })).success;

    // check for an origin remote
    if (context.repo) {
      const result = await execProcess({
        cmd: ["git", "config", "--get", "remote.origin.url"],
        cwd: dir,
        stdout: "piped",
        stderr: "piped",
      });
      if (result.success) {
        context.originUrl = result.stdout?.trim();

        // check for a gh-pages branch
        context.ghPages = (await execProcess({
          cmd: [
            "git",
            "ls-remote",
            "--quiet",
            "--exit-code",
            "origin",
            "gh-pages",
          ],
          stdout: "piped",
          stderr: "piped",
        })).success;

        // determine siteUrl
        context.siteUrl = siteUrl(dir, context.originUrl!);
      }
    }
  }

  return context;
}

function siteUrl(dir: string, originUrl: string) {
  const cname = join(dir, "CNAME");
  if (existsSync(cname)) {
    return Deno.readTextFileSync(cname).trim();
  } else {
    // git and ssh protccols
    const match = originUrl?.match(
      /git@([^:]+):([^\/]+)\/([^.]+)\.git/,
    ) || originUrl?.match(
      /https:\/\/([^\/]+)\/([^\/]+)\/([^.]+)\.git/,
    );

    if (match) {
      const server = match[1].replace("github.com", "github.io");
      return `https://${match[2]}.${server}/${match[3]}/`;
    }
  }
}
