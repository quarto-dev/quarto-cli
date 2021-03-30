/*
* dependencies.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import { join } from "path/mod.ts";

import { Configuration } from "./config.ts";
import {
  dependencies,
  PlatformDependency,
} from "./dependencies/dependencies.ts";

export async function configure(
  config: Configuration,
) {
  const log = config.log;

  log.info("Configuring local machine for development");

  // Download dependencies
  log.info("Downloading dependencies");
  for (const dependency of dependencies(config)) {
    log.info("Configuring " + dependency.name);
    const platformDep = dependency[Deno.build.os];
    if (platformDep) {
      const targetFile = await downloadBinaryDependency(platformDep, config);
      await platformDep.configure(targetFile);
      Deno.removeSync(targetFile);
    }
  }

  // Move the quarto script into place
  log.info("Creating Quarto script");
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
  log.info("Creating Quarto script");
  if (Deno.build.os !== "windows") {
    Deno.symlinkSync(
      join(config.directoryInfo.bin, "quarto"),
      "/usr/local/bin/quarto",
    );
  }
}

async function downloadBinaryDependency(
  dependency: PlatformDependency,
  configuration: Configuration,
) {
  const targetFile = join(configuration.directoryInfo.bin, dependency.filename);

  configuration.log.info("Downloading " + dependency.url);
  configuration.log.info("to " + targetFile);
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
