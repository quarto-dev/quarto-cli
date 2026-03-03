/*
 * chrome-headless-shell.ts
 *
 * InstallableTool implementation for Chrome Headless Shell via Chrome for Testing (CfT).
 * Provides quarto install/uninstall chrome-headless-shell functionality.
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { join } from "../../deno_ral/path.ts";
import { existsSync, safeMoveSync, safeRemoveSync } from "../../deno_ral/fs.ts";
import { quartoDataDir } from "../../core/appdirs.ts";
import {
  InstallableTool,
  InstallContext,
  PackageInfo,
  RemotePackageInfo,
} from "../types.ts";
import {
  detectCftPlatform,
  downloadAndExtractCft,
  fetchLatestCftRelease,
  findCftExecutable,
} from "./chrome-for-testing.ts";

const kVersionFileName = "version";

// -- Version helpers --

/** Return the chrome-headless-shell install directory under quartoDataDir. */
export function chromeHeadlessShellInstallDir(): string {
  return quartoDataDir("chrome-headless-shell");
}

/**
 * Find the chrome-headless-shell executable in the install directory.
 * Returns the absolute path if installed, undefined otherwise.
 */
export function chromeHeadlessShellExecutablePath(): string | undefined {
  const dir = chromeHeadlessShellInstallDir();
  if (!existsSync(dir)) {
    return undefined;
  }
  return findCftExecutable(dir, "chrome-headless-shell");
}

/** Record the installed version as a plain text file. */
export function noteInstalledVersion(dir: string, version: string): void {
  Deno.writeTextFileSync(join(dir, kVersionFileName), version);
}

/** Read the installed version. Returns undefined if not present. */
export function readInstalledVersion(dir: string): string | undefined {
  const path = join(dir, kVersionFileName);
  if (!existsSync(path)) {
    return undefined;
  }
  const text = Deno.readTextFileSync(path).trim();
  return text || undefined;
}

/** Check if chrome-headless-shell is installed in the given directory. */
export function isInstalled(dir: string): boolean {
  return existsSync(join(dir, kVersionFileName)) &&
    findCftExecutable(dir, "chrome-headless-shell") !== undefined;
}

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
  const release = await fetchLatestCftRelease();
  const { platform } = detectCftPlatform();

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

  try {
    await downloadAndExtractCft(
      "Chrome Headless Shell",
      release.url,
      workingDir,
      ctx,
      "chrome-headless-shell",
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

async function afterInstall(_ctx: InstallContext): Promise<boolean> {
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
