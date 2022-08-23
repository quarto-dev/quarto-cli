/*
* dependencies.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import { dirname, join, SEP } from "path/mod.ts";
import { ensureDirSync, existsSync } from "fs/mod.ts";
import { info, warning } from "log/mod.ts";

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
import { collapsePath } from "../../../src/core/path.ts";
import { isWindows } from "../../../src/core/platform.ts";

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
  // All platforms have quarto shell script. Only windows has .cmd script
  Deno.copyFileSync(
    join(config.directoryInfo.pkg, "scripts", "common", "quarto"),
    join(config.directoryInfo.bin, "quarto"),
  );
  if (Deno.build.os === "windows") {
    Deno.copyFileSync(
      join(config.directoryInfo.pkg, "scripts", "windows", "quarto.cmd"),
      join(config.directoryInfo.bin, "quarto.cmd"),
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

  if (Deno.env.get("QUARTO_NO_SYMLINK") === undefined) {
    info("Creating Quarto Symlink");

    // Set up a symlink (if appropriate)
    const possibleBinPaths = await suggestUserBinPaths();
    const symlinksFiltered = possibleBinPaths.map((path) =>
      join(path, "quarto")
    );

    info(`Found ${symlinksFiltered.length} paths to try.`);

    if (symlinksFiltered.length > 0) {
      for (let i = 0; i < symlinksFiltered.length; i++) {
        info(`> Trying ${collapsePath(symlinksFiltered[i])}`);
        let symlinkPath = symlinksFiltered[i];

        // Remove existing symlink
        try {
          if (existsSync(symlinkPath)) {
            Deno.removeSync(symlinkPath);
          }
          if (isWindows() && existsSync(symlinkPath + ".cmd")) {
            Deno.removeSync(symlinkPath + ".cmd");
          }
        } catch (error) {
          info(error);
          warning(
            "\n> Failed to remove existing symlink.\n> Did you previously install with sudo? Run 'which quarto' to test which version will be used.",
          );
        }

        let targetPath = join(config.directoryInfo.bin, "quarto")

        // Create new symlink
        try {
          ensureDirSync(dirname(symlinkPath) + SEP);

          if (Deno.build.os === "windows") {
            Deno.symlinkSync(
              targetPath,
              symlinkPath,
              {type: "file"},
            );
            Deno.symlinkSync(
              targetPath+".cmd",
              symlinkPath+".cmd",
              {type: "file"},
            );
          } else {
            Deno.symlinkSync(
              targetPath,
              symlinkPath,
            );
          }

          info(`> Symlink created at ${collapsePath(symlinkPath)}`);
          info("> Success");
          // it worked, just move on
          break;
        } catch (_error) {
          info(`> Didn't create symlink at ${collapsePath(symlinkPath)}`);
          info(`>    ${_error.message}`);
          if (i === symlinksFiltered.length - 1) {
            warning(
              `\n> No symlink on PATH could be created. Please ensure that the ${
                collapsePath(config.directoryInfo.bin)
              } folder is in your path.`,
            );

            if (Deno.build.os === "windows" && symlinksFiltered.length > 0) {
              warning(
                `
\n> You might be able to get symlinks working on Windows by enabling developer mode:
    https://docs.microsoft.com/en-us/windows/apps/get-started/enable-your-device-for-development`,
              );
            }
          }
        }
      }
    } else {
      warning(
        `
\n> No matching folders were found in your PATH.
    Please add one of the filtered folders mentioned above to PATH
    for Quarto to make a symlink there.
`,
      )
      // Just warn the user and create a symlink in our last resort
      warning(
        `
\n> Please ensure that the

    "${collapsePath(config.directoryInfo.bin)}"

    folder is in your PATH.
`,
      );
    }
  }
}
