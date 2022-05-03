/*
 * chromium.ts
 *
 * Copyright (C) 2020 by RStudio, PBC
 *
 */

import { getPuppeteer } from "../../../core/puppeteer.ts";
import { join } from "path/mod.ts";
import { getenv } from "../../../core/env.ts";

import {
  clearLine,
  progressBar,
  spinner,
  withSpinner,
} from "../../../core/console.ts";
import { expandPath } from "../../../core/path.ts";

import { InstallableTool, InstallContext, PackageInfo } from "../types.ts";

export function chromiumInstallDir(): string | undefined {
  switch (Deno.build.os) {
    case "windows":
      return expandPath(join(getenv("APPDATA", undefined), "quarto-chromium"));
    case "linux":
      return expandPath("~/.quarto-chromium");
    case "darwin":
      return expandPath("~/Library/quarto-chromium");
    default:
      return undefined;
  }
}

async function installDir() {
  if (await installed()) {
    return Promise.resolve(chromiumInstallDir());
  } else {
    return Promise.resolve(undefined);
  }
}

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
  installDir,
};

export async function installed(): Promise<boolean> {
  const fetcherObj = await fetcher();
  const localRevisions = await fetcherObj.localRevisions();
  return localRevisions.includes(supportedRevision());
}

async function installedVersion(): Promise<string | undefined> {
  const fetcherObj = await fetcher();
  const localRevisions = await fetcherObj.localRevisions();
  if (localRevisions.length) {
    return localRevisions[localRevisions.length - 1];
  }
}

async function latestRelease() {
  const fetcherObj = await fetcher();
  const revisionInfo = await fetcherObj.revisionInfo(supportedRevision());
  const version = await supportedRevision();

  return Promise.resolve({
    url: revisionInfo.url,
    version,
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
  const fetcherObj = await fetcher();
  const revisionInfo = await fetcherObj.download(
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
    message: "Removing Chromium...",
  }, async () => {
    return (await fetcher()).remove(supportedRevision());
  });
  return Promise.resolve();
}

export async function fetcher() {
  const options = {
    path: chromiumInstallDir(),
  };
  const fetcher = (await getPuppeteer()).createBrowserFetcher(options);
  return fetcher;
}

// TODO: https://github.com/puppeteer/puppeteer/blob/main/versions.js
async function supportedRevision(): Promise<string> {
  return (await getPuppeteer())._preferredRevision;
}
