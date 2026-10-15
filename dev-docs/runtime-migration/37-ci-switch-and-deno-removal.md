# PR 37: Every workflow on Node; remove Deno caches, vendoring, `deno.jsonc`, `deno_std`; docs sweep

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove everything that still exists only because Quarto used to run on Deno: the Deno branches of the test runners and CI, the vendoring and `deno_std` scripts, `deno.jsonc` and its generator, the `DENO` field, dead files, and the developer documentation that describes them; optionally rename `src/deno_ral/` to `src/runtime/`.
**Phase:** 3. **Depends on:** PR 33, 34, 35, 36 (PR 39 may land before or after; see Scope). **Unblocks:** PR 38.
**Branch:** `rt/37-ci-switch-and-deno-removal`.
**Suggested executor:** Sonnet. Deletions, `sed`, and documentation rewrites with a precise inventory; no design decisions except the optional rename.
**Size:** M (about 35 files deleted or edited, plus the optional rename touching 452 import lines mechanically).
**Ships on:** Node. Gates: every workflow in `.github/workflows/` green on the branch; `tools/check-runtime-boundary.ts` at zero including `src/deno_ral/`.

## Spec

### Context

Assessment Phase 4 step 2 ("Remove the Deno CI matrix, `deno_cache` caching docs, `create-deno-config.ts`, `deno.jsonc`, and vendoring scripts") and section 11 design rule 1 (the directory rename is "one mechanical PR at the flip if wanted"). After PR 33 to 36 the product runs on Node, but the repository still carries Deno-era tooling and text. This PR is the inventory-driven cleanup. Nothing here changes user-visible behaviour.

Inventory, verified on `main` at `a4d0979` (2026-10-14) and adjusted for what PR 33 to 36 already removed:

**Workflows (`ls .github/workflows`)** and what each does:

| Workflow | Purpose | Deno references left after PR 33-36 |
|---|---|---|
| `cleanup-caches.yml` | deletes GitHub Actions caches of closed PRs | none |
| `create-release.yml` | builds and publishes installers | none after PR 33/34 |
| `performance-check.yml` | render timing on PRs (uses `quarto-dev`) | none |
| `publish-cloudsmith.yml` | pushes deb/rpm to Cloudsmith | none |
| `stale-needs-repro.yml` | issue bot | none |
| `test-bundle.yml` | `prepare-dist` + run the bundle + `validate-bundle` | none after PR 33 |
| `test-ff-matrix.yml` | feature-format matrix buckets | `paths-ignore` lists `test-quarto-latexmk.yml` (keep) |
| `test-install.yml` | `quarto install` tools | none (PR 35 added the Deno tool job, which is about the tool, not the runtime) |
| `test-quarto-latexmk.yml` | builds `tinitex` | `denoland/setup-deno` step added by PR 33; owned by PR 39 |
| `test-smokes-built.yml` | smoke suite against built installers | none |
| `test-smokes-parallel.yml` | parallel smoke buckets on `quarto-actions/setup` | none |
| `test-smokes.yml` | main smoke/unit suite | two comments (`Deno.Command` at line 424, "A Deno segfault" at line 613); the `QUARTO_TEST_RUNTIME` env from PR 32 if present |
| `update-test-timing.yml` | refreshes `tests/timing-for-ci.txt` | none |
| `verify-tinytex-patterns.yml` | checks LaTeX error patterns against TinyTeX | none |
| `test-node-bundle.yml` (PR 26) | allowed-failure Node smoke job | the whole file: redundant once the main suite runs on Node |
| `.github/workflows/actions/quarto-dev/action.yml` | configure composite action | none after PR 33 (npm cache) |

**Files to delete** (each verified to have no consumer after PR 33-36 other than the files in this list):

- `package/scripts/vendoring/vendor.sh`, `package/scripts/vendoring/vendor.cmd` (called only from the old `configure.*`).
- `package/scripts/deno_std/deno_std.ts`, `download.sh`, `download.bat`, `lock.sh` (only `configure.*` and the old CI cache key referenced them).
- `src/resources/deno_std/deno_std.lock`, `src/resources/deno_std/import_map.json` (PR 35 moved `run_import_map.json` to `src/resources/run-compat/deno/`; `src/core/run/deno.ts` no longer reads the cache).
- `src/vendor_deps.ts`, `tests/test-deps.ts` (inputs to `deno install` only).
- `deno.jsonc`, `package/src/common/create-deno-config.ts`, `package/src/common/deno-meta.json` (PR 38 recreates the exclude list in `dprint.json`/`.oxlintrc.json`; the 13 globs are copied into PR 38's plan).
- `package/src/common/create-dev-import-map.ts`, `src/dev_import_map.json`, `src/core/deno/import-maps.ts` (the generator, its output and its only helper; `dev_import_map.json` is referenced once in `tests/README.md:369`, an old log excerpt).
- `src/tools/impl/deno-jupyter.ts` (empty file, no importer).
- `tests/test-conf.json` (`deno test` config; the Node harness of PR 31 has its own exclude list) if PR 31 did not already remove it.
- `.gitignore` lines `deno.lock` and `src/resources/deno_std/cache` and `src/vendor-*`.

**Fields and code**: `export DENO=v2.7.14` in `configuration` (kept by PR 33 for PR 39; PR 39's workflow pins its own version with `denoland/setup-deno`, so this field has no reader once PR 34 changed `check.ts` and PR 35 hard-coded `kDenoKnownGoodVersion`); `src/core/deno/debug.ts:43,51` text mentioning `QUARTO_DENO_V8_OPTIONS`; any `runtime().name === "deno"` branch left inside `src/deno_ral/*` by PR 27-30 ("keep the Deno implementation behind the same interface until the flip"); the `deno` branch of `tests/run-tests.sh`/`tests/run-tests.ps1` (PR 31's `QUARTO_TEST_RUNTIME` switch, defaulted to `node` by PR 33); `tests/binary-mode-strip-env.txt` entries `QUARTO_DENO`, `QUARTO_DENO_DOM`, `DENO_DIR` (keep `QUARTO_DENO*` until 1.12 per PR 34; delete only `DENO_DIR`).

**Docs**: `dev-docs/ci-deno-caching.md` (rewrite as `dev-docs/ci-npm-caching.md`), `dev-docs/update-deno_jsonc.md` (delete), `dev-docs/add-typescript-dependency.md` (rewrite for npm), `dev-docs/claude-code-setup.md:22`, `.claude/CLAUDE.md` lines 7, 19, 23-25, 35, 58, 62, `.claude/rules/typescript/deno-essentials.md` (rename to `essentials.md`), `.claude/rules/typescript/deno-ral.md` (rename to `runtime-layer.md`), `.claude/rules/testing/typescript-tests.md:9,80,93`, `.claude/rules/testing/test-anti-patterns.md:21-34`, `.claude/rules/testing/github-actions-reporting.md:37-38`, `.claude/rules/typescript/cliffy-commands.md` (`deno-lint-ignore` example; PR 38 changes the directive, this PR leaves it), `.claude/skills/quarto-preview-test/SKILL.md` and `references/embedded-viewer.md` (mentions of `deno`), `tests/README.md:15,251-271,369,540-552`, `llm-docs/testing-patterns.md` (4 `deno_ral` mentions: fine unless the rename task runs), `llm-docs/axe-scan-architecture.md`, `llm-docs/built-version-testing-architecture.md`, `llm-docs/github-actions-test-reporting.md`, `llm-docs/html-postprocessors-finalizers.md`, `llm-docs/project-context-architecture.md` (one or two mentions each; replace "Deno" wording with the runtime-neutral name, keep history where it explains a workaround).

The `news/changelog-*.md` files are history and are not edited.

Assumptions about earlier PRs:

- PR 31 added `QUARTO_TEST_RUNTIME` to `tests/run-tests.sh`/`.ps1` and PR 33 set its default to `node`. If PR 31 instead replaced the scripts outright, Task 2 only deletes leftover `DENO`-named variables.
- PR 26's Node CI job is `.github/workflows/test-node-bundle.yml` (template vocabulary); PR 32 either extended it into the required matrix or added `QUARTO_TEST_RUNTIME=node` to `test-smokes.yml`. Task 1 handles both shapes.
- PR 02's ratchet is `tools/check-runtime-boundary.ts` with `tools/runtime-boundary-baseline.json`; it counts `\bDeno\.` outside `src/deno_ral/` and direct std imports. Task 3 extends its scope to `src/deno_ral/` and sets the baseline to zero.

### Scope

In: everything in the inventory above; the optional rename as the last task.
Out: `test-quarto-latexmk.yml`, `package/src/common/compile-quarto-latexmk.ts`, `package/src/util/deno.ts` (PR 39). Lint/format/typecheck tooling and `project-lint.sh` (PR 38). The `QUARTO_DENO*` alias variables (PR 34, removed in 1.12). Changelog (nothing user-visible).

### Interfaces

No TypeScript interfaces change. The ratchet's baseline file after Task 3:

```json
{ "denoNamespace": 0, "stdImports": 0, "scopes": ["src", "package/src", "tests", "tools"] }
```

(adjust to the schema PR 02 chose; the point is that `src/deno_ral/` is no longer excluded and every count is zero.)

### Files

- Delete: `.github/workflows/test-node-bundle.yml`, `package/scripts/vendoring/`, `package/scripts/deno_std/`, `src/resources/deno_std/`, `src/vendor_deps.ts`, `tests/test-deps.ts`, `deno.jsonc`, `package/src/common/create-deno-config.ts`, `package/src/common/deno-meta.json`, `package/src/common/create-dev-import-map.ts`, `src/dev_import_map.json`, `src/core/deno/import-maps.ts`, `src/tools/impl/deno-jupyter.ts`, `tests/test-conf.json`, `dev-docs/update-deno_jsonc.md`
- Modify: `.github/workflows/test-smokes.yml:424,613` (+ `QUARTO_TEST_RUNTIME` lines), `tests/run-tests.sh`, `tests/run-tests.ps1`, `tests/binary-mode-strip-env.txt`, `.gitignore:21-26`, `configuration:12-15`, `src/core/deno/debug.ts:43,51`, `src/deno_ral/*.ts` (Deno branches), `tools/check-runtime-boundary.ts`, `tools/runtime-boundary-baseline.json`
- Rename/modify docs: `dev-docs/ci-deno-caching.md` -> `dev-docs/ci-npm-caching.md`, `dev-docs/add-typescript-dependency.md`, `dev-docs/claude-code-setup.md`, `.claude/CLAUDE.md`, `.claude/rules/typescript/deno-essentials.md` -> `essentials.md`, `.claude/rules/typescript/deno-ral.md` -> `runtime-layer.md`, `.claude/rules/testing/{typescript-tests,test-anti-patterns,github-actions-reporting}.md`, `.claude/skills/quarto-preview-test/SKILL.md`, `.claude/skills/quarto-preview-test/references/embedded-viewer.md`, `tests/README.md`, `llm-docs/{axe-scan-architecture,built-version-testing-architecture,github-actions-test-reporting,html-postprocessors-finalizers,project-context-architecture}.md`
- Optional rename: `src/deno_ral/` -> `src/runtime/` (452 importing files), `.claude/rules/typescript/runtime-layer.md` `paths:`, `llm-docs/testing-patterns.md`, `src/resources/run-compat/run-stdlib.json`, `tools/node-bundle/build-run-stdlib.mjs`, `tools/check-runtime-boundary.ts`, `dev-docs/runtime-migration/README.md` (ground rule 2 wording)

### Acceptance criteria

- `grep -rn -i "deno" --include=*.sh --include=*.cmd --include=*.bat --include=*.yml --include=*.yaml --include=*.json --include=*.jsonc . | grep -v "node_modules\|dev-docs/runtime-migration\|news/\|^./src/resources/run-compat\|^./src/core/run/deno.ts\|^./src/tools/impl/deno.ts\|^./src/core/runtime-env.ts\|^./tests/binary-mode-strip-env.txt\|test-quarto-latexmk.yml\|package/src/util/deno.ts\|compile-quarto-latexmk"` prints nothing. (The excluded paths are PR 35's intentional Deno tool and run handler, PR 34's alias handling, and PR 39's files.)
- `grep -rn "Deno\." src tests package/src tools --include=*.ts | grep -v "src/resources/run-compat\|src/core/run/deno.ts\|src/tools/impl/deno.ts"` prints nothing, and `quarto run --dev tools/check-runtime-boundary.ts` reports zero with `src/deno_ral/` included.
- `ls src/resources/deno_std package/scripts/deno_std package/scripts/vendoring deno.jsonc src/dev_import_map.json` all fail.
- Every workflow in `.github/workflows/` passes on the branch (push + `workflow_dispatch` for the dispatch-only ones: `create-release.yml` with `publish-release=false`, `cleanup-caches.yml`, `update-test-timing.yml`).
- `grep -rn "Deno" .claude dev-docs llm-docs tests/README.md | grep -v "dev-docs/runtime-migration\|QUARTO_DENO\|quarto install deno\|Deno years\|ran on Deno\|from Deno"` prints nothing (historical mentions that explain a workaround are allowed when phrased in the past tense and matched by the exclusions).
- After the optional rename: `ls src/deno_ral` fails, `grep -rn "deno_ral" . --include=*.ts --include=*.mjs --include=*.json --include=*.md | grep -v "dev-docs/runtime-migration\|news/"` prints nothing, and the suite is green.

## Plan

### Task 1: Workflows

**Files:**
- Delete: `.github/workflows/test-node-bundle.yml`
- Modify: `.github/workflows/test-smokes.yml`

- [ ] **Step 1: Delete the PR 26 allowed-failure job**

```bash
git rm .github/workflows/test-node-bundle.yml
grep -rn "test-node-bundle" .github dev-docs README.md 2>/dev/null | grep -v runtime-migration
```
Expected: no remaining references (if `test-ff-matrix.yml`/`test-smokes-parallel.yml` list it under `paths-ignore`, delete those lines).

- [ ] **Step 2: Remove the runtime switch and Deno comments from `test-smokes.yml`**

- If PR 32 added `QUARTO_TEST_RUNTIME: node` to any `env:` block or matrix of `test-smokes.yml`, `test-smokes-built.yml`, `test-ff-matrix.yml`, `performance-check.yml`, delete those lines (the runner defaults to Node since PR 33 and the `deno` branch is deleted in Task 2).
- Line 424: `# Convert the executable to a native Windows path for Deno.Command.` -> `# Convert the executable to a native Windows path for the test harness's process spawn.`
- Line 613: `# A Deno segfault prints no stack; macOS writes one to a crash report.` -> `# A runtime crash (segfault) prints no stack; macOS writes one to a crash report.`

Run: `grep -n -i "deno\|QUARTO_TEST_RUNTIME" .github/workflows/*.yml .github/workflows/actions/*/action.yml .github/actions/*/action.yml | grep -v test-quarto-latexmk`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add .github
git commit -m "ci: all workflows on Node; drop the interim Node bundle job and Deno comments"
```

### Task 2: Test runners, env strip list, `.gitignore`, `configuration`, `debug.ts`

**Files:**
- Modify: `tests/run-tests.sh`, `tests/run-tests.ps1`, `tests/binary-mode-strip-env.txt`, `.gitignore`, `configuration`, `src/core/deno/debug.ts`
- Delete: `tests/test-conf.json`, `src/tools/impl/deno-jupyter.ts`

- [ ] **Step 1: Delete the `deno` branch of the test runners**

In `tests/run-tests.sh`: remove the `QUARTO_TEST_RUNTIME` selection and the `deno` branch (the `"${QUARTO_BIN_PATH}/tools/${DENO_ARCH_DIR}/deno" test ...` invocations at lines 170-189 of the pre-PR-31 file and the `deno coverage` block at the end), keeping only the Node path PR 31 added; delete every `DENO_ARCH_DIR`, `DENO_DIR`, `QUARTO_DENO_OPTIONS`, `QUARTO_DENO_EXTRA_OPTIONS`, `--config test-conf.json` occurrence. Same in `tests/run-tests.ps1` (`$QUARTO_DENO`, `$Env:DENO_DIR`, `$QUARTO_DENO_OPTIONS`, `$DENO_ARGS`, the `--config test-conf.json` string, lines 33-34, 62-66, 127-135, 231-240 of the pre-PR-31 file). The `--coverage` option: if the Node harness of PR 31 supports `node --test --experimental-test-coverage`, map it; otherwise delete the option and its `tests/README.md` paragraph.

Run: `grep -n -i "deno\|test-conf" tests/run-tests.sh tests/run-tests.ps1 tests/run-tests-*.test.sh`
Expected: no output. Then `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/node-dependency.test.ts smoke/run/run-script.test.ts` passes and `bash tests/run-tests-agent-flag.test.sh` (and the two sibling `run-tests-*.test.sh`) pass.

- [ ] **Step 2: Strip list, `.gitignore`, `configuration`, dead files**

- `tests/binary-mode-strip-env.txt`: delete the `DENO_DIR` line (keep `QUARTO_DENO`, `QUARTO_DENO_DOM` until 1.12).
- `.gitignore`: delete lines 21-22 (`# deno_std library`, `src/resources/deno_std/cache`), 23 (`src/vendor-*`), 25-26 (`# deno lock file`, `deno.lock`).
- `configuration`: delete the two comment lines and `export DENO=v2.7.14` added by PR 33 (lines 15-17 after PR 33's edit). Then `grep -rn '"DENO"\|\bDENO\b' package/src src tests --include=*.ts --include=*.sh --include=*.yaml` must print nothing (the conda `meta.yaml` was changed in PR 34).
- `git rm tests/test-conf.json src/tools/impl/deno-jupyter.ts` (if `tests/test-conf.json` is already gone, skip).
- `src/core/deno/debug.ts`: line 43 comment `export QUARTO_DENO_V8_OPTIONS=--stack-trace-limit=100` -> `export QUARTO_NODE_OPTIONS=--stack-trace-limit=100`; line 51 message `is QUARTO_DENO_V8_OPTIONS set with a sufficiently-large stack size?` -> `is QUARTO_NODE_OPTIONS set with a sufficiently-large --stack-trace-limit?`. The launchers already pass `--stack-trace-limit=100`; the message is for people who override it.

- [ ] **Step 3: Commit**

```bash
git add tests/run-tests.sh tests/run-tests.ps1 tests/binary-mode-strip-env.txt .gitignore configuration src/core/deno/debug.ts
git commit -m "tests/build: remove the Deno test-runner branch, DENO field, and dead Deno files"
```

### Task 3: Vendoring, `deno_std`, `deno.jsonc`, import-map generator; ratchet covers `src/deno_ral/`

**Files:**
- Delete: `package/scripts/vendoring/`, `package/scripts/deno_std/`, `src/resources/deno_std/`, `src/vendor_deps.ts`, `tests/test-deps.ts`, `deno.jsonc`, `package/src/common/create-deno-config.ts`, `package/src/common/deno-meta.json`, `package/src/common/create-dev-import-map.ts`, `src/dev_import_map.json`, `src/core/deno/import-maps.ts`
- Modify: `src/deno_ral/*.ts`, `tools/check-runtime-boundary.ts`, `tools/runtime-boundary-baseline.json`

- [ ] **Step 1: Delete**

```bash
git rm -r package/scripts/vendoring package/scripts/deno_std src/resources/deno_std
git rm src/vendor_deps.ts tests/test-deps.ts deno.jsonc package/src/common/create-deno-config.ts package/src/common/deno-meta.json package/src/common/create-dev-import-map.ts src/dev_import_map.json src/core/deno/import-maps.ts
grep -rn "import-maps.ts\|create-dev-import-map\|create-deno-config\|deno-meta\|vendor_deps\|test-deps.ts\|deno_std\|vendoring/" . --include=*.ts --include=*.mjs --include=*.sh --include=*.cmd --include=*.bat --include=*.yml --include=*.json | grep -v "node_modules\|dev-docs/runtime-migration"
```
Expected: no output (docs are handled in Task 4). `src/resources/deno_std/run_import_map.json` was moved by PR 35; if `git rm -r src/resources/deno_std` complains it is already gone, continue.

- [ ] **Step 2: Remove Deno branches from `src/deno_ral/`**

Run: `grep -rn "Deno\b\|runtime().name === \"deno\"\|isDeno" src/deno_ral`

For each hit, delete the Deno branch and keep the Node implementation (PR 27-30 wrote each module as "Node implementation, with a Deno-specific branch only where Deno's compatibility layer fell short"). Typical shapes and their resolution:

```ts
// before
if (runtime().name === "deno") {
  return Deno.readTextFileSync(path);
}
return nodeFs.readFileSync(path, "utf8");
// after
return nodeFs.readFileSync(path, "utf8");
```

`runtime()` itself (in `platform.ts`) keeps returning `"node"` from `process.versions.node` and may keep the `"deno" | "bun"` union for `quarto check` output; delete the `typeof Deno !== "undefined"` detection branch. Run the module unit tests after each file: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/deno-ral/`.

- [ ] **Step 3: Ratchet to zero everywhere**

In `tools/check-runtime-boundary.ts` remove the `src/deno_ral/` exclusion so the `\bDeno\.` scan covers it, and add the explicit allow-list for the three files that legitimately mention Deno (`src/core/run/deno.ts`, `src/tools/impl/deno.ts`, `src/resources/run-compat/**` are either Deno-free TypeScript that *spawns* Deno, or the shim JavaScript, which the scan does not read because it only scans `.ts`; verify `grep -c "Deno\." src/core/run/deno.ts src/tools/impl/deno.ts` prints `0` for both and drop the allow-list if so). Rewrite the baseline:

```bash
quarto run --dev tools/check-runtime-boundary.ts --update-baseline
cat tools/runtime-boundary-baseline.json
```
Expected: every count `0`. Change the ratchet's failure message to say the layer is `src/deno_ral/` (or `src/runtime/` after Task 5) and that new `Deno.` uses are not allowed anywhere.

- [ ] **Step 4: Commit**

```bash
git add -A src/deno_ral tools/check-runtime-boundary.ts tools/runtime-boundary-baseline.json
git commit -m "chore: remove Deno vendoring, deno_std, deno.jsonc; boundary ratchet at zero including deno_ral"
```

### Task 4: Documentation sweep

**Files:** listed in the Context "Docs" paragraph.

- [ ] **Step 1: `dev-docs/ci-deno-caching.md` -> `dev-docs/ci-npm-caching.md`**

```bash
git mv dev-docs/ci-deno-caching.md dev-docs/ci-npm-caching.md
```

Replace the whole content:

```markdown
# CI npm cache

How the npm download cache is cached in GitHub Actions, how invalidation
works, and how to force a fresh download.

## What gets cached

One cache is restored by the `quarto-dev` composite action
(`.github/workflows/actions/quarto-dev/action.yml`): npm's download cache
(`~/.npm`), populated by `npm ci` at the repository root (run by
`configure.sh`/`configure.cmd`), by `src/webui/quarto-preview/build.mjs`
(`npm ci` for the preview client) and by `quarto-bld validate-bundle`
(`tools/bundle-bug-finder`).

The Node.js binary itself is not cached: `configure.sh` downloads about 30 MB
from nodejs.org and verifies it against `SHASUMS256.txt`.

## Cache key

```
${{ runner.os }}-${{ runner.arch }}-npm-v1-<hash>
```

`<hash>` is `hashFiles()` over the lockfiles: `package-lock.json`,
`src/webui/quarto-preview/package-lock.json`, and
`tools/bundle-bug-finder/package-lock.json` when present. `restore-keys` falls
back to the prefix without the hash, so a sibling branch's cache is reused when
the exact key misses (`npm ci` then downloads only the packages that changed).

## Forcing invalidation

Editing a lockfile changes the key automatically. To discard a bad cache
without touching the lockfiles, bump `-v1-` to `-v2-` in both `key` and
`restore-keys` of the cache step in `action.yml`.

## Rollback

Delete the "Cache npm downloads" step in `action.yml`; `npm ci` then downloads
everything on each run (about 60 s on the Linux runner).
```

- [ ] **Step 2: `dev-docs/add-typescript-dependency.md`**

Replace the whole content:

```markdown
## Adding a new TypeScript dependency to the project

Dependencies are npm packages (JSR packages through the `npm.jsr.io`
compatibility registry, configured in `.npmrc`). They are bundled into
`bin/quarto.js` by `tools/node-bundle/build.mjs`; nothing is downloaded when
Quarto runs.

1. `npm install <package>@<exact version>` at the repository root. Pin exact
   versions (`npm config get save-exact` is `true` in `.npmrc`); commit
   `package.json` and `package-lock.json`.
2. Add an import-map entry in `src/import_map.json` for the name the code
   uses, e.g. `"ansi_up": "npm:ansi_up@6.0.2"` or `"@std/path": "jsr:@std/path@1.0.8"`.
   The bundler resolves `npm:` and `jsr:` targets to `node_modules`.
3. Import it by the import-map name in code (`import ... from "ansi_up"`).
   Runtime-shaped modules go through `src/deno_ral/` (see
   `.claude/rules/typescript/runtime-layer.md`).
4. If a `quarto run` script should be able to import it, add it to
   `src/resources/run-compat/run-stdlib.json` (see
   `dev-docs/runtime-migration/35-user-scripts-compat.md`).
5. Run `./configure.sh` (or `npm ci` and `package/dist/bin/quarto --help`,
   which rebuilds the dev bundle) and `npm run typecheck` (after PR 38).

Test-only dependencies: same steps; there is no separate test import map.
```

(Adjust step 1 if `.npmrc` from PR 26 does not set `save-exact`; then write `npm install --save-exact`.)

- [ ] **Step 3: Delete `dev-docs/update-deno_jsonc.md`; fix `dev-docs/claude-code-setup.md:22`**

```bash
git rm dev-docs/update-deno_jsonc.md
```
Line 22 of `claude-code-setup.md`: `typescript/ — Deno essentials, RAL, Cliffy commands` -> `typescript/ — TypeScript essentials, runtime layer, Cliffy commands`.

- [ ] **Step 4: `.claude/CLAUDE.md`**

- Line 7: `The CLI is TypeScript/Deno with Lua filters` -> `The CLI is TypeScript on Node.js with Lua filters`.
- Line 19: `Downloads Deno + dependencies, runs \`quarto-bld configure\`, vendors TypeScript deps, and symlinks` -> `Downloads Node.js, runs \`npm ci\`, runs \`quarto-bld configure\` (binary dependencies, preview client, run-stdlib), and symlinks`.
- Line 23: `(Deno, Pandoc, Dart Sass, …)` -> `(Node.js, Pandoc, Dart Sass, …)`.
- Line 24: delete the `deno.jsonc` bullet.
- Line 25: `Deno import mappings (production / development)` -> `import map applied by the bundler (\`tools/node-bundle/build.mjs\`); \`package.json\` pins the packages`. Delete the `src/dev_import_map.json` mention.
- Line 35: `Use \`quarto-bld\` for builds, not direct Deno commands.` -> `Use \`quarto-bld\` for builds, not direct \`node\`/\`npm\` commands.`
- Line 58: `Deno binary \`package/dist/bin/tools/<arch>/deno\`` -> `Node binary \`package/dist/bin/tools/<arch>/node\``; `vendored deps \`src/vendor/\`` -> `npm packages \`node_modules/\``.
- Line 62: `**TypeScript/Deno:** use Deno-native APIs (avoid Node.js APIs); imports must include the \`.ts\` extension; dependencies resolve via import maps;` -> `**TypeScript:** application code imports \`src/deno_ral/\` for files, processes, environment and network (never \`node:*\` directly outside that layer); imports must include the \`.ts\` extension; dependencies resolve through \`src/import_map.json\` at bundle time;`.
- In the "Memory file layout" bullet, nothing mentions Deno; leave.

- [ ] **Step 5: `.claude/rules/typescript/`**

```bash
git mv .claude/rules/typescript/deno-essentials.md .claude/rules/typescript/essentials.md
git mv .claude/rules/typescript/deno-ral.md .claude/rules/typescript/runtime-layer.md
```

`essentials.md`: title `# TypeScript Essentials`; section "Deno RAL (Runtime Abstraction Layer)" -> "Runtime layer (`src/deno_ral/`)" pointing at `runtime-layer.md`; replace the "Deno APIs vs Node.js" section with:

```markdown
## Runtime calls

Application code never calls `Deno.*` (gone) or `node:*` modules directly; it imports the runtime layer:

```typescript
// Correct
import { readTextFileSync, writeTextFileSync } from "../deno_ral/fs.ts";
import { env } from "../deno_ral/env.ts";
import { cwd } from "../deno_ral/process.ts";
import { makeTempDirSync } from "../deno_ral/temp.ts";

// Wrong
import fs from "node:fs";
process.env.PATH;
```

`tools/check-runtime-boundary.ts` fails CI on a new `Deno.` use or a direct `node:`/`@std` import outside the layer.
```

Keep the "Lint Directives" section as is (PR 38 rewrites it). Key conventions item 4: `**Use Deno APIs** - No Node.js equivalents` -> `**Use the runtime layer** - no direct \`node:*\` imports outside \`src/deno_ral/\``.

`runtime-layer.md`: title `# Runtime layer (\`src/deno_ral/\`)`; first paragraph: "provides the runtime abstraction over Node.js built-ins; all code imports from here instead of `node:*` or `@std/*`"; extend the modules table with the modules the migration added (`env.ts`, `temp.ts`, `errors.ts`, `net.ts`, `http.ts`, `watch.ts`, `kv.ts`, `main.ts`, `colors.ts`, `semver.ts`, `flags.ts`: one line each, names from `_TEMPLATE.md`); replace the "Module Loading Order" section (monkey-patch is gone since PR 25) with "`src/quarto.ts` imports `./deno_ral/original-real-path.ts` first only if PR 25 kept it; otherwise delete this section". Keep the `paths:` frontmatter (`src/deno_ral/**/*.ts`).

- [ ] **Step 6: Testing rules, skills, `tests/README.md`, `llm-docs`**

- `.claude/rules/testing/typescript-tests.md`: line 9 `TypeScript-based tests using Deno.` -> `TypeScript-based tests on the Node test harness (\`tests/harness.ts\`).`; line 80 `// deno-lint-ignore require-await` stays until PR 38; line 93 `Deno.makeTempDirSync({ prefix: "quarto-test" })` -> `makeTempDirSync({ prefix: "quarto-test" })` with `import { makeTempDirSync } from "../../src/deno_ral/temp.ts";`.
- `.claude/rules/testing/test-anti-patterns.md:21-34`: `Deno.env.set()` -> `env.set()` (from `src/deno_ral/env.ts`); "Deno runs test files in parallel by default" -> "the harness runs test files in one process per file; module state is per file but the environment is process-global"; `Deno.chdir()` -> `chdir()` (from `src/deno_ral/process.ts`).
- `.claude/rules/testing/github-actions-reporting.md:37-38`: `Deno's final failure sections` -> `the runner's final failure sections`; `Deno module state is only per test file` -> `module state is only per test file`.
- `.claude/skills/quarto-preview-test/SKILL.md`, `references/embedded-viewer.md`: `grep -n -i deno` and replace each mention (they describe running the preview or a Deno script): `deno run` -> `quarto run`, "Deno" -> "the runtime".
- `tests/README.md`: line 15 `Tests use the \`Deno.test()\` framework` -> `Tests use the harness in \`tests/harness.ts\` (\`node:test\` underneath)`; lines 251-271 (the `--agent` reporter section): replace `deno's reporter`/`--reporter=dot` wording with what PR 31's harness does, delete the "Reporter collision (bash only)" paragraph and the `QUARTO_DENO_EXTRA_OPTIONS` mention; line 369 (the Windows `deno.exe test ...` log excerpt): replace with the equivalent Node command line printed by `run-tests.ps1` today; lines 540-552: `calling \`deno test\` directly` -> `calling the harness directly`, "run for each bucket from deno using Promise.all()" -> "run for each bucket by `tests/run-parallel-tests.ts` using `Promise.all()`".
- `llm-docs/axe-scan-architecture.md`, `built-version-testing-architecture.md`, `github-actions-test-reporting.md`, `html-postprocessors-finalizers.md`, `project-context-architecture.md`: `grep -n -i deno` each; replace present-tense "Deno" statements about the runtime with "Node"/"the runtime"; keep past-tense explanations of workarounds (e.g. "the 4 KB stdin chunking existed because of a Deno quirk").

Run: `grep -rn "Deno" .claude dev-docs llm-docs tests/README.md | grep -v "dev-docs/runtime-migration\|QUARTO_DENO\|quarto install deno\|Deno years\|ran on Deno\|from Deno\|deno-lint-ignore"`
Expected: no output.

- [ ] **Step 7: Commit**

```bash
git add -A .claude dev-docs llm-docs tests/README.md
git commit -m "docs: remove Deno-era developer documentation; describe the Node toolchain"
```

### Task 5 (optional): rename `src/deno_ral/` to `src/runtime/`

Do this only if the team said yes in the PR 37 description; it is one commit and reverts cleanly.

**Files:** 452 TypeScript files importing `deno_ral`, plus the non-TypeScript references listed below.

- [ ] **Step 1: Move and rewrite imports**

```bash
git mv src/deno_ral src/runtime
grep -rl "deno_ral" src tests package tools --include=*.ts --include=*.mjs --include=*.js --include=*.json | xargs sed -i 's#deno_ral#runtime#g'
grep -rl "deno_ral" .claude llm-docs dev-docs/runtime-migration/README.md tests/README.md | xargs sed -i 's#src/deno_ral#src/runtime#g; s#deno_ral/#runtime/#g; s#`deno_ral`#`runtime`#g'
grep -rn "deno_ral" . --include=*.ts --include=*.mjs --include=*.js --include=*.json --include=*.md --include=*.yml | grep -v "node_modules\|dev-docs/runtime-migration/[0-3]\|news/"
```
Expected: the last command prints nothing. On macOS use `sed -i ''`. The `.claude/rules/typescript/runtime-layer.md` frontmatter becomes `paths: - "src/runtime/**/*.ts"`; `tools/check-runtime-boundary.ts` and `src/resources/run-compat/run-stdlib.json` (`src/runtime/fs.ts`, `src/runtime/path.ts`) and `tools/node-bundle/build-run-stdlib.mjs` are covered by the first `sed`.

- [ ] **Step 2: Verify**

```bash
./configure.sh > /dev/null && package/dist/bin/quarto render tests/docs/smoke-all/2023/01/04/issue-3847.qmd
cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/
quarto run --dev tools/check-runtime-boundary.ts
```
Expected: render succeeds, unit suite green, ratchet zero. Also update `dev-docs/runtime-migration/README.md` ground rule 2 to name `src/runtime/` and add a line to this plan's commit message that later migration plans still say `src/deno_ral/` for historical paths.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "refactor: rename src/deno_ral to src/runtime"
```

## Verification

- All acceptance-criteria `grep` commands print nothing.
- `./configure.sh` from a clean clone, then `package/dist/bin/quarto check`, a render, `cd package/src && ./quarto-bld prepare-dist --set-version 99.9.9 && ./quarto-bld validate-bundle`.
- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ smoke/run/ smoke/check/ smoke/build-ts-extension/` green locally; the full matrix green on the branch.
- `quarto run --dev tools/check-runtime-boundary.ts` prints zero counts.
- Dispatch `create-release.yml` (`publish-release=false`) once: green.

## Review checklist

- [ ] No workflow references `deno`, `deno_cache`, `deno_std`, `QUARTO_SKIP_DENO_CACHE_WIPE` or `QUARTO_TEST_RUNTIME`.
- [ ] `tests/run-tests.sh` and `.ps1` have a single (Node) execution path; the three `run-tests-*.test.sh` scripts pass.
- [ ] Deleted files have no remaining importers (the Task 3 `grep`).
- [ ] `src/deno_ral/` contains no `Deno` identifier; the ratchet baseline is all zeros and the scan includes the layer.
- [ ] `.claude/CLAUDE.md` setup section matches what `configure.sh` does after PR 33/35.
- [ ] Documentation keeps past-tense explanations of Deno-era workarounds where they still explain code (stdin chunking, `realPathSync` normalisation) and removes present-tense ones.
- [ ] If Task 5 ran: `git diff --stat` shows only path changes in `src/`, `tests/`, `package/src`, `tools/` plus the listed docs; no logic changes.

## Risks and rollback

- **A deleted file was still read by something not covered by the greps** (a Positron/RStudio build script reading `src/dev_import_map.json`, for instance). Symptom: downstream build failure. The PR description lists every deleted path so packagers can search their side; restoring a file is a one-line `git checkout <sha> -- <path>`.
- **The rename churns every open PR.** Land Task 5 as its own commit at a quiet moment (right after a release branch is cut), announce it, and give `git rebase` instructions: `git rebase main -X theirs` resolves import-line conflicts automatically; the `sed` from Step 1 fixes any leftover.
- **Rollback:** revert the PR (or just the rename commit). Nothing user-visible changes.

## Decisions needed

1. **Run the rename (Task 5) now or never.** Recommendation: now, in this PR, as the last commit: the migration is the one moment when every file is already being touched for the same reason, and the name `deno_ral` will confuse every new contributor after the flip.
