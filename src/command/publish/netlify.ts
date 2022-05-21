/*
* netlify.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { error } from "log/mod.ts";

import { Command } from "cliffy/command/mod.ts";
import {
  authorizeNetlifyAccessToken,
  kNetlifyAuthTokenVar,
  netlifyAccessToken,
  netlifyEnvironmentAuthToken,
} from "../../publish/netlify/account.ts";
import { netlifyPublish } from "../../publish/netlify/netlify.ts";

import { PublishOptions, PublishProvider } from "./provider.ts";
import { ApiError } from "../../publish/netlify/api/index.ts";
import {
  accountPrompt,
  AccountToken,
  AccountTokenType,
  authorizePrompt,
  handleUnauthorized,
} from "./account.ts";
import { exitWithCleanup } from "../../core/cleanup.ts";

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

async function netlifyConfigure(options: PublishOptions): Promise<void> {
  // see what tyep of token we are going to use
  let token: AccountToken | undefined;
  const envToken = netlifyEnvironmentAuthToken();
  const accessToken = netlifyAccessToken();

  // build list of account options
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

  // if we aren't prompting then we need to have one at the ready
  if (!options.prompt) {
    token = accounts[0];
    if (!token) {
      error(
        `No configured account available (account required for publish with --no-prompt)`,
      );
    }
  } else {
    // prompot for account to publish with
    if (accounts.length > 0) {
      token = await accountPrompt(netlifyProvider, accounts);
    }

    // if we don't have a token yet we need to authorize
    if (!token) {
      if (await authorizePrompt(netlifyProvider)) {
        const netlfyToken = await authorizeNetlifyAccessToken();
        if (netlfyToken) {
          token = {
            type: AccountTokenType.Authorized,
            name: netlfyToken.email!,
            token: netlfyToken.access_token!,
          };
        }
      }
    }
  }

  // publish if we have a token
  if (token) {
    try {
      await netlifyPublish({ token: token.token });
    } catch (err) {
      // attempt to recover from unauthorized
      if (err instanceof ApiError && err.status === 401) {
        if (await handleUnauthorized(netlifyProvider, token)) {
          if ((await authorizeNetlifyAccessToken())) {
            // recursve after re-authorization
            await netlifyConfigure(options);
          }
        } else {
          exitWithCleanup(1);
        }
      } else {
        throw err;
      }
    }
  }
}
