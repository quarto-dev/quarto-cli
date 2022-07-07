/*
* provider.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { quartoConfig } from "../core/quarto.ts";
import { netlifyProvider } from "./netlify/netlify.ts";
import { ghpagesProvider } from "./gh-pages/gh-pages.ts";
import { quartoPubProvider } from "./quarto-pub/quarto-pub.ts";
import { rsconnectProvider } from "./rsconnect/rsconnect.ts";
import { PublishOptions, PublishRecord } from "./types.ts";

export enum AccountTokenType {
  Environment,
  Authorized,
  Anonymous,
}

export interface AccountToken {
  type: AccountTokenType;
  name: string;
  server: string | null;
  token: string;
}

export function accountTokenText(token: AccountToken) {
  return token.name +
    (token.server ? ` (${token.server})` : "");
}

export function anonymousAccount(): AccountToken {
  return {
    type: AccountTokenType.Anonymous,
    name: "anonymous",
    server: null,
    token: "anonymous",
  };
}

const kPublishProviders = [
  quartoPubProvider,
  ghpagesProvider,
  rsconnectProvider,
  netlifyProvider,
];

export async function publishProviders() {
  const providers: Array<PublishProvider> = [];
  const dotenvConfig = await quartoConfig.dotenv();
  const quartopubAppId = dotenvConfig["QUARTO_PUB_APP_CLIENT_ID"];
  if (quartopubAppId && quartopubAppId !== "None") {
    providers.push(quartoPubProvider);
  }
  providers.push(ghpagesProvider);
  providers.push(rsconnectProvider);
  providers.push(netlifyProvider);
  return providers;
}

export function findProvider(name?: string) {
  return kPublishProviders.find((provider) => provider.name === name);
}

export interface PublishDeployment {
  provider: PublishProvider;
  target: PublishRecord;
}

export interface PublishDeploymentWithAccount extends PublishDeployment {
  account?: AccountToken;
}

export type PublishFiles = {
  baseDir: string;
  rootFile: string;
  files: string[];
};

export interface PublishProvider {
  name: string;
  description: string;
  requiresServer: boolean;
  listOriginOnly: boolean;
  publishRecord?: (dir: string) => Promise<PublishRecord | undefined>;
  accountTokens: () => Promise<AccountToken[]>;
  removeToken: (token: AccountToken) => void;
  authorizeToken: (
    options: PublishOptions,
    target?: PublishRecord,
  ) => Promise<AccountToken | undefined>;
  resolveTarget: (
    account: AccountToken,
    target: PublishRecord,
  ) => Promise<PublishRecord | undefined>;
  publish: (
    account: AccountToken,
    type: "document" | "site",
    input: string,
    title: string,
    slug: string,
    render: (siteUrl?: string) => Promise<PublishFiles>,
    options: PublishOptions,
    target?: PublishRecord,
  ) => Promise<[PublishRecord | undefined, URL | undefined]>;
  isUnauthorized: (error: Error) => boolean;
  isNotFound: (error: Error) => boolean;
}
