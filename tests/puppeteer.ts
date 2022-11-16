/*
* ojs-runs.ts
*
* puppeteer testing utils
*
* Copyright (C) 2021-2022 Posit Software, PBC
*
*/

import { join } from "path/mod.ts";

export function localFileURL(path: string) {
  const match = path.match(/^(.+)\.[^.]+$/)!;
  const base = match[1];
  return `file://${join(Deno.cwd(), base)}.html`;
}
