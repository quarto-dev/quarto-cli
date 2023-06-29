/*
 * provider.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { netlifyProvider } from "./netlify/netlify.ts";
import { ghpagesProvider } from "./gh-pages/gh-pages.ts";
import { quartoPubProvider } from "./quarto-pub/quarto-pub.ts";
import { rsconnectProvider } from "./rsconnect/rsconnect.ts";
import { positCloudProvider } from "./posit-cloud/posit-cloud.ts";
import { confluenceProvider } from "./confluence/confluence.ts";
import { PublishProvider } from "./provider-types.ts";
import { AccountToken, AccountTokenType } from "./provider-types.ts";

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
  positCloudProvider,
  netlifyProvider,
  confluenceProvider,
];

export function publishProviders() {
  const providers: Array<PublishProvider> = [];
  providers.push(quartoPubProvider);
  providers.push(ghpagesProvider);
  providers.push(rsconnectProvider);
  providers.push(positCloudProvider);
  providers.push(netlifyProvider);
  providers.push(confluenceProvider);
  return providers;
}

export function findProvider(name?: string) {
  return kPublishProviders.find((provider) => provider.name === name);
}
