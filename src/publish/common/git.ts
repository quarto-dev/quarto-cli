/*
 * git.ts
 *
 * Copyright (C) 2020-2024 Posit Software, PBC
 */

import { websiteBaseurl } from "../../project/types/website/website-config.ts";
import { gitHubContext } from "../../core/github.ts";
import { ProjectContext } from "../../project/types.ts";
import { dirname } from "../../deno_ral/path.ts";
import { AccountToken, AccountTokenType } from "../provider-types.ts";
import { PublishOptions } from "../types.ts";
import { GitHubContext } from "../../core/github-types.ts";
import { throwUnableToPublish } from "./errors.ts";

export async function gitHubContextForPublish(input: string | ProjectContext) {
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

export function anonymousAccount(): AccountToken {
  return {
    type: AccountTokenType.Anonymous,
    name: "anonymous",
    server: null,
    token: "anonymous",
  };
}

export function verifyContext(
  ghContext: GitHubContext,
  provider: string,
) {
  if (!ghContext.git) {
    throwUnableToPublish(
      "git does not appear to be installed on this system",
      provider,
    );
  }

  // validate we are in a git repo
  if (!ghContext.repo) {
    throwUnableToPublish(
      "the target directory is not a git repository",
      provider,
    );
  }

  // validate that we have an origin
  if (!ghContext.originUrl) {
    throwUnableToPublish(
      "the git repository does not have a remote origin",
      provider,
    );
  }
}
