/*
 * env.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */
import { existsSync } from "../deno_ral/fs.ts";
import { extname, join } from "../deno_ral/path.ts";
import { info } from "../deno_ral/log.ts";
import * as colors from "fmt/colors";
import { load as config, LoadOptions as ConfigOptions } from "dotenv";

import { getenv } from "./env.ts";
import { exitWithCleanup } from "./cleanup.ts";
import { onActiveProfileChanged } from "../project/project-profile.ts";
import { onDotenvChanged } from "../quarto-core/dotenv.ts";
import { normalizePath, safeExistsSync } from "./path.ts";
import { buildQuartoPreviewJs } from "./previewjs.ts";
import { isWindows } from "../deno_ral/platform.ts";

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
  cliPath: () => {
    // full path to quarto, quarto.cmd or quarto.exe depending on OS
    const binPath = quartoConfig.binPath();
    if (!isWindows) {
      return join(binPath, "quarto");
    }
    // WINDOWS
    const cliPath = join(binPath, "quarto.exe");
    if (safeExistsSync(cliPath)) {
      return cliPath;
    }
    // we are in dev mode were only quarto.cmd is available
    return join(binPath, "quarto.cmd");
  },
  dotenv: async (forceReload?: boolean): Promise<Record<string, string>> => {
    if (forceReload || !dotenvConfig) {
      const options: ConfigOptions = {
        defaultsPath: join(quartoConfig.sharePath(), "env", "env.defaults"),
        // On dev mode only (QUARTO_DEBUG='true'), we load the .env file in root quarto-cli project
        envPath: quartoConfig.isDebug()
          ? join(quartoConfig.sharePath(), "..", "..", ".env")
          : null,
        // we don't want any `.env.example` o be loaded, especially one from working dir
        // https://github.com/quarto-dev/quarto-cli/issues/9262
        examplePath: null,
      };
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
