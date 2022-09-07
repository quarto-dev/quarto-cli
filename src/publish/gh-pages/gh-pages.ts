/*
* ghpages.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { info } from "log/mod.ts";
import { dirname, join, relative } from "path/mod.ts";
import { copy, existsSync } from "fs/mod.ts";
import * as colors from "fmt/colors.ts";

import { Confirm } from "cliffy/prompt/confirm.ts";

import { removeIfExists, which } from "../../core/path.ts";
import { execProcess } from "../../core/process.ts";

import { ProjectContext } from "../../project/types.ts";
import {
  AccountToken,
  anonymousAccount,
  PublishFiles,
  PublishProvider,
} from "../provider.ts";
import { PublishOptions, PublishRecord } from "../types.ts";
import { shortUuid } from "../../core/uuid.ts";
import { sleep } from "../../core/wait.ts";
import { joinUrl } from "../../core/url.ts";
import { completeMessage, withSpinner } from "../../core/console.ts";
import { renderForPublish } from "../common/publish.ts";
import { websiteBaseurl } from "../../project/types/website/website-config.ts";

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

function accountTokens() {
  return Promise.resolve([anonymousAccount()]);
}

async function authorizeToken(options: PublishOptions) {
  const ghContext = await gitHubContext(options.input);

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
  const ghContext = await gitHubContext(input);
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
  render: (siteUrl?: string) => Promise<PublishFiles>,
  options: PublishOptions,
  target?: PublishRecord,
): Promise<[PublishRecord | undefined, URL | undefined]> {
  // convert input to dir if necessary
  input = Deno.statSync(input).isDirectory ? input : dirname(input);

  // get context
  const ghContext = await gitHubContext(options.input);

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
    target?.url,
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
  browse?: boolean;
};

async function gitHubContext(input: ProjectContext | string) {
  // establish dir
  const dir = typeof (input) === "string" ? dirname(input) : input.dir;

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
        context.siteUrl = siteUrl(
          dir,
          context.originUrl!,
          typeof (input) !== "string" ? input : undefined,
        );
      }
    }
  }

  return context;
}

function siteUrl(
  dir: string,
  originUrl: string,
  project: ProjectContext | undefined,
) {
  // always prefer config
  const configSiteUrl = websiteBaseurl(project?.config);
  if (configSiteUrl) {
    return configSiteUrl;
  }
  // check for CNAME file
  const cname = join(dir, "CNAME");
  if (existsSync(cname)) {
    const url = Deno.readTextFileSync(cname).trim();
    if (/^https?:/i.test(url)) {
      return url;
    } else {
      return `https://${url}`;
    }
  } else {
    // pick apart origin url for github.com
    const match = originUrl?.match(
      /^git@([^:]+):([^\/]+)\/(.+?)\.git$/,
    ) || originUrl?.match(
      /^https:\/\/([^\/]+)\/([^\/]+)\/(.+?)\.git$/,
    );

    const kGithubCom = "github.com";
    const kGithubIo = "github.io";
    if (match && match.includes(kGithubCom)) {
      const server = match[1].replace(kGithubCom, kGithubIo);
      const domain = `${match[2]}.${server}`;
      // user's root site uses just the domain
      if (domain === match[3]) {
        return `https://${domain}/`;
      } else {
        return `https://${domain}/${match[3]}/`;
      }
    }
  }
}
