/*
* format-aliases.ts
*
* handles format alias names
*
* Copyright (C) 2021 by RStudio, PBC
*
*/

import { readYaml } from "../yaml.ts";
import { resourcePath } from "../resources.ts";
import { join } from "path/mod.ts";
import { expandAliasesFrom } from "../lib/yaml-validation/schema.ts";

// deno-lint-ignore no-explicit-any
let formatAliases: any = undefined;

export function getFormatAliases(): Record<string, string[]> {
  if (formatAliases !== undefined) {
    return formatAliases;
  }
  // deno-lint-ignore no-explicit-any
  formatAliases =
    (readYaml(join(resourcePath(), "schema/format-aliases.yml")) as Record<
      string,
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
