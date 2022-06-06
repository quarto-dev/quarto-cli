/*
* rsconnect.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { info } from "log/mod.ts";
import * as colors from "fmt/colors.ts";

import { Input } from "cliffy/prompt/input.ts";

import {
  AccountToken,
  AccountTokenType,
  PublishFiles,
  PublishProvider,
} from "../provider.ts";
import { PublishRecord } from "../types.ts";
import { RSConnectClient } from "./api/index.ts";
import { ApiError } from "./api/types.ts";
import { readAccessTokens, writeAccessToken } from "../common/account.ts";

export const kRSConnect = "rsconnect";
const kRSConnectDescription = "RS Connect";

export const kRSConnectServerVar = "CONNECT_SERVER";
export const kRSConnectAuthTokenVar = "CONNECT_API_KEY";

export const rsconnectProvider: PublishProvider = {
  name: kRSConnect,
  description: kRSConnectDescription,
  accountTokens,
  authorizeToken,
  resolveTarget,
  publish,
  isUnauthorized,
};

type Account = {
  username: string;
  server: string;
  key: string;
};

function accountTokens() {
  const accounts: AccountToken[] = [];

  // check for environment variable
  const server = Deno.env.get(kRSConnectServerVar);
  const apiKey = Deno.env.get(kRSConnectAuthTokenVar);
  if (server && apiKey) {
    accounts.push({
      type: AccountTokenType.Environment,
      name: kRSConnectAuthTokenVar,
      server,
      token: apiKey,
    });
  }

  // check for recorded tokens
  const tokens = readAccessTokens<Account>(kRSConnect);
  if (tokens) {
    accounts.push(...tokens.map((token) => ({
      type: AccountTokenType.Authorized,
      name: token.username,
      server: token.server,
      token: token.key,
    })));
  }

  return Promise.resolve(accounts);
}

async function authorizeToken(): Promise<AccountToken | undefined> {
  // ask for server (then validate that its actually a connect server
  // by sending a request without an auth token)
  let server: string | undefined;
  while (server === undefined) {
    // prompt for server
    server = await Input.prompt({
      message: "Server URL:",
      hint: "e.g. https://connect.example.com/",
      validate: (value) => {
        // 'Enter' with no value ends publish
        if (value.length === 0) {
          throw new Error();
        }
        try {
          const url = new URL(value);
          if (!["http:", "https:"].includes(url.protocol)) {
            return `${value} is not an HTTP URL`;
          } else {
            return true;
          }
        } catch {
          return `${value} is not a valid URL`;
        }
      },
    });

    // validate that its a connect server
    const client = new RSConnectClient(server);
    try {
      await client.getUser();
    } catch (err) {
      // connect server will give 401 for unauthorized, break out
      // of the loop in that case
      if (isUnauthorized(err)) {
        break;
      } else {
        info(
          colors.red(
            "   Unable to connect to server (is this a valid RStudio Connect Server?)",
          ),
        );
        server = undefined;
      }
    }
  }

  // get apiKey and username
  while (true) {
    const apiKey = await Input.prompt({
      message: "API Key:",
      hint: "Learn more at https://docs.rstudio.com/connect/user/api-keys/",
    });
    // 'Enter' with no value ends publish
    if (apiKey.length === 0) {
      throw new Error();
    }
    // get the user info
    try {
      const client = new RSConnectClient(server, apiKey);
      const user = await client.getUser();
      if (user.user_role !== "viewer") {
        // record account
        const account: Account = {
          username: user.username,
          server,
          key: apiKey,
        };
        writeAccessToken(
          kRSConnect,
          account,
          (a, b) => a.server === b.server && a.username === b.username,
        );
        // return access token
        return {
          type: AccountTokenType.Authorized,
          name: user.username,
          server,
          token: apiKey,
        };
      } else {
        info(
          colors.red(
            "   API key is for an RStudio Connect viewer rather than a publisher.",
          ),
        );
      }
    } catch (err) {
      if (isUnauthorized(err)) {
        info(colors.red(
          "   API key is not authorized for this RStudio Connect server.",
        ));
      } else {
        throw err;
      }
    }
  }
}

function resolveTarget(
  _account: AccountToken,
  _target: PublishRecord,
) {
  return Promise.resolve(_target);
}

function publish(
  _account: AccountToken,
  _type: "document" | "site",
  _render: (siteDir: string) => Promise<PublishFiles>,
  target?: PublishRecord,
): Promise<[PublishRecord, URL]> {
  return Promise.resolve([target!, new URL("https://example.com")]);
}

function isUnauthorized(err: Error) {
  return err instanceof ApiError && err.status === 401;
}

// deno-lint-ignore no-unused-vars
function isNotFound(err: Error) {
  return err instanceof ApiError && err.status === 404;
}
