/*
* account.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { info } from "log/mod.ts";
import { Checkbox, prompt, Select, SelectOption } from "cliffy/prompt/mod.ts";

import {
  AccountToken,
  AccountTokenType,
  findProvider,
  kPublishProviders,
  PublishProvider,
} from "../../publish/provider.ts";

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

interface ProviderAccountToken extends AccountToken {
  provider: string;
}

export async function manageAccounts() {
  // build a list of all authorized accounts
  const accounts: ProviderAccountToken[] = [];
  for (const provider of kPublishProviders) {
    for (const account of await provider.accountTokens()) {
      if (account.type === AccountTokenType.Authorized) {
        accounts.push({ provider: provider.name, ...account });
      }
    }
  }

  // if we don't have any then exit
  if (accounts.length === 0) {
    info("No publishing accounts currently authorized.");
    throw new Error();
  }

  // create a checked list from which accounts can be removed
  const keepAccounts = await Checkbox.prompt({
    message: "Manage Publishing Accounts",
    options: accounts.map((account) => ({
      name: `${findProvider(account.provider)?.description}: ${account.name}${
        account.server ? " (" + account.server + ")" : ""
      }`,
      value: JSON.stringify(account),
      checked: true,
    })),
    hint:
      "Use the arrow keys and spacebar to specify accounts you would like to remove.\n" +
      "   Press Enter to confirm the list of accounts you wish to remain available.",
  });

  // figure out which accounts we should be removing
  const removeAccounts: ProviderAccountToken[] = [];
  for (const account of accounts) {
    if (
      !keepAccounts.find((keepAccountJson) => {
        const keepAccount = JSON.parse(keepAccountJson) as ProviderAccountToken;
        return account.provider == keepAccount.provider &&
          account.name == keepAccount.name &&
          account.server == keepAccount.server;
      })
    ) {
      info(
        `Removing ${findProvider(account.provider)
          ?.description} account ${account.name}`,
      );
      removeAccounts.push(account);
    }
  }

  // remove them
  for (const account of removeAccounts) {
    const provider = findProvider(account.provider);
    provider?.removeToken(account);
  }
}
