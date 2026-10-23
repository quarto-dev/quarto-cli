# PR 05: deno_dom from `deno.land/x` to `jsr:@b-fuze/deno-dom`, and the `parseHtml` baseline

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve `deno_dom/` from JSR (`@b-fuze/deno-dom@0.1.56`) with `deno.lock` updated, keep the native FFI plugin path working on all three launchers and prove it in the release bundle, make `src/core/deno-dom.ts` the only file that imports the package, and record the `parseHtml` function-time baseline on the native plugin that PR 20's WASM gate compares against.
**Phase:** 0. **Depends on:** 02 (ratchet, `tests/asserts.ts`), 00b (frozen `deno.lock`, `update-lock.sh`, the three-OS bundle gate this PR extends). **Unblocks:** PR 20 (drops the FFI path from this one file; gates on the baseline recorded here), PR 26, PR 07's last task.
**Branch:** `rt/05-deps-deno-dom-jsr`.
**Suggested executor:** Opus. The import rewrite is mechanical, but the native-plugin initialisation changes shape (JSR does not export the `register` function Quarto's copy of `deno-dom-native.ts` relies on), the HTML post-processing code is the most DOM-heavy part of Quarto, and the 0.1.41 → 0.1.56 behaviour differences must be read and judged.
**Size:** M (import map, `deno.lock`, `src/core/deno-dom.ts`, 8 importer files, `package/scripts/windows/quarto.cmd`, 1 unit test, `tools/parsehtml-timing.sh`, 2 workflows).
**Ships on:** Deno; the existing test suite must stay green.

## Spec

### Context

`00-assessment.md` sections 3.3 (`Deno.dlopen` row), 3.4 (deno_dom row) and 11 ("`ffi` remove" row); `REVIEW-2026-10-15.md` Phase 0 "05" and decision 6. deno_dom is the DOM implementation behind every HTML post-processor (`parseHtml` is called from 6 files, the `Document`/`Element` types from about 60). The package moved to JSR; `deno.land/x` is frozen at 0.1.41 and the Node bundle (PR 26) resolves JSR packages natively. Keeping the same DOM implementation means none of the ~1,900 DOM call sites change.

Facts verified while writing this plan (Deno 2.7.14, `https://jsr.io/@b-fuze/deno-dom/meta.json`, `0.1.56_meta.json`, and a run through an import map):

- Latest JSR version: **0.1.56** (versions 0.1.48 … 0.1.56 exist; 0.1.41 is not on JSR). There is no changelog file in the package; Task 1 reads the GitHub releases between v0.1.41 and v0.1.56. 0.1.56 ships `src/dom/elements/html-template-element.ts`: if 0.1.41 did not implement `HTMLTemplateElement`, template children moved from the element's child list into its `content` fragment, so `querySelector` no longer finds nodes inside a `<template>`. Quarto emits one: the dashboard card's expand button (`src/format/dashboard/format-dashboard-card.ts:30`, `<bslib-tooltip ...><template>Expand</template>...`).
- JSR exports (the only importable subpaths): `.` (`deno-dom-wasm.ts`, auto-initialising), `./wasm` (same), `./wasm-legacy`, `./wasm-noinit` (`deno-dom-wasm-noinit.ts`: `initParser()` plus `export * from "./src/api.ts"`), `./native` (`deno-dom-native.ts`). `src/parser.ts`, `src/dom/dom-parser.ts`, `src/api.ts` and `src/dom/node.ts` are not exported, so the imports in `src/core/deno-dom.ts:9-11` cannot be kept.
- `./wasm-noinit` exports everything `src/core/deno-dom.ts` re-exports today (`Document`, `HTMLDocument`, `Element`, `Node`, `NodeType`, `NodeList`, `HTMLCollection`, `Comment`, `Text`, `Attr`, `CharacterData`, `DocumentFragment`, `DOMParser`, `nodesFromString`, …) plus `initParser`; verified to type-check and run through `"deno_dom/": "jsr:/@b-fuze/deno-dom@0.1.56/"`.
- `./native` is the upstream version of the code Quarto copied into `src/core/deno-dom.ts:56-176`: at module evaluation it reads `DENO_DOM_PLUGIN`, runs a top-level `await` of `dlopen(path, symbols)` with the same five symbols and calls `register(parse, parseFrag)`. If the variable is **unset** it downloads a plugin from GitHub (`v0.1.41-alpha-artifacts`) through `jsr:@denosaurs/plug@1.1.0`. If `dlopen` fails, module evaluation throws, so a dynamic `import("deno_dom/native")` rejects and the caller can fall back to WASM (verified with `DENO_DOM_PLUGIN=/nonexistent/libplugin.so`).
- Three launchers set `DENO_DOM_PLUGIN` (so the download branch is never reached): `package/scripts/common/quarto:167-173` (`tools/<arch>/deno_dom/libplugin.so|.dylib`), `package/launcher/src/main.rs:65-68,75` (the Windows release `quarto.exe`: `tools\x86_64\deno_dom\plugin.dll`) and `package/scripts/windows/quarto.cmd:118`, which points at `tools\deno_dom\plugin.dll`. Packaging installs the plugin at `tools\<arch>\deno_dom\` (`package/src/common/dependencies/deno_dom.ts:23`), so on Windows the `.cmd` launcher (dev mode, and the release `quarto.cmd`) never loads the native plugin today and silently falls back to WASM. Pre-existing; fixed in Task 5 because this PR's acceptance checks the native path on Windows.
- The native module sits behind a dynamic `import()`, so neither `deno check` nor `quarto check` exercises it, and in the release bundle it is whatever esbuild makes of a dynamic import of a module with a top-level `await` (an inlined lazily initialised module or a separate chunk). The PR 00b bundle gate already scans `quarto.js` for external `jsr:` specifiers (a dynamic import left external would fail at runtime under `--cached-only`); Task 6 adds the runtime proof: the bundled HTML render's debug log must say `Loaded deno-dom-native`. In dev mode the launcher passes `--cached-only`, so Task 3 also proves that `deno install --entrypoint` (PR 00b's `update-lock.sh`) caches the dynamic import and its `jsr:@denosaurs/plug` dependencies.
- No Quarto code constructs DOM nodes directly (`grep -rn 'new Node(\|new Element(\|new HTMLDocument('` is empty), so the non-constructible exports of `api.ts` suffice.

`parseHtml` is wrapped by `makeTimedFunctionAsync("parseHtml", …)` (`src/core/performance/function-times.ts`): with `QUARTO_REPORT_PERFORMANCE_METRICS=functionTimes` and `QUARTO_REPORT_PERFORMANCE_METRICS_FILE=<file>`, a render writes `{"functionTimes": {"parseHtml": {"min", "max", "count", "mean", "variance", "total"}, …}}` (milliseconds; `src/core/performance/metrics.ts:61-73`). The largest HTML targets in `tests/docs` (counted with `find`): the website `tests/docs/smoke-all/typst/margin-layout` (86 documents; formats `html` and `typst`, rendered `--to html`) and the book `tests/docs/books/visualization-curriculum` (9 chapters, 8 of them `.ipynb` with stored Altair outputs, 3.7 MB; not executed). Decision 6 makes PR 20 gate on `parseHtml` time for these two, per OS including arm64 macOS and Windows, at most 2× the native plugin; this PR records the native numbers (and, for information, the WASM numbers the fallback already gives).

Importers today: `src/core/deno-dom.ts` and eight files that bypass it with `from "deno_dom/deno-dom-wasm-noinit.ts"`; 56 files import from `core/deno-dom.ts`. After this PR the eight go through the seam too.

### Scope

In:
- import map entry and `deno.lock`; `src/core/deno-dom.ts` rewritten on the JSR exports with the native path delegated to `deno_dom/native`;
- the eight direct importers routed through `src/core/deno-dom.ts`;
- `package/scripts/windows/quarto.cmd:118` plugin path;
- a unit test for the seam, including `<template>` round-trip;
- the release notes review (Task 1) recorded in the PR description;
- the bundle gate asserts the native plugin loads (all three OSes);
- `tools/parsehtml-timing.sh` and a `workflow_dispatch` workflow that runs it on three OSes; the baseline numbers in the PR description.

Out:
- removing the native plugin (PR 20: `Deno.dlopen`, `package/src/common/dependencies/deno_dom.ts`, launcher env, `configuration`'s `DENO_DOM`);
- changing any DOM call site;
- the Rust launcher (`package/launcher/src/main.rs`; its Windows path is already right);
- the PR 20 gate itself.

### Interfaces

`src/core/deno-dom.ts` keeps its public surface:

```ts
export async function getDomParser(): Promise<DOMParser>;
export const parseHtml: (src: string) => Promise<HTMLDocument>;   // timed, initialises on first use
export async function writeDomToHtmlFile(doc: HTMLDocument, path: string, doctype?: string): Promise<void>;
export async function initDenoDom(): Promise<void>;                // native plugin if DENO_DOM_PLUGIN loads, else WASM; idempotent
export * from "deno_dom/wasm-noinit";                               // Document, Element, Node, NodeType, NodeList, DOMParser, ... (and initParser, which callers must not use)
```

Initialisation contract (unchanged behaviour, new mechanism):

1. If `DENO_DOM_PLUGIN` is set, `await import("deno_dom/native")`: success registers the native parser and logs `debug("Loaded deno-dom-native")`; failure logs `debug("Error loading deno-dom-native: <message>")` and continues.
2. Otherwise, or on failure, `await initParser()` from `deno_dom/wasm-noinit`.
3. A module-level flag makes repeated calls no-ops.

`tools/parsehtml-timing.sh <quarto-command> <label> [runs]`: renders the two targets `runs` times (default 3) with function timing on and prints one tab-separated line per render: `label`, `target`, `run`, `parseHtml count`, `parseHtml total ms`, `parseHtml max ms`; the JSON files go to `$PARSEHTML_TIMING_OUT` (default `parsehtml-timing/`).

### Files

- Modify: `src/import_map.json:36` (`deno_dom/`); `deno.lock` (via `update-lock.sh`)
- Modify: `src/core/deno-dom.ts` (whole file)
- Modify: `src/core/pandoc/self-contained.ts:10-11`, `src/project/types/website/about/website-about.ts:6`, `src/project/types/website/listing/website-listing-categories.ts:6`, `website-listing-feed.ts:9`, `website-listing-shared.ts:9-14`, `website-listing-template.ts:8`, `website-listing.ts:15`, `src/project/types/website/util/discover-meta.ts:7`
- Modify: `package/scripts/windows/quarto.cmd:118`
- Modify: `.github/workflows/test-bundle.yml` (native-plugin assertion)
- Create: `tools/parsehtml-timing.sh`, `.github/workflows/parsehtml-timing.yml`
- Test: `tests/unit/core/deno-dom.test.ts` (new)
- Modify: `tools/runtime-boundary-baseline.json` (`src` −1, `tests` +1)
- Modify: `dev-docs/runtime-migration/README.md` (PR 05 row status)

### Acceptance criteria

- `grep -rn 'from "deno_dom/\|import("deno_dom/' src tests package/src --include=*.ts` lists only `src/core/deno-dom.ts` (the static `deno_dom/wasm-noinit` imports and the dynamic `deno_dom/native`).
- `grep -n deno_dom src/import_map.json` prints `"deno_dom/": "jsr:/@b-fuze/deno-dom@0.1.56/",`.
- Dev mode (`--cached-only`, frozen lockfile): `QUARTO_LOG_LEVEL=debug package/dist/bin/quarto render tests/docs/minimal.qmd --to html 2>&1 | grep deno-dom-native` prints `Loaded deno-dom-native` on Linux x86_64, macOS (x86_64 and arm64) and Windows x86_64 (the last needs Task 5).
- With `QUARTO_DENO_DOM=/nonexistent/libplugin.so` the same command prints `Error loading deno-dom-native: ...` and the render succeeds (WASM fallback).
- `Bundle Test` (PR 00b gate) is green on three OSes and its HTML render log contains `Loaded deno-dom-native` on each.
- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/core/deno-dom.test.ts` → `4 passed`; the HTML smoke tests in Verification pass.
- The PR description contains the 0.1.41 → 0.1.56 release-notes summary and the `parseHtml` baseline table (native, three OSes, both targets; WASM for information).
- `quarto run --dev tools/check-runtime-boundary.ts` passes after `--update-baseline --accept-increase`: `src` −1 (`Deno.dlopen` moved into the package), `tests` +1 (`Deno.readTextFileSync` in the new test).

## Plan

### Task 1: Read what changed between 0.1.41 and 0.1.56

**Files:** none (the result goes into the PR description)

- [ ] **Step 1: List the releases**

Run: `gh release list --repo b-fuze/deno-dom --limit 40` and `gh api repos/b-fuze/deno-dom/compare/v0.1.41...v0.1.56 --jq '.commits[].commit.message' | head -100`
Expected: the release tags between v0.1.41 and v0.1.56 and the commit subjects.

- [ ] **Step 2: Read each release's notes and record the behaviour changes**

Run: `for t in $(gh release list --repo b-fuze/deno-dom --limit 40 --json tagName -q '.[].tagName' | grep -E '^v0\.1\.(4[2-9]|5[0-6])'); do echo "== $t"; gh release view "$t" --repo b-fuze/deno-dom --json body -q .body; done`
Expected: release notes text. In the PR description, list every change that touches parsing, serialization (`outerHTML`, `innerHTML`), selectors (`querySelector*`), `<template>` (`HTMLTemplateElement`, `content`), attribute handling or the WASM/native loaders, one line each with its version.

- [ ] **Step 3: Check Quarto's exposure to `<template>` handling**

Run: `rg -n 'template' src --type ts | rg -i 'querySelector|children|childNodes|innerHTML|\.content\b' ; rg -n '<template' src --type ts`
Expected: no Quarto code queries into a `<template>`; the only emitted `<template>` is `src/format/dashboard/format-dashboard-card.ts:30` (its text `Expand` must survive serialization, which Task 2's test pins). If the first command lists a call site that reads template children, add a test for that call site in Task 2 and record it in the PR.

### Task 2: Unit test for the seam

**Files:**
- Test: `tests/unit/core/deno-dom.test.ts`

- [ ] **Step 1: Write the test**

Create `tests/unit/core/deno-dom.test.ts` (it is the contract of the seam; it runs against the current code first):

```ts
/*
 * deno-dom.test.ts
 *
 * Contract of src/core/deno-dom.ts, the single entry point for deno_dom:
 * initialisation is idempotent, parseHtml returns a queryable document, the
 * re-exported DOM types/values are the ones callers use, <template> content
 * survives serialization, and writeDomToHtmlFile round-trips.
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { unitTest } from "../../test.ts";
import { assert, assertEquals } from "../../asserts.ts";
import { join } from "../../../src/deno_ral/path.ts";
import { createTempContext } from "../../../src/core/temp.ts";
import {
  DOMParser,
  Element,
  getDomParser,
  initDenoDom,
  Node,
  NodeType,
  parseHtml,
  writeDomToHtmlFile,
} from "../../../src/core/deno-dom.ts";

unitTest("deno-dom - initDenoDom is idempotent and parseHtml queries", async () => {
  await initDenoDom();
  await initDenoDom();
  const doc = await parseHtml(
    `<html><body><p id="a">hi <b>there</b></p><div class="x"></div></body></html>`,
  );
  const p = doc.querySelector("#a");
  assert(p !== null, "querySelector found #a");
  assertEquals(p!.textContent, "hi there");
  assertEquals(p!.nodeType, NodeType.ELEMENT_NODE);
  assertEquals(p!.nodeType, Node.ELEMENT_NODE);
  assert(p instanceof Element);
  assertEquals(doc.querySelectorAll("body > *").length, 2);
  assertEquals((doc.querySelector(".x") as Element).tagName, "DIV");
});

unitTest("deno-dom - getDomParser returns a working DOMParser", async () => {
  const parser = await getDomParser();
  assert(parser instanceof DOMParser);
  const doc = parser.parseFromString("<ul><li>1</li><li>2</li></ul>", "text/html");
  assert(doc !== null);
  assertEquals(doc!.querySelectorAll("li").length, 2);
});

unitTest("deno-dom - <template> content survives a parse and serialize round trip", async () => {
  // the dashboard card's expand button (src/format/dashboard/format-dashboard-card.ts)
  const html =
    `<html><head></head><body><bslib-tooltip placement="auto"><template>Expand</template><span class="badge">e</span></bslib-tooltip></body></html>`;
  const doc = await parseHtml(html);
  assertEquals(doc.documentElement!.outerHTML, html);
  assertEquals(doc.querySelectorAll("bslib-tooltip > span.badge").length, 1);
});

unitTest("deno-dom - writeDomToHtmlFile writes doctype and documentElement", async () => {
  const temp = createTempContext();
  try {
    const doc = await parseHtml("<html><head></head><body><p>x</p></body></html>");
    const out = join(temp.createDir(), "out.html");
    await writeDomToHtmlFile(doc, out, "<!DOCTYPE html>");
    assertEquals(
      Deno.readTextFileSync(out),
      "<!DOCTYPE html>\n<html><head></head><body><p>x</p></body></html>",
    );
  } finally {
    temp.cleanup();
  }
});
```

- [ ] **Step 2: Run it against the current code (0.1.41)**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/core/deno-dom.test.ts`
Expected: `4 passed`. The assertions were verified against 0.1.56 while writing this plan; if one fails on 0.1.41, record it in the PR as a 0.1.41 → 0.1.56 behaviour difference, keep the 0.1.56 expectation and check it against Task 1's notes. (The test runner does not set `DENO_DOM_PLUGIN`, so this exercises the WASM path.)

- [ ] **Step 3: Commit**

```bash
git add tests/unit/core/deno-dom.test.ts
git commit -m "Add contract test for the deno-dom seam"
```

### Task 3: Import map, lockfile and `src/core/deno-dom.ts` on the JSR exports

**Files:**
- Modify: `src/import_map.json:36`, `deno.lock`
- Modify: `src/core/deno-dom.ts`

- [ ] **Step 1: Change the import-map entry**

Replace
```json
    "deno_dom/": "https://deno.land/x/deno_dom@v0.1.41/",
```
with
```json
    "deno_dom/": "jsr:/@b-fuze/deno-dom@0.1.56/",
```

- [ ] **Step 2: See the seam fail to resolve**

Run: `package/dist/bin/tools/x86_64/deno check --import-map src/import_map.json src/core/deno-dom.ts`
Expected: errors of the form `Unknown export './deno-dom-wasm-noinit.ts' for '@b-fuze/deno-dom@0.1.56'` (JSR only resolves exported subpaths).

- [ ] **Step 3: Rewrite `src/core/deno-dom.ts`**

Replace the whole file with:

```ts
/*
 * deno-dom.ts
 *
 * Single entry point for deno_dom. Application code imports DOM types and
 * parseHtml/initDenoDom from here, never from the package, so the backend
 * (native plugin today, WASM fallback, WASM only after the Node migration)
 * is a one-file decision.
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { debug } from "../deno_ral/log.ts";

import {
  DOMParser,
  HTMLDocument,
  initParser,
} from "deno_dom/wasm-noinit";
import { makeTimedFunctionAsync } from "./performance/function-times.ts";

export async function getDomParser() {
  await initDenoDom();
  return new DOMParser();
}

export const parseHtml = makeTimedFunctionAsync(
  "parseHtml",
  async function parseHtml(src: string): Promise<HTMLDocument> {
    await initDenoDom();
    const result = (new DOMParser()).parseFromString(src, "text/html");
    if (!result) {
      throw new Error("Couldn't parse string into HTML");
    }
    return result;
  },
);

export async function writeDomToHtmlFile(
  doc: HTMLDocument,
  path: string,
  doctype?: string,
) {
  if (doc.documentElement === null) {
    throw new Error("Document has no root element");
  }
  const output = doctype
    ? doctype + "\n" + doc.documentElement.outerHTML
    : doc.documentElement.outerHTML;
  await Deno.writeTextFile(path, output);
}

// The native backend lives in the package ("deno_dom/native"). Importing that
// module reads DENO_DOM_PLUGIN, dlopens it and registers the native parser; if
// the plugin cannot be opened the import rejects and we fall back to WASM.
// All three launchers set DENO_DOM_PLUGIN (package/scripts/common/quarto,
// package/scripts/windows/quarto.cmd, package/launcher/src/main.rs), so the
// module's own "download the plugin from GitHub" branch for an unset variable
// is never reached: initDenoDom only imports it when the variable is set.
//
// Removed in PR 20 of dev-docs/runtime-migration (WASM only).

let s_DenoDomInitialized = false;
export async function initDenoDom() {
  if (s_DenoDomInitialized) {
    return;
  }

  if (Deno.env.get("DENO_DOM_PLUGIN")) {
    try {
      await import("deno_dom/native");
      debug("Loaded deno-dom-native");
      s_DenoDomInitialized = true;
      return;
    } catch (e) {
      if (!(e instanceof Error)) {
        throw e;
      }
      debug("Error loading deno-dom-native: " + e.message);
    }
  }

  // didn't successfully load deno-dom-native, load the wasm version
  await initParser();
  s_DenoDomInitialized = true;
}

// Everything callers need: Document, HTMLDocument, Element, Node, NodeType,
// NodeList, HTMLCollection, Comment, Text, Attr, CharacterData,
// DocumentFragment, DOMParser, nodesFromString. (initParser is exported too;
// callers must use initDenoDom instead.)
export * from "deno_dom/wasm-noinit";
```

- [ ] **Step 4: Re-vendor, type-check the seam and run the unit test**

Run: `package/scripts/vendoring/update-lock.sh && package/dist/bin/tools/x86_64/deno check --import-map src/import_map.json src/core/deno-dom.ts && cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/core/deno-dom.test.ts`
Expected: `deno.lock updated; ...`; `Check ...deno-dom.ts`; `4 passed`. `git diff deno.lock` shows `jsr:@b-fuze/deno-dom@0.1.56` and `jsr:@denosaurs/plug@1.1.0` (and plug's `@std` dependencies): `deno install --entrypoint` followed the dynamic `import("deno_dom/native")`. If `@denosaurs/plug` is missing from the diff, the dynamic import was not cached and the dev launcher (`--cached-only`) cannot load it; stop and report.

- [ ] **Step 5: Prove both initialisation paths through the dev launcher (`--cached-only`, frozen lockfile)**

Run: `QUARTO_LOG_LEVEL=debug package/dist/bin/quarto render tests/docs/minimal.qmd --to html --output-dir /tmp/rt05 2>&1 | grep -i 'deno-dom-native'`
Expected: `Loaded deno-dom-native` (the launcher exported `DENO_DOM_PLUGIN=package/dist/bin/tools/<arch>/deno_dom/libplugin.so|.dylib`). On Apple Silicon the plugin comes from `quarto-dev/deno-dom-apple-silicon` per `package/src/common/dependencies/deno_dom.ts:37-53` and the message is the same.

Run: `QUARTO_DENO_DOM=/nonexistent/libplugin.so QUARTO_LOG_LEVEL=debug package/dist/bin/quarto render tests/docs/minimal.qmd --to html --output-dir /tmp/rt05 2>&1 | grep -i 'deno-dom-native'; ls /tmp/rt05/minimal.html`
Expected: `Error loading deno-dom-native: Could not open library: ...` and the output file exists (WASM fallback). Remove `/tmp/rt05`.

- [ ] **Step 6: Commit**

```bash
git add src/import_map.json deno.lock src/core/deno-dom.ts
git commit -m "Resolve deno_dom from jsr:@b-fuze/deno-dom

JSR exposes only the wasm/wasm-noinit/native entry points, so the native
plugin is loaded by importing deno_dom/native (which reads DENO_DOM_PLUGIN
and registers the parser) instead of a copy of that code; a failed import
falls back to the WASM parser as before."
```

### Task 4: Route the eight direct importers through the seam

**Files:**
- Modify: the eight files below

- [ ] **Step 1: Edit each import**

| File | Old | New |
|---|---|---|
| `src/core/pandoc/self-contained.ts:11` | `import { Element, HTMLDocument } from "deno_dom/deno-dom-wasm-noinit.ts";` | `import { Element, HTMLDocument } from "../deno-dom.ts";` (line 10 already imports `parseHtml` from there; merge into one line: `import { Element, HTMLDocument, parseHtml } from "../deno-dom.ts";` and delete the old line 10) |
| `src/project/types/website/about/website-about.ts:6` | `import { Document, Element } from "deno_dom/deno-dom-wasm-noinit.ts";` | `import { Document, Element } from "../../../../core/deno-dom.ts";` |
| `src/project/types/website/listing/website-listing-categories.ts:6` | `import { Document } from "deno_dom/deno-dom-wasm-noinit.ts";` | `import { Document } from "../../../../core/deno-dom.ts";` |
| `src/project/types/website/listing/website-listing-feed.ts:9` | `import { Document } from "deno_dom/deno-dom-wasm-noinit.ts";` | `import { Document } from "../../../../core/deno-dom.ts";` |
| `src/project/types/website/listing/website-listing-shared.ts:9-14` | `import {\n  DOMParser,\n  Element,\n  Node,\n  NodeType,\n} from "deno_dom/deno-dom-wasm-noinit.ts";` | `import {\n  DOMParser,\n  Element,\n  Node,\n  NodeType,\n} from "../../../../core/deno-dom.ts";` |
| `src/project/types/website/listing/website-listing-template.ts:8` | `import { Document, Element } from "deno_dom/deno-dom-wasm-noinit.ts";` | `import { Document, Element } from "../../../../core/deno-dom.ts";` |
| `src/project/types/website/listing/website-listing.ts:15` | `import { Document, Element } from "deno_dom/deno-dom-wasm-noinit.ts";` | `import { Document, Element } from "../../../../core/deno-dom.ts";` |
| `src/project/types/website/util/discover-meta.ts:7` | `import { Document, Element } from "deno_dom/deno-dom-wasm-noinit.ts";` | `import { Document, Element } from "../../../../core/deno-dom.ts";` |

If a file already has an import from `core/deno-dom.ts`, merge the names into that import instead of adding a second one (`deno lint` flags duplicate imports).

- [ ] **Step 2: Confirm the seam is the only importer, then type-check the CLI**

Run: `grep -rn 'from "deno_dom/\|import("deno_dom/' src tests package/src --include=*.ts; package/dist/bin/tools/x86_64/deno check --import-map src/import_map.json src/quarto.ts`
Expected: exactly `src/core/deno-dom.ts` lines; `deno check` exits 0.

- [ ] **Step 3: Lint the touched files**

Run: `package/dist/bin/tools/x86_64/deno lint src/core/deno-dom.ts src/core/pandoc/self-contained.ts src/project/types/website/about/website-about.ts src/project/types/website/listing/ src/project/types/website/util/discover-meta.ts`
Expected: `Checked N files`, no diagnostics.

- [ ] **Step 4: Run the listing/about/self-contained tests (the eight files' callers)**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/site/render-listings.test.ts smoke/site/render-blog.test.ts smoke/site/render-listing-feed-image.test.ts smoke/site/render-listing-contents-file.test.ts smoke/site/render-website-image-base.test.ts smoke/self-contained/stdout.test.ts smoke/render/render-html.test.ts`
Expected: all passed.

- [ ] **Step 5: Commit**

```bash
git add src/core/pandoc/self-contained.ts src/project/types/website/about/website-about.ts src/project/types/website/listing/ src/project/types/website/util/discover-meta.ts
git commit -m "Import DOM types through core/deno-dom.ts everywhere"
```

### Task 5: Windows `.cmd` launcher plugin path

**Files:**
- Modify: `package/scripts/windows/quarto.cmd:118`

- [ ] **Step 1: See it fail (Windows)**

Run (PowerShell, dev build): `$env:QUARTO_LOG_LEVEL="debug"; package\dist\bin\quarto.cmd render tests\docs\minimal.qmd --to html 2>&1 | Select-String deno-dom-native`
Expected: `Error loading deno-dom-native: Could not open library: ...\tools\deno_dom\plugin.dll ...` (the file is at `tools\x86_64\deno_dom\plugin.dll`).

- [ ] **Step 2: Fix the path**

In `package/scripts/windows/quarto.cmd` replace line 118
```bat
set "DENO_DOM_PLUGIN=!QUARTO_BIN_PATH!\tools\deno_dom\plugin.dll"
```
with
```bat
REM packaging installs the plugin under tools\<arch>\deno_dom (package/src/common/dependencies/deno_dom.ts); Windows ships x86_64 only
set "DENO_DOM_PLUGIN=!QUARTO_BIN_PATH!\tools\x86_64\deno_dom\plugin.dll"
```

- [ ] **Step 3: Run it again (Windows)**

Run: the command of Step 1.
Expected: `Loaded deno-dom-native`.

- [ ] **Step 4: Commit**

```bash
git add package/scripts/windows/quarto.cmd
git commit -m "Point quarto.cmd at the packaged deno_dom plugin (tools\x86_64\deno_dom)

The .cmd launcher looked in tools\deno_dom, where packaging never puts
the plugin, so Windows dev builds and quarto.cmd always fell back to WASM."
```

### Task 6: The bundle loads the native plugin

**Files:**
- Modify: `.github/workflows/test-bundle.yml`

- [ ] **Step 1: Build and run the bundle locally (Linux or macOS)**

Run:
```bash
cd package/src && ./quarto-bld prepare-dist --set-version $(cat ../../version.txt) && cd ../..
package/dist/bin/quarto run --dev tools/check-bundle-externals.ts package/pkg-working/bin/quarto.js
mv src/quarto.ts src/quarto1.ts
DENO_DIR=$(mktemp -d) QUARTO_LOG_LEVEL=debug package/pkg-working/bin/quarto render tests/docs/callouts.qmd --to html 2>&1 | grep -i 'deno-dom-native'
mv src/quarto1.ts src/quarto.ts
```
Expected: `OK: no external module specifiers ...` (the `jsr:` native module and `@denosaurs/plug` were bundled, not left external), then `Loaded deno-dom-native` from the bundle running on an empty `DENO_DIR` with `--cached-only`. A `Specifier not found in cache` or `Dynamic require` error here is the bundling failure the review predicted: stop and report it with the log.

- [ ] **Step 2: Assert it in the gate**

In `.github/workflows/test-bundle.yml`, step "Run the bundle from an empty DENO_DIR", after the `test -f tests/docs/manuscript/base/_manuscript/index.html` line add:
```bash
          # the release bundle must load the native deno_dom plugin (PR 05; removed by PR 20)
          if ! grep -q 'Loaded deno-dom-native' "$LOGS/html.log"; then
            grep -i 'deno-dom-native' "$LOGS/html.log" || true
            echo "::error::the bundled render did not load the native deno_dom plugin"
            exit 1
          fi
```

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/test-bundle.yml
git commit -m "Bundle gate: the release bundle loads the native deno_dom plugin"
```

### Task 7: `parseHtml` baseline on the native plugin

**Files:**
- Create: `tools/parsehtml-timing.sh`
- Create: `.github/workflows/parsehtml-timing.yml`

- [ ] **Step 1: Write the timing script**

Create `tools/parsehtml-timing.sh` (mode 755):

```bash
#!/usr/bin/env bash
#
# parsehtml-timing.sh
#
# Time parseHtml (src/core/deno-dom.ts) over the largest website and book in
# tests/docs. Baseline for dev-docs/runtime-migration PR 05 (native plugin)
# and gate input for PR 20 (WASM, at most 2x the native total).
#
# Usage: tools/parsehtml-timing.sh <quarto-command> <label> [runs]
# Output: one tab-separated line per render:
#   label  target  run  parseHtml-count  parseHtml-total-ms  parseHtml-max-ms
#
# Copyright (C) 2026 Posit Software, PBC

set -euo pipefail
QUARTO="$1"
LABEL="$2"
RUNS="${3:-3}"
OUT="${PARSEHTML_TIMING_OUT:-parsehtml-timing}"
mkdir -p "$OUT"

time_render() {
  local name="$1"; shift
  for i in $(seq 1 "$RUNS"); do
    local file="$OUT/$LABEL-$name-$i.json"
    QUARTO_REPORT_PERFORMANCE_METRICS=functionTimes \
      QUARTO_REPORT_PERFORMANCE_METRICS_FILE="$file" \
      "$QUARTO" render "$@" --quiet
    jq -r --arg l "$LABEL" --arg n "$name" --arg i "$i" \
      '[$l, $n, $i, .functionTimes.parseHtml.count, (.functionTimes.parseHtml.total | floor), (.functionTimes.parseHtml.max | floor)] | @tsv' \
      "$file"
  done
}

time_render website tests/docs/smoke-all/typst/margin-layout --to html
time_render book tests/docs/books/visualization-curriculum --to html
```

- [ ] **Step 2: Run it locally on the native plugin and on WASM**

Run:
```bash
tools/parsehtml-timing.sh package/dist/bin/quarto native 3 | tee /tmp/rt05-native.tsv
QUARTO_DENO_DOM=/nonexistent tools/parsehtml-timing.sh package/dist/bin/quarto wasm 3 | tee /tmp/rt05-wasm.tsv
git status --short tests/docs
```
Expected: six lines per label, each with a `parseHtml-count` above `0` (above `80` for the website) and a total in milliseconds. The renders leave `_site/`, `docs/` and `.quarto/` in the two targets; remove them with `git clean -fdx tests/docs/smoke-all/typst/margin-layout tests/docs/books/visualization-curriculum` after checking `git clean -ndx` lists only render outputs. (If the book render asks for Python, run `tests/configure-test-env.sh` once: `.ipynb` inputs are not executed, but a missing Jupyter kernelspec can still be reported.)

- [ ] **Step 3: The same on three OSes in CI**

Create `.github/workflows/parsehtml-timing.yml`:

```yaml
# parseHtml timing on the largest website and book in tests/docs, per OS.
# PR 05 records the native-plugin baseline; PR 20 gates the WASM-only parser
# at <= 2x that baseline. Manual only.
# See dev-docs/runtime-migration/05-deps-deno-dom-jsr.md.
name: parseHtml timing
on:
  workflow_dispatch:
    inputs:
      runs:
        description: "Renders per target"
        required: false
        default: "3"

permissions:
  contents: read

jobs:
  timing:
    name: parseHtml timing (${{ matrix.os }})
    strategy:
      fail-fast: false
      matrix:
        os: [ubuntu-latest, macos-latest, windows-latest]
    runs-on: ${{ matrix.os }}
    steps:
      - name: Checkout Repo
        uses: actions/checkout@v6

      - name: Set Path
        shell: bash
        run: |
          echo "$HOME/bin" >> $GITHUB_PATH

      - uses: ./.github/workflows/actions/quarto-dev

      - name: Make quarto available in bash (Windows)
        if: runner.os == 'Windows'
        shell: bash
        run: |
          quarto_cmd=$(command -v quarto.cmd)
          dir=$(dirname "$quarto_cmd")
          printf '#!/bin/bash\nexec "%s" "$@"\n' "$quarto_cmd" > "$dir/quarto"
          chmod +x "$dir/quarto"

      - name: Native plugin is loaded
        shell: bash
        run: |
          QUARTO_LOG_LEVEL=debug quarto render tests/docs/minimal.qmd --to html 2>&1 | grep 'Loaded deno-dom-native'

      - name: Time parseHtml (native plugin)
        shell: bash
        env:
          PARSEHTML_TIMING_OUT: ${{ runner.temp }}/parsehtml-timing
        run: |
          tools/parsehtml-timing.sh quarto native "${{ inputs.runs }}" | tee "$PARSEHTML_TIMING_OUT-native.tsv"

      - name: Time parseHtml (WASM, for information)
        shell: bash
        env:
          PARSEHTML_TIMING_OUT: ${{ runner.temp }}/parsehtml-timing
          QUARTO_DENO_DOM: /nonexistent
        run: |
          tools/parsehtml-timing.sh quarto wasm "${{ inputs.runs }}" | tee "$PARSEHTML_TIMING_OUT-wasm.tsv"

      - name: Upload timings
        if: always()
        uses: actions/upload-artifact@v7
        with:
          name: parsehtml-timing-${{ matrix.os }}
          path: ${{ runner.temp }}/parsehtml-timing*
```

- [ ] **Step 4: Commit, push, dispatch, record**

```bash
git add tools/parsehtml-timing.sh .github/workflows/parsehtml-timing.yml
git commit -m "Add parseHtml timing script and workflow (native baseline for the WASM gate)"
git push
gh workflow run parsehtml-timing.yml --ref rt/05-deps-deno-dom-jsr -f runs=3
```
Expected: three green jobs. Put a table in the PR description: one row per OS (`ubuntu-latest` x86_64, `macos-latest` arm64, `windows-latest` x86_64) and target, with the median `parseHtml-total-ms` of the three native runs, the median of the three WASM runs and their ratio, plus the `parseHtml-count`. These native medians are the baseline PR 20's gate compares against; link the workflow run.

### Task 8: Ratchet and status

**Files:**
- Modify: `tools/runtime-boundary-baseline.json`, `dev-docs/runtime-migration/README.md`

- [ ] **Step 1: Update the baseline**

Run: `package/dist/bin/quarto run --dev tools/check-runtime-boundary.ts --update-baseline --accept-increase && git diff tools/runtime-boundary-baseline.json`
Expected: `src.denoCalls` falls by 1 (`Deno.dlopen` moved into the package; `Deno.env.get` and `Deno.writeTextFile` remain), `tests.denoCalls` rises by 1 (`Deno.readTextFileSync` in the new test; one `::warning::` line), nothing else changes. List the test file and its count in the PR description.

- [ ] **Step 2: Set the PR 05 row to `in progress` and commit**

```bash
git add tools/runtime-boundary-baseline.json dev-docs/runtime-migration/README.md
git commit -m "runtime-migration: PR 05 in progress; lower src boundary count"
```

## Verification

Local, before opening the PR (the DOM code is exercised by every HTML render):

```bash
rm -rf package/dist/bin/deno_cache && ./configure.sh                         # frozen deno.lock
git status --short                                                            # empty
package/dist/bin/quarto check                                                 # all sections OK
cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent \
  unit/core/deno-dom.test.ts \
  smoke/render/render-html.test.ts smoke/render/render-reveal.test.ts smoke/render/render-callout.test.ts \
  smoke/render/render-code-tools.test.ts smoke/render/render-page-layout.test.ts \
  $(find smoke/site -name '*.test.ts') $(find smoke/website -name '*.test.ts') $(find smoke/book -name '*.test.ts') $(find smoke/crossref -name '*.test.ts') $(find smoke/self-contained -name '*.test.ts') $(find smoke/search -name '*.test.ts') $(find smoke/axe -name '*.test.ts')
cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent 'docs/smoke-all/dashboard/**/*.qmd'   # the <template> in dashboard cards (quoted: smoke-all expands the glob)
cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent 'docs/smoke-all/2024/**/*.qmd'        # one year of the corpus; CI runs it all
QUARTO_LOG_LEVEL=debug package/dist/bin/quarto render tests/docs/callouts.qmd --to html 2>&1 | grep 'Loaded deno-dom-native'
QUARTO_DENO_DOM=/nonexistent QUARTO_LOG_LEVEL=debug package/dist/bin/quarto render tests/docs/callouts.qmd --to html 2>&1 | grep 'Error loading deno-dom-native'
package/dist/bin/quarto run --dev tools/check-runtime-boundary.ts            # OK against Task 8's baseline
```

On the PR: `Smoke Tests` on Linux and Windows, `Parallel Smokes Tests`, `Bundle Test` on three OSes (with the native-plugin assertion), the `parseHtml timing` dispatch run linked in the description.

## Review checklist

- [ ] `src/core/deno-dom.ts` is the only file matching `deno_dom/`; the static import is `deno_dom/wasm-noinit`, the dynamic one `deno_dom/native`.
- [ ] `initDenoDom` keeps the two debug messages (`Loaded deno-dom-native`, `Error loading deno-dom-native: ...`) that the gate and the Verification greps rely on.
- [ ] The native branch is only attempted when `DENO_DOM_PLUGIN` is non-empty (so the package never tries to download a plugin).
- [ ] `deno.lock` contains `@b-fuze/deno-dom@0.1.56` and `@denosaurs/plug@1.1.0` (the dynamic import is cached for `--cached-only`).
- [ ] `quarto.cmd` points at `tools\x86_64\deno_dom\plugin.dll`; the Rust launcher is untouched.
- [ ] `export *` re-exports from `deno_dom/wasm-noinit`; no caller imports `initParser`.
- [ ] The eight importer edits only change the module path (and merge duplicate imports); no DOM call site changed.
- [ ] The PR description has the release-notes summary (Task 1) and the per-OS `parseHtml` table (Task 7).
- [ ] `configuration`'s `DENO_DOM=v0.1.41-alpha-artifacts` is untouched: it names the native plugin release, which `deno-dom-native.ts` in 0.1.56 still targets.
- [ ] The JSR version is pinned exactly (`@0.1.56`), not a range.

## Risks and rollback

- Behaviour differences between deno_dom 0.1.41 and 0.1.56 (selector engine, serialisation, `<template>`) could change HTML output. Task 1 lists them; the smoke suites compare rendered output extensively (`ensureHtmlElements`, `ensureHtmlSelectorSatisfies`, snapshots). Mitigation if something regresses: pin an intermediate version (0.1.48 is the oldest on JSR) and bisect.
- The native module in the bundle: esbuild handles a dynamically imported module with a top-level `await` either by inlining it behind a lazy initializer or by emitting a chunk. Task 6 and the gate run it from an empty `DENO_DIR`; if the bundle cannot load it, renders still work on WASM (slower on large documents) and the gate fails loudly instead of the regression shipping silently.
- `jsr:@denosaurs/plug` enters the release bundle (a few KB never executed, because `DENO_DOM_PLUGIN` is always set). PR 20 removes the native path and this dependency.
- Windows dev builds and `quarto.cmd` users switch from WASM (the silent fallback) to the native plugin with Task 5. That is the intended configuration; if a Windows-specific native problem appears, `QUARTO_DENO_DOM=` pointing at a non-existent path restores WASM per process.
- The timing numbers vary between CI runners; the medians of three runs per OS are the baseline, and PR 20 compares like with like (same workflow, same runner labels).
- Rollback: revert the commits; the `deno.land/x` entry and the inline FFI code return.

## Decisions needed

None open. Review items closed here: the native path is exercised in the bundle and in dev mode with `--cached-only` (Tasks 3 and 6, gate assertion); the 0.1.41 → 0.1.56 differences are read and `<template>` is pinned (Tasks 1 and 2); the `quarto.cmd:118` path is fixed (Task 5; it was pre-existing); the `parseHtml` baseline on the native plugin is recorded per OS (Task 7, decision 6); the re-vendor step follows the map edit (Task 3).
