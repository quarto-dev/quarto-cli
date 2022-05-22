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
  PublishOptions,
  PublishProvider,
} from "../../publish/provider.ts";
import { ApiError } from "../../publish/netlify/api/index.ts";

export const netlifyProvider: PublishProvider = {
  name: "netlify",
  description: "Netlify",
  accountTokens,
  authorizeToken,
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

async function publish(_options: PublishOptions, token: AccountToken) {
  const client = new NetlifyClient({
    TOKEN: token.token,
  });

  const sites = await client.site.listSites({});

  console.log(JSON.stringify(sites, undefined, 2));
}

function isUnauthorized(err: Error) {
  return err instanceof ApiError && err.status === 401;
}
