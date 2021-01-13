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
import { getEnv } from "../util/utils.ts";

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
  const signedPackage = join(config.directoryInfo.out, packageName);
  await signInstaller(unsignedPackagePath, signedPackage, config.log);

  config.log.info("Cleaning unsigned file");
  Deno.removeSync(unsignedPackagePath);

  // Submit package for notary
  const username = getEnv("QUARTO_APPLE_CONNECT_UN");
  const password = getEnv("QUARTO_APPLE_CONNECT_PW");
  const requestId = await submitNotary(signedPackage, "org.quarto.cli", username, password, config.log);

  // This will succeed or throw
  await waitForNotaryStatus(requestId, username, password, config.log);
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
      "--timestamp",
      input,
      output],
    log
  );
}

async function submitNotary(input: string, bundleId: string, username: string, password: string, log: Logger) {
  const result = await runCmd(
    "xcrun",
    ["altool",
      "--notarize-app",
      "--primary-bundle-id", bundleId,
      "--username", username,
      "--password", password,
      "--file", input
    ],
    log
  )
  const match = result.stdout.match(/RequestUUID = (.*)/);
  if (match) {
    const requestId = match[1];
    return requestId;
  } else {
    throw new Error("Unable to start notarization " + result.stdout);
  }
}

async function waitForNotaryStatus(requestId: string, username: string, password: string, log: Logger) {
  let notaryResult = undefined;
  while (notaryResult == undefined) {
    const result = await runCmd(
      "xcrun",
      ["altool",
        "--notarization-info", requestId,
        "--username", username,
        "--password", password,
      ],
      log
    );

    const match = result.stdout.match(/Status: (.*)\n/);
    if (match) {
      const status = match[1];
      if (status === "in progress") {
        // Sleep for 15 seconds between checks
        await new Promise((resolve) => setTimeout(resolve, 15 * 1000));
      } else if (status === "success") {
        notaryResult = "Success";
      } else {
        log.error(result.stderr);
        throw new Error("Failed to Notarize - " + status);
      }
    }
  }
  return notaryResult;
}