# PR 05: deno_dom from `deno.land/x` to `jsr:@b-fuze/deno-dom`

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve `deno_dom/` from JSR (`@b-fuze/deno-dom@0.1.56`), keep the native FFI plugin path working, and make `src/core/deno-dom.ts` the only file that imports the package.
**Phase:** 0. **Depends on:** none. **Unblocks:** PR 20 (drops the FFI path from this one file), PR 26.
**Branch:** `rt/05-deps-deno-dom-jsr`.
**Suggested executor:** Opus. The import rewrite is mechanical, but the native-plugin initialisation changes shape (JSR does not export the `register` function Quarto's copy of `deno-dom-native.ts` relies on) and the HTML post-processing code is the most DOM-heavy part of Quarto, so test failures need judgement.
**Size:** M (import map, `src/core/deno-dom.ts`, 8 importer files, 1 new unit test).
**Ships on:** Deno; the existing test suite must stay green.

## Spec

### Context

`00-assessment.md` sections 3.3 (`Deno.dlopen` row), 3.4 (deno_dom row) and 11 ("`ffi` remove" row). deno_dom is the DOM implementation behind every HTML post-processor (`parseHtml` is called from 6 files, the `Document`/`Element` types from about 60). The package moved to JSR; `deno.land/x` is frozen at 0.1.41 and the Node bundle (PR 26) resolves JSR packages natively. Keeping the same DOM implementation means none of the ~1,900 DOM call sites change.

Facts verified in this sandbox (Deno 2.7.14, `curl https://jsr.io/@b-fuze/deno-dom/meta.json` and `0.1.56_meta.json`, and a run through an import map):

- Latest JSR version: **0.1.56** (versions 0.1.48 … 0.1.56 exist; 0.1.41 is not on JSR). There is no changelog file in the package; the GitHub releases page could not be fetched from this sandbox, so the behaviour differences between 0.1.41 and 0.1.56 are not enumerated here. The test suite is the gate (see Verification).
- JSR exports (the only subpaths that can be imported): `.` (`deno-dom-wasm.ts`, auto-initialising), `./wasm` (same), `./wasm-legacy`, `./wasm-noinit` (`deno-dom-wasm-noinit.ts`: `initParser()` plus `export * from "./src/api.ts"`), `./native` (`deno-dom-native.ts`). **`src/parser.ts`, `src/dom/dom-parser.ts`, `src/api.ts` and `src/dom/node.ts` are not exported**, so the four imports in `src/core/deno-dom.ts:9-11,187-189` cannot be kept as they are.
- `./wasm-noinit` exports everything `src/core/deno-dom.ts` currently re-exports from `src/api.ts` (`Document`, `HTMLDocument`, `Element`, `Node`, `NodeType`, `NodeList`, `HTMLCollection`, `Comment`, `Text`, `Attr`, `CharacterData`, `DocumentFragment`, `DOMParser`, `nodesFromString`, …) plus `initParser`. Verified: `import { DOMParser, Element, HTMLDocument, initParser, Node, NodeType, Document, NodeList, Comment, Text } from "deno_dom/wasm-noinit"` type-checks and runs through the map entry `"deno_dom/": "jsr:/@b-fuze/deno-dom@0.1.56/"`.
- `./native` is the upstream version of the code Quarto copied into `src/core/deno-dom.ts:56-176`: at module evaluation it reads `DENO_DOM_PLUGIN`, calls `Deno.dlopen(path, symbols)` with the same five symbols, and calls `register(parse, parseFrag)`. If the env var is **unset** it downloads a plugin from GitHub (`v0.1.41-alpha-artifacts`, the same release Quarto ships from `package/src/common/dependencies/deno_dom.ts`) through `jsr:@denosaurs/plug@1.1.0`; Quarto never takes that branch because both launchers always set `DENO_DOM_PLUGIN` (`package/scripts/common/quarto:167-173`, `package/scripts/windows/quarto.cmd:118-121`). If `dlopen` fails (missing file, wrong architecture), module evaluation throws, so a dynamic `import("deno_dom/native")` rejects and the caller can fall back to WASM. Verified: with `DENO_DOM_PLUGIN=/nonexistent/libplugin.so` the dynamic import rejects with `Could not open library ...` and `initParser()` then parses normally.
- No Quarto code constructs DOM nodes directly (`grep -rn 'new Node(\|new Element(\|new HTMLDocument('` is empty), so the non-constructible `Node`/`Element`/`HTMLDocument` exports of `api.ts` are sufficient; `Node.ELEMENT_NODE`-style statics and the `NodeType` enum are exported.

Importers today: `src/core/deno-dom.ts` (the seam) and eight files that bypass it with `from "deno_dom/deno-dom-wasm-noinit.ts"`; 56 files import from `core/deno-dom.ts`. After this PR the eight go through the seam too, so PR 20 and PR 26 only ever touch one file.

### Scope

In:
- import map entry; `src/core/deno-dom.ts` rewritten on the JSR exports with the native path delegated to `deno_dom/native`;
- the eight direct importers routed through `src/core/deno-dom.ts`;
- a unit test for the seam.

Out:
- removing the native plugin (PR 20: `Deno.dlopen`, `package/src/common/dependencies/deno_dom.ts`, launcher env, `configuration`'s `DENO_DOM`);
- changing any DOM call site;
- `tests/verify.ts:8` keeps importing `DOMParser, Element, NodeList` from `../src/core/deno-dom.ts` (unchanged).

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

### Files

- Modify: `src/import_map.json:36` (`deno_dom/`)
- Modify: `src/core/deno-dom.ts` (whole file)
- Modify: `src/core/pandoc/self-contained.ts:11`
- Modify: `src/project/types/website/about/website-about.ts:6`
- Modify: `src/project/types/website/listing/website-listing-categories.ts:6`
- Modify: `src/project/types/website/listing/website-listing-feed.ts:9`
- Modify: `src/project/types/website/listing/website-listing-shared.ts:9-14`
- Modify: `src/project/types/website/listing/website-listing-template.ts:8`
- Modify: `src/project/types/website/listing/website-listing.ts:15`
- Modify: `src/project/types/website/util/discover-meta.ts:7`
- Test: `tests/unit/core/deno-dom.test.ts` (new)
- Modify: `dev-docs/runtime-migration/README.md` (PR 05 row status)

### Acceptance criteria

- `grep -rn 'from "deno_dom/' src tests package/src --include=*.ts` lists only `src/core/deno-dom.ts` (two lines: `deno_dom/wasm-noinit` static, `deno_dom/native` dynamic).
- `grep -n deno_dom src/import_map.json` prints `"deno_dom/": "jsr:/@b-fuze/deno-dom@0.1.56/",`.
- `QUARTO_LOG_LEVEL=debug package/dist/bin/quarto render tests/docs/minimal.qmd --to html 2>&1 | grep deno-dom-native` prints `Loaded deno-dom-native` on a platform with the plugin (Linux x86_64, macOS, Windows x86_64).
- `QUARTO_DENO_DOM=/nonexistent/libplugin.so QUARTO_LOG_LEVEL=debug package/dist/bin/quarto render tests/docs/minimal.qmd --to html 2>&1 | grep deno-dom-native` prints `Error loading deno-dom-native: Could not open library: ...` and the render still succeeds (WASM fallback).
- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/core/deno-dom.test.ts` passes, and the HTML smoke tests in Verification pass.
- `Bundle Test` is green (the JSR package, including `jsr:@denosaurs/plug` pulled in by `./native`, bundles with `@luca/esbuild-deno-loader`).

## Plan

### Task 1: Unit test for the seam

**Files:**
- Test: `tests/unit/core/deno-dom.test.ts`

- [ ] **Step 1: Write the test**

Create `tests/unit/core/deno-dom.test.ts` (it passes against the current code and must keep passing after the rewrite; it is the contract of the seam):

```ts
/*
 * deno-dom.test.ts
 *
 * Contract of src/core/deno-dom.ts, the single entry point for deno_dom:
 * initialisation is idempotent, parseHtml returns a queryable document, the
 * re-exported DOM types/values are the ones callers use, and
 * writeDomToHtmlFile round-trips.
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { unitTest } from "../../test.ts";
import { assert, assertEquals } from "testing/asserts";
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

- [ ] **Step 2: Run it against the current code**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/core/deno-dom.test.ts`
Expected: `3 passed`. The assertions were verified against deno-dom 0.1.56 while writing this plan, not against the 0.1.41 port still mapped at this point; if one fails here, record it in the PR as a 0.1.41 → 0.1.56 behaviour difference and keep the 0.1.56 expectation. (The test runner does not set `DENO_DOM_PLUGIN`, so this exercises the WASM path.)

- [ ] **Step 3: Commit**

```bash
git add tests/unit/core/deno-dom.test.ts
git commit -m "Add contract test for the deno-dom seam"
```

### Task 2: Import map and `src/core/deno-dom.ts` on the JSR exports

**Files:**
- Modify: `src/import_map.json:36`
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
// Quarto's launchers always set DENO_DOM_PLUGIN (package/scripts/common/quarto,
// package/scripts/windows/quarto.cmd), so the module's own "download the
// plugin from GitHub" branch for an unset variable is never reached.
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

- [ ] **Step 4: Type-check the seam and run the unit test**

Run: `package/dist/bin/tools/x86_64/deno check --import-map src/import_map.json src/core/deno-dom.ts && cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/core/deno-dom.test.ts`
Expected: `Check ...deno-dom.ts`; `3 passed`.

- [ ] **Step 5: Prove both initialisation paths through the launcher**

Run: `QUARTO_LOG_LEVEL=debug package/dist/bin/quarto render tests/docs/minimal.qmd --to html --output-dir /tmp/rt05 2>&1 | grep -i 'deno-dom-native'`
Expected: `Loaded deno-dom-native` (the launcher exported `DENO_DOM_PLUGIN=package/dist/bin/tools/<arch>/deno_dom/libplugin.so|.dylib|plugin.dll`). On Apple Silicon the plugin comes from `quarto-dev/deno-dom-apple-silicon` per `package/src/common/dependencies/deno_dom.ts:37-53` and the message is the same.

Run: `QUARTO_DENO_DOM=/nonexistent/libplugin.so QUARTO_LOG_LEVEL=debug package/dist/bin/quarto render tests/docs/minimal.qmd --to html --output-dir /tmp/rt05 2>&1 | grep -i 'deno-dom-native'; ls /tmp/rt05/minimal.html`
Expected: `Error loading deno-dom-native: Could not open library: ...` and the output file exists (WASM fallback). `QUARTO_DENO_DOM` overrides the plugin path in both launchers. Remove `/tmp/rt05`.

- [ ] **Step 6: Commit**

```bash
git add src/import_map.json src/core/deno-dom.ts
git commit -m "Resolve deno_dom from jsr:@b-fuze/deno-dom

JSR exposes only the wasm/wasm-noinit/native entry points, so the native
plugin is loaded by importing deno_dom/native (which reads DENO_DOM_PLUGIN
and registers the parser) instead of a copy of that code; a failed import
falls back to the WASM parser as before."
```

### Task 3: Route the eight direct importers through the seam

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
Expected: exactly `src/core/deno-dom.ts` lines (the `deno_dom/wasm-noinit` imports and the `import("deno_dom/native")`); `deno check` exits 0.

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

### Task 4: Status row

- [ ] **Step 1: Set the PR 05 row in `dev-docs/runtime-migration/README.md` to `in progress` and commit**

```bash
git add dev-docs/runtime-migration/README.md
git commit -m "runtime-migration: PR 05 in progress"
```

## Verification

Local, before opening the PR (the DOM code is exercised by every HTML render, so run the HTML-heavy suites and a slice of `smoke-all`):

```bash
rm -rf package/dist/bin/deno_cache && ./configure.sh
package/dist/bin/quarto check                                                  # all sections OK
cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent \
  unit/core/deno-dom.test.ts \
  smoke/render/render-html.test.ts smoke/render/render-reveal.test.ts smoke/render/render-callout.test.ts \
  smoke/render/render-code-tools.test.ts smoke/render/render-page-layout.test.ts \
  smoke/site/ smoke/website/ smoke/book/ smoke/crossref/ smoke/self-contained/ smoke/search/ smoke/axe/
cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent docs/smoke-all/2024/**/*.qmd   # one year of the corpus; CI runs it all
QUARTO_LOG_LEVEL=debug package/dist/bin/quarto render tests/docs/callouts.qmd --to html 2>&1 | grep 'Loaded deno-dom-native'
QUARTO_DENO_DOM=/nonexistent QUARTO_LOG_LEVEL=debug package/dist/bin/quarto render tests/docs/callouts.qmd --to html 2>&1 | grep 'Error loading deno-dom-native'
quarto run --dev tools/check-runtime-boundary.ts                               # after PR 02: unchanged (deno-dom.ts had Deno.env/Deno.dlopen/Deno.writeTextFile before; now Deno.env and Deno.writeTextFile)
```

On the PR: `Smoke Tests` on Linux and Windows (both platforms ship the native plugin; the macOS runner of `Test Tool Install` covers the arm64 plugin), `Bundle Test`.

After PR 02, run `quarto run --dev tools/check-runtime-boundary.ts --update-baseline`: `src.denoCalls` drops by one (the `Deno.dlopen` call moved into the package).

## Review checklist

- [ ] `src/core/deno-dom.ts` is the only file matching `deno_dom/`; the static import is `deno_dom/wasm-noinit`, the dynamic one `deno_dom/native`.
- [ ] `initDenoDom` keeps the two debug messages (`Loaded deno-dom-native`, `Error loading deno-dom-native: ...`) that `quarto check`-style diagnostics and the Verification greps rely on.
- [ ] The native branch is only attempted when `DENO_DOM_PLUGIN` is non-empty (so the package never tries to download a plugin).
- [ ] `export *` re-exports from `deno_dom/wasm-noinit`; no caller imports `initParser`.
- [ ] The eight importer edits only change the module path (and merge duplicate imports); no DOM call site changed.
- [ ] `configuration`'s `DENO_DOM=v0.1.41-alpha-artifacts` is untouched: it names the native plugin release, which `deno-dom-native.ts` in 0.1.56 still targets.
- [ ] The JSR version is pinned exactly (`@0.1.56`), not a range.

## Risks and rollback

- Behaviour differences between deno_dom 0.1.41 and 0.1.56 (selector engine, serialisation) could change HTML output. The smoke suites compare rendered output extensively (`ensureHtmlElements`, `ensureHtmlSelectorSatisfies`, snapshots); a diff shows up there. Mitigation if something regresses: pin an intermediate version (0.1.48 is the oldest on JSR) and bisect.
- The native plugin now loads through `jsr:@denosaurs/plug`'s module graph; the plugin binary and symbols are unchanged, and the `dlopen` call is Deno's own, so the loaded code path is identical. If `import("deno_dom/native")` fails for a reason other than a missing library, the WASM fallback keeps renders working (slower on large documents) and the debug log shows why.
- `jsr:@denosaurs/plug` enters the release bundle (a few KB of code that is never executed in Quarto). PR 20 removes the native path and with it this dependency.
- Rollback: revert the three commits; the `deno.land/x` entry and the inline FFI code return.
