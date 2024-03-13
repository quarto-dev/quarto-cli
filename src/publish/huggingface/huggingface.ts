/*
 * huggingface.ts
 *
 * Copyright (C) 2020-2024 Posit Software, PBC
 */

import { info } from "../../deno_ral/log.ts";
import { dirname, join } from "../../deno_ral/path.ts";
import * as colors from "fmt/colors.ts";
import { ProjectContext } from "../../project/types.ts";
import {
  AccountToken,
  PublishFiles,
  PublishProvider,
} from "../provider-types.ts";
import { PublishOptions, PublishRecord } from "../types.ts";
import { RenderFlags } from "../../command/render/types.ts";
import { gitCmds, gitVersion } from "../../core/git.ts";
import {
  anonymousAccount,
  gitHubContextForPublish,
  verifyContext,
} from "../common/git.ts";
import { throwUnableToPublish } from "../common/errors.ts";
import { Input } from "cliffy/prompt/input.ts";
import { assert } from "testing/asserts.ts";
import { Secret } from "cliffy/prompt/secret.ts";

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

async function authorizeToken(options: PublishOptions) {
  const ghContext = await gitHubContextForPublish(options.input);
  const provider = "Hugging Face Spaces";
  verifyContext(ghContext, provider);

  if (
    !ghContext.originUrl!.match(/^https:\/\/(.*:.*@)?huggingface.co\/spaces\//)
  ) {
    throwUnableToPublish(
      "the git repository does not appear to have a Hugging Face Space origin",
      provider,
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
      id: kHuggingFace,
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

  if (
    !ghContext.originUrl!.match(/^https:\/\/.*:.*@huggingface.co\/spaces\//)
  ) {
    const previousRemotePath = ghContext.originUrl!.match(
      /.*huggingface.co(\/spaces\/.*)/,
    );
    assert(previousRemotePath);
    info(colors.yellow([
      "The current git repository needs to be reconfigured to allow `quarto publish`",
      "to publish to Hugging Face Spaces. Please enter your username and authentication token.",
      "Refer to https://huggingface.co/blog/password-git-deprecation#switching-to-personal-access-token",
      "for more information on how to obtain a personal access token.",
    ].join("\n")));
    const username = await Input.prompt({
      indent: "",
      message: "Hugging Face username",
    });
    const token = await Secret.prompt({
      indent: "",
      message: "Hugging Face authentication token:",
      hint: "Create a token at https://huggingface.co/settings/tokens",
    });
    await gitCmds(input, [
      [
        "remote",
        "set-url",
        "origin",
        `https://${username}:${token}@huggingface.co${previousRemotePath![1]}`,
      ],
    ]);
  }

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
