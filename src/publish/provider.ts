/*
 * provider.ts
 *
 * Copyright (C) 2020-2026 Posit Software, PBC
 */

import { netlifyProvider } from "./netlify/netlify.ts";
import { ghpagesProvider } from "./gh-pages/gh-pages.ts";
import { rsconnectProvider } from "./rsconnect/rsconnect.ts";
import { confluenceProvider } from "./confluence/confluence.ts";
import { huggingfaceProvider } from "./huggingface/huggingface.ts";
import { positConnectCloudProvider } from "./posit-connect-cloud/posit-connect-cloud.ts";
import { AccountToken } from "./provider-types.ts";
import { warning } from "../deno_ral/log.ts";

export function accountTokenText(token: AccountToken) {
  return token.name + (token.server ? ` (${token.server})` : "");
}

const kPublishProviders = [
  ghpagesProvider,
  rsconnectProvider,
  netlifyProvider,
  positConnectCloudProvider,
  confluenceProvider,
  huggingfaceProvider,
];

export function publishProviders() {
  return kPublishProviders.slice();
}

export function findProvider(name?: string) {
  if (name === "posit-cloud") {
    warning(
      `The Posit Cloud publishing destination is no longer supported. ` +
        `Consider publishing to Posit Connect Cloud instead ` +
        `using \`quarto publish posit-connect-cloud\`. ` +
        `See https://docs.posit.co/cloud/whats_new/#october-2024 for details.`,
    );
  }
  if (name === "quarto-pub") {
    warning(
      `The Quarto Pub publishing destination is no longer supported. ` +
        `Consider publishing to Posit Connect Cloud instead ` +
        `using \`quarto publish posit-connect-cloud\`. ` +
        `See https://docs.posit.co/cloud/whats_new/#october-2024 for details.`,
    );
  }
  return kPublishProviders.find((provider) => provider.name === name);
}
