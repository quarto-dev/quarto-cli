/*
* netlify.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { NetlifyClient } from "./api/index.ts";

import {
  authorizeNetlifyAccessToken,
  kNetlifyAuthTokenVar,
  netlifyAccessToken,
  netlifyEnvironmentAuthToken,
} from "../../publish/netlify/account.ts";

import {
  AccountToken,
  AccountTokenType,
  PublishProvider,
} from "../provider.ts";
import { ApiError } from "../../publish/netlify/api/index.ts";
import { PublishRecord } from "../types.ts";

export const netlifyProvider: PublishProvider = {
  name: "netlify",
  description: "Netlify",
  accountTokens,
  authorizeToken,
  resolveTarget,
  publish,
  isUnauthorized,
};

function accountTokens() {
  const envToken = netlifyEnvironmentAuthToken();
  const accessToken = netlifyAccessToken();

  const accounts: AccountToken[] = [];
  if (envToken) {
    accounts.push({
      type: AccountTokenType.Environment,
      name: kNetlifyAuthTokenVar,
      token: envToken,
    });
  }
  if (accessToken?.access_token) {
    accounts.push({
      type: AccountTokenType.Authorized,
      name: accessToken.email!,
      token: accessToken?.access_token,
    });
  }

  return Promise.resolve(accounts);
}

async function authorizeToken() {
  const token = await authorizeNetlifyAccessToken();
  if (token) {
    return {
      type: AccountTokenType.Authorized,
      name: token.email!,
      token: token.access_token!,
    };
  }
}

export async function resolveTarget(
  account: AccountToken,
  target: PublishRecord,
) {
  const client = new NetlifyClient({
    TOKEN: account.token,
  });
  const site = await client.site.getSite({ siteId: target.id });
  if (site?.url) {
    target.url = site.url;
  }
  return target;
}

async function publish(
  _outputDir: string,
  account: AccountToken,
  target?: PublishRecord,
) {
  const client = new NetlifyClient({
    TOKEN: account.token,
  });

  const sites = await client.site.listSites({});

  console.log("publish completed");

  return target!;
}

function isUnauthorized(err: Error) {
  return err instanceof ApiError && err.status === 401;
}
