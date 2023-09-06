/*
 * provider-types.ts
 *
 * Copyright (C) 2020-2023 Posit Software, PBC
 */

import { RenderFlags } from "../command/render/types.ts";
import { ProjectContext } from "../project/types.ts";
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

export interface PublishDeployment {
  provider: PublishProvider;
  target: PublishRecord;
}

export interface PublishDeploymentWithAccount extends PublishDeployment {
  account?: AccountToken;
}

export type InputMetadata = {
  title?: string;
  author?: string;
  date?: string;
};

export type PublishFiles = {
  baseDir: string;
  rootFile: string;
  files: string[];
  metadataByInput?: Record<string, InputMetadata>;
};

export interface PublishProvider {
  name: string;
  description: string;
  requiresServer: boolean;
  hidden?: boolean;
  listOriginOnly?: boolean;
  requiresRender?: boolean;
  accountDescriptor?: string;
  publishRecord?: (
    input: string | ProjectContext,
  ) => Promise<PublishRecord | undefined>;
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
    render: (flags?: RenderFlags) => Promise<PublishFiles>,
    options: PublishOptions,
    target?: PublishRecord,
  ) => Promise<[PublishRecord | undefined, URL | undefined]>;
  isUnauthorized: (error: Error) => boolean;
  isNotFound: (error: Error) => boolean;
}
