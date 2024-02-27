/*
 * qmd.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { extname } from "../deno_ral/path.ts";
import { kQmdExtensions } from "./types.ts";

export function isQmdFile(file: string) {
  const ext = extname(file);
  return kQmdExtensions.includes(ext);
}
