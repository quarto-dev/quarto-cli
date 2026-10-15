# PR 20: Drop the native deno_dom plugin (`deno_dom/native`, `@denosaurs/plug`) from code, packaging and launchers, gated on `parseHtml` time

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After proving on three OSes that WASM `parseHtml` time on the largest website and book in `tests/docs` is at most 2× the native plugin's, remove the native path PR 05 left in `src/core/deno-dom.ts` (`import("deno_dom/native")`, which pulls `jsr:@denosaurs/plug`), the per-platform plugin download, its configuration and dev-config entries, the `DENO_DOM_PLUGIN`/`QUARTO_DENO_DOM` plumbing in every launcher and the conda recipe, and every `--unstable-ffi` flag.
**Phase:** 1. **Depends on:** PR 05 (deno_dom from JSR behind the `src/core/deno-dom.ts` seam; `tools/parsehtml-timing.sh` and `.github/workflows/parsehtml-timing.yml`; the native baseline), PR 00b (`package/scripts/vendoring/update-lock.sh`, the bundle gate in `test-bundle.yml`), PR 14 (`env.get` in `deno-dom.ts`), PR 02 (ratchet). **Unblocks:** PR 25, PR 33, PR 34.
**Branch:** `rt/20-remove-deno-dom-ffi`.
**Suggested executor:** Opus. A three-OS performance gate with a go/no-go decision, then five packaging surfaces (bash launcher, cmd launcher, Rust launcher, release workflow, conda recipe).
**Size:** M. 1 file deleted, 1 script created, about 25 files modified (`src/core/deno-dom.ts`, `src/core/devconfig.ts`, `src/core/run/deno.ts`, `configuration`, `configure.sh`, `package/src/common/{configure,prepare-dist}.ts`, `package/src/common/dependencies/dependencies.ts`, `package/src/util/deno.ts`, `package/src/macos/installer.ts`, `package/src/quarto-bld`, `package/src/quarto-bld.cmd`, `package/scripts/common/quarto`, `package/scripts/windows/quarto.cmd`, `package/scripts/deno_std/download.{sh,bat}`, `package/launcher/src/main.rs`, `package/conda-recipe/{meta.yaml,build.sh,bld.bat}`, `.github/workflows/{create-release,test-bundle,parsehtml-timing}.yml`, `tests/run-tests.sh`, `tests/run-tests.ps1`, `tests/binary-mode-strip-env.txt`, `tests/README.md`, 2 test files, `.vscode/launch.json`, `llm-docs/code-signing-installers.md`, changelog).
**Ships on:** Deno; the existing test suite must stay green.

## Spec

### Context

Assessment section 3.3, row `Deno.dlopen` FFI, and section 11 row `ffi`: drop the native plugin, keep deno_dom's WASM backend (already the fallback, and the only backend on Node). Decision 6 of the review: keep deno_dom on WASM with a gate on `parseHtml` function time, largest book and website in `tests/docs`, per OS including arm64 macOS and Windows, budget at most 2× the native plugin; evaluate `parse5`/`linkedom` only if the budget fails.

State after PR 05 (this plan's baseline, not `main` at `b86f98d`):

- `src/core/deno-dom.ts` imports `DOMParser`, `HTMLDocument`, `initParser` from `deno_dom/wasm-noinit` and re-exports it; `initDenoDom()` does `if (env.get("DENO_DOM_PLUGIN")) { try { await import("deno_dom/native"); debug("Loaded deno-dom-native"); … } catch { debug("Error loading deno-dom-native: …") } }` and then `await initParser()`. PR 05 already moved `Deno.dlopen` into the package and took its ratchet credit (`src` −1); there is no `Deno.dlopen` and no `register` import left in Quarto.
- `deno.lock` contains `jsr:@denosaurs/plug@1.1.0` (and its `@std` dependencies), present only because `deno install --entrypoint` follows the dynamic `import("deno_dom/native")`.
- `.github/workflows/test-bundle.yml` asserts that the release bundle logs `Loaded deno-dom-native` (PR 05 Task 6); `.github/workflows/parsehtml-timing.yml` and `tools/parsehtml-timing.sh` time `parseHtml` on `tests/docs/smoke-all/typst/margin-layout` (`--to html`, label `website`) and `tests/docs/books/visualization-curriculum` (`--to html`, label `book`), printing `label target run count total-ms max-ms` per render (PR 05 Task 7). PR 05's description holds the native medians per OS (`ubuntu-latest` x86_64, `macos-latest` arm64, `windows-latest` x86_64).
- `package/scripts/windows/quarto.cmd` points `DENO_DOM_PLUGIN` at `tools\x86_64\deno_dom\plugin.dll` (PR 05 Task 5).

Native-plugin references outside `src/` (verified on `main` at `b86f98d`, unchanged by PR 05 except where noted):

- `package/src/common/dependencies/deno_dom.ts` (57 lines, the per-platform download, `quarto-dev/deno-dom-apple-silicon` for darwin/aarch64), registered in `dependencies.ts:13,23`.
- `configuration:8,14-15` (comment, TODO, `export DENO_DOM=v0.1.41-alpha-artifacts`); `configure.sh:9`. `configure.cmd` has no `DENO_DOM`.
- `package/src/common/configure.ts:69-77` (`createDevConfig(..., Deno.env.get("DENO_DOM") || "", ...)`); `src/core/devconfig.ts:19-56,95-115,157-175` (`DevConfig.deno_dom`, `readConfig("DENO_DOM")`, `devConfigsEqual`, `reconfigureReason` "Deno Dom").
- `package/src/common/prepare-dist.ts:85-101` (the `try/catch` ignoring "missing the dependency deno_dom" on aarch64).
- `package/src/macos/installer.ts:127-147` (signs `deno_dom/libplugin.dylib`); `.github/workflows/create-release.yml:401` (signs `deno_dom/plugin.dll`).
- Launchers: `package/scripts/common/quarto:167-173` (`QUARTO_DENO_DOM` → `DENO_DOM_PLUGIN`) and `:186` (`--unstable-ffi`); `package/scripts/windows/quarto.cmd:118-121,131`; `package/launcher/src/main.rs:50,65-68,74,84,189-198`.
- Conda recipe: `package/conda-recipe/meta.yaml:3` (`load_file_regex(..., regex_pattern='export DENO_DOM=v([^-]+)').group(1)` fails with `None.group` once the line is gone), `:19` (`deno-dom` host requirement), `:23-32` (comments and `pin_compatible("deno-dom", ...)`); `build.sh:6,28,39` and `bld.bat:25,35` (`QUARTO_DENO_DOM=$DENO_DOM_PLUGIN` in the build env and the activate/deactivate scripts). The conda job in `create-release.yml` is `if: false`, so the breakage would be latent.
- `--unstable-ffi`: `package/src/util/deno.ts:56,88`; `package/src/quarto-bld:21`; `package/src/quarto-bld.cmd:13`; `package/scripts/deno_std/download.sh:13`, `download.bat:9`; `tests/run-tests.sh:72,268`; `tests/run-tests.ps1:130`; `src/core/run/deno.ts:64`; `tests/unit/harness-failure-reporting.test.ts:61`; `tests/unit/smoke-all-prerender-isolation.test.ts:170`; `.vscode/launch.json:17,47`; `tests/README.md:369` (a quoted command line in an example).
- Docs: `llm-docs/code-signing-installers.md:84,192` (the plugin in the signing lists).
- `tests/binary-mode-strip-env.txt:15` lists `QUARTO_DENO_DOM` (stripped from the environment of a `QUARTO_TEST_BIN` under test).

`QUARTO_DENO_DOM` is the user-facing override (`package/scripts/common/quarto:167`, `quarto.cmd:119`, `main.rs:65`); after this PR no Quarto reads it. That removal is explicit: changelog entry, and Task 6 keeps it in the binary-mode strip list with a comment because binary mode can test older releases that still read it.

### Scope

In: the performance gate; everything listed above; changelog entry.
Out: `--unstable-kv` (PR 30/33); `QUARTO_DENO` and the Deno binary download (PR 33); replacing deno_dom with another DOM (only if the gate fails, see Decisions); the generic deno_dom mentions in `src/resources/scripts/check-usage.sh:10-14`, `src/core/svg.ts:32` and `src/resources/formats/html/mermaid/mermaid-init.js:132` (they are about deno_dom's DOM behaviour, not the plugin).

### Interfaces

`src/core/deno-dom.ts` (changed body, same exports as after PR 05):

```ts
let s_DenoDomInitialized = false;
/** Loads the WASM HTML parser once per process. */
export async function initDenoDom(): Promise<void>;
```

`src/core/devconfig.ts` (changed):

```ts
export interface DevConfig { deno: string; pandoc: string; dartsass: string; esbuild: string; typst: string; script: string; importMap: string; } // deno_dom removed
export function createDevConfig(deno: string, pandoc: string, dartsass: string, esbuild: string, typst: string, scriptDir: string): DevConfig;
```

`tools/parsehtml-gate.sh` (new):

```bash
# tools/parsehtml-gate.sh <native.tsv> <wasm.tsv> [max-ratio, default 2.0]
# Reads parsehtml-timing.sh output; for each target (website, book) prints
# the median parseHtml total of each file and their ratio; exits 1 when a
# ratio exceeds max-ratio or a target is missing.
```

### Files

- Create: `tools/parsehtml-gate.sh`.
- Delete: `package/src/common/dependencies/deno_dom.ts`.
- Modify: `.github/workflows/parsehtml-timing.yml` (gate step, then WASM-only), `.github/workflows/test-bundle.yml` (native assertion inverted).
- Modify: `src/core/deno-dom.ts` (the native block and its comment); `deno.lock` (via `update-lock.sh`).
- Modify: `src/core/devconfig.ts:19-56,95-115,164-168`; `package/src/common/configure.ts:69-77`; `package/src/common/dependencies/dependencies.ts:13,23`; `package/src/common/prepare-dist.ts:85-101`; `package/src/macos/installer.ts:127-147`; `configuration:8,14-15`; `configure.sh:9`; `.github/workflows/create-release.yml:401`.
- Modify: `package/scripts/common/quarto:167-173,186`; `package/scripts/windows/quarto.cmd:118-121,131`; `package/launcher/src/main.rs:50,65-68,74,84,189-198`.
- Modify: `package/src/util/deno.ts:56,88`; `package/src/quarto-bld:21`; `package/src/quarto-bld.cmd:13`; `package/scripts/deno_std/download.sh:13`; `package/scripts/deno_std/download.bat:9`; `tests/run-tests.sh:72,268`; `tests/run-tests.ps1:130`; `src/core/run/deno.ts:64`; `tests/unit/harness-failure-reporting.test.ts:61`; `tests/unit/smoke-all-prerender-isolation.test.ts:170`; `.vscode/launch.json:17,47`; `tests/README.md:369`.
- Modify: `package/conda-recipe/meta.yaml:3,19,23-32`; `package/conda-recipe/build.sh:6,28,39`; `package/conda-recipe/bld.bat:25,35`; `llm-docs/code-signing-installers.md:84,192`; `tests/binary-mode-strip-env.txt:15`.
- Modify: `news/changelog-1.11.md` (`QUARTO_VERSION=1.11`; Phase 1 lands before the `v1.11` cut, decision 2), `tools/runtime-boundary-baseline.json`.

### Acceptance criteria

- The `parsehtml-timing.yml` run of Task 1 is green on `ubuntu-latest`, `macos-latest` (arm64) and `windows-latest`, with every WASM/native ratio ≤ 2.0 for both targets; the table and the run link are in the PR description.
- `grep -rn 'deno_dom/native\|denosaurs/plug\|DENO_DOM_PLUGIN\|unstable-ffi' src package configuration configure.sh configure.cmd tests .github .vscode llm-docs deno.lock -I | grep -v runtime-migration` prints nothing.
- `grep -rn 'DENO_DOM\|deno_dom' configuration configure.sh package/src package/scripts package/launcher package/conda-recipe .github src/core/devconfig.ts llm-docs/code-signing-installers.md -I` prints nothing; `grep -n QUARTO_DENO_DOM tests/binary-mode-strip-env.txt` prints the one kept line.
- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/core/deno-dom.test.ts smoke/render/render-html.test.ts unit/harness-failure-reporting.test.ts unit/smoke-all-prerender-isolation.test.ts smoke/run/run-script.test.ts` passes.
- `./configure.sh` succeeds on a clean checkout and creates no `tools/<arch>/deno_dom/` directory.
- `QUARTO_LOG_LEVEL=debug package/dist/bin/quarto render tests/docs/minimal.qmd --to html 2>&1 | grep -c deno-dom-native` prints `0`, in dev mode and in the bundle gate.
- The post-removal `parsehtml-timing.yml` run (Task 7) shows WASM medians within 1.25× of Task 1's WASM medians.
- Ratchet: no scope rises; `src` unchanged (PR 05 took the `Deno.dlopen` credit and PR 14 rewrote `Deno.env.get("DENO_DOM_PLUGIN")`; −1 if PR 14 had not), `package/src` −1 (`Deno.env.get("DENO_DOM")` in `configure.ts`, unless PR 24 already rewrote it to `env.get`); `--update-baseline` committed.

## Plan

### Task 1: The gate, before touching anything

Both parsers still exist on the branch base (PR 05 state): the native one when `DENO_DOM_PLUGIN` loads, WASM when `QUARTO_DENO_DOM=/nonexistent` makes the import fail. PR 05's workflow already times both in the same job, so the ratio is measured on the same runner, build and day.

**Files:**
- Create: `tools/parsehtml-gate.sh`
- Modify: `.github/workflows/parsehtml-timing.yml`

- [ ] **Step 1: Write the gate script**

`tools/parsehtml-gate.sh` (mode 755):

```bash
#!/usr/bin/env bash
#
# parsehtml-gate.sh
#
# Compare parseHtml timings written by tools/parsehtml-timing.sh: for each
# target (website, book) print the median total of each file and the ratio
# wasm/native; exit 1 when a ratio exceeds the budget (decision 6 of
# dev-docs/runtime-migration/REVIEW-2026-10-15.md: 2x the native plugin).
#
# Usage: tools/parsehtml-gate.sh <native.tsv> <wasm.tsv> [max-ratio]
#
# Copyright (C) 2026 Posit Software, PBC

set -euo pipefail
NATIVE="$1"
WASM="$2"
MAX="${3:-2.0}"

median() {
  awk -F'\t' -v t="$2" '$2 == t { print $5 }' "$1" | sort -n |
    awk '{ a[NR] = $1 } END { if (NR == 0) print "NA"; else if (NR % 2) print a[(NR + 1) / 2]; else print (a[NR / 2] + a[NR / 2 + 1]) / 2 }'
}

status=0
for target in website book; do
  n=$(median "$NATIVE" "$target")
  w=$(median "$WASM" "$target")
  verdict=$(awk -v w="$w" -v n="$n" -v m="$MAX" 'BEGIN {
    if (n == "NA" || w == "NA" || n + 0 <= 0) { print "NA\tFAIL"; exit }
    r = w / n; printf "%.2f\t%s\n", r, (r <= m + 0) ? "ok" : "FAIL" }')
  printf '%s\tnative-ms=%s\twasm-ms=%s\tratio=%s\n' "$target" "$n" "$w" "$verdict"
  case "$verdict" in *FAIL) status=1 ;; esac
done
exit $status
```

- [ ] **Step 2: Check the script on synthetic input**

```bash
d=$(mktemp -d)
printf 'native\twebsite\t1\t90\t1000\t5\nnative\twebsite\t2\t90\t1100\t5\nnative\twebsite\t3\t90\t900\t5\nnative\tbook\t1\t9\t400\t5\nnative\tbook\t2\t9\t420\t5\nnative\tbook\t3\t9\t410\t5\n' > "$d/n.tsv"
printf 'wasm\twebsite\t1\t90\t1800\t5\nwasm\twebsite\t2\t90\t1900\t5\nwasm\twebsite\t3\t90\t2100\t5\nwasm\tbook\t1\t9\t900\t5\nwasm\tbook\t2\t9\t880\t5\nwasm\tbook\t3\t9\t860\t5\n' > "$d/w.tsv"
tools/parsehtml-gate.sh "$d/n.tsv" "$d/w.tsv"; echo "exit $?"; rm -rf "$d"
```

Expected:

```
website	native-ms=1000	wasm-ms=1900	ratio=1.90	ok
book	native-ms=410	wasm-ms=880	ratio=2.15	FAIL
exit 1
```

- [ ] **Step 3: Add the gate step to `.github/workflows/parsehtml-timing.yml`**

After the "Time parseHtml (WASM, for information)" step add:

```yaml
      - name: Gate (WASM at most 2x native)
        shell: bash
        env:
          PARSEHTML_TIMING_OUT: ${{ runner.temp }}/parsehtml-timing
        run: |
          tools/parsehtml-gate.sh "$PARSEHTML_TIMING_OUT-native.tsv" "$PARSEHTML_TIMING_OUT-wasm.tsv" 2.0 | tee "$PARSEHTML_TIMING_OUT-gate.tsv"
```

and rename the WASM step to "Time parseHtml (WASM)".

- [ ] **Step 4: Commit, push, dispatch**

```bash
git add tools/parsehtml-gate.sh .github/workflows/parsehtml-timing.yml
git commit -m "parseHtml gate: WASM at most 2x the native plugin, per OS and target"
git push -u origin rt/20-remove-deno-dom-ffi
gh workflow run parsehtml-timing.yml --ref rt/20-remove-deno-dom-ffi -f runs=5
gh run watch "$(gh run list --workflow parsehtml-timing.yml --branch rt/20-remove-deno-dom-ffi --limit 1 --json databaseId -q '.[0].databaseId')"
```

Expected: three green jobs (`ubuntu-latest`, `macos-latest`, `windows-latest`). Download the artifacts (`gh run download <id>`) and put a table in the PR description: OS × target, native median, WASM median, ratio (from each job's `-gate.tsv`), next to PR 05's native medians for the same OS and target (a native median more than 1.5× away from PR 05's means the runner changed; note it, the ratio within one job is what gates).

If any job fails the gate: stop here. Do not remove the plugin. Record the numbers and take the "Decisions needed" item to the team.

### Task 2: `src/core/deno-dom.ts` without the native path

**Files:**
- Modify: `src/core/deno-dom.ts`, `deno.lock`

- [ ] **Step 1: Replace `initDenoDom` and its comment block**

Replace everything from the comment that starts `// The native backend lives in the package ("deno_dom/native").` through the end of `initDenoDom` with:

```ts
let s_DenoDomInitialized = false;
export async function initDenoDom() {
  if (s_DenoDomInitialized) {
    return;
  }
  await initParser();
  s_DenoDomInitialized = true;
}
```

Remove the `debug` import (`import { debug } from "../deno_ral/log.ts";`) and the `env` import if `grep -n 'debug(\|env\.' src/core/deno-dom.ts` shows no other use. Update the header comment's backend sentence to: `(WASM parser; the same on Deno and Node)`.

- [ ] **Step 2: Drop `@denosaurs/plug` from the lockfile**

Run: `package/scripts/vendoring/update-lock.sh --refresh`
then `git diff deno.lock | grep -c 'denosaurs/plug'`
Expected: a positive count of removed lines and `grep -c 'denosaurs/plug' deno.lock` prints `0`. Check `git diff --stat deno.lock` shows only removals related to `@denosaurs/plug` and its `@std` dependencies; if `--refresh` re-resolved unrelated ranges, revert `deno.lock`, run `update-lock.sh` without `--refresh`, and delete the now-unreferenced `jsr:@denosaurs/plug@1.1.0` entries by hand (the `jsr` map key, its `integrity`/`dependencies` block, and the `@std` packages only it required).

- [ ] **Step 3: Type-check and render**

Run: `cd src && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --import-map=import_map.json quarto.ts` → exit 0.
Run: `QUARTO_LOG_LEVEL=debug package/dist/bin/quarto render tests/docs/minimal.qmd --to html 2>&1 | grep -c 'deno-dom-native'` → `0`.
Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/core/deno-dom.test.ts smoke/render/render-html.test.ts` → pass.

- [ ] **Step 4: Commit**

```bash
git add src/core/deno-dom.ts deno.lock
git commit -m "deno-dom: WASM parser only; drop deno_dom/native and @denosaurs/plug"
```

### Task 3: Dependency download, configuration, dev-config

**Files:**
- Delete: `package/src/common/dependencies/deno_dom.ts`
- Modify: `package/src/common/dependencies/dependencies.ts:13,23`, `configuration:8,14-15`, `configure.sh:9`, `package/src/common/configure.ts:69-77`, `src/core/devconfig.ts`, `package/src/common/prepare-dist.ts:85-101`, `package/src/macos/installer.ts:127-147`, `.github/workflows/create-release.yml:401`

- [ ] **Step 1: Remove the dependency**

```bash
git rm package/src/common/dependencies/deno_dom.ts
```

In `dependencies.ts` delete line 13 (`import { deno_dom } from "./deno_dom.ts";`) and line 23 (`deno_dom(version("DENO_DOM")),`).

- [ ] **Step 2: `configuration` and `configure.sh`**

Delete from `configuration`: line 8 (`# deno_dom should match release at ...`), line 14 (`# TODO figure out where 0.1.41 apple silicon libs are available`), line 15 (`export DENO_DOM=v0.1.41-alpha-artifacts`). Delete `configure.sh:9` (`export DENO_DOM=${DENO_DOM_VERSION=$DENO_DOM}`).

- [ ] **Step 3: Dev config**

`src/core/devconfig.ts`: remove the `deno_dom` field from `DevConfig`, the `deno_dom` parameter from `createDevConfig` and from its returned object, the `readConfig("DENO_DOM"),` argument in `readSourceDevConfig` (lines 95–103), `a.deno_dom === b.deno_dom &&` in `devConfigsEqual`, and the `else if (installed.deno_dom !== source.deno_dom) { return versionMessage("Deno Dom", source.deno_dom); }` branch in `reconfigureReason`. The resulting `createDevConfig`:

```ts
export function createDevConfig(
  deno: string,
  pandoc: string,
  dartsass: string,
  esbuild: string,
  typst: string,
  scriptDir: string,
): DevConfig {
  const scriptPath = join(scriptDir, "quarto" + (isWindows ? ".cmd" : ""));
  const srcDir = env.get("QUARTO_SRC_PATH") ||
    join(quartoConfig.sharePath(), "../../src");
  return {
    deno,
    pandoc,
    dartsass,
    esbuild,
    typst,
    script: md5HashSync(readTextFileSync(scriptPath)),
    importMap: md5HashSync(
      readTextFileSync(
        join(srcDir, "import_map.json"),
      ),
    ),
  };
}
```

(`env.get`/`readTextFileSync` are the PR 10/14 forms; keep whatever the file has.)

`package/src/common/configure.ts:69-77`: delete the `Deno.env.get("DENO_DOM") || "",` argument (or `env.get(...)` if PR 24 rewrote it), leaving `DENO`, `PANDOC`, `DARTSASS`, `ESBUILD`, `TYPST`, `config.directoryInfo.bin`.

- [ ] **Step 4: `prepare-dist.ts:85-101`**

```ts
  // Download the dependencies
  for (const dependency of kDependencies) {
    await configArchDependency(dependency, targetDir, config);
  }
```

- [ ] **Step 5: `installer.ts:127-147` and `create-release.yml:401`**

Delete the two `denoDomPath`/`denoDomaarch64Path` blocks (lines 127–147) in `package/src/macos/installer.ts`. Delete line 401 (`./package/pkg-working/bin/tools/x86_64/deno_dom/plugin.dll`) in `.github/workflows/create-release.yml`.

- [ ] **Step 6: Verify configure and the dev-config reconfigure path**

Run: `grep -rn 'DENO_DOM\|deno_dom' configuration configure.sh configure.cmd package/src src/core/devconfig.ts .github -I` → nothing.
Run: `package/src/quarto-bld configure` → completes; `ls package/dist/bin/tools/x86_64/` shows no `deno_dom` directory (remove a stale one: `rm -rf package/dist/bin/tools/*/deno_dom`).
Run: `package/dist/bin/quarto --version` → the dev version; no reconfigure loop (an installed `config/dev-config` with a `deno_dom` key is ignored by `devConfigsEqual`).

- [ ] **Step 7: Commit**

```bash
git add -A package/src/common/dependencies package/src/common/configure.ts package/src/common/prepare-dist.ts package/src/macos/installer.ts src/core/devconfig.ts configuration configure.sh .github/workflows/create-release.yml
git commit -m "packaging: drop the native deno_dom dependency, DENO_DOM configuration and dev-config field"
```

### Task 4: Launchers, and `QUARTO_DENO_DOM` stops being read

**Files:**
- Modify: `package/scripts/common/quarto`, `package/scripts/windows/quarto.cmd`, `package/launcher/src/main.rs`

- [ ] **Step 1: `package/scripts/common/quarto`**

Delete the block at lines 167–173 (`if [ "$QUARTO_DENO_DOM" != "" ]; then ... fi`, both `export DENO_DOM_PLUGIN=` branches). On the `QUARTO_DENO_OPTIONS=` line (186) remove the `--unstable-ffi ` token only; leave the rest of the line as PR 00b left it:

```bash
sed -i 's/--unstable-ffi //' package/scripts/common/quarto
```

- [ ] **Step 2: `package/scripts/windows/quarto.cmd`**

Delete lines 118–121 (`set "DENO_DOM_PLUGIN=..."` and the `IF DEFINED QUARTO_DENO_DOM (...)` block). On the `QUARTO_DENO_OPTIONS` line (131) remove ` --unstable-ffi`:

```bash
sed -i 's/ --unstable-ffi//' package/scripts/windows/quarto.cmd
```

(The file has CRLF line endings; `sed -i` keeps them. Check with `file package/scripts/windows/quarto.cmd` → `with CRLF line terminators`.)

- [ ] **Step 3: `package/launcher/src/main.rs`**

Delete lines 65–68 (`let mut deno_dom_file ...` block), line 74 (`std::env::set_var("DENO_DOM_PLUGIN", &deno_dom_file);`), line 84 (`String::from("--unstable-ffi"),`), and lines 189–198 (the comment `// platform-specific deno dom lib file` and the three `DENO_DOM_LIB` constants with their `#[cfg]` attributes). Change the comment on line 50 to `// compute deno location (allow it to be defined externally)`.

Run: `cd package/launcher && cargo build 2>&1 | tail -2` → `Finished` (needs a Rust toolchain; if unavailable locally, rely on the release workflow's Windows job and say so in the PR).

- [ ] **Step 4: Re-copy the dev launcher and smoke-test it**

Run: `package/src/quarto-bld configure` (copies `package/scripts/common/quarto` into `package/dist/bin/`), then `package/dist/bin/quarto render tests/docs/minimal.qmd --to html` → renders.
Run: `printf 'console.log(Deno.env.get("DENO_DOM_PLUGIN") ?? "unset")\n' > "$(mktemp -d)/p.ts"` then `package/dist/bin/quarto run <that file>` → `unset`.
Run: `QUARTO_DENO_DOM=/anything package/dist/bin/quarto render tests/docs/minimal.qmd --to html` → renders, no mention of the variable (it is ignored).

- [ ] **Step 5: Commit**

```bash
git add package/scripts/common/quarto package/scripts/windows/quarto.cmd package/launcher/src/main.rs
git commit -m "launchers: drop DENO_DOM_PLUGIN, QUARTO_DENO_DOM and --unstable-ffi"
```

### Task 5: Remaining `--unstable-ffi` flags

**Files:** `package/src/util/deno.ts:56,88`, `package/src/quarto-bld:21`, `package/src/quarto-bld.cmd:13`, `package/scripts/deno_std/download.sh:13`, `package/scripts/deno_std/download.bat:9`, `tests/run-tests.sh:72,268`, `tests/run-tests.ps1:130`, `src/core/run/deno.ts:64`, `tests/unit/harness-failure-reporting.test.ts:61`, `tests/unit/smoke-all-prerender-isolation.test.ts:170`, `.vscode/launch.json:17,47`, `tests/README.md:369`

- [ ] **Step 1: Remove the flag at each site**

```bash
# whole-line array elements
sed -i '/denoBundleCmd.push("--unstable-ffi");/d' package/src/util/deno.ts
sed -i '/^ *"--unstable-ffi",$/d' src/core/run/deno.ts tests/unit/harness-failure-reporting.test.ts tests/unit/smoke-all-prerender-isolation.test.ts .vscode/launch.json
# tokens inside command lines
sed -i 's/ --unstable-ffi//' package/src/quarto-bld package/src/quarto-bld.cmd package/scripts/deno_std/download.sh package/scripts/deno_std/download.bat tests/run-tests.sh tests/run-tests.ps1 tests/README.md
grep -rn 'unstable-ffi' src package tests tools .github .vscode -I | grep -v runtime-migration
```

Expected: the final grep prints nothing. (`git diff --stat` shows one or two lines per file listed above and nothing else.)

- [ ] **Step 2: Verify**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/harness-failure-reporting.test.ts unit/smoke-all-prerender-isolation.test.ts smoke/run/run-script.test.ts` → pass (`run-script` covers `src/core/run/deno.ts`).
Run: `package/src/quarto-bld --help | head -3` → command list.

- [ ] **Step 3: Commit**

```bash
git add package/src/util/deno.ts package/src/quarto-bld package/src/quarto-bld.cmd package/scripts/deno_std tests/run-tests.sh tests/run-tests.ps1 src/core/run/deno.ts tests/unit/harness-failure-reporting.test.ts tests/unit/smoke-all-prerender-isolation.test.ts .vscode/launch.json tests/README.md
git commit -m "remove --unstable-ffi everywhere"
```

### Task 6: Conda recipe, docs, binary-mode strip list

**Files:** `package/conda-recipe/meta.yaml`, `package/conda-recipe/build.sh`, `package/conda-recipe/bld.bat`, `llm-docs/code-signing-installers.md`, `tests/binary-mode-strip-env.txt`

- [ ] **Step 1: Conda recipe**

`meta.yaml`: delete line 3 (`{% set deno_dom_version = ... %}`), the host requirement `- deno-dom  {{ deno_dom_version }}` (line 19), the run requirement `- {{ pin_compatible("deno-dom", max_pin="x.x.x") }}` and its two-line comment (`# we vendor deno-dom JS dependencies, ...`), and change the comment `# Deno, deno-dom and pandoc have proven to be fickle` to `# Deno and pandoc have proven to be fickle`.

`build.sh`: delete line 6 (`export QUARTO_DENO_DOM=$DENO_DOM_PLUGIN`), line 28 (`  export QUARTO_DENO_DOM=$DENO_DOM_PLUGIN` in the activate here-doc) and line 39 (`  unset QUARTO_DENO_DOM` in the deactivate here-doc).

`bld.bat`: delete line 25 (`  echo SET "QUARTO_DENO_DOM=%DENO_DOM_PLUGIN%"`) and line 35 (`  echo SET QUARTO_DENO_DOM=`).

Run: `grep -n -i 'deno.dom\|DENO_DOM' package/conda-recipe/*` → nothing.

- [ ] **Step 2: `llm-docs/code-signing-installers.md`**

Line 84: remove `, optional \`deno_dom/libplugin.dylib\`` from the "With entitlements" list. Line 192: remove `` `deno_dom/plugin.dll`, `` from the Windows list. Update the frontmatter `analyzed_date` to today and `main_commit` to `git merge-base HEAD main | cut -c1-9` (rule `.claude/rules/llm-docs-maintenance.md`).

- [ ] **Step 3: `tests/binary-mode-strip-env.txt`**

Keep `QUARTO_DENO_DOM` (binary mode can test a release that still reads it) and put this comment line directly above it:

```
# read by the launchers of Quarto releases before the native deno_dom plugin was removed
```

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/binary-mode-strip-env.test.ts` → pass (the list is parsed at import of `tests/quarto-cmd.ts`; a malformed line would throw).

- [ ] **Step 4: Commit**

```bash
git add package/conda-recipe llm-docs/code-signing-installers.md tests/binary-mode-strip-env.txt
git commit -m "conda recipe, signing docs, strip list: no native deno_dom plugin"
```

### Task 7: Bundle gate, timing workflow after removal, changelog, baseline

**Files:** `.github/workflows/test-bundle.yml`, `.github/workflows/parsehtml-timing.yml`, the changelog, `tools/runtime-boundary-baseline.json`

- [ ] **Step 1: Invert PR 05's bundle assertion**

In `.github/workflows/test-bundle.yml`, replace the block PR 05 added (`# the release bundle must load the native deno_dom plugin ...` through its `fi`) with:

```bash
          # the native deno_dom plugin is gone (PR 20): the bundle must not try to load it
          if grep -qi 'deno-dom-native' "$LOGS/html.log"; then
            grep -i 'deno-dom-native' "$LOGS/html.log"
            echo "::error::the bundled render still references the native deno_dom plugin"
            exit 1
          fi
```

- [ ] **Step 2: Timing workflow becomes WASM-only**

In `.github/workflows/parsehtml-timing.yml`: delete the steps "Native plugin is loaded", "Time parseHtml (native plugin)" and "Gate (WASM at most 2x native)"; remove `QUARTO_DENO_DOM: /nonexistent` from the WASM step's `env`; update the header comment to `# parseHtml timing (WASM) on the largest website and book in tests/docs, per OS. PR 20 gated the switch to WASM at <= 2x the native plugin; this keeps the measurement available. Manual only.`

- [ ] **Step 3: Confirm the timing after removal**

```bash
git add .github/workflows/test-bundle.yml .github/workflows/parsehtml-timing.yml
git commit -m "bundle gate and timing workflow: WASM-only deno_dom"
git push
gh workflow run parsehtml-timing.yml --ref rt/20-remove-deno-dom-ffi -f runs=5
```

Expected: three green jobs; each target's WASM median within 1.25× of the Task 1 WASM median for the same OS (the code path is the same; a larger difference means noise or a regression introduced by Tasks 2–6). Add the row to the PR table.

- [ ] **Step 4: Changelog and baseline**

Append to `news/changelog-1.11.md` (create it with the heading the other changelog files use if it does not exist yet), following `.claude/rules/changelog.md`:

```markdown
- Quarto no longer ships a native `deno_dom` plugin; HTML post-processing uses deno_dom's WebAssembly parser on every platform. The `QUARTO_DENO_DOM` environment variable is no longer read.
```

Run: `quarto run --dev tools/check-runtime-boundary.ts --update-baseline` → no scope rises; `package/src` lower by 1 (or unchanged if PR 24 already rewrote `configure.ts`), `src` unchanged (or −1, see Acceptance criteria).

- [ ] **Step 5: Commit**

```bash
git add news tools/runtime-boundary-baseline.json
git commit -m "changelog: native deno_dom plugin removed; ratchet baseline"
```

## Verification

- Task 1 run green on three OSes with every ratio ≤ 2.0; Task 7 run green with WASM medians within 1.25× of Task 1's.
- Acceptance greps → as stated.
- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/core/deno-dom.test.ts smoke/render/render-html.test.ts $(find smoke/project/ -name '*.test.ts') smoke/run/run-script.test.ts unit/harness-failure-reporting.test.ts unit/smoke-all-prerender-isolation.test.ts` → pass.
- `./configure.sh` from a clean clone → succeeds; no `deno_dom` under `package/dist/bin/tools`.
- CI: `test-bundle.yml` green on three OSes (bundle built without `@denosaurs/plug`, no native-plugin message); `create-release.yml` dispatched without publishing on a branch if the team's process allows, to exercise the Windows signing list and the Rust launcher.

## Review checklist

- [ ] The gate ran before any removal commit, on all three OSes, both targets, and the table is in the PR.
- [ ] `initDenoDom` body is the WASM init only; no `deno_dom/native` import, no env var read, no `debug` left unused.
- [ ] `deno.lock` no longer contains `@denosaurs/plug`; no unrelated lock changes.
- [ ] `kDependencies` no longer lists deno_dom; `archive-binary-dependencies.ts` needs no change (it iterates `kDependencies`).
- [ ] Dev-config comparison still reconfigures on Deno/Pandoc/Sass/esbuild/Typst changes.
- [ ] Rust launcher compiles; `DENO_DOM_PLUGIN` set nowhere; `QUARTO_DENO_DOM` read nowhere (kept only in the binary-mode strip list, with its comment).
- [ ] Conda recipe renders (`conda build --render package/conda-recipe` if conda-build is available; otherwise the grep), since its job is disabled in CI.
- [ ] `--unstable-kv` untouched everywhere.
- [ ] The ratchet credit for `Deno.dlopen` is not claimed again (PR 05 took it).

## Risks and rollback

- WASM `parseHtml` is slower than native per call; the gate measures it on the two largest targets per OS. Render time is dominated by Pandoc and engines, so a ratio under 2 on `parseHtml` total is a small share of a render.
- Users who set `QUARTO_DENO_DOM` to a custom build lose that override (changelog).
- Old dev checkouts keep a `deno_dom` directory under `package/dist/bin/tools`; harmless.
- The conda recipe is not exercised in CI (`if: false`); a mistake there shows up only when someone re-enables it.
- Rollback: revert the commits after Task 1 (the gate script and workflow step are harmless to keep); `./configure.sh` re-downloads the plugin and `update-lock.sh` restores `@denosaurs/plug` in the lockfile.

## Decisions needed

Only if the Task 1 gate fails (a WASM/native `parseHtml` ratio above 2.0 for a target on an OS):

- Option A: evaluate `parse5` or `linkedom` behind `src/core/deno-dom.ts` (decision 6's fallback). About 1,900 DOM call sites depend on deno_dom's API surface, so this is a compatibility layer, multi-week; time it with the same script before committing to it.
- Option B: keep the native path on Deno (as after PR 05) until PR 37 and ship WASM only on Node. Keeps `--unstable-ffi`, the plugin download and `@denosaurs/plug` for the whole Deno lifetime; PR 25's boundary is unaffected (the `dlopen` lives in the package).
- Option C: accept the measured ratio with the numbers in the PR and an issue opened.

Recommendation: C if the failing ratio is under 3 and the target's whole-render time grows by less than 10%; otherwise A, with B as the stopgap while A is evaluated.
