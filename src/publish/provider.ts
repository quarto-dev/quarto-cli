/*
* provider.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { ProjectContext } from "../project/types.ts";

export interface PublishOptions {
  target: ProjectContext | string;
  render: boolean;
  prompt: boolean;
}

export interface PublishTarget {
  site: string;
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
  targetHint: () => string;
  targetValidate: (target: string) => Promise<boolean>;
  publish: (
    options: PublishOptions,
    target: PublishTarget,
    token: AccountToken,
  ) => Promise<void>;
  isUnauthorized: (error: Error) => boolean;
}
