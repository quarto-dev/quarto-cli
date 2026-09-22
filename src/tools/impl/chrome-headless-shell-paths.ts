/*
 * chrome-headless-shell-paths.ts
 *
 * Path and version utilities for chrome-headless-shell.
 * Extracted from chrome-headless-shell.ts so that puppeteer.ts can import
 * these without creating a circular dependency.
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { join } from "../../deno_ral/path.ts";
import { existsSync } from "../../deno_ral/fs.ts";
import { quartoDataDir } from "../../core/appdirs.ts";
import {
  findChromeExecutable,
  isPlaywrightCdnPlatform,
} from "./chrome-for-testing.ts";

const kVersionFileName = "version";

/**
 * Binary name used by the Playwright-hosted arm64 archives that predate
 * Playwright's move to the browserVersion-keyed builds/cft/ CDN path. Those
 * archives shipped Playwright's own package layout — chrome-linux/headless_shell
 * — instead of the CfT layout every platform (arm64 included) gets today.
 * Installs made in that window are still on disk and must stay detectable.
 */
const kLegacyPlaywrightBinaryName = "headless_shell";

/**
 * Whether the legacy Playwright arm64 layout is worth probing for on this host.
 * isPlaywrightCdnPlatform() throws on unsupported os/arch combinations, in which
 * case no Quarto-installed arm64 binary can exist here anyway.
 */
function hostMayHaveLegacyPlaywrightLayout(): boolean {
  try {
    return isPlaywrightCdnPlatform();
  } catch {
    return false;
  }
}

/** Return the chrome-headless-shell install directory under quartoDataDir. */
export function chromeHeadlessShellInstallDir(): string {
  return quartoDataDir("chrome-headless-shell");
}

/**
 * The executable name for chrome-headless-shell.
 * The Playwright CDN arm64 mirror redirects to the same chrome-for-testing-public
 * bucket used for every other platform, so it shares the "chrome-headless-shell"
 * binary name too.
 */
export function chromeHeadlessShellBinaryName(): string {
  return "chrome-headless-shell";
}

/**
 * Locate the chrome-headless-shell binary inside an install directory.
 * Prefers the current CfT layout; on arm64 Linux also accepts the legacy
 * Playwright layout left behind by pre-CDN-migration installs.
 *
 * allowLegacyPlaywrightLayout defaults to host detection and exists as an
 * explicit parameter so the arm64 branch is reachable from tests on any host.
 */
export function findChromeHeadlessShellExecutable(
  dir: string,
  allowLegacyPlaywrightLayout: boolean = hostMayHaveLegacyPlaywrightLayout(),
): string | undefined {
  const found = findChromeExecutable(dir, chromeHeadlessShellBinaryName());
  if (found !== undefined) {
    return found;
  }
  if (allowLegacyPlaywrightLayout) {
    return findChromeExecutable(dir, kLegacyPlaywrightBinaryName);
  }
  return undefined;
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
  return findChromeHeadlessShellExecutable(dir);
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
export function isInstalled(
  dir: string,
  allowLegacyPlaywrightLayout?: boolean,
): boolean {
  return existsSync(join(dir, kVersionFileName)) &&
    findChromeHeadlessShellExecutable(dir, allowLegacyPlaywrightLayout) !==
      undefined;
}
