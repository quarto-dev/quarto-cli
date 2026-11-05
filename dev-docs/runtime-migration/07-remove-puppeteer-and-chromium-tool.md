# PR 07: Remove the puppeteer port and the deprecated `chromium` tool; Phase 0 exit cleanup

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Delete the unused puppeteer launch helpers and the `deno.land/x/puppeteer@9.0.2` dependency, delete the deprecated `chromium` tool and its BrowserFetcher layout (keeping the `chromium` → `chrome-headless-shell` redirect and a way to remove an old download), keep every Chrome feature on Quarto's own CDP client (`withCriClient`), and, as the last task of Phase 0, remove every unused `deno.land/std` redirect and every remaining `deno.land`/skypack/jspm reference outside an explicit allow-list.
**Phase:** 0, lands last. **Depends on:** 02 (ratchet, `tests/asserts.ts`), 00b (frozen `deno.lock`, `update-lock.sh`, bundle gate), 03, 04, 05, 06 (Task 6 removes the redirects and URLs their packages needed; it runs only once they are merged). **Unblocks:** PR 25 (the `Deno.run` puppeteer note in `monkey-patch.ts` is gone), PR 26 (no puppeteer to stub), Phase 1.
**Branch:** `rt/07-remove-puppeteer-and-chromium-tool`.
**Suggested executor:** Opus. The deletions are mechanical, but the `chromium` redirect paths, `quarto check` output and the `deno info` usage analysis of Task 6 need judgement when an unexpected importer shows up.
**Size:** M (about 25 files: `src/core/puppeteer.ts`, `src/tools/impl/chromium.ts` (deleted), new `src/tools/impl/chromium-legacy.ts`, `src/tools/tools.ts`, `src/tools/tools-console.ts`, `src/tools/impl/chrome-headless-shell.ts`, `src/command/check/check.ts`, three comment fixes, `src/import_map.json`, `deno.lock`, `src/vendor_deps.ts` (deleted) and its four references, three dead import-map files, four inspect tests, five dev scripts, two unit tests, the changelog).
**Ships on:** Deno; the existing test suite must stay green.

## Spec

### Context

`00-assessment.md` section 3.4 (puppeteer row) and section 10, finding 7; `REVIEW-2026-10-15.md` Phase 0 "07" (blockers: option A pulls `ws` (CommonJS) into the Deno bundle and deleting the `std@0.93.0/` redirect breaks four inspect tests) and decision 8 (option B: delete the unused helpers and the deprecated tool; `puppeteer-core` is not added).

What the puppeteer port is used for today (verified with `rg -l "\b<name>\b" src tests package/src tools`):

| Export of `src/core/puppeteer.ts` | Callers outside the file | After this PR |
|---|---|---|
| `getPuppeteer` (21-32) | `src/tools/impl/chromium.ts` | deleted with the tool |
| `extractImagesFromElements` (42-72), `extractHtmlFromElements` (74-86), `PageOptions` (88-99), `withPuppeteerBrowserAndPage` (100-149), `inPuppeteer` (151-191), `withHeadlessBrowser` (193-210) | none (named only in the comment `src/core/cri/launch.ts:13-16`) | deleted |
| `findChrome`, `BrowserDetection`, `BrowserDetectionResult`, `detectBrowser` (217-346) | `src/command/check/check.ts:35,598` | unchanged |
| `getBrowserExecutablePath` (348-375) | `src/core/cri/launch.ts:29`, `tests/smoke/axe/axe-findings.test.ts` | unchanged order (`QUARTO_CHROMIUM`, Quarto's `chrome-headless-shell`, system Chrome/Edge); the puppeteer-revision fallback (361-371) is deleted |
| `fetchBrowser` (377-384), `fetcher` (386-392), `chromiumInstallDir` (394-396) | `src/tools/impl/chromium.ts` | deleted |

Mermaid diagrams for non-HTML formats, `createPngsFromHtml`/`extractHtml` in the handler context (`src/core/handlers/base.ts:146,180`) and the axe scanner drive Chrome through `withCriClient` and `src/core/cri/` (Quarto's own CDP client); they never touched puppeteer. The comments that say otherwise (`src/core/handlers/types.ts:88,110` "Uses puppeteer", `src/core/cri/launch.ts:13-16`, `src/core/deno/monkey-patch.ts:26-28` "Puppeteer (and only Puppeteer) uses Deno.run") are corrected.

The `chromium` tool: deprecated in v1.10 and scheduled for removal in v1.11 (`src/tools/tools.ts:40-41`; `configuration` says `QUARTO_VERSION=1.11`). `quarto install chromium` and `quarto update tool chromium` already redirect to `chrome-headless-shell` with a deprecation warning (`tools.ts:124-132`, `tools-console.ts:154-174`; tested by the "Chromium deprecation redirect" job of `.github/workflows/test-install.yml:77-195`). What still depends on the tool and on puppeteer 9's `BrowserFetcher`: listing an old download (`allTools`, `loadTools`), the `quarto check` hint (`check.ts:423-427`) and its "Chromium installed by Quarto" detection (`check.ts:609-621`), `quarto uninstall chromium`, removing the old download after installing `chrome-headless-shell` (`chrome-headless-shell.ts:136-147`, `tools-console.ts:164-169`), and the fallback in `getBrowserExecutablePath`. puppeteer 9 stored downloads under `quartoDataDir("chromium")` as `<linux|mac|win32|win64>-<revision>/<archive>/<executable>`. After this PR a small `src/tools/impl/chromium-legacy.ts` only detects and removes that directory; nothing uses the old browser any more (users who have no Chrome and only an old `quarto install chromium` download are told to run `quarto install chrome-headless-shell`, which `quarto check` already recommends).

The puppeteer port also brought three `https://deno.land/std@0.93.0/...` redirects into `src/import_map.json` and the `src/vendor_deps.ts` entrypoint (`deno.land/x/puppeteer@9.0.2`, `dev.jspm.io/jszip@3.5.0`, `deno.land/std@0.93.0/path`), which also carries a `std@0.196.0/encoding/base64.ts` import that Cliffy rc.3 needed. PRs 04 and 06 no longer remove redirects themselves (their first drafts predicted each other's state and missed users); Task 6 here does it once, after 03–06 have landed, with one `deno info` run over every entrypoint: `src/quarto.ts`, `tests/test-deps.ts`, `package/src/bld.ts`, `package/scripts/deno_std/deno_std.ts`, every `tests/**/*.test.ts` (the four `tests/smoke/inspect/*.test.ts` used to import `https://deno.land/std@0.93.0/assert/assert_object_match.ts`, resolvable only through the `std@0.93.0/` redirect; PR 00b Task 6 step 4 rewrote them to `tests/asserts.ts`, so this PR assumes PR 00b landed with that rewrite and only checks it), every `tools/*.ts`, and the `src/resources/**/*.ts` scripts that run with `src/import_map.json`.

Phase 0 exit criterion (Task 6 Step 7): `rg -n 'deno\.land|skypack|jspm' src package tests tools` prints nothing outside this allow-list:

| Allowed path | Why it stays | Owner |
|---|---|---|
| `src/resources/deno_std/**`, `package/scripts/deno_std/deno_std.ts` | the `quarto run` stdlib (`run_import_map.json` maps `stdlib/*` to `https://deno.land/std@0.224.0/...` and `cdn.skypack.dev/juice`; `deno_std.lock`; `import_map.json`) shipped to users | PR 35 replaces it, PR 37 deletes it |
| `src/resources/scripts/**` | `quarto run` fixtures that use the stdlib above (`check-usage.ts` imports `deno.land/std@0.76.0`; `juice.ts` mentions skypack in a comment) | PR 35 |
| `src/resources/tools/ast-tracing/**`, `tools/sass-variable-explainer/parse-web.ts`, `tests/docs/reveal/actors.js` | browser-side modules (loaded by an HTML page or an OJS cell), never by Deno | not migrated |
| `tests/integration/playwright/tests/axe-accessibility.spec.ts`, `tests/unit/axe-no-cdn.test.ts` | the string `skypack.dev` in a list of CDNs the output must not reference | not migrated |
| `tests/docs/manuscript/ipynb-full/**` | data that happens to contain the letters `jspm` (a CSV row, base64 image bytes) | not code |
| `src/core/deno/debug.ts`, `src/core/jupyter/capabilities.ts`, `src/core/lib/glob.ts`, `src/core/lib/external/colors.ts`, `src/core/lib/external/README.md`, `src/publish/confluence/confluence-helper.ts` | provenance comments (a stack-frame example, the source a function was copied from) | not code |

### Scope

In:
- `src/core/puppeteer.ts`: delete the puppeteer import, `getPuppeteer`, the five launch helpers, `PageOptions`, `fetchBrowser`, `fetcher`, `chromiumInstallDir` and the legacy fallback;
- `src/tools/impl/chromium.ts`: deleted; `src/tools/impl/chromium-legacy.ts`: new (`legacyChromiumDir`, `hasLegacyChromium`, `removeLegacyChromium`);
- `src/tools/tools.ts`, `src/tools/tools-console.ts`, `src/tools/impl/chrome-headless-shell.ts`, `src/command/check/check.ts`: the redirect stays, `quarto uninstall chromium` removes the old directory, nothing lists or uses the old browser;
- `src/import_map.json`: the `puppeteer` entry; `deno.lock`;
- comment fixes in `src/core/handlers/types.ts`, `src/core/cri/launch.ts`, `src/core/deno/monkey-patch.ts`;
- Task 6 (Phase 0 exit): every unused `https://deno.land/std@...` redirect, `src/vendor_deps.ts` and its references, the dead `src/dev_import_map.json`, `src/import_map_additional_entries.json`, `package/src/common/create-dev-import-map.ts`, the four inspect tests, five dev scripts, the exit-criterion check;
- unit tests, changelog.

Out:
- `chrome-headless-shell` and `chrome-for-testing` (Quarto's own download; unchanged);
- `src/core/cri/` (unchanged);
- renaming `src/core/puppeteer.ts` (Decisions);
- the `quarto run` stdlib (PR 35).

### Interfaces

`src/core/puppeteer.ts` after this PR exports exactly:

```ts
export function findChrome(): Promise<ChromeInfo>;                 // unchanged
export interface BrowserDetection { path: string; source: string; label: string; version?: string; displaySource?: string; }   // unchanged
export interface BrowserDetectionResult { detected?: BrowserDetection; warning?: string; }                                       // unchanged
export function detectBrowser(): Promise<BrowserDetectionResult>;  // unchanged
/** detectBrowser()'s path; logs "Chrome not found" with the install hint and throws when nothing is detected. */
export function getBrowserExecutablePath(): Promise<string>;
```

`src/tools/impl/chromium-legacy.ts` (new):

```ts
/** Where `quarto install chromium` (Quarto 1.9 and earlier, puppeteer 9's BrowserFetcher) downloaded Chromium:
 * <userDataDir("quarto")>/chromium. Does not create the directory. */
export function legacyChromiumDir(): string;
/** True when `dir` holds at least one `<linux|mac|win32|win64>-<digits>` directory (one downloaded revision). */
export function hasLegacyChromium(dir?: string): boolean;
/** Removes `dir` (only inside `boundary`, via safeRemoveDirSync) and returns true when it existed. */
export function removeLegacyChromium(dir?: string, boundary?: string): boolean;
```

CLI behaviour after this PR:

| Command | Before | After |
|---|---|---|
| `quarto install chromium` | deprecation warning, installs `chrome-headless-shell` | unchanged |
| `quarto update tool chromium` | warning, removes an old download, installs/updates `chrome-headless-shell` | unchanged (removal through `removeLegacyChromium`) |
| `quarto uninstall chromium` | removes the old download through BrowserFetcher | removes `legacyChromiumDir()` and prints `Removed the Chromium downloaded by 'quarto install chromium'.`, or prints `No Chromium download from 'quarto install chromium' was found.` |
| `quarto list tools`, `quarto check` tools section | list "Chromium (deprecated)" when an old download exists | `chromium` is not a tool any more |
| `quarto check` Chrome section, nothing else installed | "Using: Chromium installed by Quarto" | `Chrome: (not detected)` plus a `NOTE:` naming the old directory and the two commands |
| rendering with only an old download | used the old Chromium | "Chrome not found" and the `quarto install chrome-headless-shell` hint (as for any machine without Chrome) |

### Files

- Modify: `src/core/puppeteer.ts:7-32,33-210,302-303,348-396`
- Delete: `src/tools/impl/chromium.ts`
- Create: `src/tools/impl/chromium-legacy.ts`
- Modify: `src/tools/tools.ts:20,32-45,57-61,101-112,197-226`
- Modify: `src/tools/tools-console.ts:11-18,95-99,163-169`
- Modify: `src/tools/impl/chrome-headless-shell.ts:34,135-148`
- Modify: `src/command/check/check.ts:25,423-427,609-621`
- Modify: `src/core/handlers/types.ts:88,110`, `src/core/cri/launch.ts:13-16`, `src/core/deno/monkey-patch.ts:26-28`
- Modify: `src/import_map.json` (`puppeteer`; Task 6: the `https://deno.land/std@...` keys), `deno.lock`
- Delete (Task 6): `src/vendor_deps.ts`, `src/dev_import_map.json`, `src/import_map_additional_entries.json`, `package/src/common/create-dev-import-map.ts`
- Modify (Task 6): `package/scripts/vendoring/vendor.sh`, `vendor.cmd`, `.github/workflows/actions/quarto-dev/action.yml:19`, `dev-docs/ci-deno-caching.md`, `.claude/CLAUDE.md:25`, `tests/README.md:369`
- Modify (Task 6): `tools/check-test-imports.ts` (`kLockEntrypoints` loses `src/vendor_deps.ts`; its test if it names the six entries), `dev-docs/add-typescript-dependency.md` (the list of lock entrypoints, five after this PR), `package/scripts/vendoring/update-lock.sh` if it lists the entrypoints (all three written by PR 00b)
- Check only (Task 6): `tests/smoke/inspect/inspect-code-cells.test.ts`, `inspect-extensions.test.ts`, `inspect-include.test.ts`, `inspect-recursive-include.test.ts`; `tests/run-parallel-tests.ts:13-17`; `src/resources/tools/ast-diagram/main.ts:3`; `tools/document-generator/main.ts:1`; `tools/run-pandoc-capture.ts:2`; `tools/subcommand-history.ts:46`
- Test: `tests/unit/core/browser-discovery.test.ts` (new), `tests/unit/tools/chromium-legacy.test.ts` (new)
- Modify: `tools/runtime-boundary-baseline.json` (`src` and `tests` std-import files fall)
- Modify: `news/changelog-1.11.md`, `dev-docs/runtime-migration/README.md`

### Acceptance criteria

- `rg -n 'puppeteer' src package/src tests tools --type ts -i` lists no import of a puppeteer package (comments naming the old port are gone too; `src/core/puppeteer.ts` keeps its file name).
- `grep -c 'deno\.land\|skypack\|jspm' src/import_map.json` prints `0`; `src/vendor_deps.ts` does not exist; `configure` does not reference it.
- The Phase 0 exit command of Task 6 Step 7 prints nothing.
- `quarto install chromium --no-prompt` and `quarto update tool chromium --no-prompt` still print the deprecation warning and succeed (the `test-install.yml` "Chromium deprecation redirect" job is green on four runners).
- With a fake old download (`<userDataDir>/quarto/chromium/linux-869685/chrome-linux/`), `quarto check` prints the `NOTE:` and `quarto uninstall chromium` removes the directory.
- Mermaid to Typst and the axe smoke test render (CDP path, shares `getBrowserExecutablePath`); `Bundle Test` (three OSes) green.
- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/core/browser-discovery.test.ts unit/tools/chromium-legacy.test.ts` → `3 passed`.
- `quarto run --dev tools/check-runtime-boundary.ts` passes after `--update-baseline`: `src` std-import files −1 (`src/vendor_deps.ts`), `tests` std-import files unchanged (PR 00b already moved the four inspect tests to `tests/asserts.ts`), `Deno.` counts unchanged (the deleted code had no `Deno.` call; `chromium-legacy.ts` uses `deno_ral`).

## Plan

### Task 1: Delete the puppeteer launch path

**Files:**
- Modify: `src/core/puppeteer.ts`, `src/core/handlers/types.ts`, `src/core/cri/launch.ts`, `src/core/deno/monkey-patch.ts`
- Test: `tests/unit/core/browser-discovery.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/core/browser-discovery.test.ts`:

```ts
/*
 * browser-discovery.test.ts
 *
 * src/core/puppeteer.ts is browser discovery only: Chrome is driven over CDP
 * by src/core/cri/, the puppeteer launch helpers and the BrowserFetcher
 * layout are gone (dev-docs/runtime-migration/07-remove-puppeteer-and-chromium-tool.md).
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { unitTest } from "../../test.ts";
import { assertEquals } from "../../asserts.ts";
import * as discovery from "../../../src/core/puppeteer.ts";

// deno-lint-ignore require-await
unitTest("browser discovery - exports discovery functions only", async () => {
  assertEquals(Object.keys(discovery).sort(), [
    "detectBrowser",
    "findChrome",
    "getBrowserExecutablePath",
  ]);
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/core/browser-discovery.test.ts`
Expected: FAIL, `Values are not equal`, the actual list also containing `chromiumInstallDir`, `extractHtmlFromElements`, `extractImagesFromElements`, `fetcher`, `getPuppeteer`, `inPuppeteer`, `withHeadlessBrowser`, `withPuppeteerBrowserAndPage`.

- [ ] **Step 3: Delete the helpers**

In `src/core/puppeteer.ts`:
1. Delete the imports `import { UnreachableError } from "./lib/error.ts";`, `import { quartoDataDir } from "./appdirs.ts";` and `import puppeteer from "puppeteer";`.
2. Delete everything from the comment `// deno-lint-ignore no-explicit-any` above `// let puppeteerImport: any = undefined;` (line 21) through the closing `}` of `withHeadlessBrowser` (line 210): `getPuppeteer`, `extractImagesFromElements`, `extractHtmlFromElements`, `PageOptions`, `withPuppeteerBrowserAndPage`, `inPuppeteer`, `withHeadlessBrowser`.
3. In the doc comment of `detectBrowser`, replace
```ts
 * Does NOT check legacy fallbacks (puppeteer revisions, chromium tool) —
 * callers handle those based on their context.
```
with
```ts
 * A Chromium downloaded by the removed `chromium` tool is never used
 * (src/tools/impl/chromium-legacy.ts only detects and removes it).
```
4. Replace `getBrowserExecutablePath` and everything after it (lines 348-396) with:
```ts
export async function getBrowserExecutablePath() {
  const detection = await detectBrowser();

  if (detection.detected) {
    debug(
      `[CHROMIUM] Using ${detection.detected.label}: ${detection.detected.path}`,
    );
    return detection.detected.path;
  }

  if (detection.warning) {
    debug(`[CHROMIUM] ${detection.warning}`);
  }

  error("Chrome not found");
  info(
    "\nNo Chrome or Chromium installation was detected.\n\nPlease run 'quarto install chrome-headless-shell' to install a headless browser.\n",
  );
  throw new Error();
}
```

- [ ] **Step 4: Correct the comments that name puppeteer**

In `src/core/handlers/types.ts` replace `   * Uses puppeteer.` (line 88) with `   * Uses headless Chrome over CDP (src/core/cri/).` and in line 110 replace `Extract HTML elements from an HTML page. Uses puppeteer.` with `Extract HTML elements from an HTML page. Uses headless Chrome over CDP (src/core/cri/).`

In `src/core/cri/launch.ts` delete lines 13-16:
```ts
 * Not to be confused with the launch path in src/core/puppeteer.ts
 * (`withHeadlessBrowser`, reached through `withPuppeteerBrowserAndPage` and
 * `inPuppeteer`), which starts Chrome through puppeteer rather than over CDP.
 * Nothing outside that file enters it today, but it is a second launch path.
```
(and the empty ` *` line that follows them, so one blank comment line separates the paragraphs).

In `src/core/deno/monkey-patch.ts` delete lines 26-28:
```ts
// TODO:
// Puppeteer (and only Puppeteer) uses Deno.run, but it still more-or-less exists
// in the Deno namespace.
```

- [ ] **Step 5: Run the test and type-check**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/core/browser-discovery.test.ts`
Expected: `1 passed`.
Run: `package/dist/bin/tools/x86_64/deno check --import-map src/import_map.json src/core/puppeteer.ts src/core/cri/launch.ts src/command/check/check.ts`
Expected: exit 0. (`src/tools/impl/chromium.ts` still imports `getPuppeteer`/`fetcher`/`chromiumInstallDir` and fails to type-check until Task 3 deletes it; check it is the only failure with `deno check --import-map src/import_map.json src/quarto.ts 2>&1 | grep -c 'tools/impl/chromium.ts'` > 0 and no other file named.)

- [ ] **Step 6: Commit (red until Task 3 for `src/quarto.ts`; squash if the project prefers green commits)**

```bash
git add src/core/puppeteer.ts src/core/handlers/types.ts src/core/cri/launch.ts src/core/deno/monkey-patch.ts tests/unit/core/browser-discovery.test.ts
git commit -m "Remove the unused puppeteer launch helpers

Chrome is driven over CDP by src/core/cri (mermaid, createPngsFromHtml,
axe); the puppeteer path had no caller. src/core/puppeteer.ts keeps
browser discovery only."
```

### Task 2: Detect and remove an old `quarto install chromium` download

**Files:**
- Create: `src/tools/impl/chromium-legacy.ts`
- Test: `tests/unit/tools/chromium-legacy.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/tools/chromium-legacy.test.ts`:

```ts
/*
 * chromium-legacy.test.ts
 *
 * The removed `chromium` tool downloaded into <quarto data dir>/chromium/
 * <platform>-<revision>/; Quarto only detects and removes that directory now.
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { unitTest } from "../../test.ts";
import { assert, assertEquals } from "../../asserts.ts";
import { join } from "../../../src/deno_ral/path.ts";
import { ensureDirSync, existsSync } from "../../../src/deno_ral/fs.ts";
import { createTempContext } from "../../../src/core/temp.ts";
import {
  hasLegacyChromium,
  legacyChromiumDir,
  removeLegacyChromium,
} from "../../../src/tools/impl/chromium-legacy.ts";

// deno-lint-ignore require-await
unitTest("chromium-legacy - detects a downloaded revision directory only", async () => {
  const temp = createTempContext();
  try {
    const parent = temp.createDir();
    const dir = join(parent, "chromium");
    assert(!hasLegacyChromium(dir), "missing directory");
    ensureDirSync(join(dir, "junk"));
    assert(!hasLegacyChromium(dir), "no <platform>-<revision> directory");
    ensureDirSync(join(dir, "linux-869685", "chrome-linux"));
    assert(hasLegacyChromium(dir), "linux-869685");
  } finally {
    temp.cleanup();
  }
});

// deno-lint-ignore require-await
unitTest("chromium-legacy - removes the directory inside the boundary once", async () => {
  const temp = createTempContext();
  try {
    const parent = temp.createDir();
    const dir = join(parent, "chromium");
    ensureDirSync(join(dir, "win64-869685", "chrome-win"));
    assertEquals(removeLegacyChromium(dir, parent), true);
    assert(!existsSync(dir));
    assertEquals(removeLegacyChromium(dir, parent), false);
    assertEquals(legacyChromiumDir().replaceAll("\\", "/").endsWith("quarto/chromium"), true);
  } finally {
    temp.cleanup();
  }
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/tools/chromium-legacy.test.ts`
Expected: FAIL, `Module not found ".../src/tools/impl/chromium-legacy.ts"`.

- [ ] **Step 3: Implement**

Create `src/tools/impl/chromium-legacy.ts`:

```ts
/*
 * chromium-legacy.ts
 *
 * The `chromium` tool (Quarto 1.9 and earlier) downloaded Chromium with
 * puppeteer 9's BrowserFetcher into <quarto data dir>/chromium/
 * <linux|mac|win32|win64>-<revision>/. The tool is removed; Quarto only
 * detects that directory (to point at the cleanup command) and removes it.
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { join } from "../../deno_ral/path.ts";
import {
  existsSync,
  safeRemoveDirSync,
  walkSync,
} from "../../deno_ral/fs.ts";
import { userDataDir } from "../../core/appdirs.ts";

const kRevisionDirRe = /^(linux|mac|win32|win64)-\d+$/;

export function legacyChromiumDir(): string {
  return join(userDataDir("quarto"), "chromium");
}

export function hasLegacyChromium(dir = legacyChromiumDir()): boolean {
  if (!existsSync(dir)) {
    return false;
  }
  for (
    const entry of walkSync(dir, {
      maxDepth: 1,
      includeFiles: false,
      includeDirs: true,
    })
  ) {
    if (entry.path !== dir && kRevisionDirRe.test(entry.name)) {
      return true;
    }
  }
  return false;
}

export function removeLegacyChromium(
  dir = legacyChromiumDir(),
  boundary = userDataDir("quarto"),
): boolean {
  if (!existsSync(dir)) {
    return false;
  }
  safeRemoveDirSync(dir, boundary);
  return true;
}
```

- [ ] **Step 4: Run the test**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/tools/chromium-legacy.test.ts`
Expected: `2 passed`.

- [ ] **Step 5: Commit**

```bash
git add src/tools/impl/chromium-legacy.ts tests/unit/tools/chromium-legacy.test.ts
git commit -m "Add detection and removal of an old 'quarto install chromium' download"
```

### Task 3: Remove the `chromium` tool and the `puppeteer` dependency

**Files:**
- Delete: `src/tools/impl/chromium.ts`
- Modify: `src/tools/tools.ts`, `src/tools/tools-console.ts`, `src/tools/impl/chrome-headless-shell.ts`, `src/command/check/check.ts`
- Modify: `src/import_map.json`, `deno.lock`

- [ ] **Step 1: The tool registry (`src/tools/tools.ts`)**

1. Delete line 20 `import { chromiumInstallable } from "./impl/chromium.ts";` and add `import { hasLegacyChromium, removeLegacyChromium } from "./impl/chromium-legacy.ts";`.
2. Replace lines 31-45
```ts
// The tools that are available to install
const kInstallableTools: { [key: string]: InstallableTool } = {
  tinytex: tinyTexInstallable,
  // temporarily disabled until deno 1.28.* gets puppeteer support
  chromium: chromiumInstallable,
  "chrome-headless-shell": chromeHeadlessShellInstallable,
  verapdf: verapdfInstallable,
};

// Tools deprecated in v1.10, to be removed from the registry in v1.11
const kDeprecatedTools = new Set(["chromium"]);

export function isDeprecatedTool(key: string): boolean {
  return kDeprecatedTools.has(key);
}
```
with
```ts
// The tools that are available to install. `chromium` was removed in v1.11;
// installTool/updateOrInstallTool redirect it to chrome-headless-shell and
// uninstallTool removes an old download (src/tools/impl/chromium-legacy.ts).
const kInstallableTools: { [key: string]: InstallableTool } = {
  tinytex: tinyTexInstallable,
  "chrome-headless-shell": chromeHeadlessShellInstallable,
  verapdf: verapdfInstallable,
};
```
3. In `allTools()` replace `} else if (!isDeprecatedTool(name)) {` with `} else {`.
4. In `checkToolRequirement` delete the `if (name.toLowerCase() === "chromium" && isWSL()) { ... return false; } else ` branch (lines 102-112) so the function starts with `if (name.toLowerCase() === "chrome-headless-shell" && isWSL()) {`; delete the `isWSL` import only if nothing else in the file uses it (`grep -n isWSL src/tools/tools.ts`).
5. At the start of `uninstallTool` (before `const tool = installableTool(name);`) add:
```ts
  // the removed `chromium` tool: delete an old download, if any
  if (name.toLowerCase() === "chromium") {
    if (removeLegacyChromium()) {
      info("Removed the Chromium downloaded by 'quarto install chromium'.");
    } else {
      info("No Chromium download from 'quarto install chromium' was found.");
    }
    return;
  }
```
and export `hasLegacyChromium` for the console code by adding `export { hasLegacyChromium, removeLegacyChromium } from "./impl/chromium-legacy.ts";` at the end of the import block (so `tools-console.ts` and `check.ts` import from `tools.ts`, as they do for the rest).

- [ ] **Step 2: The console (`src/tools/tools-console.ts`)**

1. In the import from `./tools.ts` (lines 11-18) remove `isDeprecatedTool` and add `removeLegacyChromium`.
2. In `loadTools` delete the line `      if (!installed && isDeprecatedTool(key)) continue;`.
3. Replace lines 164-169
```ts
      // Uninstall legacy chromium before delegating to chrome-headless-shell.
      // We can't do this after because installTool/updateTool call Deno.exit.
      const legacyTool = installableTool("chromium");
      if (legacyTool && await legacyTool.installed()) {
        await uninstallTool("chromium");
      }
```
with
```ts
      // Remove an old `quarto install chromium` download before delegating to
      // chrome-headless-shell (installTool/updateTool call Deno.exit).
      if (removeLegacyChromium()) {
        info("Removed the Chromium downloaded by 'quarto install chromium'.");
      }
```

- [ ] **Step 3: `chrome-headless-shell` after-install (`src/tools/impl/chrome-headless-shell.ts`)**

Replace line 34 `import { chromiumInstallable } from "./chromium.ts";` with `import { hasLegacyChromium, removeLegacyChromium } from "./chromium-legacy.ts";` and the body of `afterInstall` (lines 135-148)
```ts
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
```
with
```ts
  // Clean up an old download from 'quarto install chromium'
  try {
    if (hasLegacyChromium()) {
      ctx.info("Removing legacy Chromium installation...");
      removeLegacyChromium();
    }
  } catch {
    ctx.info(
      "Note: Could not remove legacy Chromium. " +
        "You can remove it manually with 'quarto uninstall chromium'.",
    );
  }
  return false;
```
(`afterInstall` is `async function afterInstall(ctx: InstallContext): Promise<boolean>`; only the two calls inside the `try` change, `hasLegacyChromium`/`removeLegacyChromium` being synchronous.)

- [ ] **Step 4: `quarto check` (`src/command/check/check.ts`)**

1. In line 25 replace `import { allTools, installableTool } from "../../tools/tools.ts";` with `import { allTools, hasLegacyChromium } from "../../tools/tools.ts";` and add `import { legacyChromiumDir } from "../../tools/impl/chromium-legacy.ts";`.
2. Delete lines 423-427:
```ts
      if (tool.name === "Chromium (deprecated)") {
        toolsOutput.push(
          `${kIndent}      (Run "quarto install chrome-headless-shell" to replace)`,
        );
      }
```
3. Replace the legacy block of `detectChromeForCheck` (lines 609-621)
```ts
  // Legacy: chromium installed by Quarto
  const chromiumTool = installableTool("chromium");
  if (chromiumTool && await chromiumTool.installed()) {
    let path: string | undefined;
    if (chromiumTool.binDir) {
      path = await chromiumTool.binDir();
    }
    const version = await chromiumTool.installedVersion();
    result.detected = {
      label: "Chromium installed by Quarto",
      path,
      source: "quarto",
      version,
    };
  }
```
with
```ts
  // An old `quarto install chromium` download is never used; say how to clean up
  if (hasLegacyChromium()) {
    const note =
      `Chromium downloaded by 'quarto install chromium' was found in ${legacyChromiumDir()}; Quarto no longer uses it. Run 'quarto install chrome-headless-shell', then 'quarto uninstall chromium'.`;
    result.warning = result.warning ? `${result.warning} ${note}` : note;
  }
```

- [ ] **Step 5: Delete the tool and the dependency**

Run: `git rm src/tools/impl/chromium.ts`
In `src/import_map.json` delete the line
```json
    "puppeteer": "https://deno.land/x/puppeteer@9.0.2/mod.ts",
```
Run: `package/scripts/vendoring/update-lock.sh`
Expected: `deno.lock updated; ...` (the `deno.land/x/puppeteer` entries stay until Task 6 deletes `src/vendor_deps.ts`, which still imports the port by URL).

- [ ] **Step 6: Type-check, run the tests, exercise the CLI**

Run: `package/dist/bin/tools/x86_64/deno check --import-map src/import_map.json src/quarto.ts && rg -n 'chromiumInstallable|isDeprecatedTool|getPuppeteer|from "puppeteer"' src`
Expected: exit 0; `rg` prints nothing.

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/core/browser-discovery.test.ts unit/tools/chromium-legacy.test.ts unit/tools/chrome-headless-shell.test.ts unit/chrome-launch.test.ts unit/chrome-launch-flags.test.ts $(find smoke/check smoke/env -name '*.test.ts')`
Expected: all passed.

Run (Linux; on macOS the data dir is `~/Library/Application Support/quarto`, on Windows `%LOCALAPPDATA%\quarto`):
```bash
D="${XDG_DATA_HOME:-$HOME/.local/share}/quarto/chromium/linux-869685/chrome-linux"
mkdir -p "$D"
QUARTO_CHROMIUM=/nonexistent package/dist/bin/quarto check install 2>&1 | grep -A3 'Checking Chrome Headless'
package/dist/bin/quarto list tools 2>&1 | grep -ci chromium
package/dist/bin/quarto uninstall chromium --no-prompt; test ! -e "${D%/linux-869685/chrome-linux}" && echo removed
package/dist/bin/quarto install chromium --no-prompt 2>&1 | head -2
```
Expected: the Chrome section shows the `NOTE:` naming the directory when no other browser is found (if a system Chrome or chrome-headless-shell is installed, `Using: ...` is printed instead and no note, which is also correct); `grep -ci` prints `0`; `Removed the Chromium downloaded by 'quarto install chromium'.` then `removed`; the deprecation warning, then the `chrome-headless-shell` install.

- [ ] **Step 7: Commit**

```bash
git add src/tools/tools.ts src/tools/tools-console.ts src/tools/impl/chrome-headless-shell.ts src/command/check/check.ts src/import_map.json deno.lock
git commit -m "Remove the deprecated chromium tool and the puppeteer 9 port

'quarto install chromium' and 'quarto update tool chromium' still redirect
to chrome-headless-shell; 'quarto uninstall chromium' removes an old
download, which Quarto no longer uses to render."
```

### Task 4: Chrome features still work (CDP path)

**Files:** none

- [ ] **Step 1: Mermaid, axe and the bundle**

Run: `package/dist/bin/quarto install chrome-headless-shell --no-prompt` (if `quarto check` reports `Chrome: (not detected)`), then:
```bash
cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/axe/axe-findings.test.ts
cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent \
  docs/smoke-all/2026/02/12/mermaid-typst.qmd docs/smoke-all/2026/02/12/mermaid-multi-diagram.qmd docs/smoke-all/2023/12/11/4376.qmd
cd package/src && ./quarto-bld prepare-dist --set-version $(cat ../../version.txt) && cd ../..
package/dist/bin/quarto run --dev tools/check-bundle-externals.ts package/pkg-working/bin/quarto.js
```
Expected: all passed (mermaid to Typst renders an image through `withCriClient`); `OK: no external module specifiers ...` (nothing puppeteer-related is left to bundle).

### Task 5: Changelog

**Files:**
- Modify: `news/changelog-1.11.md`

- [ ] **Step 1: Open the PR as a draft and get its number**

Run: `git push -u origin rt/07-remove-puppeteer-and-chromium-tool && gh pr create --draft --fill && gh pr view --json number -q .number`
Expected: the PR number (for example `15106`).

- [ ] **Step 2: Add the entry**

In `news/changelog-1.11.md`, under `## Commands`, add a subsection `### \`install\`` after `### \`check\`` (or add to it if it exists) with:
```markdown
- ([#15106](https://github.com/quarto-dev/quarto-cli/pull/15106)): Remove the `chromium` tool, deprecated in 1.10. `quarto install chromium` and `quarto update tool chromium` still install `chrome-headless-shell` with a deprecation warning, and `quarto uninstall chromium` removes a Chromium downloaded by Quarto 1.9 or earlier. Quarto no longer renders with such a download; run `quarto install chrome-headless-shell` if no Chrome or Edge is installed.
```

- [ ] **Step 3: Commit**

```bash
git add news/changelog-1.11.md
git commit -m "Changelog: chromium tool removed"
git push
```

### Task 6: Phase 0 exit: std redirects, `vendor_deps.ts`, dead import maps, remaining URLs

Run this task only when PRs 03, 04, 05 and 06 are merged and this branch is rebased on them.

**Files:**
- Modify: `src/import_map.json`, `deno.lock`
- Modify: `tests/smoke/inspect/inspect-code-cells.test.ts`, `inspect-extensions.test.ts`, `inspect-include.test.ts`, `inspect-recursive-include.test.ts`
- Delete: `src/vendor_deps.ts`, `src/dev_import_map.json`, `src/import_map_additional_entries.json`, `package/src/common/create-dev-import-map.ts`
- Modify: `package/scripts/vendoring/vendor.sh`, `package/scripts/vendoring/vendor.cmd`, `.github/workflows/actions/quarto-dev/action.yml`, `dev-docs/ci-deno-caching.md`, `.claude/CLAUDE.md`, `tests/README.md`
- Modify: `tests/run-parallel-tests.ts`, `src/resources/tools/ast-diagram/main.ts`, `tools/document-generator/main.ts`, `tools/run-pandoc-capture.ts`, `tools/subcommand-history.ts`
- Modify: `tools/runtime-boundary-baseline.json`

- [ ] **Step 1: Check the prerequisites**

Run: `grep -c 'deno\.land/x\|skypack' src/import_map.json; grep -cE '"(semver|deno_dom/|cliffy/command/mod.ts|yaml)": "(npm|jsr):' src/import_map.json`
Expected: `0`, then `4` (03 moved `yaml` to npm, 04 `semver`, 05 `deno_dom/`, 06 `cliffy/command/mod.ts`; Task 3 removed `puppeteer`). Any other result means a Phase 0 PR is not merged into this branch yet: stop and rebase.

- [ ] **Step 2: Confirm PR 00b rewrote the four inspect tests, and drop `src/vendor_deps.ts` from the lock entrypoints**

Assumes PR 00b landed (its Task 6 step 4 moved `assertObjectMatch` of the four `tests/smoke/inspect/*.test.ts` to `tests/asserts.ts`; its `tools/check-test-imports.ts` exports `kLockEntrypoints` with six entries).
Run: `grep -l 'deno.land/std@0.93.0' tests/smoke/inspect/*.test.ts; grep -n 'vendor_deps' tools/check-test-imports.ts dev-docs/add-typescript-dependency.md package/scripts/vendoring/update-lock.sh`
Expected: the first `grep` prints nothing (if it prints a file, PR 00b is not on `main`: stop, this PR lands after it); the second prints the lines that name `src/vendor_deps.ts` as a lock entrypoint. Remove `src/vendor_deps.ts` from `kLockEntrypoints`, from the entrypoint list in `dev-docs/add-typescript-dependency.md` and from `update-lock.sh` if it repeats the list; adjust `tools/check-test-imports.test.ts` if it counts six entries.
Run: `quarto run --dev tools/check-test-imports.ts`
Expected: `OK: every remote module the tests reach is in the locked graph (...)`, exit 0 (the file is deleted later in this task; `deno info` on a missing entrypoint would fail the Bundle Test job otherwise).

- [ ] **Step 3: Find which `deno.land/std` redirect keys anything still uses**

Run (from the repository root; `deno info` fetches remote modules, so it needs network):
```bash
D=package/dist/bin/tools/$(uname -m | sed 's/arm64/aarch64/')/deno
T=$(mktemp -d)
{
  for f in src/quarto.ts src/vendor_deps.ts tests/test-deps.ts package/src/bld.ts package/scripts/deno_std/deno_std.ts \
           $(git ls-files 'tests/**/*.test.ts' 'tools/*.ts') \
           $(git ls-files 'src/resources/**/*.ts' | grep -v -e '\.ejs\.ts$' -e '\.d\.ts$' \
               -e '^src/resources/extension-subtrees/' -e '^src/resources/scripts/' -e '^src/resources/create/'); do
    echo "import \"file://$PWD/$f\";"
  done
} > "$T/entrypoints.ts"
"$D" info --json --import-map src/import_map.json "$T/entrypoints.ts" > "$T/info.json"
"$D" eval --no-config '
const info = JSON.parse(Deno.readTextFileSync(Deno.args[0]));
const raw = new Set<string>();
for (const m of info.modules ?? []) for (const d of m.dependencies ?? []) raw.add(d.specifier);
const map = JSON.parse(Deno.readTextFileSync("src/import_map.json")).imports;
for (const key of Object.keys(map)) {
  if (!key.startsWith("https://deno.land/std")) continue;
  const used = [...raw].filter((s) => key.endsWith("/") ? s.startsWith(key) : s === key);
  console.log((used.length ? "USED   " : "UNUSED ") + key + (used.length ? "  <- " + used.slice(0, 3).join(", ") : ""));
}' "$T/info.json"
```
(`src/resources/scripts/` and `src/resources/create/` are left out on purpose: they run with `src/resources/deno_std/run_import_map.json` or are templates, never with `src/import_map.json`; `src/vendor_deps.ts` is still an entrypoint here because Step 5 deletes it.)
Expected: one line per `https://deno.land/std@...` key of `src/import_map.json`, all `UNUSED` except possibly `https://deno.land/std@0.196.0/encoding/base64.ts` (used by `src/vendor_deps.ts` itself, deleted in Step 5) and `https://deno.land/std@0.93.0/...` keys used by `src/vendor_deps.ts` (same). Any other `USED` line names its importer after `<-`: keep that key, add the importer to the PR description and to the allow-list of Step 7 with its owner, and continue.

- [ ] **Step 4: Delete the unused redirect keys**

In `src/import_map.json` delete every key reported `UNUSED` (and those used only by `src/vendor_deps.ts`). On `main` at `b86f98d` these are the eleven keys
```json
    "https://deno.land/std@0.91.0/path/mod.ts": "jsr:/@std/path@1.0.8",
    "https://deno.land/std@0.91.0/path/": "jsr:/@std/path@1.0.8/",
    "https://deno.land/std@0.196.0/console/unicode_width.ts": "https://deno.land/std@0.224.0/console/unicode_width.ts",
    "https://deno.land/std@0.161.0/": "https://deno.land/std@0.217.0/",
    "https://deno.land/std@0.101.0/": "https://deno.land/std@0.217.0/",
    "https://deno.land/std@0.105.0/": "https://deno.land/std@0.217.0/",
    "https://deno.land/std@0.93.0/encoding/base64.ts": "https://deno.land/std@0.196.0/encoding/base64.ts",
    "https://deno.land/std@0.93.0/path/mod.ts": "https://deno.land/std@0.204.0/path/mod.ts",
    "https://deno.land/std@0.93.0/": "https://deno.land/std@0.217.0/",
    "https://deno.land/std@0.91.0/fs/exists.ts": "https://deno.land/std@0.217.0/fs/exists.ts",
    "https://deno.land/std@0.91.0/fs/ensure_dir.ts": "https://deno.land/std@0.217.0/fs/ensure_dir.ts"
```
(remove the trailing comma left on the new last entry so the JSON stays valid: `package/dist/bin/tools/x86_64/deno eval 'JSON.parse(Deno.readTextFileSync("src/import_map.json")); console.log("valid")'` prints `valid`).

- [ ] **Step 5: Delete `src/vendor_deps.ts` and its references**

Run: `git rm src/vendor_deps.ts`
In `package/scripts/vendoring/vendor.sh` and `vendor.cmd` remove `vendor_deps.ts` from the `--entrypoint` list (PR 00b's single `deno install` call). In `.github/workflows/actions/quarto-dev/action.yml` remove `'src/vendor_deps.ts', ` from the dev-cache `hashFiles(...)`. In `dev-docs/ci-deno-caching.md` delete the `src/vendor_deps.ts` row of the key table and change "six files" to "five files".

- [ ] **Step 6: Dead import maps and the remaining URLs**

Run: `git rm src/dev_import_map.json src/import_map_additional_entries.json package/src/common/create-dev-import-map.ts` (none has a reader: `rg -n 'dev_import_map|import_map_additional_entries|create-dev-import-map' --hidden -g '!dev-docs/runtime-migration/**' .` lists only `.claude/CLAUDE.md:25`, `tests/README.md:369` and the files themselves).
In `.claude/CLAUDE.md` replace
```markdown
- `src/import_map.json` / `src/dev_import_map.json` — Deno import mappings (production / development)
```
with
```markdown
- `src/import_map.json` — Deno import mappings; `deno.lock` pins what they resolve to (update both with `package/scripts/vendoring/update-lock.sh`)
```
In `tests/README.md:369` replace `--importmap=C:\Users\chris\Documents\DEV_R\quarto-cli\src\dev_import_map.json` with `--importmap=C:\Users\chris\Documents\DEV_R\quarto-cli\src\import_map.json`.

Pin the five unversioned `deno.land/std` imports of dev scripts and the test runner to JSR (these scripts run with plain `deno run` or `quarto run`, outside `src/import_map.json`):
- `src/resources/tools/ast-diagram/main.ts:3`: `import { join } from "https://deno.land/std/path/mod.ts";` → `import { join } from "jsr:@std/path@1.0.8";`
- `tools/run-pandoc-capture.ts:2`: `import { resolve, dirname } from "https://deno.land/std/path/mod.ts";` → `import { resolve, dirname } from "jsr:@std/path@1.0.8";`
- `tools/subcommand-history.ts:46`: `import { join, relative } from "https://deno.land/std/path/mod.ts";` → `import { join, relative } from "jsr:@std/path@1.0.8";`
- `tools/document-generator/main.ts:1`: `import * as mod from "https://deno.land/std/yaml/mod.ts";` → `import * as mod from "jsr:@std/yaml@1.0.5";` (`mod.stringify` exists in `@std/yaml` 1.0.5)
- `tests/run-parallel-tests.ts:13-17` (the fallback when `stdlib/*` does not resolve): `await import("https://deno.land/std/path/mod.ts")` → `await import("jsr:@std/path@0.224.0")`, `await import("https://deno.land/std/fs/mod.ts")` → `await import("jsr:@std/fs@0.224.0")`, `await import("https://deno.land/std/flags/mod.ts")` → `await import("jsr:@std/flags@0.224.0")` (the versions `run_import_map.json` maps `stdlib/path`, `stdlib/fs`, `stdlib/flags` to).

Run: `cd tests && ./run-parallel-tests.sh -n=2 --dry-run | head -5`
Expected: the bucket listing (the runner still starts).

- [ ] **Step 7: The Phase 0 exit check**

Run:
```bash
rg -n 'deno\.land|skypack|jspm' src package tests tools \
  -g '!src/resources/deno_std/**' -g '!package/scripts/deno_std/deno_std.ts' \
  -g '!src/resources/scripts/**' \
  -g '!src/resources/tools/ast-tracing/**' -g '!tools/sass-variable-explainer/parse-web.ts' -g '!tests/docs/reveal/actors.js' \
  -g '!tests/integration/playwright/tests/axe-accessibility.spec.ts' -g '!tests/unit/axe-no-cdn.test.ts' \
  -g '!tests/docs/manuscript/ipynb-full/**' \
  -g '!src/core/deno/debug.ts' -g '!src/core/jupyter/capabilities.ts' -g '!src/core/lib/glob.ts' \
  -g '!src/core/lib/external/colors.ts' -g '!src/core/lib/external/README.md' -g '!src/publish/confluence/confluence-helper.ts'
echo "exit=$?"
```
Expected: no output and `exit=1` (`rg` exits 1 when nothing matches). Every allow-list entry is in the table of the Context section; add a line to that table (in this plan and in the PR description) for any entry Step 3 kept.

- [ ] **Step 8: Re-vendor, configure from scratch, run the suites, lower the ratchet**

Run:
```bash
package/scripts/vendoring/update-lock.sh
rm -rf package/dist/bin/deno_cache && ./configure.sh && git status --short
package/dist/bin/tools/x86_64/deno check --import-map src/import_map.json src/quarto.ts package/src/bld.ts
cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent $(find smoke/inspect smoke/check -name '*.test.ts') unit/tools/check-runtime-boundary.test.ts
cd .. && package/dist/bin/quarto run --dev tools/check-runtime-boundary.ts --update-baseline && git diff tools/runtime-boundary-baseline.json
```
Expected: `configure` succeeds with the frozen lockfile (it no longer vendors `vendor_deps.ts`, so no `deno.land/x/puppeteer` or `dev.jspm.io` fetch); `git status --short` shows only this task's changes; `deno check` exits 0; tests pass; the baseline diff lowers `src.stdImportFiles` by 1 (`src/vendor_deps.ts`) and `tests.stdImportFiles` by 4 (the inspect tests), nothing else.

- [ ] **Step 9: Commit**

```bash
git add -A src/import_map.json deno.lock tests/smoke/inspect package/scripts/vendoring .github/workflows/actions/quarto-dev/action.yml \
  dev-docs/ci-deno-caching.md .claude/CLAUDE.md tests/README.md tests/run-parallel-tests.ts \
  src/resources/tools/ast-diagram/main.ts tools/document-generator/main.ts tools/run-pandoc-capture.ts tools/subcommand-history.ts \
  tools/runtime-boundary-baseline.json
git commit -m "Phase 0 exit: drop unused deno.land/std redirects, vendor_deps.ts and dead import maps

No module resolved through src/import_map.json comes from deno.land,
skypack or jspm any more; the remaining references are allow-listed
(quarto run stdlib, browser-side code, comments)."
```

### Task 7: Status

- [ ] **Step 1: Set the PR 07 row to `in progress` (with the new file name) and commit**

```bash
git add dev-docs/runtime-migration/README.md
git commit -m "runtime-migration: PR 07 in progress"
```

## Verification

```bash
rm -rf package/dist/bin/deno_cache && ./configure.sh                        # frozen deno.lock, no vendor_deps.ts
git status --short                                                           # empty
package/dist/bin/tools/x86_64/deno check --import-map src/import_map.json src/quarto.ts package/src/bld.ts
package/dist/bin/quarto install chrome-headless-shell --no-prompt            # so the browser-backed tests run
package/dist/bin/quarto check                                                # Chrome Headless section: "Chrome Headless Shell installed by Quarto"
cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent \
  unit/core/browser-discovery.test.ts unit/tools/chromium-legacy.test.ts \
  unit/tools/chrome-headless-shell.test.ts unit/chrome-launch.test.ts unit/chrome-launch-flags.test.ts \
  $(find smoke/check smoke/env smoke/inspect -name '*.test.ts') smoke/axe/axe-findings.test.ts
cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent \
  docs/smoke-all/2026/02/12/mermaid-typst.qmd docs/smoke-all/2026/02/12/mermaid-multi-diagram.qmd \
  docs/smoke-all/2023/12/11/4376.qmd
package/dist/bin/quarto install chromium --no-prompt 2>&1 | head -2          # deprecation redirect still printed
package/dist/bin/quarto run --dev tools/check-runtime-boundary.ts            # OK against Task 6's baseline
```
Plus Task 3 Step 6 (the fake old download) and Task 6 Step 7 (exit check).

On the PR: `Smoke Tests`, `Parallel Smokes Tests`, `Bundle Test` (three OSes), `Test Tool Install` (including the "Chromium deprecation redirect" job on four runners), `Runtime Boundary`.

## Review checklist

- [ ] `src/core/puppeteer.ts` exports only `findChrome`, `detectBrowser`, `getBrowserExecutablePath` and the two detection interfaces; no puppeteer import; no `quartoDataDir`/`UnreachableError` import left.
- [ ] `getBrowserExecutablePath` keeps the three-step order and has no legacy fallback.
- [ ] `src/tools/impl/chromium.ts` is deleted; `chromium-legacy.ts` imports only `deno_ral/*` and `core/appdirs.ts` (no cycle with `tools.ts`) and never creates the directory it inspects.
- [ ] `quarto install chromium` and `quarto update tool chromium` still redirect with the same deprecation text the `test-install.yml` job greps for (`is deprecated`); `quarto uninstall chromium` removes the old directory.
- [ ] `quarto check` no longer prints "Chromium (deprecated)" or "Chromium installed by Quarto"; it prints the `NOTE:` only when no browser is found and an old download exists.
- [ ] The comments in `handlers/types.ts`, `cri/launch.ts`, `deno/monkey-patch.ts` no longer mention puppeteer.
- [ ] Task 6 ran after 03–06 were merged; its `deno info` output and the Step 7 exit check output are pasted in the PR description; every remaining `deno.land`/skypack/jspm reference is in the allow-list table.
- [ ] `src/vendor_deps.ts` and the three dead import-map files are gone and nothing references them.
- [ ] The baseline diff lowers only `src.stdImportFiles` (−1); `tests.stdImportFiles` is unchanged (PR 00b took the inspect-tests credit).

## Risks and rollback

- A user without Chrome, Edge or `chrome-headless-shell` who relied on an old `quarto install chromium` download now gets "Chrome not found" for mermaid-to-image, `createPngsFromHtml` and axe; the message and `quarto check` both name `quarto install chrome-headless-shell`. The deprecation in 1.10 announced this; the changelog says it again.
- Third-party code that imported the puppeteer helpers from Quarto's sources: none is supported (these are internal modules, not the extension API).
- `src/core/deno/monkey-patch.ts` still patches `Deno.copy`/`Deno.writeAll` "for dependencies not ported to Deno 2"; the puppeteer port was a likely user. PR 25, which removes the monkey-patch, should check with the bundle gate that nothing needs them any more.
- Task 6 deletes import-map keys: a module the `deno info` sweep could not see (a dynamic import with a computed specifier) would fail with "Module not found" at runtime. The sweep covers every static and string-literal dynamic import of every entrypoint; the bundle gate (empty `DENO_DIR`, renders) and the full suite are the backstop. Rollback for one key: put it back.
- Rollback: revert the commits in reverse order (each carries its `deno.lock` change); the tool, the port and the redirects return.

## Decisions needed

1. **Keep the file name `src/core/puppeteer.ts`?** It no longer has anything to do with puppeteer; renaming it (for example to `src/core/browser.ts`) touches its three importers (`src/command/check/check.ts`, `src/core/cri/launch.ts`, `tests/smoke/axe/axe-findings.test.ts`) and every future plan that cites the path. Recommendation: keep the name in this PR (smaller diff during Phase 0); rename in a one-commit follow-up after Phase 1 if wanted.

Review items closed here: option A's `ws`/CommonJS bundling blocker (puppeteer-core is not added; decision 8), the deprecated tool's BrowserFetcher layout (deleted, only detection and removal remain), the four inspect tests the redirect deletion would have broken (rewritten to `tests/asserts.ts` before the redirects go), the dependency on a PR 06 step that did not exist (`vendor_deps.ts` is deleted here, after 06), the screenshot contradiction (no screenshot code remains), and the Phase 0 exit criterion with its allow-list.
