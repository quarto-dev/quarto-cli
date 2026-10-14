# PR 25: Delete `core/deno/monkey-patch.ts`, set the ratchet to zero, make it a hard failure

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close Phase 1: remove the last runtime-specific scaffolding (`src/core/deno/monkey-patch.ts`, `src/deno_ral/original-real-path.ts`, the `call` alias in `src/deno_ral/process.ts`), set the runtime-boundary baseline to zero for `src/` and `package/src`, make the boundary check a required CI status, and update the contributor rules and the migration README.
**Phase:** 1. **Depends on:** PR 10–24 (every codemod and seam PR). **Unblocks:** PR 27–31 (Phase 2 reimplementations).
**Branch:** `rt/25-boundary-zero-and-monkey-patch-removal`.
**Suggested executor:** Sonnet. The work is verification plus deletions; each behaviour the monkey patch carried has a named home and a test to point at.
**Size:** S. 2 files deleted, 9 modified (`src/quarto.ts`, `src/deno_ral/fs.ts`, `src/deno_ral/process.ts`, `src/command/check/check.ts`, `src/command/render/pandoc.ts`, `src/command/create/editor.ts`, 3 test files), plus `tools/runtime-boundary-baseline.json`, the workflow, two `.claude/rules` files and `README.md`.
**Ships on:** Deno; the existing test suite must stay green.

## Spec

### Context

Assessment section 3.3, row "Monkey patches (`src/core/deno/monkey-patch.ts`)": `realPathSync` on Windows UNC paths, temp-file retry, `Deno.copy` shim for old deps; fold into the runtime layer. Section 11 module plan rows `fs.ts` ("the `realPathSync` Windows monkey patch and the read-error path annotation move here") and `temp.ts` ("carries the retry loop from `core/deno/monkey-patch.ts`"); "Order of work" step 3 ends with "fold `core/deno/monkey-patch.ts` into the layer and delete it". `README.md` progress metric: zero `Deno.*` sites in `src/` and `package/src` is the exit criterion of Phase 1.

`src/core/deno/monkey-patch.ts` (135 lines, imported at `src/quarto.ts:9` right after `src/deno_ral/original-real-path.ts` at line 8) does four things:

1. `Deno.realPathSync = normalizePath` (line 17): every caller of `Deno.realPathSync`, including `@std/fs` internals (`copy`, `walk` with `followSymlinks`, `expandGlob`), gets absolute+normalised paths without symlink resolution, and avoids a Windows UNC (`\\?\`) prefix bug fixed in Deno 1.16 (per the comment in `src/deno_ral/fs.ts:151-156`).
2. `(Deno as any).copy = copy; (Deno as any).writeAll = writeAll;` (lines 22–24) for "some of our dependencies [that] use Deno.copy and have not been ported to Deno 2".
3. `makeTempFile{,Sync}`/`makeTempDir{,Sync}` wrapped in a 5-attempt retry (lines 35–99, denoland/deno#17781).
4. `readTextFile{,Sync}` wrapped to append `\nPath: <path>` to the error message (lines 101–135).

`src/deno_ral/original-real-path.ts` saves the unpatched `Deno.realPathSync` so that `safeRemoveDirSync` (`fs.ts:160-161`), `check.ts:194`, `tests/utils.ts:315`, `tests/smoke/project/project-detect-denied-config.test.ts:26` and `tests/smoke/check/check-info-project.test.ts:27` can resolve symlinks for real.

`src/deno_ral/process.ts` still exports `call(path, opts)` (vocabulary: "thin alias of exec, removed in PR 25"); users: `src/command/render/pandoc.ts:227,1668-1669` (`ttx`), `src/command/create/editor.ts:25,107,164,233` (launching VS Code, Positron, RStudio).

Where each behaviour lives after PR 09 (`09-ral-fs-and-temp-layer.md`; each verified in Task 1):

| Behaviour | Home | Test |
|---|---|---|
| `realPathSync` with `normalizePath` semantics (absolute, normalised, upper-cased drive letter, no symlink resolution; the UNC-safe behaviour the patch gave every caller) | `src/deno_ral/fs.ts` `realPathSync` (PR 09 Interfaces line "normalizePath semantics … does NOT resolve symlinks") | `tests/unit/deno-ral/fs.test.ts` "realPathSync normalises without resolving symlinks" |
| Real symlink resolution for the five `originalRealPathSync` callers | new `canonicalPathSync` in `src/deno_ral/fs.ts` (this PR, Task 3) | `tests/unit/deno-ral/fs.test.ts` (case added in Task 3) |
| Temp creation retry ×5 on EEXIST | `src/deno_ral/temp.ts` `makeTemp*` | `tests/unit/deno-ral/temp.test.ts` |
| `Path: ...` appended to read errors | `src/deno_ral/errors.ts` `errorWithPath`, applied in `fs.ts` `readTextFile{,Sync}` | `tests/unit/deno-ral/errors.test.ts` "errorWithPath appends the path exactly once" and the `fs.test.ts` read-error case |
| `Deno.copy`/`Deno.writeAll` for dependencies | no longer needed once PR 04 (removed `cache`, `events`) and PR 07 (`puppeteer-core`) landed; verified by scanning the resolved module graph | Task 1 step 4 |

What changes for `@std/fs` internals (`walk` with `followSymlinks`, `expandGlob`, `copy`), which call `Deno.realPathSync` directly: with the patch they got `normalizePath` (no symlink resolution); after this PR they get the real one. PR 09 established that no file under `src/` calls `Deno.realPathSync` itself, so application code is unaffected.

Zero-count exclusions. PR 02's `tools/check-runtime-boundary.ts` keeps its scopes in `kScopes` (`"src": { dir: "src", exclude: ["src/deno_ral", "src/vendor"] }`, `"package/src"`, `"tests"`) and writes `tools/runtime-boundary-baseline.json` as `{ "<scope>": { "denoCalls": n, "stdImportFiles": m } }`. Three directories under `src/` cannot reach zero and are added to the `src` exclusion list here: `src/resources/extension-subtrees` (git subtree maintained upstream; 72 sites in the julia engine; PR 08 already notes it "stays in the baseline, owned by PR 36"), `src/resources/scripts` (3 sites; `quarto run` fixtures executed under the user-script runtime, PR 35) and `src/resources/create` (1 site in an `.ejs.ts` template for user extensions, PR 36). Everything else in `src/`, including `src/resources/tools/ast-diagram/main.ts` (6 sites) and `src/webui/quarto-preview/build.ts` (8 sites, converted by PR 08), must be at zero; if PR 13/PR 21 left them, this PR converts them.

PR 02's workflow is `.github/workflows/runtime-boundary.yml`, running `quarto run --dev tools/check-runtime-boundary.ts` on pull requests and pushes to `main`; the script already exits 1 on any increase. Making the status *required* is a branch-protection setting on `quarto-dev/quarto-cli` `main` (Settings → Branches → `main` → "Require status checks to pass" → add the job name from that workflow); a repository admin does it when this PR merges, and the PR description asks for it explicitly.

### Scope

In: the deletions, the `call` removal, the baseline at zero, the hard-failing workflow, rules and README updates, and converting any leftover `Deno.*` in `src/`/`package/src` that the acceptance grep reveals.
Out: `tests/` residue (documented in PR 23; PR 31 finishes it); the three excluded globs; `tools/*.ts` (PR 33/35).

### Interfaces

Removed: `call` from `src/deno_ral/process.ts`; module `src/deno_ral/original-real-path.ts`; module `src/core/deno/monkey-patch.ts`.

Added to `src/deno_ral/fs.ts`:

```ts
/** The canonical absolute path of `path`: symlinks resolved, Windows `\\?\`
 * prefix removed. Unlike `realPathSync` (which only normalises), this hits the
 * file system and throws when `path` does not exist. Deno: Deno.realPathSync;
 * PR 27: fs.realpathSync.native. */
export function canonicalPathSync(path: string | URL): string;
```

### Files

- Delete: `src/core/deno/monkey-patch.ts`, `src/deno_ral/original-real-path.ts`.
- Modify: `src/quarto.ts:7-9`; `src/deno_ral/fs.ts:11,145-165` (+ `canonicalPathSync`); `tests/unit/deno-ral/fs.test.ts` (one case); `src/deno_ral/process.ts` (remove `call`); `src/command/render/pandoc.ts:227,1668-1669`; `src/command/create/editor.ts:25,107,164,233`; `src/command/check/check.ts:33,194`; `tests/utils.ts:14,315`; `tests/smoke/project/project-detect-denied-config.test.ts:13,26`; `tests/smoke/check/check-info-project.test.ts:13,27`; `tools/check-runtime-boundary.ts:301-304` (`kScopes` exclusions); `tools/runtime-boundary-baseline.json`; `.claude/rules/typescript/deno-essentials.md`; `.claude/rules/typescript/deno-ral.md`; `dev-docs/runtime-migration/README.md`.

### Acceptance criteria

- `grep -rnE '\bDeno\.' src package/src --include=*.ts | grep -v '^src/deno_ral/' | grep -v '^src/resources/extension-subtrees/' | grep -v '^src/resources/scripts/' | grep -v '\.ejs\.ts:'` prints nothing.
- `grep -rnE 'from "(fs|path|io|log|fmt|encoding|async|streams|crypto|tar|uuid|datetime|dotenv|flags|bytes|semver|testing|http)(/[^"]*)?"' src package/src --include=*.ts | grep -v '^src/deno_ral/' | grep -v extension-subtrees` prints nothing.
- `ls src/core/deno/monkey-patch.ts src/deno_ral/original-real-path.ts` → both "No such file".
- `grep -rn 'originalRealPathSync\|monkey-patch\|\bcall(' src tests package/src --include=*.ts | grep -v 'process.ts'` prints nothing (the `\bcall(` grep may match unrelated identifiers; review hits by eye).
- `quarto run --dev tools/check-runtime-boundary.ts` exits 0 with `src/` and `package/src` at `0` for both counters, and exits non-zero when a `Deno.cwd()` is temporarily added to `src/core/path.ts` (Task 4 step 3).
- Full suite green: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/` locally; `smoke/` in CI.
- Windows CI green (the UNC path behaviour is only observable there).

## Plan

### Task 1: Verify each monkey-patch behaviour has a home

**Files:** none modified (findings go in the PR description)

- [ ] **Step 1: `realPathSync`**

Run: `grep -n 'export function realPathSync' -A 15 src/deno_ral/fs.ts`
Expected: the PR 09 function with `normalizePath` semantics (absolute against `cwd()`, `normalize`, upper-cased drive letter; no `Deno.realPathSync` call). Run: `grep -n 'realPathSync normalises without resolving symlinks' tests/unit/deno-ral/fs.test.ts` → one hit. This is the behaviour the monkey patch gave every caller of `Deno.realPathSync`; the five callers that explicitly wanted symlink resolution get `canonicalPathSync` in Task 3.

- [ ] **Step 2: Temp retries**

Run: `grep -n 'attempt\|EEXIST\|isAlreadyExists' src/deno_ral/temp.ts` → the retry loop; `grep -n 'retries\|AlreadyExists' tests/unit/deno-ral/temp.test.ts` → a test.

- [ ] **Step 3: Read-error path annotation**

Run: `grep -n 'errorWithPath' src/deno_ral/fs.ts src/deno_ral/errors.ts` → defined in `errors.ts`, used in `fs.ts` `readTextFile` and `readTextFileSync`; `grep -n 'Path:' tests/unit/deno-ral/fs.test.ts` → a test asserting the message suffix.

- [ ] **Step 4: `Deno.copy` / `Deno.writeAll` consumers**

Run (Deno tooling is acceptable for verification during Phase 1):

```bash
cd src && ../package/dist/bin/tools/x86_64/deno info --json --unstable-kv --import-map=import_map.json quarto.ts \
  | python3 -c "import json,sys; [print(m['local']) for m in json.load(sys.stdin)['modules'] if m.get('local')]" \
  | xargs grep -ln 'Deno\.copy\b\|Deno\.writeAll\b' 2>/dev/null; cd ..
```

Expected: only `src/core/deno/monkey-patch.ts` itself. Any other hit is a dependency still using the removed APIs; name it in the PR and stop (see Decisions). On 2026-10-14 the likely candidates were the `deno.land/x/puppeteer@9.0.2` port (replaced by PR 07) and `deno.land/x/cache@0.2.12` (removed by PR 04).

- [ ] **Step 5: Record**

Paste the four results in the PR description under "Monkey-patch behaviours accounted for".

### Task 2: Remove the `call` alias

**Files:**
- Modify: `src/deno_ral/process.ts`, `src/command/render/pandoc.ts:227,1668-1669`, `src/command/create/editor.ts:25,107,164,233`

- [ ] **Step 1: Callers**

`pandoc.ts:227`: `import { call } from "../../deno_ral/process.ts";` → `import { exec } from "../../deno_ral/process.ts";` (merge if `exec` is already imported). Lines 1668–1669 (`await call("ttx", { args: [...] })` twice) → `await exec("ttx", { args: [...] })` (same object literals).

`editor.ts:25`: same import change. Lines 107, 164: `await exec(path, { args: [artifactPath], cwd });`. Line 233: `await exec(callPath, { args, cwd });`.

- [ ] **Step 2: Remove `call` from `src/deno_ral/process.ts`**

Delete the `export const call = ...` function and its comment. The file keeps `spawn`, `exec`, `execSync`, `exit`, `cwd`, `chdir`, `args`, `execPath`, `pid`, `kill`, `onSignal`, `writeStdoutSync`, `writeStderrSync`, `isTerminal` and the types.

- [ ] **Step 3: Type-check and test**

Run: `cd src && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --import-map=import_map.json quarto.ts` → exit 0.
Run: `grep -rn 'deno_ral/process.ts' src --include=*.ts | xargs grep -ln '\bcall\b' | head` → none importing `call`.
Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/create/create.test.ts smoke/render/render-pdf.test.ts` → pass (`render-pdf` with a font-cache path hits `ttx` only on some documents; the type-check is the real gate).

- [ ] **Step 4: Commit**

```bash
git add src/deno_ral/process.ts src/command/render/pandoc.ts src/command/create/editor.ts
git commit -m "deno_ral/process: remove the call alias; callers use exec"
```

### Task 3: `canonicalPathSync`, then delete the monkey patch and `original-real-path.ts`

**Files:**
- Delete: `src/core/deno/monkey-patch.ts`, `src/deno_ral/original-real-path.ts`
- Modify: `src/deno_ral/fs.ts` (new function), `tests/unit/deno-ral/fs.test.ts` (new case), `src/quarto.ts:7-9`, `src/deno_ral/fs.ts:11,145-165`, `src/command/check/check.ts:33,194`, `tests/utils.ts:14,315`, `tests/smoke/project/project-detect-denied-config.test.ts:13,26`, `tests/smoke/check/check-info-project.test.ts:13,27`

- [ ] **Step 0a: Write the failing test** (append to `tests/unit/deno-ral/fs.test.ts`, next to the `realPathSync` case, using that file's existing `withDir` helper and imports)

```ts
unitTest("fs - canonicalPathSync resolves symlinks and matches realPathSync on plain paths", withDir((dir) => {
  const real = join(dir, "real");
  mkdirSync(real);
  assertEquals(canonicalPathSync(real), realPathSync(real));
  if (!isWindows) {
    const link = join(dir, "link");
    symlinkSync(real, link);
    assertEquals(canonicalPathSync(link), canonicalPathSync(real), "symlinks are resolved");
  }
  assertThrows(() => canonicalPathSync(join(dir, "missing")));
}));
```

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/deno-ral/fs.test.ts`
Expected: type-check error `has no exported member 'canonicalPathSync'`.

- [ ] **Step 0b: Implement** (append to `src/deno_ral/fs.ts`)

```ts
/**
 * The canonical absolute path: symlinks resolved, Windows `\\?\` prefix
 * removed. Unlike `realPathSync`, which only normalises, this hits the file
 * system and throws when the path does not exist.
 */
export function canonicalPathSync(path: string | URL): string {
  const resolved = Deno.realPathSync(path);
  return resolved.startsWith("\\\\?\\") ? resolved.slice(4) : resolved;
}
```

Run the test again → `ok | N passed | 0 failed` (N is the file's previous count plus one).

- [ ] **Step 1: `src/quarto.ts:7-9`**

Delete the three lines:

```ts
// Must be FIRST to save original Deno.realPathSync before monkey-patching
import "./deno_ral/original-real-path.ts";
import "./core/deno/monkey-patch.ts";
```

- [ ] **Step 2: `src/deno_ral/fs.ts`**

Delete line 11 (`import { originalRealPathSync } from "./original-real-path.ts";`). In `safeRemoveDirSync` replace the comment block at lines 145–156 and the two calls at 160–161:

```ts
  // Resolve symlinks so both sides compare the same physical path. External
  // tools (knitr, for example) may resolve symlinks while project.dir
  // preserves them.
  let resolvedPath = path;
  let resolvedBoundary = boundary;
  try {
    resolvedPath = canonicalPathSync(path);
    resolvedBoundary = canonicalPathSync(boundary);
  } catch {
    // If resolution fails (e.g., path doesn't exist), use original paths
  }
```

- [ ] **Step 3: The four `originalRealPathSync` callers**

`src/command/check/check.ts:33`: `import { canonicalPathSync } from "../../deno_ral/fs.ts";` (merge with the existing `fs.ts` import); line 194: `return canonicalPathSync(home);`.

`tests/utils.ts:14`: replace the import with `canonicalPathSync` from `../src/deno_ral/fs.ts` (merge); line 315: `const dir = canonicalPathSync(makeTempDirSync({ prefix }));`.

`tests/smoke/project/project-detect-denied-config.test.ts:13,26` and `tests/smoke/check/check-info-project.test.ts:13,27`: same substitution with `../../../src/deno_ral/fs.ts`.

- [ ] **Step 4: Delete the files**

```bash
git rm src/core/deno/monkey-patch.ts src/deno_ral/original-real-path.ts
```

- [ ] **Step 5: Type-check and run the sensitive tests**

Run: `cd src && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --import-map=import_map.json quarto.ts` → exit 0.
Run: `grep -rn 'originalRealPathSync\|original-real-path\|monkey-patch' src tests package/src .claude dev-docs --include=* -I | grep -v runtime-migration` → nothing (fix `.claude/rules/typescript/deno-ral.md` in Task 5 if it is the only hit).
Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/deno-ral/ unit/path.test.ts unit/project/ smoke/project/project-detect-denied-config.test.ts smoke/check/check-info-project.test.ts smoke/project/project-prepost.test.ts smoke/render/render-html.test.ts` → pass.

Symlink behaviour check (the one thing the patch changed for `@std/fs`): `tmp=$(mktemp -d) && mkdir -p $tmp/real && ln -s $tmp/real $tmp/link && echo '# hi' > $tmp/link/index.qmd && package/dist/bin/quarto render $tmp/link/index.qmd && ls $tmp/real/index.html` → the output lands next to the input through the symlink, as before.

- [ ] **Step 6: Commit**

```bash
git add -A src/quarto.ts src/deno_ral src/core/deno src/command/check/check.ts tests/utils.ts tests/unit/deno-ral/fs.test.ts tests/smoke/project/project-detect-denied-config.test.ts tests/smoke/check/check-info-project.test.ts
git commit -m "remove core/deno/monkey-patch.ts and original-real-path.ts; canonicalPathSync in the layer"
```

### Task 4: Baseline at zero and a hard-failing check

**Files:**
- Modify: `tools/runtime-boundary-baseline.json`, `.github/workflows/runtime-boundary.yml`, possibly `tools/check-runtime-boundary.ts` (exclusions)

- [ ] **Step 1: Find leftovers**

Run the first acceptance grep. Expected: nothing. If `src/resources/tools/ast-diagram/main.ts` or `src/webui/quarto-preview/build.ts` still show sites, run `quarto run --dev tools/codemod-deno-ral.ts --rules fs,temp,env,process,platform --dir src/resources/tools` and `--dir src/webui` and hand-fix the rest (`import.meta.main` → `isMainModule(import.meta)` from `src/deno_ral/main.ts`; `Deno.Command` → `exec`). Commit them as `"src: convert the last Deno.* sites outside the layer"`.

- [ ] **Step 2: Exclusions and baseline**

In `tools/check-runtime-boundary.ts`, the `kScopes` constant (PR 02 placed it around lines 301–304) becomes:

```ts
const kScopes: Record<string, { dir: string; exclude: string[] }> = {
  "src": {
    dir: "src",
    exclude: [
      "src/deno_ral",
      "src/vendor",
      // git subtree of PumasAI/quarto-julia-engine, maintained upstream (PR 36)
      "src/resources/extension-subtrees",
      // `quarto run` fixtures executed under the user-script runtime (PR 35)
      "src/resources/scripts",
      // templates for user extensions, not Quarto code (PR 36)
      "src/resources/create",
    ],
  },
  "package/src": { dir: "package/src", exclude: [] },
  "tests": { dir: "tests", exclude: [] },
};
```

(`isExcluded` matches a directory prefix, so the three entries cover every file beneath them.) Update the unit test in `tests/unit/tools/check-runtime-boundary.test.ts` (PR 02) if it asserts the exclusion list.

Run: `quarto run --dev tools/check-runtime-boundary.ts --update-baseline`
Expected: `tools/runtime-boundary-baseline.json` now contains `"src": { "denoCalls": 0, "stdImportFiles": 0 }` and `"package/src": { "denoCalls": 0, "stdImportFiles": 0 }`; `"tests"` keeps the PR 23 residue. Open the JSON and confirm the zeros by eye.

- [ ] **Step 3: Prove the ratchet bites**

```bash
echo 'export const _probe = Deno.cwd();' >> src/core/path.ts
quarto run --dev tools/check-runtime-boundary.ts; echo "exit=$?"
git checkout -- src/core/path.ts
```

Expected: a line naming `src/core/path.ts` and `exit=1`.

- [ ] **Step 4: Workflow stays a hard failure; required status is an admin step**

Run: `grep -n 'continue-on-error\||| true' .github/workflows/runtime-boundary.yml` → nothing (PR 02 wrote the job to fail on any increase; if either appears, delete it). Add to the PR description: "Admin action after merge: add the `runtime-boundary.yml` job to the required status checks for `main`."

- [ ] **Step 5: Commit**

```bash
git add tools/runtime-boundary-baseline.json tools/check-runtime-boundary.ts tests/unit/tools
git commit -m "runtime boundary: baseline at zero for src and package/src; exclusions for subtree and user-script fixtures"
```

### Task 5: Rules and README

**Files:**
- Modify: `.claude/rules/typescript/deno-essentials.md`, `.claude/rules/typescript/deno-ral.md`, `dev-docs/runtime-migration/README.md`

- [ ] **Step 1: `deno-essentials.md`**

Replace the section "## Deno APIs vs Node.js" (from its heading to just before "## Sync vs Async") with:

```markdown
## Runtime APIs: always through `src/deno_ral/`

Application code never calls `Deno.*` and never imports the standard library
directly; a CI check (`tools/check-runtime-boundary.ts`) fails the build
otherwise. Use the runtime abstraction layer:

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
```

In "## Key Conventions", replace item 4 (`**Use Deno APIs** - No Node.js equivalents`) with `**Use src/deno_ral/** - never Deno.* or node: APIs directly`.

- [ ] **Step 2: `deno-ral.md`**

Delete the "## Module Loading Order" section (it documents the monkey patch). Replace the "Available Modules" table with the full list:

```markdown
| Module | Purpose | Key exports |
|--------|---------|-------------|
| `fs.ts` | File system | `readTextFileSync`, `writeTextFileSync`, `statSync`, `removeSync`, `realPathSync` (normalises only), `canonicalPathSync` (resolves symlinks), `existsSync`, `ensureDirSync`, `walk`, `expandGlob`, `safeMoveSync`, `safeRemoveSync`, `FileInfo` |
| `temp.ts` | Temp files and directories (with retry) | `makeTempDirSync`, `makeTempFileSync`, `TempOptions` |
| `env.ts` | Environment variables | `env.get`, `env.set`, `env.delete`, `env.toObject` |
| `errors.ts` | Error predicates | `isNotFound`, `isAlreadyExists`, `isPermissionDenied`, `isAddrInUse`, `errorWithPath` |
| `path.ts` | Path utilities | `join`, `dirname`, `basename`, `extname`, `fromFileUrl`, `toFileUrl` |
| `process.ts` | Processes and the current process | `spawn`, `exec`, `execSync`, `exit`, `cwd`, `chdir`, `args`, `execPath`, `kill`, `onSignal` |
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

- [ ] **Step 3: `dev-docs/runtime-migration/README.md`**

In "The sequence", set the Status of PR 25 to `merged` (and any of 10–24 still shown as `planned` to `merged`, after confirming with `git log --oneline main | grep -c 'rt/'` or the PR list). Replace the "Progress metric" table with the current counts and add a line: `Phase 1 complete on <date>: zero in src/ and package/src; tests/ residue tracked in PR 23 and finished by PR 31.`

- [ ] **Step 4: Commit**

```bash
git add .claude/rules/typescript/deno-essentials.md .claude/rules/typescript/deno-ral.md dev-docs/runtime-migration/README.md
git commit -m "docs: deno_ral is the only runtime API; Phase 1 complete in the migration README"
```

## Verification

- The two acceptance greps → empty.
- `quarto run --dev tools/check-runtime-boundary.ts` → exit 0 at zero; the probe in Task 4 step 3 → exit 1.
- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/` → pass; `smoke/` → pass in CI on Linux, macOS and Windows.
- `package/src/quarto-bld prepare-dist` → succeeds (the bundle no longer contains the monkey patch; `grep -c 'Deno.realPathSync = ' package/pkg-working/bin/quarto.js` → `0`).
- Symlinked-input render check (Task 3 step 5).

## Review checklist

- [ ] Task 1 findings in the PR description; no unaccounted behaviour.
- [ ] `safeRemoveDirSync` and the four former `originalRealPathSync` callers use `canonicalPathSync` (real symlink resolution); nothing else switched from `realPathSync`.
- [ ] No `call` export left; no importer of it.
- [ ] Baseline zeros for `src/` and `package/src`; `kScopes` exclusions limited to the three directories listed, with the reasons as comments.
- [ ] Workflow fails hard; admin action requested in the PR description.
- [ ] `deno-essentials.md` no longer says "Use Deno APIs directly".

## Risks and rollback

- `@std/fs` functions now see the real `Deno.realPathSync` (symlink-resolving) instead of `normalizePath`. The known UNC bug is fixed since Deno 1.16; `copySync` with symlinked sources now compares physical paths (correct). Windows CI is the gate; if a path-comparison regression appears, the fix belongs in the caller, not in a restored patch.
- A dependency still calling `Deno.copy`/`Deno.writeAll` would fail at runtime, not at type-check; Task 1 step 4 is the guard.
- Rollback: revert the four commits; the baseline returns to its previous counts.

## Decisions needed

Only if Task 1 step 4 finds a dependency that still needs `Deno.copy`/`Deno.writeAll`: keep only those two assignments in a new `src/deno_ral/compat-shims.ts` imported from `src/quarto.ts`, file an issue to replace the dependency, and still delete `monkey-patch.ts`. Recommendation: that is the only acceptable outcome; the other three behaviours have their homes and tests.
