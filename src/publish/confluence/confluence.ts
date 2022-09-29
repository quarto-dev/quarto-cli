import { AccountToken, PublishFiles, PublishProvider } from "../provider.ts";
import { PublishOptions, PublishRecord } from "../types.ts";

export const kConfluence = "confluence";

const kConfluenceDescription = "Confluence";

export const confluenceProvider: PublishProvider = {
  name: kConfluence,
  description: kConfluenceDescription,
  requiresServer: false,
  listOriginOnly: false,
  accountTokens,
  authorizeToken,
  removeToken,
  resolveTarget,
  publish,
  isUnauthorized,
  isNotFound,
};

function accountTokens() {
  const accounts: AccountToken[] = [];

  return Promise.resolve(accounts);
}

function authorizeToken(_options: PublishOptions) {
  return Promise.resolve(undefined);
}

function removeToken(_token: AccountToken) {
}

function resolveTarget(
  _account: AccountToken,
  _target: PublishRecord,
): Promise<PublishRecord | undefined> {
  return Promise.resolve(undefined);
}

function publish(
  _account: AccountToken,
  _type: "document" | "site",
  _input: string,
  _title: string,
  _slug: string,
  _render: (siteUrl?: string) => Promise<PublishFiles>,
  _options: PublishOptions,
  _target?: PublishRecord,
): Promise<[PublishRecord, URL | undefined]> {
  throw new Error("not implemented");
}

function isUnauthorized(_err: Error) {
  return false;
}

function isNotFound(_err: Error) {
  return false;
}
