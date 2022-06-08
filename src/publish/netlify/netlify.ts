/*
* netlify.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { warning } from "log/mod.ts";

import {
  AccessToken,
  Deploy,
  NetlifyClient,
  Site,
  Ticket,
} from "./api/index.ts";

import {
  AccountToken,
  AccountTokenType,
  PublishFiles,
  PublishProvider,
} from "../provider.ts";
import { ApiError } from "../../publish/netlify/api/index.ts";
import { PublishRecord } from "../types.ts";
import {
  AuthorizationHandler,
  authorizeAccessToken,
  readAccessTokens,
  writeAccessTokens,
} from "../common/account.ts";
import { quartoConfig } from "../../core/quarto.ts";
import { withRetry } from "../../core/retry.ts";
import { handlePublish, PublishHandler } from "../common/publish.ts";
import { authorizePrompt } from "../account.ts";

export const kNetlify = "netlify";
const kNetlifyDescription = "Netlify";

export const kNetlifyAuthTokenVar = "NETLIFY_AUTH_TOKEN";

export const netlifyProvider: PublishProvider = {
  name: kNetlify,
  description: kNetlifyDescription,
  accountTokens,
  authorizeToken,
  removeToken,
  resolveTarget,
  publish,
  isUnauthorized,
};

function accountTokens() {
  const envTk = environmentAuthToken();
  const accessTkns = accessTokens();

  const accounts: AccountToken[] = [];
  if (envTk) {
    accounts.push({
      type: AccountTokenType.Environment,
      name: kNetlifyAuthTokenVar,
      server: null,
      token: envTk,
    });
  }
  if (accessTkns) {
    for (const accessTk of accessTkns) {
      if (accessTk?.access_token) {
        accounts.push({
          type: AccountTokenType.Authorized,
          name: accessTk.email!,
          server: null,
          token: accessTk?.access_token,
        });
      }
    }
  }

  return Promise.resolve(accounts);
}

async function authorizeToken() {
  if (await authorizePrompt(netlifyProvider)) {
    const token = await authorizeNetlifyAccessToken();
    if (token) {
      return {
        type: AccountTokenType.Authorized,
        name: token.email!,
        server: null,
        token: token.access_token!,
      };
    }
  } else {
    return undefined;
  }
}

function removeToken(token: AccountToken) {
  writeAccessTokens(
    netlifyProvider.name,
    readAccessTokens<AccessToken>(netlifyProvider.name)?.filter(
      (accessToken) => {
        return accessToken.email !== token.name;
      },
    ) || [],
  );
}

function environmentAuthToken() {
  return Deno.env.get(kNetlifyAuthTokenVar);
}

function accessTokens(): Array<AccessToken> | undefined {
  return readAccessTokens<AccessToken>(kNetlify);
}

async function authorizeNetlifyAccessToken(): Promise<
  AccessToken | undefined
> {
  // create provider for authorization
  const client = new NetlifyClient({});
  const clientId = (await quartoConfig.dotenv())["NETLIFY_APP_CLIENT_ID"];
  const handler: AuthorizationHandler<AccessToken, Ticket> = {
    name: kNetlifyDescription,
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

  return authorizeAccessToken(handler);
}

async function resolveTarget(
  account: AccountToken,
  target: PublishRecord,
) {
  try {
    const client = new NetlifyClient({
      TOKEN: account.token,
    });
    const site = await client.site.getSite({ siteId: target.id });
    target.url = site?.ssl_url || site?.url || target.url;
  } catch (err) {
    if (isNotFound(err)) {
      warning(
        `Site ${target.url} not found (you may need to remove it from the publish configuration)`,
      );
      return undefined;
    } else if (!isUnauthorized(err)) {
      throw err;
    }
  }

  return target;
}

function publish(
  account: AccountToken,
  type: "document" | "site",
  _title: string,
  render: (siteDir: string) => Promise<PublishFiles>,
  target?: PublishRecord,
): Promise<[PublishRecord, URL]> {
  // create client
  const client = new NetlifyClient({
    TOKEN: account.token,
  });

  const handler: PublishHandler<Site, Deploy> = {
    name: kNetlify,
    createSite: async () => {
      return withSslUrl(
        await client.site.createSite({
          site: {
            force_ssl: true,
          },
        }) as unknown as Site,
      );
    },
    createDeploy: async (siteId: string, files: Record<string, string>) => {
      return withSslUrl(
        await client.deploy.createSiteDeploy({
          siteId,
          deploy: {
            files,
            async: true,
          },
        }),
      );
    },
    getDeploy: async (deployId: string) => {
      return withSslUrl(
        await client.deploy.getDeploy({
          deployId,
        }),
      );
    },
    uploadDeployFile: async (
      deployId: string,
      path: string,
      fileBody: Blob,
    ) => {
      await withRetry(async () => {
        await client.file.uploadDeployFile({
          deployId,
          path,
          fileBody,
        });
      });
    },
  };

  return handlePublish<Site, Deploy>(handler, type, render, target);
}

function withSslUrl(obj: { ssl_url?: string; url?: string }) {
  return {
    ...obj,
    url: obj.ssl_url || obj.url,
  };
}

function isUnauthorized(err: Error) {
  return err instanceof ApiError && err.status === 401;
}

function isNotFound(err: Error) {
  return err instanceof ApiError && err.status === 404;
}
