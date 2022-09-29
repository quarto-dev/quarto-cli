import { Input, Secret } from "cliffy/prompt/mod.ts";

import {
  readAccessTokens,
  writeAccessToken,
  writeAccessTokens,
} from "../common/account.ts";
import {
  AccountToken,
  AccountTokenType,
  PublishFiles,
  PublishProvider,
} from "../provider.ts";
import { PublishOptions, PublishRecord } from "../types.ts";

export const kConfluence = "confluence";

const kConfluenceDescription = "Confluence";

const kConfluenceUserEmail = "CONFLUENCE_USER_EMAIL";
const kConfluenceAuthToken = "CONFLUENCE_AUTH_TOKEN";

type Account = {
  email: string;
  token: string;
};

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

  // account based on environment variables
  const envAccount = confluenceEnvironmentVarAccount();
  if (envAccount) {
    accounts.push(envAccount);
  }

  // read any other tokens that are stored
  accounts.push(...(readAccessTokens<AccountToken>(kConfluence) || []));

  // return the accounts
  return Promise.resolve(accounts);
}

function confluenceEnvironmentVarAccount() {
  const name = Deno.env.get(kConfluenceUserEmail);
  const token = Deno.env.get(kConfluenceAuthToken);
  if (name && token) {
    return {
      type: AccountTokenType.Environment,
      name,
      server: null,
      token,
    };
  }
}

async function authorizeToken(_options: PublishOptions) {
  const name = await Input.prompt({
    indent: "",
    message: `Confluence Account Email:`,
  });
  if (name.length === 0) {
    throw new Error();
  }

  const token = await Secret.prompt({
    indent: "",
    message: "Confluence API Token:",
    hint: "Create an API token at https://id.atlassian.com/manage/api-tokens",
  });
  // 'Enter' with no value ends publish
  if (token.length === 0) {
    throw new Error();
  }

  // TODO: server/space URL
  // TODO: validate that this token actually works

  const accountToken: AccountToken = {
    type: AccountTokenType.Authorized,
    name,
    server: null,
    token,
  };

  // save it
  writeAccessToken<AccountToken>(
    kConfluence,
    accountToken,
    (a, b) => a.name === b.name,
  );

  return Promise.resolve(accountToken);
}

function removeToken(token: AccountToken) {
  writeAccessTokens(
    confluenceProvider.name,
    readAccessTokens<AccountToken>(confluenceProvider.name)?.filter(
      (accessToken) => {
        return accessToken.name !== token.name;
      },
    ) || [],
  );
}

function resolveTarget(
  _account: AccountToken,
  target: PublishRecord,
): Promise<PublishRecord | undefined> {
  return Promise.resolve(target);
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
