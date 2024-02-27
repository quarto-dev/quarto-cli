/*
* account.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/

import { ensureDirSync, existsSync } from "fs/mod.ts";
import { join } from "../../deno_ral/path.ts";
import { info } from "../../deno_ral/log.ts";
import * as colors from "fmt/colors.ts";
import { isServerSession, isWindows } from "../../core/platform.ts";
import { openUrl } from "../../core/shell.ts";
import { sleep } from "../../core/wait.ts";
import { accountsDataDir } from "./data.ts";

export interface AuthorizationHandler<Token, Ticket> {
  name: string;
  createTicket: () => Promise<Ticket>;
  authorizationUrl: (ticket: Ticket) => string;
  checkTicket: (ticket: Ticket) => Promise<Ticket>;
  exchangeTicket: (ticket: Ticket) => Promise<Token>;
  compareTokens?: (a: Token, b: Token) => boolean;
}

export async function authorizeAccessToken<
  Token,
  Ticket extends { id?: string; authorized?: boolean },
>(handler: AuthorizationHandler<Token, Ticket>): Promise<
  Token | undefined
> {
  // create ticket for authorization
  const ticket = await handler.createTicket() as unknown as Ticket;
  const ticketUrl = handler.authorizationUrl(ticket);
  if (isServerSession()) {
    info(
      "Please authorize by opening this url: " + colors.underline(ticketUrl),
    );
  } else {
    await openUrl(handler.authorizationUrl(ticket));
  }

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
    writeAccessToken<Token>(handler.name, accessToken, handler.compareTokens);

    // return it
    return accessToken;
  } else {
    return undefined;
  }
}

export function readAccessTokens<T>(
  provider: string,
): Array<T> | undefined {
  const tokenPath = accessTokensPath(provider);
  if (existsSync(tokenPath)) {
    const tokens = JSON.parse(Deno.readTextFileSync(tokenPath)) as Array<T>;
    return tokens;
  } else {
    return undefined;
  }
}

export function writeAccessTokens<T>(
  provider: string,
  tokens: Array<T>,
) {
  // write tokens
  const tokensPath = accessTokensPath(provider);
  Deno.writeTextFileSync(
    tokensPath,
    JSON.stringify(tokens, undefined, 2),
  );

  // set file permissions
  if (!isWindows()) {
    Deno.chmod(tokensPath, 0o600);
  }
}

export function writeAccessToken<T>(
  provider: string,
  token: T,
  compareTokens?: (a: T, b: T) => boolean,
) {
  let writeTokens: Array<T> | undefined;

  // read existing tokens (if any)
  writeTokens = readAccessTokens<T>(provider) || [] as Array<T>;

  // update or add new
  if (compareTokens) {
    const updateIdx = writeTokens.findIndex((t) => compareTokens(t, token));
    if (updateIdx !== -1) {
      writeTokens[updateIdx] = token;
    } else {
      writeTokens.push(token);
    }
  } else {
    writeTokens = [token];
  }

  // write tokens
  writeAccessTokens(provider, writeTokens);
}

export function accessTokensPath(provider: string) {
  const dir = join(accountsDataDir(), provider);
  ensureDirSync(dir);
  return join(dir, "accounts.json");
}
