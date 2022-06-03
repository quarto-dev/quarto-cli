/*
* provider.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { netlifyProvider } from "./netlify/netlify.ts";
import { quartoPubProvider } from "./quarto-pub/quarto-pub.ts";
import { rsconnectProvider } from "./rsconnect/rsconnect.ts";
import { PublishRecord } from "./types.ts";

export enum AccountTokenType {
  Environment,
  Authorized,
}

export type AccountToken = {
  type: AccountTokenType;
  name: string;
  server: string | null;
  token: string;
};

export const kPublishProviders = [
  netlifyProvider,
  quartoPubProvider,
  rsconnectProvider,
];

export function findProvider(name: string) {
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
  authorizeToken: () => Promise<AccountToken | undefined>;
  resolveTarget: (
    account: AccountToken,
    target: PublishRecord,
  ) => Promise<PublishRecord | undefined>;
  publish: (
    account: AccountToken,
    type: "document" | "site",
    render: (siteUrl?: string) => Promise<PublishFiles>,
    target?: PublishRecord,
  ) => Promise<[PublishRecord, URL]>;
  isUnauthorized: (error: Error) => boolean;
}
