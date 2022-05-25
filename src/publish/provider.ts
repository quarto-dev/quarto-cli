/*
* provider.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { netlifyProvider } from "./netlify/netlify.ts";
import { PublishRecord } from "./types.ts";

export const kPublishProviders = [netlifyProvider];

export function findProvider(name: string) {
  return kPublishProviders.find((provider) => provider.name === name);
}

export enum AccountTokenType {
  Environment,
  Authorized,
}

export type AccountToken = {
  type: AccountTokenType;
  name: string;
  token: string;
};

export type PublishDeployment = {
  provider: PublishProvider;
  target: PublishRecord;
};

export interface PublishProvider {
  name: string;
  description: string;
  accountTokens: () => Promise<AccountToken[]>;
  authorizeToken: () => Promise<AccountToken | undefined>;
  resolveTarget: (
    account: AccountToken,
    target: PublishRecord,
  ) => Promise<PublishRecord>;
  publish: (
    output: string,
    account: AccountToken,
    target?: PublishRecord,
  ) => Promise<PublishRecord>;
  isUnauthorized: (error: Error) => boolean;
}
