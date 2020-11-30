/*
* resources.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { join } from "path/mod.ts";
import { getenv } from "./env.ts";

export function resourcePath(resource?: string): string {
  const sharePath = getenv("QUARTO_SHARE_PATH");
  if (resource) {
    return join(sharePath, resource);
  } else {
    return sharePath;
  }
}

export function binaryPath(binary: string): string {
  const quartoPath = getenv("QUARTO_BIN_PATH");
  return join(quartoPath, binary);
}
