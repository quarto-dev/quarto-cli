/*
* quarto-pub.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { AccessToken, Ticket } from "./api/types.ts";
import {
  AccountToken,
  AccountTokenType,
  PublishFiles,
  PublishProvider,
} from "../provider.ts";
import {
  AuthorizationHandler,
  authorizeAccessToken,
  readAccessToken,
} from "../common/account.ts";
import { handlePublish, PublishHandler } from "../common/publish.ts";

import { PublishRecord } from "../types.ts";
import { QuartoPubClient } from "./api/index.ts";
import { quartoConfig } from "../../core/quarto.ts";
import { authorizePrompt } from "../account.ts";

export const kQuartoPub = "quarto-pub";
export const kQuartoPubAuthTokenVar = "QUARTO_PUB_AUTH_TOKEN";

export const quartoPubProvider: PublishProvider = {
  name: kQuartoPub,
  description: "Quarto Pub",
  accountTokens,
  authorizeToken,
  resolveTarget,
  publish,
  isUnauthorized,
};

function accountTokens() {
  const envTk = environmentAuthToken();
  const accessTk = accessToken();

  const accounts: AccountToken[] = [];
  if (envTk) {
    accounts.push({
      type: AccountTokenType.Environment,
      name: kQuartoPubAuthTokenVar,
      server: null,
      token: envTk,
    });
  }

  if (accessTk) {
    accounts.push({
      type: AccountTokenType.Authorized,
      name: accessTk.email!,
      server: null,
      token: accessTk.applicationToken,
    });
  }

  return Promise.resolve(accounts);
}

async function authorizeToken() {
  if (await authorizePrompt(quartoPubProvider)) {
    const token = await authorizeQuartoPubAccessToken();
    if (token) {
      return {
        type: AccountTokenType.Authorized,
        name: token.email!,
        server: null,
        token: token.applicationToken,
      };
    } else {
      return undefined;
    }
  }
}

// Load the .env configuration and the environment.
const dotenvConfig = await quartoConfig.dotenv();
const quartoPubEnvironment = dotenvConfig["QUARTO_PUB_ENVIRONMENT"];

function environmentAuthToken() {
  return Deno.env.get(kQuartoPubAuthTokenVar);
}

function accessToken(): AccessToken | undefined {
  return readAccessToken<AccessToken>(kQuartoPub);
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

    authorizationUrl: (ticket: Ticket): string => ticket.authorizationURL,

    checkTicket: (ticket: Ticket): Promise<Ticket> =>
      client.showTicket(ticket.id),

    exchangeTicket: (ticket: Ticket): Promise<AccessToken> =>
      client.exchangeTicket(ticket.id),
  };

  return authorizeAccessToken(provider);
}

export function resolveTarget(
  _account: AccountToken,
  target: PublishRecord,
): Promise<PublishRecord> {
  return Promise.resolve(target);
}

function publish(
  accountToken: AccountToken,
  type: "document" | "site",
  render: (siteUrl: string) => Promise<PublishFiles>,
  target?: PublishRecord,
): Promise<[PublishRecord, URL]> {
  // Create an authorized QuartoPubClient.
  const client = new QuartoPubClient(quartoPubEnvironment, accountToken.token);

  const handler: PublishHandler = {
    name: kQuartoPub,

    createSite: () => client.createSite(),

    createDeploy: (siteId: string, files: Record<string, string>) =>
      client.createDeploy(siteId, files),

    getDeploy: (deployId: string) => client.getDeploy(deployId),

    uploadDeployFile: (deployId: string, path: string, fileBody: Blob) =>
      client.uploadDeployFile(deployId, path, fileBody),
  };

  return handlePublish(handler, type, render, target);
}

function isUnauthorized(_err: Error) {
  return false;
}
