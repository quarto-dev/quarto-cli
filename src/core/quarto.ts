/*
 * env.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */
import { existsSync } from "fs/exists.ts";
import { extname, join } from "path/mod.ts";
import { info } from "log/mod.ts";
import * as colors from "fmt/colors.ts";
import { load as config, LoadOptions as ConfigOptions } from "dotenv/mod.ts";

import { getenv } from "./env.ts";
import { exitWithCleanup } from "./cleanup.ts";
import { onActiveProfileChanged } from "../project/project-profile.ts";
import { onDotenvChanged } from "../quarto-core/dotenv.ts";
import { normalizePath } from "./path.ts";
import { buildQuartoPreviewJs } from "./previewjs.ts";

export const kLocalDevelopment = "99.9.9";

export interface QuartoConfig {
  binPath(): string;
  sharePath(): string;
  isDebug(): boolean;
}

let dotenvConfig: Record<string, string>;

export const quartoConfig = {
  binPath: () => getenv("QUARTO_BIN_PATH"),
  toolsPath: () => join(getenv("QUARTO_BIN_PATH"), "tools"),
  sharePath: () => getenv("QUARTO_SHARE_PATH"),
  isDebug: () => getenv("QUARTO_DEBUG", "false") === "true",
  version: () => {
    const forceVersion = getenv("QUARTO_FORCE_VERSION", "");
    if (forceVersion !== "") {
      return forceVersion;
    }
    const versionPath = join(getenv("QUARTO_SHARE_PATH"), "version");
    if (existsSync(versionPath)) {
      return Deno.readTextFileSync(versionPath);
    } else {
      return kLocalDevelopment;
    }
  },
  dotenv: async (): Promise<Record<string, string>> => {
    if (!dotenvConfig) {
      const options: ConfigOptions = {
        defaultsPath: join(quartoConfig.sharePath(), "env", "env.defaults"),
      };
      if (quartoConfig.isDebug()) {
        options.envPath = join(quartoConfig.sharePath(), "..", "..", ".env");
      } else {
        options.envPath = options.defaultsPath;
      }
      dotenvConfig = await config(options);
    }
    return dotenvConfig;
  },
};

export function previewEnsureResources(cleanup?: VoidFunction) {
  if (quartoConfig.isDebug()) {
    buildPreviewJs(quartoSrcDir(), cleanup);
  }
}

export function previewMonitorResources(cleanup?: VoidFunction) {
  // active profile changed
  onActiveProfileChanged(() => {
    terminatePreview("active profile changed", cleanup);
  });
  // dotenv changed
  onDotenvChanged(() => {
    terminatePreview("environment variables changed", cleanup);
  });

  // dev mode only
  if (quartoConfig.isDebug()) {
    // src code change
    const srcDir = quartoSrcDir();
    const watcher = Deno.watchFs([srcDir], { recursive: true });
    const watchForChanges = async () => {
      for await (const event of watcher) {
        if (
          event.paths.some((path) =>
            extname(path).toLowerCase().startsWith(".ts")
          )
        ) {
          terminatePreview("quarto src code changed", cleanup);
        }
      }
    };
    watchForChanges();
  }
}

function terminatePreview(reason: string, cleanup?: VoidFunction) {
  info(
    colors.bold(
      colors.blue(`\n${reason}: preview terminating\n`),
    ),
  );
  if (cleanup) {
    cleanup();
  }
  exitWithCleanup(1);
}

function quartoSrcDir() {
  return normalizePath(join(quartoConfig.binPath(), "../../../src"));
}

function buildPreviewJs(srcDir: string, cleanup?: VoidFunction) {
  const output = buildQuartoPreviewJs(srcDir);
  if (!output.success) {
    terminatePreview("Error building quarto-preview.js", cleanup);
  }
}
