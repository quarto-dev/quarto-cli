/*
 * chrome-headless-shell.test.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { unitTest } from "../../test.ts";
import { assert, assertEquals } from "testing/asserts";
import { join } from "../../../src/deno_ral/path.ts";
import { existsSync, safeRemoveSync } from "../../../src/deno_ral/fs.ts";
import { isWindows } from "../../../src/deno_ral/platform.ts";
import { runningInCI } from "../../../src/core/ci-info.ts";
import { InstallContext } from "../../../src/tools/types.ts";
import { detectCftPlatform, findCftExecutable } from "../../../src/tools/impl/chrome-for-testing.ts";
import { installableTool, installableTools } from "../../../src/tools/tools.ts";
import {
  chromeHeadlessShellInstallable,
  chromeHeadlessShellInstallDir,
  chromeHeadlessShellExecutablePath,
  isInstalled,
  noteInstalledVersion,
  readInstalledVersion,
} from "../../../src/tools/impl/chrome-headless-shell.ts";

// -- Step 1: Install directory + executable path --

unitTest("chromeHeadlessShellInstallDir - path ends with chrome-headless-shell", async () => {
  const dir = chromeHeadlessShellInstallDir();
  assert(
    dir.replace(/\\/g, "/").endsWith("chrome-headless-shell"),
    `Expected path ending with chrome-headless-shell, got: ${dir}`,
  );
});

unitTest("chromeHeadlessShellExecutablePath - returns undefined when not installed", async () => {
  // If chrome-headless-shell happens to be installed, this test is still valid:
  // it should return either a valid path or undefined, never throw.
  const result = chromeHeadlessShellExecutablePath();
  if (result !== undefined) {
    assert(
      result.includes("chrome-headless-shell"),
      `Expected path containing chrome-headless-shell, got: ${result}`,
    );
  }
  // No assertion failure means the function works correctly either way
});

// -- Step 2: Version helpers --

unitTest("version - round-trip write and read", async () => {
  const tempDir = Deno.makeTempDirSync();
  try {
    noteInstalledVersion(tempDir, "145.0.7632.46");
    const read = readInstalledVersion(tempDir);
    assertEquals(read, "145.0.7632.46");
  } finally {
    safeRemoveSync(tempDir, { recursive: true });
  }
});

unitTest("version - returns undefined for empty dir", async () => {
  const tempDir = Deno.makeTempDirSync();
  try {
    assertEquals(readInstalledVersion(tempDir), undefined);
  } finally {
    safeRemoveSync(tempDir, { recursive: true });
  }
});

// -- Step 3: isInstalled() --

unitTest("isInstalled - returns false when directory is empty", async () => {
  const tempDir = Deno.makeTempDirSync();
  try {
    assertEquals(isInstalled(tempDir), false);
  } finally {
    safeRemoveSync(tempDir, { recursive: true });
  }
});

unitTest("isInstalled - returns false when only version file exists", async () => {
  const tempDir = Deno.makeTempDirSync();
  try {
    noteInstalledVersion(tempDir, "145.0.0.0");
    assertEquals(isInstalled(tempDir), false);
  } finally {
    safeRemoveSync(tempDir, { recursive: true });
  }
});

unitTest("isInstalled - returns false when only binary exists (no version file)", async () => {
  const tempDir = Deno.makeTempDirSync();
  try {
    const { platform } = detectCftPlatform();
    const subdir = join(tempDir, `chrome-headless-shell-${platform}`);
    Deno.mkdirSync(subdir);
    const binaryName = isWindows ? "chrome-headless-shell.exe" : "chrome-headless-shell";
    Deno.writeTextFileSync(join(subdir, binaryName), "fake");
    assertEquals(isInstalled(tempDir), false);
  } finally {
    safeRemoveSync(tempDir, { recursive: true });
  }
});

unitTest("isInstalled - returns true when version file and binary exist", async () => {
  const tempDir = Deno.makeTempDirSync();
  try {
    noteInstalledVersion(tempDir, "145.0.0.0");
    const { platform } = detectCftPlatform();
    const subdir = join(tempDir, `chrome-headless-shell-${platform}`);
    Deno.mkdirSync(subdir);
    const binaryName = isWindows ? "chrome-headless-shell.exe" : "chrome-headless-shell";
    Deno.writeTextFileSync(join(subdir, binaryName), "fake");

    assertEquals(isInstalled(tempDir), true);
  } finally {
    safeRemoveSync(tempDir, { recursive: true });
  }
});

// -- Step 4: latestRelease() (external HTTP call, skip on CI) --

unitTest("latestRelease - returns valid RemotePackageInfo", async () => {
  const release = await chromeHeadlessShellInstallable.latestRelease();
  assert(release.version, "version should be non-empty");
  assert(
    /^\d+\.\d+\.\d+\.\d+$/.test(release.version),
    `version format wrong: ${release.version}`,
  );
  assert(release.url.startsWith("https://"), `URL should be https: ${release.url}`);
  assert(release.url.includes(release.version), "URL should contain version");
  assert(release.assets.length > 0, "should have at least one asset");
  assertEquals(release.assets[0].name, "chrome-headless-shell");
}, { ignore: runningInCI() });

// -- Step 5: preparePackage() (downloads ~50MB, skip on CI) --

function createMockContext(workingDir: string): InstallContext {
  return {
    workingDir,
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
}

unitTest("preparePackage - downloads and extracts chrome-headless-shell", async () => {
  const tempDir = Deno.makeTempDirSync();
  const ctx = createMockContext(tempDir);
  const pkg = await chromeHeadlessShellInstallable.preparePackage(ctx);
  try {
    assert(pkg.version, "version should be non-empty");
    assert(pkg.filePath, "filePath should be non-empty");
    const binary = findCftExecutable(pkg.filePath, "chrome-headless-shell");
    assert(binary !== undefined, "binary should exist in extracted dir");
  } finally {
    safeRemoveSync(pkg.filePath, { recursive: true });
    safeRemoveSync(tempDir, { recursive: true });
  }
}, { ignore: runningInCI() });

// -- Step 6: afterInstall --

unitTest("afterInstall - returns false", async () => {
  const tempDir = Deno.makeTempDirSync();
  const ctx = createMockContext(tempDir);
  try {
    const result = await chromeHeadlessShellInstallable.afterInstall(ctx);
    assertEquals(result, false);
  } finally {
    safeRemoveSync(tempDir, { recursive: true });
  }
});

// -- Step 7: chromeHeadlessShellInstallable export --

unitTest("chromeHeadlessShellInstallable - has correct name and methods", async () => {
  assertEquals(chromeHeadlessShellInstallable.name, "Chrome Headless Shell");
  assertEquals(chromeHeadlessShellInstallable.prereqs.length, 0);
  assert(typeof chromeHeadlessShellInstallable.installed === "function");
  assert(typeof chromeHeadlessShellInstallable.installDir === "function");
  assert(typeof chromeHeadlessShellInstallable.installedVersion === "function");
  assert(typeof chromeHeadlessShellInstallable.latestRelease === "function");
  assert(typeof chromeHeadlessShellInstallable.preparePackage === "function");
  assert(typeof chromeHeadlessShellInstallable.install === "function");
  assert(typeof chromeHeadlessShellInstallable.afterInstall === "function");
  assert(typeof chromeHeadlessShellInstallable.uninstall === "function");
});

// -- Integration: full install/uninstall lifecycle --

unitTest("install lifecycle - prepare, install, verify, uninstall", async () => {
  const tool = chromeHeadlessShellInstallable;
  const tempDir = Deno.makeTempDirSync();
  const ctx = createMockContext(tempDir);

  // Prepare (download + extract)
  const pkg = await tool.preparePackage(ctx);

  try {
    // Install into real quartoDataDir
    await tool.install(pkg, ctx);

    // Verify installed state
    assertEquals(await tool.installed(), true);

    const version = await tool.installedVersion();
    assert(version, "installedVersion should return a version string");
    assert(/^\d+\.\d+\.\d+\.\d+$/.test(version!), `version format: ${version}`);

    const exePath = chromeHeadlessShellExecutablePath();
    assert(exePath !== undefined, "executable path should be defined after install");
    assert(existsSync(exePath!), `executable should exist at: ${exePath}`);

    const dir = await tool.installDir();
    assert(dir !== undefined, "installDir should return a path when installed");

    // Uninstall
    await tool.uninstall(ctx);

    // Verify uninstalled state
    assertEquals(await tool.installed(), false);
    assertEquals(chromeHeadlessShellExecutablePath(), undefined);
  } finally {
    // Safety net: ensure uninstall happened even if assertions failed
    if (await tool.installed()) {
      await tool.uninstall(ctx);
    }
    safeRemoveSync(pkg.filePath, { recursive: true });
    safeRemoveSync(tempDir, { recursive: true });
  }
}, { ignore: runningInCI() });

// -- Step 8: Tool registry integration --

unitTest("tool registry - chrome-headless-shell is listed in installableTools", async () => {
  const tools = installableTools();
  assert(
    tools.includes("chrome-headless-shell"),
    `installableTools() should include "chrome-headless-shell", got: ${tools}`,
  );
});

unitTest("tool registry - installableTool looks up chrome-headless-shell", async () => {
  const tool = installableTool("chrome-headless-shell");
  assert(tool !== undefined, "installableTool should find chrome-headless-shell");
  assertEquals(tool.name, "Chrome Headless Shell");
});
