# PR 00b: Commit `deno.lock`, run frozen, and gate the release bundle on three OSes

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every module the dev launcher, the build (`quarto-bld`, the esbuild bundle) and the test dependencies resolve is pinned in a committed `deno.lock` that `configure` and CI use with `--frozen`, and a `Bundle Test` job proves on Linux, macOS and Windows that the release bundle runs from an empty `DENO_DIR` with `--cached-only`, imports no external `npm:`/`jsr:`/`http(s):` module, and renders HTML, a website, OJS, mermaid and a manuscript.
**Phase:** 0, before PR 03. **Depends on:** 02 (landing order), 00a (the lockfile is written by the Deno version it will be read by). **Unblocks:** 03, 04, 05, 06, 07 (each changes `src/import_map.json` and updates `deno.lock` in the same PR; the gate is their release check).
**Branch:** `rt/00b-lockfile-and-bundle-gate`.
**Suggested executor:** Opus. Shell, batch and workflow edits across three platforms, and two judgement calls when the first frozen run or the first bundle scan reports something unexpected (both spelled out below).
**Size:** M (about 17 files: `.gitignore`, `deno.lock`, `deno.jsonc`, `package/src/common/deno-meta.json`, `package/scripts/vendoring/vendor.sh`, `vendor.cmd`, new `update-lock.sh`, `package/scripts/common/quarto`, `package/scripts/windows/quarto.cmd`, `package/src/quarto-bld`, `quarto-bld.cmd`, `package/src/util/deno.ts`, `tools/deno-esbuild-bundle.ts`, `package/scripts/deno_std/download.sh`, `download.bat`, `lock.sh`, new `tools/check-bundle-externals.ts` and its test, `.github/workflows/actions/quarto-dev/action.yml`, `.github/workflows/test-bundle.yml`, two dev-docs).
**Ships on:** Deno; the existing test suite must stay green.

## Spec

### Context

`REVIEW-2026-10-15.md` S9, cross-cutting findings 1–3 of the Phase 0 review, and decision 3 ("commit a lockfile and add the bundle gate before PR 03; `--frozen` in configure and CI; cold `DENO_DIR` + `--cached-only` + external-specifier grep + real renders on three OSes").

How dependencies are resolved today (verified by reading the scripts):

- `.gitignore:25-26` ignores `deno.lock`. `deno.jsonc` has no `lock` key, so every Deno command that discovers it (`quarto-bld`, which does not pass `--no-config`; `deno run` of `tools/deno-esbuild-bundle.ts` from `src/`; `quarto run --dev`) writes an uncommitted `deno.lock` at the root.
- The launchers pass `--no-config --no-lock` (`package/scripts/common/quarto:186`, `package/scripts/windows/quarto.cmd:131`, `package/launcher/src/main.rs:84-88`) and `--cached-only` in dev and release mode (`quarto:71`, `quarto:95`, `quarto.cmd:71`, `quarto.cmd:107`, `main.rs:89`).
- `configure.sh` runs, in order: `package/scripts/deno_std/download.sh` (the user-script stdlib cache, below), `quarto-bld configure`, then `package/scripts/vendoring/vendor.sh`, which runs `deno install --allow-all --no-config --entrypoint <file> --importmap=src/import_map.json` once per entrypoint (`quarto.ts`, `vendor_deps.ts`, `../tests/test-deps.ts`, `../package/scripts/deno_std/deno_std.ts`) into `package/dist/bin/deno_cache`, inside `set +e`: a failing entrypoint is ignored. `vendor.cmd` does the same and prints `Warning: Failed to vendor ..., continuing...`.
- `jsr:` ranges (`@luca/esbuild-deno-loader@^0.11.1` in `tools/deno-esbuild-bundle.ts:6`, the `^` ranges inside Cliffy 1.3.1 after PR 06) and npm transitive versions are therefore resolved independently by every developer machine and by each platform's release build.
- `.github/workflows/actions/quarto-dev/action.yml:15-21` restores the dev cache with `restore-keys`, and `QUARTO_SKIP_DENO_CACHE_WIPE=1` keeps it, so after an import-map change CI restores a superset cache that still holds the old `deno.land`/skypack modules: a missing download is hidden.
- `.github/workflows/test-bundle.yml` builds the bundle on `ubuntu-latest` with that warm cache and runs `quarto check` only, which never parses HTML, never starts Chrome and never reaches a lazily loaded chunk.

`src/resources/deno_std/deno_std.lock` is a different lockfile with a different job: it pins the `@std` 0.224 modules that `quarto run` gives users' scripts (`stdlib/*` in `src/resources/deno_std/run_import_map.json`), cached into `src/resources/deno_std/cache` by `download.sh` and shipped in `share/deno_std/`. It stays separate: it ships to users and changes on a different cadence (PR 35 replaces it). This PR only makes `download.sh` frozen too and fixes `lock.sh`, which still passes `--lock-write`, a flag Deno 2 removed (the lockfile is updated unless `--frozen` is given).

Deno facts this plan relies on: `--lock=<file>` and `--frozen[=<bool>]` are accepted by `run`, `install`, `cache` and `info`; `--frozen` fails with `The lockfile is out of date` instead of writing; a `--lock` flag takes precedence over the config's `"lock"` key; `deno install --entrypoint` accepts several files in one call and writes one lockfile covering their union; the `@luca/esbuild-deno-loader` 0.11.1 `denoPlugins` option `lockPath` ("equivalent to the `--lock` flag", read from the package's `mod.ts`) makes the native loader's `deno info` subprocess use the lockfile.

### Scope

In:
- `deno.lock` at the repository root, committed; `.gitignore` no longer ignores it; `deno.jsonc` (and its source `package/src/common/deno-meta.json`) say `"lock": false`, so commands that discover the config never write a lockfile by accident.
- The lockfile covers six entrypoints, vendored in one `deno install` call: `src/quarto.ts`, `src/vendor_deps.ts`, `tests/test-deps.ts`, `package/scripts/deno_std/deno_std.ts`, `package/src/bld.ts`, `tools/deno-esbuild-bundle.ts`.
- Frozen by default: `vendor.sh`/`vendor.cmd`, `quarto-bld`/`quarto-bld.cmd`, the bundle step (`package/src/util/deno.ts` and `lockPath` in `tools/deno-esbuild-bundle.ts`), the dev-mode launchers. `QUARTO_DENO_LOCK_MODE=update` (set by the new `package/scripts/vendoring/update-lock.sh`) switches the vendoring and `quarto-bld` to `--frozen=false`.
- `download.sh`/`download.bat` frozen; `lock.sh` fixed for Deno 2.
- `tools/check-bundle-externals.ts` (finds `import`/`export from`/`import()` of `npm:`, `jsr:`, `http:`, `https:` in a bundle) and its unit test.
- `quarto-dev` action: input `deno-cache` (default `"true"`); the dev cache key also hashes `deno.lock`.
- `test-bundle.yml`: matrix `ubuntu-latest`, `macos-latest`, `windows-latest`; cold dev cache for the build (`deno-cache: "false"`); external-specifier scan; the bundle run with an empty `DENO_DIR` (the release launchers already pass `--cached-only`); `quarto check`; five renders; debug logs kept as an artifact.
- Remove the unused `https://deno.land/std@0.196.0/testing/asserts.ts` import and the commented `deno.land/x/esbuild` line from `tools/deno-esbuild-bundle.ts` (the file is edited anyway; the import was a `deno.land` fetch in every release build).
- `dev-docs/ci-deno-caching.md`, `dev-docs/add-typescript-dependency.md`.

Out:
- The release launcher (`package/launcher/src/main.rs`) and the release mode of both script launchers keep `--no-lock`: no lockfile ships, and the gate proves the bundle needs none.
- Tests keep `--no-lock` (`tests/run-tests.sh:72`, `tests/run-tests.ps1:130`): see Decisions.
- Replacing `deno_std.lock` or the `quarto run` cache (PR 35).
- The renders as a performance gate (PR 05 records the `parseHtml` baseline; PR 20 gates on it).

### Interfaces

`tools/check-bundle-externals.ts`:

```ts
/** One external module specifier found in a bundle. */
export interface ExternalSpecifier { specifier: string; line: number; }

/** Specifiers in `code` that Deno would have to fetch at runtime: the target of `import ... from`,
 * `export ... from`, a side-effect `import "..."` or a dynamic `import("...")`, when it starts with
 * `npm:`, `jsr:`, `http:` or `https:`. `node:` built-ins, relative and `file:` specifiers are not reported.
 * Lines are 1-based. */
export function findExternalSpecifiers(code: string): ExternalSpecifier[];

/** Specifiers allowed to stay external, each with the reason. Empty when this PR lands. */
export const kAllowedExternalSpecifiers: ReadonlyMap<string, string>;
```

CLI: `quarto run --dev tools/check-bundle-externals.ts <bundle.js>` prints `<line>: <specifier>` per finding not in the allow-list and exits 1 if there is any; prints `OK: no external module specifiers in <bundle.js>` and exits 0 otherwise; exits 2 without an argument.

`package/scripts/vendoring/update-lock.sh [--refresh]`: re-vendors into `package/dist/bin/deno_cache` and updates `deno.lock` (`--frozen=false`). Without a flag, every pinned version stays pinned and new specifiers are added; `--refresh` deletes `deno.lock` first, which re-resolves every range (a deliberate dependency update).

Environment variables: `QUARTO_DENO_LOCK_MODE` (`update` → `--frozen=false` in `vendor.sh`/`vendor.cmd`/`quarto-bld`/`quarto-bld.cmd`; anything else → `--frozen`); `QUARTO_DENO_LOCK_OPTIONS` (dev launchers only; default `--lock=<root>/deno.lock --frozen`; a developer can set it to `--no-lock` to run an entrypoint outside the locked graph).

Composite action input (`.github/workflows/actions/quarto-dev/action.yml`):

```yaml
inputs:
  deno-cache:
    description: "Restore and save the Deno caches (set to 'false' to configure from an empty cache)"
    required: false
    default: "true"
```

### Files

- Modify: `.gitignore:25-26` (drop the `deno.lock` lines)
- Create: `deno.lock` (generated, Task 2)
- Modify: `deno.jsonc:3-6`, `package/src/common/deno-meta.json` (`"lock": false`)
- Modify: `package/scripts/vendoring/vendor.sh:22-29`, `package/scripts/vendoring/vendor.cmd:28-34`
- Create: `package/scripts/vendoring/update-lock.sh`
- Modify: `package/scripts/common/quarto:37-66,91-96,186`, `package/scripts/windows/quarto.cmd:33-36,102-108,131`
- Modify: `package/src/quarto-bld:20`, `package/src/quarto-bld.cmd:13`, `package/src/util/deno.ts:23-25`, `tools/deno-esbuild-bundle.ts:1-14`
- Modify: `package/scripts/deno_std/download.sh:13`, `download.bat:9`, `lock.sh:3`
- Create: `tools/check-bundle-externals.ts`
- Test: `tests/unit/tools/check-bundle-externals.test.ts`
- Modify: `.github/workflows/actions/quarto-dev/action.yml:1-21`, `.github/workflows/test-bundle.yml` (whole file)
- Modify: `dev-docs/ci-deno-caching.md`, `dev-docs/add-typescript-dependency.md` (whole body)
- Modify: `dev-docs/runtime-migration/README.md` (PR 00b row status)

### Acceptance criteria

- `git ls-files deno.lock` prints `deno.lock`; `./configure.sh` on a clean checkout leaves `git status --short` empty.
- Changing one version in `src/import_map.json` (for example `zod` 3.24.4 → 3.24.3) without updating the lockfile makes `./configure.sh` fail with `The lockfile is out of date`; `package/scripts/vendoring/update-lock.sh` then succeeds and changes `deno.lock`.
- `package/dist/bin/quarto check` works in dev mode with the frozen lockfile; `quarto run --dev tools/check-runtime-boundary.ts` still works (its graph is outside the lockfile and `deno.jsonc` has `"lock": false`).
- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/tools/check-bundle-externals.test.ts` → `3 passed`.
- `Bundle Test` is green on `ubuntu-latest`, `macos-latest` and `windows-latest`: no external specifier in `quarto.js`; `quarto check` and the five renders succeed with an empty `DENO_DIR`.
- `rg -n 'deno\.land' tools/deno-esbuild-bundle.ts` prints nothing.

## Plan

### Task 1: Inventory what vendoring resolves today

**Files:** none

- [ ] **Step 1: Run each current entrypoint on its own and record failures**

Run (Linux/macOS, from the repository root, after `./configure.sh` on `main`):
```bash
D=package/dist/bin/tools/$(uname -m | sed 's/arm64/aarch64/')/deno
export DENO_DIR=$(mktemp -d)
for e in quarto.ts vendor_deps.ts ../tests/test-deps.ts ../package/scripts/deno_std/deno_std.ts ../package/src/bld.ts ../tools/deno-esbuild-bundle.ts; do
  (cd src && "$D" install --allow-all --no-config --no-lock --importmap="$PWD/import_map.json" --entrypoint "$e" > /dev/null 2>&1; echo "$e exit=$?")
done
rm -rf "$DENO_DIR"; unset DENO_DIR
```
Expected: `exit=0` for all six. `vendor.sh` hid failures until now (`set +e`); the most likely failure is `vendor_deps.ts` on `https://dev.jspm.io/jszip@3.5.0` (the jspm dev CDN). If `vendor_deps.ts` fails on that line only, delete the line `import _jszip from "https://dev.jspm.io/jszip@3.5.0";` from `src/vendor_deps.ts` in Task 2 (no code imports `jszip`: `grep -rn jszip src package/src tests --include=*.ts` lists only that line and a URL in a comment in `package/src/common/update-html-dependencies.ts`; caching a module that cannot be fetched is impossible anyway). For any other failure, stop and report it: the frozen single-call vendoring below would turn it into a hard `configure` error.

### Task 2: Lockfile policy and the frozen vendoring

**Files:**
- Modify: `.gitignore:25-26`
- Modify: `deno.jsonc`, `package/src/common/deno-meta.json`
- Modify: `package/scripts/vendoring/vendor.sh`, `package/scripts/vendoring/vendor.cmd`
- Create: `package/scripts/vendoring/update-lock.sh`
- Create: `deno.lock`

- [ ] **Step 1: Stop ignoring the lockfile and disable implicit lockfiles**

In `.gitignore` delete the two lines
```
# deno lock file
deno.lock
```
In `deno.jsonc` replace
```jsonc
{
  "compilerOptions": {
    "noErrorTruncation": true
  },
```
with
```jsonc
{
  "compilerOptions": {
    "noErrorTruncation": true
  },
  // deno.lock is used only through explicit --lock flags (configure, quarto-bld,
  // the bundle, the dev launcher); see dev-docs/add-typescript-dependency.md
  "lock": false,
```
In `package/src/common/deno-meta.json` add the same key after the `"meta"` block (so `create-deno-config.ts` keeps it when `deno.jsonc` is regenerated):
```json
  "lock": false,
```

- [ ] **Step 2: Rewrite the vendoring call (POSIX)**

In `package/scripts/vendoring/vendor.sh` replace
```bash
pushd "${QUARTO_SRC_PATH}"
set +e
for entrypoint in quarto.ts vendor_deps.ts ../tests/test-deps.ts ../package/scripts/deno_std/deno_std.ts; do
  $DENO_BIN_PATH install --allow-all --no-config --entrypoint $entrypoint "--importmap=$QUARTO_SRC_PATH/import_map.json"
done
set -e
popd
```
with
```bash
# deno.lock pins every module of these entrypoints. configure runs frozen: an
# import-map change without a lockfile update fails here with "The lockfile is
# out of date". Update it with package/scripts/vendoring/update-lock.sh.
if [ "${QUARTO_DENO_LOCK_MODE}" == "update" ]; then
  QUARTO_DENO_FROZEN_FLAG="--frozen=false"
else
  QUARTO_DENO_FROZEN_FLAG="--frozen"
fi

pushd "${QUARTO_SRC_PATH}"
$DENO_BIN_PATH install --allow-all --no-config \
  "--lock=$QUARTO_SRC_PATH/../deno.lock" $QUARTO_DENO_FROZEN_FLAG \
  "--importmap=$QUARTO_SRC_PATH/import_map.json" \
  --entrypoint quarto.ts vendor_deps.ts ../tests/test-deps.ts \
  ../package/scripts/deno_std/deno_std.ts ../package/src/bld.ts ../tools/deno-esbuild-bundle.ts
popd
```

- [ ] **Step 3: Rewrite the vendoring call (Windows)**

In `package/scripts/vendoring/vendor.cmd` replace
```bat
PUSHD "!QUARTO_SRC_PATH!"

FOR %%E IN (quarto.ts vendor_deps.ts ..\tests\test-deps.ts ..\package\scripts\deno_std\deno_std.ts) DO (
  CALL !DENO_BIN_PATH! install --allow-all --no-config --entrypoint %%E --importmap="!QUARTO_SRC_PATH!\import_map.json" || (
    ECHO Warning: Failed to vendor %%E, continuing...
  )
)

REM Return to the original directory
POPD
```
with
```bat
REM deno.lock pins every module of these entrypoints; configure runs frozen.
REM Set QUARTO_DENO_LOCK_MODE=update to update the lockfile.
IF "!QUARTO_DENO_LOCK_MODE!"=="update" (
  SET "QUARTO_DENO_FROZEN_FLAG=--frozen=false"
) ELSE (
  SET "QUARTO_DENO_FROZEN_FLAG=--frozen"
)

PUSHD "!QUARTO_SRC_PATH!"

CALL !DENO_BIN_PATH! install --allow-all --no-config --lock="!QUARTO_SRC_PATH!\..\deno.lock" !QUARTO_DENO_FROZEN_FLAG! --importmap="!QUARTO_SRC_PATH!\import_map.json" --entrypoint quarto.ts vendor_deps.ts ..\tests\test-deps.ts ..\package\scripts\deno_std\deno_std.ts ..\package\src\bld.ts ..\tools\deno-esbuild-bundle.ts
IF ERRORLEVEL 1 (
  ECHO Failed to vendor the TypeScript dependencies. If deno.lock is out of date, run with QUARTO_DENO_LOCK_MODE=update.
  POPD
  EXIT /B 1
)

REM Return to the original directory
POPD
```

- [ ] **Step 4: Add the update script**

Create `package/scripts/vendoring/update-lock.sh` (mode 755: `chmod +x`):

```bash
#!/usr/bin/env bash
#
# update-lock.sh
#
# Re-vendor the TypeScript dependencies into package/dist/bin/deno_cache and
# update deno.lock. Run it after editing src/import_map.json, then commit
# deno.lock with the import-map change.
#
#   package/scripts/vendoring/update-lock.sh            keep pinned versions, add new specifiers
#   package/scripts/vendoring/update-lock.sh --refresh  re-resolve every range (a dependency update)
#
# Windows: set QUARTO_DENO_LOCK_MODE=update, then run configure.cmd.
#
# Copyright (C) 2026 Posit Software, PBC

set -e
VENDOR_SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
source "$VENDOR_SCRIPT_DIR/../../../configuration"
source "$VENDOR_SCRIPT_DIR/../common/utils.sh"
source "$VENDOR_SCRIPT_DIR/../../src/set_package_paths.sh"

if [ "$1" == "--refresh" ]; then
  rm -f "$QUARTO_ROOT/deno.lock"
fi

export QUARTO_VENDOR_BINARIES=${QUARTO_VENDOR_BINARIES=true}
export QUARTO_DENO_LOCK_MODE=update
export QUARTO_SKIP_DENO_CACHE_WIPE=1
source "$VENDOR_SCRIPT_DIR/vendor.sh"

echo "deno.lock updated; commit it with the import-map change."
```

- [ ] **Step 5: Generate the lockfile and prove frozen mode passes**

Run (if Task 1 found the `dev.jspm.io` failure, delete that line from `src/vendor_deps.ts` first):
```bash
package/scripts/vendoring/update-lock.sh --refresh
git status --short deno.lock
./configure.sh && git status --short
```
Expected: `?? deno.lock` after the first command; `./configure.sh` completes (vendoring with `--frozen`) and the final `git status --short` lists only the files this task changed (`.gitignore`, `deno.jsonc`, `package/src/common/deno-meta.json`, the vendoring scripts, `deno.lock`, possibly `src/vendor_deps.ts`).

- [ ] **Step 6: Prove frozen mode catches a drift (the failing test of this task)**

Run:
```bash
sed -i.bak 's|"zod": "npm:/zod@3.24.4"|"zod": "npm:/zod@3.24.3"|' src/import_map.json
./configure.sh; echo "exit=$?"
mv src/import_map.json.bak src/import_map.json
```
Expected: the vendoring step prints `error: The lockfile is out of date` and `exit=1` (non-zero). The last command restores the map.

- [ ] **Step 7: Commit**

```bash
git add .gitignore deno.jsonc package/src/common/deno-meta.json deno.lock \
  package/scripts/vendoring/vendor.sh package/scripts/vendoring/vendor.cmd package/scripts/vendoring/update-lock.sh
git add src/vendor_deps.ts 2>/dev/null || true
git commit -m "Commit deno.lock and vendor with --frozen

One deno install call covers quarto.ts, vendor_deps.ts, test-deps.ts,
deno_std.ts, bld.ts and the esbuild bundle script; a failing entrypoint
now fails configure instead of being skipped. update-lock.sh updates
the lockfile after an import-map change."
```

### Task 3: Frozen lockfile in the dev launchers, `quarto-bld` and the bundle step

**Files:**
- Modify: `package/scripts/common/quarto`, `package/scripts/windows/quarto.cmd`
- Modify: `package/src/quarto-bld`, `package/src/quarto-bld.cmd`, `package/src/util/deno.ts`
- Modify: `tools/deno-esbuild-bundle.ts`

- [ ] **Step 1: POSIX launcher**

In `package/scripts/common/quarto`, in the dev-mode branch, after line 39 (`QUARTO_IMPORT_MAP_ARG=--importmap=$QUARTO_SRC_PATH/import_map.json`) add:
```bash
  # dev mode resolves through the committed lockfile (see package/scripts/vendoring/update-lock.sh)
  if [ -z "${QUARTO_DENO_LOCK_OPTIONS+x}" ]; then
    QUARTO_DENO_LOCK_OPTIONS="--lock=$QUARTO_ROOT/deno.lock --frozen"
  fi
```
In the release branch, after line 95 (`QUARTO_CACHE_OPTIONS="--cached-only"`) add:
```bash
  # the bundle is self-contained (checked by .github/workflows/test-bundle.yml); no lockfile ships
  QUARTO_DENO_LOCK_OPTIONS="--no-lock"
```
and in line 186 replace `--no-lock` with `${QUARTO_DENO_LOCK_OPTIONS}`:
```bash
QUARTO_DENO_OPTIONS="--unstable-ffi --unstable-kv --no-config ${QUARTO_DENO_LOCK_OPTIONS} ${QUARTO_CACHE_OPTIONS} --allow-all ${QUARTO_DENO_OPTIONS}"
```

- [ ] **Step 2: Windows launcher**

In `package/scripts/windows/quarto.cmd`, in the dev branch after `SET "QUARTO_IMPORT_MAP_ARG=--importmap=""!QUARTO_SRC_PATH!\import_map.json"""` (line 41) add:
```bat
	IF NOT DEFINED QUARTO_DENO_LOCK_OPTIONS (
		SET "QUARTO_DENO_LOCK_OPTIONS=--lock=""!QUARTO_ROOT!\deno.lock"" --frozen"
	)
```
in the release branch after `SET QUARTO_CACHE_OPTIONS=--cached-only` (line 107) add:
```bat
	SET "QUARTO_DENO_LOCK_OPTIONS=--no-lock"
```
and replace line 131 with:
```bat
SET "QUARTO_DENO_OPTIONS=--unstable-kv --unstable-ffi --no-config !QUARTO_DENO_LOCK_OPTIONS! --allow-all !QUARTO_DENO_OPTIONS!"
```

- [ ] **Step 3: `quarto-bld` (POSIX and Windows)**

In `package/src/quarto-bld` replace the last line with:
```bash
if [ "${QUARTO_DENO_LOCK_MODE}" == "update" ]; then
  QUARTO_DENO_FROZEN_FLAG="--frozen=false"
else
  QUARTO_DENO_FROZEN_FLAG="--frozen"
fi
"$QUARTO_DENO" run --no-check --no-config "--lock=${SCRIPT_PATH}/../../deno.lock" $QUARTO_DENO_FROZEN_FLAG --unstable-kv --unstable-ffi --allow-all --v8-flags=--enable-experimental-regexp-engine,--stack-trace-limit=100 --importmap="${SCRIPT_PATH}/../../src/import_map.json" "$SCRIPT_PATH/bld.ts" $@
```
In `package/src/quarto-bld.cmd` replace the last line with:
```bat
SET "QUARTO_DENO_FROZEN_FLAG=--frozen"
IF "%QUARTO_DENO_LOCK_MODE%"=="update" SET "QUARTO_DENO_FROZEN_FLAG=--frozen=false"
"%QUARTO_DENO%" run --no-check --no-config --lock=%~dp0\..\..\deno.lock %QUARTO_DENO_FROZEN_FLAG% --unstable-kv --unstable-ffi --allow-all --v8-flags=--enable-experimental-regexp-engine,--stack-trace-limit=100 --importmap=%~dp0\..\..\src\import_map.json %~dp0\bld.ts %*
```

- [ ] **Step 4: The bundle step**

In `package/src/util/deno.ts` replace
```ts
  denoBundleCmd.push("run");
  denoBundleCmd.push("--allow-all");
  denoBundleCmd.push("../tools/deno-esbuild-bundle.ts");
```
with
```ts
  denoBundleCmd.push("run");
  denoBundleCmd.push("--allow-all");
  // the bundler script and the module graph it bundles are pinned by deno.lock
  denoBundleCmd.push("--no-config");
  denoBundleCmd.push(
    `--lock=${join(configuration.directoryInfo.root, "deno.lock")}`,
  );
  denoBundleCmd.push("--frozen");
  denoBundleCmd.push("../tools/deno-esbuild-bundle.ts");
```
and add `import { join } from "../../../src/deno_ral/path.ts";` to the imports at the top of the file (it imports `execProcess`, `info`, `isWindows` and `Configuration` today, not `join`).

In `tools/deno-esbuild-bundle.ts` replace lines 1-14
```ts
import * as esbuild from "npm:esbuild@0.27.1";
// Import the Wasm build on platforms where running subprocesses is not
// permitted, such as Deno Deploy, or when running without `--allow-run`.
// import * as esbuild from "https://deno.land/x/esbuild@0.20.2/wasm.js";

import { denoPlugins } from "jsr:@luca/esbuild-deno-loader@^0.11.1";
import { assert } from "https://deno.land/std@0.196.0/testing/asserts.ts";

const importMapURL = `file://${Deno.cwd()}/import_map.json`;
// console.log("importMapURL", importMapURL);

await esbuild.build({
  plugins: [...denoPlugins({ importMapURL })
```
with
```ts
import * as esbuild from "npm:esbuild@0.27.1";

import { denoPlugins } from "jsr:@luca/esbuild-deno-loader@^0.11.1";

const importMapURL = `file://${Deno.cwd()}/import_map.json`;
// The bundled graph resolves through the committed lockfile (cwd is src/).
const lockPath = Deno.realPathSync("../deno.lock");

await esbuild.build({
  plugins: [...denoPlugins({ importMapURL, lockPath })
```

- [ ] **Step 5: Run the dev launcher and the build**

Run:
```bash
package/dist/bin/quarto check
package/dist/bin/quarto render tests/docs/minimal.qmd --to html --output-dir /tmp/rt00b && rm -rf /tmp/rt00b
package/dist/bin/quarto run --dev tools/check-runtime-boundary.ts
cd package/src && ./quarto-bld prepare-dist --set-version $(cat ../../version.txt) && cd ../..
git status --short
```
Expected: `quarto check` passes; the render succeeds; the ratchet prints `OK` (its graph is not in the lockfile and `deno.jsonc` has `"lock": false`); `prepare-dist` builds `package/pkg-working/bin/quarto.js`; `git status --short` shows no change to `deno.lock` (nothing in the frozen runs wrote to it).

- [ ] **Step 6: Prove the dev launcher is frozen**

Run:
```bash
sed -i.bak 's|"zod": "npm:/zod@3.24.4"|"zod": "npm:/zod@3.24.3"|' src/import_map.json
package/dist/bin/quarto check; echo "exit=$?"
mv src/import_map.json.bak src/import_map.json
QUARTO_DENO_LOCK_OPTIONS=--no-lock package/dist/bin/quarto check > /dev/null; echo "escape-hatch exit=$?"
```
Expected: the first run fails (`The lockfile is out of date`, or `not found in cache` if `--cached-only` is checked first) with a non-zero exit; after the restore, the escape hatch run exits 0.

- [ ] **Step 7: Commit**

```bash
git add package/scripts/common/quarto package/scripts/windows/quarto.cmd package/src/quarto-bld package/src/quarto-bld.cmd package/src/util/deno.ts tools/deno-esbuild-bundle.ts
git commit -m "Use the frozen deno.lock in the dev launchers, quarto-bld and the bundle

The release launchers keep --no-lock: the bundle is self-contained.
Drops the unused deno.land/std assert import from the bundler script."
```

### Task 4: The user-script stdlib lockfile

**Files:**
- Modify: `package/scripts/deno_std/download.sh:13`, `package/scripts/deno_std/download.bat:9`, `package/scripts/deno_std/lock.sh:3`

- [ ] **Step 1: Frozen by default, `--update-lock` to update**

In `package/scripts/deno_std/download.sh` replace the last line with:
```bash
FROZEN_FLAG="--frozen"
if [ "$1" == "--update-lock" ]; then
  FROZEN_FLAG="--frozen=false"
  shift
fi
"$QUARTO_DENO" cache --allow-import --no-config --unstable-ffi --lock "$QUARTO_SRC_PATH/resources/deno_std/deno_std.lock" $FROZEN_FLAG "$@" "$QUARTO_PACKAGE_PATH/scripts/deno_std/deno_std.ts"
```
In `package/scripts/deno_std/lock.sh` replace `package/scripts/deno_std/download.sh --lock-write` with:
```bash
package/scripts/deno_std/download.sh --update-lock
```
In `package/scripts/deno_std/download.bat` replace the last line with:
```bat
%QUARTO_DENO% cache --allow-import --no-config --unstable-ffi --lock %~dp0\..\..\..\src\resources\deno_std\deno_std.lock --frozen %~dp0\deno_std.ts
```

- [ ] **Step 2: Run both modes**

Run: `rm -rf src/resources/deno_std/cache && package/scripts/deno_std/download.sh && git status --short src/resources/deno_std/`
Expected: the cache is rebuilt, exit 0, no change to `deno_std.lock`. (If Deno 2.9 reports the version-3 lockfile as out of date because of its format, run `package/scripts/deno_std/lock.sh`, confirm with `git diff` that only the lockfile format changed and every resolved version is the same, and commit the rewritten `deno_std.lock` in this task.)

- [ ] **Step 3: Commit**

```bash
git add package/scripts/deno_std/download.sh package/scripts/deno_std/download.bat package/scripts/deno_std/lock.sh
git commit -m "Download the quarto run stdlib with a frozen deno_std.lock; fix lock.sh for Deno 2"
```

### Task 5: The external-specifier scan

**Files:**
- Create: `tools/check-bundle-externals.ts`
- Test: `tests/unit/tools/check-bundle-externals.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/tools/check-bundle-externals.test.ts`:

```ts
/*
 * check-bundle-externals.test.ts
 *
 * The release bundle runs with --cached-only from the user's DENO_DIR, so it
 * must not import any npm:, jsr: or http(s): module at runtime.
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { unitTest } from "../../test.ts";
import { assertEquals } from "../../asserts.ts";
import { findExternalSpecifiers } from "../../../tools/check-bundle-externals.ts";

// deno-lint-ignore require-await
unitTest("check-bundle-externals - finds static, re-export, side-effect and dynamic imports", async () => {
  const code = [
    `import x from "npm:foo@1.0.0";`,
    `export * from 'jsr:@luca/esbuild-deno-loader@0.11.1';`,
    `import "https://deno.land/x/a/mod.ts";`,
    `const m = await import("jsr:@b-fuze/deno-dom@0.1.56/native");`,
    `const n = await import ( 'http://example.com/m.js' );`,
  ].join("\n");
  assertEquals(findExternalSpecifiers(code), [
    { specifier: "npm:foo@1.0.0", line: 1 },
    { specifier: "jsr:@luca/esbuild-deno-loader@0.11.1", line: 2 },
    { specifier: "https://deno.land/x/a/mod.ts", line: 3 },
    { specifier: "jsr:@b-fuze/deno-dom@0.1.56/native", line: 4 },
    { specifier: "http://example.com/m.js", line: 5 },
  ]);
});

// deno-lint-ignore require-await
unitTest("check-bundle-externals - ignores node:, relative, file: and plain strings", async () => {
  const code = [
    `import fs from "node:fs";`,
    `import { a } from "./a.js";`,
    `import b from "file:///tmp/b.js";`,
    `const url = "https://quarto.org/docs/";`,
    `fetch("https://cdn.jsdelivr.net/npm/x");`,
  ].join("\n");
  assertEquals(findExternalSpecifiers(code), []);
});

// deno-lint-ignore require-await
unitTest("check-bundle-externals - several on one line", async () => {
  assertEquals(
    findExternalSpecifiers(`import a from "npm:a@1";import b from "npm:b@2";`),
    [{ specifier: "npm:a@1", line: 1 }, { specifier: "npm:b@2", line: 1 }],
  );
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/tools/check-bundle-externals.test.ts`
Expected: FAIL at type-check time, `Module not found ".../tools/check-bundle-externals.ts"`.

- [ ] **Step 3: Implement**

Create `tools/check-bundle-externals.ts`:

```ts
/*
 * check-bundle-externals.ts
 *
 * Release-bundle self-containment check: the bundle runs with --cached-only
 * from the user's DENO_DIR, so any npm:, jsr: or http(s): import left in it
 * fails at runtime (often only when a lazily loaded chunk is reached).
 *
 * Usage: quarto run --dev tools/check-bundle-externals.ts package/pkg-working/bin/quarto.js
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

export interface ExternalSpecifier {
  specifier: string;
  line: number;
}

/** Specifiers allowed to stay external, each with the reason. */
export const kAllowedExternalSpecifiers: ReadonlyMap<string, string> = new Map(
  [],
);

const kImportRe =
  /(?:\bfrom|\bimport)\s*\(?\s*["'`]((?:npm|jsr|https?):[^"'`]+)["'`]/g;

export function findExternalSpecifiers(code: string): ExternalSpecifier[] {
  const found: ExternalSpecifier[] = [];
  const lines = code.split("\n");
  for (let i = 0; i < lines.length; i++) {
    for (const match of lines[i].matchAll(kImportRe)) {
      found.push({ specifier: match[1], line: i + 1 });
    }
  }
  return found;
}

if (import.meta.main) {
  const bundle = Deno.args[0];
  if (!bundle) {
    console.error("usage: quarto run --dev tools/check-bundle-externals.ts <bundle.js>");
    Deno.exit(2);
  }
  const findings = findExternalSpecifiers(Deno.readTextFileSync(bundle))
    .filter((f) => !kAllowedExternalSpecifiers.has(f.specifier));
  if (findings.length > 0) {
    for (const f of findings) {
      console.log(`::error::${bundle}:${f.line}: external module specifier ${f.specifier}`);
    }
    Deno.exit(1);
  }
  console.log(`OK: no external module specifiers in ${bundle}`);
}
```

- [ ] **Step 4: Run the tests**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/tools/check-bundle-externals.test.ts`
Expected: `3 passed`.

- [ ] **Step 5: Scan the bundle built in Task 3**

Run: `package/dist/bin/quarto run --dev tools/check-bundle-externals.ts package/pkg-working/bin/quarto.js; echo "exit=$?"`
Expected: `OK: no external module specifiers in package/pkg-working/bin/quarto.js` and `exit=0`. If a finding is reported, look at its context (`sed -n '<line>p' package/pkg-working/bin/quarto.js | cut -c1-300`): an import Deno would execute is a real bundling bug (stop and report it; it ships broken today); an `import` inside a string that Quarto writes into an HTML page for the browser (the code is never executed by Deno) goes into `kAllowedExternalSpecifiers` with its source file as the reason, in this commit.

- [ ] **Step 6: Commit**

```bash
git add tools/check-bundle-externals.ts tests/unit/tools/check-bundle-externals.test.ts
git commit -m "Add a check for external module specifiers in the release bundle"
```

### Task 6: The CI cache input and the three-OS bundle gate

**Files:**
- Modify: `.github/workflows/actions/quarto-dev/action.yml:1-21`
- Modify: `.github/workflows/test-bundle.yml`

- [ ] **Step 1: Add the `deno-cache` input and hash `deno.lock`**

In `.github/workflows/actions/quarto-dev/action.yml` replace lines 1-21:
```yaml
name: "Configure Quarto Dev"
description: "Configures the image for Quarto Development"

runs:
  using: "composite"
  steps:
    - name: Cache deno std deps
      uses: actions/cache@v5
      with:
        path: ./src/resources/deno_std/cache
        key: ${{ runner.os }}-deno_std-2-${{ hashFiles('./src/resources/deno_std/deno_std.lock', './package/scripts/deno_std/deno_std.ts') }}
        restore-keys: |
          ${{ runner.os }}-deno_std-2-

    - name: Cache Deno development cache
      uses: actions/cache@v5
      with:
        path: ./package/dist/bin/deno_cache
        key: ${{ runner.os }}-${{ runner.arch }}-deno-cache-v1-${{ hashFiles('configuration', 'src/import_map.json', 'src/vendor_deps.ts', 'tests/test-deps.ts', 'package/scripts/deno_std/deno_std.ts') }}
        restore-keys: |
          ${{ runner.os }}-${{ runner.arch }}-deno-cache-v1-
```
with
```yaml
name: "Configure Quarto Dev"
description: "Configures the image for Quarto Development"

inputs:
  deno-cache:
    description: "Restore and save the Deno caches (set to 'false' to configure from an empty cache)"
    required: false
    default: "true"

runs:
  using: "composite"
  steps:
    - name: Cache deno std deps
      if: inputs.deno-cache == 'true'
      uses: actions/cache@v5
      with:
        path: ./src/resources/deno_std/cache
        key: ${{ runner.os }}-deno_std-2-${{ hashFiles('./src/resources/deno_std/deno_std.lock', './package/scripts/deno_std/deno_std.ts') }}
        restore-keys: |
          ${{ runner.os }}-deno_std-2-

    - name: Cache Deno development cache
      if: inputs.deno-cache == 'true'
      uses: actions/cache@v5
      with:
        path: ./package/dist/bin/deno_cache
        key: ${{ runner.os }}-${{ runner.arch }}-deno-cache-v1-${{ hashFiles('configuration', 'deno.lock', 'src/import_map.json', 'src/vendor_deps.ts', 'tests/test-deps.ts', 'package/scripts/deno_std/deno_std.ts') }}
        restore-keys: |
          ${{ runner.os }}-${{ runner.arch }}-deno-cache-v1-
```

- [ ] **Step 2: Rewrite the bundle workflow**

Replace `.github/workflows/test-bundle.yml` with:

```yaml
# Release-bundle gate. Builds quarto.js from an empty Deno cache with the
# frozen deno.lock, checks that it imports no external module, then runs it the
# way installed Quarto does (--cached-only, see the release launchers) from an
# empty DENO_DIR and renders HTML, a website, OJS, mermaid and a manuscript.
# If this fails, the release version of Quarto would fail on users' machines.
# See dev-docs/runtime-migration/00b-lockfile-and-bundle-gate.md.
name: Bundle Test
on:
  workflow_dispatch:
  pull_request:
    branches: [main]
    paths-ignore:
      - ".claude/**"
  push:
    # only trigger on branches, not on tags
    branches: [main]
    paths-ignore:
      - ".claude/**"

permissions:
  contents: read

jobs:
  test-bundle:
    name: Bundle Test (${{ matrix.os }})
    if: github.event_name != 'schedule' || (github.event_name == 'schedule' && github.repository == 'quarto-dev/quarto-cli')
    strategy:
      fail-fast: false
      matrix:
        os: [ubuntu-latest, macos-latest, windows-latest]
    runs-on: ${{ matrix.os }}
    steps:
      - name: Checkout Repo
        uses: actions/checkout@v6
        with:
          # checkout full tree
          fetch-depth: 0

      - name: Set Path
        shell: bash
        run: |
          echo "$HOME/bin" >> $GITHUB_PATH

      - name: Configure Quarto (empty Deno cache, frozen lockfile)
        uses: ./.github/workflows/actions/quarto-dev
        with:
          deno-cache: "false"

      - name: Build bundle (Linux, macOS)
        if: runner.os != 'Windows'
        shell: bash
        run: |
          pushd package/src
          ./quarto-bld prepare-dist --set-version $(cat ../../version.txt)

      - name: Build bundle (Windows)
        if: runner.os == 'Windows'
        shell: pwsh
        run: |
          Push-Location package\src
          .\quarto-bld.cmd prepare-dist --set-version (Get-Content ..\..\version.txt)

      - name: No external module specifiers in quarto.js
        shell: pwsh
        run: |
          quarto run --dev tools/check-bundle-externals.ts package/pkg-working/bin/quarto.js

      - name: Run the bundle from an empty DENO_DIR
        shell: bash
        run: |
          set -euo pipefail
          # the launchers run dev sources while src/quarto.ts exists
          mv src/quarto.ts src/quarto1.ts
          export DENO_DIR="$RUNNER_TEMP/empty-deno-dir"
          rm -rf "$DENO_DIR" && mkdir -p "$DENO_DIR"
          export QUARTO_LOG_LEVEL=debug
          LOGS="$RUNNER_TEMP/bundle-logs"
          mkdir -p "$LOGS"
          if [ "$RUNNER_OS" = "Windows" ]; then
            Q="$PWD/package/pkg-working/bin/quarto.cmd"
          else
            Q="$PWD/package/pkg-working/bin/quarto"
          fi
          run() {
            name="$1"; shift
            echo "::group::$name: quarto $*"
            if ! "$Q" "$@" > "$LOGS/$name.log" 2>&1; then
              cat "$LOGS/$name.log"
              echo "::endgroup::"
              echo "::error::bundled quarto failed: $name (quarto $*)"
              exit 1
            fi
            tail -n 5 "$LOGS/$name.log"
            echo "::endgroup::"
          }
          run check check
          run html render tests/docs/callouts.qmd --to html
          run website render tests/docs/website-image-base
          run ojs render tests/docs/ojs/test-ojs.qmd --to html
          run mermaid render tests/docs/smoke-all/2026/02/12/mermaid-typst.qmd --to typst
          run manuscript render tests/docs/manuscript/base
          test -f tests/docs/callouts.html
          test -f tests/docs/website-image-base/_site/index.html
          test -f tests/docs/ojs/test-ojs.html
          test -f tests/docs/smoke-all/2026/02/12/mermaid-typst.pdf
          test -f tests/docs/manuscript/base/_manuscript/index.html

      - name: Upload bundle logs
        if: always()
        uses: actions/upload-artifact@v7
        with:
          name: bundle-logs-${{ matrix.os }}
          path: ${{ runner.temp }}/bundle-logs
          if-no-files-found: ignore

      - name: Validate Bundle
        if: runner.os == 'Linux'
        shell: bash
        run: |
          pushd package/src
          ./quarto-bld validate-bundle
```

(`actions/upload-artifact@v7` is the version every other workflow in the repository uses.)

- [ ] **Step 3: Validate the YAML locally**

Run: `package/dist/bin/tools/x86_64/deno eval 'import { parse } from "jsr:@std/yaml@1.0.5"; for (const f of [".github/workflows/test-bundle.yml", ".github/workflows/actions/quarto-dev/action.yml"]) console.log(f, Object.keys(parse(Deno.readTextFileSync(f)) as Record<string, unknown>))'`
Expected: `.github/workflows/test-bundle.yml [ "name", "on", "permissions", "jobs" ]` and `.github/workflows/actions/quarto-dev/action.yml [ "name", "description", "inputs", "runs" ]`.

- [ ] **Step 4: Run the bundle step locally (Linux or macOS)**

Run the body of the "Run the bundle from an empty DENO_DIR" step from the repository root with `RUNNER_TEMP=$(mktemp -d)` and `RUNNER_OS=$(uname)` exported, after Task 3's `prepare-dist`; then `mv src/quarto1.ts src/quarto.ts`.
Expected: each group prints the tail of its log and the five `test -f` lines pass. Remove the outputs afterwards: `git clean -fdx tests/docs/callouts.html tests/docs/callouts_files tests/docs/website-image-base/_site tests/docs/ojs tests/docs/smoke-all/2026/02/12 tests/docs/manuscript/base/_manuscript` after checking with `git clean -ndx` that only render outputs are listed.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/actions/quarto-dev/action.yml .github/workflows/test-bundle.yml
git commit -m "Gate the release bundle on Linux, macOS and Windows

Builds from an empty Deno cache with the frozen lockfile, scans quarto.js
for external module specifiers, and runs the bundle from an empty
DENO_DIR (--cached-only) through check and five renders."
```

### Task 7: Documentation and status

**Files:**
- Modify: `dev-docs/add-typescript-dependency.md`, `dev-docs/ci-deno-caching.md`
- Modify: `dev-docs/runtime-migration/README.md`

- [ ] **Step 1: Replace the stale dependency guide**

Replace the whole body of `dev-docs/add-typescript-dependency.md` with:

```markdown
## Adding or updating a TypeScript dependency

1. Add or change the entry in `src/import_map.json` as an `npm:` or `jsr:` specifier pinned to an exact version. Never use `deno.land`, a CDN (`cdn.skypack.dev`, `esm.sh`, `dev.jspm.io`) or a version range.
2. If only tests use it, also import it in `tests/test-deps.ts`. If scripts run with `quarto run` need it, add it to `package/scripts/deno_std/deno_std.ts` and `src/resources/deno_std/run_import_map.json`, then run `package/scripts/deno_std/lock.sh`.
3. Run `package/scripts/vendoring/update-lock.sh` (Windows: `set QUARTO_DENO_LOCK_MODE=update` then `configure.cmd`). It re-vendors `package/dist/bin/deno_cache` and adds the new modules to `deno.lock`.
4. Commit `deno.lock` with the import-map change. `configure`, the dev launcher, `quarto-bld` and the release bundle all run with the frozen lockfile and fail with "The lockfile is out of date" until you do.
5. The `Bundle Test` workflow checks that the release bundle does not import the package at runtime from the network (`tools/check-bundle-externals.ts`) and renders documents with it on Linux, macOS and Windows.

To move every pinned transitive version forward (a dependency update, not part of an unrelated change), run `package/scripts/vendoring/update-lock.sh --refresh`.
```

- [ ] **Step 2: Update the CI cache doc**

In `dev-docs/ci-deno-caching.md`, in the "Cache key" table add the row
```markdown
| `deno.lock` | Pins every resolved module version; a lockfile update is a dependency change. |
```
after the `configuration` row, change "five files" to "six files" in the sentence above the table and in "Editing any of the five keyed files", and add at the end of the file:
```markdown
## Configuring without the cache

The `quarto-dev` action takes `deno-cache: "false"` to skip both cache steps. `Bundle Test` uses it so that the release bundle is built from what `deno.lock` resolves, not from a restored superset cache (`restore-keys` would otherwise restore modules that the current import map no longer references, hiding a missing download).
```

- [ ] **Step 3: Set the PR 00b row to `in progress` and commit**

```bash
git add dev-docs/add-typescript-dependency.md dev-docs/ci-deno-caching.md dev-docs/runtime-migration/README.md
git commit -m "Document the lockfile workflow and the uncached bundle gate"
```

### Task 8: CI on three OSes

**Files:** possibly `deno.lock`

- [ ] **Step 1: Push and watch**

Expected on the PR: `Bundle Test (ubuntu-latest)`, `(macos-latest)`, `(windows-latest)` green; every other workflow that uses `quarto-dev` (`Smoke Tests`, `Parallel Smokes Tests`, `Test Tool Install`, `Runtime Boundary`) passes its "Basic dev mode sanity check" (no file modified by `configure`).

- [ ] **Step 2: If one OS reports the lockfile out of date**

npm packages with platform-specific optional dependencies (`esbuild` via `npm:esbuild@0.27.1`) can make the lockfile differ by platform. On that OS run `package/scripts/vendoring/update-lock.sh` (Windows: `set QUARTO_DENO_LOCK_MODE=update` and `configure.cmd`), confirm `git diff deno.lock` only adds entries, commit, and re-run the other two OSes. Repeat until all three are frozen-clean with one committed `deno.lock`.

## Verification

- `./configure.sh` on a clean checkout → success, `git status --short` empty.
- Task 2 Step 6 and Task 3 Step 6 (drift fails frozen configure and the frozen dev launcher).
- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/tools/check-bundle-externals.test.ts` → `3 passed`.
- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent $(find smoke/run -name '*.test.ts') $(find smoke/check -name '*.test.ts') smoke/render/render-minimal.test.ts` → passed (the launcher change touches every dev-mode run).
- `quarto run --dev tools/check-runtime-boundary.ts` → `OK`, unchanged counts (no counted file changed).
- `Bundle Test` green on the three OSes.

## Review checklist

- [ ] `deno.lock` is committed, `.gitignore` no longer lists it, `deno.jsonc` and `deno-meta.json` both say `"lock": false`.
- [ ] One `deno install` call with the six entrypoints in `vendor.sh` and `vendor.cmd`; a failure is fatal; `--frozen` unless `QUARTO_DENO_LOCK_MODE=update`.
- [ ] Dev mode of both launchers uses `--lock=<root>/deno.lock --frozen` (overridable with `QUARTO_DENO_LOCK_OPTIONS`); release mode and the Rust launcher keep `--no-lock`.
- [ ] `quarto-bld`, `quarto-bld.cmd`, `bundle()` and `denoPlugins({ lockPath })` use the same lockfile; `tools/deno-esbuild-bundle.ts` has no `deno.land` import.
- [ ] `download.sh`/`download.bat` are frozen; `lock.sh` no longer passes `--lock-write`.
- [ ] The bundle gate runs on three OSes, builds from an empty dev cache, scans `quarto.js`, runs with an empty `DENO_DIR` after hiding `src/quarto.ts`, and asserts the five outputs exist.
- [ ] `kAllowedExternalSpecifiers` is empty, or every entry names the file and why Deno never executes it.

## Risks and rollback

- A platform-dependent lockfile (Task 8 Step 2) makes `configure` fail on one OS. Shows up in this PR's CI; resolved by committing the union. If Deno cannot produce one lockfile that is frozen-clean on all three OSes, drop `--frozen` from `vendor.cmd` only and record it in the PR (the bundle build on Linux/macOS stays frozen).
- A developer with uncommitted import-map experiments hits "The lockfile is out of date" in the dev launcher. The message names the fix; `QUARTO_DENO_LOCK_OPTIONS=--no-lock` is the escape hatch.
- `deno.jsonc` was hand-edited relative to `deno-meta.json` before this PR (`compilerOptions` exists only in `deno.jsonc`); regenerating it with `create-deno-config.ts` drops `compilerOptions`. Not changed here; whoever regenerates keeps that block by hand (`dev-docs/update-deno_jsonc.md`).
- The gate costs three OS jobs of about 15 minutes each (cold configure plus `prepare-dist` plus renders) per PR. If that is too slow, run the Windows and macOS legs only on `push` to `main` and on PRs that touch `src/import_map.json`, `deno.lock`, `package/**` or `tools/**`.
- Rollback: revert the commits; `.gitignore` ignores `deno.lock` again and every script returns to `--no-lock`.

## Decisions needed

1. **Tests stay on `--no-lock`.** `tests/run-tests.sh:72` and `run-tests.ps1:130` keep `--no-lock`. Locking the test runs would need every `tests/**/*.test.ts` as a lockfile entrypoint (about 700 files, over the Windows command-line limit for `vendor.cmd`), and the tests run against the cache that frozen `configure` just populated, so they resolve the locked versions anyway. Recommendation: keep `--no-lock` for tests until PR 31 moves them to Node and `package-lock.json`.

Review items closed here: S9 (no lockfile, bundle self-containment never checked), Phase 0 cross-cutting 1 (gate), 2 (lockfile), 3 (superset cache: `deno-cache: "false"` for the gate, `deno.lock` in the key), 4 (partly: `tools/deno-esbuild-bundle.ts:7`; the rest is PR 07's last task).
