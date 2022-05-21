/*
* account.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { error } from "log/mod.ts";

import { prompt, Select, SelectOption } from "cliffy/prompt/mod.ts";
import { Confirm } from "cliffy/prompt/confirm.ts";

import { PublishProvider } from "./provider.ts";

export enum AccountTokenType {
  Environment,
  Authorized,
}

export type AccountToken = {
  type: AccountTokenType;
  name: string;
  token: string;
};

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
  provider: PublishProvider,
  token: AccountToken,
) {
  if (token.type === AccountTokenType.Environment) {
    error(
      `Unable to authenticate with the provided ${token.name}. Please be sure this token is valid.`,
    );
    return false;
  } else if (token.type === AccountTokenType.Authorized) {
    return await reauthorizePrompt(provider, token.name);
  }
}
