/*
* account.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { error } from "log/mod.ts";

import { prompt, Select, SelectOption } from "cliffy/prompt/mod.ts";
import { Confirm } from "cliffy/prompt/confirm.ts";

// TODO: how to handle no account on initial scan

import {
  AccountToken,
  AccountTokenType,
  PublishDeployment,
  PublishProvider,
} from "../../publish/provider.ts";

export async function resolveAccount(
  provider: PublishProvider,
  prompt: boolean,
) {
  // see what tyep of token we are going to use
  let token: AccountToken | undefined;

  // build list of account options
  const accounts = await provider.accountTokens();

  // if we aren't prompting then we need to have one at the ready
  if (!prompt) {
    token = accounts[0];
    if (!token) {
      throw new Error(
        `No configured account available (account required for publish with --no-prompt)`,
      );
    }
  } else {
    // prompot for account to publish with
    if (accounts.length > 0) {
      token = await accountPrompt(provider, accounts);
    }

    // if we don't have a token yet we need to authorize
    if (!token) {
      if (await authorizePrompt(provider)) {
        token = await provider.authorizeToken();
      }
    }
  }

  return token;
}

export async function accountPrompt(
  provider: PublishProvider,
  accounts: AccountToken[],
): Promise<AccountToken | undefined> {
  const options: SelectOption[] = accounts.map((account) => ({
    name: account.name,
    value: account.token,
  }));
  const kAuthorize = "authorize";
  options.push({
    name: "Use another account...",
    value: kAuthorize,
  });

  const result = await prompt([{
    name: "token",
    message: `${provider.description} account:`,
    options,
    type: Select,
  }]);
  if (result.token !== kAuthorize) {
    return accounts.find((account) => account.token === result.token);
  }
}

export async function authorizePrompt(provider: PublishProvider) {
  const result = await prompt([{
    name: "confirmed",
    message: "Authorize account",
    default: true,
    hint:
      `In order to publish to ${provider.description} you need to authorize your account.\n` +
      `   Please be sure you are logged into the correct ${provider.description} account in your\n` +
      "   default web browser, then press Enter or 'Y' to authorize.",
    type: Confirm,
  }]);
  return !!result.confirmed;
}

export async function reauthorizePrompt(
  provider: PublishProvider,
  accountName: string,
) {
  const result = await prompt([{
    name: "confirmed",
    message: "Re-authorize account",
    default: true,
    hint:
      `The authorization saved for account ${accountName} is no longer valid.\n` +
      `   Please be sure you are logged into the correct ${provider.description} account in your\n` +
      "   default web browser, then press Enter to re-authorize.",
    type: Confirm,
  }]);
  return !!result.confirmed;
}

export async function handleUnauthorized(
  deployment: PublishDeployment,
) {
  if (deployment.account.type === AccountTokenType.Environment) {
    error(
      `Unable to authenticate with the provided ${deployment.account.name}. Please be sure this token is valid.`,
    );
    return false;
  } else if (deployment.account.type === AccountTokenType.Authorized) {
    return await reauthorizePrompt(
      deployment.provider,
      deployment.account.name,
    );
  }
}
