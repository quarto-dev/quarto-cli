/*
* ghpages.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { ProjectContext } from "../../project/types.ts";
import {
  AccountToken,
  anonymousAccount,
  PublishFiles,
  PublishProvider,
} from "../provider.ts";
import { PublishOptions, PublishRecord } from "../types.ts";
import { gitHubContext } from "./api/index.ts";

export const kGhpages = "gh-pages";
const kGhpagesDescription = "GitHub Pages";

export const ghpagesProvider: PublishProvider = {
  name: kGhpages,
  description: kGhpagesDescription,
  requiresServer: false,
  canPublishDocuments: false,
  accountTokens,
  authorizeToken,
  removeToken,
  resolveTarget,
  publish,
  isUnauthorized,
};

// TODO: need some way to provide deployments not from the config file

function accountTokens() {
  return Promise.resolve([]);
}

async function authorizeToken(options: PublishOptions) {
  const dir = (options.input as ProjectContext).dir;
  const ghContext = await gitHubContext(dir);

  // validate we have git
  const throwUnableToPublish = (reason: string) => {
    throw new Error(
      `Unable to publish to GitHub Pages (${reason})`,
    );
  };
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

function resolveTarget(
  _account: AccountToken,
  target: PublishRecord,
) {
  return Promise.resolve(target);
}

async function publish(
  _account: AccountToken,
  _type: "document" | "site",
  _title: string,
  render: (siteUrl?: string) => Promise<PublishFiles>,
  _target?: PublishRecord,
): Promise<[PublishRecord | undefined, URL | undefined]> {
  await render();
  return Promise.resolve([undefined, undefined]);
}

function isUnauthorized(_err: Error) {
  return false;
}
