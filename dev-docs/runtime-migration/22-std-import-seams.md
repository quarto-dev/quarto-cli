# PR 22: `colors`, `flags` and `encoding` seams in `src/deno_ral/`; the import map is the seam for the other std modules

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route the three std modules that need a Quarto-owned seam (`fmt/colors`, `flags`, `encoding/base64`+`hex`) through `src/deno_ral/` in `src/` and `package/src`, add the `tools/rewrite-import-specifier.sh` tool PR 23 reuses, and record, for every other std module, why the import-map key is its seam and which plan reimplements the ones that call `Deno.*` internally.
**Phase:** 1 (lands right after PR 08). **Depends on:** PR 04 (`src/deno_ral/semver.ts` and the semver importers), PR 02 (ratchet). **Unblocks:** PR 23 (rewrite tool), PR 24, PR 25.
**Branch:** `rt/22-std-import-seams`.
**Suggested executor:** Sonnet. Two new re-export modules, one extended, a scripted specifier rewrite and a type-check; nothing to design.
**Size:** M. 3 layer files, 1 tool script, 44 import lines in `src/` and `package/src` (29 `fmt/colors` including the two `jsr:` URLs, 3 `flags`, 12 `encoding`), the rules doc and the baseline.
**Ships on:** Deno; the existing test suite must stay green.

## Spec

### Context

Assessment section 11, module plan row "`colors.ts`, `semver.ts`, `base64` in `encoding.ts`, `flags.ts`, `asserts` (tests)". The review (section 4, PR 22; S1) found the first draft's eleven re-export files of little value: the import map already maps every bare std specifier (`fmt/`, `log`, `io/`, …) in one place, and PR 26's resolver maps the same keys for Node. A seam file is worth having only where Quarto expects to change the implementation or its behaviour on Node, and the real Phase 3 risk is std modules that call `Deno.*` at runtime, which no re-export fixes.

So this PR keeps three seams:

| Seam | Importers today (`main` at `b86f98d`) | Why a Quarto file |
|---|---|---|
| `src/deno_ral/colors.ts` (`fmt/colors`) | 26 in `src/`, `package/src/util/git.ts`; plus `package/src/common/import-report/find-bad-imports.ts:2` and `find-bad-types-constants.ts:2` through a pinned `jsr:/@std/fmt@^0.224.0/colors` URL | `@std/fmt/colors` decides colour from `globalThis.Deno?.noColor` (`colors.ts:58` at 1.0.6), which does not exist on Node: colours would ignore `NO_COLOR` there. PR 27b adds `setColorEnabled(!noColor())` in this one file. |
| `src/deno_ral/flags.ts` (`flags`) | `src/quarto-core/profile.ts`, `src/core/log.ts`, `src/core/main.ts` (and `src/command/render/latexmk/quarto-latexmk.ts`, deleted by PR 39, decision 9) | `@std/flags` is deprecated in favour of `@std/cli`'s `parseArgs`; one file to switch. |
| `src/deno_ral/encoding.ts` (`encoding/base64`, `encoding/hex`), already exists with base64 | 12 files in `src/` | Node has native base64/hex (`Buffer`, `Uint8Array.fromBase64`); one file to switch, and the unreferenced `src/core/encode-metadata.ts:6` imports a name (`encode`) that `@std/encoding` 1.x no longer has. |
| `src/deno_ral/semver.ts` | done by PR 04 | verified here only |

Every other std module stays behind its import-map key, which is its seam (PR 26's `tools/node-bundle/import-map.mjs` resolves the same keys to `@jsr/std__*` on Node). The table below is the inventory PR 25's hidden-dependency check reads, and the source of the std boundary rule's allow-list: PR 02's scanner (`kStdAllowListed`, `02-runtime-boundary-check.md` "The std boundary rule") does not count a direct import of a row whose owner is "import map"; every other std import counts, including `log/file-handler` and `dotenv` (`load`). A change to the "Owner" column of a row is mirrored in `kStdAllowListed` in the same PR.

| Import-map key | Runtime `Deno.*` inside the std module? | Owner |
|---|---|---|
| `log`, `log/logger`, `log/base-handler` | no | import map |
| `log/file-handler` | yes: `FileHandler.setup()` calls `Deno.openSync` | PR 20b (own `FileHandler` in `deno_ral/log.ts`) |
| `dotenv` (`load`) | yes: `Deno.readTextFile`, `Deno.errors.NotFound`, and `parse()`'s `${VAR}` expansion reads `Deno.env.get` | PR 20b (own `loadDotenv`/`parseDotenv` in `src/quarto-core/dotenv.ts`) |
| `dotenv/stringify` | no | import map |
| `io/read-lines` with `Deno.stdin` (`src/command/create/cmd.ts:259`) | the call site passes `Deno.stdin` | PR 08 (`readStdinLines()`) |
| `io/read-all`, `io/write-all`, `io/copy`, `io/read-lines` (other readers) | no (only JSDoc mentions `Deno`) | import map |
| `fmt/printf` | `Deno.inspect` for `%i`/`%I` and in its bad-argument message; Quarto's only use is `sprintf("%<n>d: ", …)` (`src/core/text.ts:79`) | import map; listed in PR 25's inventory as a known non-issue |
| `async`, `crypto/crypto`, `datetime/parse`, `streams/text-line-stream`, `media_types` | no | import map |
| `path`, `fs/*` | `fs/*` is all `Deno.*` | `src/deno_ral/path.ts`, `fs.ts` already; `fs.ts` on `node:fs` is PR 27 |
| `testing/asserts` | no | `tests/asserts.ts` (PR 02); the test tree migrates in PR 23; `src/core/cache/cache.ts:9` gets a local `assert` in PR 18 |

### Scope

In: `src/deno_ral/colors.ts`, `src/deno_ral/flags.ts`, `encoding.ts` extended with hex; rewriting the 44 importers in `src/` and `package/src` (the two `jsr:` URLs included); fixing `encode-metadata.ts`; `tools/rewrite-import-specifier.sh`; rules doc; baseline.
Out: `tests/asserts.ts` and every test file (PR 02 adds the seam, PR 23 migrates the tests); seams for the import-map-only modules above; `quarto-latexmk.ts` (PR 39 deletes it); `yaml` (js-yaml, PR 03); the julia subtree; the `build-ts-extension` fixture.

### Interfaces

```ts
// src/deno_ral/colors.ts (new)
export * from "fmt/colors"; // bold, red, blue, dim, italic, brightGreen, rgb24, stripAnsiCode, setColorEnabled, ...

// src/deno_ral/flags.ts (new)
export { parse } from "flags";
export type { Args } from "flags";

// src/deno_ral/encoding.ts (extended)
export { decodeBase64, encodeBase64 } from "encoding/base64";
export { decodeHex, encodeHex } from "encoding/hex";
```

Rewrite tool:

```bash
# tools/rewrite-import-specifier.sh <old-specifier> <replacement-relative-to-repo-root> [dir...]
# Rewrites `from "<old-specifier>"` in every .ts under the given dirs (default: src package/src tests)
# to a relative import of the replacement file. Skips src/deno_ral, extension subtrees, and
# tests/smoke/build-ts-extension. Prints the files it changed.
```

### Files

- Create: `src/deno_ral/colors.ts`, `src/deno_ral/flags.ts`, `tools/rewrite-import-specifier.sh`.
- Modify: `src/deno_ral/encoding.ts`; `src/core/encode-metadata.ts:6`; the 44 importer files (import line only); `package/src/common/import-report/find-bad-imports.ts:2`, `find-bad-types-constants.ts:2`; `.claude/rules/typescript/deno-ral.md`; `tools/runtime-boundary-baseline.json`.

### Acceptance criteria

- `grep -rnE 'from "(fmt/colors|flags|encoding/base64|encoding/hex|semver[^"]*)"' src package/src --include=*.ts | grep -v '^src/deno_ral/' | grep -v extension-subtrees | grep -v 'render/latexmk/quarto-latexmk.ts'` prints nothing.
- `grep -rn 'from "jsr:\|from "https://deno.land/std' package/src --include=*.ts` prints nothing.
- `cd src && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --import-map=import_map.json quarto.ts` → exit 0; `package/src/quarto-bld --help` → command list.
- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent $(find unit/ -name '*.test.ts') smoke/render/render-html.test.ts` passes.
- Ratchet: `src` std-import files lower by the number of files whose only counted std imports were these three (the tool prints it; allow-listed imports such as `io/*` or `async` in the same file do not keep it counted), `package/src` std-import files from 3 to 0 (`find-bad-imports.ts`, `find-bad-types-constants.ts`, `util/git.ts`; `util/utils.ts`'s `io/write-all` is allow-listed and PR 24 converts it anyway); `Deno.` counts unchanged; baseline committed.

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

grep -rlF --include='*.ts' "from \"${old}\"" "${dirs[@]}" \
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

(`grep -F` so specifiers with `/` or `.` match literally; the `sed` pattern uses `#` delimiters, so specifiers must not contain `#`.)

- [ ] **Step 2: Dry check without writing**

Run: `grep -rlF --include='*.ts' 'from "flags"' src package/src | grep -v '^src/deno_ral/' | sort`
Expected: `src/command/render/latexmk/quarto-latexmk.ts`, `src/core/log.ts`, `src/core/main.ts`, `src/quarto-core/profile.ts`.

- [ ] **Step 3: Commit**

```bash
git add tools/rewrite-import-specifier.sh
git commit -m "tools: add rewrite-import-specifier.sh for routing std imports through deno_ral"
```

### Task 2: The three seams

**Files:** `src/deno_ral/colors.ts`, `src/deno_ral/flags.ts`, `src/deno_ral/encoding.ts`

- [ ] **Step 1: Create `colors.ts` and `flags.ts`**

```ts
/*
 * colors.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 *
 * Terminal colours. @std/fmt/colors decides whether to colour from
 * globalThis.Deno?.noColor; PR 27b makes this file call
 * setColorEnabled(!noColor()) so NO_COLOR is honoured on Node too.
 */

export * from "fmt/colors";
```

```ts
/*
 * flags.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 *
 * Command-line flag parsing (@std/flags, deprecated upstream in favour of
 * @std/cli parseArgs; switch here).
 */

export { parse } from "flags";
export type { Args } from "flags";
```

- [ ] **Step 2: Extend `encoding.ts`**

```ts
/*
 * encoding.ts
 *
 * Copyright (C) 2020-2024 Posit Software, PBC
 */

export { decodeBase64, encodeBase64 } from "encoding/base64";
export { decodeHex, encodeHex } from "encoding/hex";
```

(`fs.ts` and `io.ts` carry a copy-pasted `encoding.ts` title line in their headers; fix the title to the file name while here.)

- [ ] **Step 3: Type-check the layer**

Run: `cd src && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --import-map=import_map.json deno_ral/colors.ts deno_ral/flags.ts deno_ral/encoding.ts`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/deno_ral/colors.ts src/deno_ral/flags.ts src/deno_ral/encoding.ts src/deno_ral/fs.ts src/deno_ral/io.ts
git commit -m "deno_ral: colors and flags seams; hex in encoding"
```

### Task 3: Rewrite `src/` and `package/src`

- [ ] **Step 1: colors**

```bash
tools/rewrite-import-specifier.sh fmt/colors src/deno_ral/colors.ts src package/src
tools/rewrite-import-specifier.sh 'jsr:/@std/fmt@^0.224.0/colors' src/deno_ral/colors.ts package/src
```

Expected: 27 files printed by the first command (26 `src/` + `package/src/util/git.ts`), 2 by the second (`find-bad-imports.ts`, `find-bad-types-constants.ts`). `src/core/text.ts` keeps `import { rgb24 } from "../deno_ral/colors.ts"`-style imports working since `colors.ts` re-exports everything.

- [ ] **Step 2: flags**

```bash
tools/rewrite-import-specifier.sh flags src/deno_ral/flags.ts src
git checkout -- src/command/render/latexmk/quarto-latexmk.ts
```

Expected: 4 files printed; the standalone `quarto-latexmk.ts` entry is restored (PR 39 deletes it; decision 9).

- [ ] **Step 3: base64 and hex**

```bash
tools/rewrite-import-specifier.sh encoding/base64 src/deno_ral/encoding.ts src
tools/rewrite-import-specifier.sh encoding/hex src/deno_ral/encoding.ts src
```

Expected: 11 + 1 files (`encode-metadata.ts` among the 11; `publish.ts` is the hex one). Then fix the name in the unreferenced `src/core/encode-metadata.ts:6` by hand (`encode` does not exist in `@std/encoding` 1.x):

```ts
import { encodeBase64 as base64Encode } from "../deno_ral/encoding.ts";
```

- [ ] **Step 4: semver (verification only)**

Run: `grep -rn 'from "semver' src package/src --include=*.ts | grep -v '^src/deno_ral/semver.ts'`
Expected: nothing (PR 04 rewrote every importer). If a line appears, PR 04 missed it: rewrite that import to the relative path of `src/deno_ral/semver.ts` and mention it in the PR.

- [ ] **Step 5: Type-check and render**

Run: `cd src && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --import-map=import_map.json quarto.ts` → exit 0.
Run: `package/dist/bin/tools/x86_64/deno check --unstable-kv --import-map=src/import_map.json package/src/bld.ts package/src/common/import-report/find-bad-imports.ts package/src/common/import-report/find-bad-types-constants.ts` → exit 0.
Run: `package/src/quarto-bld --help | head -3` → command list.
Run: the first acceptance grep → nothing.
Run: `package/dist/bin/quarto render tests/docs/minimal.qmd --to html` → renders.

- [ ] **Step 6: Commit**

```bash
git add src package/src
git commit -m "route fmt/colors, flags and encoding imports through src/deno_ral"
```

### Task 4: Ratchet and docs

- [ ] **Step 1:** `quarto run --dev tools/check-runtime-boundary.ts --update-baseline` → std-import counts lower for `src` and `package/src` (`package/src` to 0); `Deno.` counts unchanged.
- [ ] **Step 2:** In `.claude/rules/typescript/deno-ral.md`, add rows for `colors.ts`, `flags.ts` (and `semver.ts` if PR 04 did not add it), extend the `encoding.ts` row with `decodeHex`, `encodeHex`, and add under "Why Use deno_ral": `Other std modules are imported by their import-map key (log, io/*, async, crypto, datetime, streams, dotenv/stringify, fmt/printf, media_types): the import map is their seam, and the runtime boundary ratchet (tools/check-runtime-boundary.ts, kStdAllowListed) does not count them. Do not import @std/log's FileHandler or @std/dotenv's load (they call Deno.* internally; the ratchet counts them): use deno_ral/log.ts FileHandler and quarto-core/dotenv.ts (PR 20b).`
- [ ] **Step 3: Commit**

```bash
git add tools/runtime-boundary-baseline.json .claude/rules/typescript/deno-ral.md
git commit -m "ratchet after the std seams; document which std modules have a seam"
```

## Verification

- Acceptance greps → empty.
- `deno check` of `src/quarto.ts` and the `package/src` entries → exit 0; `quarto-bld --help` → works.
- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent $(find unit/ -name '*.test.ts') smoke/render/render-html.test.ts` → pass.
- `quarto run --dev tools/check-runtime-boundary.ts` → passes at the new baseline.

## Review checklist

- [ ] Only import lines changed in the rewritten files (`git diff -U0 -- src package/src | grep '^[-+]' | grep -v '^[-+][-+]' | grep -v 'import\|from \|^[-+]$'` is empty except for `encode-metadata.ts`).
- [ ] Every import that changed keeps its original names and type-only status (an `import type` stays `import type`; PR 02b forbids value imports of types).
- [ ] No semver importer outside `src/deno_ral/semver.ts` (PR 04's work intact).
- [ ] `quarto-latexmk.ts`, the build-ts-extension fixture and the julia subtree are untouched.
- [ ] The inventory table in this plan matches what PR 20b and PR 08 actually replace, and its "import map" rows equal PR 02's `kStdAllowListed` (with `log/file-handler` in `kStdCountedExceptions`).

## Risks and rollback

- Relative-path mistakes are caught by `deno check` of `src/quarto.ts` and the `package/src` entries.
- macOS `sed -i` syntax differs; run the tool on Linux or with GNU sed (`brew install gnu-sed`, use `gsed`).
- Rollback: revert the four commits; the tool is self-contained.

## Decisions needed

None. Not changed because: the first draft's other eight seams (`dotenv`, `crypto`, `async`, `datetime`, `streams`, `fmt`, `media-types`, extended `io`/`log`) were re-exports that only moved specifiers across ~240 files; the import map already is that seam, and the two modules with internal `Deno.*` among them are reimplemented in PR 20b, not re-exported.
