/*
* dependencies.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import { dirname, join, SEP } from "path/mod.ts";
import { ensureDirSync, existsSync } from "fs/mod.ts";
import { info, warning } from "log/mod.ts";

import { execProcess } from "../../../src/core/process.ts";
import { expandPath } from "../../../src/core/path.ts";
import {
  createDevConfig,
  writeDevConfig,
} from "../../../src/core/devconfig.ts";

import { Configuration } from "./config.ts";
import {
  Dependency,
  kDependencies,
  PlatformDependency,
} from "./dependencies/dependencies.ts";
import { archiveUrl } from "./archive-binary-dependencies.ts";

export async function configure(
  config: Configuration,
) {
  info("Configuring local machine for development");

  // Download dependencies
  info("Downloading dependencies");
  for (const dependency of kDependencies) {
    info(`Preparing ${dependency.name}`);
    const platformDep = dependency[Deno.build.os];
    if (platformDep) {
      info(`Downloading ${dependency.name}`);
      const targetFile = await downloadBinaryDependency(
        dependency,
        platformDep,
        config,
      );

      info(`Configuring ${dependency.name}`);
      await platformDep.configure(targetFile);

      info(`Cleaning up`);
      Deno.removeSync(targetFile);
    }
    info(`${dependency.name} complete.\n`);
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

  // record dev config
  const devConfig = createDevConfig(
    Deno.env.get("DENO") || "",
    Deno.env.get("DENO_DOM") || "",
    Deno.env.get("PANDOC") || "",
    Deno.env.get("DARTSASS") || "",
    Deno.env.get("ESBUILD") || "",
    config.directoryInfo.bin,
  );
  writeDevConfig(devConfig, config.directoryInfo.bin);

  // Set up a symlink (if appropriate)
  const symlinkPaths = ["/usr/local/bin/quarto", expandPath("~/bin/quarto")];

  if (Deno.build.os !== "windows") {
    info("Creating Quarto Symlink");
    for (let i = 0; i < symlinkPaths.length; i++) {
      const symlinkPath = symlinkPaths[i];
      info(`> Trying ${symlinkPath}`);
      try {
        if (existsSync(symlinkPath)) {
          Deno.removeSync(symlinkPath);
        }
      } catch (error) {
        info(error);
        info(
          "\n> Failed to remove existing symlink.\n> Did you previously install with sudo? Run 'which quarto' to test which version will be used.",
        );
      }
      try {
        // for the last path, try even creating a directory as a last ditch effort
        if (i === symlinkPaths.length - 1) {
          // append path separator to resolve the dir name (in case it's a symlink)
          ensureDirSync(dirname(symlinkPath) + SEP);
        }
        Deno.symlinkSync(
          join(config.directoryInfo.bin, "quarto"),
          symlinkPath,
        );

        info("> Success");
        // it worked, just move on
        break;
      } catch (_error) {
        // NOTE: printing this error makes the user think that something went wrong when it didn't
        // info(error);
        // none of them worked!
        if (i === symlinkPaths.length - 1) {
          warning("Failed to create symlink to quarto.");
        } else {
          info("> Failed");
        }
      }
    }
  }
}

async function downloadBinaryDependency(
  dependency: Dependency,
  platformDependency: PlatformDependency,
  configuration: Configuration,
) {
  const targetFile = join(
    configuration.directoryInfo.bin,
    platformDependency.filename,
  );
  const dlUrl = archiveUrl(dependency, platformDependency);

  info("Downloading " + dlUrl);
  info("to " + targetFile);
  const response = await fetch(dlUrl);
  const blob = await response.blob();

  const bytes = await blob.arrayBuffer();
  const data = new Uint8Array(bytes);

  Deno.writeFileSync(
    targetFile,
    data,
  );
  return targetFile;
}

// note that this didn't actually work on windows (it froze and then deno was
// inoperable on the machine until reboot!) so we moved it to script/batch
// files on both platforms)
// deno-lint-ignore no-unused-vars
async function downloadDenoStdLibrary(config: Configuration) {
  const denoBinary = join(config.directoryInfo.bin, "deno");
  const denoStdTs = join(
    config.directoryInfo.pkg,
    "scripts",
    "deno_std",
    "deno_std.ts",
  );

  const denoCacheLock = join(
    config.directoryInfo.pkg,
    "scripts",
    "deno_std",
    "deno_std.lock",
  );
  const denoCacheDir = join(
    config.directoryInfo.src,
    "resources",
    "deno_std",
    "cache",
  );
  ensureDirSync(denoCacheDir);

  info("Updating Deno Stdlib");
  info("");
  await execProcess({
    cmd: [
      denoBinary,
      "cache",
      "--unstable",
      "--lock",
      denoCacheLock,
      denoStdTs,
    ],
    env: {
      DENO_DIR: denoCacheDir,
    },
  });
}
