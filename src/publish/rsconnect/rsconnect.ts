/*
* rsconnect.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { Input } from "cliffy/prompt/input.ts";

import { AccountToken, PublishFiles, PublishProvider } from "../provider.ts";
import { PublishRecord } from "../types.ts";

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

function accountTokens() {
  // check for CONNECT_SERVER / CONNECT_API_KEY

  // check for accounts

  // TODO: quarto publish connect accounts

  return Promise.resolve([]);
}

async function authorizeToken() {
  const server = await Input.prompt({
    message: "Server URL:",
    minLength: 1,
    hint: "e.g. https://connect.example.com",
    validate: (value) => {
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

  const apiKey = await Input.prompt({
    message: "API Key:",
    minLength: 1,
    hint: "Learn more at https://docs.rstudio.com/connect/user/api-keys/",
  });

  // let's make a request

  //  "https://connect.example.com/__api__/v1/user"
  // https://docs.rstudio.com/connect/api/#get-/v1/user

  // save the server

  return Promise.resolve(undefined);
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

function isUnauthorized(_err: Error) {
  return false;
}
