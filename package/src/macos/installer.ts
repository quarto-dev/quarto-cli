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
  const unsignedPackageName = `quarto-${config.version}-unsigned-macos.pkg`;
  const packageIdentifier = "org.rstudio.quarto";

  const scriptDir = join(config.directoryInfo.pkg, "scripts", "macos", "pkg");
  const packageArgs = [
    "--scripts",
    scriptDir,
    "--install-location",
    '/Library/Quarto',
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
  await signInstaller(unsignedPackagePath, join(config.directoryInfo.out, packageName), config.log);

  config.log.info("Cleaning unsigned file");
  Deno.removeSync(unsignedPackagePath);
}

const installerCertificate = "Developer ID Installer";
async function signInstaller(input: string, output: string, log: Logger) {
  await signFile(input, output, installerCertificate, log);
}

const applicationCertificate = "Developer ID Application";
async function signApplicationFile(input: string, output: string, log: Logger) {
  await signFile(input, output, applicationCertificate, log);
}

async function signFile(input: string, output: string, certificate: string, log: Logger) {
  await runCmd(
    "productsign",
    ["--sign",
      certificate,
      input,
      output],
    log
  );
}
