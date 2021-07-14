/*
* installer.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

// TODO: Could also consider moving the keychain work out of the github actions and into typescript
// TODO: Confirm whether we should truly be signing the other, non deno, files
// TODO: Configuration could be initialized with working dir and scripts dir so sub tasks can just use that directory (and have it cleaned up automatically)
// TODO: Bundle and package Identifier - same or different?

import { dirname, join } from "path/mod.ts";
import { ensureDirSync, existsSync } from "fs/mod.ts";
import { error, info, warning } from "log/mod.ts";

import { Configuration } from "../common/config.ts";
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
  const bundleIdentifier = "org.rstudio.quarto.cli";

  // Target package
  const unsignedPackagePath = join(
    config.directoryInfo.out,
    unsignedPackageName,
  );

  info(`Packaging into ${unsignedPackagePath}`);

  // Clean any existing package
  if (existsSync(unsignedPackagePath)) {
    Deno.removeSync(unsignedPackagePath);
  }

  // Make the output dir
  ensureDirSync(dirname(unsignedPackagePath));

  // The application cert developer Id
  const applicationDevId = getEnv("QUARTO_APPLE_APP_DEV_ID", "");
  const signBinaries = applicationDevId.length > 0;

  // Sign the deno executable
  if (signBinaries) {
    info("Signing binaries");
    const entitlements = join(
      config.directoryInfo.pkg,
      "scripts",
      "macos",
      "entitlements.plist",
    );

    // Sign deno
    const deno = join(config.directoryInfo.bin, "deno");
    await signCode(applicationDevId, deno, entitlements);

    // Sign esbuild
    const esbuild = join(config.directoryInfo.bin, "esbuild");
    await signCode(applicationDevId, esbuild, entitlements);

    // Sign the quarto js file
    const quartojs = join(config.directoryInfo.bin, "quarto.js");
    await signCode(applicationDevId, quartojs);

    // Sign the quarto shell script
    const quartosh = join(config.directoryInfo.bin, "quarto");
    await signCode(applicationDevId, quartosh);
  } else {
    warning("Missing Application Developer Id, not signing");
  }

  // Run pkg build
  const scriptDir = join(config.directoryInfo.pkg, "scripts", "macos", "pkg");
  const packageArgs = [
    "--scripts",
    scriptDir,
    "--install-location",
    "/Library/Quarto",
  ];
  await runCmd(
    "pkgbuild",
    [
      "--root",
      config.directoryInfo.dist,
      "--identifier",
      packageIdentifier,
      "--version",
      config.version,
      ...packageArgs,
      "--ownership",
      "recommended",
      "--install-location",
      "/Applications/quarto",
      corePackagePath,
    ],
  );

  // The application cert developer Id
  const installerDevId = getEnv("QUARTO_APPLE_INST_DEV_ID", "");
  const signInstaller = installerDevId.length > 0;
  const signedPackage = join(config.directoryInfo.out, packageName);
  if (signInstaller) {
    info("Signing file");
    info(unsignedPackagePath);

    await signPackage(
      installerDevId,
      unsignedPackagePath,
      signedPackage,
    );
    info("Cleaning unsigned file");
    Deno.removeSync(unsignedPackagePath);

    // Submit package for notary
    const username = getEnv("QUARTO_APPLE_CONNECT_UN", "");
    const password = getEnv("QUARTO_APPLE_CONNECT_PW", "");
    if (username.length > 0 && password.length > 0) {
      const requestId = await submitNotary(
        signedPackage,
        bundleIdentifier,
        username,
        password,
      );

      // Add a delay to allow the Apple servers to propagate the
      // request Id that they've just provided
      Deno.sleepSync(10000);

      // This will succeed or throw
      await waitForNotaryStatus(requestId, username, password);

      // Staple the notary to the package
      await stapleNotary(signedPackage);
    } else {
      warning("Missing Connect credentials, not notarizing");
    }
  } else {
    warning("Missing Installer Developer Id, not signing");
  }
}

async function signPackage(
  developerId: string,
  input: string,
  output: string,
) {
  await runCmd(
    "productsign",
    ["--sign", developerId, "--timestamp", input, output],
  );
}

async function signCode(
  developerId: string,
  input: string,
  entitlements?: string,
) {
  const args = [
    "-s",
    developerId,
    "--timestamp",
    "--options=runtime",
    "--force",
    "--deep",
  ];
  if (entitlements) {
    args.push("--entitlements");
    args.push(entitlements);
  }

  await runCmd(
    "codesign",
    [...args, input],
  );
}

async function submitNotary(
  input: string,
  bundleId: string,
  username: string,
  password: string,
) {
  const result = await runCmd(
    "xcrun",
    [
      "altool",
      "--notarize-app",
      "--primary-bundle-id",
      bundleId,
      "--username",
      username,
      "--password",
      password,
      "--file",
      input,
    ],
  );
  const match = result.stdout.match(/RequestUUID = (.*)/);
  if (match) {
    const requestId = match[1];
    return requestId;
  } else {
    throw new Error("Unable to start notarization " + result.stdout);
  }
}

async function waitForNotaryStatus(
  requestId: string,
  username: string,
  password: string,
) {
  let errorCount = 0;
  let notaryResult = undefined;
  while (notaryResult == undefined) {
    const result = await runCmd(
      "xcrun",
      [
        "altool",
        "--notarization-info",
        requestId,
        "--username",
        username,
        "--password",
        password,
      ],
    );

    const match = result.stdout.match(/Status: (.*)\n/);
    if (match) {
      const status = match[1];
      if (status === "in progress") {
        // Successful status means reset error counter
        errorCount = 0;

        // Sleep for 15 seconds between checks
        await new Promise((resolve) => setTimeout(resolve, 15 * 1000));
      } else if (status === "success") {
        notaryResult = "Success";
      } else {
        if (errorCount > 5) {
          error(result.stderr);
          throw new Error("Failed to Notarize - " + status);
        }

        //increment error counter
        errorCount = errorCount + 1;
      }
    }
  }
  return notaryResult;
}

async function stapleNotary(input: string) {
  await runCmd(
    "xcrun",
    ["stapler", "staple", input],
  );
}
