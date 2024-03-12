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
  isUnauthorized: () => false,
  isNotFound: () => false,
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
  ]);
  try {
    await gitCmds(input, [
      ["merge", "origin/main"],
    ]);
  } catch (_e) {
    info(colors.yellow([
      "Could not merge origin/main. This is likely because of git conflicts.",
      "Please resolve those manually and run `quarto publish` again.",
    ].join("\n")));
    return Promise.resolve([
      undefined,
      undefined,
    ]);
  }
  try {
    await gitCmds(input, [
      ["stash", "pop"],
    ]);
  } catch (_e) {
    info(colors.yellow([
      "Could not pop git stash.",
      "This is likely because there are no changes to push to the repository.",
    ].join("\n")));
    return Promise.resolve([
      undefined,
      undefined,
    ]);
  }
  await gitCmds(input, [
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
  await new Promise((resolve) => setTimeout(resolve, 3000));

  return Promise.resolve([
    undefined,
    new URL(ghContext.originUrl!),
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
