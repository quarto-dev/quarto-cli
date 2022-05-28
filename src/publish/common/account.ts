/*
* account.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { ensureDirSync, existsSync } from "fs/mod.ts";
import { join } from "path/mod.ts";
import { quartoDataDir } from "../../core/appdirs.ts";
import { isWindows } from "../../core/platform.ts";
import { openUrl } from "../../core/shell.ts";
import { sleep } from "../../core/wait.ts";

export interface AuthorizationHandler<Token, Ticket> {
  name: string;
  createTicket: () => Promise<Ticket>;
  authorizationUrl: (ticket: Ticket) => string;
  checkTicket: (ticket: Ticket) => Promise<Ticket>;
  exchangeTicket: (ticket: Ticket) => Promise<Token>;
}

export async function authorizeAccessToken<
  Token,
  Ticket extends { id?: string; authorized?: boolean },
>(handler: AuthorizationHandler<Token, Ticket>): Promise<
  Token | undefined
> {
  // create ticket for authorization
  const ticket = await handler.createTicket() as unknown as Ticket;
  await openUrl(handler.authorizationUrl(ticket));

  // poll for ticket to be authoried
  let authorizedTicket: Ticket | undefined;
  const checkTicket = async () => {
    const t = await handler.checkTicket(ticket);
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
    const accessToken = await handler.exchangeTicket(authorizedTicket);

    // save the token
    writeAccessToken<Token>(handler.name, accessToken);

    // return it
    return accessToken;
  } else {
    return undefined;
  }
}

export function readAccessToken<T>(provider: string): T | undefined {
  const tokenPath = accessTokenPath(provider);
  if (existsSync(tokenPath)) {
    const token = JSON.parse(Deno.readTextFileSync(tokenPath)) as T;
    return token;
  } else {
    return undefined;
  }
}

export function writeAccessToken<T>(provider: string, token: T) {
  // write token
  const tokenPath = accessTokenPath(provider);
  Deno.writeTextFileSync(
    tokenPath,
    JSON.stringify(token, undefined, 2),
  );
  // set file permissions
  if (!isWindows()) {
    Deno.chmod(tokenPath, 0o600);
  }
}

function accessTokenPath(provider: string) {
  const dir = join(accountsDataDir(), provider);
  ensureDirSync(dir);
  return join(dir, "account.json");
}

function accountsDataDir() {
  return quartoDataDir("accounts");
}
