/*
* installer.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import { dirname, join } from "path/mod.ts";
import { existsSync } from "fs/exists.ts";

import { Configuration } from "../common/config.ts";
import { Logger } from "../util/logger.ts";
import { ensureDirExists } from "../util/utils.ts";
import { runCmd } from "../util/cmd.ts";

export async function makeInstallerMac(config: Configuration) {
  // Target package
  const outPackage = join(
    config.dirs.out,
    config.pkgConfig.name,
  );

  config.log.info(`Packaging into ${outPackage}`);

  // Clean any existing package
  if (existsSync(outPackage)) {
    Deno.removeSync(outPackage);
  }

  // Make the out dir
  ensureDirExists(dirname(outPackage));

  // Run pkg build
  await runCmd(
    "pkgbuild",
    [
      "--root", config.dirs.dist,
      "--identifier", config.pkgConfig.identifier,
      "--version", config.version,
      ...config.pkgConfig.packageArgs(),
      "--ownership", "recommended",
      outPackage
    ],
    config.log);
}

function signPackage(configuration: Configuration, log: Logger) {
}

function signBinaries(configuration: Configuration, log: Logger) {
}
