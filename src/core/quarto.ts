/*
* env.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import { existsSync } from "fs/exists.ts";
import { extname, join } from "path/mod.ts";
import { info } from "log/mod.ts";
import * as colors from "fmt/colors.ts";
import { config, ConfigOptions, DotenvConfig } from "dotenv/mod.ts";

import { getenv } from "./env.ts";
import { exitWithCleanup } from "./cleanup.ts";

export const kLocalDevelopment = "99.9.9";

export interface QuartoConfig {
  binPath(): string;
  sharePath(): string;
  isDebug(): boolean;
}

let dotenvConfig: DotenvConfig;

export const quartoConfig = {
  rootPath: () => getenv("QUARTO_ROOT"),
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
  dotenv: async (): Promise<DotenvConfig> => {
    if (!dotenvConfig) {
      const options: ConfigOptions = {
        defaults: join(quartoConfig.sharePath(), "env", "env.defaults"),
      };
      if (quartoConfig.isDebug()) {
        options.path = join(quartoConfig.sharePath(), "..", "..", ".env");
      } else {
        options.path = options.defaults;
      }
      dotenvConfig = await config(options);
    }
    return dotenvConfig;
  },
};

export function monitorQuartoSrcChanges(cleanup?: VoidFunction) {
  if (quartoConfig.isDebug()) {
    const srcDir = Deno.realPathSync(
      join(quartoConfig.binPath(), "../../../src"),
    );
    const watcher = Deno.watchFs([srcDir], { recursive: true });
    const watchForChanges = async () => {
      for await (const event of watcher) {
        if (event.paths.some((path) => extname(path).toLowerCase() === ".ts")) {
          info(
            colors.bold(
              colors.blue("\nquarto src code changed: preview terminating\n"),
            ),
          );

          if (cleanup) {
            cleanup();
          }
          exitWithCleanup(1);
        }
      }
    };
    watchForChanges();
  }
}
