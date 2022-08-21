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
import { makeTarball } from "../util/tar.ts";

// Packaging specific configuration
// (Some things are global others may be platform specific)
export interface PackageInfo {
  name: string;
  identifier: string;
  packageArgs: () => string[];
}

export async function makeInstallerMac(config: Configuration) {
  // Core package
  const corePackageName = `quarto-core.pkg`;
  const corePackagePath = join(
    config.directoryInfo.out,
    corePackageName,
  );
  const packageIdentifier = "org.rstudio.quarto";
  const bundleIdentifier = "org.rstudio.quarto.cli";

  // Product package
  const packageName = `quarto-${config.version}-macos.pkg`;
  const packagePath = join(
    config.directoryInfo.out,
    packageName,
  );

  const distXml = join(
    config.directoryInfo.pkg,
    "scripts",
    "macos",
    "distribution.xml",
  );

  info(`Packaging into ${packagePath}`);

  // Clean any existing package
  if (existsSync(packagePath)) {
    Deno.removeSync(packagePath);
  }

  // Make the output dir
  ensureDirSync(dirname(packagePath));

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

    const denoExecPath = Deno.env.get("QUARTO_DENO")
    if (! denoExecPath) {
      throw Error("QUARTO_DENO is not defined");
    }

    // Sign these executable / binary files
    // and include our entitlements declaration
    const signWithEntitlements:string[] = [
      denoExecPath,
      join(
        config.directoryInfo.bin,
        "tools",
        "deno_dom",
        "libplugin.dylib",
      ),
      join(config.directoryInfo.bin, "tools", "esbuild"),
      join(config.directoryInfo.bin, "tools", "dart-sass", "src", "dart"),
      join(config.directoryInfo.bin, "tools", "pandoc"),
    ];

    // Sign these non-binary files and don't include
    // the entitlements declaration
    const signWithoutEntitlements:string[] = [
      join(config.directoryInfo.bin, "tools", "dart-sass", "sass"),
      join(config.directoryInfo.bin, "quarto.js"),
      join(config.directoryInfo.bin, "quarto"),
    ];

    for (const fileToSign of signWithEntitlements) {
      info(fileToSign);
      await signCode(applicationDevId, fileToSign, entitlements);
    }
    for (const fileToSign of signWithoutEntitlements) {
      info(fileToSign);
      await signCode(applicationDevId, fileToSign);
    }

    info("Done signing Done signing binaries");
  } else {
    warning("Missing Application Developer Id, not signing");
  }

  // Now that runtimes have been signed, create a zip
  makeTarball(
    config.directoryInfo.dist,
    join(config.directoryInfo.out, `quarto-${config.version}-macos.tar.gz`),
    true,
  );

  // Installer signature configuration
  const installerDevId = getEnv("QUARTO_APPLE_INST_DEV_ID", "");
  const signInstaller = installerDevId.length > 0;
  const performSign = async (file: string) => {
    if (signInstaller) {
      info("Signing file");
      info(packagePath);

      const targetPath = join(dirname(file), "signing.out");
      await signPackage(
        installerDevId,
        file,
        targetPath,
      );

      info("Signing file");
      info(file);

      info("Cleaning unsigned file");
      Deno.removeSync(file);
      Deno.renameSync(targetPath, file);
    }
  };

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
  // Maybe sign the package
  await performSign(corePackagePath);

  // Use productbuild to create an improved install experience
  const distXmlContents = Deno.readTextFileSync(distXml);
  const localDistXml = join(dirname(packagePath), "distribution.xml");
  const replacedContents = distXmlContents.replace("$PATH$", corePackagePath);
  info(`Local dist file: ${localDistXml}`);
  Deno.writeTextFileSync(
    localDistXml,
    replacedContents,
  );

  const oldWd = Deno.cwd();
  Deno.chdir(config.directoryInfo.out);
  await runCmd(
    "productbuild",
    [
      "--package-path",
      corePackagePath,
      "--distribution",
      localDistXml,
      packagePath,
    ],
  );
  Deno.chdir(oldWd);

  // Remove core file
  Deno.removeSync(corePackagePath);
  Deno.removeSync(localDistXml);

  //sign product build output
  await performSign(packagePath);

  // The application cert developer Id
  if (signInstaller) {
    // Submit package for notary
    const username = getEnv("QUARTO_APPLE_CONNECT_UN", "");
    const password = getEnv("QUARTO_APPLE_CONNECT_PW", "");
    if (username.length > 0 && password.length > 0) {
      const requestId = await submitNotary(
        packagePath,
        bundleIdentifier,
        username,
        password,
      );

      // Add a delay to allow the Apple servers to propagate the
      // request Id that they've just provided
      sleepSync(10000);

      // This will succeed or throw
      await waitForNotaryStatus(requestId, username, password);

      // Staple the notary to the package
      await stapleNotary(packagePath);
    } else {
      warning("Missing Connect credentials, not notarizing");
    }
  } else {
    warning("Missing Installer Developer Id, not signing");
  }
}

// https://deno.com/blog/v1.23#remove-unstable-denosleepsync-api
function sleepSync(timeout: number) {
  const sab = new SharedArrayBuffer(1024);
  const int32 = new Int32Array(sab);
  Atomics.wait(int32, 0, 0, timeout);
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
    "--verbose=4",
  ];
  if (entitlements) {
    args.push("--entitlements");
    args.push(entitlements);
  }

  const result = await runCmd(
    "codesign",
    [...args, input],
  );

  info(result.stdout);
  if (!result.status.success) {
    error(result.stderr);
  }

  return result;
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
