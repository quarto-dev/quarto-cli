/*
 * dependencies.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */
import { dirname, join, SEP } from "path/mod.ts";
import { existsSync } from "fs/mod.ts";
import { ensureDirSync } from "fs/mod.ts";
import { info, warning } from "log/mod.ts";

import { expandPath } from "../../../src/core/path.ts";
import {
  createDevConfig,
  writeDevConfig,
} from "../../../src/core/devconfig.ts";

import { Configuration } from "./config.ts";
import {
  configureDependency,
  kDependencies,
} from "./dependencies/dependencies.ts";
import { suggestUserBinPaths } from "../../../src/core/env.ts";
import { buildQuartoPreviewJs } from "../../../src/core/previewjs.ts";

export async function configure(
  config: Configuration,
) {
  // Download dependencies
  for (const dependency of kDependencies) {
    try {
      const targetDir = join(
        config.directoryInfo.bin,
        "tools",
      );
      await configureDependency(dependency, targetDir, config);
    } catch (e) {
      if (
        e.message ===
          "The architecture aarch64 is missing the dependency deno_dom"
      ) {
        info("\nIgnoring deno_dom dependency on Apple Silicon");
        continue;
      } else {
        throw e;
      }
    }
  }

  info("Building quarto-preview.js...");
  const result = buildQuartoPreviewJs(config.directoryInfo.src);
  if (!result.success) {
    throw new Error();
  }
  info("Build completed.");

  // Move the quarto script into place
  info("Placing Quarto script");
  copyQuartoScript(config, config.directoryInfo.bin);

  info("Creating architecture specific Pandoc link");
  copyPandocScript(config, join(config.directoryInfo.bin, "tools"));

  // record dev config. These are versions as defined in the root configuration file.
  const devConfig = createDevConfig(
    Deno.env.get("DENO") || "",
    Deno.env.get("DENO_DOM") || "",
    Deno.env.get("PANDOC") || "",
    Deno.env.get("DARTSASS") || "",
    Deno.env.get("ESBUILD") || "",
    Deno.env.get("TYPST") || "",
    config.directoryInfo.bin,
  );
  writeDevConfig(devConfig, config.directoryInfo.bin);
  info("Wrote dev config to bin directory");

  if (
    config.os !== "windows" &&
    Deno.env.get("QUARTO_NO_SYMLINK") === undefined
  ) {
    info("Creating Quarto Symlink");

    // Set up a symlink (if appropriate)
    const possibleBinPaths = suggestUserBinPaths();
    const symlinksFiltered = possibleBinPaths.map((path) =>
      join(path, "quarto")
    );

    info(`Found ${symlinksFiltered.length} paths to try.`);

    if (symlinksFiltered.length > 0) {
      for (let i = 0; i < symlinksFiltered.length; i++) {
        info(`> Trying ${symlinksFiltered[i]}`);
        const symlinkPath = expandPath(symlinksFiltered[i]);

        // Remove existing symlink
        try {
          if (existsSync(symlinkPath)) {
            Deno.removeSync(symlinkPath);
          }
        } catch (error) {
          info(error);
          warning(
            "\n> Failed to remove existing symlink.\n> Did you previously install with sudo? Run 'which quarto' to test which version will be used.",
          );
        }

        // Create new symlink
        try {
          ensureDirSync(dirname(symlinkPath) + SEP);

          Deno.symlinkSync(
            join(config.directoryInfo.bin, "quarto"),
            symlinkPath,
          );

          info(`> Symlink created at ${symlinkPath}`);
          info("> Success");
          // it worked, just move on
          break;
        } catch (_error) {
          info(`> Didn't create symlink at ${symlinkPath}`);
          if (i === symlinksFiltered.length - 1) {
            warning(
              `\n> Please ensure that ${
                join(config.directoryInfo.bin, "quarto")
              } is in your path.`,
            );
          }
        }
      }
    } else {
      // Just warn the user and create a symlink in our last resort
      warning(
        `\n> Please ensure that ${
          join(config.directoryInfo.bin, "quarto")
        } is in your path.`,
      );
    }
  }
}

export function copyQuartoScript(config: Configuration, targetDir: string) {
  // Move the quarto script into place
  if (config.os === "windows") {
    Deno.copyFileSync(
      join(config.directoryInfo.pkg, "scripts", "windows", "quarto.cmd"),
      join(targetDir, "quarto.cmd"),
    );
  } else {
    const out = join(targetDir, "quarto");
    Deno.copyFileSync(
      join(config.directoryInfo.pkg, "scripts", "common", "quarto"),
      out,
    );
    Deno.chmodSync(out, 0o755);
  }
}

export function copyPandocScript(config: Configuration, targetDir: string) {
  const linkTarget = join(config.arch, "pandoc");
  
  const pandocFile = join(targetDir, "pandoc");
  if (existsSync(pandocFile)) {
    info("> removing existing pandoc link");
    Deno.removeSync(pandocFile);
  }

  if (Deno.build.os !== "windows") {
    info("> creating pandoc symlink");
    Deno.run({
      cwd: targetDir,
      cmd: ["ln", "-s", linkTarget, "pandoc"]
    });  
  }
}

export function copyPandocAliasScript(config: Configuration, toolsDir: string) {
    // Move the quarto script into place
    if (config.os === "darwin") {
      const out = join(toolsDir, "pandoc");
      Deno.copyFileSync(
        join(config.directoryInfo.pkg, "scripts", "macos", "pandoc"),
        out,
      );
      Deno.chmodSync(out, 0o755);
    } else if (config.os === "linux") {
      const out = join(toolsDir, "pandoc");
      Deno.copyFileSync(
        join(config.directoryInfo.pkg, "scripts", "linux", "pandoc"),
        out,
      );
      Deno.chmodSync(out, 0o755);
    }
}
