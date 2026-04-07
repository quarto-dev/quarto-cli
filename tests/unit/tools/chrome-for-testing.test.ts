/*
 * chrome-for-testing.test.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { unitTest } from "../../test.ts";
import { assert, assertEquals } from "testing/asserts";
import { arch, os } from "../../../src/deno_ral/platform.ts";
import { join } from "../../../src/deno_ral/path.ts";
import { safeRemoveSync } from "../../../src/deno_ral/fs.ts";
import { isWindows } from "../../../src/deno_ral/platform.ts";
import { runningInCI } from "../../../src/core/ci-info.ts";
import { InstallContext } from "../../../src/tools/types.ts";
import {
  detectChromePlatform,
  downloadAndExtractChrome,
  fetchLatestCftRelease,
  fetchPlaywrightBrowsersJson,
  findChromeExecutable,
  isPlaywrightCdnPlatform,
  playwrightCdnDownloadUrl,
} from "../../../src/tools/impl/chrome-for-testing.ts";

// Step 1: detectChromePlatform()
unitTest("detectChromePlatform - returns valid CftPlatform for current system", async () => {
  const result = detectChromePlatform();
  const validPlatforms = ["linux64", "linux-arm64", "mac-arm64", "mac-x64", "win32", "win64"];
  assert(
    validPlatforms.includes(result.platform),
    `Expected one of ${validPlatforms.join(", ")}, got: ${result.platform}`,
  );
  assert(result.os.length > 0, "os should be non-empty");
  assert(result.arch.length > 0, "arch should be non-empty");
});

unitTest("detectChromePlatform - returns win64 on Windows x86_64", async () => {
  if (os !== "windows" || arch !== "x86_64") {
    return; // Skip on non-Windows
  }
  const result = detectChromePlatform();
  assertEquals(result.platform, "win64");
  assertEquals(result.os, "windows");
  assertEquals(result.arch, "x86_64");
});

// Step 2: fetchLatestCftRelease()
// These tests make real HTTP calls to the CfT API — skip on CI.
unitTest("fetchLatestCftRelease - returns valid version string", async () => {
  const release = await fetchLatestCftRelease();
  assert(release.version, "version should be non-empty");
  assert(
    /^\d+\.\d+\.\d+\.\d+$/.test(release.version),
    `version should match X.Y.Z.W format, got: ${release.version}`,
  );
}, { ignore: runningInCI() });

unitTest("fetchLatestCftRelease - has chrome-headless-shell downloads", async () => {
  const release = await fetchLatestCftRelease();
  const downloads = release.downloads["chrome-headless-shell"];
  assert(downloads, "chrome-headless-shell downloads should exist");
  assert(downloads!.length > 0, "should have at least one download");
}, { ignore: runningInCI() });

unitTest("fetchLatestCftRelease - download URLs are valid", async () => {
  const release = await fetchLatestCftRelease();
  const downloads = release.downloads["chrome-headless-shell"]!;
  for (const dl of downloads) {
    assert(
      dl.url.startsWith("https://storage.googleapis.com/"),
      `URL should start with googleapis.com, got: ${dl.url}`,
    );
    assert(
      dl.url.includes(release.version),
      `URL should contain version ${release.version}, got: ${dl.url}`,
    );
  }
}, { ignore: runningInCI() });

// Step 3: findChromeExecutable()
unitTest("findChromeExecutable - finds binary in CfT directory structure", async () => {
  const tempDir = Deno.makeTempDirSync();
  try {
    const { platform } = detectChromePlatform();
    const subdir = join(tempDir, `chrome-headless-shell-${platform}`);
    Deno.mkdirSync(subdir);
    const binaryName = isWindows
      ? "chrome-headless-shell.exe"
      : "chrome-headless-shell";
    const binaryPath = join(subdir, binaryName);
    Deno.writeTextFileSync(binaryPath, "fake binary");

    const found = findChromeExecutable(tempDir, "chrome-headless-shell");
    assert(found !== undefined, "should find the binary");
    assert(
      found!.endsWith(binaryName),
      `found path should end with ${binaryName}, got: ${found}`,
    );
  } finally {
    safeRemoveSync(tempDir, { recursive: true });
  }
});

unitTest("findChromeExecutable - returns undefined for empty directory", async () => {
  const tempDir = Deno.makeTempDirSync();
  try {
    const found = findChromeExecutable(tempDir, "chrome-headless-shell");
    assertEquals(found, undefined);
  } finally {
    safeRemoveSync(tempDir, { recursive: true });
  }
});

unitTest("findChromeExecutable - finds binary in nested structure", async () => {
  const tempDir = Deno.makeTempDirSync();
  try {
    const { platform } = detectChromePlatform();
    const nested = join(tempDir, `chrome-headless-shell-${platform}`, "subfolder");
    Deno.mkdirSync(nested, { recursive: true });
    const binaryName = isWindows
      ? "chrome-headless-shell.exe"
      : "chrome-headless-shell";
    const binaryPath = join(nested, binaryName);
    Deno.writeTextFileSync(binaryPath, "fake binary");

    const found = findChromeExecutable(tempDir, "chrome-headless-shell");
    assert(found !== undefined, "should find the binary in nested dir");
  } finally {
    safeRemoveSync(tempDir, { recursive: true });
  }
});

// Step 3b: findChromeExecutable() — Playwright arm64 layout
// Skip on Windows: arm64 layout is Linux-only, no .exe extension.
unitTest("findChromeExecutable - finds binary in Playwright arm64 layout", async () => {
  if (isWindows) return; // arm64 layout is Linux-only
  const tempDir = Deno.makeTempDirSync();
  try {
    // Playwright arm64 extracts to chrome-linux/headless_shell
    const subdir = join(tempDir, "chrome-linux");
    Deno.mkdirSync(subdir);
    Deno.writeTextFileSync(join(subdir, "headless_shell"), "fake binary");

    const found = findChromeExecutable(tempDir, "headless_shell");
    assert(found !== undefined, "should find headless_shell in chrome-linux/");
    assert(found!.endsWith("headless_shell"), `should end with headless_shell, got: ${found}`);
  } finally {
    safeRemoveSync(tempDir, { recursive: true });
  }
});

// Playwright CDN tests — skip on CI (external HTTP)
unitTest("fetchPlaywrightBrowsersJson - returns chromium-headless-shell entry", async () => {
  const entry = await fetchPlaywrightBrowsersJson();
  assert(entry.revision, "revision should be non-empty");
  assert(
    /^\d+$/.test(entry.revision),
    `revision should be numeric, got: ${entry.revision}`,
  );
  assert(entry.browserVersion, "browserVersion should be non-empty");
  assert(
    /^\d+\.\d+\.\d+\.\d+$/.test(entry.browserVersion),
    `browserVersion format wrong: ${entry.browserVersion}`,
  );
}, { ignore: runningInCI() });

unitTest("playwrightCdnDownloadUrl - constructs correct arm64 URL", async () => {
  const url = playwrightCdnDownloadUrl("1219");
  assert(
    url.startsWith("https://cdn.playwright.dev/"),
    `URL should start with cdn.playwright.dev, got: ${url}`,
  );
  assert(
    url.includes("/builds/chromium/1219/"),
    `URL should contain revision path, got: ${url}`,
  );
  assert(
    url.endsWith("chromium-headless-shell-linux-arm64.zip"),
    `URL should end with arm64 zip name, got: ${url}`,
  );
});

unitTest("isPlaywrightCdnPlatform - returns false on non-arm64 platform", async () => {
  // On CI (which is not arm64 Linux), this should return false.
  // We can't test the true case on non-arm64 machines without mocking.
  if (os === "linux" && arch === "aarch64") return; // Skip on actual arm64
  const result = isPlaywrightCdnPlatform();
  assertEquals(result, false);
});

// Step 4: downloadAndExtractChrome() — integration test, downloads ~50MB
unitTest(
  "downloadAndExtractChrome - downloads and extracts chrome-headless-shell",
  async () => {
    const release = await fetchLatestCftRelease();
    const { platform } = detectChromePlatform();
    const downloads = release.downloads["chrome-headless-shell"]!;
    const dl = downloads.find((d) => d.platform === platform);
    assert(dl, `No download found for platform ${platform}`);

    const targetDir = Deno.makeTempDirSync();
    try {
      const mockContext: InstallContext = {
        workingDir: targetDir,
        info: (_msg: string) => {},
        withSpinner: async (_options, op) => {
          await op();
        },
        error: (_msg: string) => {},
        confirm: async (_msg: string) => true,
        download: async (_name: string, url: string, target: string) => {
          const resp = await fetch(url);
          if (!resp.ok) throw new Error(`Download failed: ${resp.status}`);
          const data = new Uint8Array(await resp.arrayBuffer());
          Deno.writeFileSync(target, data);
        },
        props: {},
        flags: {},
      };

      await downloadAndExtractChrome("Chrome Headless Shell", dl!.url, targetDir, mockContext, "chrome-headless-shell");

      const found = findChromeExecutable(targetDir, "chrome-headless-shell");
      assert(
        found !== undefined,
        "should find chrome-headless-shell after extraction",
      );
    } finally {
      safeRemoveSync(targetDir, { recursive: true });
    }
  },
  {
    ignore: runningInCI(),
  },
);
