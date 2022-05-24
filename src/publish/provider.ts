/*
* provider.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { netlifyProvider } from "./netlify/netlify.ts";

export const kPublishProviders = [netlifyProvider];

export function findProvider(name: string) {
  return kPublishProviders.find((provider) => provider.name === name);
}

export type PublishTarget = {
  site_id: string;
  site_url?: string;
};

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
  account: AccountToken;
  target?: PublishTarget;
};

export interface PublishProvider {
  name: string;
  description: string;
  accountTokens: () => Promise<AccountToken[]>;
  authorizeToken: () => Promise<AccountToken | undefined>;
  resolveTarget: (
    token: AccountToken,
    target: PublishTarget,
  ) => Promise<PublishTarget>;
  publish: (
    target: string,
    deployment: PublishDeployment,
  ) => Promise<PublishTarget>;
  isUnauthorized: (error: Error) => boolean;
}
