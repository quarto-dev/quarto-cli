# PR 04: Replace the small `deno.land/x` dependencies

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the `semver/`, `media_types/`, `xmlp/`, `xml/`, `another_cookiejar/`, `cache/` and `events/` entries from `src/import_map.json`, replacing each with an npm/JSR package or a Node built-in that works on Deno today and on Node later (the Posit Connect cookie jar is kept, on `tough-cookie`), with `deno.lock` updated in the same commits.
**Phase:** 0. **Depends on:** 02 (ratchet, `tests/asserts.ts`), 00b (frozen `deno.lock`, `update-lock.sh`, the bundle gate). **Unblocks:** PR 22 (std import seams; semver is done here), PR 25 (it checks `deno.land/x/cache` is gone), PR 26, PR 07's last task (the std-redirect cleanup that used to be this plan's Task 7).
**Branch:** `rt/04-deps-deno-land-x-small`.
**Suggested executor:** Opus. Each replacement is small, but four of them change library APIs (XML building/parsing, cookies, mime lookup) and need judgement at the call site when a test disagrees with the plan.
**Size:** M (import map, `deno.lock`, 1 new `deno_ral` module, 17 semver importer files, 1 new rsconnect module, 4 other source files, 3 JS files, 5 new tests).
**Ships on:** Deno; the existing test suite must stay green.

## Spec

### Context

`00-assessment.md` section 3.4 (row "xmlp, xml, another_cookiejar, media_types, cache, events") and section 10 (the spike had to re-source every `deno.land/x` package from GitHub tags). These seven entries are the small ones; deno_dom, cliffy and puppeteer have their own PRs (05, 06, 07). Each task below is independent and lands as its own commit so a reviewer can bisect.

What each entry is used for (verified with grep on `main` at `b86f98d`):

| Entry | Pinned | Importers | Names used | Replacement |
|---|---|---|---|---|
| `semver/` | `deno.land/x/semver@v1.4.0` (a TypeScript port of node-semver 7 by justjavac; same function names and signatures, `export default SemVer`) | 17 files, 18 import lines (`src/extension/types.ts` has two; list in Task 1) | `satisfies(version, range)` ×9, `coerce(v)` ×3, `valid(v)` ×1, `new SemVer(s)` ×5 and the `SemVer` type ×4, `new Range(s)` ×1 and the `Range` type ×1 | `npm:semver@7.8.5` behind a new `src/deno_ral/semver.ts` wrapper with `// @ts-types="@types/semver"` (`npm:@types/semver@7.8.0`) so the 17 files stay type-checked. Verified in this sandbox: without the directive Deno types the package as `any`; with it, `satisfies(1, 2)` is a TS2345 error and `coerce`/`valid`/`satisfies` have the same parameter and return types as the Deno port (`coerce(...): SemVer | null`, `valid(...): string | null`). `jsr:@std/semver` (1.0.8) was rejected: its API is functional over parsed objects (`parse`, `parseRange`, `satisfies(SemVer, Range)`, `format`) and would require rewriting every call site. |
| `media_types/` | `deno.land/x/media_types@v2.10.1` | `src/execute/ojs/extract-resources.ts:15,778` | `lookup(path)` | `jsr:@std/media-types@1.1.0` `typeByExtension(ext)`; verified: `typeByExtension(".png") === "image/png"`, `typeByExtension("nope") === undefined`. `contentType()` was rejected because it appends `; charset=UTF-8` to text types, which would change the data URL produced by `asDataURL`. |
| `xmlp/` | `deno.land/x/xmlp@v0.2.8` (SAX parser) | `src/project/types/website/website-sitemap.ts:10,121,181-200` | `SAXParser`, `ElementInfo` to read `<loc>`/`<lastmod>` of every `<url>` from an existing `sitemap.xml` during incremental renders | `npm:fast-xml-parser@5.11.2` `XMLParser` (`{ parseTagValue: false }` so dates and URLs stay strings; verified: one `<url>` parses to an object, several to an array, an empty `<urlset>` to `""`, entities are decoded). 5.11.2 has six dependencies (`@nodable/entities`, `fast-xml-builder`, `is-unsafe`, `path-expression-matcher`, `strnum`, `xml-naming`), all pinned by `deno.lock`. |
| `xml/` | `deno.land/x/xml@2.1.1` (lowlighter) | `src/project/types/manuscript/meca.ts:6,50` | `stringify(json)` with `@attr` / `#text` conventions to write the MECA `manifest.xml` | `npm:fast-xml-parser@5.11.2` `XMLBuilder` with `attributeNamePrefix: "@"`, `textNodeName: "#text"`; the `<?xml ...?>` and `<!DOCTYPE ...>` lines are written by hand (XMLBuilder has no doctype support). Verified (Node 22, fast-xml-parser 5.11.2, the builder options of Task 4): undefined attributes and undefined child elements are omitted, `&` and `<` are escaped, `suppressEmptyNode: true` self-closes `<instance .../>`, an array value repeats the element. One dependency replaces both XML packages. `toMecaXMLItem` wraps metadata in a second `item-metadata` level and overwrites repeated `metadata` keys; Task 4 fixes both (no production caller passes `metadata`: `toMecaItem` in `manuscript-meca.ts:407` never sets it). |
| `another_cookiejar/` | `deno.land/x/another_cookiejar@v5.0.3` | `src/publish/rsconnect/api/index.ts:8-9` | `wrapFetch()` returns a `fetch` that keeps one cookie jar per process across calls | Kept (review decision 5): `npm:tough-cookie@6.0.2` `CookieJar` behind a 30-line `fetchWithCookieJar()` in a new `src/publish/rsconnect/api/cookie-fetch.ts`. Requests authenticate with `Authorization: Key <api-key>`, but a Connect server behind a load balancer can set a sticky-session cookie (for example `AWSALB`) on the upload and expect it on the deploy and on the `tasks/{id}?wait=1` polls. Verified on Node 22 with a local server: a `Set-Cookie` of the first response is sent on later requests to the same host and path, a cookie scoped to `/x` only to `/x/...`, and a new jar starts empty. tough-cookie 6.0.2 is ESM (`exports.import`), ships its own types and depends on `tldts` only. |
| `cache/` | `deno.land/x/cache@0.2.12` | none (`grep -rn '"cache/' src package/src tests tools` is empty) | — | delete the entry |
| `events/` | `deno.land/x/events@v1.0.0` (a copy of Node's `EventEmitter`) | `src/core/cri/deno-cri/chrome.js:9,53`, `index.js:9,35`, `websocket-wrapper.js:9,13` (default import; `class ... extends EventEmitter` and `new EventEmitter()`) | `node:events` default export (verified on Deno 2.7.14: `import EventEmitter from "node:events"` is the class, `class C extends EventEmitter` works, `EventEmitter === EE2` for the named import). `node:` built-ins are runtime-neutral by construction. |

`src/import_map.json` also carries redirect entries for old `deno.land/std` URLs that these packages import internally (`https://deno.land/std@0.105.0/` is `media_types`' path import; the three `std@0.91.0` entries are most likely `cache`'s; `std@0.196.0/console/unicode_width.ts` is cliffy rc.3's and `std@0.93.0/*` are puppeteer's). This PR does not touch those redirects: PR 07's last task removes every redirect that is unused once 03–07 have landed, with one `deno info` run over every entrypoint (including `tests/**/*.test.ts`, `tools/*.ts`, `package/scripts/deno_std/deno_std.ts` and the `src/resources/**` scripts, which the first draft of this plan missed and would have reported as unused).

### Scope

In: the seven entries above, their importers, one new `deno_ral` module, one new rsconnect module (`cookie-fetch.ts`), unit tests for the semver wrapper, the sitemap parser, the MECA writer and the cookie-jar fetch, and `deno.lock` updates.

Out: `deno_dom/`, `cliffy/`, `puppeteer` (PRs 05-07); routing `fmt/colors`, `encoding/*`, `io/*`, `flags`, `log` through `deno_ral` (PR 22, which no longer needs to handle `semver`); the `https://deno.land/std@...` redirect entries (PR 07's last task).

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

`src/publish/rsconnect/api/cookie-fetch.ts` (new):

```ts
import { CookieJar } from "tough-cookie";

/** The fetch signature the Connect client uses. */
export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

/** A fetch that sends the cookies `jar` holds for the request URL and stores every `Set-Cookie` of the
 * response in `jar`. Cookies tough-cookie rejects (bad domain, malformed) are ignored, as
 * another_cookiejar did. Redirects are followed by `baseFetch`; cookies set on an intermediate redirect
 * response are not seen (Connect's API does not redirect). */
export function fetchWithCookieJar(jar?: CookieJar, baseFetch?: FetchLike): FetchLike;
```

`src/publish/rsconnect/api/index.ts`: no signature change; `const fetch = fetchWithCookieJar();` replaces `const fetch = wrapFetch();` (one jar per process, as before).

### Files

- Create: `src/deno_ral/semver.ts`
- Modify: `src/import_map.json:33-34,37-41` (`events/`, `cache/`, `xmlp/`, `xml/`, `another_cookiejar/`, `semver/`, `media_types/` entries)
- Modify: `deno.lock` (via `package/scripts/vendoring/update-lock.sh` after each map edit)
- Modify (semver importers): `src/quarto.ts:29`, `src/project/project-environment-types.ts:8`, `src/project/project-environment.ts:19`, `src/execute/jupyter/jupyter.ts:8`, `src/execute/engine.ts:43`, `src/command/render/render-files.ts:110`, `src/command/create/artifacts/artifact-shared.ts:12`, `src/command/check/check.ts:23`, `src/command/use/commands/binder/binder-types.ts:7`, `src/command/use/commands/binder/binder.ts:12`, `src/extension/extension.ts:11`, `src/extension/types.ts:7-8`, `src/core/cache/cache.ts:13`, `src/core/git.ts:9`, `src/core/jupyter/jupyter.ts:185`, `src/core/typst.ts:12`, `src/core/knitr.ts:12`
- Modify: `src/execute/ojs/extract-resources.ts:8-15,778`
- Modify: `src/project/types/website/website-sitemap.ts:10,121,181-200`
- Modify: `src/project/types/manuscript/meca.ts:6,31-50,77-94`
- Create: `src/publish/rsconnect/api/cookie-fetch.ts`
- Modify: `src/publish/rsconnect/api/index.ts:8-9`
- Modify: `src/core/cri/deno-cri/chrome.js:9`, `src/core/cri/deno-cri/index.js:9`, `src/core/cri/deno-cri/websocket-wrapper.js:9`
- Test: `tests/unit/ral/semver.test.ts`, `tests/unit/project/website-sitemap-parse.test.ts`, `tests/unit/project/manuscript-meca-xml.test.ts`, `tests/unit/publish/rsconnect-cookie-fetch.test.ts`
- Modify: `dev-docs/runtime-migration/README.md` (PR 04 row status)

### Acceptance criteria

- `grep -n 'deno.land/x/\(semver\|media_types\|xmlp\|xml\|another_cookiejar\|cache\|events\)@' src/import_map.json` prints nothing.
- `grep -rn 'from "semver/\|from "media_types/\|from "xmlp/\|from "xml/\|from "another_cookiejar/\|from "events/' src package/src tests tools --include=*.ts --include=*.js` prints nothing.
- `package/dist/bin/tools/x86_64/deno check --import-map src/import_map.json src/quarto.ts` passes (the semver call sites type-check against real types).
- The three new unit tests pass; `tests/smoke/manuscript/render-manuscript.test.ts`, `tests/smoke/jats/render-manuscript.test.ts`, `tests/smoke/website/drafts.test.ts`, `tests/smoke/ojs/dependency-traversal.test.ts`, `tests/smoke/check/check.test.ts`, `tests/smoke/extensions/` pass.
- A manuscript render's `*-meca.zip` contains a `manifest.xml` that starts with the XML declaration and the MECA doctype, and `meca validate` (when installed) accepts it.
- `quarto run --dev tools/check-runtime-boundary.ts` passes with the baseline unchanged: under PR 02's rules `semver`, `media_types`, `xml`, `xmlp` and `another_cookiejar` are not std, so `stdImportFiles` does not move; `Deno.` counts do not move either (`readSitemap` swaps `Deno.open` for `Deno.readTextFileSync`, one for one; the `deno-cri` JS files change only their `events` import), and the new test files contain no `Deno.`.
- `Bundle Test` (PR 00b gate) green on three OSes: the manuscript render writes the MECA manifest through `XMLBuilder`, the mermaid render drives `deno-cri` on `node:events`.

## Plan

### Task 1: `semver` → `npm:semver` behind `src/deno_ral/semver.ts`

**Files:**
- Create: `src/deno_ral/semver.ts`
- Modify: `src/import_map.json:40` (`semver/`)
- Modify: the 17 importer files listed in Files (plus `src/quarto.ts`)
- Test: `tests/unit/ral/semver.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/ral/semver.test.ts`:

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
import { assert, assertEquals } from "../../asserts.ts";
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

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/semver.test.ts`
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

- [ ] **Step 4: Re-vendor and run the test**

Run: `package/scripts/vendoring/update-lock.sh && cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/semver.test.ts`
Expected: `deno.lock updated; commit it with the import-map change.`, then `3 passed`. (Every import-map edit in this plan is followed by `update-lock.sh`: the dev launcher and the test runner use the cache `configure` populated from the frozen `deno.lock`, and the dev launcher passes `--cached-only`.)

- [ ] **Step 5: Point the 17 importer files (18 import lines) at the wrapper**

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

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/semver.test.ts smoke/check/check.test.ts $(find smoke/extensions -name '*.test.ts') $(find smoke/engine -name '*.test.ts')`
Expected: all passed (`check` prints tool versions through `satisfies`; extension install validates `quarto-required` through `Range`/`satisfies`/`coerce`; the engine tests go through `engine.ts:66` and `knitr.ts:144-156`).

Run: `QUARTO_VERSION_REQUIREMENT=">=1.4" package/dist/bin/quarto --version; QUARTO_VERSION_REQUIREMENT=">=100" package/dist/bin/quarto render tests/docs/minimal.qmd --to html; echo "exit=$?"`
Expected: `99.9.9`; then `ERROR: Quarto version 99.9.9 does not meet semver requirement >=100` and `exit=1` (`src/quarto.ts:62-70`).

- [ ] **Step 8: Commit**

```bash
git add src/import_map.json deno.lock src/deno_ral/semver.ts tests/unit/ral/semver.test.ts \
  src/quarto.ts src/project/project-environment-types.ts src/project/project-environment.ts \
  src/execute/jupyter/jupyter.ts src/execute/engine.ts src/command/render/render-files.ts \
  src/command/create/artifacts/artifact-shared.ts src/command/check/check.ts \
  src/command/use/commands/binder/binder-types.ts src/command/use/commands/binder/binder.ts \
  src/extension/extension.ts src/extension/types.ts src/core/cache/cache.ts src/core/git.ts \
  src/core/jupyter/jupyter.ts src/core/typst.ts src/core/knitr.ts
git commit -m "Replace deno.land/x/semver with npm:semver behind deno_ral/semver.ts

The wrapper carries a @ts-types directive for @types/semver so the 17
importing files stay type-checked. Default imports of SemVer become named
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

- [ ] **Step 3: Re-vendor, type-check and run the OJS tests**

Run: `package/scripts/vendoring/update-lock.sh && package/dist/bin/tools/x86_64/deno check --import-map src/import_map.json src/execute/ojs/extract-resources.ts && cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/ojs/dependency-traversal.test.ts smoke/render/render-ojs.test.ts`
Expected: `Check` line, then all passed (`dependency-traversal` renders a document whose OJS cells attach local files, which are inlined as data URLs with the looked-up mime type).

- [ ] **Step 4: Commit**

```bash
git add src/import_map.json deno.lock src/execute/ojs/extract-resources.ts
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
import { assertEquals } from "../../asserts.ts";
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

- [ ] **Step 5: Re-vendor, run the unit test and the sitemap smoke tests**

Run: `package/scripts/vendoring/update-lock.sh && cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/project/website-sitemap-parse.test.ts smoke/website/drafts.test.ts smoke/website/drafts-env.test.ts`
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
git add src/import_map.json deno.lock src/project/types/website/website-sitemap.ts tests/unit/project/website-sitemap-parse.test.ts
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
import { assertEquals } from "../../asserts.ts";
import { kMecaVersion, toXml } from "../../../src/project/types/manuscript/meca.ts";

// deno-lint-ignore require-await
unitTest("meca toXml - declaration, doctype, attributes, text, one item-metadata level, self-closing instance", async () => {
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
        metadata: { key: "value", other: "a<b" },
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
      <metadata metadata-name="other">a&lt;b</metadata>
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
Expected: FAIL. With the old `xml` package still mapped, the assertion fails on formatting differences (the old library's doctype and indentation) and on the metadata block (two nested `item-metadata` levels and only the last key), which is the point of pinning the new format.

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

In `toMecaXMLItem`, replace the metadata block (lines 77-94)

```ts
  if (item.metadata) {
    const metaValues: Record<string, unknown> = {};
    if (item.metadata) {
      for (const key of Object.keys(item.metadata)) {
        const value = item.metadata[key];
        metaValues["metadata"] = {
          ["@metadata-name"]: key,
          ["#text"]: value,
        };
      }
    }
    const itemMetadata = Object.keys(metaValues).length > 0
      ? {
        ["item-metadata"]: metaValues,
      }
      : undefined;

    xmlItem["item-metadata"] = itemMetadata;
  }
```
with
```ts
  if (item.metadata) {
    // one <item-metadata> with one <metadata> per key (MECA DTD); the previous
    // code nested <item-metadata> twice and kept only the last key
    const metadata = Object.entries(item.metadata).map(([key, value]) => ({
      ["@metadata-name"]: key,
      ["#text"]: value,
    }));
    xmlItem["item-metadata"] = metadata.length > 0 ? { metadata } : undefined;
  }
```

The rest of `toMecaXMLItem` stays as it is: `XMLBuilder` omits attributes and elements whose value is `undefined` (verified), so `"@media-type": item.instance.mediaType` behaves as before. No production caller passes `metadata` (`toMecaItem`, `manuscript-meca.ts:407`), so rendered manuscripts are unaffected by the metadata fix.

- [ ] **Step 5: Re-vendor and run the unit test**

Run: `package/scripts/vendoring/update-lock.sh && cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/project/manuscript-meca-xml.test.ts`
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
git add src/import_map.json deno.lock src/project/types/manuscript/meca.ts tests/unit/project/manuscript-meca-xml.test.ts
git commit -m "Replace deno.land/x/xml with fast-xml-parser for the MECA manifest

The XML declaration and the MECA doctype are written by hand; the
manifest tree is built by XMLBuilder with the same @attr/#text
conventions the previous library used. Item metadata is one
<item-metadata> level with one <metadata> per key."
```

### Task 5: `another_cookiejar` → `tough-cookie` behind a small fetch wrapper

**Files:**
- Modify: `src/import_map.json:39` (`another_cookiejar/`; adds `tough-cookie`)
- Create: `src/publish/rsconnect/api/cookie-fetch.ts`
- Modify: `src/publish/rsconnect/api/index.ts:8-9`
- Test: `tests/unit/publish/rsconnect-cookie-fetch.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/publish/rsconnect-cookie-fetch.test.ts` (the base fetch is a recorder, so no network or server is needed):

```ts
/*
 * rsconnect-cookie-fetch.test.ts
 *
 * The Posit Connect client keeps cookies across requests (sticky sessions
 * behind load balancers survive upload -> deploy -> task polling).
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { unitTest } from "../../test.ts";
import { assertEquals } from "../../asserts.ts";
import {
  FetchLike,
  fetchWithCookieJar,
} from "../../../src/publish/rsconnect/api/cookie-fetch.ts";

function recorder(setCookies: Record<string, string[]>) {
  const seen: Array<{ url: string; cookie: string | null; auth: string | null }> = [];
  const base: FetchLike = (url, init) => {
    const headers = new Headers(init?.headers);
    seen.push({ url, cookie: headers.get("cookie"), auth: headers.get("authorization") });
    const path = new URL(url).pathname;
    return Promise.resolve(
      new Response("{}", {
        headers: (setCookies[path] ?? []).map((c) => ["set-cookie", c] as [string, string]),
      }),
    );
  };
  return { seen, base };
}

unitTest("rsconnect cookie fetch - sends cookies set by earlier responses, by path", async () => {
  const { seen, base } = recorder({
    "/__api__/v1/content": ["AWSALB=abc; Path=/", "scoped=1; Path=/__api__/v1/tasks"],
  });
  const fetch = fetchWithCookieJar(undefined, base);
  const server = "https://connect.example.com";
  await fetch(`${server}/__api__/v1/content`, { method: "POST", headers: { Authorization: "Key k" } });
  await fetch(`${server}/__api__/v1/content/1/deploy`, { method: "POST", headers: { Authorization: "Key k" } });
  await fetch(`${server}/__api__/v1/tasks/7?wait=1`, { headers: { Authorization: "Key k" } });
  assertEquals(seen, [
    { url: `${server}/__api__/v1/content`, cookie: null, auth: "Key k" },
    { url: `${server}/__api__/v1/content/1/deploy`, cookie: "AWSALB=abc", auth: "Key k" },
    { url: `${server}/__api__/v1/tasks/7?wait=1`, cookie: "scoped=1; AWSALB=abc", auth: "Key k" },
  ]);
});

unitTest("rsconnect cookie fetch - a new jar starts empty and bad cookies are ignored", async () => {
  const { seen, base } = recorder({ "/a": ["bad=1; Domain=other.example.org"] });
  const first = fetchWithCookieJar(undefined, base);
  await first("https://connect.example.com/a");
  await first("https://connect.example.com/b");
  const second = fetchWithCookieJar(undefined, base);
  await second("https://connect.example.com/c");
  assertEquals(seen.map((s) => s.cookie), [null, null, null]);
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/publish/rsconnect-cookie-fetch.test.ts`
Expected: FAIL at type-check time, `Module not found ".../src/publish/rsconnect/api/cookie-fetch.ts"`.

- [ ] **Step 3: Change the import map and re-vendor**

Replace
```json
    "another_cookiejar/": "https://deno.land/x/another_cookiejar@v5.0.3/",
```
with
```json
    "tough-cookie": "npm:tough-cookie@6.0.2",
```
Run: `package/scripts/vendoring/update-lock.sh`
Expected: `deno.lock updated; commit it with the import-map change.`

- [ ] **Step 4: Implement the wrapper**

Create `src/publish/rsconnect/api/cookie-fetch.ts`:

```ts
/*
 * cookie-fetch.ts
 *
 * fetch with a cookie jar for the Posit Connect client: a Connect server
 * behind a load balancer may set a sticky-session cookie on one request and
 * expect it on the next (upload, deploy, task polling).
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { CookieJar } from "tough-cookie";

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export function fetchWithCookieJar(
  jar: CookieJar = new CookieJar(),
  baseFetch: FetchLike = (url, init) => fetch(url, init),
): FetchLike {
  return async (url: string, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    const cookie = await jar.getCookieString(url);
    if (cookie) {
      headers.set("cookie", cookie);
    }
    const response = await baseFetch(url, { ...init, headers });
    for (const setCookie of response.headers.getSetCookie()) {
      await jar.setCookie(setCookie, url, { ignoreError: true });
    }
    return response;
  };
}
```

- [ ] **Step 5: Use it in the client**

In `src/publish/rsconnect/api/index.ts` replace lines 8-9
```ts
import { wrapFetch } from "another_cookiejar/mod.ts";
const fetch = wrapFetch();
```
with
```ts
import { fetchWithCookieJar } from "./cookie-fetch.ts";
// one cookie jar per process, as with the previous another_cookiejar wrapper
const fetch = fetchWithCookieJar();
```
The `fetch(this.apiUrl(path), {...})` call at line 60 is unchanged. Leave the unused `cookies_` field (line 85) alone.

- [ ] **Step 6: Run the tests and type-check the publish code**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/publish/rsconnect-cookie-fetch.test.ts && cd .. && package/dist/bin/tools/x86_64/deno check --import-map src/import_map.json src/publish/rsconnect/api/index.ts src/publish/rsconnect/rsconnect.ts && package/dist/bin/quarto publish connect --help | head -3`
Expected: `2 passed`; `Check` lines; the first lines of the `quarto publish connect` help.

- [ ] **Step 7: Commit**

```bash
git add src/import_map.json deno.lock src/publish/rsconnect/api/cookie-fetch.ts src/publish/rsconnect/api/index.ts tests/unit/publish/rsconnect-cookie-fetch.test.ts
git commit -m "Keep the Connect cookie jar on tough-cookie instead of deno.land/x/another_cookiejar

Sticky-session cookies set by a load balancer in front of Connect must
survive upload, deploy and task polling."
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

- [ ] **Step 4: Re-vendor and render a mermaid diagram (deno-cri drives Chrome over CDP)**

Run: `package/scripts/vendoring/update-lock.sh && cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent docs/smoke-all/2026/02/12/mermaid-typst.qmd docs/smoke-all/2026/02/12/mermaid-multi-diagram.qmd`
Expected: all passed. These need a Chrome: run `package/dist/bin/quarto install chrome-headless-shell --no-prompt` first if `package/dist/bin/quarto check` reports `Chrome: (not detected)`. The Typst document is the gate: formats without a JavaScript runtime render mermaid to an image through `withCriClient` (`src/core/handlers/base.ts:146,180` → `src/core/cri/cri.ts`, headless Chrome over CDP; the format split is at `src/core/handlers/mermaid.ts:309`), and Typst is bundled with Quarto so no TinyTeX is needed. `mermaid-pdf-default.qmd` covers the same path for LaTeX if TinyTeX is installed.

- [ ] **Step 5: Commit**

```bash
git add src/import_map.json deno.lock src/core/cri/deno-cri/chrome.js src/core/cri/deno-cri/index.js src/core/cri/deno-cri/websocket-wrapper.js
git commit -m "Use node:events in deno-cri; drop unused cache import-map entry"
```

### Task 7: Ratchet and status

**Files:**
- Modify: `dev-docs/runtime-migration/README.md`

The `https://deno.land/std@...` redirect entries that `media_types` (`std@0.105.0/`) and `cache` (`std@0.91.0/*`) needed are not removed here: PR 07's last task removes every unused redirect once 03–07 have landed, with one `deno info` run over every entrypoint.

- [ ] **Step 1: Confirm the ratchet does not move**

Run: `package/dist/bin/quarto run --dev tools/check-runtime-boundary.ts`
Expected: `OK: no count exceeds the baseline.` and no `::notice::` line: under PR 02's rules none of the seven packages is std, `Deno.` counts are unchanged (see Acceptance criteria), and the five new tests contain no `Deno.`. A `::notice::` that a count fell means something else changed; a regression means a `Deno.` slipped into a new file.

- [ ] **Step 2: Set the PR 04 row to `in progress` and commit**

```bash
git add dev-docs/runtime-migration/README.md
git commit -m "runtime-migration: PR 04 in progress"
```

## Verification

```bash
rm -rf package/dist/bin/deno_cache && ./configure.sh        # frozen deno.lock; cache rebuilt without the seven packages
git status --short                                            # empty
grep -n 'deno.land/x' src/import_map.json                     # only cliffy, deno_dom, puppeteer remain
package/dist/bin/tools/x86_64/deno check --import-map src/import_map.json src/quarto.ts package/src/bld.ts
package/dist/bin/quarto check
cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent \
  unit/ral/semver.test.ts unit/project/website-sitemap-parse.test.ts unit/project/manuscript-meca-xml.test.ts \
  unit/publish/rsconnect-cookie-fetch.test.ts \
  smoke/check/check.test.ts $(find smoke/extensions -name '*.test.ts') $(find smoke/engine -name '*.test.ts') \
  smoke/ojs/dependency-traversal.test.ts smoke/render/render-ojs.test.ts \
  smoke/website/drafts.test.ts smoke/website/drafts-env.test.ts \
  smoke/manuscript/render-manuscript.test.ts smoke/jats/render-manuscript.test.ts
cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent \
  docs/smoke-all/2026/02/12/mermaid-typst.qmd docs/smoke-all/2026/02/12/mermaid-multi-diagram.qmd
package/dist/bin/quarto run --dev tools/check-runtime-boundary.ts   # OK, no ::notice:: (counts unchanged)
```

By hand, once, with a Connect server (record the result in the PR): `CONNECT_SERVER=<url> CONNECT_API_KEY=<key> package/dist/bin/quarto publish connect tests/docs/minimal.qmd --no-prompt` publishes and the deploy task completes.

On the PR: `Bundle Test` (PR 00b gate: three OSes, empty caches; the manuscript render writes the MECA manifest through `XMLBuilder`, the mermaid render drives `deno-cri` on `node:events`), `Smoke Tests`, `Runtime Boundary` green.

## Review checklist

- [ ] `src/deno_ral/semver.ts` is the only file importing `"semver"`, and it carries the `@ts-types` directive on the line directly above the export.
- [ ] The four former default imports of `SemVer` are named imports; no `new SemVer` call is left on a default import.
- [ ] `extract-resources.ts` uses `typeByExtension`, not `contentType` (no charset suffix in data URLs).
- [ ] `parseSitemap` handles the one-`<url>` case (object, not array) and skips entries without `lastmod`, matching the old SAX reader (`website-sitemap.ts:192-196`).
- [ ] `toXml` output starts with the declaration and the doctype on their own lines; item metadata is one `<item-metadata>` level with one `<metadata>` per key; the unit test pins the exact text.
- [ ] The rsconnect client uses `fetchWithCookieJar()` once per process; the wrapper sends stored cookies and stores every `Set-Cookie`, ignoring rejected ones.
- [ ] The three `deno-cri` files import `node:events` and nothing else changed in them.
- [ ] Every commit that changes `src/import_map.json` also commits `deno.lock`.
- [ ] No `https://deno.land/std@...` redirect key was touched (PR 07's last task owns them).
- [ ] Each task is its own commit.

## Risks and rollback

- `satisfies` semantics with prereleases: both libraries implement node-semver's rule (a prerelease only satisfies a range that names a prerelease on the same tuple). The dev build reports `99.9.9`, not a prerelease, so extension checks behave as before; the unit test pins it.
- The MECA manifest text changes (indentation, quoted doctype, self-closing `<instance/>`). The XML is semantically identical; `meca validate` in the manuscript smoke tests is the external check. Rollback: revert the Task 4 commit (restores the `xml/` entry).
- Connect publishing has no automated end-to-end test; the unit test covers the jar, the manual publish in Verification covers the server. The behaviour matches `another_cookiejar` (one jar per process, cookies sent by domain and path). Redirect responses that set cookies are not seen by the wrapper; Connect's API does not redirect.
- `fast-xml-parser` brings six small dependencies and `tough-cookie` brings `tldts`; all are pinned by `deno.lock` and bundled under the PR 00b gate.
- Each task is one commit; revert individually (each commit carries its `deno.lock` change).

## Decisions needed

None open. Recorded:
1. **Cookie jar for Posit Connect: kept** (review decision 5), on `tough-cookie` with a 30-line wrapper. Ask the Connect team whether a session cookie is ever needed; drop the jar later only if they confirm it is not.
2. **Layer tests live in `tests/unit/ral/`** (the existing directory; `_TEMPLATE.md` convention), so the semver contract test is `tests/unit/ral/semver.test.ts`.

Review items closed here: the MECA nesting expectation (fixed in code, pinned with two keys), the cookie jar (kept), the counts (17 semver files, six fast-xml-parser dependencies), the `deno info` entrypoints (the redirect cleanup moved to PR 07's last task with the full entrypoint list), the missing re-vendor step (every map edit is followed by `update-lock.sh`).
