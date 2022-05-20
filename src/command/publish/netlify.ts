/*
* netlify.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { error } from "log/mod.ts";

import { Command } from "cliffy/command/mod.ts";
import { prompt } from "cliffy/prompt/mod.ts";
import { Select, SelectOption } from "cliffy/prompt/select.ts";
import { Confirm } from "cliffy/prompt/confirm.ts";
import {
  authorizeNetlifyAccessToken,
  kNetlifyAuthTokenVar,
  netlifyAccessToken,
  netlifyEnvironmentAuthToken,
} from "../../publish/netlify/account.ts";
import { netlifyPublish } from "../../publish/netlify/netlify.ts";

import { PublishOptions, PublishProvider } from "./provider.ts";
import { exitWithCleanup } from "../../core/cleanup.ts";
import { AccessToken, ApiError } from "../../publish/netlify/api/index.ts";

export const netlifyProvider: PublishProvider = {
  name: "netlify",
  description: "Netlify",
  command: (command: Command) => {
    return command
      // deno-lint-ignore no-explicit-any
      .action(async (options: any, path?: string) => {
        await netlifyConfigure({
          path: path || Deno.cwd(),
          render: !!options.render,
          prompt: !!options.prompt,
        });
      });
  },
  configure: netlifyConfigure,
};

const kEnvToken = "env-token";
const kAuthorizedToken = "authorized-token";
const kAuthorize = "authorize";

async function netlifyConfigure(options: PublishOptions): Promise<void> {
  // see what tyep of token we are going to use
  let token: string | undefined;
  let tokenType: "env-token" | "authorized-token" | undefined;
  const envToken = netlifyEnvironmentAuthToken();
  const accessToken = netlifyAccessToken();
  const authorizedToken = accessToken?.access_token;

  // if we aren't prompting then we need to have one at the ready
  if (!options.prompt) {
    token = envToken || authorizedToken;
    if (!token) {
      error(
        `No existing account available (account required for publish with --no-prompt)`,
      );
    }
  } else {
    // build list of selection options

    const options: SelectOption[] = [];
    if (envToken) {
      options.push({
        name: `${kNetlifyAuthTokenVar}`,
        value: kEnvToken,
      });
    }
    if (authorizedToken) {
      options.push({
        name: `${accessToken.email!}`,
        value: kAuthorizedToken,
      });
    }
    if (options.length > 0) {
      options.push({
        name: "Use another account...",
        value: kAuthorize,
      });

      const result = await prompt([{
        name: "token",
        message: "Netlify account:",
        options,
        type: Select,
      }]);
      switch (result.token) {
        case kEnvToken: {
          token = envToken;
          tokenType = kEnvToken;
          break;
        }
        case kAuthorizedToken: {
          token = authorizedToken;
          tokenType = kAuthorizedToken;
          break;
        }
        case kAuthorize: {
          tokenType = kAuthorizedToken;
        }
      }
    }

    // if we don't have a token yet we need to authorize
    if (!token) {
      const result = await prompt([{
        name: "confirmed",
        message: "Authorize account",
        default: true,
        hint:
          "In order to publish to Netlify with Quarto you need to authorize your account.\n" +
          "   Please be sure you are logged into the correct Netlify account in your default\n" +
          "   web browser, then press Enter to authorize.",
        type: Confirm,
      }]);
      if (!result.confirmed) {
        exitWithCleanup(1);
      }

      // do the authorization
      token = (await authorizeNetlifyAccessToken())?.access_token;
    }
  }

  // publish if we have a token
  if (token) {
    try {
      await netlifyPublish({
        token,
      });
    } catch (error) {
      // attempt to recover from unauthorized
      if (error instanceof ApiError && error.status === 401) {
        await handleUnauthorized(tokenType!, options, accessToken);
      } else {
        throw error;
      }
    }
  }
}

async function handleUnauthorized(
  tokenType: string,
  options: PublishOptions,
  accessToken?: AccessToken,
) {
  if (tokenType === kEnvToken) {
    error(
      `Unable to authenticate with the provided ${kNetlifyAuthTokenVar}. Please be sure this token is valid.`,
    );
    exitWithCleanup(1);
  } else if (tokenType === kAuthorizedToken && accessToken) {
    const result = await prompt([{
      name: "confirmed",
      message: "Re-authorize account",
      default: true,
      hint:
        `The authorization saved for account ${accessToken.email} is no longer valid.\n` +
        "   Please be sure you are logged into the correct Netlify account in your\n" +
        "   default web browser, then press Enter to re-authorize.",
      type: Confirm,
    }]);
    if (!result.confirmed) {
      exitWithCleanup(1);
    }

    // do the authorization then re-try
    if ((await authorizeNetlifyAccessToken())) {
      await netlifyConfigure(options);
      return;
    }
  }

  // default error
  error("Unable to publish to Netlify (unauthorized)");
  exitWithCleanup(1);
}
