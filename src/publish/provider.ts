/*
 * provider.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { netlifyProvider } from "./netlify/netlify.ts";
import { ghpagesProvider } from "./gh-pages/gh-pages.ts";
import { quartoPubProvider } from "./quarto-pub/quarto-pub.ts";
import { rsconnectProvider } from "./rsconnect/rsconnect.ts";
import { confluenceProvider } from "./confluence/confluence.ts";
import { huggingfaceProvider } from "./huggingface/huggingface.ts";
import { cloudflarePagesProvider } from "./cloudflare/cloudflare.ts";
import { AccountToken } from "./provider-types.ts";
import { warning } from "../deno_ral/log.ts";

export function accountTokenText(token: AccountToken) {
  return token.name + (token.server ? ` (${token.server})` : "");
}

const kPublishProviders = [
  quartoPubProvider,
  ghpagesProvider,
  rsconnectProvider,
  netlifyProvider,
  cloudflarePagesProvider,
  confluenceProvider,
  huggingfaceProvider,
];

export function publishProviders() {
  return kPublishProviders.slice();
}

export function findProvider(name?: string) {
  if (name === "posit-cloud") {
    warning(
      `The Posit Cloud publishing destination is no longer supported. See https://docs.posit.co/cloud/whats_new/#october-2024 for details.`,
    );
  }
  if (name === "cloudflare") {
    return cloudflarePagesProvider;
  }
  return kPublishProviders.find((provider) => provider.name === name);
}
