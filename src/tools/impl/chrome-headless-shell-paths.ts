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
import { findChromeExecutable } from "./chrome-for-testing.ts";

const kVersionFileName = "version";

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
 * Find the chrome-headless-shell executable in the install directory.
 * Returns the absolute path if installed, undefined otherwise.
 */
export function chromeHeadlessShellExecutablePath(): string | undefined {
  const dir = chromeHeadlessShellInstallDir();
  if (!existsSync(dir)) {
    return undefined;
  }
  return findChromeExecutable(dir, chromeHeadlessShellBinaryName());
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
    findChromeExecutable(dir, chromeHeadlessShellBinaryName()) !== undefined;
}
