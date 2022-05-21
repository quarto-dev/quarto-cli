/*
* accounts.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { join } from "path/mod.ts";
import { ensureDirSync, existsSync } from "fs/mod.ts";

import { quartoDataDir } from "../../core/appdirs.ts";

import { AccessToken, NetlifyClient, Ticket } from "./api/index.ts";
import { quartoConfig } from "../../core/quarto.ts";
import { openUrl } from "../../core/shell.ts";
import { sleep } from "../../core/wait.ts";

export const kNetlifyAuthTokenVar = "NETLIFY_AUTH_TOKEN";

export function netlifyEnvironmentAuthToken() {
  return Deno.env.get(kNetlifyAuthTokenVar);
}

export function netlifyAccessToken(): AccessToken | undefined {
  const tokenPath = netlifyAccessTokenPath();
  if (existsSync(tokenPath)) {
    const token = JSON.parse(Deno.readTextFileSync(tokenPath)) as AccessToken;
    return token;
  } else {
    return undefined;
  }
}

export async function authorizeNetlifyAccessToken(): Promise<
  AccessToken | undefined
> {
  // create ticket for authorization
  const client = new NetlifyClient({});
  const clientId = (await quartoConfig.dotenv())["NETLIFY_APP_CLIENT_ID"];
  const ticket = await client.ticket.createTicket({
    clientId,
  }) as unknown as Ticket;
  await openUrl(
    `https://app.netlify.com/authorize?response_type=ticket&ticket=${ticket.id}`,
  );

  // poll for ticket to be authoried
  let authorizedTicket: Ticket | undefined;
  const checkTicket = async () => {
    const t = await client.ticket.showTicket({ ticketId: ticket.id! });
    if (t.authorized) {
      authorizedTicket = t;
    }
    return Boolean(t.authorized);
  };
  const pollingStart = Date.now();
  const kPollingTimeout = 60 * 1000;
  const kPollingInterval = 500;
  while ((Date.now() - pollingStart) < kPollingTimeout) {
    if (await checkTicket()) {
      break;
    }
    await sleep(kPollingInterval);
  }
  if (authorizedTicket) {
    // exechange ticket for the token
    const accessToken = await client.accessToken
      .exchangeTicket({
        ticketId: authorizedTicket!.id!,
      }) as unknown as AccessToken;

    // save the token
    writeNetlifyAccessToken(accessToken);

    // return it
    return accessToken;
  } else {
    return undefined;
  }
}

function writeNetlifyAccessToken(token: AccessToken) {
  Deno.writeTextFileSync(
    netlifyAccessTokenPath(),
    JSON.stringify(token, undefined, 2),
  );
}

function accountsDataDir() {
  return quartoDataDir("accounts");
}

function netlifyAccessTokenPath() {
  const dir = join(accountsDataDir(), "netlify");
  ensureDirSync(dir);
  return join(dir, "account.json");
}
