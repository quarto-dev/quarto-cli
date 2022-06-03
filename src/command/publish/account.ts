/*
* account.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { prompt, Select, SelectOption } from "cliffy/prompt/mod.ts";

import { AccountToken, PublishProvider } from "../../publish/provider.ts";

export type AccountPrompt = "always" | "never" | "multiple";

export async function resolveAccount(
  provider: PublishProvider,
  prompt: AccountPrompt,
) {
  // see what tyep of token we are going to use
  let token: AccountToken | undefined;

  // build list of account options
  const accounts = await provider.accountTokens();

  // if we aren't prompting then we need to have one at the ready
  if (prompt === "never") {
    return accounts[0];
  } else if (prompt === "multiple" && accounts.length === 1) {
    return accounts[0];
  } else {
    // prompt for account to publish with
    if (accounts.length > 0) {
      token = await accountPrompt(provider, accounts);
    }

    // if we don't have a token yet we need to authorize
    if (!token) {
      token = await provider.authorizeToken();
    }

    return token;
  }
}

export async function accountPrompt(
  _provider: PublishProvider,
  accounts: AccountToken[],
): Promise<AccountToken | undefined> {
  const options: SelectOption[] = accounts.map((account) => ({
    name: account.name + (account.server ? ` (${account.server})` : ""),
    value: account.token,
  }));
  const kAuthorize = "authorize";
  options.push({
    name: "Use another account...",
    value: kAuthorize,
  });

  const result = await prompt([{
    indent: "",
    name: "token",
    message: `Account:`,
    options,
    type: Select,
  }]);
  if (result.token !== kAuthorize) {
    return accounts.find((account) => account.token === result.token);
  }
}
