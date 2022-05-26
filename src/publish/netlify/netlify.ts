/*
* netlify.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { AccessToken, NetlifyClient, Ticket } from "./api/index.ts";

import {
  AccountToken,
  AccountTokenType,
  PublishProvider,
} from "../provider.ts";
import { ApiError } from "../../publish/netlify/api/index.ts";
import { PublishRecord } from "../types.ts";
import {
  AuthorizationProvider,
  authorizeAccessToken,
  readAccessToken,
} from "../account.ts";
import { quartoConfig } from "../../core/quarto.ts";

export const kNetlify = "netlify";

export const kNetlifyAuthTokenVar = "NETLIFY_AUTH_TOKEN";

export const netlifyProvider: PublishProvider = {
  name: kNetlify,
  description: "Netlify",
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
      name: kNetlifyAuthTokenVar,
      token: envTk,
    });
  }
  if (accessTk?.access_token) {
    accounts.push({
      type: AccountTokenType.Authorized,
      name: accessTk.email!,
      token: accessTk?.access_token,
    });
  }

  return Promise.resolve(accounts);
}

async function authorizeToken() {
  const token = await authorizeNetlifyAccessToken();
  if (token) {
    return {
      type: AccountTokenType.Authorized,
      name: token.email!,
      token: token.access_token!,
    };
  }
}

function environmentAuthToken() {
  return Deno.env.get(kNetlifyAuthTokenVar);
}

function accessToken(): AccessToken | undefined {
  return readAccessToken<AccessToken>(kNetlify);
}

async function authorizeNetlifyAccessToken(): Promise<
  AccessToken | undefined
> {
  // create provider for authorization
  const client = new NetlifyClient({});
  const clientId = (await quartoConfig.dotenv())["NETLIFY_APP_CLIENT_ID"];
  const provider: AuthorizationProvider<AccessToken, Ticket> = {
    name: kNetlify,
    createTicket: function (): Promise<Ticket> {
      return client.ticket.createTicket({
        clientId,
      }) as unknown as Promise<Ticket>;
    },
    authorizationUrl: function (ticket: Ticket): string {
      return `https://app.netlify.com/authorize?response_type=ticket&ticket=${ticket.id}`;
    },
    checkTicket: function (ticket: Ticket): Promise<Ticket> {
      return client.ticket.showTicket({ ticketId: ticket.id! });
    },
    exchangeTicket: function (ticket: Ticket): Promise<AccessToken> {
      return client.accessToken
        .exchangeTicket({
          ticketId: ticket.id!,
        }) as unknown as Promise<AccessToken>;
    },
  };

  return authorizeAccessToken(provider);
}

async function resolveTarget(
  account: AccountToken,
  target: PublishRecord,
) {
  const client = new NetlifyClient({
    TOKEN: account.token,
  });
  const site = await client.site.getSite({ siteId: target.id });
  if (site?.url) {
    target.url = site.url;
  }
  return target;
}

async function publish(
  _outputDir: string,
  account: AccountToken,
  target?: PublishRecord,
) {
  const client = new NetlifyClient({
    TOKEN: account.token,
  });

  const sites = await client.site.listSites({});

  console.log("publish completed");

  return target!;
}

function isUnauthorized(err: Error) {
  return err instanceof ApiError && err.status === 401;
}
