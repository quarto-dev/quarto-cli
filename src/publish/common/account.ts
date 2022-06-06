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

export function readAccessToken<T>(
  provider: string,
): T | undefined {
  const tokens = readAccessTokens<T>(provider);
  if (tokens) {
    return tokens[0];
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

export function writeAccessToken<T>(
  provider: string,
  token: T,
  update?: (a: T, b: T) => boolean,
) {
  const tokensPath = accessTokensPath(provider);
  let writeTokens: Array<T> | undefined;

  if (update) {
    // read existing tokens (if any)
    writeTokens = readAccessTokens<T>(provider) || [] as Array<T>;

    // update or add new
    const updateIdx = writeTokens.findIndex((t) => update(t, token));
    if (updateIdx !== -1) {
      writeTokens[updateIdx] = token;
    } else {
      writeTokens.push(token);
    }
  } else {
    writeTokens = [token];
  }

  // write tokens
  Deno.writeTextFileSync(
    tokensPath,
    JSON.stringify([token], undefined, 2),
  );

  // set file permissions
  if (!isWindows()) {
    Deno.chmod(tokensPath, 0o600);
  }
}

export function accessTokensPath(provider: string) {
  const dir = join(accountsDataDir(), provider);
  ensureDirSync(dir);
  return join(dir, "accounts.json");
}

export function accountsDataDir() {
  return quartoDataDir("accounts");
}
