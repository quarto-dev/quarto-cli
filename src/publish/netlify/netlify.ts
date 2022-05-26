/*
* netlify.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { info, warning } from "log/mod.ts";

import { walkSync } from "fs/mod.ts";
import { join, relative } from "path/mod.ts";
import { crypto } from "crypto/mod.ts";
import { encode as hexEncode } from "encoding/hex.ts";

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
import { sleep } from "../../core/wait.ts";
import { completeMessage, withSpinner } from "../../core/console.ts";
import { fileProgress } from "../../core/progress.ts";

// TODO: retry on upload
//  (https://github.com/netlify/js-client/blob/960089a289288233bd2a17fcbd8ab4730ca49135/src/deploy/upload-files.js#L70)
//  https://deno.land/x/retried@1.0.1/mod.ts
// TODO: team sites
// TODO: docuents

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

async function publish(
  account: AccountToken,
  render: (siteDir: string) => Promise<string>,
  target?: PublishRecord,
): Promise<[PublishRecord, URL]> {
  // create client
  const client = new NetlifyClient({
    TOKEN: account.token,
  });

  // determine target (create new site if necessary)
  info("");
  if (!target?.id) {
    await withSpinner({
      message: "Creating Netlify site",
    }, async () => {
      const site = await client.site.createSite({
        site: {
          force_ssl: true,
        },
      }) as unknown as Site;
      target = {
        id: site.id!,
        url: site.ssl_url || site.url!,
      };
    });
  }
  target = target!;

  // render
  const outputDir = await render(target.url);

  // build file list
  let siteDeploy: Deploy | undefined;
  const files: Array<[string, string]> = [];
  await withSpinner({
    message: "Preparing to publish site",
  }, async () => {
    const textDecoder = new TextDecoder();
    for (const walk of walkSync(outputDir)) {
      if (walk.isFile) {
        const path = relative(outputDir, walk.path);
        const sha1 = await crypto.subtle.digest(
          "SHA-1",
          Deno.readFileSync(walk.path),
        );
        const encodedSha1 = hexEncode(new Uint8Array(sha1));
        files.push([path, textDecoder.decode(encodedSha1)]);
      }
    }

    // create deploy
    const deploy = {
      files: {} as Record<string, string>,
      async: true,
    };
    for (const file of files) {
      deploy.files[`/${file[0]}`] = file[1];
    }
    siteDeploy = await client.deploy.createSiteDeploy({
      siteId: target!.id,
      deploy,
    });

    // wait for it to be ready
    while (true) {
      siteDeploy = await client.deploy.getDeploy({
        deployId: siteDeploy?.id!,
      });
      if (siteDeploy.state === "prepared") {
        if (!siteDeploy.required) {
          throw new Error(
            "Site deploy prepared but no required files provided",
          );
        }
        break;
      }
      await sleep(250);
    }
  });

  // compute required files
  const required = siteDeploy?.required!.map((sha1) => {
    const file = files.find((file) => file[1] === sha1);
    return file ? file[0] : null;
  }).filter((file) => file) as string[];

  // upload with progress
  const progress = fileProgress(required);
  await withSpinner({
    message: () => `Uploading files ${progress.status()}`,
    doneMessage: false,
  }, async () => {
    for (const requiredFile of required) {
      const filePath = join(outputDir, requiredFile);
      const fileArray = Deno.readFileSync(filePath);
      await client.file.uploadDeployFile({
        deployId: siteDeploy?.id!,
        path: requiredFile,
        fileBody: new Blob([fileArray.buffer]),
      });
      progress.next();
    }
  });
  completeMessage(`Uploading files (complete)`);

  // wait on ready
  let adminUrl = target.url;
  await withSpinner({
    message: "Deploying published site",
  }, async () => {
    while (true) {
      const deployReady = await client.deploy.getDeploy({
        deployId: siteDeploy?.id!,
      });
      if (deployReady.state === "ready") {
        adminUrl = deployReady.admin_url || adminUrl;
        break;
      }
      await sleep(500);
    }
  });

  completeMessage(`Published: ${target.url}\n`);

  return [target, new URL(adminUrl)];
}

function isUnauthorized(err: Error) {
  return err instanceof ApiError && err.status === 401;
}

function isNotFound(err: Error) {
  return err instanceof ApiError && err.status === 404;
}
