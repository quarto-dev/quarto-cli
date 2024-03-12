/*
 * huggingface.ts
 *
 * Copyright (C) 2020-2024 Posit Software, PBC
 */

import { info } from "../../deno_ral/log.ts";
import { dirname, join } from "../../deno_ral/path.ts";
import * as colors from "fmt/colors.ts";
import { execProcess } from "../../core/process.ts";
import { ProjectContext } from "../../project/types.ts";
import {
  AccountToken,
  AccountTokenType,
  PublishFiles,
  PublishProvider,
} from "../provider-types.ts";
import { PublishOptions, PublishRecord } from "../types.ts";
import { websiteBaseurl } from "../../project/types/website/website-config.ts";
import { RenderFlags } from "../../command/render/types.ts";
import { gitHubContext, gitVersion } from "../../core/github.ts";

export const kHuggingFace = "huggingface";
const kHuggingFaceDescription = "Hugging Face Spaces";

export const huggingfaceProvider: PublishProvider = {
  name: kHuggingFace,
  description: kHuggingFaceDescription,
  requiresServer: false,
  listOriginOnly: false,
  accountTokens: () => Promise.resolve([anonymousAccount()]),
  authorizeToken,
  removeToken: () => {},
  publishRecord,
  resolveTarget: (
    _account: AccountToken,
    target: PublishRecord,
  ): Promise<PublishRecord | undefined> => Promise.resolve(target),
  publish,
  isUnauthorized,
  isNotFound,
  resolveProjectPath: (path: string) => join(path, "src"),
};

function anonymousAccount(): AccountToken {
  return {
    type: AccountTokenType.Anonymous,
    name: "anonymous",
    server: null,
    token: "anonymous",
  };
}

async function authorizeToken(options: PublishOptions) {
  const ghContext = await gitHubContextForPublish(options.input);

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
  if (!ghContext.originUrl!.startsWith("https://huggingface.co/spaces/")) {
    throwUnableToPublish(
      "the git repository does not appear to have a Hugging Face Space origin",
    );
  }

  // good to go!
  return Promise.resolve(anonymousAccount());
}

async function publishRecord(
  input: string | ProjectContext,
): Promise<PublishRecord | undefined> {
  const ghContext = await gitHubContextForPublish(input);
  if (ghContext.ghPages) {
    return {
      id: "gh-pages",
      url: ghContext.siteUrl || ghContext.originUrl,
    };
  }
}

async function publish(
  _account: AccountToken,
  _type: "document" | "site",
  input: string,
  _title: string,
  _slug: string,
  _render: (flags?: RenderFlags) => Promise<PublishFiles>,
  options: PublishOptions,
  _target?: PublishRecord,
): Promise<[PublishRecord | undefined, URL | undefined]> {
  // convert input to dir if necessary
  input = Deno.statSync(input).isDirectory ? input : dirname(input);

  // check if git version is new enough
  const version = await gitVersion();

  // git 2.17.0 appears to be the first to support git-worktree add --track
  // https://github.com/git/git/blob/master/Documentation/RelNotes/2.17.0.txt#L368
  if (version.compare("2.17.0") < 0) {
    throw new Error(
      "git version 2.17.0 or higher is required to publish to GitHub Pages",
    );
  }

  // get context
  const ghContext = await gitHubContextForPublish(options.input);

  // sync from remote and push to main
  await gitCmds(input, [
    ["stash"],
    ["fetch", "origin", "main"],
    ["merge", "origin/main"],
    ["stash", "pop"],
    ["add", "-Af", "."],
    ["commit", "--allow-empty", "-m", "commit from `quarto publish`"],
    ["remote", "-v"],
    ["push", "origin", "main"],
  ]);

  // warn users about latency between push and remote publish
  info(colors.yellow(
    "NOTE: Hugging Face Space sites build the content remotely and use caching.\n" +
      "You might need to wait a moment for Hugging Face to rebuild your site, and\n" +
      "then click the refresh button within your web browser to see changes after deployment.\n",
  ));

  return Promise.resolve([
    undefined,
    new URL(ghContext.originUrl!),
  ]);
}

function isUnauthorized(_err: Error) {
  return false;
}

function isNotFound(_err: Error) {
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

  // remove files in existing site, i.e. start clean
  await execProcess({
    cmd: ["git", "rm", "-r", "--quiet", "."],
    cwd: join(dir, siteDir),
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

async function gitHubContextForPublish(input: string | ProjectContext) {
  // Create the base context
  const dir = typeof input === "string" ? dirname(input) : input.dir;
  const context = await gitHubContext(dir);

  // always prefer configured website URL
  if (typeof input !== "string") {
    const configSiteUrl = websiteBaseurl(input?.config);
    if (configSiteUrl) {
      context.siteUrl = configSiteUrl;
    }
  }
  return context;
}
