/*
 * chromium.ts
 *
 * Copyright (C) 2020 by RStudio, PBC
 *
 */
import { warning } from "log/mod.ts";
import { join, resolve } from "path/mod.ts";
import puppeteer from "puppeteer/mod.ts";

import {
  clearLine,
  progressBar,
  spinner,
  withSpinner,
} from "../../../core/console.ts";

import { InstallableTool, InstallContext, PackageInfo } from "../tools.ts";

export const chromiumInstallable: InstallableTool = {
  name: "Chromium",
  prereqs: [],
  installed,
  installedVersion,
  latestRelease,
  preparePackage,
  install,
  afterInstall,
  uninstall,
};

export async function installed(): Promise<boolean> {
  return await installedVersion() !== undefined;
}

async function installedVersion(): Promise<string | undefined> {
  const localRevisions = await fetcher().localRevisions();
  if (localRevisions.length) {
    return localRevisions[localRevisions.length - 1];
  }
}

function latestRelease() {
  const revisionInfo = fetcher().revisionInfo(supportedRevision());

  return Promise.resolve({
    url: revisionInfo.url,
    version: supportedRevision(),
    assets: [{ name: "", url: "" }],
  });
}

async function preparePackage(_ctx: InstallContext): Promise<PackageInfo> {
  const revision = supportedRevision();
  const progress = progressBar(
    100,
    `Downloading Chromium ${revision}`,
  );
  //  const spin = spinner("Installing");
  let spinnerStatus: ((() => void) | undefined);
  const revisionInfo = await fetcher().download(
    revision,
    (x: number, total: number) => {
      const percent = x / total * 100;
      if (percent < 100) {
        progress.update(percent);
      } else {
        progress.complete(true);
        clearLine();
        spinnerStatus = spinner(`Installing Chromium ${revision}`);
      }
    },
  );
  if (spinnerStatus !== undefined) {
    spinnerStatus();
  }

  // Mark helpers executable after install
  if (Deno.build.os !== "windows") {
    await withSpinner(
      { message: "Updating Permissions", doneMessage: true },
      async () => {
        await Deno.chmod(revisionInfo.executablePath, 0o755);
        if (Deno.build.os === "darwin") {
          await macOSMakeChromiumHelpersExecutable(revisionInfo.executablePath);
        }
        return Promise.resolve();
      },
    );
  }

  return {
    filePath: revisionInfo.folderPath,
    version: revisionInfo.revision,
  };
}

function install(_pkg: PackageInfo, _ctx: InstallContext): Promise<void> {
  return Promise.resolve();
}

function afterInstall(_ctx: InstallContext): Promise<boolean> {
  return Promise.resolve(false);
}

async function uninstall(_ctx: InstallContext): Promise<void> {
  await withSpinner({
    message: "Removing Puppeteer...",
  }, () => {
    return fetcher().remove(supportedRevision());
  });
  return Promise.resolve();
}

function fetcher() {
  const options = {};
  const fetcher = puppeteer.createBrowserFetcher(options);
  return fetcher;
}

// TODO: https://github.com/puppeteer/puppeteer/blob/main/versions.js
function supportedRevision(): string {
  return puppeteer._preferredRevision;
}

// These are workarounds to a known issue with install that should be fixed in a future release
// https://github.com/lucacasonato/deno-puppeteer/pull/15
async function macOSMakeChromiumHelpersExecutable(executablePath: string) {
  const helperApps = [
    "Chromium Helper",
    "Chromium Helper (GPU)",
    "Chromium Helper (Plugin)",
    "Chromium Helper (Renderer)",
  ];

  const frameworkPath = resolve(
    executablePath,
    join(
      "..",
      "..",
      "Frameworks",
      "Chromium Framework.framework",
      "Versions",
    ),
  );

  const versionPath = join(frameworkPath, "Current");

  try {
    const version = await Deno.readTextFile(versionPath);

    for (const helperApp of helperApps) {
      const helperAppPath = join(
        frameworkPath,
        version,
        "Helpers",
        helperApp + ".app",
        "Contents",
        "MacOS",
        helperApp,
      );

      await Deno.chmod(helperAppPath, 0o755);
    }
  } catch (err) {
    warning("Failed to make Chromium Helpers executable", String(err));
  }
}
