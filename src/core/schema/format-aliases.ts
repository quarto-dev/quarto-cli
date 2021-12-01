/*
* format-aliases.ts
*
* handles format alias names
*
* Copyright (C) 2021 by RStudio, PBC
*
*/

import { readYaml } from "../../core/yaml.ts";
import { resourcePath } from "../../core/resources.ts";
import { join } from "path/mod.ts";

let formatAliases: any = undefined;

export function getFormatAliases(): Record<string, string[]>
{
  if (formatAliases !== undefined) {
    return formatAliases;
  }
  formatAliases = (readYaml(join(resourcePath(), "schema/format-aliases.yml")) as Record<string, any>).aliases;
  return formatAliases as Record<string, string[]>;
}

export function getExpandedFormatAliases(): Record<string, string[]>
{
  const aliases = getFormatAliases();
  const result: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(aliases)) {
    result[key] = expandFormatAliases(value as string[]);
  }
  return result as Record<string, string[]>;
}

export function expandFormatAliases(lst: string[])
{
  const aliases = getFormatAliases();
  const result = [];
  
  lst = lst.slice();
  for (let i = 0; i < lst.length; ++i) {
    const el = lst[i];
    if (el.startsWith("$")) {
      lst.push(...aliases[el.slice(1)]);
    } else {
      result.push(el);
    }
  }
  return result;
}
