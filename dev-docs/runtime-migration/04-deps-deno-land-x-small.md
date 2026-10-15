# PR 04: Replace the small `deno.land/x` dependencies

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the `semver/`, `media_types/`, `xmlp/`, `xml/`, `another_cookiejar/`, `cache/` and `events/` entries from `src/import_map.json`, replacing each with an npm/JSR package or a Node built-in that works on Deno today and on Node later.
**Phase:** 0. **Depends on:** none. **Unblocks:** PR 22 (std import seams; semver is done here), PR 26.
**Branch:** `rt/04-deps-deno-land-x-small`.
**Suggested executor:** Opus. Each replacement is small, but four of them change library APIs (XML building/parsing, cookies, mime lookup) and need judgement at the call site when a test disagrees with the plan.
**Size:** M (import map, 1 new `deno_ral` module, 18 semver importers, 4 other source files, 3 JS files, 4 new tests).
**Ships on:** Deno; the existing test suite must stay green.

## Spec

### Context

`00-assessment.md` section 3.4 (row "xmlp, xml, another_cookiejar, media_types, cache, events") and section 10 (the spike had to re-source every `deno.land/x` package from GitHub tags). These seven entries are the small ones; deno_dom, cliffy and puppeteer have their own PRs (05, 06, 07). Each task below is independent and lands as its own commit so a reviewer can bisect.

What each entry is used for (verified with grep on `main` at `a4d0979`):

| Entry | Pinned | Importers | Names used | Replacement |
|---|---|---|---|---|
| `semver/` | `deno.land/x/semver@v1.4.0` (a TypeScript port of node-semver 7 by justjavac; same function names and signatures, `export default SemVer`) | 18 files (list in Task 1) | `satisfies(version, range)` ×9, `coerce(v)` ×3, `valid(v)` ×1, `new SemVer(s)` ×5 and the `SemVer` type ×4, `new Range(s)` ×1 and the `Range` type ×1 | `npm:semver@7.8.5` behind a new `src/deno_ral/semver.ts` wrapper with `// @ts-types="@types/semver"` (`npm:@types/semver@7.8.0`) so the 18 files stay type-checked. Verified in this sandbox: without the directive Deno types the package as `any`; with it, `satisfies(1, 2)` is a TS2345 error and `coerce`/`valid`/`satisfies` have the same parameter and return types as the Deno port (`coerce(...): SemVer | null`, `valid(...): string | null`). `jsr:@std/semver` (1.0.8) was rejected: its API is functional over parsed objects (`parse`, `parseRange`, `satisfies(SemVer, Range)`, `format`) and would require rewriting every call site. |
| `media_types/` | `deno.land/x/media_types@v2.10.1` | `src/execute/ojs/extract-resources.ts:15,778` | `lookup(path)` | `jsr:@std/media-types@1.1.0` `typeByExtension(ext)`; verified: `typeByExtension(".png") === "image/png"`, `typeByExtension("nope") === undefined`. `contentType()` was rejected because it appends `; charset=UTF-8` to text types, which would change the data URL produced by `asDataURL`. |
| `xmlp/` | `deno.land/x/xmlp@v0.2.8` (SAX parser) | `src/project/types/website/website-sitemap.ts:10,121,181-200` | `SAXParser`, `ElementInfo` to read `<loc>`/`<lastmod>` of every `<url>` from an existing `sitemap.xml` during incremental renders | `npm:fast-xml-parser@5.11.2` `XMLParser` (`{ parseTagValue: false }` so dates and URLs stay strings; verified: one `<url>` parses to an object, several to an array, an empty `<urlset>` to `""`, entities are decoded). |
| `xml/` | `deno.land/x/xml@2.1.1` (lowlighter) | `src/project/types/manuscript/meca.ts:6,50` | `stringify(json)` with `@attr` / `#text` conventions to write the MECA `manifest.xml` | `npm:fast-xml-parser@5.11.2` `XMLBuilder` with `attributeNamePrefix: "@"`, `textNodeName: "#text"`; the `<?xml ...?>` and `<!DOCTYPE ...>` lines are written by hand (XMLBuilder has no doctype support). Verified: undefined attributes and undefined child elements are omitted, `&`, `<`, `"` are escaped, `suppressEmptyNode: true` self-closes `<instance .../>`. One dependency replaces both XML packages. |
| `another_cookiejar/` | `deno.land/x/another_cookiejar@v5.0.3` | `src/publish/rsconnect/api/index.ts:8-9` | `wrapFetch()` returns a `fetch` that keeps a cookie jar across calls | Plain global `fetch`. Every Connect request carries `Authorization: Key <api-key>` (`authorizationHeader`, line 89) and the class's own `cookies_` map (line 85) is never read, so no request depends on a cookie set by a previous one. See Decisions for the fallback. |
| `cache/` | `deno.land/x/cache@0.2.12` | none (`grep -rn '"cache/' src package/src tests tools` is empty) | — | delete the entry |
| `events/` | `deno.land/x/events@v1.0.0` (a copy of Node's `EventEmitter`) | `src/core/cri/deno-cri/chrome.js:9,53`, `index.js:9,35`, `websocket-wrapper.js:9,13` (default import; `class ... extends EventEmitter` and `new EventEmitter()`) | `node:events` default export (verified on Deno 2.7.14: `import EventEmitter from "node:events"` is the class, `class C extends EventEmitter` works, `EventEmitter === EE2` for the named import). `node:` built-ins are runtime-neutral by construction. |

`src/import_map.json` also carries redirect entries for old `deno.land/std` URLs that these packages import internally (`https://deno.land/std@0.105.0/` is `media_types`' path import; the three `std@0.91.0` entries are most likely `cache`'s; `std@0.196.0/console/unicode_width.ts` is cliffy rc.3's and `std@0.93.0/*` are puppeteer's). Task 7 removes only the entries that `deno info` proves unused after this PR; PRs 06 and 07 repeat the same step for theirs.

### Scope

In: the seven entries above, their importers, one new `deno_ral` module, unit tests for the semver wrapper, the sitemap parser and the MECA writer, and the std-redirect cleanup for entries made unused by this PR.

Out: `deno_dom/`, `cliffy/`, `puppeteer` (PRs 05-07); routing `fmt/colors`, `encoding/*`, `io/*`, `flags`, `log` through `deno_ral` (PR 22, which no longer needs to handle `semver`); fixing the pre-existing bug in `meca.ts:82-86` where several `metadata` keys overwrite each other (behaviour preserved, see Task 4).

### Interfaces

New module `src/deno_ral/semver.ts`:

```ts
/*
 * semver.ts
 *
 * Runtime-neutral semver. Application code imports this module, never the
 * package directly, so the dependency can be swapped in one place.
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

// @ts-types="@types/semver"
export { coerce, Range, satisfies, SemVer, valid } from "semver";
```

Re-exported signatures (from `@types/semver@7.8.0`, identical in shape to the `deno.land/x/semver@v1.4.0` port that callers were written against):

```ts
export function satisfies(version: string | SemVer, range: string | Range, optionsOrLoose?: boolean | RangeOptions): boolean;
export function coerce(version: string | number | SemVer | null | undefined, options?: CoerceOptions): SemVer | null;
export function valid(version: string | SemVer | null | undefined, optionsOrLoose?: boolean | Options): string | null;
export class SemVer { constructor(version: string | SemVer, optionsOrLoose?: boolean | Options); major: number; minor: number; patch: number; version: string; compare(other: string | SemVer): 1 | 0 | -1; toString(): string; ... }
export class Range { constructor(range: string | Range, optionsOrLoose?: boolean | RangeOptions); test(version: string | SemVer): boolean; ... }
```

`src/project/types/website/website-sitemap.ts` gains one exported pure function (the file-reading `readSitemap` calls it):

```ts
/** Parse the <loc>/<lastmod> pairs of every <url> in a sitemap.xml document. Returns [] for a sitemap with no <url>. */
export function parseSitemap(xml: string): Array<{ loc: string; lastmod: string }>;
```

`src/project/types/manuscript/meca.ts`: `toXml(manifest: MecaManifest): string` keeps its signature. Output format (fixed by the unit test in Task 4): XML declaration, MECA doctype, then the `<manifest>` tree indented by two spaces, attributes in insertion order, empty `<instance/>` self-closed, trailing newline.

`src/execute/ojs/extract-resources.ts`: no signature change; the mime lookup becomes `typeByExtension(extname(resolvedFileName).toLowerCase()) || "application/octet-stream"`.

`src/publish/rsconnect/api/index.ts`: no signature change; uses the global `fetch`.

### Files

- Create: `src/deno_ral/semver.ts`
- Modify: `src/import_map.json:33-34,37-41` (`events/`, `cache/`, `xmlp/`, `xml/`, `another_cookiejar/`, `semver/`, `media_types/` entries) plus the std redirects at `:63-72` that Task 7 proves unused
- Modify (semver importers): `src/quarto.ts:29`, `src/project/project-environment-types.ts:8`, `src/project/project-environment.ts:19`, `src/execute/jupyter/jupyter.ts:8`, `src/execute/engine.ts:43`, `src/command/render/render-files.ts:110`, `src/command/create/artifacts/artifact-shared.ts:12`, `src/command/check/check.ts:23`, `src/command/use/commands/binder/binder-types.ts:7`, `src/command/use/commands/binder/binder.ts:12`, `src/extension/extension.ts:11`, `src/extension/types.ts:7-8`, `src/core/cache/cache.ts:13`, `src/core/git.ts:9`, `src/core/jupyter/jupyter.ts:185`, `src/core/typst.ts:12`, `src/core/knitr.ts:12`
- Modify: `src/execute/ojs/extract-resources.ts:8-15,778`
- Modify: `src/project/types/website/website-sitemap.ts:10,121,181-200`
- Modify: `src/project/types/manuscript/meca.ts:6,31-50`
- Modify: `src/publish/rsconnect/api/index.ts:8-9`
- Modify: `src/core/cri/deno-cri/chrome.js:9`, `src/core/cri/deno-cri/index.js:9`, `src/core/cri/deno-cri/websocket-wrapper.js:9`
- Test: `tests/unit/deno-ral/semver.test.ts`, `tests/unit/project/website-sitemap-parse.test.ts`, `tests/unit/project/manuscript-meca-xml.test.ts`
- Modify: `tools/runtime-boundary-baseline.json` (if PR 02 has landed: `src.stdImportFiles` falls by 18)
- Modify: `dev-docs/runtime-migration/README.md` (PR 04 row status)

### Acceptance criteria

- `grep -n 'deno.land/x/\(semver\|media_types\|xmlp\|xml\|another_cookiejar\|cache\|events\)@' src/import_map.json` prints nothing.
- `grep -rn 'from "semver/\|from "media_types/\|from "xmlp/\|from "xml/\|from "another_cookiejar/\|from "events/' src package/src tests tools --include=*.ts --include=*.js` prints nothing.
- `package/dist/bin/tools/x86_64/deno check --import-map src/import_map.json src/quarto.ts` passes (the semver call sites type-check against real types).
- The three new unit tests pass; `tests/smoke/manuscript/render-manuscript.test.ts`, `tests/smoke/jats/render-manuscript.test.ts`, `tests/smoke/website/drafts.test.ts`, `tests/smoke/ojs/dependency-traversal.test.ts`, `tests/smoke/check/check.test.ts`, `tests/smoke/extensions/` pass.
- A manuscript render's `*-meca.zip` contains a `manifest.xml` that starts with the XML declaration and the MECA doctype, and `meca validate` (when installed) accepts it.
- After PR 02: `quarto run --dev tools/check-runtime-boundary.ts` passes with the lowered baseline.

## Plan

### Task 1: `semver` → `npm:semver` behind `src/deno_ral/semver.ts`

**Files:**
- Create: `src/deno_ral/semver.ts`
- Modify: `src/import_map.json:40` (`semver/`)
- Modify: the 17 importer files listed in Files (plus `src/quarto.ts`)
- Test: `tests/unit/deno-ral/semver.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/deno-ral/semver.test.ts`:

```ts
/*
 * semver.test.ts
 *
 * Compatibility contract for src/deno_ral/semver.ts: the subset of the
 * node-semver API that quarto uses (satisfies, coerce, valid, SemVer, Range).
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { unitTest } from "../../test.ts";
import { assert, assertEquals } from "testing/asserts";
import {
  coerce,
  Range,
  satisfies,
  SemVer,
  valid,
} from "../../../src/deno_ral/semver.ts";

// deno-lint-ignore require-await
unitTest("deno_ral/semver - satisfies accepts strings and objects", async () => {
  assert(satisfies("1.11.2", ">=1.4"));
  assert(!satisfies("1.3.9", ">=1.4"));
  assert(satisfies(new SemVer("2.0.0"), new Range("^2.0.0")));
  // prerelease versions do not satisfy a plain range (quarto checks this for
  // extension quarto-required constraints against 99.9.9 dev builds)
  assert(!satisfies("1.5.0-dev", ">=1.4"));
  assert(satisfies("99.9.9", ">=1.4"));
});

// deno-lint-ignore require-await
unitTest("deno_ral/semver - coerce and valid", async () => {
  assertEquals(coerce("v1.2")?.version, "1.2.0");
  assertEquals(coerce("4.3.1 (2023-06-16)")?.toString(), "4.3.1");
  assertEquals(coerce("not a version"), null);
  assertEquals(valid("1.2.3"), "1.2.3");
  assertEquals(valid("1.2"), null);
});

// deno-lint-ignore require-await
unitTest("deno_ral/semver - SemVer and Range classes", async () => {
  const v = new SemVer("4.16.1");
  assertEquals([v.major, v.minor, v.patch], [4, 16, 1]);
  assertEquals(String(v), "4.16.1");
  assertEquals(v.compare("4.16.2"), -1);
  assertEquals(v.compare(new SemVer("4.16.1")), 0);
  const r = new Range(">=1.0.0 <2.0.0");
  assert(r.test("1.9.9"));
  assert(!r.test("2.0.0"));
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/deno-ral/semver.test.ts`
Expected: FAIL, `Module not found "file:///.../src/deno_ral/semver.ts"`.

- [ ] **Step 3: Add the import-map entries and the wrapper**

In `src/import_map.json` replace
```json
    "semver/": "https://deno.land/x/semver@v1.4.0/",
```
with
```json
    "semver": "npm:semver@7.8.5",
    "@types/semver": "npm:@types/semver@7.8.0",
```

Create `src/deno_ral/semver.ts`:

```ts
/*
 * semver.ts
 *
 * Runtime-neutral semver. Application code imports this module, never the
 * package directly, so the dependency can be swapped in one place.
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

// @ts-types="@types/semver"
export { coerce, Range, satisfies, SemVer, valid } from "semver";
```

- [ ] **Step 4: Run the test**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/deno-ral/semver.test.ts`
Expected: `3 passed`.

- [ ] **Step 5: Point the 18 importers at the wrapper**

Named imports: change only the module path.

| File | Old line | New line |
|---|---|---|
| `src/quarto.ts:29` | `import { satisfies } from "semver/mod.ts";` | `import { satisfies } from "./deno_ral/semver.ts";` |
| `src/project/project-environment-types.ts:8` | `import { SemVer } from "semver/mod.ts";` | `import { SemVer } from "../deno_ral/semver.ts";` |
| `src/project/project-environment.ts:19` | `import { SemVer } from "semver/mod.ts";` | `import { SemVer } from "../deno_ral/semver.ts";` |
| `src/execute/jupyter/jupyter.ts:8` | `import { satisfies } from "semver/mod.ts";` | `import { satisfies } from "../../deno_ral/semver.ts";` |
| `src/execute/engine.ts:43` | `import { satisfies } from "semver/mod.ts";` | `import { satisfies } from "../deno_ral/semver.ts";` |
| `src/command/render/render-files.ts:110` | `import { satisfies } from "semver/mod.ts";` | `import { satisfies } from "../../deno_ral/semver.ts";` |
| `src/command/create/artifacts/artifact-shared.ts:12` | `import { coerce } from "semver/mod.ts";` | `import { coerce } from "../../../deno_ral/semver.ts";` |
| `src/command/check/check.ts:23` | `import { satisfies } from "semver/mod.ts";` | `import { satisfies } from "../../deno_ral/semver.ts";` |
| `src/extension/extension.ts:11` | `import { coerce, Range, satisfies } from "semver/mod.ts";` | `import { coerce, Range, satisfies } from "../deno_ral/semver.ts";` |
| `src/core/cache/cache.ts:13` | `import { satisfies } from "semver/mod.ts";` | `import { satisfies } from "../../deno_ral/semver.ts";` |
| `src/core/jupyter/jupyter.ts:185` | `import { valid } from "semver/mod.ts";` | `import { valid } from "../../deno_ral/semver.ts";` |
| `src/core/typst.ts:12` | `import { satisfies } from "semver/mod.ts";` | `import { satisfies } from "../deno_ral/semver.ts";` |
| `src/core/knitr.ts:12` | `import { coerce, satisfies } from "semver/mod.ts";` | `import { coerce, satisfies } from "../deno_ral/semver.ts";` |

Default imports (`export default SemVer` existed only in the Deno port; node-semver's default export is the whole module object, so `new SemVer(...)` on it would throw): switch to the named class.

| File | Old line | New line |
|---|---|---|
| `src/command/use/commands/binder/binder-types.ts:7` | `import SemVer from "semver/mod.ts";` | `import { SemVer } from "../../../../deno_ral/semver.ts";` |
| `src/command/use/commands/binder/binder.ts:12` | `import SemVer from "semver/mod.ts";` | `import { SemVer } from "../../../../deno_ral/semver.ts";` |
| `src/core/git.ts:9` | `import SemVer from "semver/mod.ts";` | `import { SemVer } from "../deno_ral/semver.ts";` |
| `src/extension/types.ts:7-8` | `import type SemVer from "semver/mod.ts";` and `import { type Range } from "semver/mod.ts";` | `import type { Range, SemVer } from "../deno_ral/semver.ts";` (one line replaces both) |

- [ ] **Step 6: Confirm nothing imports the old name, then type-check the CLI**

Run: `grep -rn 'from "semver/' src package/src tests tools --include=*.ts; package/dist/bin/tools/x86_64/deno check --import-map src/import_map.json src/quarto.ts`
Expected: no grep output; `deno check` exits 0. If `deno check` reports a `TS2345`/`TS2322` at one of the call sites listed in the Context table (the Deno port typed `coerce`'s argument as `string | SemVer`; `@types/semver` also accepts `number | null | undefined`, so new errors are unlikely), narrow the value at the call site (`if (x) ...`) rather than loosening the wrapper.

- [ ] **Step 7: Run the tests that exercise the call sites**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/deno-ral/semver.test.ts smoke/check/check.test.ts smoke/extensions/ smoke/engine/`
Expected: all passed (`check` prints tool versions through `satisfies`; extension install validates `quarto-required` through `Range`/`satisfies`/`coerce`; the engine tests go through `engine.ts:66` and `knitr.ts:144-156`).

Run: `QUARTO_VERSION_REQUIREMENT=">=1.4" package/dist/bin/quarto --version; QUARTO_VERSION_REQUIREMENT=">=100" package/dist/bin/quarto render tests/docs/minimal.qmd --to html; echo "exit=$?"`
Expected: `99.9.9`; then `ERROR: Quarto version 99.9.9 does not meet semver requirement >=100` and `exit=1` (`src/quarto.ts:62-70`).

- [ ] **Step 8: Commit**

```bash
git add src/import_map.json src/deno_ral/semver.ts tests/unit/deno-ral/semver.test.ts \
  src/quarto.ts src/project/project-environment-types.ts src/project/project-environment.ts \
  src/execute/jupyter/jupyter.ts src/execute/engine.ts src/command/render/render-files.ts \
  src/command/create/artifacts/artifact-shared.ts src/command/check/check.ts \
  src/command/use/commands/binder/binder-types.ts src/command/use/commands/binder/binder.ts \
  src/extension/extension.ts src/extension/types.ts src/core/cache/cache.ts src/core/git.ts \
  src/core/jupyter/jupyter.ts src/core/typst.ts src/core/knitr.ts
git commit -m "Replace deno.land/x/semver with npm:semver behind deno_ral/semver.ts

The wrapper carries a @ts-types directive for @types/semver so the 18
call sites stay type-checked. Default imports of SemVer become named
imports: node-semver's default export is the module object."
```

### Task 2: `media_types` → `jsr:@std/media-types`

**Files:**
- Modify: `src/import_map.json:41` (`media_types/`)
- Modify: `src/execute/ojs/extract-resources.ts:8-15,778`

- [ ] **Step 1: Change the import-map entry**

Replace
```json
    "media_types/": "https://deno.land/x/media_types@v2.10.1/",
```
with
```json
    "media_types": "jsr:@std/media-types@1.1.0",
```

- [ ] **Step 2: Change the import and the call**

In `src/execute/ojs/extract-resources.ts`, replace lines 8-15

```ts
import {
  dirname,
  fromFileUrl,
  relative,
  resolve,
} from "../../deno_ral/path.ts";
import { encodeBase64 } from "encoding/base64";
import { lookup } from "media_types/mod.ts";
```
with
```ts
import {
  dirname,
  extname,
  fromFileUrl,
  relative,
  resolve,
} from "../../deno_ral/path.ts";
import { encodeBase64 } from "encoding/base64";
import { typeByExtension } from "media_types";
```

and replace lines 777-779

```ts
        const resolvedFileName = resolveResourceFilename(f, Deno.cwd());
        const mimeType = lookup(resolvedFileName) ||
          "application/octet-stream";
```
with
```ts
        const resolvedFileName = resolveResourceFilename(f, Deno.cwd());
        const mimeType =
          typeByExtension(extname(resolvedFileName).toLowerCase()) ||
          "application/octet-stream";
```

- [ ] **Step 3: Type-check and run the OJS tests**

Run: `package/dist/bin/tools/x86_64/deno check --import-map src/import_map.json src/execute/ojs/extract-resources.ts && cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/ojs/dependency-traversal.test.ts smoke/render/render-ojs.test.ts`
Expected: `Check` line, then all passed (`dependency-traversal` renders a document whose OJS cells attach local files, which are inlined as data URLs with the looked-up mime type).

- [ ] **Step 4: Commit**

```bash
git add src/import_map.json src/execute/ojs/extract-resources.ts
git commit -m "Replace deno.land/x/media_types with @std/media-types"
```

### Task 3: `xmlp` → `fast-xml-parser` for the sitemap reader

**Files:**
- Modify: `src/import_map.json:37` (`xmlp/`; adds `fast-xml-parser`)
- Modify: `src/project/types/website/website-sitemap.ts:10,121,181-200`
- Test: `tests/unit/project/website-sitemap-parse.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/project/website-sitemap-parse.test.ts`:

```ts
/*
 * website-sitemap-parse.test.ts
 *
 * parseSitemap reads back the sitemap.xml written by a previous render so an
 * incremental render can update only the changed <url> entries.
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { unitTest } from "../../test.ts";
import { assertEquals } from "testing/asserts";
import { parseSitemap } from "../../../src/project/types/website/website-sitemap.ts";

const kHeader = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;

// deno-lint-ignore require-await
unitTest("parseSitemap - several urls", async () => {
  const xml = `${kHeader}
  <url>
    <loc>https://example.com/index.html</loc>
    <lastmod>2026-01-01T00:00:00.000Z</lastmod>
  </url>
  <url>
    <loc>https://example.com/posts/a&amp;b.html</loc>
    <lastmod>2026-01-02T00:00:00.000Z</lastmod>
  </url>
</urlset>
`;
  assertEquals(parseSitemap(xml), [
    { loc: "https://example.com/index.html", lastmod: "2026-01-01T00:00:00.000Z" },
    { loc: "https://example.com/posts/a&b.html", lastmod: "2026-01-02T00:00:00.000Z" },
  ]);
});

// deno-lint-ignore require-await
unitTest("parseSitemap - a single url is not unwrapped into a scalar", async () => {
  const xml = `${kHeader}
  <url><loc>https://example.com/only.html</loc><lastmod>2026</lastmod></url>
</urlset>`;
  assertEquals(parseSitemap(xml), [
    { loc: "https://example.com/only.html", lastmod: "2026" },
  ]);
});

// deno-lint-ignore require-await
unitTest("parseSitemap - empty urlset and incomplete urls", async () => {
  assertEquals(parseSitemap(`${kHeader}</urlset>`), []);
  assertEquals(
    parseSitemap(`${kHeader}<url><loc>https://example.com/x.html</loc></url></urlset>`),
    [],
  );
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/project/website-sitemap-parse.test.ts`
Expected: FAIL at type-check, `has no exported member 'parseSitemap'`.

- [ ] **Step 3: Change the import map**

Replace
```json
    "xmlp/": "https://deno.land/x/xmlp@v0.2.8/",
```
with
```json
    "fast-xml-parser": "npm:fast-xml-parser@5.11.2",
```

- [ ] **Step 4: Implement `parseSitemap`**

In `src/project/types/website/website-sitemap.ts` replace line 10

```ts
import { ElementInfo, SAXParser } from "xmlp/mod.ts";
```
with
```ts
import { XMLParser } from "fast-xml-parser";
```

and replace the whole `readSitemap` function (lines 181-200)

```ts
async function readSitemap(sitemapPath: string): Promise<Urlset> {
  const urlset = new Array<{ loc: string; lastmod: string }>();
  const parser = new SAXParser();
  let loc: string | undefined;
  let lastmod: string | undefined;
  parser.on("text", (text: string, element: ElementInfo) => {
    if (element.qName === "loc") {
      loc = text;
    } else if (element.qName == "lastmod") {
      lastmod = text;
    }
  });
  parser.on("end_element", (element: ElementInfo) => {
    if (element.qName === "url" && loc && lastmod) {
      urlset.push({ loc, lastmod });
    }
  });
  const reader = await Deno.open(sitemapPath);
  await parser.parse(reader);
  reader.close();
  return urlset;
}
```
with
```ts
/**
 * Parse the <loc>/<lastmod> pairs of every <url> in a sitemap.xml document.
 * Entries missing either element are skipped, as the previous SAX reader did.
 */
export function parseSitemap(xml: string): Array<{ loc: string; lastmod: string }> {
  // parseTagValue: false keeps <lastmod> and <loc> as strings
  const parsed = new XMLParser({ parseTagValue: false }).parse(xml) as {
    urlset?: { url?: unknown } | string;
  };
  if (!parsed.urlset || typeof parsed.urlset === "string") {
    return [];
  }
  const urls = parsed.urlset.url === undefined
    ? []
    : Array.isArray(parsed.urlset.url)
    ? parsed.urlset.url
    : [parsed.urlset.url];
  const urlset: Array<{ loc: string; lastmod: string }> = [];
  for (const url of urls as Array<{ loc?: unknown; lastmod?: unknown }>) {
    if (typeof url.loc === "string" && typeof url.lastmod === "string") {
      urlset.push({ loc: url.loc, lastmod: url.lastmod });
    }
  }
  return urlset;
}

function readSitemap(sitemapPath: string): Urlset {
  return parseSitemap(Deno.readTextFileSync(sitemapPath));
}
```

and change its one caller at line 121

```ts
      const urlSet: Urlset = await readSitemap(sitemapPath);
```
to
```ts
      const urlSet: Urlset = readSitemap(sitemapPath);
```

- [ ] **Step 5: Run the unit test and the sitemap smoke tests**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/project/website-sitemap-parse.test.ts smoke/website/drafts.test.ts smoke/website/drafts-env.test.ts`
Expected: all passed (`drafts.test.ts` renders a site and checks `sitemap.xml` with `ensureFileRegexMatches` from `tests/smoke/website/draft-utils.ts:37-41`).

- [ ] **Step 6: Exercise the incremental path by hand**

Run:
```bash
mkdir -p /tmp/rt04site
printf 'project:\n  type: website\nwebsite:\n  site-url: https://example.com/\n' > /tmp/rt04site/_quarto.yml
printf -- '---\ntitle: Home\n---\n\nhome\n' > /tmp/rt04site/index.qmd
printf -- '---\ntitle: About\n---\n\nabout\n' > /tmp/rt04site/about.qmd
package/dist/bin/quarto render /tmp/rt04site && cat /tmp/rt04site/_site/sitemap.xml
sleep 1; touch /tmp/rt04site/about.qmd
package/dist/bin/quarto render /tmp/rt04site/about.qmd && cat /tmp/rt04site/_site/sitemap.xml
```
Expected: the first `sitemap.xml` lists `https://example.com/index.html` and `https://example.com/about.html`; the second (single-file render, which takes the incremental `readSitemap` branch at `website-sitemap.ts:121`) still lists both, with `about.html`'s `<lastmod>` later than before. Remove `/tmp/rt04site` afterwards.

- [ ] **Step 7: Commit**

```bash
git add src/import_map.json src/project/types/website/website-sitemap.ts tests/unit/project/website-sitemap-parse.test.ts
git commit -m "Replace deno.land/x/xmlp with fast-xml-parser for sitemap reading"
```

### Task 4: `xml` → `fast-xml-parser` for the MECA manifest

**Files:**
- Modify: `src/import_map.json:38` (`xml/`)
- Modify: `src/project/types/manuscript/meca.ts:6,31-50`
- Test: `tests/unit/project/manuscript-meca-xml.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/project/manuscript-meca-xml.test.ts`:

```ts
/*
 * manuscript-meca-xml.test.ts
 *
 * toXml writes the MECA manifest.xml for a manuscript's MECA bundle.
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { unitTest } from "../../test.ts";
import { assertEquals } from "testing/asserts";
import { kMecaVersion, toXml } from "../../../src/project/types/manuscript/meca.ts";

// deno-lint-ignore require-await
unitTest("meca toXml - declaration, doctype, attributes, text and self-closing instance", async () => {
  const xml = toXml({
    version: kMecaVersion,
    items: [
      {
        id: "article",
        type: "article-metadata",
        version: "1",
        title: "My Article",
        description: "An article & more",
        order: 1,
        metadata: { key: "value" },
        instance: { mediaType: "application/xml", href: "index.xml" },
      },
      {
        type: "manuscript",
        instance: { href: "index.html" },
      },
    ],
  });
  assertEquals(
    xml,
    `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE manifest PUBLIC "-//MECA//DTD Manifest v1.0//en" "MECA_manifest.dtd">
<manifest manifest-version="1" xmlns="https://manuscriptexchange.org/schema/manifest" xmlns:xlink="http://www.w3.org/1999/xlink">
  <item id="article" item-type="article-metadata" version="1">
    <item-title>My Article</item-title>
    <item-description>An article &amp; more</item-description>
    <file-order>1</file-order>
    <item-metadata>
      <metadata metadata-name="key">value</metadata>
    </item-metadata>
    <instance media-type="application/xml" xlink:href="index.xml"/>
  </item>
  <item item-type="manuscript">
    <instance xlink:href="index.html"/>
  </item>
</manifest>
`,
  );
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/project/manuscript-meca-xml.test.ts`
Expected: FAIL. With the old `xml` package still mapped, the assertion fails on formatting differences (the old library's doctype and indentation), which is the point of pinning the new format; with `xml/` already removed it fails at module resolution.

- [ ] **Step 3: Remove the import-map entry**

Delete the line
```json
    "xml/": "https://deno.land/x/xml@2.1.1/",
```
(`fast-xml-parser` was added in Task 3.)

- [ ] **Step 4: Implement `toXml` on `XMLBuilder`**

In `src/project/types/manuscript/meca.ts` replace line 6

```ts
import { stringify } from "xml/mod.ts";
```
with
```ts
import { XMLBuilder } from "fast-xml-parser";
```

and replace `toXml` (lines 31-51)

```ts
export function toXml(manifest: MecaManifest): string {
  const mecaJson = {
    xml: {
      "@version": "1.0",
      "@encoding": "UTF-8",
    },
    doctype: {
      "@manifest": true,
      "@PUBLIC": true,
      "@-//MECA//DTD Manifest v1.0//en": true,
      "@MECA_manifest.dtd": true,
    },
    manifest: {
      "@manifest-version": manifest.version,
      "@xmlns": "https://manuscriptexchange.org/schema/manifest",
      "@xmlns:xlink": "http://www.w3.org/1999/xlink",
      item: manifest.items.map(toMecaXMLItem),
    },
  };
  return stringify(mecaJson);
}
```
with
```ts
const kXmlDeclaration = `<?xml version="1.0" encoding="UTF-8"?>`;
const kMecaDoctype =
  `<!DOCTYPE manifest PUBLIC "-//MECA//DTD Manifest v1.0//en" "MECA_manifest.dtd">`;

export function toXml(manifest: MecaManifest): string {
  const mecaJson = {
    manifest: {
      "@manifest-version": manifest.version,
      "@xmlns": "https://manuscriptexchange.org/schema/manifest",
      "@xmlns:xlink": "http://www.w3.org/1999/xlink",
      item: manifest.items.map(toMecaXMLItem),
    },
  };
  const builder = new XMLBuilder({
    ignoreAttributes: false,
    attributeNamePrefix: "@",
    textNodeName: "#text",
    format: true,
    indentBy: "  ",
    suppressEmptyNode: true,
  });
  return [kXmlDeclaration, kMecaDoctype, builder.build(mecaJson)].join("\n");
}
```

`toMecaXMLItem` (lines 53-102) stays as it is: `XMLBuilder` omits attributes and elements whose value is `undefined` (verified), so `"@media-type": item.instance.mediaType` and `xmlItem["item-metadata"] = undefined` behave as before.

- [ ] **Step 5: Run the unit test**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/project/manuscript-meca-xml.test.ts`
Expected: `1 passed`. (`builder.build` ends with a newline, which gives the trailing newline in the expected string.)

- [ ] **Step 6: Render the manuscript fixtures and validate the MECA bundle**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/manuscript/render-manuscript.test.ts smoke/jats/render-manuscript.test.ts`
Expected: all passed. `ensureMECAValidates` (`tests/verify.ts:1323`) runs `meca validate` on the zip when the `meca` npm CLI is on `PATH` and prints `meca not present, skipping MECA validation` otherwise. For this PR, install it once (`npm install -g meca`) so the validation actually runs, and keep the line `Validating MECA Archive` without a failure in the output.

Run:
```bash
package/dist/bin/quarto render tests/docs/manuscript/base --to jats
unzip -p tests/docs/manuscript/base/_manuscript/index-meca.zip manifest.xml | head -3
rm -rf tests/docs/manuscript/base/_manuscript
```
Expected: the three lines are `<?xml version="1.0" encoding="UTF-8"?>`, `<!DOCTYPE manifest PUBLIC "-//MECA//DTD Manifest v1.0//en" "MECA_manifest.dtd">` and `<manifest manifest-version="1" xmlns="https://manuscriptexchange.org/schema/manifest" xmlns:xlink="http://www.w3.org/1999/xlink">` (the MECA zip is written next to the JATS output as `<stem>-meca.zip`, `tests/smoke/manuscript/manuscript.ts:42-43`).

- [ ] **Step 7: Commit**

```bash
git add src/import_map.json src/project/types/manuscript/meca.ts tests/unit/project/manuscript-meca-xml.test.ts
git commit -m "Replace deno.land/x/xml with fast-xml-parser for the MECA manifest

The XML declaration and the MECA doctype are written by hand; the
manifest tree is built by XMLBuilder with the same @attr/#text
conventions the previous library used."
```

### Task 5: `another_cookiejar` → global `fetch`

**Files:**
- Modify: `src/import_map.json:39` (`another_cookiejar/`)
- Modify: `src/publish/rsconnect/api/index.ts:8-9`

- [ ] **Step 1: Remove the wrapper**

Delete lines 8-9 of `src/publish/rsconnect/api/index.ts`:

```ts
import { wrapFetch } from "another_cookiejar/mod.ts";
const fetch = wrapFetch();
```

The `fetch(this.apiUrl(path), {...})` call at line 60 now resolves to the global `fetch`. Leave the unused `cookies_` field (line 85) alone; it is not this PR's concern.

- [ ] **Step 2: Remove the import-map entry**

Delete the line
```json
    "another_cookiejar/": "https://deno.land/x/another_cookiejar@v5.0.3/",
```

- [ ] **Step 3: Type-check and run the publish unit tests**

Run: `package/dist/bin/tools/x86_64/deno check --import-map src/import_map.json src/publish/rsconnect/api/index.ts src/publish/rsconnect/rsconnect.ts && package/dist/bin/quarto publish connect --help`
Expected: `Check` lines, exit 0; the help text for `quarto publish connect` prints (there is no network test for Connect; see Decisions for the manual check against a server).

- [ ] **Step 4: Commit**

```bash
git add src/import_map.json src/publish/rsconnect/api/index.ts
git commit -m "Drop another_cookiejar: Connect requests authenticate with the API key header"
```

### Task 6: `events` → `node:events`; delete `cache`

**Files:**
- Modify: `src/import_map.json:33-34` (`events/`, `cache/`)
- Modify: `src/core/cri/deno-cri/chrome.js:9`, `src/core/cri/deno-cri/index.js:9`, `src/core/cri/deno-cri/websocket-wrapper.js:9`

- [ ] **Step 1: Confirm `cache/` is unused**

Run: `grep -rn '"cache/' src package/src tests tools --include=*.ts --include=*.js --include=*.mjs`
Expected: no output.

- [ ] **Step 2: Change the three imports**

In each of `src/core/cri/deno-cri/chrome.js:9`, `src/core/cri/deno-cri/index.js:9` and `src/core/cri/deno-cri/websocket-wrapper.js:9` replace

```js
import EventEmitter from "events/mod.ts";
```
with
```js
import EventEmitter from "node:events";
```

- [ ] **Step 3: Delete the two import-map entries**

Delete the lines
```json
    "events/": "https://deno.land/x/events@v1.0.0/",
    "cache/": "https://deno.land/x/cache@0.2.12/",
```

- [ ] **Step 4: Render a mermaid diagram (deno-cri drives Chrome over CDP)**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent docs/smoke-all/2026/02/12/mermaid-typst.qmd docs/smoke-all/2026/02/12/mermaid-multi-diagram.qmd`
Expected: all passed. These need a Chrome: run `package/dist/bin/quarto install chrome-headless-shell --no-prompt` first if `package/dist/bin/quarto check` reports `Chrome: (not detected)`. The Typst document is the gate: formats without a JavaScript runtime render mermaid to an image through `withCriClient` (`src/core/handlers/base.ts:146,180` → `src/core/cri/cri.ts`, headless Chrome over CDP; the format split is at `src/core/handlers/mermaid.ts:309`), and Typst is bundled with Quarto so no TinyTeX is needed. `mermaid-pdf-default.qmd` covers the same path for LaTeX if TinyTeX is installed.

- [ ] **Step 5: Commit**

```bash
git add src/import_map.json src/core/cri/deno-cri/chrome.js src/core/cri/deno-cri/index.js src/core/cri/deno-cri/websocket-wrapper.js
git commit -m "Use node:events in deno-cri; drop unused cache import-map entry"
```

### Task 7: Remove the std redirect entries this PR made unused

**Files:**
- Modify: `src/import_map.json:63-72`

- [ ] **Step 1: List which redirect keys are still imported by something in the module graph**

Run (from the repository root; `deno info` fetches the remote modules so it needs network):

```bash
D=package/dist/bin/tools/x86_64/deno
for entry in src/quarto.ts src/vendor_deps.ts tests/test-deps.ts package/src/bld.ts; do
  $D info --json --import-map src/import_map.json "$entry" > "/tmp/rt04-info-$(basename "$entry").json"
done
$D eval '
const raw = new Set<string>();
for (const f of ["quarto.ts", "vendor_deps.ts", "test-deps.ts", "bld.ts"]) {
  const info = JSON.parse(Deno.readTextFileSync(`/tmp/rt04-info-${f}.json`));
  for (const m of info.modules ?? []) for (const d of m.dependencies ?? []) raw.add(d.specifier);
}
const map = JSON.parse(Deno.readTextFileSync("src/import_map.json")).imports;
for (const key of Object.keys(map)) {
  if (!key.startsWith("https://deno.land/std")) continue;
  const used = [...raw].some((s) => key.endsWith("/") ? s.startsWith(key) : s === key);
  console.log((used ? "USED   " : "UNUSED ") + key);
}'
```

Expected: one line per `https://deno.land/std@...` key. Predicted after Tasks 1-6: `UNUSED https://deno.land/std@0.105.0/` (was `media_types`) and `UNUSED` for the three `std@0.91.0` keys (`fs/exists.ts`, `fs/ensure_dir.ts`, `path/`, which served `cache`); `USED` for `std@0.196.0/console/unicode_width.ts` (cliffy, PR 06) and the `std@0.93.0` keys (puppeteer, PR 07). `std@0.161.0/` and `std@0.101.0/` were not attributable from the vendored sources available while writing this plan; trust the script.

- [ ] **Step 2: Delete exactly the `UNUSED` keys, then re-run the script and `deno check`**

Run: the script from Step 1 again, then `package/dist/bin/tools/x86_64/deno check --import-map src/import_map.json src/quarto.ts`
Expected: only `USED` lines remain; `deno check` exits 0.

- [ ] **Step 3: Commit**

```bash
git add src/import_map.json
git commit -m "Drop deno.land/std redirects that served media_types and cache"
```

### Task 8: Baseline and status

**Files:**
- Modify: `tools/runtime-boundary-baseline.json` (only if PR 02 has landed)
- Modify: `dev-docs/runtime-migration/README.md`

- [ ] **Step 1: Lower the ratchet baseline**

Run: `package/dist/bin/quarto run --dev tools/check-runtime-boundary.ts --update-baseline && git diff tools/runtime-boundary-baseline.json`
Expected: `src.stdImportFiles` drops by 18 (the semver importers now import `deno_ral/semver.ts`; `extract-resources.ts` still matches `from "media_types"` and stays counted). If PR 02 has not landed, skip this step.

- [ ] **Step 2: Set the PR 04 row to `in progress` and commit**

```bash
git add tools/runtime-boundary-baseline.json dev-docs/runtime-migration/README.md
git commit -m "runtime-migration: PR 04 in progress; lower boundary baseline"
```

## Verification

```bash
rm -rf package/dist/bin/deno_cache && ./configure.sh        # cache rebuilt without the seven packages
grep -n 'deno.land/x' src/import_map.json                     # only cliffy, deno_dom, puppeteer remain
package/dist/bin/tools/x86_64/deno check --import-map src/import_map.json src/quarto.ts package/src/bld.ts
package/dist/bin/quarto check
cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent \
  unit/deno-ral/semver.test.ts unit/project/website-sitemap-parse.test.ts unit/project/manuscript-meca-xml.test.ts \
  smoke/check/check.test.ts smoke/extensions/ smoke/engine/ \
  smoke/ojs/dependency-traversal.test.ts smoke/render/render-ojs.test.ts \
  smoke/website/drafts.test.ts smoke/website/drafts-env.test.ts \
  smoke/manuscript/render-manuscript.test.ts smoke/jats/render-manuscript.test.ts
cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent \
  docs/smoke-all/2026/02/12/mermaid-typst.qmd docs/smoke-all/2026/02/12/mermaid-multi-diagram.qmd
package/dist/bin/quarto run --dev tools/check-runtime-boundary.ts   # after PR 02
```

On the PR: `Bundle Test`, `Smoke Tests`, and (after PR 02) `Runtime Boundary` green. The `Bundle Test` job is the proof that `npm:semver`, `npm:fast-xml-parser`, `jsr:@std/media-types` and `node:events` bundle with `@luca/esbuild-deno-loader`.

## Review checklist

- [ ] `src/deno_ral/semver.ts` is the only file importing `"semver"`, and it carries the `@ts-types` directive on the line directly above the export.
- [ ] The four former default imports of `SemVer` are named imports; no `new SemVer` call is left on a default import.
- [ ] `extract-resources.ts` uses `typeByExtension`, not `contentType` (no charset suffix in data URLs).
- [ ] `parseSitemap` handles the one-`<url>` case (object, not array) and skips entries without `lastmod`, matching the old SAX reader (`website-sitemap.ts:192-196`).
- [ ] `toXml` output starts with the declaration and the doctype on their own lines; the unit test pins the exact text.
- [ ] The rsconnect client has no cookie jar and no other import changed in that file.
- [ ] The three `deno-cri` files import `node:events` and nothing else changed in them.
- [ ] Only `UNUSED` redirect keys were deleted in Task 7 and the script output is pasted in the PR description.
- [ ] Each task is its own commit.

## Risks and rollback

- `satisfies` semantics with prereleases: both libraries implement node-semver's rule (a prerelease only satisfies a range that names a prerelease on the same tuple). The dev build reports `99.9.9`, not a prerelease, so extension checks behave as before; the unit test pins it.
- The MECA manifest text changes (indentation, quoted doctype, self-closing `<instance/>`). The XML is semantically identical; `meca validate` in the manuscript smoke tests is the external check. Rollback: revert the Task 4 commit (restores the `xml/` entry).
- Connect publishing is not covered by an automated test. If a server rejects requests without a session cookie, revert the Task 5 commit and apply the fallback in Decisions.
- `fast-xml-parser` is a new npm dependency (no transitive dependencies except `strnum`); it is bundled by `Bundle Test`.
- Each task is one commit; revert individually.

## Decisions needed

1. **Cookie jar for Posit Connect.** The plan removes it because every request is authenticated by the `Authorization: Key` header and nothing reads the jar. Before merging, publish a document to a Connect server (`quarto publish connect --server <url>` with a `CONNECT_API_KEY`) once with this branch. If the server requires a session cookie after all, add `"fetch-cookie": "npm:fetch-cookie@3.2.0"` and `"tough-cookie": "npm:tough-cookie@6.0.2"` to the import map and write `const fetch = makeFetchCookie(globalThis.fetch, new CookieJar());` (`import makeFetchCookie from "fetch-cookie"; import { CookieJar } from "tough-cookie";`) in `src/publish/rsconnect/api/index.ts`. Recommendation: remove the jar (this plan); the fallback is a two-line change.
2. **`tests/unit/deno-ral/` vs `tests/unit/ral/`.** `_TEMPLATE.md` says `deno_ral` module tests live under `tests/unit/deno-ral/`; the two existing ones are under `tests/unit/ral/`. This plan follows the template. Recommendation: PR 09 moves the two existing files when it adds its own tests; do not block this PR on it.
