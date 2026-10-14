# PR 20: Drop `Deno.dlopen` and the native deno_dom plugin from code, packaging and launchers

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the FFI path from `src/core/deno-dom.ts` (so the WASM parser is the only one), delete the per-platform native plugin download, its `configuration`/dev-config entries, the `DENO_DOM_PLUGIN`/`QUARTO_DENO_DOM` plumbing in the launchers, and every `--unstable-ffi` flag; measure that WASM parsing does not slow HTML rendering by more than 10%.
**Phase:** 1. **Depends on:** PR 05 (deno_dom from `jsr:@b-fuze/deno-dom`), PR 02 (ratchet). **Unblocks:** PR 25, PR 33, PR 34.
**Branch:** `rt/20-remove-deno-dom-ffi`.
**Suggested executor:** Opus. Touches four packaging surfaces (bash launcher, cmd launcher, Rust launcher, release workflow) plus a performance gate with a go/no-go decision.
**Size:** M. 1 file deleted, 18 modified (`src/core/deno-dom.ts`, `src/core/devconfig.ts`, `configuration`, `configure.sh`, `package/src/common/{configure,prepare-dist,cyclic-dependencies}.ts`, `package/src/common/dependencies/dependencies.ts`, `package/src/util/deno.ts`, `package/src/macos/installer.ts`, `package/src/quarto-bld`, `package/src/quarto-bld.cmd`, `package/scripts/common/quarto`, `package/scripts/windows/quarto.cmd`, `package/scripts/deno_std/download.{sh,bat}`, `package/launcher/src/main.rs`, `.github/workflows/create-release.yml`, `tests/run-tests.sh`, `tests/run-tests.ps1`, `src/core/run/deno.ts`, 2 test files, changelog).
**Ships on:** Deno; the existing test suite must stay green.

## Spec

### Context

Assessment section 3.3, row `Deno.dlopen` FFI: `src/core/deno-dom.ts` loads the native `deno_dom` plugin shipped per platform under `bin/tools/<arch>/deno_dom/`; the replacement is to drop the native plugin, since deno_dom's WASM backend is already the fallback and is Node-compatible on JSR, and to measure parse time on large HTML outputs. Section 11 module plan row `ffi`: remove (1 site), drop the native plugin and its per-platform download in `package/src/common/dependencies/deno_dom.ts`.

Verified sites (2026-10-14):

- `src/core/deno-dom.ts:53-185`: `initDenoDom()` reads `DENO_DOM_PLUGIN`, calls `Deno.dlopen` (line 82) with five symbols, builds `parse`/`parseFrag` on the dylib, registers them via `register()` from `deno_dom/src/parser.ts`, and falls back to `initParser()` (WASM) on any error or when the env var is unset.
- `package/src/common/dependencies/deno_dom.ts` (57 lines): downloads `libplugin.{so,dylib}`/`plugin.dll` from `b-fuze/deno-dom` releases (and `quarto-dev/deno-dom-apple-silicon` for darwin/aarch64) into `tools/<arch>/deno_dom/`; registered in `dependencies.ts:13,23` as `deno_dom(version("DENO_DOM"))`.
- `configuration:8,14-15`: comment, TODO and `export DENO_DOM=v0.1.41-alpha-artifacts`. `configure.sh:9`: `export DENO_DOM=${DENO_DOM_VERSION=$DENO_DOM}`. `configure.cmd` has no `DENO_DOM` reference (verified with `grep -n DENO_DOM configure.cmd`).
- `package/src/common/configure.ts:69-77`: `createDevConfig(Deno.env.get("DENO") || "", Deno.env.get("DENO_DOM") || "", ...)`; `src/core/devconfig.ts:19-56,95-115,157-175`: `DevConfig.deno_dom`, the `createDevConfig` parameter, `readConfig("DENO_DOM")`, `devConfigsEqual`, `reconfigureReason` ("Deno Dom").
- `package/src/common/prepare-dist.ts:85-101`: the `try/catch` that ignores `"The architecture aarch64 is missing the dependency deno_dom"` (needed only because of this dependency).
- `package/src/macos/installer.ts:127-147`: adds `tools/{x86_64,aarch64}/deno_dom/libplugin.dylib` to `signWithEntitlements` when present.
- `.github/workflows/create-release.yml:401`: signs `./package/pkg-working/bin/tools/x86_64/deno_dom/plugin.dll`.
- Launchers: `package/scripts/common/quarto:167-173` (`QUARTO_DENO_DOM`/`DENO_DOM_PLUGIN`), `:186` (`--unstable-ffi`); `package/scripts/windows/quarto.cmd:118-121`, `:131`; `package/launcher/src/main.rs:65-68,74,84,189-198`.
- `--unstable-ffi` elsewhere: `package/src/util/deno.ts:56,88`; `package/src/quarto-bld:21`; `package/src/quarto-bld.cmd:13`; `package/scripts/deno_std/download.sh:13`, `download.bat:9`; `tests/run-tests.sh:72,268`; `tests/run-tests.ps1:130`; `src/core/run/deno.ts:64`; `tests/unit/harness-failure-reporting.test.ts:61`; `tests/unit/smoke-all-prerender-isolation.test.ts:170`. `package/src/common/cyclic-dependencies.ts:153` passes the legacy `--unstable` to `deno info`; it is removed too (PR 24 replaces that call anyway).
- No `dev-docs/*.md` mentions `DENO_DOM`/`unstable-ffi` (verified with `grep -rln 'DENO_DOM\|deno_dom\|unstable-ffi' dev-docs *.md .github`; only `create-release.yml` matched).

Assumption about PR 05: after it, `src/core/deno-dom.ts` imports `deno_dom/deno-dom-wasm-noinit.ts`, `deno_dom/src/parser.ts` and `deno_dom/src/dom/dom-parser.ts` through import-map keys that now resolve to `jsr:@b-fuze/deno-dom@0.1.x`, and still exports `initDenoDom`, `parseHtml`, `getDomParser`, `writeDomToHtmlFile`, `DOMParser`, `Node`, `NodeType` and `export * from "deno_dom/src/api.ts"`. If PR 05 renamed those specifiers, keep PR 05's; only the body of `initDenoDom` changes here.

### Scope

In: everything listed above; a performance measurement with a recorded result; changelog entry.
Out: `--unstable-kv` (PR 30/33); `QUARTO_DENO` and the Deno binary download (PR 33); replacing deno_dom with another DOM (only if the performance gate fails, see Decisions).

### Interfaces

`src/core/deno-dom.ts` (changed body, same exports):

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

### Files

- Delete: `package/src/common/dependencies/deno_dom.ts`.
- Modify: `src/core/deno-dom.ts:7-11,45-185`; `src/core/devconfig.ts:19-56,95-115,164-168`; `package/src/common/configure.ts:69-77`; `package/src/common/dependencies/dependencies.ts:13,23`; `package/src/common/prepare-dist.ts:85-101`; `package/src/macos/installer.ts:127-147`; `package/src/common/cyclic-dependencies.ts:153`; `package/src/util/deno.ts:56,88`; `package/src/quarto-bld:21`; `package/src/quarto-bld.cmd:13`; `configuration:8,14-15`; `configure.sh:9`; `package/scripts/common/quarto:167-173,186`; `package/scripts/windows/quarto.cmd:118-121,131`; `package/scripts/deno_std/download.sh:13`; `package/scripts/deno_std/download.bat:9`; `package/launcher/src/main.rs:65-68,74,84,189-198`; `.github/workflows/create-release.yml:401`; `tests/run-tests.sh:72,268`; `tests/run-tests.ps1:130`; `src/core/run/deno.ts:64`; `tests/unit/harness-failure-reporting.test.ts:61`; `tests/unit/smoke-all-prerender-isolation.test.ts:170`; `news/changelog-1.11.md`; `tools/runtime-boundary-baseline.json`.

### Acceptance criteria

- `grep -rn 'dlopen\|DENO_DOM\|deno_dom\|unstable-ffi\|QUARTO_DENO_DOM' src package configuration configure.sh configure.cmd tests/run-tests.sh tests/run-tests.ps1 .github tests/unit --include=* -I | grep -v 'runtime-migration' | grep -v 'import.*deno_dom/'` prints nothing (the `deno_dom/` import-map key for the JSR package legitimately remains in `src/import_map.json` and `src/core/deno-dom.ts`).
- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/render/render-html.test.ts smoke/project/ unit/harness-failure-reporting.test.ts unit/smoke-all-prerender-isolation.test.ts` passes.
- `./configure.sh` succeeds on a clean checkout with no `tools/<arch>/deno_dom/` directory created (CI `test-bundle.yml` and the release workflow run it).
- `package/dist/bin/quarto render tests/docs/smoke-all/2023/05/24/5657-raw.qmd` with `QUARTO_LOG_LEVEL=DEBUG` no longer prints `Loaded deno-dom-native` or `Error loading deno-dom-native`.
- Performance gate (Task 1): median wall time of the WASM render ≤ 1.10 × median of the native render for both benchmark inputs, numbers recorded in the PR description.
- Baseline count for `src/` lower by 1 (`Deno.dlopen`), or by 2 if PR 14 had not yet rewritten the `Deno.env.get("DENO_DOM_PLUGIN")` at `deno-dom.ts:58`; `--update-baseline` committed.

## Plan

### Task 1: Measure before touching anything

Both parsers exist on `main` today, selected by `DENO_DOM_PLUGIN`. The launcher sets that variable from `QUARTO_DENO_DOM` when given (`package/scripts/common/quarto:167-168`), so pointing it at a non-existent file forces the WASM fallback on the same build. That gives a like-for-like comparison without a rebuild.

**Files:** none (results go in the PR description).

- [ ] **Step 1: Pick the inputs**

1. Large single HTML document: `tests/docs/smoke-all/2023/05/24/5657-raw.qmd` (29 KB of raw HTML tables; the whole output goes through `parseHtml` in HTML post-processing).
2. Website project: `tests/docs/websites/search` (several pages; each rendered page and the search index go through the DOM).

- [ ] **Step 2: Native baseline (5 runs each, record wall time and `parseHtml` function time)**

```bash
cd /path/to/quarto-cli
for i in 1 2 3 4 5; do
  /usr/bin/time -f "%e s" env QUARTO_REPORT_PERFORMANCE_METRICS=functionTimes \
    package/dist/bin/quarto render tests/docs/smoke-all/2023/05/24/5657-raw.qmd --to html 2>&1 \
    | grep -E '^[0-9.]+ s$|"parseHtml"' -A2
done
for i in 1 2 3 4 5; do
  /usr/bin/time -f "%e s" package/dist/bin/quarto render tests/docs/websites/search 2>&1 | tail -1
done
```

Expected: five wall-clock lines per input (e.g. `2.41 s`) and, for the single document, the `parseHtml` entry of the `functionTimes` metric (`QUARTO_REPORT_PERFORMANCE_METRICS=functionTimes` prints a JSON block to stdout at exit; see `src/core/performance/metrics.ts:61-72`). On macOS, `/usr/bin/time` has no `-f`; use `time` from the shell and read `real`.

- [ ] **Step 3: WASM on the same build**

Repeat Step 2 with `QUARTO_DENO_DOM=/nonexistent/libplugin.so` prepended to each command (on Windows set `QUARTO_DENO_DOM=C:\nonexistent\plugin.dll`). Confirm the fallback is in effect once with `QUARTO_LOG_LEVEL=DEBUG ... 2>&1 | grep 'Error loading deno-dom-native'`.

- [ ] **Step 4: Compute and record**

Median of the five wall times per input per parser. Write a table in the PR description:

```
| Input | native median (s) | WASM median (s) | ratio |
| 5657-raw.qmd | | | |
| websites/search | | | |
| parseHtml total, 5657-raw.qmd (ms) | | | |
```

Gate: both ratios ≤ 1.10. If either exceeds it, stop here, keep the numbers, and open the decision in the "Decisions needed" section (do not land the removal on a failed gate).

### Task 2: `src/core/deno-dom.ts` without the native path

**Files:**
- Modify: `src/core/deno-dom.ts:7-11,45-185`

- [ ] **Step 1: Replace lines 45–185 with**

```ts
let s_DenoDomInitialized = false;
export async function initDenoDom() {
  if (!s_DenoDomInitialized) {
    await initParser();
    s_DenoDomInitialized = true;
  }
}
```

- [ ] **Step 2: Drop the now-unused imports**

Remove `import { register } from "deno_dom/src/parser.ts";` (line 10) and `import { debug } from "../deno_ral/log.ts";` (line 7) if `grep -n 'debug(' src/core/deno-dom.ts` shows no other use. Keep `HTMLDocument`, `initParser`, `DOMParser`, `makeTimedFunctionAsync`.

- [ ] **Step 3: Type-check and render**

Run: `cd src && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --unstable-ffi --import-map=import_map.json quarto.ts` → exit 0 (the `--unstable-ffi` flag is still accepted; it goes away in Task 5).
Run: `QUARTO_LOG_LEVEL=DEBUG package/dist/bin/quarto render tests/docs/smoke-all/2023/05/24/5657-raw.qmd 2>&1 | grep -c 'deno-dom-native'` → `0`.
Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/render/render-html.test.ts` → pass.

- [ ] **Step 4: Commit**

```bash
git add src/core/deno-dom.ts
git commit -m "deno-dom: remove the Deno.dlopen native plugin path; WASM parser only"
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

`src/core/devconfig.ts`:

```ts
export interface DevConfig {
  deno: string;
  pandoc: string;
  dartsass: string;
  esbuild: string;
  typst: string;
  script: string;
  importMap: string;
}

export function createDevConfig(
  deno: string,
  pandoc: string,
  dartsass: string,
  esbuild: string,
  typst: string,
  scriptDir: string,
): DevConfig {
  const scriptPath = join(scriptDir, "quarto" + (isWindows ? ".cmd" : ""));
  const srcDir = Deno.env.get("QUARTO_SRC_PATH") ||
    join(quartoConfig.sharePath(), "../../src");
  return {
    deno,
    pandoc,
    dartsass,
    esbuild,
    typst,
    script: md5HashSync(Deno.readTextFileSync(scriptPath)),
    importMap: md5HashSync(
      Deno.readTextFileSync(
        join(srcDir, "import_map.json"),
      ),
    ),
  };
}
```

(`Deno.env.get`/`Deno.readTextFileSync` here are PR 10/14 codemod sites; if those landed, keep their layer forms.)

In `readSourceDevConfig` (lines 95–103) delete the `readConfig("DENO_DOM"),` argument. In `devConfigsEqual` delete `a.deno_dom === b.deno_dom &&`. In `reconfigureReason` delete the `else if (installed.deno_dom !== source.deno_dom) { return versionMessage("Deno Dom", source.deno_dom); }` branch.

`package/src/common/configure.ts:69-77`:

```ts
  const devConfig = createDevConfig(
    Deno.env.get("DENO") || "",
    Deno.env.get("PANDOC") || "",
    Deno.env.get("DARTSASS") || "",
    Deno.env.get("ESBUILD") || "",
    Deno.env.get("TYPST") || "",
    config.directoryInfo.bin,
  );
```

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

Run: `grep -rn 'DENO_DOM\|deno_dom' configuration configure.sh configure.cmd package/src src/core/devconfig.ts .github` → nothing.
Run: `package/src/quarto-bld configure` → completes; `ls package/dist/bin/tools/x86_64/` shows no `deno_dom` directory (remove a stale one by hand: `rm -rf package/dist/bin/tools/*/deno_dom`).
Run: `package/dist/bin/quarto --version` → the dev version; no "reconfigure" prompt loop (the installed `config/dev-config` JSON may still contain a `deno_dom` key; `devConfigsEqual` ignores it).

- [ ] **Step 7: Commit**

```bash
git add -A package/src/common/dependencies package/src/common/configure.ts package/src/common/prepare-dist.ts package/src/macos/installer.ts src/core/devconfig.ts configuration configure.sh .github/workflows/create-release.yml
git commit -m "packaging: drop the native deno_dom dependency, DENO_DOM configuration and dev-config field"
```

### Task 4: Launchers

**Files:**
- Modify: `package/scripts/common/quarto:167-173,186`, `package/scripts/windows/quarto.cmd:118-121,131`, `package/launcher/src/main.rs:65-68,74,84,189-198`

- [ ] **Step 1: `package/scripts/common/quarto`**

Delete lines 167–173 (the `QUARTO_DENO_DOM` / `DENO_DOM_PLUGIN` block). Line 186 becomes:

```bash
QUARTO_DENO_OPTIONS="--unstable-kv --no-config --no-lock ${QUARTO_CACHE_OPTIONS} --allow-all ${QUARTO_DENO_OPTIONS}"
```

- [ ] **Step 2: `package/scripts/windows/quarto.cmd`**

Delete lines 118–121 (`set "DENO_DOM_PLUGIN=..."` and the `IF DEFINED QUARTO_DENO_DOM` block). Line 131 becomes:

```bat
SET "QUARTO_DENO_OPTIONS=--unstable-kv --no-config --no-lock --allow-all !QUARTO_DENO_OPTIONS!"
```

- [ ] **Step 3: `package/launcher/src/main.rs`**

Delete lines 65–68 (`let mut deno_dom_file ...` block), line 74 (`std::env::set_var("DENO_DOM_PLUGIN", &deno_dom_file);`), line 84 (`String::from("--unstable-ffi"),`), and lines 189–198 (the three `DENO_DOM_LIB` constants with their `#[cfg]` attributes and the comment above). Update the comment on line 50 to `// compute deno location (allow it to be defined externally)`.

Run: `cd package/launcher && cargo build 2>&1 | tail -2` → `Finished` (needs a Rust toolchain; if unavailable locally, rely on the release workflow's Windows job and say so in the PR).

- [ ] **Step 4: Re-copy the dev launcher and smoke-test it**

Run: `package/src/quarto-bld configure` (copies `package/scripts/common/quarto` into `package/dist/bin/`), then `package/dist/bin/quarto render tests/docs/smoke-all/2023/05/24/5657-raw.qmd` → renders; `env | grep DENO_DOM` inside a `quarto run` script prints nothing: `echo 'console.log(Deno.env.get("DENO_DOM_PLUGIN") ?? "unset")' > /tmp/p.ts && package/dist/bin/quarto run /tmp/p.ts` → `unset`.

- [ ] **Step 5: Commit**

```bash
git add package/scripts/common/quarto package/scripts/windows/quarto.cmd package/launcher/src/main.rs
git commit -m "launchers: drop DENO_DOM_PLUGIN/QUARTO_DENO_DOM and --unstable-ffi"
```

### Task 5: Remaining `--unstable-ffi` flags

**Files:** `package/src/util/deno.ts:56,88`, `package/src/quarto-bld:21`, `package/src/quarto-bld.cmd:13`, `package/scripts/deno_std/download.sh:13`, `package/scripts/deno_std/download.bat:9`, `tests/run-tests.sh:72,268`, `tests/run-tests.ps1:130`, `src/core/run/deno.ts:64`, `tests/unit/harness-failure-reporting.test.ts:61`, `tests/unit/smoke-all-prerender-isolation.test.ts:170`, `package/src/common/cyclic-dependencies.ts:153`

- [ ] **Step 1: Delete the flag at each site**

- `package/src/util/deno.ts`: delete lines 56 and 88 (`denoBundleCmd.push("--unstable-ffi");`).
- `package/src/quarto-bld:21` and `quarto-bld.cmd:13`: remove ` --unstable-ffi` from the `deno run` line.
- `package/scripts/deno_std/download.sh:13` and `download.bat:9`: remove ` --unstable-ffi`.
- `tests/run-tests.sh:72`: `QUARTO_DENO_OPTIONS="--config test-conf.json --v8-flags=--enable-experimental-regexp-engine,--max-old-space-size=8192,--max-heap-size=8192 --unstable-kv --no-lock --allow-all"`; line 268: `deno coverage --unstable-kv ${COV} --lcov`.
- `tests/run-tests.ps1:130`: same string without ` --unstable-ffi`.
- `src/core/run/deno.ts:64`: delete the `"--unstable-ffi",` array element.
- `tests/unit/harness-failure-reporting.test.ts:61` and `tests/unit/smoke-all-prerender-isolation.test.ts:170`: delete the `"--unstable-ffi",` element.
- `package/src/common/cyclic-dependencies.ts:153`: delete `"--unstable",`.

- [ ] **Step 2: Verify**

Run: `grep -rn 'unstable-ffi\|"--unstable"' src package tests tools .github --include=* -I | grep -v runtime-migration` → nothing.
Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/harness-failure-reporting.test.ts unit/smoke-all-prerender-isolation.test.ts smoke/run/run-script.test.ts` → pass (`run-script` covers `src/core/run/deno.ts`).

- [ ] **Step 3: Changelog and baseline**

Append to `news/changelog-1.11.md`:

```markdown
- Quarto no longer ships a native `deno_dom` plugin; HTML post-processing uses the WebAssembly parser on every platform. The `QUARTO_DENO_DOM` environment variable is no longer read.
```

Run: `quarto run --dev tools/check-runtime-boundary.ts --update-baseline` → `src/` `denoCalls` lower by 1 (or 2, see Acceptance criteria).

- [ ] **Step 4: Commit**

```bash
git add package/src/util/deno.ts package/src/quarto-bld package/src/quarto-bld.cmd package/scripts/deno_std tests/run-tests.sh tests/run-tests.ps1 src/core/run/deno.ts tests/unit/harness-failure-reporting.test.ts tests/unit/smoke-all-prerender-isolation.test.ts package/src/common/cyclic-dependencies.ts news/changelog-1.11.md tools/runtime-boundary-baseline.json
git commit -m "remove --unstable-ffi everywhere; changelog; ratchet baseline"
```

### Task 6: Confirm the measurement after the change

- [ ] **Step 1:** Rerun Task 1 step 2 on the branch build (no `QUARTO_DENO_DOM`); medians should match the WASM column from Task 1 within noise. Add the row to the PR table.

## Verification

- Acceptance grep (above) → empty.
- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/render/render-html.test.ts smoke/project/ smoke/run/run-script.test.ts unit/harness-failure-reporting.test.ts unit/smoke-all-prerender-isolation.test.ts` → pass.
- `./configure.sh` from a clean clone → succeeds; no `deno_dom` under `package/dist/bin/tools`.
- CI: `test-bundle.yml` green (bundling with `package/src/util/deno.ts`), `create-release.yml` dispatched with no-publish on a fork or branch if the team's process allows, to exercise the Windows signing list and the Rust launcher.
- Performance table in the PR description with both ratios ≤ 1.10.

## Review checklist

- [ ] `initDenoDom` body is the WASM init only; no `register`, no env var read.
- [ ] `kDependencies` no longer lists deno_dom; `archive-binary-dependencies.ts` needs no change (it iterates `kDependencies`).
- [ ] Dev-config comparison still reconfigures on Deno/Pandoc/Sass/esbuild/Typst changes.
- [ ] Rust launcher compiles; `DENO_DOM_PLUGIN` not set anywhere.
- [ ] `--unstable-kv` untouched everywhere.
- [ ] Performance numbers present and under the threshold.

## Risks and rollback

- WASM parser initialisation happens once per process (~tens of ms); render-heavy sessions (preview, websites) amortise it. The gate in Task 1 measures exactly this.
- Users who set `QUARTO_DENO_DOM` to a custom build lose that override (documented in the changelog).
- Old dev checkouts keep a `deno_dom` directory under `package/dist/bin/tools`; harmless, removed by the next `configure.sh` cache wipe.
- Rollback: revert the five commits; `./configure.sh` re-downloads the plugin.

## Decisions needed

Only if the Task 1 gate fails (WASM > 10% slower on either input):

- Option A: accept the regression for the migration's sake and track an optimisation issue. Cheapest; render time is dominated by Pandoc and engines, so a 10–20% DOM share rarely moves the total.
- Option B: keep the FFI path on Deno behind the same `initDenoDom` and remove it only at the flip (PR 37). Keeps `Deno.dlopen` and `--unstable-ffi` alive for the whole of Phase 1 and 2, contradicting the zero-boundary goal of PR 25.
- Option C: evaluate `linkedom` or `parse5` as the DOM behind `src/core/deno-dom.ts` (assessment section 3.3). About 1,900 DOM call sites depend on deno_dom's API surface; a compatibility layer is a multi-week task.

Recommendation: A, with the measured numbers in the PR and an issue opened; revisit only if the ratio exceeds 1.25.
