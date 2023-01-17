/*
* provider.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/

import { quartoConfig } from "../core/quarto.ts";
import { netlifyProvider } from "./netlify/netlify.ts";
import { ghpagesProvider } from "./gh-pages/gh-pages.ts";
import { quartoPubProvider } from "./quarto-pub/quarto-pub.ts";
import { rsconnectProvider } from "./rsconnect/rsconnect.ts";
import { confluenceProvider } from "./confluence/confluence.ts";
import { PublishOptions, PublishRecord } from "./types.ts";
import { ProjectContext } from "../project/types.ts";
import { RenderFlags } from "../command/render/types.ts";

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
  return token.name + (token.server ? ` (${token.server})` : "");
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
  confluenceProvider,
];

export function publishProviders() {
  const providers: Array<PublishProvider> = [];
  providers.push(quartoPubProvider);
  providers.push(ghpagesProvider);
  providers.push(rsconnectProvider);
  providers.push(netlifyProvider);
  providers.push(confluenceProvider);
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
