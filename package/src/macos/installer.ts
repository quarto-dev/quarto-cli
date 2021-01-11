/*
* installer.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import { dirname, join } from "path/mod.ts";
import { existsSync, ensureDirSync } from "fs/mod.ts";

import { Configuration } from "../common/config.ts";
import { Logger } from "../util/logger.ts";
import { runCmd } from "../util/cmd.ts";


// Packaging specific configuration
// (Some things are global others may be platform specific)
export interface PackageInfo {
  name: string;
  identifier: string;
  packageArgs: () => string[];
}

export async function makeInstallerMac(config: Configuration) {

  const packageName = `quarto-${config.version}-macos.pkg`;
  const packageIdentifier = "org.rstudio.quarto";

  const scriptDir = join(config.directoryInfo.pkg, "scripts", "macos", "pkg");
  const packageArgs = [
    "--scripts",
    scriptDir,
    "--install-location",
    '"/Library/Quarto"',
  ];

  // Target package
  const outPackage = join(
    config.directoryInfo.out,
    packageName,
  );

  config.log.info(`Packaging into ${outPackage}`);

  // Clean any existing package
  if (existsSync(outPackage)) {
    Deno.removeSync(outPackage);
  }

  // Make the out dir
  ensureDirSync(dirname(outPackage));

  // Run pkg build
  await runCmd(
    "pkgbuild",
    [
      "--root", config.directoryInfo.dist,
      "--identifier", packageIdentifier,
      "--version", config.version,
      ...packageArgs,
      "--ownership", "recommended",
      outPackage
    ],
    config.log);
}

function signPackage(configuration: Configuration, log: Logger) {
}

function signBinaries(configuration: Configuration, log: Logger) {
}
