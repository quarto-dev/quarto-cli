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
import { huggingfaceProvider } from "./huggingface/huggingface.ts";
import { AccountToken } from "./provider-types.ts";

export function accountTokenText(token: AccountToken) {
  return token.name + (token.server ? ` (${token.server})` : "");
}

const kPublishProviders = [
  quartoPubProvider,
  ghpagesProvider,
  rsconnectProvider,
  positCloudProvider,
  netlifyProvider,
  confluenceProvider,
  huggingfaceProvider,
];

export function publishProviders() {
  return kPublishProviders.slice();
}

export function findProvider(name?: string) {
  return kPublishProviders.find((provider) => provider.name === name);
}
