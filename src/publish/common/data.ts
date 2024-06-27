/*
 * data.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { ensureDirSync, existsSync } from "fs/mod.ts";
import { join } from "../../deno_ral/path.ts";

import { quartoDataDir } from "../../core/appdirs.ts";
import { normalizePath } from "../../core/path.ts";
import { ProjectContext } from "../../project/types.ts";
import { AccountToken, PublishProvider } from "../provider-types.ts";
import { PublishRecord } from "../types.ts";

export function publishDataDir() {
  return quartoDataDir("publish");
}

export function publishRecordsPath() {
  return join(publishDataDir(), "records.json");
}

export function accountsDataDir() {
  const accountsDir = join(publishDataDir(), "accounts");
  ensureDirSync(accountsDir);
  return accountsDir;
}

export async function readAccountsPublishedTo(
  input: string | ProjectContext,
  provider: PublishProvider,
  record: PublishRecord,
): Promise<AccountToken[]> {
  const source = normalizePath(
    typeof (input) === "string" ? input : input.dir,
  );
  const tokens: AccountToken[] = [];
  const publishRecordsFile = publishRecordsPath();
  if (existsSync(publishRecordsFile)) {
    const records = JSON.parse(
      Deno.readTextFileSync(publishRecordsFile),
    ) as PublishRecords;
    if (records[source] && records[source][provider.name]) {
      // see if we can associate registered accounts w/ the publish target accounts
      const publishIdentifiers = records[source][provider.name];
      const accounts = await provider.accountTokens();
      for (const publishIdentifier of publishIdentifiers) {
        const account = accounts.find((account) =>
          publishIdentifier === publishRecordIdentifier(record, account)
        );
        if (account) {
          tokens.push(account);
        }
      }
    }
  }
  return tokens;
}

export function writePublishRecord(
  source: string,
  provider: string,
  account: AccountToken,
  record: PublishRecord,
) {
  // resolve to real path
  source = normalizePath(source);

  // write a record of which account was was used to publish
  // in a sidecar list so that we can pair it for republish
  const publishRecordsFile = publishRecordsPath();
  const publishRecords =
    (existsSync(publishRecordsFile)
      ? JSON.parse(Deno.readTextFileSync(publishRecordsFile))
      : {}) as PublishRecords;
  if (!publishRecords[source]) {
    publishRecords[source] = {
      [provider]: [],
    };
  }
  if (!publishRecords[source][provider]) {
    publishRecords[source][provider] = [];
  }
  const publishedTo = publishRecordIdentifier(record, account);
  if (!publishRecords[source][provider].includes(publishedTo)) {
    publishRecords[source][provider].push(publishedTo);
  }
  Deno.writeTextFileSync(
    publishRecordsFile,
    JSON.stringify(publishRecords, undefined, 2),
  );
}

type PublishRecords = Record<string, Record<string, string[]>>;

export function publishRecordIdentifier(
  record: PublishRecord,
  account?: AccountToken,
) {
  return `${record.id}/${account?.server ? account.server + "/" : ""}${
    account
      ?.name || ""
  }`;
}
