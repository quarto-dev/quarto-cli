/*
* rsconnect.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { AccountToken, PublishFiles, PublishProvider } from "../provider.ts";
import { PublishRecord } from "../types.ts";

export const kRSConnect = "rsconnect";
const kRSConnectDescription = "RS Connect";

export const kRSConnectAuthTokenVar = "RSCONNECT_API_KEY";

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
  return Promise.resolve([]);
}

function authorizeToken() {
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
