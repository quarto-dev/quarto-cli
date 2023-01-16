/*
* format-aliases.ts
*
* handles format alias names
*
* Copyright (C) 2021-2022 Posit Software, PBC
*
*/

import { expandAliasesFrom } from "../yaml-validation/schema.ts";
import { getYamlIntelligenceResource } from "../yaml-intelligence/resources.ts";

// deno-lint-ignore no-explicit-any
let formatAliases: any = undefined;

export function getFormatAliases(): Record<string, string[]> {
  if (formatAliases !== undefined) {
    return formatAliases;
  }
  formatAliases =
    (getYamlIntelligenceResource("schema/format-aliases.yml") as Record<
      string,
      // deno-lint-ignore no-explicit-any
      any
    >).aliases;
  return formatAliases as Record<string, string[]>;
}

export function getExpandedFormatAliases(): Record<string, string[]> {
  const aliases = getFormatAliases();
  const result: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(aliases)) {
    result[key] = expandFormatAliases(value as string[]);
  }
  return result as Record<string, string[]>;
}

export function expandFormatAliases(lst: string[]) {
  return expandAliasesFrom(lst, getFormatAliases());
}
