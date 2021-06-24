/*
* dependencies.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import { join } from "path/mod.ts";
import { existsSync } from "fs/mod.ts";
import { info, warning } from "log/mod.ts";

import { expandPath } from "../../../src/core/path.ts";
import { Configuration } from "./config.ts";
import {
  kDependencies,
  PlatformDependency,
} from "./dependencies/dependencies.ts";

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
      const targetFile = await downloadBinaryDependency(platformDep, config);

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

  // Set up a symlink (if appropriate)
  const symlinkPaths = ["/usr/local/bin/quarto", expandPath("~/bin/quarto")];

  if (Deno.build.os !== "windows") {
    info("Creating Quarto Symlink");
    for (let i = 0; i < symlinkPaths.length; i++) {
      const symlinkPath = symlinkPaths[i];
      info(`> Trying ${symlinkPath}`);
      if (existsSync(symlinkPath)) {
        Deno.removeSync(symlinkPath);
      }

      try {
        Deno.symlinkSync(
          join(config.directoryInfo.bin, "quarto"),
          symlinkPath,
        );

        info("> Success");
        // it worked, just move on
        break;
      } catch (error) {
        info(error);
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
  dependency: PlatformDependency,
  configuration: Configuration,
) {
  const targetFile = join(configuration.directoryInfo.bin, dependency.filename);

  info("Downloading " + dependency.url);
  info("to " + targetFile);
  const response = await fetch(dependency.url);
  const blob = await response.blob();

  const bytes = await blob.arrayBuffer();
  const data = new Uint8Array(bytes);

  Deno.writeFileSync(
    targetFile,
    data,
  );
  return targetFile;
}
