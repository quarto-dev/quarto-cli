/*
 * chromium.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import {
  chromiumInstallDir,
  fetcher,
  getPuppeteer,
} from "../../core/puppeteer.ts";
import {
  clearLine,
  progressBar,
  spinner,
  withSpinner,
} from "../../core/console.ts";

import { InstallableTool, InstallContext, PackageInfo } from "../types.ts";

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
  const version = await supportedRevision();
  const localRevisions = await fetcherObj.localRevisions();
  return localRevisions.includes(version);
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
  const version = await supportedRevision();
  const revisionInfo = await fetcherObj.revisionInfo(version);

  return Promise.resolve({
    url: revisionInfo.url,
    version,
    assets: [{ name: "", url: "" }],
  });
}

async function preparePackage(_ctx: InstallContext): Promise<PackageInfo> {
  const revision = await supportedRevision();

  const progress = progressBar(
    100,
    `Downloading Chromium ${revision}`,
  );
  //  const spin = spinner("Installing");
  let spinnerStatus: (() => void) | undefined;
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
    const fetcherObj = await fetcher();
    const version = await supportedRevision();
    return fetcherObj.remove(version);
  });
  return Promise.resolve();
}

// TODO: https://github.com/puppeteer/puppeteer/blob/main/versions.js
async function supportedRevision(): Promise<string> {
  return (await getPuppeteer())._preferredRevision;
}
