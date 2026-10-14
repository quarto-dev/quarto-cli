# PR 22: Route direct std imports through `src/deno_ral/`; `tests/asserts.ts`

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `src/deno_ral/` the only place that imports Deno standard-library modules: add `colors.ts`, `flags.ts`, `dotenv.ts`, `crypto.ts`, `async.ts`, `datetime.ts`, `streams.ts`, `fmt.ts`, `media-types.ts`, extend `encoding.ts`, `io.ts`, `log.ts`, add `tests/asserts.ts`, and rewrite the `src/`, `package/src` and `tests/` files that import std specifiers directly (71 + 2 + 166 at the time of the inventory; PR 04 has since taken the 17 semver importers).
**Phase:** 1. **Depends on:** PR 04 (it created `src/deno_ral/semver.ts` on `npm:semver@7.8.5` and rewrote the 18 semver import lines, and moved `media_types` to `jsr:@std/media-types`), PR 02 (ratchet). **Unblocks:** PR 23, PR 24, PR 25, PR 31.
**Branch:** `rt/22-std-import-seams`.
**Suggested executor:** Sonnet. Every step is "add a re-export module, run a scripted specifier rewrite, type-check"; nothing to design.
**Size:** M by nature but L by file count: 12 new/extended layer files, 1 new test helper, 1 new tool script, ~220 files with a changed import line.
**Ships on:** Deno; the existing test suite must stay green.

## Spec

### Context

Assessment section 11, module plan row "`colors.ts`, `semver.ts`, `base64` in `encoding.ts`, `flags.ts`, `asserts` (tests)": the 71 files importing `fmt/colors` (27), `semver/mod.ts` (18), `encoding/base64` (12), `flags` (5), `io/*`, `fs/*`, `log`, `dotenv`, `crypto`, `async` directly follow the same convention as today, enforced instead of assumed; `tests/asserts.ts` fronts the 166 `testing/asserts` imports. Ground rule 2 of `README.md`: application code never imports the standard library directly.

Inventory on 2026-10-14 (`grep -rhoE 'from "(fs|path|io|log|fmt|encoding|async|streams|crypto|tar|uuid|datetime|dotenv|flags|bytes|semver|testing|yaml|http|media_types)(/[^"]*)?"' src package/src tests tools --include=*.ts | sort | uniq -c | sort -rn`), occurrences across all four trees, with the files outside `src/deno_ral/`:

| Specifier | Occurrences | Names imported | Files (outside `src/deno_ral/`) | Destination |
|---|---|---|---|---|
| `testing/asserts` | 166 | `assert` (122), `assertEquals` (86), `assertThrows` (6), `assertRejects` (4), `fail` (3), `AssertionError` (2), `assertStringIncludes`, `assertStrictEquals`, `assertNotEquals`, `assertFalse` (1 each); `* as _asserts` in `tests/test-deps.ts` | 157 files under `tests/`, `src/core/cache/cache.ts:9` | `tests/asserts.ts` (tests); local `assert` on `InternalError` (cache.ts) |
| `fmt/colors` | 29 | `* as colors` (28), `rgb24` (`src/core/text.ts`) | 26 `src/` files, `package/src/util/git.ts`, `tests/test.ts`, `tests/verify.ts` | new `src/deno_ral/colors.ts` |
| `semver/mod.ts` | 18 | default `SemVer` (4), `{ SemVer }` (2), `coerce`, `satisfies`, `valid`, `Range` (type and value) | 17 `src/` files | done by PR 04 (`src/deno_ral/semver.ts` over `npm:semver@7.8.5`, every importer rewritten); Task 3 step 2 only verifies |
| `encoding/base64` | 15 | `encodeBase64`, `decodeBase64` (with aliases); `encode as base64Encode` in the unreferenced `src/core/encode-metadata.ts` | 12 `src/` files, `tests/smoke/lua-unit/quarto-version-repr.test.ts`, julia subtree (skip) | existing `src/deno_ral/encoding.ts` |
| `encoding/hex` | 1 | `encodeHex` | `src/publish/common/publish.ts` | `encoding.ts` (extend) |
| `path` | 10 | `join`, `dirname`, `extname`, `fromFileUrl`, `resolve` | `tests/unit/chrome-launch{,-flags}.test.ts`, `tests/unit/chrome-launch-fixtures.ts`, `tests/smoke/engine/intermediate-output-markdown.test.ts`, `tests/smoke/render/placeholder-typst-text.test.ts`, `tests/smoke/render/render-html.test.ts`, `tests/smoke/jupyter/cache.test.ts`; `tests/smoke/build-ts-extension/src/test-engine.ts` (extension fixture, skip); julia subtree (skip) | existing `src/deno_ral/path.ts` |
| `yaml` | 6 | `Schema`, `types`, `Type`, `FAILSAFE_SCHEMA`, `load`, `dump` | `src/core/yaml.ts` | not std (`cdn.skypack.dev/js-yaml`, PR 03); out of scope |
| `io/write-all` | 5 | `writeAll`, `writeAllSync` | `src/command/capabilities/cmd.ts`, `src/core/download.ts`, `src/core/console.ts`, `src/core/deno/monkey-patch.ts`, `package/src/util/utils.ts` | `io.ts` (extend) |
| `flags` | 5 | `parse`, `Args` (type) | `src/quarto-core/profile.ts`, `src/command/render/latexmk/quarto-latexmk.ts`, `src/core/log.ts`, `src/core/main.ts` | new `src/deno_ral/flags.ts` |
| `log`, `log/logger`, `log/base-handler`, `log/file-handler` | 4+3 | `warn` (2), `LevelName`/`LogRecord` types, `BaseHandler`, `FileHandler` | `src/format/html/format-html-scss.ts`, `src/command/render/render-files.ts`, `src/core/log.ts` | existing `src/deno_ral/log.ts` (extend) |
| `io/read-lines`, `io/read-all`, `io/copy` | 3+2+1 | `readLines`, `readAllSync`, `copy` | `src/format/jats/format-jats-postprocess.ts`, `src/format/pdf/format-pdf.ts`, `src/core/console.ts`, `monkey-patch.ts` | `io.ts` (extend) |
| `fs/copy`, `fs/eol`, `fs/exists` | 1+1+1 | `copy`, `EOL`, `existsSync` | `src/command/dev-call/show-ast-trace/cmd.ts`, `tests/smoke/run/run-script.test.ts`, julia subtree (skip) | existing `src/deno_ral/fs.ts` |
| `dotenv`, `dotenv/stringify` | 2+1 | `load`, `LoadOptions` (type), `stringify` | `src/quarto-core/dotenv.ts`, `src/core/quarto.ts` | new `src/deno_ral/dotenv.ts` |
| `crypto/crypto` | 2 | `crypto` | `src/publish/common/publish.ts`, `src/core/hash.ts` | new `src/deno_ral/crypto.ts` |
| `async` | 2 | `MuxAsyncIterator`, `pooledMap` | `src/core/process.ts`, `src/preview/preview-server.ts` | new `src/deno_ral/async.ts` |
| `datetime/parse` | 1 | `parse` | `src/core/date.ts` | new `src/deno_ral/datetime.ts` |
| `streams/text-line-stream` | 1 | `TextLineStream` | `src/core/file.ts` | new `src/deno_ral/streams.ts` |
| `fmt/printf` | 1 | `sprintf` | `src/core/text.ts` | new `src/deno_ral/fmt.ts` |
| `media_types` (after PR 04: import-map key for `jsr:@std/media-types@1.1.0`) | 1 | `typeByExtension` | `src/execute/ojs/extract-resources.ts` | new `src/deno_ral/media-types.ts` (it is a std module now, so it gets a seam like the others) |
| `http/server.ts`, `http/file_server.ts` | 2 | commented-out lines | `tests/test-deps.ts:5-6` | delete the two comment lines |
| `tar/tar-stream`, `path/posix` | 1 each | — | only inside `src/deno_ral/` | already correct |

`tools/*.ts` has no std imports. The julia-engine subtree and the `build-ts-extension` fixture (`tests/smoke/build-ts-extension/src/test-engine.ts`, which is compiled by `quarto build-ts-extension` with the extension import map and must not reference `src/deno_ral`) are excluded.

PR 04 (`04-deps-deno-land-x-small.md`, Task 1) already created `src/deno_ral/semver.ts` (`// @ts-types="@types/semver"` + `export { coerce, Range, satisfies, SemVer, valid } from "semver";`) and rewrote the 18 import lines, so semver needs no work here beyond the verification grep. PR 04 also changed `src/execute/ojs/extract-resources.ts:15` to `import { typeByExtension } from "media_types";` with `"media_types": "jsr:@std/media-types@1.1.0"` in the import map; that is a std module imported outside the layer, so this PR fronts it with `src/deno_ral/media-types.ts`.

### Scope

In: the table rows with a destination; the rewrite tool `tools/rewrite-import-specifier.sh`; the ratchet baseline for "direct std imports" (`stdImportFiles`) dropping to 0 for `src/` (outside the layer), `package/src` and `tests/`.
Out: `yaml` (js-yaml from npm after PR 03, not std); semver (PR 04); the julia subtree; the `build-ts-extension` fixture; `cliffy/` imports (dependency, not std; stays as is per assessment section 11).

### Interfaces

New and extended layer modules (all re-exports; each file starts with the `Copyright (C) 2026 Posit Software, PBC` header, or keeps its existing header when extended):

```ts
// src/deno_ral/colors.ts
export * from "fmt/colors";                      // bold, red, blue, dim, italic, brightGreen, rgb24, ...

// src/deno_ral/media-types.ts
export { typeByExtension } from "media_types";

// src/deno_ral/flags.ts
export { parse } from "flags";
export type { Args } from "flags";

// src/deno_ral/dotenv.ts
export { load } from "dotenv";
export type { LoadOptions } from "dotenv";
export { stringify } from "dotenv/stringify";

// src/deno_ral/crypto.ts
export { crypto } from "crypto/crypto";

// src/deno_ral/async.ts
export { MuxAsyncIterator, pooledMap } from "async";

// src/deno_ral/datetime.ts
export { parse } from "datetime/parse";

// src/deno_ral/streams.ts
export { TextLineStream } from "streams/text-line-stream";

// src/deno_ral/fmt.ts
export { sprintf } from "fmt/printf";

// src/deno_ral/encoding.ts (extended)
export { decodeBase64, encodeBase64 } from "encoding/base64";
export { decodeHex, encodeHex } from "encoding/hex";

// src/deno_ral/io.ts (extended)
export { readAll, readAllSync } from "io/read-all";
export { readLines } from "io/read-lines";
export { writeAll, writeAllSync } from "io/write-all";
export { copy } from "io/copy";

// src/deno_ral/log.ts (extended)
export { debug, error, getLogger, info, LogLevels, setup, warn as warning } from "log";
export type { LevelName, LogRecord } from "log";
export { BaseHandler } from "log/base-handler";
export { FileHandler } from "log/file-handler";

// tests/asserts.ts
export {
  assert, assertEquals, assertFalse, assertMatch, assertNotEquals, assertObjectMatch,
  assertRejects, assertStrictEquals, assertStringIncludes, assertThrows, AssertionError, fail,
} from "testing/asserts";
```

Rewrite tool:

```bash
# tools/rewrite-import-specifier.sh <old-specifier> <replacement-relative-to-repo-root> [dir...]
# Rewrites `from "<old-specifier>"` in every .ts under the given dirs (default: src package/src tests)
# to a relative import of the replacement file. Skips src/deno_ral, extension subtrees, and
# tests/smoke/build-ts-extension. Prints the files it changed.
```

### Files

- Create: `src/deno_ral/colors.ts`, `flags.ts`, `dotenv.ts`, `crypto.ts`, `async.ts`, `datetime.ts`, `streams.ts`, `fmt.ts`, `media-types.ts`; `tests/asserts.ts`; `tools/rewrite-import-specifier.sh`.
- Modify: `src/deno_ral/encoding.ts`, `io.ts`, `log.ts`; `src/core/cache/cache.ts:9`; `src/core/encode-metadata.ts:6`; `tests/test-deps.ts:2,5-6`; every file in the table (import line only); `.claude/rules/typescript/deno-ral.md`; `tools/runtime-boundary-baseline.json`.

### Acceptance criteria

- `grep -rnE 'from "(fs|path|io|log|fmt|encoding|async|streams|crypto|tar|uuid|datetime|dotenv|flags|bytes|semver|testing|http|media_types)(/[^"]*)?"' src package/src tests tools --include=*.ts | grep -v '^src/deno_ral/' | grep -v extension-subtrees | grep -v 'tests/smoke/build-ts-extension/' | grep -v '^tests/asserts.ts'` prints nothing.
- `cd src && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --import-map=import_map.json quarto.ts` → exit 0.
- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/` → pass (type-checks every unit test file against `tests/asserts.ts`); `smoke/render/render-html.test.ts smoke/run/run-script.test.ts smoke/lua-unit/` → pass.
- `package/src/quarto-bld --help` → works.
- Ratchet "direct std imports" count is 0 for `src/`, `package/src`, `tests/`; baseline committed.

## Plan

### Task 1: The rewrite tool

**Files:**
- Create: `tools/rewrite-import-specifier.sh`

- [ ] **Step 1: Write it**

```bash
#!/usr/bin/env bash
# rewrite-import-specifier.sh
#
# Copyright (C) 2026 Posit Software, PBC
#
# Usage: tools/rewrite-import-specifier.sh <old-specifier> <replacement-path> [dir ...]
#   old-specifier     exact module specifier as written in import statements, e.g. fmt/colors
#   replacement-path  repo-relative path of the module to import instead, e.g. src/deno_ral/colors.ts
#   dir ...           directories to scan (default: src package/src tests)
# Rewrites every `from "<old-specifier>"` into a relative import of <replacement-path>.
# Skips src/deno_ral, extension subtrees and the build-ts-extension fixture.
set -euo pipefail
old="$1"; shift
new="$1"; shift
dirs=("$@"); [[ ${#dirs[@]} -eq 0 ]] && dirs=(src package/src tests)

grep -rl --include='*.ts' "from \"${old}\"" "${dirs[@]}" \
  | grep -v '^src/deno_ral/' \
  | grep -v 'extension-subtrees' \
  | grep -v '^tests/smoke/build-ts-extension/' \
  | sort -u \
  | while read -r f; do
      rel=$(python3 -c "import os,sys; print(os.path.relpath(sys.argv[1], os.path.dirname(sys.argv[2])))" "$new" "$f")
      case "$rel" in ../*) ;; *) rel="./$rel" ;; esac
      # GNU sed; on macOS install gsed or run with: sed -i '' ...
      sed -i "s#from \"${old}\"#from \"${rel}\"#g" "$f"
      echo "$f"
    done
```

```bash
chmod +x tools/rewrite-import-specifier.sh
```

- [ ] **Step 2: Dry check on one specifier without writing**

Run: `grep -rl --include='*.ts' 'from "fmt/printf"' src | grep -v '^src/deno_ral/'`
Expected: `src/core/text.ts`.

- [ ] **Step 3: Commit**

```bash
git add tools/rewrite-import-specifier.sh
git commit -m "tools: add rewrite-import-specifier.sh for routing std imports through deno_ral"
```

### Task 2: New and extended layer modules

**Files:** the nine new `src/deno_ral/*.ts`, extended `encoding.ts`, `io.ts`, `log.ts`

- [ ] **Step 1: Create the nine new modules (`colors`, `flags`, `dotenv`, `crypto`, `async`, `datetime`, `streams`, `fmt`, `media-types`) with exactly the exports from Interfaces**, each starting with:

```ts
/*
 * <name>.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 */
```

followed by the re-export lines shown in Interfaces for that module.

- [ ] **Step 2: Extend `encoding.ts`, `io.ts`, `log.ts`** to the export lists in Interfaces (keep their existing headers; `fs.ts` and `io.ts` carry a copy-pasted `encoding.ts` title line in their headers, fix the title to the file name while there).

- [ ] **Step 3: Type-check the layer**

Run: `cd src && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --import-map=import_map.json deno_ral/*.ts`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/deno_ral
git commit -m "deno_ral: colors, flags, dotenv, crypto, async, datetime, streams, fmt, media-types seams; extend encoding, io, log"
```

### Task 3: Rewrite `src/` and `package/src`

Each step: run the tool, then type-check. Expected file lists are from the inventory; a different list means the branch drifted, which is fine as long as the type-check passes.

- [ ] **Step 1: colors**

```bash
tools/rewrite-import-specifier.sh fmt/colors src/deno_ral/colors.ts src package/src
```

Expected: 27 files printed (26 `src/` + `package/src/util/git.ts`). `src/core/text.ts` keeps `import { rgb24 } from "./../deno_ral/colors.ts"`-style imports working since `colors.ts` re-exports everything.

- [ ] **Step 2: semver (verification only) and media-types**

Run: `grep -rn 'from "semver' src package/src tests --include=*.ts | grep -v '^src/deno_ral/semver.ts'`
Expected: nothing (PR 04 rewrote every importer to `src/deno_ral/semver.ts`). If a line appears, PR 04 missed it: rewrite that one import to the relative path of `src/deno_ral/semver.ts` by hand and mention it in the PR.

```bash
tools/rewrite-import-specifier.sh media_types src/deno_ral/media-types.ts src
```

Expected: `src/execute/ojs/extract-resources.ts`.

- [ ] **Step 3: base64 and hex**

```bash
tools/rewrite-import-specifier.sh encoding/base64 src/deno_ral/encoding.ts src
tools/rewrite-import-specifier.sh encoding/hex src/deno_ral/encoding.ts src
```

Expected: 12 + 1 files. Then fix the unreferenced `src/core/encode-metadata.ts:6` by hand (its `encode` name does not exist in `@std/encoding` 1.x):

```ts
import { encodeBase64 as base64Encode } from "../deno_ral/encoding.ts";
```

- [ ] **Step 4: flags, dotenv, crypto, async, datetime, streams, printf**

```bash
tools/rewrite-import-specifier.sh flags src/deno_ral/flags.ts src
tools/rewrite-import-specifier.sh dotenv src/deno_ral/dotenv.ts src
tools/rewrite-import-specifier.sh dotenv/stringify src/deno_ral/dotenv.ts src
tools/rewrite-import-specifier.sh crypto/crypto src/deno_ral/crypto.ts src
tools/rewrite-import-specifier.sh async src/deno_ral/async.ts src
tools/rewrite-import-specifier.sh datetime/parse src/deno_ral/datetime.ts src
tools/rewrite-import-specifier.sh streams/text-line-stream src/deno_ral/streams.ts src
tools/rewrite-import-specifier.sh fmt/printf src/deno_ral/fmt.ts src
```

Expected: 4, 2, 1, 2, 2, 1, 1, 1 files. `src/quarto-core/dotenv.ts` ends up with two import lines from `../deno_ral/dotenv.ts`; merge them into one by hand:

```ts
import { load, stringify } from "../deno_ral/dotenv.ts";
```

- [ ] **Step 5: io**

```bash
tools/rewrite-import-specifier.sh io/write-all src/deno_ral/io.ts src package/src
tools/rewrite-import-specifier.sh io/read-lines src/deno_ral/io.ts src
tools/rewrite-import-specifier.sh io/read-all src/deno_ral/io.ts src
tools/rewrite-import-specifier.sh io/copy src/deno_ral/io.ts src
```

Expected: 5, 2, 1, 1 files. `src/core/console.ts` and `src/core/deno/monkey-patch.ts` get two lines from the same module; merge each by hand (`monkey-patch.ts` is deleted by PR 25; merging now keeps lint quiet in between).

- [ ] **Step 6: log**

```bash
tools/rewrite-import-specifier.sh log/logger src/deno_ral/log.ts src
tools/rewrite-import-specifier.sh log/base-handler src/deno_ral/log.ts src
tools/rewrite-import-specifier.sh log/file-handler src/deno_ral/log.ts src
```

Expected: `src/core/log.ts` three times; merge its now four imports from `../deno_ral/log.ts` into:

```ts
import * as log from "../deno_ral/log.ts";
import {
  BaseHandler,
  debug,
  error,
  FileHandler,
  getLogger,
  LogRecord,
  setup,
  warning,
} from "../deno_ral/log.ts";
```

(`LogRecord` is a type; with `verbatimModuleSyntax` off in `deno.jsonc` a plain import is accepted, matching the file's current style.)

Then the two `warn` users, by hand:

`src/format/html/format-html-scss.ts:64` → `import { warning as warn } from "../../deno_ral/log.ts";`
`src/command/render/render-files.ts:120` → `import { warning as warn } from "../../deno_ral/log.ts";`

- [ ] **Step 7: fs/copy and the cache.ts assert**

```bash
tools/rewrite-import-specifier.sh fs/copy src/deno_ral/fs.ts src
```

Expected: `src/command/dev-call/show-ast-trace/cmd.ts`.

`src/core/cache/cache.ts:9`: replace `import { assert } from "testing/asserts";` with

```ts
import { InternalError } from "../lib/error.ts";

function assert(condition: unknown, msg = "Assertion failed"): asserts condition {
  if (!condition) {
    throw new InternalError(msg);
  }
}
```

(place the function after the imports; `assert(result.type === "string-immediate", "Expected string")` call sites keep working).

- [ ] **Step 8: Type-check and run a render**

Run: `cd src && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --import-map=import_map.json quarto.ts` → exit 0.
Run: `package/src/quarto-bld --help | head -3` → command list.
Run: `grep -rnE 'from "(fs|path|io|log|fmt|encoding|async|streams|crypto|datetime|dotenv|flags|semver|testing|media_types)(/[^"]*)?"' src package/src --include=*.ts | grep -v '^src/deno_ral/' | grep -v extension-subtrees` → nothing.
Run: `package/dist/bin/quarto render tests/docs/smoke-all/2023/05/24/5657-raw.qmd` → renders.

- [ ] **Step 9: Commit**

```bash
git add src package/src
git commit -m "route every direct std import in src/ and package/src through src/deno_ral"
```

### Task 4: `tests/asserts.ts` and the test tree

**Files:**
- Create: `tests/asserts.ts`
- Modify: 157 test files, `tests/test-deps.ts`, `tests/smoke/run/run-script.test.ts`, 6 `path` importers

- [ ] **Step 1: Create `tests/asserts.ts`**

```ts
/*
 * asserts.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 *
 * The only test-side import of the assertion library. PR 31 swaps the
 * re-export target for the Node harness without touching test files.
 */

export {
  assert,
  assertEquals,
  assertFalse,
  assertMatch,
  assertNotEquals,
  assertObjectMatch,
  assertRejects,
  assertStrictEquals,
  assertStringIncludes,
  assertThrows,
  AssertionError,
  fail,
} from "testing/asserts";
```

- [ ] **Step 2: Rewrite the test tree**

```bash
tools/rewrite-import-specifier.sh testing/asserts tests/asserts.ts tests | wc -l
tools/rewrite-import-specifier.sh fmt/colors src/deno_ral/colors.ts tests
tools/rewrite-import-specifier.sh encoding/base64 src/deno_ral/encoding.ts tests
tools/rewrite-import-specifier.sh fs/eol src/deno_ral/fs.ts tests
tools/rewrite-import-specifier.sh path src/deno_ral/path.ts tests
```

Expected: `157`; then 2 (`tests/test.ts`, `tests/verify.ts`); 1 (`tests/smoke/lua-unit/quarto-version-repr.test.ts`); 1 (`tests/smoke/run/run-script.test.ts`); 6 (the `path` importers; the build-ts-extension fixture is skipped by the tool).

Then `tests/test-deps.ts` by hand: line 2 becomes `import * as _asserts from "./asserts.ts";` and delete lines 5–6 (the commented `http/` imports).

- [ ] **Step 3: Type-check all test files**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/`
Expected: every unit test compiles and passes (`--check` is on in `run-tests.sh`).
Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/run/run-script.test.ts smoke/lua-unit/ smoke/render/render-html.test.ts smoke/jupyter/cache.test.ts` → pass.
Run: `grep -rnE 'from "(fs|path|io|log|fmt|encoding|testing)(/[^"]*)?"' tests --include=*.ts | grep -v '^tests/asserts.ts' | grep -v build-ts-extension` → nothing.

- [ ] **Step 4: Commit**

```bash
git add tests
git commit -m "tests: assertions through tests/asserts.ts; std imports through src/deno_ral"
```

### Task 5: Ratchet and docs

- [ ] **Step 1:** `quarto run --dev tools/check-runtime-boundary.ts --update-baseline` → "direct std imports" is 0 for every scope; the `Deno.*` counts are unchanged.
- [ ] **Step 2:** In `.claude/rules/typescript/deno-ral.md`, add rows for `colors.ts`, `flags.ts`, `dotenv.ts`, `crypto.ts`, `async.ts`, `datetime.ts`, `streams.ts`, `fmt.ts`, `media-types.ts` (and `semver.ts` if PR 04 did not add it), extend the `encoding.ts`/`io.ts`/`log.ts` rows, and add under "Why Use deno_ral": `Tests import assertions from tests/asserts.ts, never from testing/asserts.`
- [ ] **Step 3: Commit**

```bash
git add tools/runtime-boundary-baseline.json .claude/rules/typescript/deno-ral.md
git commit -m "ratchet: direct std imports at zero; document the new deno_ral seams"
```

## Verification

- Acceptance grep → empty.
- `deno check` of `src/quarto.ts` → exit 0; `quarto-bld --help` → works.
- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/` → pass; the smoke subset in Task 4 step 3 → pass.
- `quarto run --dev tools/check-runtime-boundary.ts` → passes with std-import counts at 0.

## Review checklist

- [ ] Only import lines changed in the ~240 rewritten files (`git diff --stat` shows 1–2 lines per file; `git diff -U0 -- tests src | grep '^[-+]' | grep -v '^[-+][-+]' | grep -v 'import\|from \|^[-+]$' ` is empty except for `cache.ts`, `log.ts`, `dotenv.ts`, `console.ts`, `encode-metadata.ts`, `test-deps.ts`).
- [ ] `tests/asserts.ts` exports the twelve names in the vocabulary.
- [ ] No semver importer outside `src/deno_ral/semver.ts` (PR 04's work intact).
- [ ] No std import remains in `tools/`, `package/src`, `tests/` (outside `tests/asserts.ts`) or `src/` (outside `src/deno_ral/`).
- [ ] The build-ts-extension fixture and the julia subtree are untouched.

## Risks and rollback

- Relative-path mistakes are caught by `--check` in every test run and by `deno check` of `src/quarto.ts`.
- macOS `sed -i` syntax differs; run the tool on Linux or with GNU sed (`brew install gnu-sed`, use `gsed`).
- Rollback: revert the five commits; the tool is self-contained.

## Decisions needed

None.
