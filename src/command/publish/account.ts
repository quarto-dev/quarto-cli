/*
 * account.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { info } from "log/mod.ts";
import {
  Checkbox,
  prompt,
  Select,
  SelectOption,
} from "cliffy/prompt/mod.ts";

import {
  accountTokenText,
  findProvider,
  publishProviders,
} from "../../publish/provider.ts";
import {
  AccountToken,
  AccountTokenType,
  PublishProvider,
} from "../../publish/provider-types.ts";
import { PublishOptions, PublishRecord } from "../../publish/types.ts";

export type AccountPrompt = "always" | "never" | "multiple";

export async function resolveAccount(
  provider: PublishProvider,
  prompt: AccountPrompt,
  options: PublishOptions,
  hintAccount?: AccountToken,
  target?: PublishRecord,
) {
  // if the options provide a token then reflect that
  if (options.token) {
    // validate server
    if (provider.requiresServer && !options.server) {
      throw new Error(
        `You must provide the --server argument along with --token for ${provider.description}`,
      );
    }

    return {
      type: AccountTokenType.Authorized,
      name: provider.name,
      server: options.server ? options.server : null,
      token: options.token,
    };
  }

  // see what tyep of token we are going to use
  let token: AccountToken | undefined;

  // build list of account options
  let accounts = (await provider.accountTokens()).filter((account) => {
    if (account.server && target?.url) {
      return target.url.startsWith(account.server);
    } else {
      return true;
    }
  });

  // if we aren't prompting then we need to have one at the ready
  if (prompt === "never") {
    return accounts.length === 1 ? accounts[0] : undefined;
  } else if (prompt === "multiple" && accounts.length === 1) {
    return accounts[0];
  } else if (
    accounts.length === 1 && accounts[0].type === AccountTokenType.Anonymous
  ) {
    return accounts[0];
  } else {
    // prompt for account to publish with
    if (accounts.length > 0) {
      // order the hint account first
      if (hintAccount) {
        const hintIdx = accounts.findIndex((account) =>
          account.token === hintAccount.token
        );
        if (hintIdx !== -1) {
          const newAccounts = [accounts[hintIdx]];
          if (hintIdx > 0) {
            newAccounts.push(...accounts.slice(0, hintIdx));
          }
          if (hintIdx < (accounts.length - 1)) {
            newAccounts.push(...accounts.slice(hintIdx + 1));
          }

          accounts = newAccounts;
        }
      }

      token = await accountPrompt(provider, accounts);
    }

    // if we don't have a token yet we need to authorize
    if (!token) {
      token = await provider.authorizeToken(options, target);
    }

    return token;
  }
}

export async function accountPrompt(
  _provider: PublishProvider,
  accounts: AccountToken[],
): Promise<AccountToken | undefined> {
  const options: SelectOption[] = accounts
    .filter((account) => account.type !== AccountTokenType.Anonymous).map((
      account,
    ) => ({
      name: accountTokenText(account),
      value: account.token,
    }));
  const kAuthorize = "authorize";
  const accountDescriptor = _provider.accountDescriptor || "account";
  options.push({
    name: `Use another ${accountDescriptor}...`,
    value: kAuthorize,
  });

  const result = await prompt([{
    indent: "",
    name: "token",
    message: `Publish with ${accountDescriptor}:`,
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
  for (const provider of publishProviders()) {
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
      `Use the arrow keys and spacebar to specify accounts you would like to remove.\n` +
      `   Press Enter to confirm the list of accounts you wish to remain available.`,
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
