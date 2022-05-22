/*
* provider.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

export interface PublishOptions {
  path: string;
  render: boolean;
  prompt: boolean;
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

export interface PublishProvider {
  name: string;
  description: string;
  accountTokens: () => Promise<AccountToken[]>;
  authorizeToken: () => Promise<AccountToken | undefined>;
  publish: (options: PublishOptions, token: AccountToken) => Promise<void>;
  isUnauthorized: (error: Error) => boolean;
}
