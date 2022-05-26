/*
* quartopub.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import {
  AuthorizationProvider,
  authorizeAccessToken,
  readAccessToken,
} from "../account.ts";
import {
  AccountToken,
  AccountTokenType,
  PublishProvider,
} from "../provider.ts";
import { PublishRecord } from "../types.ts";
import { AccessToken, QuartopubClient, Ticket } from "./api/index.ts";

export const kQuartopub = "quartopub";

export const kQuartoPubAuthTokenVar = "QUARTOPUB_AUTH_TOKEN";

export const quartopubProvider: PublishProvider = {
  name: kQuartopub,
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
      token: envTk,
    });
  }
  if (accessTk) {
    accounts.push({
      type: AccountTokenType.Authorized,
      name: accessTk.email!,
      token: accessTk.userToken,
    });
  }

  return Promise.resolve(accounts);
}

async function authorizeToken() {
  const token = await authorizeQuartopubAccessToken();
  if (token) {
    return {
      type: AccountTokenType.Authorized,
      name: token.email!,
      token: token.userToken,
    };
  }
}

function environmentAuthToken() {
  return Deno.env.get(kQuartoPubAuthTokenVar);
}

function accessToken(): AccessToken | undefined {
  return readAccessToken<AccessToken>(kQuartopub);
}

function authorizeQuartopubAccessToken(): Promise<
  AccessToken | undefined
> {
  // create provider
  const client = new QuartopubClient();
  const provider: AuthorizationProvider<AccessToken, Ticket> = {
    name: kQuartopub,
    createTicket: function (): Promise<Ticket> {
      return client.createTicket();
    },
    authorizationUrl: function (ticket: Ticket): string {
      return ticket.authorizationURL;
    },
    checkTicket: function (ticket: Ticket): Promise<Ticket> {
      return client.showTicket(ticket.id);
    },
    exchangeTicket: function (ticket: Ticket): Promise<AccessToken> {
      return client.exchangeTicket(ticket.id);
    },
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
  _outputDir: string,
  _account: AccountToken,
  target?: PublishRecord,
): Promise<PublishRecord> {
  return Promise.resolve(target!);
}

function isUnauthorized(_err: Error) {
  return false;
}
