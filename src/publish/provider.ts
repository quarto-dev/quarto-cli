/*
* provider.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { quartoConfig } from "../core/quarto.ts";
import { netlifyProvider } from "./netlify/netlify.ts";
import { quartoPubProvider } from "./quarto-pub/quarto-pub.ts";
import { rsconnectProvider } from "./rsconnect/rsconnect.ts";
import { PublishRecord } from "./types.ts";

export enum AccountTokenType {
  Environment,
  Authorized,
}

export interface AccountToken {
  type: AccountTokenType;
  name: string;
  server: string | null;
  token: string;
}

const kPublishProviders = [
  netlifyProvider,
  quartoPubProvider,
  rsconnectProvider,
];

export async function publishProviders() {
  const providers: Array<PublishProvider> = [];
  providers.push(netlifyProvider);
  const dotenvConfig = await quartoConfig.dotenv();
  const quartopubAppId = dotenvConfig["QUARTO_PUB_APP_CLIENT_ID"];
  if (quartopubAppId && quartopubAppId !== "None") {
    providers.push(quartoPubProvider);
  }
  providers.push(rsconnectProvider);
  return providers;
}

export function findProvider(name?: string) {
  return kPublishProviders.find((provider) => provider.name === name);
}

export type PublishDeployment = {
  provider: PublishProvider;
  target: PublishRecord;
};

export type PublishFiles = {
  baseDir: string;
  rootFile: string;
  files: string[];
};

export interface PublishProvider {
  name: string;
  description: string;
  accountTokens: () => Promise<AccountToken[]>;
  removeToken: (token: AccountToken) => void;
  authorizeToken: (target?: PublishRecord) => Promise<AccountToken | undefined>;
  resolveTarget: (
    account: AccountToken,
    target: PublishRecord,
  ) => Promise<PublishRecord | undefined>;
  publish: (
    account: AccountToken,
    type: "document" | "site",
    title: string,
    render: (siteUrl?: string) => Promise<PublishFiles>,
    target?: PublishRecord,
  ) => Promise<[PublishRecord, URL]>;
  isUnauthorized: (error: Error) => boolean;
}
