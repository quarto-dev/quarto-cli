/*
* resources.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { walkSync } from "fs/mod.ts";
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

export function formatResourcePath(format: string, resource: string) {
  return join(resourcePath("formats"), format, resource);
}

export function binaryPath(binary: string): string {
  const quartoPath = getenv("QUARTO_BIN_PATH");
  return join(quartoPath, binary);
}

export function rBinaryPath(binary: string): string {
  const rHome = Deno.env.get("R_HOME");
  if (rHome) {
    // If there is an R_HOME, respect that.
    return join(rHome, "bin", binary);
  } else if (Deno.build.os === "windows") {
    // On windows, try to find R in program files
    const progFiles = Deno.env.get("programfiles");
    if (progFiles) {
      // Search program files for the binary
      for (const entry of Deno.readDirSync(progFiles)) {
        if (entry.isDirectory && entry.name === "R") {
          // found the R directory, now walk to find bin directory
          for (const walk of walkSync(join(progFiles, "R"))) {
            if (walk.isDirectory && walk.name === "bin") {
              return join(walk.path, binary);
            }
          }
        }
      }
    }
  }

  // We couldn't find R, just pass the binary itself and hope its on the path!
  return binary;
}
