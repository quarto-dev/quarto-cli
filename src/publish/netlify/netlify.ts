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
  PublishTarget,
} from "../../publish/provider.ts";
import { ApiError } from "../../publish/netlify/api/index.ts";

export const netlifyProvider: PublishProvider = {
  name: "netlify",
  description: "Netlify",
  accountTokens,
  authorizeToken,
  targetHint,
  targetValidate,
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

function targetHint() {
  return "Name for published site (e.g. 'sitename'). Try to pick something\n" +
    "   distinctive -- this name must be unique across all of Netify.\n" +
    "   (Press Enter to have a unique name chosen automatically -- you can\n" +
    "   change the name later using the Netlify control panel).";
}

function targetValidate(target: string): Promise<boolean> {
  return Promise.resolve(true);
}

async function publish(
  _options: PublishOptions,
  _target: PublishTarget,
  token: AccountToken,
) {
  const client = new NetlifyClient({
    TOKEN: token.token,
  });

  const sites = await client.site.listSites({});

  console.log(JSON.stringify(sites, undefined, 2));
}

function isUnauthorized(err: Error) {
  return err instanceof ApiError && err.status === 401;
}
