/*
* installer.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/

// TODO: Could also consider moving the keychain work out of the github actions and into typescript
// TODO: Confirm whether we should truly be signing the other, non deno, files
// TODO: Configuration could be initialized with working dir and scripts dir so sub tasks can just use that directory (and have it cleaned up automatically)
// TODO: Bundle and package Identifier - same or different?

import { dirname, join } from "../../../src/deno_ral/path.ts";
import { ensureDirSync, existsSync } from "../../../src/deno_ral/fs.ts";
import { error, info, warning } from "../../../src/deno_ral/log.ts";

import { Configuration } from "../common/config.ts";
import { runCmd } from "../util/cmd.ts";
import { getEnv } from "../util/utils.ts";
import { makeTarball } from "../util/tar.ts";
import { withRetry } from "../../../src/core/retry.ts";
import { parseNotarizationResult } from "./notarize-status.ts";

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

    // Sign these non-binary files and don't include
    // the entitlements declaration
    const signWithoutEntitlements: string[] = [
      join(config.directoryInfo.pkgWorking.bin, "quarto.js"),
      join(config.directoryInfo.pkgWorking.bin, "quarto"),
    ];


    // Sign these executable / binary files
    // and include our entitlements declaration
    const signWithEntitlements: string[] = [];
    ["aarch64", "x86_64"].forEach((arch) => {
      signWithEntitlements.push(join(
        config.directoryInfo.pkgWorking.bin,
        "tools",
        arch,
        "deno",
      ));

      signWithEntitlements.push(join(
        config.directoryInfo.pkgWorking.bin,
        "tools",
        arch,
        "dart-sass",
        "src",
        "dart",
      ));
      signWithoutEntitlements.push(join(config.directoryInfo.pkgWorking.bin, "tools", arch, "dart-sass", "sass"));
      // Dart Sass 1.101.0 ships src/sass.snapshot as a Mach-O binary that
      // Apple's notary service requires signed; the dart VM that loads it
      // carries the runtime entitlements, so the snapshot itself needs only a
      // valid Developer ID signature + secure timestamp.
      signWithoutEntitlements.push(join(config.directoryInfo.pkgWorking.bin, "tools", arch, "dart-sass", "src", "sass.snapshot"));

      signWithEntitlements.push(join(config.directoryInfo.pkgWorking.bin, "tools", arch, "esbuild"));
      signWithEntitlements.push(join(config.directoryInfo.pkgWorking.bin, "tools", arch, "pandoc"));
      signWithEntitlements.push(join(config.directoryInfo.pkgWorking.bin, "tools", arch, "typst"));

      const typstGatherPath = join(
        config.directoryInfo.pkgWorking.bin,
        "tools",
        arch,
        "typst-gather",
      );
      if (existsSync(typstGatherPath)) {
        signWithEntitlements.push(typstGatherPath);
      }

      const denoDomPath = join(
        config.directoryInfo.pkgWorking.bin,
        "tools",
        "x86_64",
        "deno_dom",
        "libplugin.dylib",
      );
      if (existsSync(denoDomPath)) {
        signWithEntitlements.push(denoDomPath);
      }

      const denoDomaarch64Path = join(
        config.directoryInfo.pkgWorking.bin,
        "tools",
        "aarch64",
        "deno_dom",
        "libplugin.dylib",
      );
      if (existsSync(denoDomaarch64Path)) {
        signWithEntitlements.push(denoDomaarch64Path);
      }
    });



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
    config.directoryInfo.pkgWorking.root,
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
      config.directoryInfo.pkgWorking.root,
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
    const teamId = getEnv("QUARTO_APPLE_CONNECT_TEAMID", "");
    if (username.length > 0 && password.length > 0) {
      await notarizeAndWait(
        packagePath,
        username,
        password,
        teamId,
      );

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

async function notarizeAndWait(
  input: string,
  username: string,
  password: string,
  teamId: string
) {
  const result = await runCmd(
    "xcrun",
    [
      "notarytool",
      "submit",
      "--apple-id",
      username,
      "--password",
      password,
      "--team-id",
      teamId,
      input,
      "--wait"
    ],
  );

  // Always surface notarytool's own output (submission id + terminal status).
  // runCmd only logs stdout at debug level, so without this the Accepted /
  // Invalid verdict never appears in CI logs.
  info(result.stdout);

  if (!result.status.success) {
    throw new Error("Notarization Failed\n" + result.stdout + result.stderr);
  }

  const { id, status } = parseNotarizationResult(result.stdout);
  if (!id) {
    throw new Error("Notarization Failed to return an Id:\n" + result.stdout);
  }

  // `notarytool submit --wait` can exit 0 even when the service rejects the
  // submission; the trustworthy signal is the terminal status. Only a genuinely
  // notarized package should reach the (offline-only) stapling step below.
  if (status !== "Accepted") {
    await dumpNotarizationLog(id, username, password, teamId);
    throw new Error(
      `Notarization was not accepted (status: ${status ?? "unknown"}) for ${input}`,
    );
  }

  return id;
}

// Best-effort dump of the full developer log for a submission, so a rejected
// notarization shows its reasons in CI. Never masks the caller's own error.
async function dumpNotarizationLog(
  id: string,
  username: string,
  password: string,
  teamId: string,
) {
  try {
    const log = await runCmd(
      "xcrun",
      [
        "notarytool",
        "log",
        id,
        "--apple-id",
        username,
        "--password",
        password,
        "--team-id",
        teamId,
      ],
    );
    info(log.stdout);
    if (log.stderr) {
      error(log.stderr);
    }
  } catch (err) {
    warning(
      `Could not fetch notarization log for ${id}: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }
}

async function waitForNotaryStatus(
  requestId: string,
  username: string,
  password: string,
) {
  const starttime = Date.now();

  // 20 minutes
  const msToWait = 1200000;

  const pollIntervalSeconds = 15;

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
        await new Promise((resolve) =>
          setTimeout(resolve, pollIntervalSeconds * 1000)
        );
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
    if (Date.now() - starttime > msToWait) {
      throw new Error(
        `Failed to Notarize - timed out after ${
          msToWait / 1000
        } seconds when awaiting notarization`,
      );
    }
  }
  return notaryResult;
}

// Once notarizeAndWait confirms the submission is Accepted, the ticket exists
// and stapling normally succeeds immediately. Rarely, the ticket can take a
// moment to become queryable in Apple's CloudKit-backed notary database, so an
// immediate staple fails with:
//   CloudKit query for ... failed due to "Record not found".
//   Could not find base64 encoded ticket in response for ...
// A short bounded retry absorbs that rare timing gap. Anything else - or a
// persistent "Record not found" that outlasts the retry - is a real problem and
// must fail the build (a rejected submission never reaches here; its status is
// verified in notarizeAndWait).
const isCloudKitPropagation = (err: Error) =>
  err.message.includes("CloudKit") &&
  err.message.includes("Record not found");

async function stapleNotary(input: string) {
  await withRetry(async () => {
    await runCmd(
      "xcrun",
      ["stapler", "staple", input],
    );
  }, {
    // withRetry's `attempts` counts retries after the first call (see
    // src/core/retry.ts), so 3 here yields 4 total staple invocations.
    attempts: 3,
    minWait: 20000,
    maxWait: 30000,
    retry: isCloudKitPropagation,
  });
}
