/*
 * ghpages.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { info } from "../../deno_ral/log.ts";
import { dirname, join, relative } from "../../deno_ral/path.ts";
import { copy } from "fs/mod.ts";
import * as colors from "fmt/colors.ts";

import { Confirm } from "cliffy/prompt/confirm.ts";

import { removeIfExists } from "../../core/path.ts";
import { execProcess } from "../../core/process.ts";

import { ProjectContext } from "../../project/types.ts";
import {
  AccountToken,
  AccountTokenType,
  PublishFiles,
  PublishProvider,
} from "../provider-types.ts";
import { PublishOptions, PublishRecord } from "../types.ts";
import { shortUuid } from "../../core/uuid.ts";
import { sleep } from "../../core/wait.ts";
import { joinUrl } from "../../core/url.ts";
import { completeMessage, withSpinner } from "../../core/console.ts";
import { renderForPublish } from "../common/publish.ts";
import { websiteBaseurl } from "../../project/types/website/website-config.ts";
import { RenderFlags } from "../../command/render/types.ts";
import { gitHubContext, gitVersion } from "../../core/github.ts";

export const kGhpages = "gh-pages";
const kGhpagesDescription = "GitHub Pages";

export const ghpagesProvider: PublishProvider = {
  name: kGhpages,
  description: kGhpagesDescription,
  requiresServer: false,
  listOriginOnly: false,
  accountTokens,
  authorizeToken,
  removeToken,
  publishRecord,
  resolveTarget,
  publish,
  isUnauthorized,
  isNotFound,
};

function anonymousAccount(): AccountToken {
  return {
    type: AccountTokenType.Anonymous,
    name: "anonymous",
    server: null,
    token: "anonymous",
  };
}

function accountTokens() {
  return Promise.resolve([anonymousAccount()]);
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

  // good to go!
  return Promise.resolve(anonymousAccount());
}

function removeToken(_token: AccountToken) {
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

function resolveTarget(
  _account: AccountToken,
  target: PublishRecord,
): Promise<PublishRecord | undefined> {
  return Promise.resolve(target);
}

async function publish(
  _account: AccountToken,
  type: "document" | "site",
  input: string,
  title: string,
  _slug: string,
  render: (flags?: RenderFlags) => Promise<PublishFiles>,
  options: PublishOptions,
  target?: PublishRecord,
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

  // create gh pages branch if there is none yet
  const createGhPagesBranch = !ghContext.ghPages;
  if (createGhPagesBranch) {
    // confirm
    const confirmed = await Confirm.prompt({
      indent: "",
      message: `Publish site to ${
        ghContext.siteUrl || ghContext.originUrl
      } using gh-pages?`,
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
  const renderResult = await renderForPublish(
    render,
    "gh-pages",
    type,
    title,
    type === "site" ? target?.url : undefined,
  );

  // allocate worktree dir
  const tempDir = Deno.makeTempDirSync({ dir: input });
  removeIfExists(tempDir);

  const deployId = shortUuid();

  await withWorktree(input, relative(input, tempDir), async () => {
    // copy output to tempdir and add .nojekyll (include deployId
    // in .nojekyll so we can poll for completed deployment)
    await copy(renderResult.baseDir, tempDir, { overwrite: true });
    Deno.writeTextFileSync(join(tempDir, ".nojekyll"), deployId);

    // push
    await gitCmds(tempDir, [
      ["add", "-Af", "."],
      ["commit", "--allow-empty", "-m", "Built site for gh-pages"],
      ["remote", "-v"],
      ["push", "--force", "origin", "HEAD:gh-pages"],
    ]);
  });
  info("");

  // if this is the creation of gh-pages AND this is a user home/default site
  // then tell the user they need to switch it to use gh-pages. also do this
  // if the site is getting a 404 error
  let notifyGhPagesBranch = false;
  let defaultSiteMatch: RegExpMatchArray | null;
  if (ghContext.siteUrl) {
    defaultSiteMatch = ghContext.siteUrl.match(
      /^https:\/\/(.+?)\.github\.io\/$/,
    );
    if (defaultSiteMatch) {
      if (createGhPagesBranch) {
        notifyGhPagesBranch = true;
      } else {
        try {
          const response = await fetch(ghContext.siteUrl);
          if (response.status === 404) {
            notifyGhPagesBranch = true;
          }
        } catch {
          //
        }
      }
    }
  }

  // if this is an update then warn that updates may require a browser refresh
  if (!createGhPagesBranch && !notifyGhPagesBranch) {
    info(colors.yellow(
      "NOTE: GitHub Pages sites use caching so you might need to click the refresh\n" +
        "button within your web browser to see changes after deployment.\n",
    ));
  }

  // wait for deployment if we are opening a browser
  let verified = false;
  if (options.browser && ghContext.siteUrl && !notifyGhPagesBranch) {
    await withSpinner({
      message:
        "Deploying gh-pages branch to website (this may take a few minutes)",
    }, async () => {
      const noJekyllUrl = joinUrl(ghContext.siteUrl!, ".nojekyll");
      while (true) {
        await sleep(2000);
        const response = await fetch(noJekyllUrl);
        if (response.status === 200) {
          if ((await response.text()).trim() === deployId) {
            verified = true;
            await sleep(2000);
            break;
          }
        } else if (response.status !== 404) {
          break;
        }
      }
    });
  }

  completeMessage(`Published to ${ghContext.siteUrl || ghContext.originUrl}`);
  info("");

  if (notifyGhPagesBranch) {
    info(
      colors.yellow(
        "To complete publishing, change the source branch for this site to " +
          colors.bold("gh-pages") + ".\n\n" +
          `Set the source branch at: ` +
          colors.underline(
            `https://github.com/${defaultSiteMatch![1]}/${
              defaultSiteMatch![1]
            }.github.io/settings/pages`,
          ) + "\n",
      ),
    );
  } else if (!verified) {
    info(colors.yellow(
      "NOTE: GitHub Pages deployments normally take a few minutes (your site updates\n" +
        "will be visible once the deploy completes)\n",
    ));
  }

  return Promise.resolve([
    undefined,
    verified ? new URL(ghContext.siteUrl!) : undefined,
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
