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


const installerCertificate = "Developer ID Installer";
const applicationCertificate = "Developer ID Application";

// Packaging specific configuration
// (Some things are global others may be platform specific)
export interface PackageInfo {
  name: string;
  identifier: string;
  packageArgs: () => string[];
}

export async function makeInstallerMac(config: Configuration) {

  const packageName = `quarto-${config.version}-macos.pkg`;
  const unsignedPackageName = `quarto-${config.version}-unsigned-macos.pkg`;
  const packageIdentifier = "org.rstudio.quarto";

  const scriptDir = join(config.directoryInfo.pkg, "scripts", "macos", "pkg");
  const packageArgs = [
    "--scripts",
    scriptDir,
    "--install-location",
    '"/Library/Quarto"',
  ];

  // Target package
  const unsignedPackagePath = join(
    config.directoryInfo.out,
    unsignedPackageName,
  );

  config.log.info(`Packaging into ${unsignedPackagePath}`);

  // Clean any existing package
  if (existsSync(unsignedPackagePath)) {
    Deno.removeSync(unsignedPackagePath);
  }

  // Make the out dir
  ensureDirSync(dirname(unsignedPackagePath));

  // Run pkg build
  await runCmd(
    "pkgbuild",
    [
      "--root", config.directoryInfo.dist,
      "--identifier", packageIdentifier,
      "--version", config.version,
      ...packageArgs,
      "--ownership", "recommended",
      unsignedPackagePath
    ],
    config.log);

  config.log.info("Signing file");
  config.log.info(unsignedPackagePath);
  await signPackage(unsignedPackagePath, join(config.directoryInfo.out, packageName), config.log);

  config.log.info("Cleaning unsigned file");
  Deno.removeSync(unsignedPackagePath);
}

async function signPackage(inputFile: string, outputFile: string, log: Logger) {
  // could specify --keychain build.keychain to search build keychain?
  await runCmd(
    "productsign",
    ["--sign",
      installerCertificate,
      inputFile,
      outputFile],
    log
  );
}

function signBinaries(configuration: Configuration, log: Logger) {
  // Developer ID Application
}
