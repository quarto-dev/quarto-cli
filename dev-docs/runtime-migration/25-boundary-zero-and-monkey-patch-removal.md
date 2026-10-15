# PR 25: Delete `core/deno/monkey-patch.ts`, sweep types and comments, set the ratchet to zero, make it a hard failure

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close Phase 1: remove the last runtime-specific scaffolding (`src/core/deno/monkey-patch.ts`, `src/deno_ral/original-real-path.ts`, the `call` alias in `src/deno_ral/process.ts`), sweep the remaining `Deno.*` type references (absorbing the former PR 21) and comment mentions, record the standalone scripts in an explicit ratchet allow-list, set the runtime-boundary baseline to zero for `src/` and `package/src`, make the boundary check a required CI status, and prove the hidden-dependency inventory is closed.
**Phase:** 1. **Depends on:** PR 04 (removes `deno.land/x/cache`), PR 07 (removes the puppeteer 9.0.2 port), PRs 08–20, PR 20b (`onFileRead`, `metrics.ts`, the `src-js`/`resources` baselines), PRs 22–24. **Unblocks:** PR 27–31 (Phase 2 reimplementations).
**Branch:** `rt/25-boundary-zero-and-monkey-patch-removal`.
**Suggested executor:** Sonnet. Verification plus deletions and one-line rewrites; each behaviour the monkey patch carried has a named home and a test to point at, and every remaining site is listed below with its replacement.
**Size:** M. 2 files deleted; about 25 files modified (the 4 `originalRealPathSync` callers, the `call` users, about 15 files with a comment that names `Deno.*`, the boundary tool, the type-sweep stragglers if any), plus `tools/runtime-boundary-baseline.json`, the workflow, two `.claude/rules` files and `README.md`.
**Ships on:** Deno; the existing test suite must stay green.

## Spec

### Context

Assessment section 3.3, row "Monkey patches (`src/core/deno/monkey-patch.ts`)", section 11 design rule 3 (no Deno types in signatures, "Order of work" step 6) and the `README.md` progress metric: zero `Deno.*` sites in `src/` and `package/src` is the exit criterion of Phase 1. Review findings S1 (hidden dependencies), S10 (`realPathSync`/`canonicalPathSync`, `@std/fs` facts) and section 4 "25" (metrics owner, standalone scripts, missing dependencies, `\\?\UNC` slicing, comment lines) shape this version. The former PR 21 (types sweep) is folded in as Task 2: every row of its table has an owner among PRs 08–18, so what is left is a verification grep plus stragglers.

`src/core/deno/monkey-patch.ts` (135 lines, imported at `src/quarto.ts:9` right after `src/deno_ral/original-real-path.ts` at line 8) does four things:

1. `Deno.realPathSync = normalizePath` (line 17). No code calls `Deno.realPathSync` itself (PR 09 verified it). In `@std/fs@1.0.16` the only caller is `walk`/`walkSync`, and only with `followSymlinks: true` (`walk.ts:922`), which `expandGlob` forwards; `copy` and `expand_glob` never call it. Every Quarto call site passes `followSymlinks: false` or relies on the default `false`. So removing the patch changes nothing observable today; there is no symlink behaviour to test end to end, and this plan does not pretend to (the first draft's "render through a symlinked directory" check exercised nothing the patch affects).
2. `(Deno as any).copy = copy; (Deno as any).writeAll = writeAll;` (lines 22–24) for "some of our dependencies [that] use Deno.copy and have not been ported to Deno 2". The candidates were `deno.land/x/puppeteer@9.0.2` (deleted by PR 07, option B) and `deno.land/x/cache@0.2.12` (removed by PR 04). Task 1 scans the resolved module graph to prove no consumer is left.
3. `makeTempFile{,Sync}`/`makeTempDir{,Sync}` wrapped in a 5-attempt retry (lines 35–99, denoland/deno#17781). PR 09's `temp.ts` carries it, narrowed to `isAlreadyExists` (the EEXIST race the comment describes).
4. `readTextFile{,Sync}` wrapped to append `\nPath: <path>` to the error message (lines 101–135). PR 09's `fs.ts` read functions carry it through `errorWithPath`. What is lost: the annotation for reads that dependencies make through `Deno.readTextFile` directly (none found in the module graph), and the retry for dependencies' own temp files (none).

`src/deno_ral/original-real-path.ts` saves the unpatched `Deno.realPathSync`. PR 09 introduced `canonicalPathSync` on it and moved `safeRemoveDirSync`; this PR points `canonicalPathSync` at `Deno.realPathSync` itself (once the patch is gone they are the same function; Deno returns no `\\?\` prefix, so nothing is sliced: a 4-character slice would turn `\\?\UNC\srv\share` into `UNC\srv\share`) and moves the remaining four callers: `src/command/check/check.ts:194`, `tests/utils.ts:315`, `tests/smoke/project/project-detect-denied-config.test.ts:26`, `tests/smoke/check/check-info-project.test.ts:27`.

`src/core/performance/metrics.ts` used to reassign `Deno.readTextFileSync`; PR 20b replaced that with `onFileRead(listener)` in `src/deno_ral/fs.ts`. This PR only verifies it (`metrics.ts` has no `Deno.*` left after its two other sites, `Deno.env.get` at 63 and `Deno.writeTextFileSync` at 65, are converted by PR 10/14's codemod or, if those ran before PR 20b, by Task 6 here).

`src/deno_ral/process.ts` still exports `call(path, opts)` (vocabulary: "thin alias of exec, removed in PR 25"); users: `src/command/render/pandoc.ts:227,1668-1669` (`ttx`), `src/command/create/editor.ts:25,107,164,233` (launching VS Code, Positron, RStudio).

**Ratchet scopes and the allow-list.** PR 02's `tools/check-runtime-boundary.ts` has five scopes (`src`, `src-js`, `resources`, `package/src`, `tests`) and the exported `kSrcExclusions` (`src/deno_ral`, `src/vendor`, `src/resources/extension-subtrees`, `src/resources/scripts`, `src/resources/create`, `src/webui/quarto-preview/build.ts`); `src/resources/scripts` and `src/resources/create` are counted in the `resources` scope instead (`kUserScriptResourceDirs`). Two standalone scripts in or next to the `src` scope cannot import the layer because they run without the import map, and are not converted:

| Path | Sites | Why | Allow-list entry (this PR) | Ported by |
|---|---|---|---|---|
| `src/resources/tools/ast-diagram/main.ts` | 6 (+1 std import file) | executed by `deno run` from `share/tools` (`src/command/dev-call/make-ast-diagram/cmd.ts:23-29`) without the import map; imports `https://deno.land/std/path/mod.ts` | added to `kSrcExclusions` and to `kUserScriptResourceDirs`, so it leaves the `src` scope and is ratcheted under `resources` | PR 35 (`quarto run` work) |
| `src/webui/quarto-preview/build.ts` | 8 | that package's build script, `deno run --no-config -A build.ts` (`package/src/common/previewjs.ts:14`); `deno_ral/fs.ts` needs the import map | already in `kSrcExclusions`; this PR rewrites its reason comment (PR 08 does not convert it) | PR 33 (build tooling) |
| `src/command/render/latexmk/quarto-latexmk.ts` (only if PR 39 has not landed) | 1 (`Deno.args`) | standalone `tinitex` entry compiled by `deno compile`; decision 9 deletes it | added to `kSrcExclusions` with the reason "deleted by PR 39"; PR 39 removes the entry together with the file | PR 39 (deletion) |

Every other path under `src/` and `package/src` reaches zero, comments included (the `Deno.` counter counts text, PR 02).

**Comment and string occurrences.** On `b86f98d`, 23 of the 992 `src` occurrences are not code (comments and one commented-out block), plus one comment line in `package/src`. Some are removed by earlier PRs, the rest by Task 5 of this PR:

| Occurrence | Removed by |
|---|---|
| `src/core/typst.ts:309` (dead `/* typstWatch */` block) | PR 08 (deletes the block) |
| `src/quarto.ts:187` ("The calls to Deno.exit() above") | PR 08 (its `sed` rewrites it) |
| `src/quarto.ts:7`, `src/core/deno/monkey-patch.ts:19,27,30` | this PR, Task 4 (deleted with the patch) |
| `src/command/call/axe/cmd.ts:184,217,413,417`, `src/command/preview/preview.ts:220`, `src/core/copy.ts:28,145`, `src/core/http-server.ts:12`, `src/core/platform.ts:17`, `src/core/sass/analyzer/declaration-types.ts:84`, `src/core/sass/cache.ts:4`, `src/core/windows.ts:128`, `src/execute/jupyter/jupyter-kernel.ts:272`, `src/execute/ojs/extract-resources.ts:561` (trailing comment), `src/project/types/book/book-render.ts:619`, `src/publish/common/bundle.ts:106`, `src/tools/tools-console.ts:165`, `package/src/linux/installer.ts:186` | this PR, Task 5 (exact rewrite per line) |

**Hidden-dependency inventory (exit criterion, review S1).** Phase 1 is complete only when all of the following hold; Task 7 checks each and the PR description records the result:

1. Ratchet: `src` and `package/src` at 0/0; `src-js` and `resources` at exactly the values PR 20b recorded (`src-js` 0; `resources` 5 plus the 6 sites and 1 std-import file of `ast-diagram/main.ts`, which this PR moves into that scope); `tests` at the residue PR 23 documents.
2. Std modules that call `Deno.*` internally, each either reimplemented or owned by a named Phase 2 PR:

| Std module (as imported) | Internal `Deno.*` | Status at PR 25 |
|---|---|---|
| `@std/log` `FileHandler` | `Deno.openSync` | reimplemented in `src/deno_ral/log.ts` (PR 20b) |
| `@std/dotenv` `load`/`parse` | `Deno.readTextFile`, `Deno.env.get` | reimplemented in `src/quarto-core/dotenv.ts` (PR 20b) |
| `@std/io` `readLines`/`readAll` on `Deno.stdin` | `Deno.stdin` passed in by Quarto | replaced by `readStdinLines`/`readStdin` (PR 08) |
| `@std/fs` `walk`, `expandGlob`, `copy`, `move`, `ensureDir`, `exists`, `emptyDir` | `Deno.*` throughout | still re-exported by `src/deno_ral/fs.ts`; reimplemented on `node:fs` by PR 27 (Phase 1 only moved the callers) |
| `@std/tar` (via `src/deno_ral/tar.ts`) | `Deno.open` and friends | owned by PR 27b |
| `@std/fmt/printf` `sprintf` | `Deno.inspect` for `%i`/`%I` and its bad-argument text only | not reached: Quarto's one use is `sprintf("%<n>d: ", …)` (`src/core/text.ts:79`); recorded, not replaced (PR 20b) |

3. Deno CLI invocations that remain on purpose, each with its owner: in `package/src`, `common/previewjs.ts:18` (`execPath()` + `run build.ts`), `util/deno.ts` (`QUARTO_DENO` + `bundle`/`compile`/`install`), `common/cyclic-dependencies.ts:143-148`, `common/import-report/deno-info.ts:66` and `report-bundle-async-cycles.ts:28` → PR 33 (build tooling on Node; `compile` goes with PR 39); in `src/`, `core/schema/types-from-schema.ts:30` (`deno fmt`, `dev-call build-artifacts`) → PR 33/38, `execute/ojs/extract-resources.ts:337` (`deno check` of OJS TypeScript) → PR 33, `command/dev-call/make-ast-diagram/cmd.ts:23` (`deno run` of `ast-diagram/main.ts`) → PR 35, `core/run/deno.ts` (`quarto run`) → PR 35, `command/call/build-ts-extension/cmd.ts` → PR 36.
4. `src/resources/extension-subtrees/julia-engine` is excluded from every scope; decision 7 tracks it upstream and it must be pulled before PR 32.

**Deno types in signatures (former PR 21).** Inventory grep (`Deno.<Type>` in a type position anywhere outside the layer):

```bash
rg -n 'Deno\.(CommandOptions|CommandOutput|ChildProcess|FsEvent|FileInfo|Conn|Kv|MakeTempOptions|CommandStatus|TcpConn|RemoveOptions|ReadFileOptions|TestDefinition|FsFile|Reader|Writer|DirEntry|WriteFileOptions|MkdirOptions|Listener|HttpServer|ServeHandler|NetAddr|FsWatcher|OpenOptions|KvEntry|KvKey)\b' src package/src tests tools -g '*.ts' \
  | rg -v '^src/deno_ral/|extension-subtrees|^tools/'
```

| File:line (on `b86f98d`) | Type | Owner | Layer replacement |
|---|---|---|---|
| `src/core/temp.ts:58,71,76,79`, `src/core/temp-types.ts:11,13,14` | `Deno.MakeTempOptions` | PR 10 (codemod `temp` rule) | `TempOptions` (`src/deno_ral/temp.ts`) |
| `src/core/copy.ts:231,232` | `Deno.FileInfo` | PR 10 (codemod `fs` rule) | `FileInfo` (`src/deno_ral/fs.ts`) |
| `src/core/qualified-path.ts:69` | `Deno.ReadFileOptions` | PR 10 (hand fix; parameter dropped) | none |
| `src/core/cri/launch.ts:134,139,146` | `Deno.CommandStatus` | PR 08 | `ExitStatus` (`src/deno_ral/process.ts`) |
| `package/src/util/cmd.ts:11` | `Deno.CommandStatus` | PR 08 | `ExitStatus` |
| `src/core/process.ts:12,16,48`, `src/command/render/pandoc.ts:262`, `src/execute/jupyter/jupyter-kernel.ts:63` | `Deno.ChildProcess`, `Deno.CommandOptions` | PR 08 | `ChildProcess`, `SpawnOptions` |
| `src/execute/jupyter/jupyter-kernel.ts:261,377,466` | `Deno.Conn` | PR 15 | `TcpConnection` (`src/deno_ral/net.ts`) |
| `src/core/watch.ts:12,14`, `src/project/serve/watch.ts:110` | `Deno.FsEvent` | PR 17 | `FsEvent` (`src/deno_ral/watch.ts`) |
| `src/core/cache/cache.ts:32`, `src/core/sass/cache.ts:20,27,173` | `Deno.Kv` | PR 18 | `KeyValueStore` (`src/deno_ral/kv.ts`) |
| `src/deno_ral/fs.ts:30,116` | `Deno.FileInfo`, `Deno.RemoveOptions` | PR 09 (retyped) | `FileInfo`, `{ recursive?: boolean }` |
| `src/core/deno/monkey-patch.ts:83-106` | `Deno.MakeTempOptions`, `Deno.ReadFileOptions` | this PR (file deleted) | none |
| `src/webui/quarto-preview/build.ts:36` | `Deno.CommandOutput` | allow-listed (PR 33) | none |
| `tests/test.ts:545` | `Deno.TestDefinition` | PR 23 (`tests/harness.ts`) | `TestDefinition` (`tests/harness.ts`) |

Two further `Deno.<Capitalised>` hits exist and are comments (`src/core/windows.ts:128` `Deno.Run`, `src/core/sass/cache.ts:4` `Deno.KV`; Task 5).

PR 02's workflow is `.github/workflows/runtime-boundary.yml`, running `quarto run --dev tools/check-runtime-boundary.ts` on pull requests and pushes to `main`; the script already exits 1 on any increase. Making the status *required* is a branch-protection setting on `quarto-dev/quarto-cli` `main` (Settings → Branches → `main` → "Require status checks to pass" → add the job name from that workflow); a repository admin does it when this PR merges, and the PR description asks for it explicitly.

### Scope

In: the deletions; `canonicalPathSync` on `Deno.realPathSync` and its four remaining callers; the `call` removal; the type-sweep verification and stragglers; the comment cleanup; the allow-list entries in `tools/check-runtime-boundary.ts`; converting any leftover `Deno.*` code site in `src/`/`package/src`; the baseline at zero; the hard-failing workflow; the hidden-dependency inventory; rules and README updates.
Out: `tests/` residue (documented in PR 23; PR 31 finishes it); the allow-listed standalone scripts; `tools/*.ts` (PR 33/35); reimplementing `@std/fs`/`@std/tar` (PR 27/27b).

### Interfaces

Removed: `call` from `src/deno_ral/process.ts`; module `src/deno_ral/original-real-path.ts`; module `src/core/deno/monkey-patch.ts`.

Changed implementation, same signature (vocabulary):

```ts
/** Symlinks resolved; the runtime returns no Windows `\\?\` prefix; throws when
 *  `path` does not exist. Deno: Deno.realPathSync; PR 27: fs.realpathSync.native. */
export function canonicalPathSync(path: string | URL): string;
```

`tools/check-runtime-boundary.ts` (PR 02's tool): `kSrcExclusions` gains `src/resources/tools/ast-diagram` (and, conditionally, `src/command/render/latexmk/quarto-latexmk.ts`); `kUserScriptResourceDirs` gains `src/resources/tools/ast-diagram/`.

### Files

- Delete: `src/core/deno/monkey-patch.ts`, `src/deno_ral/original-real-path.ts`.
- Modify: `src/quarto.ts:7-9`; `src/deno_ral/fs.ts` (`canonicalPathSync` body, `originalRealPathSync` import); `src/deno_ral/process.ts` (remove `call`); `src/command/render/pandoc.ts:227,1668-1669`; `src/command/create/editor.ts:25,107,164,233`; `src/command/check/check.ts:33,194`; `tests/utils.ts:14,315`; `tests/smoke/project/project-detect-denied-config.test.ts:13,26`; `tests/smoke/check/check-info-project.test.ts:13,27`.
- Modify (comments, Task 5): the files in the comment table.
- Modify: `tools/check-runtime-boundary.ts` (`kSrcExclusions`, `kUserScriptResourceDirs`, the `build.ts` reason), `tests/unit/tools/check-runtime-boundary.test.ts` (one case), `tools/runtime-boundary-baseline.json`, `.github/workflows/runtime-boundary.yml` (verify only), `.claude/rules/typescript/deno-essentials.md`, `.claude/rules/typescript/deno-ral.md`, `dev-docs/runtime-migration/README.md`.

### Acceptance criteria

- `rg -n '\bDeno\.' src package/src -g '*.ts' -g '!src/deno_ral/**' -g '!src/resources/extension-subtrees/**' -g '!src/resources/scripts/**' -g '!src/resources/create/**' -g '!src/resources/tools/ast-diagram/**' -g '!src/webui/quarto-preview/build.ts' -g '!src/command/render/latexmk/quarto-latexmk.ts'` prints nothing (comments included: the ratchet counts them).
- `quarto run --dev tools/check-runtime-boundary.ts` exits 0 with `src` and `package/src` at `0` for both counters, `src-js` and `resources` at PR 20b's recorded values (plus `ast-diagram/main.ts` in `resources`), and exits non-zero when a `Deno.cwd()` is temporarily added to `src/core/path.ts` (Task 7 step 3).
- `ls src/core/deno/monkey-patch.ts src/deno_ral/original-real-path.ts` → both "No such file".
- `rg -n 'originalRealPathSync|monkey-patch|original-real-path' src tests package/src .claude -g '!dev-docs/**'` prints nothing; `rg -n 'import \{[^}]*\bcall\b[^}]*\} from "[./]*deno_ral/process.ts"' src -g '*.ts'` prints nothing.
- The type inventory grep above prints only `tests/test.ts:545` if PR 23 kept it, or nothing.
- The hidden-dependency inventory (Context) holds; the PR description lists each item with its evidence.
- Full suite green: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/` locally; `smoke/` in CI on Linux, macOS and Windows.

## Plan

Assumes PRs 04, 07, 08–20, 20b and 22–24 landed. Line numbers are from `b86f98d`; earlier PRs moved many of them, so locate each by the quoted text with `rg -n`.

### Task 1: Verify each monkey-patch behaviour has a home

**Files:** none modified (findings go in the PR description)

- [ ] **Step 1: canonical paths**

Run: `rg -n 'export function canonicalPathSync' -A 3 src/deno_ral/fs.ts && rg -n 'canonicalPathSync resolves symlinks' tests/unit/ral/fs.test.ts`
Expected: the PR 09 function (calling `originalRealPathSync` for now) and its test. No `realPathSync` export exists: `rg -n 'export function realPathSync' src/deno_ral/fs.ts` prints nothing.

- [ ] **Step 2: Temp retries**

Run: `rg -n 'isAlreadyExists|retryOnAlreadyExists' src/deno_ral/temp.ts tests/unit/ral/temp.test.ts`
Expected: the retry loop narrowed to `isAlreadyExists` and the test "retries only AlreadyExists, at most 5 times".

- [ ] **Step 3: Read-error path annotation**

Run: `rg -n 'errorWithPath' src/deno_ral/fs.ts src/deno_ral/errors.ts && rg -n 'Path: ' tests/unit/ral/fs.test.ts tests/unit/ral/errors.test.ts`
Expected: defined in `errors.ts`, used by the four read functions in `fs.ts`; tests asserting the suffix appears once.

- [ ] **Step 4: `Deno.copy` / `Deno.writeAll` consumers**

```bash
cd src && ../package/dist/bin/tools/x86_64/deno info --json --unstable-kv --import-map=import_map.json quarto.ts \
  | python3 -c "import json,sys; [print(m['local']) for m in json.load(sys.stdin)['modules'] if m.get('local')]" \
  | xargs grep -ln 'Deno\.copy\b\|Deno\.writeAll\b' 2>/dev/null; cd ..
```

Expected: only `src/core/deno/monkey-patch.ts` itself. Any other hit is a dependency still using the removed APIs; name it in the PR and stop (see Decisions).

- [ ] **Step 5: File-read metrics**

Run: `rg -n 'onFileRead' src/core/performance/metrics.ts src/deno_ral/fs.ts && rg -n '\bDeno\.' src/core/performance/metrics.ts`
Expected: `metrics.ts` imports `onFileRead` (PR 20b); the second command prints nothing, or only the lines 63/65 sites that Task 6 converts.

- [ ] **Step 6: Record**

Paste the five results in the PR description under "Monkey-patch behaviours accounted for".

### Task 2: Deno types in signatures (former PR 21)

**Files:** only the stragglers the grep lists.

- [ ] **Step 1: Run the inventory grep from Context**

Expected: nothing, or `tests/test.ts:545` only if PR 23 kept it, plus `src/core/deno/monkey-patch.ts` (deleted in Task 4). Paste the output in the PR description.

- [ ] **Step 2: Convert stragglers**

For every other line, apply the table's replacement with a type-only import, merged into an existing import from the same module when there is one: `import type { TempOptions } from "<rel>/deno_ral/temp.ts";`, `import type { FileInfo } from "<rel>/deno_ral/fs.ts";`, `import type { ChildProcess, ExitStatus, SpawnOptions } from "<rel>/deno_ral/process.ts";`, `import type { TcpConnection } from "<rel>/deno_ral/net.ts";`, `import type { FsEvent } from "<rel>/deno_ral/watch.ts";`, `import type { KeyValueStore } from "<rel>/deno_ral/kv.ts";`. A straggler in a file owned by a PR that did not land means that PR is missing: stop and land it instead of converting here.

- [ ] **Step 3: Type-check and commit (only if Step 2 changed files)**

Run: `cd src && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --import-map=import_map.json quarto.ts` → exit 0.

```bash
git add -u src package/src
git commit -m "types: replace remaining Deno.* type references with deno_ral types"
```

### Task 3: Remove the `call` alias

**Files:**
- Modify: `src/deno_ral/process.ts`, `src/command/render/pandoc.ts`, `src/command/create/editor.ts`

- [ ] **Step 1: Callers**

`pandoc.ts`: `import { call, type SpawnOptions } from "../../deno_ral/process.ts";` (PR 08) → `import { exec, type SpawnOptions } from "../../deno_ral/process.ts";` (merge if `exec` is already imported). The two `await call("ttx", { args: [...] })` → `await exec("ttx", { args: [...] })` (same object literals).

`editor.ts:25`: same import change. Lines 107, 164: `await exec(path, { args: [artifactPath], cwd });`. Line 233: `await exec(callPath, { args, cwd });`.

- [ ] **Step 2: Remove `call` from `src/deno_ral/process.ts`**

Delete the `/** Deprecated alias of exec; removed in PR 25. */` comment and the `export const call = ...` declaration.

- [ ] **Step 3: Type-check and test**

Run: `cd src && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --import-map=import_map.json quarto.ts` → exit 0.
Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/process.test.ts smoke/create/create.test.ts` → pass.

- [ ] **Step 4: Commit**

```bash
git add src/deno_ral/process.ts src/command/render/pandoc.ts src/command/create/editor.ts
git commit -m "deno_ral/process: remove the call alias; callers use exec"
```

### Task 4: `canonicalPathSync` on the runtime, then delete the monkey patch and `original-real-path.ts`

**Files:**
- Delete: `src/core/deno/monkey-patch.ts`, `src/deno_ral/original-real-path.ts`
- Modify: `src/quarto.ts:7-9`, `src/deno_ral/fs.ts`, `src/command/check/check.ts`, `tests/utils.ts`, `tests/smoke/project/project-detect-denied-config.test.ts`, `tests/smoke/check/check-info-project.test.ts`

- [ ] **Step 1: `src/quarto.ts:7-9`**

Delete the three lines:

```ts
// Must be FIRST to save original Deno.realPathSync before monkey-patching
import "./deno_ral/original-real-path.ts";
import "./core/deno/monkey-patch.ts";
```

- [ ] **Step 2: `src/deno_ral/fs.ts`**

Delete `import { originalRealPathSync } from "./original-real-path.ts";` and replace `canonicalPathSync` (added by PR 09) with:

```ts
/**
 * The canonical absolute path: symlinks resolved, and no Windows `\\?\` prefix
 * (Deno strips it itself, so nothing is sliced here; slicing would mangle
 * `\\?\UNC\server\share`). Throws when the path does not exist. PR 27 moves
 * this to fs.realpathSync.native.
 */
export function canonicalPathSync(path: string | URL): string {
  return Deno.realPathSync(path);
}
```

- [ ] **Step 3: The four `originalRealPathSync` callers**

`src/command/check/check.ts:33`: remove the `original-real-path.ts` import and add `canonicalPathSync` to the existing `../../deno_ral/fs.ts` import; line 194: `return canonicalPathSync(home);`.

`tests/utils.ts:14`: replace the import with `canonicalPathSync` from `../src/deno_ral/fs.ts` (merge); line 315: `const dir = canonicalPathSync(makeTempDirSync({ prefix }));` (`makeTempDirSync` from `../src/deno_ral/temp.ts` since PR 23).

`tests/smoke/project/project-detect-denied-config.test.ts:13,26` and `tests/smoke/check/check-info-project.test.ts:13,27`: same substitution with `../../../src/deno_ral/fs.ts`.

- [ ] **Step 4: Delete the files**

```bash
git rm src/core/deno/monkey-patch.ts src/deno_ral/original-real-path.ts
```

- [ ] **Step 5: Type-check and run the sensitive tests**

Run: `cd src && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --import-map=import_map.json quarto.ts` → exit 0.
Run: `rg -n 'originalRealPathSync|original-real-path|monkey-patch' src tests package/src .claude` → nothing (Task 8 fixes `.claude/rules/typescript/deno-ral.md` if it is the only hit).
Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/ unit/path.test.ts unit/project/ smoke/project/project-detect-denied-config.test.ts smoke/check/check-info-project.test.ts smoke/project/project-prepost.test.ts smoke/render/render-html.test.ts` → pass. (`unit/ral/fs.test.ts` "canonicalPathSync resolves symlinks and throws when missing" and `unit/ral/safe-remove-dir.test.ts` cover the new body; on macOS the temp dir under `/var` resolves to `/private/var`, which is exactly what those tests compare.)

- [ ] **Step 6: Commit**

```bash
git add -A src/quarto.ts src/deno_ral src/core/deno src/command/check/check.ts tests/utils.ts tests/smoke/project/project-detect-denied-config.test.ts tests/smoke/check/check-info-project.test.ts
git commit -m "remove core/deno/monkey-patch.ts and original-real-path.ts; canonicalPathSync on Deno.realPathSync"
```

### Task 5: Comment and commented-out-code cleanup

**Files:** the files below (locate each line by its text; numbers are from `b86f98d`).

- [ ] **Step 1: List what is left**

```bash
rg -n '\bDeno\.' src package/src -g '*.ts' -g '!src/deno_ral/**' -g '!src/resources/**' -g '!src/webui/quarto-preview/build.ts' -g '!src/command/render/latexmk/quarto-latexmk.ts' \
  | rg '^[^:]+:[0-9]+:\s*(//|/\*|\*)|//.*\bDeno\.'
```

Expected: the lines in Step 2 (fewer if an earlier PR already rewrote one). Any other line is a comment added after `b86f98d`: rewrite it the same way.

- [ ] **Step 2: Rewrite or delete each**

| Line (text) | Edit |
|---|---|
| `src/command/call/axe/cmd.ts:184` `` * `Deno.realPathSync` was tried here first and dropped: Win32's`` | `` * `canonicalPathSync` (the runtime's realpath) was tried here first and dropped: Win32's`` |
| `src/command/call/axe/cmd.ts:217` `` * `Deno.writeTextFileSync(reportFile, ...)`) throws on a directory, and it`` | `` * `writeTextFileSync(reportFile, ...)`) throws on a directory, and it`` |
| `src/command/call/axe/cmd.ts:413` `// Deno.serve tears down asynchronously after stop() aborts it. Exiting the` | `// The HTTP server tears down asynchronously after stop() aborts it. Exiting the` |
| `src/command/call/axe/cmd.ts:417` `// server's own finished promise before returning toward Deno.exit closes` | `// server's own finished promise before returning toward exit() closes` |
| `src/command/preview/preview.ts:220` `// const listener = Deno.listen({ port: options.port!, hostname: options.host });` | delete the line |
| `src/core/copy.ts:28` `// rather than calling Deno.copyFileSync (to avoid deno's attempt to` | `// rather than calling the runtime's copyFileSync directly (to avoid its attempt to` |
| `src/core/copy.ts:145` `// remove the file first so that Deno.writeFileSync doesn't end up trying to` | `// remove the file first so that writeFileSync doesn't end up trying to` |
| `src/core/http-server.ts:12` `// Deno.serve logs "Listening on ..." unless a callback is supplied; pass a` | `// serveHttp logs "Listening on ..." unless a callback is supplied; pass a` (if PR 16 rewrote the file and the comment is gone, nothing to do) |
| `src/core/platform.ts:17` `// Test override for isRStudio — avoids Deno.env.set() race conditions` | `// Test override for isRStudio — avoids env.set() race conditions` |
| `src/core/sass/analyzer/declaration-types.ts:84` `//   console.log(Deno.env.get("QUARTO_DEBUG"));` | delete the line |
| `src/core/sass/cache.ts:4` ` * A persistent cache for sass compilation based partly on Deno.KV.` | ` * A persistent cache for sass compilation based on the deno_ral key-value store.` |
| `src/core/windows.ts:128` `// ... to avoid issue with Deno.Run()` | `// ... to avoid issues with process spawning` (keep the start of the sentence) |
| `src/execute/jupyter/jupyter-kernel.ts:272` `// This is disappointing, but something is deeply wrong with Deno.Conn:` | `// This is disappointing, but something was deeply wrong with Deno's TCP connection:` |
| `src/execute/ojs/extract-resources.ts:561` `); // Deno.readTextFileSync(thisResolvedImportPath);` | `);` (drop the trailing comment) |
| `src/project/types/book/book-render.ts:619` `//   Deno.writeTextFileSync(websiteFile.file, htmlOutput);` | delete the line |
| `src/publish/common/bundle.ts:106-108` (`// const writer = Deno.openSync(...)`, `// await copy(...)`, `// writer.close();`) | delete the three lines |
| `src/tools/tools-console.ts:165` `// We can't do this after because installTool/updateTool call Deno.exit.` | `// We can't do this after because installTool/updateTool call exit().` |
| `package/src/linux/installer.ts:186` `// Deno.removeSync(workingDir, { recursive: true });` | delete the line |

(`jupyter-kernel.ts:272`: "Deno's" has no dot after `Deno`, so the counter does not match it; the comment keeps its historical meaning.)

- [ ] **Step 3: Verify and commit**

Run the Step 1 command again → nothing. Run `cd src && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --import-map=import_map.json quarto.ts` → exit 0 (only comments changed).

```bash
git add -u src package/src
git commit -m "comments: no Deno.* mentions outside the runtime layer"
```

### Task 6: Allow-list and leftover code sites

**Files:**
- Modify: `tools/check-runtime-boundary.ts`, plus any leftover file

- [ ] **Step 1: Allow-list entries**

In `tools/check-runtime-boundary.ts`, `kSrcExclusions` becomes:

```ts
export const kSrcExclusions: readonly string[] = [
  "src/deno_ral", // the runtime layer itself
  "src/vendor", // vendored dependencies
  "src/resources/extension-subtrees", // git subtree of PumasAI/quarto-julia-engine, maintained upstream
  "src/resources/scripts", // `quarto run` fixtures under the user-script runtime (PR 35); counted in `resources`
  "src/resources/create", // .ejs.ts extension templates for users (PR 35); counted in `resources`
  "src/resources/tools/ast-diagram", // run by `deno run` from share/tools without the import map; counted in `resources`; ported by PR 35
  "src/webui/quarto-preview/build.ts", // that package's build script (`deno run --no-config`); allow-listed until PR 33 ports the build tooling
];
```

(keep the exact comment text PR 02 used for the first five entries; only the `ast-diagram` line is new and the `build.ts` reason changes from "PR 08 converts, PR 33 deletes" to the text above), and `kUserScriptResourceDirs` becomes `["src/resources/scripts/", "src/resources/create/", "src/resources/tools/ast-diagram/"]`.

If `src/command/render/latexmk/quarto-latexmk.ts` still exists (PR 39 not landed), add one more entry after `build.ts`:

```ts
  "src/command/render/latexmk/quarto-latexmk.ts", // standalone tinitex entry (deno compile); deleted by PR 39 with this line (decision 9)
```

Add a unit case to PR 02's `tests/unit/tools/check-runtime-boundary.test.ts` (the fixture-tree test) asserting that a `Deno.cwd()` in `src/resources/tools/ast-diagram/main.ts` is counted under `resources` and not under `src`.

- [ ] **Step 2: Leftover code sites**

Run the first acceptance `rg`. For every hit, run the codemod on the file first (`quarto run --dev tools/codemod-deno-ral.ts --rules fs,temp,env,process,platform --file <file>`), then hand-fix what remains with the layer function named in the vocabulary. Expected candidates: `src/core/performance/metrics.ts:63,65` (`Deno.env.get` → `env.get`, `Deno.writeTextFileSync` → `writeTextFileSync`) if PR 20b landed after PRs 10 and 14. Anything else means an owning PR is missing: stop and name it.

- [ ] **Step 3: Commit**

```bash
git add tools/check-runtime-boundary.ts tests/unit/tools/check-runtime-boundary.test.ts
git add -u src
git commit -m "runtime boundary: allow-list the standalone scripts; convert the last Deno.* sites"
```

### Task 7: Baseline at zero, hard failure, hidden-dependency inventory

**Files:**
- Modify: `tools/runtime-boundary-baseline.json`, `.github/workflows/runtime-boundary.yml` (verify only)

- [ ] **Step 1: Baseline**

Run: `quarto run --dev tools/check-runtime-boundary.ts --update-baseline`
Expected: `tools/runtime-boundary-baseline.json` contains `"src": { "denoCalls": 0, "stdImportFiles": 0 }` and `"package/src": { "denoCalls": 0, "stdImportFiles": 0 }`; `"src-js"` equals PR 20b's value (0); `"resources"` equals PR 20b's value plus `ast-diagram/main.ts` (6 `Deno.` occurrences, 1 std-import file); `"tests"` keeps the PR 23 residue. `--update-baseline` only lowers, so the `resources` increase from the move is written by hand in the same commit, with the arithmetic in the PR description (the `src` scope dropped by the same 6 and 1).

- [ ] **Step 2: Check the inventory**

Run, and paste each output in the PR description:

```bash
quarto run --dev tools/check-runtime-boundary.ts                                   # item 1
rg -n 'from "(log|dotenv)(/[^"]*)?"' src -g '*.ts' -g '!src/deno_ral/**'           # item 2: no @std/log or @std/dotenv importer outside the layer
rg -n 'FileHandler' src/deno_ral/log.ts                                              # item 2: own file handler (PR 20b)
rg -n 'readStdinLines|readStdin\b' src/command/create/cmd.ts src/command/editor-support/crossref.ts  # item 2 (PR 08)
rg -n 'execPath\(\)|QUARTO_DENO' package/src src -g '*.ts' -g '!src/deno_ral/**'   # item 3: exactly the sites listed in Context, each with its owner
```

Expected: the ratchet passes; the second command prints nothing; the others print the sites the Context table lists and no others. An unlisted Deno CLI invocation gets an owner in the PR description before merge.

- [ ] **Step 3: Prove the ratchet bites**

```bash
echo 'export const _probe = Deno.cwd();' >> src/core/path.ts
quarto run --dev tools/check-runtime-boundary.ts; echo "exit=$?"
git checkout -- src/core/path.ts
```

Expected: `::error::src: Deno.* calls rose from 0 to 1 ...` and `exit=1`.

- [ ] **Step 4: Workflow stays a hard failure; required status is an admin step**

Run: `rg -n 'continue-on-error|\|\| true' .github/workflows/runtime-boundary.yml` → nothing (PR 02 wrote the job to fail on any increase; if either appears, delete it). Add to the PR description: "Admin action after merge: add the `runtime-boundary.yml` job to the required status checks for `main`."

- [ ] **Step 5: Commit**

```bash
git add tools/runtime-boundary-baseline.json
git commit -m "runtime boundary: baseline at zero for src and package/src"
```

### Task 8: Rules and README

**Files:**
- Modify: `.claude/rules/typescript/deno-essentials.md`, `.claude/rules/typescript/deno-ral.md`, `dev-docs/runtime-migration/README.md`

- [ ] **Step 1: `deno-essentials.md`**

Replace the section "## Deno APIs vs Node.js" (PR 09 already replaced its example block; from its heading to just before "## Sync vs Async") with:

````markdown
## Runtime APIs: always through `src/deno_ral/`

Application code never calls `Deno.*` (not even in comments) and never imports
the standard library directly; a CI check (`tools/check-runtime-boundary.ts`)
fails the build otherwise. Use the runtime abstraction layer:

```typescript
// Correct
import { readTextFileSync, writeTextFileSync } from "../deno_ral/fs.ts";
import { makeTempDirSync } from "../deno_ral/temp.ts";
import { env } from "../deno_ral/env.ts";
import { cwd, exec } from "../deno_ral/process.ts";

env.get("PATH");
cwd();
readTextFileSync(path);
writeTextFileSync(path, content);
makeTempDirSync({ prefix: "quarto" });

// Wrong - runtime namespace or Node modules directly
Deno.readTextFileSync(path);
process.env.PATH;
fs.readFileSync(path);
```

Plain filesystem and environment functions keep Deno's names; runtime-shaped
APIs (processes, HTTP, TCP, file watching, key-value, errors) have Quarto's
own interface. See `.claude/rules/typescript/deno-ral.md` for the module
list and `dev-docs/runtime-migration/` for the rationale.
````

In "## Key Conventions", replace item 4 (`**Use Deno APIs** - No Node.js equivalents`) with `**Use src/deno_ral/** - never Deno.* or node: APIs directly`.

- [ ] **Step 2: `deno-ral.md`**

Delete the "## Module Loading Order" section (it documents the monkey patch). Replace the "Available Modules" table with:

```markdown
| Module | Purpose | Key exports |
|--------|---------|-------------|
| `fs.ts` | File system | `readTextFileSync`, `writeTextFileSync`, `statSync`, `removeSync`, `readDirSync` (sorted), `canonicalPathSync` (resolves symlinks), `onFileRead`, `existsSync`, `ensureDirSync`, `walk`, `expandGlob`, `safeMoveSync`, `safeRemoveSync`, `FileInfo` |
| `temp.ts` | Temp files and directories (retry on AlreadyExists) | `makeTempDirSync`, `makeTempFileSync`, `TempOptions` |
| `env.ts` | Environment variables | `env.get`, `env.set`, `env.delete`, `env.toObject` |
| `errors.ts` | Error predicates | `isNotFound`, `isAlreadyExists`, `isPermissionDenied`, `isAddrInUse`, `isConnectionError`, `errorWithPath` |
| `path.ts` | Path utilities | `join`, `dirname`, `basename`, `extname`, `fromFileUrl`, `toFileUrl` |
| `process.ts` | Processes and the current process | `spawn`, `exec`, `execSync`, `exit`, `cwd`, `chdir`, `args`, `execPath`, `killProcess`, `onSignal`, `readStdin`, `readStdinLines` |
| `net.ts` | TCP client, port probing (async) | `connectTcp`, `isPortAvailable`, `findOpenPort` |
| `http.ts` | HTTP server, WebSocket upgrade | `serveHttp`, `upgradeWebSocket` |
| `watch.ts` | File-system change events | `watchFs`, `FsEvent` |
| `kv.ts` | Persistent key-value index | `openKeyValueStore` |
| `platform.ts` | Platform and runtime facts | `isWindows`, `isMac`, `isLinux`, `os`, `arch`, `runtime`, `consoleColumns`, `inspect`, `isRootUser`, `noColor` |
| `main.ts` | Entry-module detection | `isMainModule` |
| `log.ts` | Logging | `debug`, `info`, `warning`, `error`, `BaseHandler`, `FileHandler` |
| `colors.ts`, `fmt.ts` | Terminal colours, `sprintf` | `bold`, `red`, ..., `sprintf` |
| `semver.ts`, `flags.ts`, `dotenv.ts`, `crypto.ts`, `async.ts`, `datetime.ts`, `streams.ts`, `encoding.ts`, `io.ts`, `tar.ts` | Standard-library seams | re-exports |
```

Add one paragraph: "Allow-listed standalone scripts (not converted, ratcheted under `resources` or excluded): `src/resources/tools/ast-diagram/main.ts` (PR 35), `src/webui/quarto-preview/build.ts` (PR 33), `src/resources/scripts/`, `src/resources/create/` (PR 35)."

- [ ] **Step 3: `dev-docs/runtime-migration/README.md`**

In "The sequence", set the Status of PR 25 to `merged` (and any of 08–24 still shown as `planned` to `merged`, after confirming with the PR list). Replace the "Progress metric" table with the current counts and add a line: `Phase 1 complete on <merge date>: zero in src/ and package/src; src-js/resources at their allow-lists; tests/ residue tracked in PR 23 and finished by PR 31.`

- [ ] **Step 4: Commit**

```bash
git add .claude/rules/typescript/deno-essentials.md .claude/rules/typescript/deno-ral.md dev-docs/runtime-migration/README.md
git commit -m "docs: deno_ral is the only runtime API; Phase 1 complete in the migration README"
```

## Verification

- The acceptance `rg` commands → as stated.
- `quarto run --dev tools/check-runtime-boundary.ts` → exit 0 at zero; the probe in Task 7 step 3 → exit 1.
- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/` → pass; `smoke/` → pass in CI on Linux, macOS and Windows.
- `package/src/quarto-bld prepare-dist` → succeeds; `grep -c 'Deno.realPathSync = ' package/pkg-working/bin/quarto.js` → `0`.
- `QUARTO_REPORT_PERFORMANCE_METRICS=fileReads package/dist/bin/quarto render tests/docs/test.qmd` prints a non-empty `fileReads` list (PR 20b's hook still works without the monkey patch).
- `package/dist/bin/quarto dev-call make-ast-diagram --help` still works (the allow-listed script is untouched).

## Review checklist

- [ ] Task 1 findings in the PR description; no unaccounted behaviour.
- [ ] `canonicalPathSync` is `Deno.realPathSync(path)` with no slicing; `safeRemoveDirSync` and the four former `originalRealPathSync` callers use it; nothing else switched.
- [ ] No `call` export left; no importer of it.
- [ ] The type inventory grep is empty (or only `tests/test.ts:545`).
- [ ] Every comment in the Task 5 table is rewritten or deleted; no code changed in those hunks.
- [ ] `kSrcExclusions` = PR 02's six entries + `ast-diagram` (+ `quarto-latexmk.ts` only while it exists), each with its reason; `kUserScriptResourceDirs` includes `ast-diagram`; the boundary unit test covers the move.
- [ ] Baseline zeros for `src/` and `package/src`; `src-js` and `resources` at PR 20b's values (+ `ast-diagram` in `resources`).
- [ ] The hidden-dependency inventory is in the PR description with evidence.
- [ ] Workflow fails hard; admin action requested in the PR description.
- [ ] `deno-essentials.md` no longer says "Use Deno APIs directly".

## Risks and rollback

- `@std/fs` functions now see the real `Deno.realPathSync` instead of `normalizePath`. Only `walk` with `followSymlinks: true` calls it, and no Quarto call site passes `true`; a future caller that does gets real symlink resolution, which is the correct behaviour. Windows CI is the gate for the UNC case.
- A dependency still calling `Deno.copy`/`Deno.writeAll` would fail at runtime, not at type-check; Task 1 step 4 is the guard.
- Moving `ast-diagram/main.ts` between scopes raises the `resources` baseline by hand; a reviewer must see the matching `src` drop in the same commit.
- Rollback: revert the commits; the baseline returns to its previous counts.

## Decisions needed

Only if Task 1 step 4 finds a dependency that still needs `Deno.copy`/`Deno.writeAll`: keep only those two assignments in a new `src/deno_ral/compat-shims.ts` imported from `src/quarto.ts`, file an issue to replace the dependency, and still delete `monkey-patch.ts`. Recommendation: that is the only acceptable outcome; the other three behaviours have their homes and tests.

Review items closed here: `metrics.ts` owner (PR 20b does the hook; Task 1 step 5 and Task 6 step 2 verify and finish), the standalone-script contradiction (allow-list with reasons; nothing runs the codemod on them), missing dependencies on PR 04, 07 and 20b, the `\\?\UNC` slice (none; `canonicalPathSync` is the runtime call), the ~21 comment lines (Task 5, 23 occurrences listed), the S1 hidden-dependency inventory (Context and Task 7), the symlink check that tested nothing (removed; replaced by the unit tests that compare canonical paths), PR 21 folded in (Task 2).
