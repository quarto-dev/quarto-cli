/*
* dependencies.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import { dirname, join, SEP } from "path/mod.ts";
import { ensureDirSync, existsSync } from "fs/mod.ts";
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

export async function configure(
  config: Configuration,
) {
  info("");
  info("******************************************");
  info("Configuring local machine for development:");
  info(` - OS  : ${Deno.build.os}`);
  info(` - Arch: ${Deno.build.arch}`);
  info(` - Cwd : ${Deno.cwd()}`);
  info(` - Directory configuration:`);
  info(`   - Quarto package folder (build source): ${config.directoryInfo.pkg}`);
  info(`   - Quarto dist folder (output folder): ${config.directoryInfo.dist}`);
  info(`     - Quarto bin folder: ${config.directoryInfo.bin}`);
  info(`     - Quarto share folder: ${config.directoryInfo.share}`);
  info("");
  info("******************************************");
  info("");

  // Download dependencies
  for (const dependency of kDependencies) {
    await configureDependency(dependency, config);
  }

  // Move the quarto script into place
  info("Creating Quarto script");
  if (Deno.build.os === "windows") {
    Deno.copyFileSync(
      join(config.directoryInfo.pkg, "scripts", "windows", "quarto.cmd"),
      join(config.directoryInfo.bin, "quarto.cmd"),
    );
  } else {
    Deno.copyFileSync(
      join(config.directoryInfo.pkg, "scripts", "common", "quarto"),
      join(config.directoryInfo.bin, "quarto"),
    );
  }

  // record dev config. These are versions as defined in the root configuration file.
  const devConfig = createDevConfig(
    Deno.env.get("DENO") || "",
    Deno.env.get("DENO_DOM") || "",
    Deno.env.get("PANDOC") || "",
    Deno.env.get("DARTSASS") || "",
    Deno.env.get("ESBUILD") || "",
    config.directoryInfo.bin,
  );
  writeDevConfig(devConfig, config.directoryInfo.bin);
  info("Wrote dev config to bin directory");

  if (Deno.build.os !== "windows" && Deno.env.get("QUARTO_NO_SYMLINK") === undefined) {
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
