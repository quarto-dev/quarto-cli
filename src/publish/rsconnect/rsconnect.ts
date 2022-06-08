/*
* rsconnect.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { info } from "log/mod.ts";
import * as colors from "fmt/colors.ts";

import { Input } from "cliffy/prompt/input.ts";
import { Secret } from "cliffy/prompt/secret.ts";

import {
  AccountToken,
  AccountTokenType,
  PublishFiles,
  PublishProvider,
} from "../provider.ts";
import { PublishRecord } from "../types.ts";
import { RSConnectClient } from "./api/index.ts";
import { ApiError, Content } from "./api/types.ts";
import {
  readAccessTokens,
  writeAccessToken,
  writeAccessTokens,
} from "../common/account.ts";
import { ensureProtocolAndTrailingSlash } from "../../core/url.ts";

import { pandocAutoIdentifier } from "../../core/pandoc/pandoc-id.ts";
import { contentName } from "../publish.ts";

export const kRSConnect = "rsconnect";
const kRSConnectDescription = "RS Connect";

export const kRSConnectServerVar = "CONNECT_SERVER";
export const kRSConnectAuthTokenVar = "CONNECT_API_KEY";

// TODO: note link from aron on new sites api
// The public API workflow for deploys is described in our cookbook with curl examples: https://docs.rstudio.com/connect/cookbook/deploying/#deploying-workflow,
// and that links out to the content API docs: https://docs.rstudio.com/connect/api/#tag--Content. Both rsconnect and rsconnect-python use some of the internal
// and some of the public APIs because they existed before some of the APIs were public.

export const rsconnectProvider: PublishProvider = {
  name: kRSConnect,
  description: kRSConnectDescription,
  accountTokens,
  authorizeToken,
  removeToken,
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

function removeToken(token: AccountToken) {
  writeAccessTokens(
    rsconnectProvider.name,
    readAccessTokens<Account>(rsconnectProvider.name)?.filter(
      (accessToken) => {
        return accessToken.username !== token.name;
      },
    ) || [],
  );
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
          const url = new URL(ensureProtocolAndTrailingSlash(value));
          if (!["http:", "https:"].includes(url.protocol)) {
            return `${value} is not an HTTP URL`;
          } else {
            return true;
          }
        } catch {
          return `${value} is not a valid URL`;
        }
      },
      transform: ensureProtocolAndTrailingSlash,
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
    const apiKey = await Secret.prompt({
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
          (a, b) => a.server === b.server,
        );
        // return access token
        return {
          type: AccountTokenType.Authorized,
          name: user.username,
          server,
          token: apiKey,
        };
      } else {
        promptError(
          "API key is for an RStudio Connect viewer rather than a publisher.",
        );
      }
    } catch (err) {
      if (isUnauthorized(err)) {
        promptError(
          "API key is not authorized for this RStudio Connect server.",
        );
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

async function publish(
  account: AccountToken,
  type: "document" | "site",
  title: string,
  _render: (siteDir: string) => Promise<PublishFiles>,
  target?: PublishRecord,
): Promise<[PublishRecord, URL]> {
  // if there is no existing target then prompt for a name
  if (!target) {
    const content = await createContent(account, type, title);
    if (content) {
      target = { id: content.guid, url: content.content_url, code: false };
      console.log(content);
    } else {
      throw new Error();
    }
  }

  // see rsconnect::writeManifest function

  return Promise.resolve([target!, new URL("https://example.com")]);
}

function isUnauthorized(err: Error) {
  return err instanceof ApiError && err.status === 401;
}

function isConflict(err: Error) {
  return err instanceof ApiError && err.status === 409;
}

// deno-lint-ignore no-unused-vars
function isNotFound(err: Error) {
  return err instanceof ApiError && err.status === 404;
}

async function createContent(
  account: AccountToken,
  type: "document" | "site",
  title: string,
): Promise<Content | undefined> {
  // default name
  const defaultName = pandocAutoIdentifier(title, false);
  let chosenName = defaultName;

  // create rpc client
  const client = new RSConnectClient(account.server!, account.token);

  while (true) {
    // prompt for name
    chosenName = await Input.prompt({
      indent: "",
      message: `${contentName(type)} name:`,
      suggestions: [chosenName],
      hint:
        "Names can contain numbers, letters, _, and -, and must be unique\n" +
        "  across content published in your account.",
      validate: (value: string) => {
        if (value.length < 3) {
          return "Invalid content name (must be at least 3 characters)";
        } else if (value !== pandocAutoIdentifier(value, false)) {
          return "Invalid content name (use only numbers, letters, _, and -).";
        } else {
          return true;
        }
      },
    });

    // Enter exits publishing
    if (chosenName.trim().length === 0) {
      return undefined;
    }

    // try to create the content w/ the name
    try {
      return await client.createContent(chosenName, title);
    } catch (err) {
      if (isConflict(err)) {
        promptError("The provided name is already in use within this account.");
      } else {
        throw err;
      }
    }
  }
}

function promptError(msg: string) {
  info(colors.red(`  ${msg}`));
}
