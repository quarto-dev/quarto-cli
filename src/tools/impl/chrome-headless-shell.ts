/*
 * chrome-headless-shell.ts
 *
 * InstallableTool implementation for Chrome Headless Shell via Chrome for Testing (CfT)
 * and Playwright CDN (arm64 Linux).
 * Provides quarto install/uninstall chrome-headless-shell functionality.
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { join } from "../../deno_ral/path.ts";
import { existsSync, safeMoveSync, safeRemoveSync } from "../../deno_ral/fs.ts";
import {
  InstallableTool,
  InstallContext,
  PackageInfo,
  RemotePackageInfo,
} from "../types.ts";
import {
  detectChromePlatform,
  downloadAndExtractChrome,
  fetchLatestCftRelease,
  fetchPlaywrightBrowsersJson,
  isPlaywrightCdnPlatform,
  playwrightCdnDownloadUrl,
} from "./chrome-for-testing.ts";
import {
  chromeHeadlessShellBinaryName,
  chromeHeadlessShellInstallDir,
  isInstalled,
  noteInstalledVersion,
  readInstalledVersion,
} from "./chrome-headless-shell-paths.ts";
import { chromiumInstallable } from "./chromium.ts";


// -- InstallableTool methods --

async function installed(): Promise<boolean> {
  return isInstalled(chromeHeadlessShellInstallDir());
}

function installDirIfInstalled(): Promise<string | undefined> {
  const dir = chromeHeadlessShellInstallDir();
  if (isInstalled(dir)) {
    return Promise.resolve(dir);
  }
  return Promise.resolve(undefined);
}

async function installedVersion(): Promise<string | undefined> {
  return readInstalledVersion(chromeHeadlessShellInstallDir());
}

async function latestRelease(): Promise<RemotePackageInfo> {
  const platformInfo = detectChromePlatform();

  if (isPlaywrightCdnPlatform(platformInfo)) {
    // arm64 Linux: use Playwright CDN
    const entry = await fetchPlaywrightBrowsersJson();
    const url = playwrightCdnDownloadUrl(entry.revision);
    return {
      url,
      version: entry.browserVersion,
      assets: [{ name: "chrome-headless-shell", url }],
    };
  }

  // All other platforms: use CfT API
  const release = await fetchLatestCftRelease();
  const { platform } = platformInfo;

  const downloads = release.downloads["chrome-headless-shell"];
  if (!downloads) {
    throw new Error("Chrome for Testing API has no chrome-headless-shell downloads");
  }

  const dl = downloads.find((d) => d.platform === platform);
  if (!dl) {
    throw new Error(
      `No chrome-headless-shell download for platform ${platform}`,
    );
  }

  return {
    url: dl.url,
    version: release.version,
    assets: [{ name: "chrome-headless-shell", url: dl.url }],
  };
}

async function preparePackage(ctx: InstallContext): Promise<PackageInfo> {
  const release = await latestRelease();
  const workingDir = Deno.makeTempDirSync({ prefix: "quarto-chrome-hs-" });

  const binaryName = chromeHeadlessShellBinaryName();

  try {
    await downloadAndExtractChrome(
      "Chrome Headless Shell",
      release.url,
      workingDir,
      ctx,
      binaryName,
    );
  } catch (e) {
    safeRemoveSync(workingDir, { recursive: true });
    throw e;
  }

  return {
    filePath: workingDir,
    version: release.version,
  };
}

async function install(pkg: PackageInfo, _ctx: InstallContext): Promise<void> {
  const installDir = chromeHeadlessShellInstallDir();

  // Clear existing contents
  if (existsSync(installDir)) {
    for (const entry of Deno.readDirSync(installDir)) {
      safeRemoveSync(join(installDir, entry.name), { recursive: true });
    }
  }

  // Move extracted contents into install directory
  for (const entry of Deno.readDirSync(pkg.filePath)) {
    safeMoveSync(join(pkg.filePath, entry.name), join(installDir, entry.name));
  }

  noteInstalledVersion(installDir, pkg.version);
}

async function afterInstall(ctx: InstallContext): Promise<boolean> {
  // Clean up legacy chromium installed by 'quarto install chromium'
  try {
    if (await chromiumInstallable.installed()) {
      ctx.info("Removing legacy Chromium installation...");
      await chromiumInstallable.uninstall(ctx);
    }
  } catch {
    ctx.info(
      "Note: Could not remove legacy Chromium. " +
        "You can remove it manually with 'quarto uninstall chromium'.",
    );
  }
  return false;
}

async function uninstall(ctx: InstallContext): Promise<void> {
  await ctx.withSpinner(
    { message: "Removing Chrome Headless Shell..." },
    async () => {
      safeRemoveSync(chromeHeadlessShellInstallDir(), { recursive: true });
    },
  );
}

// -- Exported tool definition --

export const chromeHeadlessShellInstallable: InstallableTool = {
  name: "Chrome Headless Shell",
  prereqs: [],
  installed,
  installDir: installDirIfInstalled,
  installedVersion,
  latestRelease,
  preparePackage,
  install,
  afterInstall,
  uninstall,
};
