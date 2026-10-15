# PR 07: `deno.land/x/puppeteer` port to npm `puppeteer-core`

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Deno port of puppeteer 9 (`https://deno.land/x/puppeteer@9.0.2/mod.ts`) with `npm:puppeteer-core@25.14.0` for browser launching, and move the deprecated `chromium` tool off puppeteer's removed `BrowserFetcher` onto plain filesystem code, keeping Quarto's own Chromium download (`chrome-headless-shell`) untouched.
**Phase:** 0. **Depends on:** none. **Unblocks:** PR 26 (the spike stubbed puppeteer; mermaid, screenshots and `quarto check` tools were not exercised on Node).
**Branch:** `rt/07-deps-puppeteer-core`.
**Suggested executor:** Opus. The puppeteer API moved a lot between 9 and 25 (`BrowserFetcher` is gone, headless modes changed) and the only way to see a launch work is with a real Chrome; the executor must read test failures with care.
**Size:** M (import map, 3 source files, 1 new source file, 2 new unit tests, `src/vendor_deps.ts`).
**Ships on:** Deno; the existing test suite must stay green.

## Spec

### Context

`00-assessment.md` section 3.4 (puppeteer row) and section 10, finding 7. The import map resolves `puppeteer` to `https://deno.land/x/puppeteer@9.0.2/mod.ts` (lucacasonato's port of puppeteer 9, 2021). It is imported by exactly one file, `src/core/puppeteer.ts:14`, and listed in `src/vendor_deps.ts:12` for the dependency cache; three `https://deno.land/std@0.93.0/...` redirect entries in the import map (`:67-69`) exist for the port's own std imports.

What the port is used for today (verified by reading `src/core/puppeteer.ts` and grepping the callers of its exports):

| API of the port | Where | Callers outside `src/core/puppeteer.ts` |
|---|---|---|
| `puppeteer.launch({ product: "chrome", executablePath })`, `browser.newPage()`, `page.goto()`, `page.setViewport()`, `page.$$()`, `elementHandle.screenshot({ path })`, `page.evaluate(fn, ...params)`, `browser.close()` | `withHeadlessBrowser` (193-210), `withPuppeteerBrowserAndPage` (100-149), `inPuppeteer` (151-191), `extractImagesFromElements` (42-72), `extractHtmlFromElements` (74-86) | **none** (`grep -rn` for each name finds only the comment in `src/core/cri/launch.ts:14-16`). Mermaid rendering and the axe scanner drive Chrome through Quarto's own CDP client (`src/core/cri/`), not puppeteer. These helpers are a second, currently unused, launch path. |
| `puppeteer.createBrowserFetcher({ path })` → `localRevisions()`, `revisionInfo(rev)` (`.executablePath`, `.url`, `.folderPath`, `.revision`), `download(rev, cb)`, `remove(rev)`; `puppeteer._preferredRevision` (`"869685"` in 9.0.2) | `fetcher()` (386-392), `chromiumInstallDir()` (394-396), the legacy fallback in `getBrowserExecutablePath()` (362-371) | `src/tools/impl/chromium.ts` (the whole file: `installed`, `installedVersion`, `latestRelease`, `preparePackage`, `uninstall`, `supportedRevision`) |
| nothing else | `findChrome`, `detectBrowser`, `getBrowserExecutablePath` (the shared browser discovery) | `src/command/check/check.ts:35` (`detectBrowser`), `src/core/cri/launch.ts:29` and `tests/smoke/axe/axe-findings.test.ts` (`getBrowserExecutablePath`) |

`chromium` is a deprecated tool: `src/tools/tools.ts:40-41` ("deprecated in v1.10, to be removed from the registry in v1.11"; `configuration` says `QUARTO_VERSION=1.11`), `installTool("chromium")` redirects to `chrome-headless-shell` (`tools.ts:125-132`, tested by the "Chromium deprecation redirect" job in `.github/workflows/test-install.yml`), and `allTools()` hides it from the not-installed list (`tools.ts:57-60`). What still has to work: `quarto check` and `quarto tools list` show "Chromium (deprecated)" with its revision when an old download exists (`check.ts:421-425` prints the replacement hint), `quarto uninstall chromium` removes it, and `getBrowserExecutablePath()` falls back to an old download when nothing newer is installed. None of that needs puppeteer: the on-disk layout written by puppeteer 9's `BrowserFetcher` (`vendor/puppeteer-core/...`, `src/deno/BrowserFetcher.ts` at tag 9.0.2, read from GitHub) is `<quartoDataDir("chromium")>/<platform>-<revision>/<archive>/<executable>` with `platform` in `linux | mac | win32 | win64` (from `Deno.build.os`/`arch`), `archive` = `chrome-linux` | `chrome-mac` | `chrome-win` (revisions above 591479) and executable `chrome` | `Chromium.app/Contents/MacOS/Chromium` | `chrome.exe`; the download URL is `https://storage.googleapis.com/chromium-browser-snapshots/<Linux_x64|Mac|Win|Win_x64>/<revision>/<archive>.zip`.

`puppeteer-core` facts (verified in this sandbox, Deno 2.7.14 against the npm registry): latest **25.14.0**, `engines.node >=22.12.0`, dependencies `ws`, `chromium-bidi`, `devtools-protocol`, `@puppeteer/browsers` 3.2.5, `typed-query-selector`, `webdriver-bidi-protocol`. `import puppeteer, { type Browser, type Page, type LaunchOptions } from "npm:puppeteer-core@25.14.0"` type-checks; `puppeteer.launch({ executablePath: "/nonexistent/chrome", headless: true })` rejects with `Browser was not found at the configured executablePath (/nonexistent/chrome)`, so the launch path runs up to the spawn without a browser. API mapping from the port (puppeteer 9) to 25:

| puppeteer 9 (port) | puppeteer-core 25 |
|---|---|
| `launch({ product: "chrome", executablePath })` | `launch({ executablePath, headless, args })`; `product` is gone (`browser: "chrome"` is the default). `headless: true` passes `--headless=new`, `headless: "shell"` passes `--headless` and is meant for the `chrome-headless-shell` binary that Quarto installs. `args` are appended. |
| `page.setViewport(v)` (sync-ish) | `await page.setViewport(v)` (async) |
| `elementHandle.screenshot({ path })` | `path` is typed as `` `${string}.png` `` etc.; use `const png = await handle.screenshot()` (returns `Uint8Array`) and write it with `Deno.writeFileSync`. |
| `page.$$(sel)`, `page.goto(url)`, `page.evaluate(fn, ...args)`, `browser.newPage()`, `browser.close()` | unchanged |
| `createBrowserFetcher`, `BrowserFetcher`, `_preferredRevision` | removed in puppeteer 20 (`@puppeteer/browsers` replaced them with a different cache layout). Reimplemented as filesystem helpers (Task 1). |

Headless flags: `src/core/cri/launch.ts:261-278` launches Chrome with `--headless` (old mode unless `QUARTO_CHROMIUM_HEADLESS_MODE` says otherwise), `--no-sandbox`, `--disable-gpu`; the puppeteer path mirrors that: `"shell"` for a `chrome-headless-shell*` executable, `true` (new headless) for full Chrome/Edge, plus the two flags.

### Scope

In:
- `src/import_map.json`: `puppeteer` → `npm:puppeteer-core@25.14.0`; remove the three `std@0.93.0` redirects if `deno info` proves them unused;
- `src/core/puppeteer.ts`: launch helpers on puppeteer-core with real types; legacy fallback on the new helpers; `fetcher`/`getPuppeteer`/`chromiumInstallDir` removed;
- new `src/tools/impl/chromium-legacy-paths.ts` (pure path helpers, no cycle between `tools/impl/chromium.ts` and `core/puppeteer.ts`);
- `src/tools/impl/chromium.ts` on those helpers; `preparePackage` refuses with a message pointing at `chrome-headless-shell`;
- `src/vendor_deps.ts`: drop the puppeteer/jszip/std@0.93 lines;
- unit tests for the helpers and for the launch path.

Out:
- `chrome-headless-shell` and `chrome-for-testing` (unchanged; they are Quarto's own download);
- `src/core/cri/` (own CDP client; unchanged);
- deleting the deprecated `chromium` tool or the unused launch helpers (Decisions);
- renaming `src/core/puppeteer.ts`.

### Interfaces

`src/tools/impl/chromium-legacy-paths.ts` (new):

```ts
/** Chromium snapshot revision pinned by puppeteer 9.0.2 (PUPPETEER_REVISIONS.chromium); the only revision `quarto install chromium` ever downloaded. */
export const kChromiumRevision = "869685";
export type ChromiumPlatform = "linux" | "mac" | "win32" | "win64";
/** Platform key in the legacy cache directory names, derived from the running OS/arch like puppeteer 9 did. */
export function chromiumPlatform(): ChromiumPlatform;
/** `quartoDataDir("chromium")`: where `quarto install chromium` used to download. */
export function chromiumInstallDir(): string;
/** Revisions present under `dir` for `platform`, newest first. Reads entries named `<platform>-<digits>` that are directories. Returns [] when `dir` does not exist. */
export function chromiumLocalRevisions(dir: string, platform: ChromiumPlatform): string[];
/** `<dir>/<platform>-<revision>` */
export function chromiumRevisionDir(dir: string, platform: ChromiumPlatform, revision: string): string;
/** The browser executable inside a revision directory, per platform (same layout puppeteer 9 wrote). */
export function chromiumExecutablePath(dir: string, platform: ChromiumPlatform, revision: string): string;
/** The snapshot zip URL puppeteer 9 downloaded, for `latestRelease()` reporting. */
export function chromiumDownloadUrl(platform: ChromiumPlatform, revision: string): string;
```

`src/core/puppeteer.ts` after this PR:

```ts
export interface PageOptions { url: string; viewport?: { width: number; height: number; deviceScaleFactor?: number; isMobile?: boolean; hasTouch?: boolean; isLandscape?: boolean } };
/** Launch the browser at `executablePath` headless (puppeteer-core). Rejects if the executable cannot be started. */
export function launchHeadlessBrowser(executablePath: string): Promise<Browser>;
export function withHeadlessBrowser<T>(fn: (browser: Browser) => Promise<T>): Promise<T>;
export function withPuppeteerBrowserAndPage<T>(url: string | PageOptions, f: (b: Browser, p: Page) => Promise<T>): Promise<T>;
export function inPuppeteer(url: string, f: (...args: unknown[]) => unknown, ...params: unknown[]): Promise<unknown>;
export function extractImagesFromElements(urlOrOptions: string | PageOptions, selector: string, filenames: string[]): Promise<string[]>;
export function extractHtmlFromElements(url: string, selector: string): Promise<string[]>;
export function findChrome(): Promise<ChromeInfo>;                 // unchanged
export interface BrowserDetection { ... }; export interface BrowserDetectionResult { ... }   // unchanged
export function detectBrowser(): Promise<BrowserDetectionResult>;  // unchanged
export function getBrowserExecutablePath(): Promise<string>;       // unchanged contract; legacy fallback uses chromiumLocalRevisions/chromiumExecutablePath
// removed: getPuppeteer, fetcher, chromiumInstallDir (moved to tools/impl/chromium-legacy-paths.ts)
```

`src/tools/impl/chromium.ts`: `chromiumInstallable: InstallableTool` keeps its shape (`src/tools/types.ts:12-25`); `preparePackage` rejects with `Error("The 'chromium' tool is deprecated and can no longer be downloaded. Run 'quarto install chrome-headless-shell' instead.")`.

### Files

- Modify: `src/import_map.json:59` (`puppeteer`), `:67-69` (`std@0.93.0` redirects, if unused)
- Create: `src/tools/impl/chromium-legacy-paths.ts`
- Modify: `src/tools/impl/chromium.ts` (whole file)
- Modify: `src/core/puppeteer.ts` (lines 1-30, 42-210, 348-396)
- Modify: `src/vendor_deps.ts:10-14`
- Test: `tests/unit/tools/chromium-legacy-paths.test.ts` (new)
- Test: `tests/unit/core/puppeteer.test.ts` (new)
- Modify: `dev-docs/runtime-migration/README.md` (PR 07 row status)

### Acceptance criteria

- `grep -n 'deno.land/x/puppeteer\|std@0.93.0' src/import_map.json src/vendor_deps.ts` prints nothing (redirects only if the `deno info` script says `UNUSED`).
- `grep -rn 'createBrowserFetcher\|_preferredRevision\|from "puppeteer"' src --include=*.ts` lists only `src/core/puppeteer.ts` for the import.
- `package/dist/bin/tools/x86_64/deno check --import-map src/import_map.json src/quarto.ts` exits 0 with the real `puppeteer-core` types (no `any` left on `Browser`/`Page` parameters).
- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/tools/chromium-legacy-paths.test.ts unit/core/puppeteer.test.ts` passes (the browser-dependent tests are skipped when no Chrome is detected and pass when one is).
- `package/dist/bin/quarto check` prints the `Checking tools` and `Checking Chrome Headless` sections; with an old `~/.local/share/quarto/chromium/linux-869685` (or platform equivalent) directory present it prints `Chromium (deprecated): 869685` and the replacement hint.
- `package/dist/bin/quarto install chromium --no-prompt` still prints the deprecation warning and installs `chrome-headless-shell` (unchanged code path, re-verified); `package/dist/bin/quarto uninstall chromium` removes the legacy directory.
- Mermaid smoke documents render (CRI path, shares `getBrowserExecutablePath`); `Bundle Test` is green (puppeteer-core bundles).

## Plan

### Task 1: Legacy Chromium path helpers

**Files:**
- Create: `src/tools/impl/chromium-legacy-paths.ts`
- Test: `tests/unit/tools/chromium-legacy-paths.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/tools/chromium-legacy-paths.test.ts`:

```ts
/*
 * chromium-legacy-paths.test.ts
 *
 * The deprecated `chromium` tool reads the directory layout puppeteer 9's
 * BrowserFetcher wrote: <dir>/<platform>-<revision>/<archive>/<executable>.
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { unitTest } from "../../test.ts";
import { assertEquals } from "testing/asserts";
import { join } from "../../../src/deno_ral/path.ts";
import { ensureDirSync } from "../../../src/deno_ral/fs.ts";
import { createTempContext } from "../../../src/core/temp.ts";
import {
  chromiumDownloadUrl,
  chromiumExecutablePath,
  chromiumLocalRevisions,
  chromiumRevisionDir,
  kChromiumRevision,
} from "../../../src/tools/impl/chromium-legacy-paths.ts";

// deno-lint-ignore require-await
unitTest("chromium-legacy-paths - local revisions, newest first, per platform", async () => {
  const temp = createTempContext();
  try {
    const dir = temp.createDir();
    ensureDirSync(join(dir, "linux-800000", "chrome-linux"));
    ensureDirSync(join(dir, "linux-869685", "chrome-linux"));
    ensureDirSync(join(dir, "mac-869685", "chrome-mac"));
    ensureDirSync(join(dir, "junk"));
    Deno.writeTextFileSync(join(dir, "linux-1"), "a file, not a directory");
    assertEquals(chromiumLocalRevisions(dir, "linux"), ["869685", "800000"]);
    assertEquals(chromiumLocalRevisions(dir, "mac"), ["869685"]);
    assertEquals(chromiumLocalRevisions(dir, "win64"), []);
    assertEquals(chromiumLocalRevisions(join(dir, "missing"), "linux"), []);
  } finally {
    temp.cleanup();
  }
});

// deno-lint-ignore require-await
unitTest("chromium-legacy-paths - executable path per platform", async () => {
  const dir = "root";
  assertEquals(chromiumRevisionDir(dir, "linux", "869685"), join("root", "linux-869685"));
  assertEquals(
    chromiumExecutablePath(dir, "linux", "869685"),
    join("root", "linux-869685", "chrome-linux", "chrome"),
  );
  assertEquals(
    chromiumExecutablePath(dir, "mac", "869685"),
    join("root", "mac-869685", "chrome-mac", "Chromium.app", "Contents", "MacOS", "Chromium"),
  );
  assertEquals(
    chromiumExecutablePath(dir, "win64", "869685"),
    join("root", "win64-869685", "chrome-win", "chrome.exe"),
  );
  // archive name changed at r591479
  assertEquals(
    chromiumExecutablePath(dir, "win32", "500000"),
    join("root", "win32-500000", "chrome-win32", "chrome.exe"),
  );
});

// deno-lint-ignore require-await
unitTest("chromium-legacy-paths - download url and pinned revision", async () => {
  assertEquals(kChromiumRevision, "869685");
  assertEquals(
    chromiumDownloadUrl("linux", kChromiumRevision),
    "https://storage.googleapis.com/chromium-browser-snapshots/Linux_x64/869685/chrome-linux.zip",
  );
  assertEquals(
    chromiumDownloadUrl("mac", kChromiumRevision),
    "https://storage.googleapis.com/chromium-browser-snapshots/Mac/869685/chrome-mac.zip",
  );
  assertEquals(
    chromiumDownloadUrl("win32", kChromiumRevision),
    "https://storage.googleapis.com/chromium-browser-snapshots/Win/869685/chrome-win.zip",
  );
  assertEquals(
    chromiumDownloadUrl("win64", kChromiumRevision),
    "https://storage.googleapis.com/chromium-browser-snapshots/Win_x64/869685/chrome-win.zip",
  );
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/tools/chromium-legacy-paths.test.ts`
Expected: FAIL, `Module not found ".../src/tools/impl/chromium-legacy-paths.ts"`.

- [ ] **Step 3: Implement**

Create `src/tools/impl/chromium-legacy-paths.ts`:

```ts
/*
 * chromium-legacy-paths.ts
 *
 * Path helpers for the deprecated `chromium` tool. `quarto install chromium`
 * (Quarto <= 1.9) used puppeteer 9's BrowserFetcher, which stored a
 * Chromium snapshot at <quartoDataDir("chromium")>/<platform>-<revision>/
 * <archive>/<executable>. The tool now only reads that layout (to report and
 * uninstall old downloads, and to fall back to one when no newer browser is
 * installed); new installs go to chrome-headless-shell.
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { join } from "../../deno_ral/path.ts";
import { existsSync, walkSync } from "../../deno_ral/fs.ts";
import { arch, isMac, isWindows } from "../../deno_ral/platform.ts";
import { quartoDataDir } from "../../core/appdirs.ts";

/** Chromium snapshot revision pinned by puppeteer 9.0.2 (PUPPETEER_REVISIONS.chromium). */
export const kChromiumRevision = "869685";

export type ChromiumPlatform = "linux" | "mac" | "win32" | "win64";

export function chromiumPlatform(): ChromiumPlatform {
  if (isMac) {
    return "mac";
  }
  if (isWindows) {
    return arch === "x86_64" ? "win64" : "win32";
  }
  return "linux";
}

export function chromiumInstallDir(): string {
  return quartoDataDir("chromium");
}

export function chromiumRevisionDir(
  dir: string,
  platform: ChromiumPlatform,
  revision: string,
): string {
  return join(dir, `${platform}-${revision}`);
}

function archiveName(platform: ChromiumPlatform, revision: string): string {
  switch (platform) {
    case "linux":
      return "chrome-linux";
    case "mac":
      return "chrome-mac";
    case "win32":
    case "win64":
      // Windows archive name changed at r591479
      return parseInt(revision, 10) > 591479 ? "chrome-win" : "chrome-win32";
  }
}

export function chromiumExecutablePath(
  dir: string,
  platform: ChromiumPlatform,
  revision: string,
): string {
  const archive = join(chromiumRevisionDir(dir, platform, revision), archiveName(platform, revision));
  switch (platform) {
    case "linux":
      return join(archive, "chrome");
    case "mac":
      return join(archive, "Chromium.app", "Contents", "MacOS", "Chromium");
    case "win32":
    case "win64":
      return join(archive, "chrome.exe");
  }
}

export function chromiumLocalRevisions(
  dir: string,
  platform: ChromiumPlatform,
): string[] {
  if (!existsSync(dir)) {
    return [];
  }
  const prefix = `${platform}-`;
  const revisions: string[] = [];
  // walkSync with maxDepth 1 yields `dir` itself and its direct children;
  // using it instead of Deno.readDirSync keeps this file inside the runtime
  // boundary (dev-docs/runtime-migration/02-runtime-boundary-check.md).
  for (
    const entry of walkSync(dir, {
      maxDepth: 1,
      includeFiles: false,
      includeDirs: true,
    })
  ) {
    if (entry.path === dir || !entry.name.startsWith(prefix)) {
      continue;
    }
    const revision = entry.name.slice(prefix.length);
    if (/^\d+$/.test(revision)) {
      revisions.push(revision);
    }
  }
  return revisions.sort((a, b) => Number(b) - Number(a));
}

const kSnapshotHost = "https://storage.googleapis.com/chromium-browser-snapshots";
const kSnapshotDirs: Record<ChromiumPlatform, string> = {
  linux: "Linux_x64",
  mac: "Mac",
  win32: "Win",
  win64: "Win_x64",
};

export function chromiumDownloadUrl(
  platform: ChromiumPlatform,
  revision: string,
): string {
  return `${kSnapshotHost}/${kSnapshotDirs[platform]}/${revision}/${archiveName(platform, revision)}.zip`;
}
```

- [ ] **Step 4: Run the test**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/tools/chromium-legacy-paths.test.ts`
Expected: `3 passed`.

- [ ] **Step 5: Commit**

```bash
git add src/tools/impl/chromium-legacy-paths.ts tests/unit/tools/chromium-legacy-paths.test.ts
git commit -m "Add filesystem helpers for the legacy chromium tool layout"
```

### Task 2: `src/tools/impl/chromium.ts` without puppeteer

**Files:**
- Modify: `src/tools/impl/chromium.ts` (whole file)

- [ ] **Step 1: Rewrite the file**

Replace the whole of `src/tools/impl/chromium.ts` with:

```ts
/*
 * chromium.ts
 *
 * The deprecated `chromium` tool. New installs are redirected to
 * chrome-headless-shell (src/tools/tools.ts, installTool); this module only
 * reports, falls back to and uninstalls downloads made by Quarto <= 1.9.
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { existsSync, safeRemoveSync } from "../../deno_ral/fs.ts";
import { withSpinner } from "../../core/console.ts";
import { InstallableTool, InstallContext, PackageInfo } from "../types.ts";
import {
  chromiumDownloadUrl,
  chromiumInstallDir,
  chromiumLocalRevisions,
  chromiumPlatform,
  chromiumRevisionDir,
  kChromiumRevision,
} from "./chromium-legacy-paths.ts";

async function installDir() {
  if (await installed()) {
    return Promise.resolve(chromiumInstallDir());
  } else {
    return Promise.resolve(undefined);
  }
}

export const chromiumInstallable: InstallableTool = {
  name: "Chromium (deprecated)",
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

export function installed(): Promise<boolean> {
  const revisions = chromiumLocalRevisions(chromiumInstallDir(), chromiumPlatform());
  return Promise.resolve(revisions.includes(kChromiumRevision));
}

function installedVersion(): Promise<string | undefined> {
  const revisions = chromiumLocalRevisions(chromiumInstallDir(), chromiumPlatform());
  return Promise.resolve(revisions[0]);
}

function latestRelease() {
  return Promise.resolve({
    url: chromiumDownloadUrl(chromiumPlatform(), kChromiumRevision),
    version: kChromiumRevision,
    assets: [{ name: "", url: "" }],
  });
}

function preparePackage(_ctx: InstallContext): Promise<PackageInfo> {
  return Promise.reject(
    new Error(
      "The 'chromium' tool is deprecated and can no longer be downloaded. Run 'quarto install chrome-headless-shell' instead.",
    ),
  );
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
  }, () => {
    const dir = chromiumRevisionDir(
      chromiumInstallDir(),
      chromiumPlatform(),
      kChromiumRevision,
    );
    if (existsSync(dir)) {
      safeRemoveSync(dir, { recursive: true });
    }
    return Promise.resolve();
  });
}
```

- [ ] **Step 2: Type-check**

Run: `package/dist/bin/tools/x86_64/deno check --import-map src/import_map.json src/tools/impl/chromium.ts src/tools/tools.ts`
Expected: exit 0. (The `fetcher`/`getPuppeteer` imports from `core/puppeteer.ts` are gone from this file; `core/puppeteer.ts` still exports them until Task 3, which is fine.)

- [ ] **Step 3: Exercise the tool commands with a fake legacy download**

Run (Linux; on macOS use `mac-869685/chrome-mac/Chromium.app/Contents/MacOS/Chromium`, on Windows `win64-869685\chrome-win\chrome.exe` under `%LOCALAPPDATA%\quarto\chromium`):
```bash
printf 'import { chromiumInstallDir } from "%s/src/tools/impl/chromium-legacy-paths.ts";\nconsole.log(chromiumInstallDir());\n' "$PWD" > /tmp/rt07-dir.ts
LEGACY="$(package/dist/bin/quarto run --dev /tmp/rt07-dir.ts)"
mkdir -p "$LEGACY/linux-869685/chrome-linux" && touch "$LEGACY/linux-869685/chrome-linux/chrome" && chmod +x "$LEGACY/linux-869685/chrome-linux/chrome"
package/dist/bin/quarto tools list
package/dist/bin/quarto check install 2>&1 | grep -A1 'Chromium (deprecated)'
package/dist/bin/quarto update chromium; echo "exit=$?"
package/dist/bin/quarto uninstall chromium && ls "$LEGACY"
package/dist/bin/quarto install chromium --no-prompt 2>&1 | head -3
```
Expected: `tools list` prints a `Chromium (deprecated)` row (columns Tool, Status, Installed, Latest) whose Installed and Latest cells are both `869685`; `check install` prints `Chromium (deprecated): 869685` followed by `(Run "quarto install chrome-headless-shell" to replace)`; `update chromium` prints the deprecation error from `preparePackage` and does not crash (`exit=0`, `updateTool` logs the error); `uninstall chromium` prints `Uninstallation successful` and `linux-869685` is gone; `install chromium` prints `'chromium' is deprecated. Installing 'chrome-headless-shell' instead.` (interrupt it with Ctrl-C if you do not want the download, or let it finish). On Windows, write the same two lines to `%TEMP%\rt07-dir.ts` with the repository path spelled out and run `quarto run --dev %TEMP%\rt07-dir.ts`.

- [ ] **Step 4: Commit**

```bash
git add src/tools/impl/chromium.ts
git commit -m "Read the legacy chromium download without puppeteer's BrowserFetcher

The deprecated tool only reports, falls back to and uninstalls old
downloads; preparePackage now refuses with a pointer to
chrome-headless-shell."
```

### Task 3: `src/core/puppeteer.ts` on `puppeteer-core`

**Files:**
- Modify: `src/import_map.json:59`
- Modify: `src/core/puppeteer.ts`
- Test: `tests/unit/core/puppeteer.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/core/puppeteer.test.ts`:

```ts
/*
 * puppeteer.test.ts
 *
 * The puppeteer-core launch path in src/core/puppeteer.ts. The first test
 * runs everywhere (puppeteer-core refuses a missing executable before
 * spawning anything); the others need a Chrome and are skipped otherwise.
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { unitTest } from "../../test.ts";
import { assert, assertEquals, assertRejects, assertStringIncludes } from "testing/asserts";
import { join } from "../../../src/deno_ral/path.ts";
import { createTempContext } from "../../../src/core/temp.ts";
import {
  detectBrowser,
  extractImagesFromElements,
  inPuppeteer,
  launchHeadlessBrowser,
} from "../../../src/core/puppeteer.ts";

const hasBrowser = async () => (await detectBrowser()).detected !== undefined;

unitTest("puppeteer-core - launching a missing executable rejects", async () => {
  await assertRejects(
    () => launchHeadlessBrowser("/nonexistent/chrome"),
    Error,
    "Browser was not found",
  );
});

unitTest("puppeteer-core - evaluate in a page", async () => {
  const result = await inPuppeteer("about:blank", () => 1 + 1);
  assertEquals(result, 2);
}, { prereq: hasBrowser });

unitTest("puppeteer-core - screenshot an element to a file", async () => {
  const temp = createTempContext();
  try {
    const file = join(temp.createDir(), "box.png");
    const url =
      'data:text/html,<div id="box" style="width:40px;height:40px;background:%23ff0000"></div>';
    const html = await extractImagesFromElements(url, "#box", [file]);
    assertEquals(html.length, 1);
    assertStringIncludes(html[0], 'id="box"');
    const bytes = Deno.readFileSync(file);
    assert(bytes.length > 8, "png written");
    assertEquals([...bytes.slice(0, 4)], [0x89, 0x50, 0x4e, 0x47], "PNG signature");
  } finally {
    temp.cleanup();
  }
}, { prereq: hasBrowser });
```

- [ ] **Step 2: Run it and see it fail**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/core/puppeteer.test.ts`
Expected: FAIL at type-check, `has no exported member 'launchHeadlessBrowser'`.

- [ ] **Step 3: Change the import-map entry**

Replace
```json
    "puppeteer": "https://deno.land/x/puppeteer@9.0.2/mod.ts",
```
with
```json
    "puppeteer": "npm:puppeteer-core@25.14.0",
```

- [ ] **Step 4: Rewrite the launch half of `src/core/puppeteer.ts`**

Replace lines 1-30 (header, imports, `getPuppeteer`) with:

```ts
/*
 * puppeteer.ts
 *
 * Browser discovery (findChrome, detectBrowser, getBrowserExecutablePath) and a
 * puppeteer-core launch path (withHeadlessBrowser and the helpers on it).
 * Mermaid and the axe scanner drive Chrome through src/core/cri instead; the
 * discovery functions are shared by both.
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { readRegistryKey } from "./windows.ts";
import { safeExistsSync, which } from "./path.ts";
import { debug, error, info } from "../deno_ral/log.ts";
import { existsSync } from "../deno_ral/fs.ts";
import { basename } from "../deno_ral/path.ts";
import { UnreachableError } from "./lib/error.ts";
import { isMac, isWindows } from "../deno_ral/platform.ts";
import puppeteer, { type Browser, type Page } from "puppeteer";
import {
  chromeHeadlessShellExecutablePath,
  chromeHeadlessShellInstallDir,
  readInstalledVersion,
} from "../tools/impl/chrome-headless-shell-paths.ts";
import {
  chromiumExecutablePath,
  chromiumInstallDir,
  chromiumLocalRevisions,
  chromiumPlatform,
} from "../tools/impl/chromium-legacy-paths.ts";
```

Replace lines 42-86 (`extractImagesFromElements`, `extractHtmlFromElements`) with:

```ts
/**
 * Extracts images and elements from an URL
 *
 * @param urlOrOptions webpage url or page options
 * @param selector css selector
 * @param filenames filenames to write screenshots to
 * @returns html content of selected results
 */
export async function extractImagesFromElements(
  urlOrOptions: string | PageOptions,
  selector: string,
  filenames: string[],
): Promise<string[]> {
  return await withPuppeteerBrowserAndPage(
    urlOrOptions,
    async (_browser: Browser, page: Page) => {
      const elements = await page.$$(selector);
      if (elements.length !== filenames.length) {
        throw new Error(
          `extractImagesFromElements was given ${filenames.length} filenames, but selector yielded ${elements.length} elements.`,
        );
      }
      for (let i = 0; i < elements.length; ++i) {
        // puppeteer-core types `path` on its extension (`${string}.png` | ...);
        // callers pass .png files. The library writes the file itself (through
        // node:fs under Deno), so no Deno.* call is added here.
        await elements[i].screenshot({
          path: filenames[i] as `${string}.png`,
        });
      }

      const clientSideResult = await page.evaluate((selector: string) => {
        return Array.from(document.querySelectorAll(selector)).map((n) =>
          n.outerHTML
        );
      }, selector);
      return clientSideResult;
    },
  );
}

export function extractHtmlFromElements(
  url: string,
  selector: string,
): Promise<string[]> {
  return inPuppeteer(url, (selector: string) => {
    return Array.from(document.querySelectorAll(selector)).map((n) =>
      n.outerHTML
    );
  }, selector) as Promise<string[]>;
}
```

(`document` inside `page.evaluate` callbacks is typed by puppeteer-core's bundled DOM lib declarations, so the `const document = undefined as any` placeholders go away. If `deno check` complains that `document` is not defined in those callbacks, add `/// <reference lib="dom" />` at the top of the file, which is what puppeteer-core's own typings expect.)

Replace lines 100-210 (`withPuppeteerBrowserAndPage`, `inPuppeteer`, `withHeadlessBrowser`) with:

```ts
export async function withPuppeteerBrowserAndPage<T>(
  url: string | PageOptions,
  f: (b: Browser, p: Page) => Promise<T>,
): Promise<T> {
  const allowedErrorMessages = [
    "Navigation failed because browser has disconnected!",
    "Navigation timeout of 30000 ms exceeded",
    "Evaluation failed: undefined",
  ];

  let attempts = 0;
  const maxAttempts = 5;
  while (attempts++ < maxAttempts) {
    try {
      let finished = false;
      let result: T;
      await withHeadlessBrowser(async (browser: Browser) => {
        const page = await browser.newPage();
        if (typeof url === "string") {
          await page.goto(url);
        } else {
          if (url.viewport) {
            await page.setViewport(url.viewport);
          }
          await page.goto(url.url);
        }
        result = await f(browser, page);
        finished = true;
      });
      if (finished) {
        return result!;
      }
    } catch (error) {
      if (!(error instanceof Error)) throw error;
      if (
        (allowedErrorMessages.indexOf(error.message) !== -1) &&
        (attempts < maxAttempts)
      ) {
        console.log(
          `\nEncountered a bad error message from puppeteer: "${error.message}"\n Retrying ${attempts}/${maxAttempts}`,
        );
      } else {
        throw error;
      }
    }
  }
  throw new UnreachableError();
}

export async function inPuppeteer(
  url: string,
  // deno-lint-ignore no-explicit-any
  f: (...args: any[]) => unknown,
  ...params: unknown[]
): Promise<unknown> {
  const allowedErrorMessages = [
    "Navigation failed because browser has disconnected!",
    "Navigation timeout of 30000 ms exceeded",
    "Evaluation failed: undefined",
  ];

  let attempts = 0;
  const maxAttempts = 5;
  while (attempts++ < maxAttempts) {
    try {
      return await withHeadlessBrowser(async (browser: Browser) => {
        const page = await browser.newPage();
        await page.goto(url);
        const clientSideResult = await page.evaluate(f, ...params);
        return clientSideResult;
      });
    } catch (error) {
      if (!(error instanceof Error)) throw error;
      if (
        (allowedErrorMessages.indexOf(error.message) !== -1) &&
        (attempts < maxAttempts)
      ) {
        console.log(
          `\nEncountered a bad error message from puppeteer: "${error.message}"\n Retrying ${attempts}/${maxAttempts}`,
        );
      } else {
        throw error;
      }
    }
  }
  throw new UnreachableError();
}

/**
 * Launch the browser at `executablePath` headless. chrome-headless-shell is
 * the old headless implementation and takes a bare `--headless` (puppeteer's
 * "shell" mode); full Chrome/Edge get `--headless=new`. The extra flags
 * mirror src/core/cri/launch.ts.
 */
export async function launchHeadlessBrowser(
  executablePath: string,
): Promise<Browser> {
  const headless = basename(executablePath).startsWith("chrome-headless-shell")
    ? "shell"
    : true;
  return await puppeteer.launch({
    executablePath,
    headless,
    args: ["--no-sandbox", "--disable-gpu"],
  });
}

export async function withHeadlessBrowser<T>(
  fn: (browser: Browser) => Promise<T>,
): Promise<T> {
  const browser = await launchHeadlessBrowser(await getBrowserExecutablePath());
  try {
    const result = await fn(browser);
    await browser.close();
    return result;
  } catch (e) {
    await browser.close();
    throw e;
  }
}
```

Replace lines 348-396 (`getBrowserExecutablePath`, `fetchBrowser`, `fetcher`, `chromiumInstallDir`) with:

```ts
export async function getBrowserExecutablePath() {
  const detection = await detectBrowser();

  if (detection.detected) {
    debug(`[CHROMIUM] Using ${detection.detected.label}: ${detection.detected.path}`);
    return detection.detected.path;
  }

  if (detection.warning) {
    debug(`[CHROMIUM] ${detection.warning} Searching for another browser.`);
  }

  // Legacy: Chromium revisions downloaded by `quarto install chromium` (<= 1.9)
  const platform = chromiumPlatform();
  const legacyDir = chromiumInstallDir();
  const availableRevisions = chromiumLocalRevisions(legacyDir, platform);
  if (availableRevisions.length > 0) {
    return chromiumExecutablePath(legacyDir, platform, availableRevisions[0]);
  }

  error("Chrome not found");
  info(
    "\nNo Chrome or Chromium installation was detected.\n\nPlease run 'quarto install chrome-headless-shell' to install a headless browser.\n",
  );
  throw new Error();
}
```

Leave `PageOptions` (88-98), `ChromeInfo`/`findChrome` (212-278), `BrowserDetection`, `BrowserDetectionResult`, `detectBrowser` (280-346) as they are.

- [ ] **Step 5: Type-check, lint, run the unit tests**

Run: `package/dist/bin/tools/x86_64/deno check --import-map src/import_map.json src/core/puppeteer.ts src/quarto.ts && package/dist/bin/tools/x86_64/deno lint src/core/puppeteer.ts src/tools/impl/`
Expected: exit 0, lint clean. Deno downloads `puppeteer-core` and its dependencies on first use (about 20 MB in `package/dist/bin/deno_cache`).

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/core/puppeteer.test.ts`
Expected: without a browser, 1 passed and 2 skipped (the harness prints the skip); with `package/dist/bin/quarto install chrome-headless-shell --no-prompt` done first, `3 passed`. Run it both ways before the PR: the browser-backed tests are the only proof that `headless: "shell"` and the two flags launch the installed `chrome-headless-shell`.

- [ ] **Step 6: Run the browser-dependent smoke tests**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/check/check.test.ts smoke/env/install.test.ts smoke/axe/axe-findings.test.ts`
Expected: all passed (`check` prints the Chrome section through `detectBrowser`; `install.test.ts` runs `quarto tools list`, which calls the legacy `latestRelease` with no network; `axe-findings` uses `getBrowserExecutablePath` for its prerequisite and launches through CRI).

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent docs/smoke-all/2026/02/12/mermaid-typst.qmd docs/smoke-all/2026/02/12/mermaid-multi-diagram.qmd`
Expected: all passed (mermaid → `withCriClient` → `launchChrome` → `getBrowserExecutablePath`).

- [ ] **Step 7: Commit**

```bash
git add src/import_map.json src/core/puppeteer.ts tests/unit/core/puppeteer.test.ts
git commit -m "Launch browsers with npm:puppeteer-core instead of the deno.land puppeteer 9 port

The legacy chromium fallback reads the old download directory directly;
BrowserFetcher no longer exists in puppeteer-core."
```

### Task 4: `src/vendor_deps.ts` and the `std@0.93.0` redirects

**Files:**
- Modify: `src/vendor_deps.ts:10-14`
- Modify: `src/import_map.json:67-69`

- [ ] **Step 1: Drop the puppeteer lines from the vendoring entrypoint**

In `src/vendor_deps.ts` delete lines 10-14:

```ts
// for puppeteer
import { dirname, join, SEP } from "https://deno.land/std@0.93.0/path/mod.ts";
import puppeteer from "https://deno.land/x/puppeteer@9.0.2/mod.ts";
import _jszip from "https://dev.jspm.io/jszip@3.5.0";
// import * as _base64 from "https://deno.land/std@0.93.0/encoding/base64.ts";
```

Keep lines 15-17 (the `std@0.196.0/encoding/base64.ts` import belongs to the Cliffy rc.3 graph; PR 06 removes it). `jszip` has no other importer (`grep -rn jszip src package/src tests --include=*.ts` finds only this file and a URL in a comment in `package/src/common/update-html-dependencies.ts:676`).

- [ ] **Step 2: Find out whether the `std@0.93.0` redirects are still used**

Run the `deno info` script from `04-deps-deno-land-x-small.md`, Task 7, Step 1.
Expected: `UNUSED` for `https://deno.land/std@0.93.0/encoding/base64.ts`, `https://deno.land/std@0.93.0/path/mod.ts` and `https://deno.land/std@0.93.0/` (the puppeteer port was their importer). Delete exactly the `UNUSED` keys among those three:

```json
    "https://deno.land/std@0.93.0/encoding/base64.ts": "https://deno.land/std@0.196.0/encoding/base64.ts",
    "https://deno.land/std@0.93.0/path/mod.ts": "https://deno.land/std@0.204.0/path/mod.ts",
    "https://deno.land/std@0.93.0/": "https://deno.land/std@0.217.0/",
```

- [ ] **Step 3: Re-run the script, re-cache, and type-check**

Run: the script again; then `./configure.sh && package/dist/bin/tools/x86_64/deno check --import-map src/import_map.json src/quarto.ts src/vendor_deps.ts`
Expected: no `UNUSED` line for the three keys; `configure.sh` succeeds (it runs `deno install --entrypoint src/vendor_deps.ts`, which must still resolve); `deno check` exits 0.

- [ ] **Step 4: Commit**

```bash
git add src/vendor_deps.ts src/import_map.json
git commit -m "Drop puppeteer 9 port from the vendoring entrypoint and its std redirects"
```

### Task 5: Bundle and status

**Files:**
- Modify: `dev-docs/runtime-migration/README.md`

- [ ] **Step 1: Build the release bundle and run `quarto check` from it**

Run: `cd package/src && ./quarto-bld prepare-dist --set-version $(cat ../../version.txt) && ../pkg-working/bin/quarto check`
Expected: the bundle builds (`puppeteer-core` and its `node:` imports go through `@luca/esbuild-deno-loader`) and `quarto check` prints all sections. If esbuild fails on a `puppeteer-core` internal (`require` of a JSON file, a dynamic import of `./package.json`, or a `node:` builtin the loader marks external in a way the launcher's `deno run` cannot load), capture the error in the PR and apply Decision 1 option B.

- [ ] **Step 2: Set the PR 07 row to `in progress` and commit**

```bash
git add dev-docs/runtime-migration/README.md
git commit -m "runtime-migration: PR 07 in progress"
```

## Verification

```bash
rm -rf package/dist/bin/deno_cache && ./configure.sh
package/dist/bin/tools/x86_64/deno check --import-map src/import_map.json src/quarto.ts src/vendor_deps.ts
package/dist/bin/quarto install chrome-headless-shell --no-prompt     # so the browser-backed tests run
package/dist/bin/quarto check                                          # Chrome Headless section: "Chrome Headless Shell installed by Quarto"
cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent \
  unit/tools/chromium-legacy-paths.test.ts unit/core/puppeteer.test.ts \
  unit/tools/chrome-headless-shell.test.ts unit/chrome-launch.test.ts unit/chrome-launch-flags.test.ts \
  smoke/check/ smoke/env/ smoke/axe/axe-findings.test.ts
cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent \
  docs/smoke-all/2026/02/12/mermaid-typst.qmd docs/smoke-all/2026/02/12/mermaid-multi-diagram.qmd \
  docs/smoke-all/2023/12/11/4376.qmd
package/dist/bin/quarto install chromium --no-prompt 2>&1 | head -2    # deprecation redirect still printed
quarto run --dev tools/check-runtime-boundary.ts                       # after PR 02: unchanged counts (see the ratchet note)
```

Ratchet note: this PR adds no `Deno.*` call site in `src/` (the new directory listing uses `walkSync` from `src/deno_ral/fs.ts` and the screenshot is written by puppeteer-core itself) and removes none (`Deno.env.get("QUARTO_CHROMIUM")` in `detectBrowser` stays), so the PR 02 check must report the same `src` numbers as `main`. If it reports a rise, a `Deno.` call crept into `chromium-legacy-paths.ts` or `puppeteer.ts`; move it behind `src/deno_ral/fs.ts` rather than updating the baseline.

On the PR: `Smoke Tests` (both OSes install `chrome-headless-shell` in their setup and run the mermaid corpus), `Bundle Test`, `Test Tool Install` (Linux arm64 and macOS, including the chromium redirect job).

## Review checklist

- [ ] `src/core/puppeteer.ts` is the only importer of `"puppeteer"`; no `any` remains on `Browser`/`Page` parameters; `document` placeholders are gone.
- [ ] `launchHeadlessBrowser` picks `"shell"` only for a `chrome-headless-shell*` basename and passes `--no-sandbox --disable-gpu`, matching `src/core/cri/launch.ts:276-278`.
- [ ] `getBrowserExecutablePath` keeps the three-step order (env var, Quarto's chrome-headless-shell, system Chrome) before the legacy fallback, and the legacy fallback picks the highest revision.
- [ ] `src/tools/impl/chromium.ts` imports nothing from `core/puppeteer.ts` (no cycle); `chromium-legacy-paths.ts` imports only `deno_ral/*` and `core/appdirs.ts`.
- [ ] `preparePackage` rejects with the `chrome-headless-shell` message; `installTool("chromium")` still redirects before reaching it.
- [ ] `src/vendor_deps.ts` has no `deno.land/x/puppeteer`, `dev.jspm.io` or `std@0.93.0` line; the import map has no `std@0.93.0` key the `deno info` script reported `USED`.
- [ ] The browser-backed unit tests were run with a browser at least once (say so in the PR description, with the platform).
- [ ] No new `Deno.*` call site in `src/` (`chromiumLocalRevisions` uses `walkSync`; screenshots go through puppeteer-core's `path` option).

## Risks and rollback

- `puppeteer-core` 25 may fail to bundle or to run under Deno's Node compatibility layer (it uses `node:child_process`, `node:net`, `ws`, and reads `package.json` for its version). The launch path has no callers, so a failure here does not break any user feature, but `Bundle Test` would go red. Fallback: Decision 1 option B (delete the dead launch helpers and the dependency), which turns this PR into "chromium tool off puppeteer" only.
- `headless: "shell"` vs `true` for `chrome-headless-shell`: not verifiable without a browser in the planning sandbox. If the shell binary rejects the flags puppeteer passes, the error surfaces in `tests/unit/core/puppeteer.test.ts` (second and third tests) and the fix is in `launchHeadlessBrowser` only.
- `quarto update chromium` used to re-download; it now logs the deprecation error. This is the intended end state of a tool scheduled for removal.
- The legacy fallback in `getBrowserExecutablePath` returns a path without checking that the executable exists (puppeteer 9's `revisionInfo` did not either); `detectBrowser` already prefers every other option.
- Rollback: revert the commits in reverse order; the `deno.land/x` entry, `vendor_deps.ts` lines and the `std@0.93.0` redirects return.

## Decisions needed

1. **Keep the puppeteer launch helpers at all?** `withHeadlessBrowser`, `withPuppeteerBrowserAndPage`, `inPuppeteer`, `extractImagesFromElements`, `extractHtmlFromElements` have had no caller since mermaid moved to the CDP client; porting them (option A, this plan) keeps a second launch path and adds `puppeteer-core` and its dependencies (about 20 MB of sources; what reaches the bundle is smaller but not nothing) to every install. Option B: delete the five helpers, `PageOptions` and the `puppeteer` import-map entry; keep `findChrome`, `detectBrowser`, `getBrowserExecutablePath` and the legacy fallback; `tests/unit/core/puppeteer.test.ts` shrinks to nothing (delete it) and Task 3 becomes a deletion. Recommendation: **B**, unless a product reason to keep a puppeteer path exists (for example a planned screenshot feature); this plan is written for A because the migration assessment asked for the port, and A is a strict superset (B = A minus Task 3's launch code). Decide in the PR description.
2. **Remove the deprecated `chromium` tool entirely** (`src/tools/tools.ts:35,41,102-110,125-132`, `src/tools/impl/chromium.ts`, the legacy fallback, the `check.ts:421-425` hint, the `test-install.yml` redirect job) instead of porting it. It was scheduled for removal in 1.11 (`tools.ts:40`). Recommendation: do it in a separate, user-visible PR with a changelog entry (`news/changelog-1.11.md`) and documentation update; this PR keeps the behaviour so it stays a dependency change.
