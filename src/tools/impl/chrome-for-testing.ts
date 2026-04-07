/*
 * chrome-for-testing.ts
 *
 * Utilities for downloading binaries from the Chrome for Testing (CfT) API
 * and the Playwright CDN (for arm64 Linux where CfT has no builds).
 *
 * https://github.com/GoogleChromeLabs/chrome-for-testing
 * https://googlechromelabs.github.io/chrome-for-testing/
 * https://playwright.dev/docs/browsers#hermetic-install
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { basename, join } from "../../deno_ral/path.ts";
import { existsSync, safeChmodSync, safeRemoveSync, walkSync } from "../../deno_ral/fs.ts";
import { debug } from "../../deno_ral/log.ts";
import { arch, isWindows, os } from "../../deno_ral/platform.ts";
import { unzip } from "../../core/zip.ts";
import { InstallContext } from "../types.ts";

/** Platform identifiers for Chrome binary downloads (CfT API + Playwright CDN). */
export type CftPlatform =
  | "linux64"
  | "linux-arm64"
  | "mac-arm64"
  | "mac-x64"
  | "win32"
  | "win64";

/** Platform detection result. */
export interface PlatformInfo {
  platform: CftPlatform;
  os: string;
  arch: string;
}

/**
 * Map os + arch to a platform string.
 * For linux arm64, returns a PlatformInfo with platform "linux-arm64" — callers
 * should use isPlaywrightCdnPlatform() to route to the Playwright CDN path.
 */
export function detectCftPlatform(): PlatformInfo {
  const platformMap: Record<string, CftPlatform> = {
    "linux-x86_64": "linux64",
    "darwin-aarch64": "mac-arm64",
    "darwin-x86_64": "mac-x64",
    "windows-x86_64": "win64",
    "windows-x86": "win32",
  };

  const key = `${os}-${arch}`;
  const platform = platformMap[key];

  if (!platform) {
    if (os === "linux" && arch === "aarch64") {
      // linux arm64 is supported via Playwright CDN, not CfT.
      // Return a PlatformInfo that callers can check to use the Playwright path.
      return { platform: "linux-arm64" as CftPlatform, os, arch };
    }
    throw new Error(
      `Unsupported platform for Chrome for Testing: ${os} ${arch}`,
    );
  }

  return { platform, os, arch };
}

/** Check if the current platform requires Playwright CDN (arm64 Linux). */
export function isPlaywrightCdnPlatform(info?: PlatformInfo): boolean {
  const p = info ?? detectCftPlatform();
  return p.os === "linux" && p.arch === "aarch64";
}

/** A single download entry from the CfT API. */
export interface CftDownload {
  platform: CftPlatform;
  url: string;
}

/** Parsed stable release from the CfT last-known-good-versions API. */
export interface CftStableRelease {
  version: string;
  downloads: {
    chrome?: CftDownload[];
    "chrome-headless-shell"?: CftDownload[];
    chromedriver?: CftDownload[];
  };
}

const kCftVersionsUrl =
  "https://googlechromelabs.github.io/chrome-for-testing/last-known-good-versions-with-downloads.json";

/**
 * Fetch the latest stable Chrome version and download URLs from the CfT API.
 */
export async function fetchLatestCftRelease(): Promise<CftStableRelease> {
  let response: Response;
  try {
    response = await fetch(kCftVersionsUrl);
  } catch (e) {
    throw new Error(
      `Failed to fetch Chrome for Testing API: ${
        e instanceof Error ? e.message : String(e)
      }`,
    );
  }

  if (!response.ok) {
    throw new Error(
      `Chrome for Testing API returned ${response.status}: ${response.statusText}`,
    );
  }

  // deno-lint-ignore no-explicit-any
  let data: any;
  try {
    data = await response.json();
  } catch {
    throw new Error("Chrome for Testing API returned invalid JSON");
  }

  const stable = data?.channels?.Stable;
  if (!stable || !stable.version || !stable.downloads) {
    throw new Error(
      "Chrome for Testing API response missing expected 'channels.Stable' structure",
    );
  }

  return {
    version: stable.version,
    downloads: stable.downloads,
  };
}

/** Parsed entry from Playwright's browsers.json for chromium-headless-shell. */
export interface PlaywrightBrowserEntry {
  revision: string;
  browserVersion: string;
}

// Source: https://github.com/microsoft/playwright/blob/main/packages/playwright-core/browsers.json
// This file lists the browser revisions Playwright pins per release, including
// chromium-headless-shell builds for linux arm64 that CfT does not provide.
const kPlaywrightBrowsersJsonUrl =
  "https://raw.githubusercontent.com/microsoft/playwright/main/packages/playwright-core/browsers.json";

/**
 * Fetch Playwright's browsers.json and extract the chromium-headless-shell entry.
 * Used as the version/revision source for arm64 Linux where CfT has no builds.
 */
export async function fetchPlaywrightBrowsersJson(): Promise<PlaywrightBrowserEntry> {
  let response: Response;
  const fallbackHint = "\nIf this persists, install a system Chrome/Chromium instead " +
    "(Quarto will detect it automatically).";
  try {
    response = await fetch(kPlaywrightBrowsersJsonUrl);
  } catch (e) {
    throw new Error(
      `Failed to fetch Playwright browsers.json: ${
        e instanceof Error ? e.message : String(e)
      }${fallbackHint}`,
    );
  }

  if (!response.ok) {
    throw new Error(
      `Playwright browsers.json returned ${response.status}: ${response.statusText}${fallbackHint}`,
    );
  }

  // deno-lint-ignore no-explicit-any
  let data: any;
  try {
    data = await response.json();
  } catch {
    throw new Error("Playwright browsers.json returned invalid JSON");
  }

  const browsers = data?.browsers;
  if (!Array.isArray(browsers)) {
    throw new Error("Playwright browsers.json missing 'browsers' array");
  }

  // deno-lint-ignore no-explicit-any
  const entry = browsers.find((b: any) => b.name === "chromium-headless-shell");
  if (!entry || !entry.revision || !entry.browserVersion) {
    throw new Error(
      "Playwright browsers.json has no 'chromium-headless-shell' entry with revision and browserVersion",
    );
  }

  return {
    revision: entry.revision,
    browserVersion: entry.browserVersion,
  };
}

/**
 * Construct the Playwright CDN download URL for chrome-headless-shell on linux arm64.
 * Uses the primary CDN mirror (cdn.playwright.dev).
 */
export function playwrightCdnDownloadUrl(revision: string): string {
  return `https://cdn.playwright.dev/builds/chromium/${revision}/chromium-headless-shell-linux-arm64.zip`;
}

/**
 * Find a named executable inside an extracted CfT directory.
 * Handles platform-specific naming (.exe on Windows) and nested directory structures.
 * Returns absolute path to the executable, or undefined if not found.
 */
export function findCftExecutable(
  extractedDir: string,
  binaryName: string,
): string | undefined {
  const target = isWindows ? `${binaryName}.exe` : binaryName;

  // CfT zips extract to {binaryName}-{platform}/{target}
  try {
    const { platform } = detectCftPlatform();
    const knownPath = join(extractedDir, `${binaryName}-${platform}`, target);
    if (existsSync(knownPath)) {
      return knownPath;
    }
  } catch (e) {
    debug(`findCftExecutable: platform detection failed, falling back to walk: ${e}`);
  }

  // Fallback: bounded walk for unexpected directory structures
  for (const entry of walkSync(extractedDir, { includeDirs: false, maxDepth: 3 })) {
    if (basename(entry.path) === target) {
      return entry.path;
    }
  }

  return undefined;
}

/**
 * Download a CfT zip from URL, extract to targetDir, set executable permissions.
 * Uses InstallContext.download() for progress reporting with the given label.
 * When binaryName is provided, sets executable permission only on that binary.
 * Returns the target directory path.
 */
export async function downloadAndExtractCft(
  label: string,
  url: string,
  targetDir: string,
  context: InstallContext,
  binaryName?: string,
): Promise<string> {
  const tempZipPath = Deno.makeTempFileSync({ suffix: ".zip" });

  try {
    await context.download(label, url, tempZipPath);
    await unzip(tempZipPath, targetDir);
  } finally {
    safeRemoveSync(tempZipPath);
  }

  if (binaryName) {
    const executable = findCftExecutable(targetDir, binaryName);
    if (executable) {
      safeChmodSync(executable, 0o755);
    } else {
      debug(`downloadAndExtractCft: expected binary '${binaryName}' not found in ${targetDir}`);
    }
  }

  return targetDir;
}
