/*
 * quarto-pub.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { AccessToken, Ticket } from "./api/types.ts";
import {
  AccountToken,
  AccountTokenType,
  PublishFiles,
  PublishProvider,
} from "../provider-types.ts";
import {
  AuthorizationHandler,
  authorizeAccessToken,
  readAccessTokens,
  writeAccessTokens,
} from "../common/account.ts";
import { handlePublish, PublishHandler } from "../common/publish.ts";
import { ApiError, PublishOptions, PublishRecord } from "../types.ts";

import { QuartoPubClient } from "./api/index.ts";
import { authorizePrompt } from "../account.ts";
import { quartoConfig } from "../../core/quarto.ts";
import { RenderFlags } from "../../command/render/types.ts";

export const kQuartoPub = "quarto-pub";
export const kQuartoPubAuthTokenVar = "QUARTO_PUB_AUTH_TOKEN";

export const quartoPubProvider: PublishProvider = {
  name: kQuartoPub,
  description: "Quarto Pub",
  requiresServer: false,
  listOriginOnly: false,
  accountTokens,
  authorizeToken,
  removeToken,
  resolveTarget,
  publish,
  isUnauthorized,
  isNotFound,
};

function accountTokens() {
  const envTk = environmentAuthToken();
  const accessTks = readAccessTokens<AccessToken>(quartoPubProvider.name);

  const accounts: AccountToken[] = [];
  if (envTk) {
    accounts.push({
      type: AccountTokenType.Environment,
      name: kQuartoPubAuthTokenVar,
      server: null,
      token: envTk,
    });
  }

  if (accessTks) {
    for (const accessTk of accessTks) {
      accounts.push({
        type: AccountTokenType.Authorized,
        name: accessTk.email!,
        server: null,
        token: accessTk.application_token,
      });
    }
  }

  return Promise.resolve(accounts);
}

async function authorizeToken(_options: PublishOptions) {
  if (await authorizePrompt(quartoPubProvider)) {
    const token = await authorizeQuartoPubAccessToken();
    if (token) {
      return {
        type: AccountTokenType.Authorized,
        name: token.email!,
        server: null,
        token: token.application_token,
      };
    } else {
      return undefined;
    }
  }
}

function removeToken(token: AccountToken) {
  writeAccessTokens(
    quartoPubProvider.name,
    readAccessTokens<AccessToken>(quartoPubProvider.name)?.filter(
      (accessToken) => {
        return accessToken.email !== token.name;
      },
    ) || [],
  );
}

// Load the .env configuration and the environment.
const dotenvConfig = await quartoConfig.dotenv();
const quartoPubEnvironment = dotenvConfig["QUARTO_PUB_ENVIRONMENT"];

function environmentAuthToken() {
  return Deno.env.get(kQuartoPubAuthTokenVar);
}

function authorizeQuartoPubAccessToken(): Promise<
  AccessToken | undefined
> {
  // Create an unauthorized QuartoPubClient.
  const client = new QuartoPubClient(quartoPubEnvironment);

  const provider: AuthorizationHandler<AccessToken, Ticket> = {
    name: kQuartoPub,

    createTicket: (): Promise<Ticket> =>
      client.createTicket(dotenvConfig["QUARTO_PUB_APP_CLIENT_ID"]),

    authorizationUrl: (ticket: Ticket): string => ticket.authorization_url,

    checkTicket: (ticket: Ticket): Promise<Ticket> =>
      client.showTicket(ticket.id),

    exchangeTicket: (ticket: Ticket): Promise<AccessToken> =>
      client.exchangeTicket(ticket.id),

    compareTokens: (a: AccessToken, b: AccessToken) =>
      a.account_identifier === b.account_identifier,
  };

  return authorizeAccessToken(provider);
}

export function resolveTarget(
  _account: AccountToken,
  target: PublishRecord,
): Promise<PublishRecord | undefined> {
  return Promise.resolve(target);
}

function publish(
  accountToken: AccountToken,
  type: "document" | "site",
  _input: string,
  title: string,
  slug: string,
  render: (flags?: RenderFlags) => Promise<PublishFiles>,
  _options: PublishOptions,
  target?: PublishRecord,
): Promise<[PublishRecord, URL | undefined]> {
  // Create an authorized QuartoPubClient.
  const client = new QuartoPubClient(quartoPubEnvironment, accountToken.token);

  const handler: PublishHandler = {
    name: kQuartoPub,

    slugAvailable: (slug: string) => client.slugAvailable(slug),

    createSite: (type: string, title: string, slug: string) =>
      client.createSite(type, title, slug),

    createDeploy: (
      siteId: string,
      files: Record<string, string>,
      size: number,
    ) => client.createDeploy(siteId, files, size),

    getDeploy: (deployId: string) => client.getDeploy(deployId),

    uploadDeployFile: (deployId: string, path: string, fileBody: Blob) =>
      client.uploadDeployFile(deployId, path, fileBody),

    updateAccountSite: () => client.updateAccountSite(),
  };

  return handlePublish(handler, type, title, slug, render, target);
}

function isUnauthorized(err: Error) {
  return err instanceof ApiError && err.status === 401;
}

function isNotFound(err: Error) {
  return err instanceof ApiError && err.status === 404;
}
