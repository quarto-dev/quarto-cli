# PR 10: Run the fs/temp codemod on `src/core`, `src/quarto-core`, `src/config`

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move every plain filesystem and temp-file call in `src/core`, `src/quarto-core` and `src/config` from `Deno.*` to `src/deno_ral/fs.ts` / `src/deno_ral/temp.ts` with the codemod, fix the two reported collisions by hand, and replace the 13 `instanceof Deno.errors.X` checks in `src/core` with the `deno_ral/errors.ts` predicates.
**Phase:** 1.
**Depends on:** PR 09 (layer + codemod), PR 02 (ratchet); lands after PR 08 and PR 22 (landing order below).
**Unblocks:** PR 14 (the env codemod runs after the fs codemods), PR 25.
**Branch:** `rt/10-codemod-fs-core`.
**Suggested executor:** Sonnet.
The codemod does the bulk; the hand edits are five small, fully specified changes.
**Size:** L by file count, mechanical: 56 files rewritten by the codemod (153 replacements, measured by a dry run of PR 09's codemod logic on `b86f98d`), 9 files edited by hand (3 collision sites, 13 `Deno.errors` sites, 1 `Deno.ReadFileOptions`).
**Ships on:** Deno; the existing test suite must stay green.

## Spec

### Context

Assessment section 11, order of work step 3: "A `ts-morph` script run with `quarto run --dev` rewrites `Deno.<fsCall>(` to the layer function and adds the import; review by directory (`core`, …)".
PR 09 shipped `tools/codemod-deno-ral.ts` (rules `fs`, `temp`, `env`, `process`, `platform`), the extended `src/deno_ral/fs.ts`, `src/deno_ral/temp.ts` and `src/deno_ral/errors.ts`.
This PR is the first of four that run it (10: core; 11: command; 12: project/format; 13: the rest).

Measured on `main` at `b86f98d` (2026-10-15) with `grep -rhoE '\bDeno\.[A-Za-z_]+(\.[A-Za-z_]+)?' <dir> --include=*.ts | sort | uniq -c | sort -rn` (comments included; the ratchet counts the same way):

`src/core` (330 sites in 79 files):

| API | Sites | Handled by |
|---|---|---|
| `Deno.env.get` / `.set` | 79 / 1 | PR 14 |
| `Deno.readTextFileSync` | 53 | this PR (fs) |
| `Deno.writeTextFileSync` | 33 | this PR (fs) |
| `Deno.statSync` | 19 | this PR (fs) |
| `Deno.MakeTempOptions` | 11 | this PR (temp → `TempOptions`); 4 of them are in `monkey-patch.ts` and stay |
| `Deno.cwd` | 9 | PR 08 |
| `Deno.readFileSync`, `Deno.makeTempFileSync`, `Deno.makeTempDirSync` | 7 each | this PR (monkey-patch.ts sites stay) |
| `Deno.errors.NotFound` | 7 | this PR (`isNotFound`) |
| `Deno.writeFileSync` | 6 | this PR |
| `Deno.Command` | 5 | PR 08 (one is a comment in `typst.ts` that PR 08 deletes) |
| `Deno.readTextFile`, `Deno.readDirSync`, `Deno.makeTempFile`, `Deno.lstatSync`, `Deno.Kv` | 4 each | this PR except `Deno.Kv` (PR 18) |
| `Deno.utimeSync`, `Deno.open`, `Deno.makeTempDir`, `Deno.CommandStatus` | 3 each | this PR except `CommandStatus` (PR 08) |
| `Deno.writeTextFile`, `Deno.symlinkSync`, `Deno.stderr.writeSync`, `Deno.serve`, `Deno.openKv`, `Deno.noColor`, `Deno.copyFileSync`, `Deno.addSignalListener`, `Deno.ReadFileOptions`, `Deno.FsEvent`, `Deno.FileInfo`, `Deno.ChildProcess` | 2 each | this PR: `writeTextFile`, `symlinkSync`, `copyFileSync`, `FileInfo`, `ReadFileOptions` (by hand); others: PR 08 (stderr, signals, ChildProcess), PR 16 (serve), PR 17 (FsEvent), PR 18 (openKv), PR 19 (noColor) |
| `Deno.errors.{BrokenPipe,NotConnected,ConnectionAborted,ConnectionReset,ConnectionRefused,AddrInUse}` | 1 each | this PR (`isConnectionError`, `isAddrInUse`) |
| `Deno.removeSync`, `Deno.realPathSync`, `Deno.readLinkSync`, `Deno.readFile`, `Deno.openSync`, `Deno.mkdirSync` | 1 each | this PR (`realPathSync` is the monkey-patch assignment and stays) |
| `Deno.watchFs`, `Deno.upgradeWebSocket`, `Deno.listen`, `Deno.dlopen`, `Deno.consoleSize`, `Deno.build.os`, `Deno.build.arch`, `Deno.execPath`, `Deno.exit`, `Deno.args`, `Deno.stdout.writeSync`, `Deno.stdout`, `Deno.stderr.isTerminal`, `Deno.copy`, `Deno.run`, `Deno.Run`, `Deno.KV`, `Deno.CommandOptions` | 1 each | PRs 08, 15, 16, 17, 19, 20, 25 |

`src/quarto-core` (8 sites, 3 files): `Deno.env.get` 2, `Deno.env.set` 2, `Deno.env.delete` 1 (PR 14); `Deno.writeTextFileSync` 1 (`dotenv.ts:80`), `Deno.statSync` 1, `Deno.readTextFileSync` 1 (this PR).

`src/config` (1 site, 1 file): `Deno.env.get` in `constants.ts` (PR 14).
Nothing for this PR; the directory is included so the dry run proves it.

Files in scope that need attention beyond the codemod (all verified):

| File | Why |
|---|---|
| `src/core/deno/monkey-patch.ts` | assigns to `Deno.realPathSync`, `Deno.makeTemp*`, `Deno.readTextFile*` → the codemod skips it ("assigns to Deno.realPathSync at line 17"). Untouched until PR 25 deletes it. |
| `src/core/performance/metrics.ts` | assigns to `Deno.readTextFileSync` (line 23) → skipped, together with its `Deno.writeTextFileSync` at line 65. PR 20b replaces the assignment with the layer's `onFileRead` hook; if PR 20b has landed first, the file is no longer skipped and the codemod rewrites line 65 here (the dry run then shows 1 skipped file and 154 replacements). Otherwise PR 25 converts the leftover. |
| `src/core/copy.ts` | local `function copyFileSync(src, dest, options)` declared at line 138 (first referenced at line 60, which is the line the tool reports) and a call to `Deno.copyFileSync(src, dest)` at line 152 → collision reported; fix by alias import. Also `Deno.FileInfo` at lines 231-232 (rewritten by the codemod), `getFileInfoType(Deno.lstatSync(src))` at 203 (type-checks because PR 09 retyped `getFileInfoType` to the layer's `FileInfo`) and `Deno.errors.NotFound` at 236. The comment lines 28 and 145 mention `Deno.copyFileSync`/`Deno.writeFileSync`; comments are PR 25's. |
| `src/core/qualified-path.ts` | exports its own `readTextFile(t, options?: Deno.ReadFileOptions)` and `readTextFileSync(t)` (lines 69-77) wrapping `Deno.readTextFile*` → two collisions; fix by alias import and drop the unused `options` parameter. |
| `src/core/http.ts` | `Deno.errors.NotFound` at 64 and the six-way `instanceof` chain at 230-235. |
| `src/core/port.ts:131`, `src/core/cache/cache.ts:161`, `src/core/path.ts:189`, `src/core/jupyter/jupyter-shared.ts:107`, `src/core/typst.ts:82` | `Deno.errors.*` → predicates. |
| `src/core/file.ts:22,53`, `src/core/download.ts:34`, `src/core/console.ts:174` (if PR 08 has not landed yet) | `Deno.open`/`Deno.openSync` → `open`/`openSync` by the codemod; the handles are used as `readable`, `writeSync`, `close`, and as a `Writer` for `writeAll` (`download.ts:48`), all on the `FsFile` interface. Review only. |
| `src/core/path.ts:53`, `src/core/copy.ts:179`, `src/core/resources.ts:179`, `src/core/jupyter/jupyter-shared.ts:86` | `Deno.readDirSync` loops; none depends on order; the layer now returns a sorted array. Review only. |
| `src/core/temp.ts`, `src/core/temp-types.ts` | `Deno.MakeTempOptions` → `TempOptions` (codemod `temp` rule). `TempContext` is part of the `quarto` API (`src/core/api/types.ts:27`); `TempOptions` has the same three fields the API documents. |
| `src/core/lib/errors.ts:33`, `src/core/lib/external/colors.ts:33-34` | `Deno.build.os`, `Deno.noColor`: not fs; `src/core/lib` is shared with browser bundles and must not import `deno_ral` (comment at `lib/errors.ts:27-29`). The codemod skips `src/core/lib` (PR 09 `kCodemodExclusions`), so the dry run never lists these files. Untouched (PR 19). |

### Scope

In: the codemod with `--rules fs,temp` on `src/core`, `src/quarto-core`, `src/config`; the collision fixes; the 13 `Deno.errors` sites in `src/core`; `deno fmt` on the changed files; baseline update.
Out: comment lines that mention `Deno.*` (`src/core/copy.ts:28,145` and the others PR 25 lists; the AST codemod never touches comments and PR 25 owns all of them), `Deno.env` (PR 14), process APIs (PR 08), `Deno.Kv`/`openKv` (PR 18), `Deno.serve`/`listen`/`upgradeWebSocket` (PR 15/16), `Deno.watchFs`/`FsEvent` (PR 17), `Deno.dlopen` (PR 20), `Deno.build`/`noColor`/`consoleSize` (PR 19), `monkey-patch.ts` and `metrics.ts` (PR 25), anything outside the three directories.

### Landing order and conflict protocol

Phase 1 lands in the order 08 → 22 → 10–13 → 14 (README, review finding S10).
PRs 10–13 cover disjoint directories, but PR 08, PR 22 and PR 14 edit the import blocks of many of the same files (34–38 files overlap), and the codemod inserts its import after the last import, the same anchor every one of them uses.
Conflicts in this PR are therefore expected and are resolved mechanically, never by hand-merging a codemodded hunk:

1. `git rebase origin/main`; for every conflicted file under this PR's directories, `git checkout origin/main -- <file>` (reset the file to `main`).
2. Re-run the codemod on exactly those files: `quarto run --dev tools/codemod-deno-ral.ts --rules <this PR's rules> --file <file> [--file <file>...]`.
3. Re-apply this PR's hand edits for those files (each is listed with its exact code below), then `package/dist/bin/tools/x86_64/deno fmt <file>...`.
4. `git add` the files and `git rebase --continue`; run the type check and the dry run of Task 1 again (it must report `0 replacements` for the PR's directories once the hand edits are back).

This works because PR 09's collision detection is symbol-based and reuses existing alias imports: a re-run over a partly migrated file finishes it and does not report the layer's own imports as collisions.

### Interfaces

No new interfaces.
Alias imports used by the hand fixes (convention from PR 08: never rename the local binding):

```ts
// src/core/copy.ts
import { copyFileSync as fsCopyFileSync, ... } from "../deno_ral/fs.ts";
// src/core/qualified-path.ts
import { readTextFile as fsReadTextFile, readTextFileSync as fsReadTextFileSync } from "../deno_ral/fs.ts";
```

### Files

- Modify (codemod): every `*.ts` under `src/core` and `src/quarto-core` that uses an fs/temp API, except `src/core/deno/monkey-patch.ts` and `src/core/performance/metrics.ts` (skipped by the tool)
- Modify (hand): `src/core/copy.ts:18-30,152,236`, `src/core/qualified-path.ts:69-77`, `src/core/http.ts:64,228-240`, `src/core/port.ts:131`, `src/core/cache/cache.ts:161`, `src/core/path.ts:189`, `src/core/jupyter/jupyter-shared.ts:107`, `src/core/typst.ts:82`
- Modify: `tools/runtime-boundary-baseline.json`

### Acceptance criteria

- AST check (comments never count): `quarto run --dev tools/codemod-deno-ral.ts --rules fs,temp --dir src/core --dir src/quarto-core --dir src/config --dry-run | tail -1` → `Summary: 205 files scanned, 0 would be rewritten, 0 replacements, 0 with collisions, 2 skipped` (1 skipped if PR 20b landed first).
- Text check, comment lines excluded:

  ```bash
  rg -n '\bDeno\.(readTextFileSync|readTextFile|readFileSync|readFile|writeTextFileSync|writeTextFile|writeFileSync|writeFile|statSync|stat|lstatSync|lstat|mkdirSync|mkdir|removeSync|remove|renameSync|rename|copyFileSync|copyFile|readDirSync|readDir|symlinkSync|symlink|readLinkSync|realPath|realPathSync|chmodSync|chmod|utimeSync|truncateSync|open|openSync|create|makeTempDirSync|makeTempDir|makeTempFileSync|makeTempFile|FileInfo|DirEntry|MakeTempOptions|ReadFileOptions|errors)\b' src/core src/quarto-core src/config -g '*.ts' \
    -g '!src/core/deno/monkey-patch.ts' -g '!src/core/performance/metrics.ts' \
    | rg -v '^[^:]+:[0-9]+:\s*(//|/\*|\*)'
  ```
  prints nothing.
- `quarto run --dev tools/check-runtime-boundary.ts` passes, with the `src` scope count exactly 170 lower than before (153 codemod replacements + 3 collision sites + 13 `Deno.errors` + 1 `Deno.ReadFileOptions`; 171 if PR 20b landed first and the codemod also rewrote `metrics.ts:65`).
- `cd src && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --unstable-ffi --import-map=import_map.json quarto.ts` passes.
- The tests in Verification pass.

## Plan

Assumes PR 09 landed (`tools/codemod-deno-ral.ts`, `src/deno_ral/{fs,temp,errors}.ts`, `getFileInfoType` retyped) and PR 02's ratchet exists.
In the prescribed order PR 08 has landed (so `src/core/console.ts` no longer opens files); if it has not, `src/core/console.ts:174` still has `Deno.openSync`, which the codemod rewrites to `openSync`, and both orders end in the same place.

### Task 1: Dry run and review

README ground rule 7 applies: this PR is generated from fresh `main` the day it is opened and merged the same day; the reviewer named in README "Roles" is booked for that day.
PRs 10–13 are independent (disjoint directories) but every one of them edits `tools/runtime-boundary-baseline.json` with an exact delta: open them one at a time, or rebase and regenerate the baseline (ground rule 8) before each merge; the expected delta of this plan is then read against the new `main`.


- [ ] **Step 1: Dry run**

Run: `quarto run --dev tools/codemod-deno-ral.ts --rules fs,temp --dir src/core --dir src/quarto-core --dir src/config --dry-run > /tmp/codemod-core.txt; tail -3 /tmp/codemod-core.txt` Expected: the last line is `Summary: 205 files scanned, 56 would be rewritten, 153 replacements, 2 with collisions, 2 skipped` (measured on `b86f98d`; a few more replacements are possible if `main` gained `Deno.*` sites since, and `1 skipped` with 154 replacements if PR 20b landed first); `git status --short src` is empty.

- [ ] **Step 2: Review the report**

Run: `grep -E 'skipped|collision' /tmp/codemod-core.txt` Expected exactly:
```
src/core/deno/monkey-patch.ts: skipped: assigns to Deno.realPathSync at line 17
src/core/performance/metrics.ts: skipped: assigns to Deno.readTextFileSync at line 23
src/core/copy.ts:60: collision: local binding 'copyFileSync' conflicts with deno_ral/fs.ts; left as Deno.*
src/core/qualified-path.ts:69: collision: local binding 'readTextFile' conflicts with deno_ral/fs.ts; left as Deno.*
src/core/qualified-path.ts:73: collision: local binding 'readTextFileSync' conflicts with deno_ral/fs.ts; left as Deno.*
```
If any other line appears, stop and read that file before continuing: an unexpected collision means a local name shadows a layer function and needs an alias import like the ones in Task 3.

Run: `grep -c '→' /tmp/codemod-core.txt` and skim `grep '→' /tmp/codemod-core.txt | awk -F'→' '{print $2}' | sort | uniq -c | sort -rn` to confirm the replacement targets are only names from the `fs`/`temp` rule tables.

### Task 2: Apply the codemod

- [ ] **Step 1: Rewrite**

Run: `quarto run --dev tools/codemod-deno-ral.ts --rules fs,temp --dir src/core --dir src/quarto-core --dir src/config | tail -1` Expected: `Summary: 205 files scanned, 56 rewritten, 153 replacements, 2 with collisions, 2 skipped` (the same numbers as the dry run).

- [ ] **Step 2: Format and type-check**

Run: `git diff --name-only | xargs package/dist/bin/tools/x86_64/deno fmt` Expected: files reformatted (long import lines wrapped); `git diff --stat | tail -1` shows only files under the three directories.

Run: `cd src && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --unstable-ffi --import-map=import_map.json quarto.ts` Expected: no errors.
(`FileInfo`'s eight fields cover what `src/core` reads: `isDirectory`, `isFile`, `isSymlink`, `size`, `atime`, `mtime`, `mode`; `getFileInfoType` takes the layer's `FileInfo` since PR 09.
A check error about a missing `FileInfo` member means a caller reads a field the layer does not expose: stop and raise it on PR 09's vocabulary rather than casting.)

- [ ] **Step 3: Commit**

```bash
git add src/core src/quarto-core src/config
git commit -m "core: codemod Deno fs/temp calls to deno_ral (mechanical)"
```

### Task 3: Fix the two collisions by hand

**Files:**
- Modify: `src/core/copy.ts`, `src/core/qualified-path.ts`

- [ ] **Step 1: `src/core/copy.ts`**

The codemod added an import from `../deno_ral/fs.ts` (merged into the existing one at lines 17-23, which already imports `existsSync`, `safeRemoveSync`, `getFileInfoType`, …) containing `lstatSync`, `statSync`, `utimeSync`, `readDirSync`, `readLinkSync`, `symlinkSync`, `type FileInfo` but not `copyFileSync`.
Add `copyFileSync as fsCopyFileSync` to that import and change line 152:

```ts
  fsCopyFileSync(src, dest);
```

Leave the comment at line 28 as it is (comment lines are PR 25's cleanup; the acceptance greps exclude them).

- [ ] **Step 2: `src/core/qualified-path.ts`**

Confirm nothing passes `options` to the exported `readTextFile`: `grep -rn 'qualified-path.ts' src tests --include=*.ts` shows no importer of these two functions outside the file (verified 2026-10-14; if an importer exists, keep the parameter name but type it as `{ signal?: AbortSignal }` and ignore it).
Then replace lines 69-77 with:

```ts
export function readTextFile(t: QualifiedPath) {
  return fsReadTextFile(t.asAbsolute().value);
}

export function readTextFileSync(
  t: QualifiedPath,
) {
  return fsReadTextFileSync(t.asAbsolute().value);
}
```

and add `import { readTextFile as fsReadTextFile, readTextFileSync as fsReadTextFileSync } from "../deno_ral/fs.ts";` to the imports.

- [ ] **Step 3: Type-check and commit**

Run: `cd src && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --unstable-ffi --import-map=import_map.json quarto.ts` Expected: no errors.

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/paths/qualified-path.test.ts unit/file-permissions.test.ts` Expected: `0 failed`.

```bash
git add src/core/copy.ts src/core/qualified-path.ts
git commit -m "core: resolve codemod collisions in copy.ts and qualified-path.ts"
```

### Task 4: `Deno.errors` → predicates in `src/core`

**Files:**
- Modify: `src/core/http.ts`, `src/core/port.ts`, `src/core/cache/cache.ts`, `src/core/path.ts`, `src/core/jupyter/jupyter-shared.ts`, `src/core/typst.ts`, `src/core/copy.ts`

- [ ] **Step 1: `src/core/http.ts`**

Add `import { isConnectionError, isNotFound } from "../deno_ral/errors.ts";`.
Line 64: `} else if (isNotFound(e)) {`.
Replace lines 228-240:

```ts
export function maybeDisplaySocketError(e: unknown) {
  if (
    !isNotFound(e) &&
    !isConnectionError(e) &&
    !(e instanceof DOMException)
  ) {
    logError(e as Error);
  }
}
```

- [ ] **Step 2: `src/core/port.ts`**

Add `import { isAddrInUse } from "../deno_ral/errors.ts";`.
Line 131: `if (isAddrInUse(error)) {`.

- [ ] **Step 3: `src/core/cache/cache.ts`**

Add `import { isNotFound } from "../../deno_ral/errors.ts";`.
Line 161: `if (!isNotFound(e)) {`.

- [ ] **Step 4: `src/core/path.ts`**

Add `import { isNotFound } from "../deno_ral/errors.ts";`.
Line 189: `if (!isNotFound(e)) {`.

- [ ] **Step 5: `src/core/jupyter/jupyter-shared.ts`**

Add `import { isNotFound } from "../../deno_ral/errors.ts";`.
Line 107: `if (!isNotFound(err)) {`.

- [ ] **Step 6: `src/core/typst.ts`**

Add `import { isNotFound } from "../deno_ral/errors.ts";`.
Line 82: `if (isNotFound(e)) {`.

- [ ] **Step 7: `src/core/copy.ts`**

Add `import { isNotFound } from "../deno_ral/errors.ts";`.
Line 236: `if (isNotFound(err)) {`.

- [ ] **Step 8: Verify and commit**

Run: `grep -rn 'Deno\.errors' src/core src/quarto-core src/config --include=*.ts` Expected: empty.

Run: `cd src && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --unstable-ffi --import-map=import_map.json quarto.ts` Expected: no errors.

```bash
git add src/core
git commit -m "core: Deno.errors instanceof checks through deno_ral/errors predicates"
```

### Task 5: Tests, ratchet, commit

- [ ] **Step 1: Unit tests that exercise `src/core`**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent $(find unit/core/ -name '*.test.ts') $(find unit/paths/ -name '*.test.ts') unit/path.test.ts $(find unit/ral/ -name '*.test.ts') unit/dotenv-config.test.ts unit/environment.test.ts unit/sass-cache.test.ts unit/exec-process-stdin.test.ts unit/render/cleanup.test.ts unit/file-permissions.test.ts $(find unit/config/ -name '*.test.ts') unit/typst-fonts.test.ts unit/dart-sass.test.ts $(find unit/jupyter/ -name '*.test.ts') $(find unit/mapped-strings/ -name '*.test.ts') $(find unit/break-quarto-md/ -name '*.test.ts') $(find unit/schema-validation/ -name '*.test.ts') unit/text.test.ts unit/markdown-pipeline.test.ts unit/pandoc.test.ts unit/pandoc-formats.test.ts unit/pandoc-partition.test.ts unit/chrome-launch.test.ts unit/preview-brand-cache.test.ts` Expected: `0 failed`.

- [ ] **Step 2: Smoke tests that go through the touched code (render pipeline, freezer, caches, http server, temp dirs)**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/render/render-html.test.ts smoke/render/render-freeze.test.ts smoke/render/render-minimal.test.ts smoke/render/render-output-dir.test.ts smoke/project/project-simple.test.ts smoke/project/project-prepost.test.ts smoke/site/render-site.test.ts smoke/jupyter/cache.test.ts $(find smoke/logging/ -name '*.test.ts') smoke/check/check.test.ts $(find smoke/run/ -name '*.test.ts') $(find smoke/env/ -name '*.test.ts') smoke/extensions/install.test.ts` Expected: `0 failed`.

- [ ] **Step 3: Ratchet**

Run: `quarto run --dev tools/check-runtime-boundary.ts --update-baseline && quarto run --dev tools/check-runtime-boundary.ts` Expected: passes; `git diff tools/runtime-boundary-baseline.json` shows the `src` count lower by exactly 170 (171 with PR 20b first) and no increase in any scope.

- [ ] **Step 4: Commit**

```bash
git add tools/runtime-boundary-baseline.json
git commit -m "Lower runtime boundary baseline after core fs/temp codemod"
```

## Verification

- The three unit/smoke commands of Task 5 → `0 failed`.
- `quarto run --dev tools/check-runtime-boundary.ts` → passes at the new baseline.
- The grep in Acceptance criteria → empty.
- `cd src && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --unstable-ffi --import-map=import_map.json quarto.ts` → exit 0.
- Manual: `package/dist/bin/quarto render tests/docs/test.qmd --to html` and `package/dist/bin/quarto preview tests/docs/test.qmd --no-browser` (Ctrl-C after it serves) both work; `QUARTO_REPORT_PERFORMANCE_METRICS=fileReads package/dist/bin/quarto render tests/docs/test.qmd` still prints a file-read report (the `metrics.ts` hook kept working because the layer looks `Deno.readTextFileSync` up at call time).

## Review checklist

- [ ] `git diff` under `src/core` contains, apart from the hand-edited files, only `Deno.x` → `x`, `Deno.MakeTempOptions` → `TempOptions`, `Deno.FileInfo` → `FileInfo`, and import lines (`git diff -U0 src/core | grep '^[-+]' | grep -v '^[-+][-+]' | grep -v 'deno_ral/\(fs\|temp\|errors\)\.ts' | grep -vE 'Deno\.|FileInfo|TempOptions|^[+-]\s*$|^[+-]\s*(import|\}|[a-zA-Z]+,|type [A-Za-z]+,)' ` prints nothing surprising).
- [ ] `monkey-patch.ts` is byte-identical to `main`; `metrics.ts` too unless PR 20b landed first.
- [ ] No comment line changed (comments are PR 25's).
- [ ] `copy.ts` still calls the real `copyFileSync` of the layer at line 152 (not its own recursive helper).
- [ ] The `http.ts` predicate rewrite keeps the `DOMException` exclusion.
- [ ] No `src/core/lib/**` file imports `deno_ral` (those files are bundled for the browser).
- [ ] Baseline only decreased.

## Risks and rollback

- `readDirSync` now returns a sorted array; `src/core/path.ts:53` (emptiness check) and `copy.ts:179` (recursive copy) are order-independent, so output is unchanged.
  If a snapshot test under `tests/docs/smoke-all` differs only in file order, that is the intended determinism; update the snapshot.
- `qualified-path.ts` loses the unused `options` parameter; if a hidden caller passed `{ signal }`, the type check in Task 3 step 3 catches it.
- `deno fmt` may reflow lines unrelated to the codemod in a file it touched; acceptable, but if a diff becomes unreadable, run `deno fmt` only on the import block by reverting the unrelated hunks.
- Rollback: `git revert` the four commits; the layer (PR 09) stays.

## Decisions needed

None.
Review items closed here: counts (56 files / 153 replacements, not ~70 / ~180), acceptance greps that matched comments (`copy.ts:28,145`; now AST dry run plus a comment-filtered `rg`), the "report rather than extend `FileInfo`" dead end (PR 09 retypes `getFileInfoType`), landing order and the reset-and-re-run conflict protocol.

## Follow-up after merge

One representative maintenance fix backported through `--reverse` (`TRIAGE-2026-10-16.md`, cross-cutting row 2; review decision 10), owed once this PR is on `main`, because this PR creates the first codemodded files a backport can cross.
Pick the first real fix to `main` that touches a call site this PR renamed (`git log --oneline main -- src/core/path.ts | head`), run the backport step PR 37 Task 6 Step 1 spells out (same commands before the flip; the codemod runs through `quarto run --dev` on Deno) against a scratch branch off `v1.10`, confirm `git apply -3` succeeds and the scratch branch type-checks with its own tooling, and record the commit used in the triage row and in `dev-docs/checklist-backport-a-pr.md` (PR 09 adds the step there).
The error predicates of Task 4 have no 1:1 reverse: they are the manual part the review asked to keep explicit.
PR 37 Task 6 Step 2 repeats the exercise after the flip.
