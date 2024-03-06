/*
 * account.ts
 *
 * Copyright (C) 2022 Posit Software, PBC
 */

import { error } from "../deno_ral/log.ts";

import { prompt } from "cliffy/prompt/mod.ts";
import { Confirm } from "cliffy/prompt/confirm.ts";

import {
  AccountToken,
  AccountTokenType,
  PublishProvider,
} from "./provider-types.ts";

export type AccountPrompt = "always" | "never" | "multiple";

export async function authorizePrompt(provider: PublishProvider) {
  const result = await prompt([{
    indent: "",
    name: "confirmed",
    message: "Authorize",
    default: true,
    hint:
      `In order to publish to ${provider.description} you need to authorize your account.\n` +
      `  Please be sure you are logged into the correct ${provider.description} account in your\n` +
      "  default web browser, then press Enter or 'Y' to authorize.",
    type: Confirm,
  }]);
  return !!result.confirmed;
}

export async function reauthorizePrompt(
  provider: PublishProvider,
) {
  const result = await prompt([{
    indent: "",
    name: "confirmed",
    message: "Re-authorize account",
    default: true,
    hint:
      `The authorization saved for ${provider.description} is no longer valid.\n` +
      `  Please be sure you are logged into the correct ${provider.description} account in your\n` +
      "  default web browser, then press Enter to re-authorize.",
    type: Confirm,
  }]);
  return !!result.confirmed;
}

export async function handleUnauthorized(
  provider: PublishProvider,
  account: AccountToken,
) {
  if (account.type === AccountTokenType.Environment) {
    error(
      `Unable to authenticate with the provided ${account.name}. Please be sure this token is valid.`,
    );
    return false;
  } else if (account.type === AccountTokenType.Authorized) {
    return await reauthorizePrompt(
      provider,
    );
  }
}
