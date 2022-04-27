/*
* env.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import { existsSync } from "fs/exists.ts";
import { join } from "path/mod.ts";
import { info } from "log/mod.ts";

import { getenv } from "./env.ts";
import { logError } from "./log.ts";

export const kLocalDevelopment = "99.9.9";

export interface QuartoConfig {
  binPath(): string;
  sharePath(): string;
  isDebug(): boolean;
}

export const quartoConfig = {
  binPath: () => getenv("QUARTO_BIN_PATH"),
  toolsPath: () => join(getenv("QUARTO_BIN_PATH"), "tools"),
  sharePath: () => getenv("QUARTO_SHARE_PATH"),
  isDebug: () => getenv("QUARTO_DEBUG", "false") === "true",
  version: () => {
    const versionPath = join(getenv("QUARTO_SHARE_PATH"), "version");
    if (existsSync(versionPath)) {
      return Deno.readTextFileSync(versionPath);
    } else {
      return kLocalDevelopment;
    }
  },
};

export function monitorQuartoSrcChanges(cleanup: VoidFunction) {
  if (quartoConfig.isDebug()) {
    const srcDir = Deno.realPathSync(
      join(quartoConfig.binPath(), "../../../src"),
    );
    const watcher = Deno.watchFs([srcDir], { recursive: true });
    const watchForChanges = async () => {
      for await (const _event of watcher) {
        try {
          info("quarto src code changed: preview terminating");
        } catch (e) {
          logError(e);
        } finally {
          cleanup();
          Deno.exit(1);
        }
      }
    };
    watchForChanges();
  }
}
