# PR 37: Stop downloading Deno; remove the Deno CI matrix, the dual-runtime switch, vendoring, `deno.jsonc`, `deno_std`; docs sweep; backport protocol

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove everything that exists only because Quarto ran on Deno: `configure`/`prepare-dist` stop downloading Deno (the tool stays available through `quarto install deno`), the `QUARTO_RUNTIME` dual-runtime window closes if PR 33 opened it, the nightly Deno CI matrix and the Deno branch of the test runners go, the vendoring and `deno_std` machinery and `deno.jsonc` are deleted, and the developer documentation describes the Node toolchain and the backport protocol.
**Phase:** 3. **Depends on:** PR 33, 34, 35, 36 (no CLI code path needs a bundled Deno any more), PR 39 (`test-quarto-latexmk.yml` and `compile-quarto-latexmk.ts` used `deno compile`). **Unblocks:** PR 38.
**Branch:** `rt/37-ci-switch-and-deno-removal`.
**Suggested executor:** Sonnet. Deletions and documentation edits from a precise inventory; the only judgement is in Task 2 (removing Deno branches from `src/deno_ral/`), which has explicit rules.
**Size:** M (about 45 files deleted or edited).
**Ships on:** Node. Gates: every workflow in `.github/workflows/` green on the branch; `tools/check-runtime-boundary.ts` at zero in every scope including `src/deno_ral/`; `create-release.yml` dispatched once.

## Spec

### Context

Assessment Phase 4 step 2, review S5 and S11, decisions 1 and 2. After PRs 33-36: the CLI runs on Node; `quarto run` scripts default to Node and reach Deno only through `QUARTO_RUN_RUNTIME=deno`/`project.script-runtime: deno` via `requireDenoToolBinary()`; `build-ts-extension` uses esbuild; `tinitex` is gone (PR 39). The bundled `bin/tools/<arch>/deno` therefore serves only users who opt into Deno for scripts, and `quarto install deno` serves them as well. This PR stops shipping it (about 120 MB per architecture) and removes the Deno-era scaffolding.

Release mapping (decision 2): 1.11 ships the boundary work on Deno; 1.12 ships Node with Deno bundled as a tool (PRs 33-36). This PR lands for **1.13** if the team wants one release with both bundled (recommended: users who set `QUARTO_RUN_RUNTIME=deno` get a release to run `quarto install deno`), or late in 1.12 otherwise; the changelog file below follows that choice.

Inventory (verified on `main` at `b86f98d`, adjusted for PRs 33-36 and 39):

**Deno download and use:**
- `configure.sh`, `configure.cmd` (PR 33's "Bootstrapping Deno (tool)" blocks, the `tools/deno` symlink, `deno_std/download.sh`/`.bat` calls), `package/src/quarto-bld`/`.cmd` (`QUARTO_DENO` export), `package/scripts/common/utils.sh` (`DENOURL`, `DENOFILES`; `DENO_ARCH_DIR` is renamed `ARCH_DIR`).
- `package/src/common/prepare-dist.ts` (the `deno()` dependency), `package/src/common/dependencies/deno.ts`, the `bucket === "deno"` case of `archive-binary-dependencies.ts`.
- `src/tools/impl/deno-paths.ts` (`bundledDenoPath()` and its use in `denoToolBinary()`).
- `src/core/devconfig.ts` (`deno` field), `package/scripts/common/quarto`/`quarto.cmd` (`deno-version` check), `package/src/common/configure.ts` (`env.get("DENO")`).
- Signing: `package/src/macos/installer.ts` (`deno` entries), `create-release.yml` `sign-files` (`deno.exe`).
- Conda: `package/conda-recipe/*` (`deno` requirement, `QUARTO_DENO` exports).
- `configuration`: `export DENO=` stays, with a comment: it is the version `quarto install deno` installs (`kDenoToolVersion`, kept equal by `tests/unit/tools/deno-tool.test.ts`), no longer downloaded by `configure`.

**Dual-runtime window (only if PR 33 Task 13 ran):** the `QUARTO_RUNTIME` blocks in `package/scripts/common/quarto`, `package/scripts/windows/quarto.cmd`, `package/launcher/src/main.rs` (and `DENO_BINARY`), the two tests in `tests/smoke/env/launcher-env.test.ts`, the changelog/docs rows, and the `QUARTO_RUNTIME=deno` step PR 35 added to `dual-runtime-smoke`. Of PR 33's table "Dual-runtime combinations until PR 37" only the first two rows survive (CLI on Node; scripts on Node, or on the Deno tool from `quarto install deno`). The rule under that table is not window-specific and stays: `src/` spawns Node on `architectureToolsPath("node")` and Deno on `requireDenoToolBinary()`, never on `execPath()`; `rg -n 'execPath\(\)' src -g '*.ts' -g '!src/deno_ral/**'` keeps printing nothing.

**CI (`ls .github/workflows`):**

| Workflow | Deno references left after PRs 33-36, 39 |
|---|---|
| `test-node-bundle.yml` (PR 26/32, workflow name `Node Tests`) | the jobs that run or compare Deno: `deno-sanity`, `deno-nightly`, `parity-compare`, `dual-runtime-smoke` (if Spike #2 added it); the Deno side of `render-parity`. The file, its `schedule:` trigger, the bucket generation and the Node jobs stay: it is the orchestration of the required checks (see "The CI graph after this PR") |
| `test-smokes.yml` | the `test-runtime` input (PR 32) and its `deno` value; comments at lines 424 (`Deno.Command`) and 613 ("A Deno segfault") |
| `test-smokes-parallel.yml` | its remaining `workflow_dispatch` runs the Deno runner (PR 32 removed its `pull_request`/`push` triggers); the Node equivalent is a dispatch of `Node Tests`: delete the file |
| `actions/quarto-dev/action.yml` | "Cache deno std deps" step; `QUARTO_SKIP_DENO_CACHE_WIPE` env |
| `create-release.yml` | `deno.exe` signing line |
| `test-install.yml` | the `install-deno-tool` job's first step deletes the bundled Deno; after this PR there is none to delete (simplify the step) |
| `test-ff-matrix.yml`, `test-smokes-parallel.yml` | `paths-ignore` of `test-quarto-latexmk.yml` (removed by PR 39 if it ran first; otherwise here) |
| the boundary-ratchet workflow (PR 02) | none (runs `quarto run --dev` on Node since PR 35) |

**Files to delete:**
- `package/scripts/vendoring/` (`vendor.sh`, `vendor.cmd`), `package/scripts/deno_std/` (`deno_std.ts`, `download.sh`, `download.bat`, `lock.sh`), `src/resources/deno_std/` (`deno_std.lock`, `import_map.json`, `cache/` if present; `run_import_map.json` moved in PR 35).
- `src/vendor_deps.ts`, `tests/test-deps.ts`, `deno.jsonc`, `deno.lock` (PR 00b; nothing runs Deno on the CLI's import graph any more), `package/src/common/create-deno-config.ts`, `package/src/common/deno-meta.json`, `package/src/common/create-dev-import-map.ts`, `src/dev_import_map.json`, `src/core/deno/import-maps.ts`, `src/tools/impl/deno-jupyter.ts` (empty), `tests/test-conf.json`, `package/src/common/dependencies/deno.ts`, `dev-docs/update-deno_jsonc.md`.
- `initDenoCache` in `src/core/run/deno.ts` (the Deno path keeps `DENO_DIR=quartoCacheDir("deno")`; `QUARTO_RUN_NO_NETWORK=true` keeps meaning `--cached-only` and works after one online run).

**Code:** Deno branches left in `src/deno_ral/*` by PRs 27-29 (`runtime().name === "deno"` bodies; `kv.ts` has none: PR 30 made the JSON file the only backend on both runtimes); `src/core/deno/debug.ts:43,51` (`QUARTO_DENO_V8_OPTIONS` text); `tests/run-tests.sh`/`.ps1` Deno branch; `tests/binary-mode-strip-env.txt` `DENO_DIR` line.

**Editor:** `quarto-cli.code-workspace` and `.vscode/settings.json` `deno.*` keys (the `deno.path` target disappears with the download); `.vscode/extensions.json` keeps `denoland.vscode-deno` until PR 38 replaces it.

**Docs:** `dev-docs/ci-deno-caching.md` (becomes `ci-npm-caching.md`), `dev-docs/add-typescript-dependency.md`, `dev-docs/claude-code-setup.md:22`, `.claude/CLAUDE.md` (lines 7, 19, 23-25, 35, 58, 62), `.claude/rules/typescript/deno-essentials.md` (renamed `essentials.md`), `.claude/rules/typescript/deno-ral.md` (renamed `runtime-layer.md`; the directory itself is not renamed, see below), `.claude/rules/testing/typescript-tests.md:9,93`, `.claude/rules/testing/test-anti-patterns.md:21-34`, `.claude/rules/testing/github-actions-reporting.md:37-38`, `.claude/skills/quarto-preview-test/SKILL.md` and `references/embedded-viewer.md`, `tests/README.md` (lines 15, 251-271, 369, 540-552), `llm-docs/{axe-scan-architecture,built-version-testing-architecture,github-actions-test-reporting,html-postprocessors-finalizers,project-context-architecture}.md`, `dev-docs/checklist-backport-a-pr.md` (Task 6), `dev-docs/upgrade-dependencies.md` (Deno section becomes "Deno tool").

**The `src/deno_ral/` directory keeps its name.** An earlier draft renamed it to `src/runtime/`. That task is deleted: the rename touches 452 files (872 import lines: `rg -c deno_ral -g '*.ts' src tests package tools`), changes no behaviour, and every one of those lines would conflict with backports to `v1.11` (which has the codemodded imports, decision 2) and with every open PR. The name is explained in `.claude/rules/typescript/runtime-layer.md` ("historical name: runtime abstraction layer, introduced while Quarto ran on Deno").

`news/changelog-*.md` files are history and are not edited.

**The CI graph after this PR (owned by this plan; PR 32 refers here).** `REVIEW-2026-10-16.md` R11: removing the Deno jobs must not remove the scheduled Node coverage, and a reusable workflow is not a replacement for the triggers, bucket generation and required checks that call it. This is the event-to-job graph Task 3 leaves behind; `grep -i deno` proving nothing is a weaker check than this table.

| Event (`test-node-bundle.yml`, name `Node Tests`) | Jobs | OS | What it runs |
|---|---|---|---|
| `pull_request` (branches `main`; `paths-ignore` `news/**`, `.claude/**`), `push` to `main` | `node-buckets` → `node-suite` (20 buckets, from `tests/run-parallel-tests.sh -n=20 --json-for-ci --timing-file=timing-for-ci.txt`, PR 31's `.mjs`) | `ubuntu-latest`, `windows-latest` | the full unit and smoke suites through the reusable `test-smokes.yml` (`buckets`, `runners`, `label-tag` inputs; the `test-runtime` input is gone, the runner scripts are Node only) |
| same | `node-render` | `ubuntu-latest` | PR 26's bundle build, `check-shim` report, `quarto check` and the spike documents rendered with the Node bundle (the Deno baseline and its diff are gone: the job asserts the renders succeed) |
| `schedule` (`17 3 * * *`) and `workflow_dispatch` | everything above, plus `node-macos` (`node-buckets` → 20 buckets) | `macos-latest` | the full suite on macOS (the only macOS coverage of the suite; `test-smokes.yml` reserves macOS for scheduled runs) |
| same | `render-parity` | `ubuntu-latest`, `macos-latest`, `windows-latest` | `dev-docs/feature-format-matrix/qmd-files/**/*.qmd` rendered to HTML by the dev launcher (`package/dist/bin/quarto`, the `ensure.mjs` bundle) and by the distribution bundle (`package/pkg-working/bin/quarto` after `quarto-bld prepare-dist --set-version 99.9.9`), normalised with `normalize-html.mjs` and diffed with `diff -r -x .quarto` (Decision 5 below) |
| same | `node-binary` | `ubuntu-latest` | `smoke/` in binary mode (`QUARTO_TEST_BIN`) against `tools/node-bundle/quarto-node` |

Callers and names: `node-suite`, `node-macos` and `node-binary` call `.github/workflows/test-smokes.yml` (`uses:`), whose job is `Run smoke (<runner>)`; `node-buckets`, `node-render` and `render-parity` are plain jobs. The required status checks on `main` after this PR (branch protection; a repository admin applies the change and the PR description lists it): `Node bucket NN / Run smoke (ubuntu-latest)` and `Node bucket NN / Run smoke (windows-latest)` for NN = 01…20, and `Build and render on Node (ubuntu-latest)`; the entry `Deno sanity (unit, smoke/render) / Run smoke (ubuntu-latest)` is removed from the required list only after this PR's first green run on `main` shows the Node checks reporting (R11: remove a requirement only after its replacement exists and is observed). Other workflows that run the suite or the bundle and stay as they are: `test-smokes.yml` (dispatch), `test-smokes-built.yml` (release artifacts), `test-ff-matrix.yml`, `test-bundle.yml`, `test-install.yml`, `lint.yml` (PR 33), the boundary-ratchet workflow (PR 02).

Assumptions about earlier PRs:

- PR 31: `QUARTO_TEST_RUNTIME` switch in `tests/run-tests.sh`/`.ps1`; PR 33 made `node` the default.
- PR 32: `test-node-bundle.yml` with a nightly/dispatch Deno parity job; `test-smokes.yml` takes a `test-runtime` input.
- PR 33: Task 13 may or may not have run (check `grep -n QUARTO_RUNTIME package/scripts/common/quarto`).
- PR 39 merged (no `deno compile` anywhere).
- PR 02 ratchet: `tools/check-runtime-boundary.ts` excludes `src/deno_ral/` from its `src` scope.

### Scope

In: the inventory above; `DENO_ARCH_DIR` -> `ARCH_DIR`; the backport checklist step; changelog line (Deno no longer bundled); the `deno.json` fallback of `quarto call build-ts-extension` (read with a deprecation warning in 1.12, PR 36 `resolveConfig()`; from this release the file is ignored and the warning says so once: PR 35's supported migration surface matrix, row 3, names this PR as its retirement).
Out: lint/format tooling, `@types/deno` removal, `.vscode/extensions.json` (PR 38). Renaming `src/deno_ral/` (deleted, see Context). The `QUARTO_DENO*` warnings (kept: they still help users of old shell profiles).

### Interfaces

No TypeScript interface changes. `denoToolBinary()` resolution after this PR: `QUARTO_DENO` (when it exists), then `quarto install deno`'s binary, else `undefined`.

Ratchet baseline after Task 2:

```json
{ "src": 0, "src-js": 0, "resources": 0, "tests": 0, "package-src": 0, "deno-ral": 0 }
```

(keys as PR 02 named its scopes; the new `deno-ral` scope is `src/deno_ral/`).

### Files

- Delete: listed in Context.
- Modify: `configure.sh`, `configure.cmd`, `package/scripts/common/utils.sh`, `package/src/quarto-bld`, `package/src/quarto-bld.cmd`, `package/src/common/prepare-dist.ts`, `package/src/common/archive-binary-dependencies.ts`, `package/src/common/configure.ts`, `src/core/devconfig.ts`, `package/scripts/common/quarto`, `package/scripts/windows/quarto.cmd`, `package/launcher/src/main.rs` (if Task 13 ran), `package/src/macos/installer.ts`, `src/tools/impl/deno-paths.ts`, `src/core/run/deno.ts`, `src/deno_ral/*.ts` (Deno branches), `src/core/deno/debug.ts:43,51`, `tools/check-runtime-boundary.ts`, `tools/runtime-boundary-baseline.json`, `tests/run-tests.sh`, `tests/run-tests.ps1`, `tests/binary-mode-strip-env.txt`, `tests/smoke/env/launcher-env.test.ts`, `.gitignore`, `configuration`, `package/conda-recipe/*`, `.github/workflows/{test-smokes,test-node-bundle,create-release,test-install}.yml`, `.github/workflows/actions/quarto-dev/action.yml`, `quarto-cli.code-workspace`, `.vscode/settings.json`, docs listed in Context, `news/changelog-1.13.md` (or `1.12`)

### Acceptance criteria

- `./configure.sh` on a clean clone downloads Node only; `ls package/dist/bin/tools/*/deno package/dist/bin/tools/deno` fails; `prepare-dist` output has no `deno`.
- `QUARTO_RUN_RUNTIME=deno quarto run x.ts` without Deno prints `Running a TypeScript script needs Deno, which is not installed. Run 'quarto install deno'.`; after `quarto install deno` it runs (`test-install.yml`).
- `grep -rn "QUARTO_RUNTIME" package src tests .github` prints nothing.
- No workflow passes `test-runtime: deno` or `QUARTO_TEST_RUNTIME=deno`; `grep -rn -i "deno" .github` prints only the `install-deno-tool` job of `test-install.yml`.
- `test-node-bundle.yml` matches "The CI graph after this PR": triggers `pull_request`, `push`, `schedule`, `workflow_dispatch`; jobs `node-buckets`, `node-suite`, `node-render`, `node-macos`, `render-parity`, `node-binary` and no other; a `workflow_dispatch` run is green on the three OSes, including `node-macos` (20 buckets) and `render-parity` (dev bundle vs distribution bundle: `Node render identical`); the required checks on `main` are the Node bucket checks and `node-render`, and `deno-sanity` left the list after that run.
- `quarto run --dev tools/check-runtime-boundary.ts` reports zero in every scope, `src/deno_ral/` included; `rg -n '\bDeno\.' tools -g '*.ts'` prints nothing (row 16 of PR 25's runtime residue table; PR 35 ported the tools that `quarto run --dev` runs).
- `ls src/resources/deno_std package/scripts/deno_std package/scripts/vendoring deno.jsonc deno.lock src/dev_import_map.json` all fail.
- `grep -rn "Deno" .claude dev-docs llm-docs tests/README.md | grep -v "dev-docs/runtime-migration\|QUARTO_DENO\|quarto install deno\|QUARTO_RUN_RUNTIME\|script-runtime\|ran on Deno\|Deno years\|historical name"` prints nothing.
- Every workflow is green on the branch; `create-release.yml` dispatched with `publish-release=false` is green.

## Plan

### Task 1: Stop downloading and shipping Deno; close the dual-runtime window

**Files:** `configure.sh`, `configure.cmd`, `package/scripts/common/utils.sh`, `package/src/quarto-bld`, `package/src/quarto-bld.cmd`, `package/src/common/{prepare-dist,archive-binary-dependencies,configure}.ts`, `package/src/common/dependencies/deno.ts` (delete), `src/core/devconfig.ts`, launchers, `main.rs`, `package/src/macos/installer.ts`, `create-release.yml`, `src/tools/impl/deno-paths.ts`, `configuration`, conda recipe, `tests/smoke/env/launcher-env.test.ts`

- [ ] **Step 1: `configure.sh` / `configure.cmd`**

Delete the "Bootstrapping Deno (tool)" block, the `ln -sf ... deno deno` line, `NEED_DENO`, `DENO_BIN`, the `deno-version` file write and the "Downloading Deno Stdlib" call in both scripts; delete `export DENO=${DENO_VERSION=$DENO}` and the `QUARTO_DENO` hint in the `QUARTO_VENDOR_BINARIES=false` branch; rename `DENO_ARCH_DIR` to `ARCH_DIR` everywhere (`grep -rln DENO_ARCH_DIR . --include=*.sh --include=*.cmd --include=*.bat --include=quarto-bld | xargs sed -i 's/DENO_ARCH_DIR/ARCH_DIR/g'`, then delete `DENOURL`/`DENOFILES` from `utils.sh`). In `configure.cmd`, `check-node-in-use.cmd` keeps checking `deno.exe` too (a running dev Deno from an older checkout still locks files).

- [ ] **Step 2: `quarto-bld`, `prepare-dist`, `configure.ts`, dependencies**

Delete the `QUARTO_DENO` export blocks from `quarto-bld`/`quarto-bld.cmd`; delete the `denoVersion`/`deno()` block in `prepare-dist.ts` and its import; `git rm package/src/common/dependencies/deno.ts`; `archiveUrl`'s special case becomes `dependency.bucket === "node"`; `configure.ts` drops `env.get("DENO")` from `createDevConfig`; `devconfig.ts` drops the `deno` field from `DevConfig`, `createDevConfig`, `readSourceDevConfig`, `devConfigsEqual`, `reconfigureReason`.

- [ ] **Step 3: Launchers**

`package/scripts/common/quarto` and `quarto.cmd`: the version check loops over `NODE` only (delete `DENO` from the `for RT in NODE DENO` loop and the `deno-version` block in `quarto.cmd`). If PR 33 Task 13 ran: delete the `QUARTO_RUNTIME` `case`/`IF` blocks, the `match env::var("QUARTO_RUNTIME")` block and `DENO_BINARY` constants in `main.rs`, and the two `QUARTO_RUNTIME` tests in `tests/smoke/env/launcher-env.test.ts`. Replace them with one test that pins the removal:

```ts
unitTest("launcher - QUARTO_RUNTIME is no longer read", async () => {
  const r = await quarto(["--help"], { QUARTO_RUNTIME: "deno", QUARTO_LAUNCHER_DEBUG: "1" });
  assertEquals(r.code, 0, r.err);
  assert(!/deno(\.exe)?"? run /.test(r.err), r.err);
});
```

- [ ] **Step 4: Signing, Deno tool lookup, `configuration`, conda**

- `package/src/macos/installer.ts`: delete the `deno` entries of the signing loop. `create-release.yml`: delete the `deno.exe` line of `sign-files`.
- `src/tools/impl/deno-paths.ts`: delete `bundledDenoPath()` and its candidate in `denoToolBinary()`.
- `configuration`: replace the comment above `export DENO=` with `# DENO: the version installed by \`quarto install deno\` (src/tools/impl/deno-paths.ts kDenoToolVersion). Not downloaded by configure.`
- Conda: delete `export QUARTO_DENO=...` from `build.sh` (line 5 and the activate heredoc), `unset QUARTO_DENO` from the deactivate heredoc, the matching `bld.bat` lines, and `deno` from `meta.yaml` `host` and `run` (with the `deno_version` `set` line). Conda users who want scripts on Deno run `quarto install deno`.

- [ ] **Step 5: Verify and commit**

Run:
```bash
rm -rf package/dist && ./configure.sh > /dev/null && ls package/dist/bin/tools/*/ && ! ls package/dist/bin/tools/*/deno 2>/dev/null
cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent $(find smoke/env/ -name '*.test.ts') $(find smoke/run/ -name '*.test.ts') unit/tools/deno-tool.test.ts
```
Expected: no `deno` in the tools listing; all tests pass (`run-script-node.test.ts`'s `QUARTO_RUN_RUNTIME=deno` case needs a Deno: CI's `test-install.yml` covers it; locally run `package/dist/bin/quarto install deno --no-prompt` first, or expect that one case to fail with the "needs Deno" message).

```bash
git add -A configure.sh configure.cmd package src/core/devconfig.ts src/tools/impl/deno-paths.ts configuration tests/smoke/env/launcher-env.test.ts .github/workflows/create-release.yml
git commit -m "build: stop downloading and shipping Deno; quarto install deno provides it; close the QUARTO_RUNTIME window"
```

### Task 2: Deno branches out of `src/deno_ral/`; ratchet at zero everywhere

**Files:** `src/deno_ral/*.ts`, `tools/check-runtime-boundary.ts`, `tools/runtime-boundary-baseline.json`, `src/core/deno/debug.ts`

- [ ] **Step 1: Remove the Deno branches**

Run: `grep -rn "\bDeno\b\|runtime().name === \"deno\"" src/deno_ral`

For each hit, delete the Deno branch and keep the Node implementation:

```ts
// before
if (runtime().name === "deno") {
  return Deno.readTextFileSync(path);
}
return nodeFs.readFileSync(path, "utf8");
// after
return nodeFs.readFileSync(path, "utf8");
```

`platform.ts` `runtime()` keeps the `"deno" | "node" | "bun"` union (it describes the process, used by `quarto check`) but its detection branch reads `globalThis.Deno` through `"Deno" in globalThis` without the `Deno.` member syntax. `kv.ts`: nothing to remove; PR 30 made the JSON file the only backend on both runtimes, and an upgrading user's `.kv` files stay unread (one cold cache, as PR 30 recorded). Run the layer tests after each file: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent $(find unit/ral/ -name '*.test.ts')`.

`src/core/deno/debug.ts:43` comment `export QUARTO_DENO_V8_OPTIONS=--stack-trace-limit=100` -> `export QUARTO_NODE_OPTIONS=--stack-trace-limit=100`; line 51 `is QUARTO_DENO_V8_OPTIONS set with a sufficiently-large stack size?` -> `is QUARTO_NODE_OPTIONS set with a sufficiently-large --stack-trace-limit?`.

- [ ] **Step 2: Ratchet covers the layer**

In `tools/check-runtime-boundary.ts` add a scope `deno-ral` (`src/deno_ral/**/*.ts`, counting `\bDeno\.`), then:

```bash
quarto run --dev tools/check-runtime-boundary.ts --update-baseline
cat tools/runtime-boundary-baseline.json
```
Expected: every count `0`. Update the failure message: "`Deno.` is not allowed anywhere in the tree; use `src/deno_ral/` (Node implementations)".

- [ ] **Step 3: Commit**

```bash
git add -A src/deno_ral src/core/deno/debug.ts tools/check-runtime-boundary.ts tools/runtime-boundary-baseline.json
git commit -m "runtime: remove the Deno branches of the layer; boundary ratchet at zero including src/deno_ral"
```

### Task 3: CI: remove the Deno matrix

**Files:** `.github/workflows/test-node-bundle.yml`, `test-smokes.yml`, `test-install.yml`, `actions/quarto-dev/action.yml`; `tests/run-tests.sh`, `tests/run-tests.ps1`, `tests/binary-mode-strip-env.txt`

- [ ] **Step 1: Workflows**

- `test-node-bundle.yml`: delete the jobs `deno-sanity`, `deno-nightly`, `parity-compare` and (if PR 32 Task 5 added it) `dual-runtime-smoke`; delete `tools/node-bundle/compare-junit.mjs`, `compare-junit.test.mjs` and `node-parity-allowlist.txt` with them (nothing else reads them; `junit.mjs` and `junit-finish.mjs` stay for the JUnit artifacts). **Keep** the `schedule:` trigger, `node-buckets`, `node-suite`, `node-render`, `node-macos`, `render-parity` and `node-binary`: the file is the orchestration behind the required checks and the only scheduled macOS run ("The CI graph after this PR"). In `node-render`, delete the Deno render and the diff step; the job renders the spike documents with the Node bundle and fails on a render error. In `render-parity`, replace the Deno side with the distribution bundle (Decision 5): add a `quarto-bld prepare-dist --set-version 99.9.9` step, render once with `package/dist/bin/quarto` and once with `package/pkg-working/bin/quarto`, keep the normalisation and the diff. Do not delete the workflow; do not rename its jobs (their names are the required checks).
- `test-smokes-parallel.yml`: `git rm` it (its dispatch ran the Deno matrix; `Node Tests` dispatch is the replacement) and drop its `paths-ignore` lines from the workflows that name it.
- `test-smokes.yml`: delete the `test-runtime` input and every `QUARTO_TEST_RUNTIME: ${{ inputs.test-runtime }}` line; line 424 comment -> `# Convert the executable to a native Windows path for the harness's process spawn.`; line 613 -> `# A runtime crash (segfault) prints no stack; macOS writes one to a crash report.`
- `actions/quarto-dev/action.yml`: delete the "Cache deno std deps" step; rename `QUARTO_SKIP_DENO_CACHE_WIPE` to `QUARTO_SKIP_DIST_WIPE` here and in `configure.sh`/`configure.cmd`.
- `test-install.yml` `install-deno-tool`: delete the `rm -f package/dist/bin/tools/*/deno ...` line.

Run: `grep -rn -i "deno\|QUARTO_TEST_RUNTIME" .github | grep -v "install-deno-tool\|quarto install deno\|quarto uninstall deno\|Deno.version"`
Expected: no output. Then check the graph, not only the grep: `python3 -c "import yaml; w=yaml.safe_load(open('.github/workflows/test-node-bundle.yml')); print(sorted(w['on']), sorted(w['jobs']))"` prints `['pull_request', 'push', 'schedule', 'workflow_dispatch']` and `['node-binary', 'node-buckets', 'node-macos', 'node-render', 'node-suite', 'render-parity']`; `grep -c "if: github.event_name == 'schedule' || github.event_name == 'workflow_dispatch'" .github/workflows/test-node-bundle.yml` prints `3` (`node-macos`, `render-parity`, `node-binary`).

- [ ] **Step 2: Test runners**

`tests/run-tests.sh`/`.ps1`: delete the `QUARTO_TEST_RUNTIME` selection and the Deno branch (the `deno test ... --config test-conf.json` invocations, the `deno coverage` block, `DENO_DIR`, `QUARTO_DENO_OPTIONS`, `QUARTO_DENO_EXTRA_OPTIONS`), keeping PR 31's Node path. `--coverage`: map to `node --test --experimental-test-coverage` if PR 31's harness supports it, else delete the option and its `tests/README.md` paragraph. `tests/binary-mode-strip-env.txt`: delete `DENO_DIR` (keep `QUARTO_DENO`, `QUARTO_DENO_DOM`: a developer's shell may export them).

Run: `grep -n -i "deno\|test-conf" tests/run-tests.sh tests/run-tests.ps1` -> no output; `bash tests/run-tests-agent-flag.test.sh` and the sibling `tests/run-tests-*.test.sh` pass.

- [ ] **Step 3: Commit**

```bash
git add -A .github tests/run-tests.sh tests/run-tests.ps1 tests/binary-mode-strip-env.txt configure.sh configure.cmd
git commit -m "ci: remove the nightly Deno matrix and the Deno test-runner branch"
```

### Task 4: Delete vendoring, `deno_std`, `deno.jsonc`, the import-map generator

**Files:** listed in Context ("Files to delete"); `src/core/run/deno.ts`; `.gitignore`; `quarto-cli.code-workspace`; `.vscode/settings.json`

- [ ] **Step 1: Delete**

```bash
git rm -r package/scripts/vendoring package/scripts/deno_std src/resources/deno_std
git rm src/vendor_deps.ts tests/test-deps.ts deno.jsonc deno.lock package/src/common/create-deno-config.ts package/src/common/deno-meta.json package/src/common/create-dev-import-map.ts src/dev_import_map.json src/core/deno/import-maps.ts src/tools/impl/deno-jupyter.ts tests/test-conf.json dev-docs/update-deno_jsonc.md
grep -rn "import-maps.ts\|create-dev-import-map\|create-deno-config\|deno-meta\|vendor_deps\|test-deps.ts\|deno_std\|vendoring/\|deno.jsonc\|deno.lock" . --include=*.ts --include=*.mjs --include=*.sh --include=*.cmd --include=*.bat --include=*.yml --include=*.json | grep -v "node_modules\|dev-docs/runtime-migration"
```
Expected: no output (docs follow in Task 5). Remove the `bld.ts` registrations of the deleted `package/src/common` commands if `grep` shows them.

- [ ] **Step 2: Deno run path without the shipped cache**

In `src/core/run/deno.ts` delete `initDenoCache` and its `copyTo`/`removeIfExists` imports; the `env` passed to `execProcess` sets `DENO_DIR: quartoCacheDir("deno")` and `DENO_NO_UPDATE_CHECK: "1"`. `QUARTO_RUN_NO_NETWORK=true` keeps adding `--cached-only`.

- [ ] **Step 3: `.gitignore`, editor settings**

`.gitignore`: delete the `# deno_std library` / `src/resources/deno_std/cache` lines, `src/vendor-*`, and `# deno lock file` / `deno.lock`. `quarto-cli.code-workspace` and `.vscode/settings.json`: delete every `deno.*` key (`deno.importMap`, `deno.lint`, `deno.enable`, `deno.unstable`, `deno.path`, `deno.disablePaths`, `deno.suggest.imports.hosts`, the seven `deno.inlayHints.*`) and add `"typescript.tsdk": "node_modules/typescript/lib"` (PR 33 installed TypeScript). PR 38 adds the dprint/oxc settings.

- [ ] **Step 4: Run and commit**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent $(find smoke/run/ -name '*.test.ts') $(find unit/ -name '*.test.ts')` and `cd package/src && ./quarto-bld prepare-dist --set-version 99.9.9 && ls ../pkg-working/share | grep -c deno_std` (prints `0`).

```bash
git add -A .gitignore quarto-cli.code-workspace .vscode/settings.json src/core/run/deno.ts package/src/bld.ts
git commit -m "chore: remove Deno vendoring, deno_std, deno.jsonc, deno.lock and the dev import map"
```

### Task 5: Documentation sweep

**Files:** listed in Context ("Docs")

- [ ] **Step 1: `dev-docs/ci-deno-caching.md` -> `dev-docs/ci-npm-caching.md`**

```bash
git mv dev-docs/ci-deno-caching.md dev-docs/ci-npm-caching.md
```

Replace the content:

```markdown
# CI npm cache

The `quarto-dev` composite action (`.github/workflows/actions/quarto-dev/action.yml`)
restores npm's download cache (`~/.npm`), filled by `npm ci` at the repository
root (run by `configure.sh`/`configure.cmd`), by
`src/webui/quarto-preview/build.mjs` and by `tools/run-stdlib/build.mjs`.
The Node.js binary is not cached: `configure.sh` downloads it from nodejs.org
and verifies it against `SHASUMS256.txt`.

Key: `${{ runner.os }}-${{ runner.arch }}-npm-v1-<hashFiles of the lockfiles>`;
`restore-keys` falls back to the prefix. Editing a lockfile changes the key; to
discard a bad cache without touching lockfiles, bump `-v1-` to `-v2-` in both
`key` and `restore-keys`. Rollback: delete the cache step; `npm ci` then
downloads everything (about 60 s on the Linux runner).
```

- [ ] **Step 2: `dev-docs/add-typescript-dependency.md`**

Replace the content:

```markdown
## Adding a TypeScript dependency

Dependencies are npm packages (JSR packages through `npm.jsr.io`, configured in
`.npmrc`). They are bundled into `bin/quarto.js` by `tools/node-bundle/build.mjs`;
nothing is downloaded when Quarto runs.

1. `npm install --save-exact <package>@<version>` at the repository root; commit
   `package.json` and `package-lock.json`.
2. Add the import-map entry in `src/import_map.json` (`"ansi_up": "npm:ansi_up@6.0.2"`,
   `"@std/path": "jsr:@std/path@1.0.8"`); `node tools/node-bundle/check-deps.mjs`
   checks that `package.json` mirrors it.
3. Import it by the import-map name. Runtime-shaped APIs go through `src/deno_ral/`
   (`.claude/rules/typescript/runtime-layer.md`).
4. Run `node tools/typecheck/gen-tsconfig-paths.mjs`, `npm run typecheck`, and
   `package/dist/bin/quarto --help` (rebuilds the dev bundle).

`quarto run` scripts' `stdlib/*` modules have their own package list in
`tools/run-stdlib/` (see `dev-docs/runtime-migration/35-user-scripts-compat.md`).
```

- [ ] **Step 3: `.claude/` files**

- `.claude/CLAUDE.md`: line 7 `TypeScript/Deno` -> `TypeScript on Node.js`; line 19 -> `Downloads Node.js, runs \`npm ci\`, runs \`quarto-bld configure\` (binary dependencies, preview client, run-stdlib), and symlinks \`quarto\` into PATH.`; line 23 `(Deno, Pandoc, Dart Sass, …)` -> `(Node.js, Pandoc, Dart Sass, …)`; line 24 (`deno.jsonc`) deleted; line 25 -> `` `src/import_map.json` — import map applied by the bundler; `package.json` pins the packages``; line 35 `not direct Deno commands` -> `` not direct `node`/`npm` commands``; line 58 `Deno binary \`package/dist/bin/tools/<arch>/deno\`` -> `Node binary \`package/dist/bin/tools/<arch>/node\``, `vendored deps \`src/vendor/\`` -> `npm packages \`node_modules/\``; line 62 -> `**TypeScript:** application code imports \`src/deno_ral/\` for files, processes, environment and network (never \`node:*\` directly outside that layer); imports include the \`.ts\` extension; dependencies resolve through \`src/import_map.json\` at bundle time; CLI parsing uses Cliffy.`
- `git mv .claude/rules/typescript/deno-essentials.md .claude/rules/typescript/essentials.md` and `git mv .claude/rules/typescript/deno-ral.md .claude/rules/typescript/runtime-layer.md`; fix references (`grep -rn "deno-essentials\|deno-ral.md" .claude dev-docs llm-docs`). In `essentials.md`: title `# TypeScript Essentials`; the "Deno APIs vs Node.js" section becomes:

```markdown
## Runtime calls

Application code never calls `Deno.*` (gone) or `node:*` modules directly; it imports the runtime layer:

```typescript
// Correct
import { readTextFileSync, writeTextFileSync } from "../deno_ral/fs.ts";
import { env } from "../deno_ral/env.ts";
import { cwd } from "../deno_ral/process.ts";

// Wrong
import fs from "node:fs";
process.env.PATH;
```

`tools/check-runtime-boundary.ts` fails CI on a new `Deno.` use, a direct `node:` import outside the layer, or a direct std import that the std boundary rule does not allow-list (`kStdAllowListed`; the allow-list outlives the Deno runtime because its modules are runtime-neutral).
```

and Key conventions item 4 -> `**Use the runtime layer** - no direct \`node:*\` imports outside \`src/deno_ral/\``. In `runtime-layer.md`: title `# Runtime layer (\`src/deno_ral/\`)`; first paragraph: "The runtime abstraction layer over Node.js built-ins. Historical name: introduced while Quarto ran on Deno; kept to avoid churning about 450 importing files and every backport."; the module table gains the modules the migration added (`env.ts`, `temp.ts`, `errors.ts`, `net.ts`, `http.ts`, `watch.ts`, `kv.ts`, `main.ts`; one line each from `_TEMPLATE.md`); the "Module Loading Order" section is deleted (the monkey-patch is gone since PR 25). `paths:` frontmatter unchanged.
- `.claude/rules/testing/typescript-tests.md:9` -> `TypeScript-based tests on the Node test harness (\`tests/harness.ts\`).`; line 93 `Deno.makeTempDirSync({ prefix: "quarto-test" })` -> `makeTempDirSync({ prefix: "quarto-test" })` with `import { makeTempDirSync } from "../../src/deno_ral/temp.ts";`.
- `.claude/rules/testing/test-anti-patterns.md:21-34`: `Deno.env.set()` -> `env.set()` (`src/deno_ral/env.ts`); "Deno runs test files in parallel by default" -> "the harness runs each test file in its own process; the environment is process-global within a file"; `Deno.chdir()` -> `chdir()` (`src/deno_ral/process.ts`).
- `.claude/rules/testing/github-actions-reporting.md:37-38`: `Deno's final failure sections` -> `the runner's final failure sections`; `Deno module state` -> `module state`.
- `.claude/skills/quarto-preview-test/SKILL.md`, `references/embedded-viewer.md`: `grep -n -i deno` and replace (`deno run` -> `quarto run`; "Deno" -> "the runtime").
- `dev-docs/claude-code-setup.md:22`: `Deno essentials, RAL, Cliffy commands` -> `TypeScript essentials, runtime layer, Cliffy commands`.

- [ ] **Step 4: `tests/README.md`, `llm-docs`, `upgrade-dependencies.md`**

- `tests/README.md` line 15 -> `Tests use the harness in \`tests/harness.ts\` (\`node:test\` or the runner chosen by Spike V)`; lines 251-271: replace the Deno reporter wording with PR 31's harness behaviour and delete the `QUARTO_DENO_EXTRA_OPTIONS` mention; line 369 (Windows `deno.exe test ...` excerpt): replace with the command line `run-tests.ps1` prints now; lines 540-552: `deno test` -> the harness; "from deno using Promise.all()" -> "by `tests/run-parallel-tests.ts` using `Promise.all()`".
- The five `llm-docs` files: `grep -n -i deno`; present-tense statements about the runtime become "Node"/"the runtime"; past-tense explanations of workarounds stay.
- `dev-docs/upgrade-dependencies.md`: the Deno section becomes "## Deno tool (`quarto install deno`)": update `DENO` in `configuration` and `kDenoToolVersion` in `src/tools/impl/deno-paths.ts`; run `tests/unit/tools/deno-tool.test.ts` and the `test-install.yml` job.

Run: `grep -rn "Deno" .claude dev-docs llm-docs tests/README.md | grep -v "dev-docs/runtime-migration\|QUARTO_DENO\|quarto install deno\|QUARTO_RUN_RUNTIME\|script-runtime\|ran on Deno\|Deno years\|historical name\|Deno tool"`
Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add -A .claude dev-docs llm-docs tests/README.md
git commit -m "docs: describe the Node toolchain; Deno is an optional tool"
```

### Task 6: Backport protocol

**Files:** `dev-docs/checklist-backport-a-pr.md`

PR 09 adds the reverse-codemod step to this checklist when `--reverse` lands (Phase 1). This task re-reads it after the flip and makes it match the text below (same commands; the codemod now runs on Node through `quarto run --dev`). Context: the Phase 1 codemods landed before the `v1.11` cut (decision 2), so `v1.11` carries the layer names and cherry-picks from `main` touch the same identifiers; `v1.10` and older still call `Deno.*` directly.

- [ ] **Step 1: The checklist step**

Insert after "Cherry-pick the commits from the development branch:" in `dev-docs/checklist-backport-a-pr.md`:

```markdown
- **Stable branch `v1.10` or older** (before the runtime layer; code calls `Deno.*`): a commit from `main`
  that touches `.ts` files uses layer names (`readTextFileSync` from `deno_ral/fs.ts`, `env.get`, ...) that
  do not exist there. Translate it with the reverse codemod instead of `git cherry-pick` for those files:

  ```bash
  C=<commit>
  FILES=$(git diff --name-only "$C^" "$C" -- '*.ts')
  git worktree add --detach /tmp/bp-old "$C^"
  git worktree add --detach /tmp/bp-new "$C"
  for wt in /tmp/bp-old /tmp/bp-new; do
    package/dist/bin/quarto run --dev tools/codemod-deno-ral.ts --reverse \
      --rules fs,temp,env,process,platform --ral-dir "$wt/src/deno_ral" \
      $(for f in $FILES; do printf -- '--file %s ' "$wt/$f"; done)
    git -C "$wt" commit -qam "reverse codemod"
  done
  git diff "$(git -C /tmp/bp-old rev-parse HEAD)" "$(git -C /tmp/bp-new rev-parse HEAD)" -- $FILES > /tmp/bp.patch
  git worktree remove --force /tmp/bp-old && git worktree remove --force /tmp/bp-new
  git apply -3 /tmp/bp.patch     # on the stable branch
  ```

  Run the codemod from a `main` checkout (it lives in `tools/`). Its report lists what it left: error
  predicates have no 1:1 reverse (`isNotFound(e)` -> `e instanceof Deno.errors.NotFound`,
  `isAlreadyExists(e)` -> `e instanceof Deno.errors.AlreadyExists`, `isPermissionDenied(e)` ->
  `e instanceof Deno.errors.PermissionDenied`); edit those by hand. Changes inside `src/deno_ral/`
  itself are not backported this way: port them by hand or not at all.
- **Stable branch `v1.11`** (layer names, Deno implementation): cherry-pick as usual. Conflicts inside
  `src/deno_ral/*.ts` mean the fix touched a Node implementation; port the intent to the Deno code.
```

- [ ] **Step 2: Try it once**

Pick a merged PR from the Phase 1-3 window that touched a `Deno.*`-renamed call site (`git log --oneline main -- src/core/path.ts | head`), run the step against a scratch branch off `v1.10`, and confirm `git apply -3` succeeds and that the scratch branch type-checks with its own (Deno-era) tooling: `./configure.sh && package/dist/bin/quarto --help` on that branch (the `v1.10` dev launcher runs `deno run --check`). Record the commit used in the PR description.

- [ ] **Step 3: Commit**

```bash
git add dev-docs/checklist-backport-a-pr.md
git commit -m "docs: backport protocol after the runtime migration"
```

### Task 7: Changelog

- [ ] **Step 1:** In the changelog of the release this PR lands in (`news/changelog-1.13.md`, or `1.12` if the team lands it before the 1.12 cut), under `## Dependencies`:

```markdown
- ([#NNNNN](https://github.com/quarto-dev/quarto-cli/pull/NNNNN)): Deno is no longer bundled with Quarto. To run `quarto run` or project scripts on Deno (`QUARTO_RUN_RUNTIME=deno`, `project: script-runtime: deno`), install it with `quarto install deno`. The `QUARTO_RUNTIME` switch of the 1.12 prereleases is removed.
```

(drop the last sentence if PR 33 Task 13 did not run). Commit: `git add news && git commit -m "docs: changelog for Deno no longer bundled"`.

## Verification

- All acceptance-criteria commands.
- `./configure.sh` from a clean clone, `package/dist/bin/quarto check`, a render, `cd package/src && ./quarto-bld prepare-dist --set-version 99.9.9 && ./quarto-bld validate-bundle`.
- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent $(find unit/ -name '*.test.ts') $(find smoke/run/ -name '*.test.ts') $(find smoke/check/ -name '*.test.ts') $(find smoke/env/ -name '*.test.ts') $(find smoke/build-ts-extension/ -name '*.test.ts')` green locally; the full matrix green on the branch.
- `quarto run --dev tools/check-runtime-boundary.ts`: zero everywhere.
- `create-release.yml` dispatched once (`publish-release=false`): green; installers have no `deno`.

## Review checklist

- [ ] No `configure`, `prepare-dist` or launcher path downloads, ships or runs Deno; `denoToolBinary()` finds only `QUARTO_DENO` or `quarto install deno`.
- [ ] `QUARTO_RUNTIME` is gone everywhere (if it existed) and a test pins that; PR 33's combinations table is down to its first two rows in behaviour, and `rg -n 'execPath\(\)' src -g '*.ts' -g '!src/deno_ral/**'` prints nothing.
- [ ] No workflow runs the suite on Deno; `test-node-bundle.yml` keeps its `schedule:`, the bucket generation, `node-macos`, `render-parity` (dev vs distribution bundle) and `node-binary`; `test-smokes-parallel.yml` deleted; the required checks are the Node ones and `deno-sanity` is removed only after the first green `main` run (named in the description).
- [ ] `src/deno_ral/` contains no `Deno.`; the ratchet scans it.
- [ ] Deleted files have no importers (Task 4 `grep`).
- [ ] `src/deno_ral/` is **not** renamed; `runtime-layer.md` explains the name.
- [ ] The backport checklist step matches Task 6 and was exercised once.

## Risks and rollback

- **This PR closes the dual-runtime window.** It lands only after PR 33's rollout rules have run their course ("Risks and rollback", "Rollout and rollback after the flip": the soak is over, 1.12 is stable on Node, no open P1 in the layer); the switches it removes were for user-side script/extension breakage, so their removal is a compatibility decision, not a rollback decision.
- **Users who set `QUARTO_RUN_RUNTIME=deno` upgrade and lose the bundled Deno.** The error names `quarto install deno`; the changelog says so. Landing in 1.13 (one release after Node shipped with Deno bundled) gives them a release to adapt.
- **A deleted file was read by something outside the repository** (Positron/RStudio build scripts reading `src/dev_import_map.json`, packagers reading `deno.jsonc`). The PR description lists every deleted path; restoring one is `git checkout <sha> -- <path>`.
- **The reverse codemod misses an identifier on an old branch.** The `git apply -3` conflict or `deno check` on the stable branch shows it; the checklist says to hand-edit.
- **macOS coverage is nightly only** (as since PR 32): a macOS-only regression shows up the next morning. `node-macos` is the one scheduled macOS run of the suite; deleting the `schedule:` trigger would remove it, which is why Task 3 keeps the workflow.
- **Rollback:** revert the PR; `configure` downloads Deno again and the nightly matrix returns.

## Decisions needed

1. **1.12 or 1.13** for this PR. Recommendation: 1.13 (Context).
2. Not changed because the review's finding is resolved by decision 2 and the deleted rename task: "the 452-file `deno_ral` rename right after a release branch is cut maximises conflicts". The directory keeps its name.
3. Not changed because decision 1 resolves it: the review's "no Deno CI fallback once PR 33 lands" (S5). PR 33 keeps Deno as a tool and PR 32's nightly Deno matrix runs until this PR; this PR is where the fallback ends, after PRs 35/36 moved the last consumers.
4. Not changed: `.vscode/extensions.json` still recommends `denoland.vscode-deno` until PR 38 swaps it for dprint/oxc, so editors are not left without a formatter between the two PRs.
5. **What `render-parity` compares once there is no Deno build** (triage B5 keeps its schedule). Options: (a) delete the job and rely on `test-ff-matrix.yml`, which renders the same documents but on Linux only and per PR; (b) keep a three-OS nightly render that only asserts success; (c) keep the diff and compare the dev launcher's bundle (`ensure.mjs`) with the distribution bundle (`prepare-dist`), which is what users run and what no other workflow renders on three OSes before a release. Recommendation and plan: (c); the job keeps its name (a required-check-adjacent nightly), its OS matrix and `normalize-html.mjs`.
