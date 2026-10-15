# PR 13: Run the fs/temp codemod on `src/execute`, `src/publish`, `src/tools`, `src/extension`, `src/preview` and the remaining `src/` directories

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move every plain filesystem and temp-file call in `src/execute`, `src/publish`, `src/tools`, `src/extension`, `src/preview`, `src/inspect` and `src/render` from `Deno.*` to `src/deno_ral/fs.ts` / `src/deno_ral/temp.ts` with the codemod, fix the one reported collision by hand, and record why the standalone TypeScript under `src/resources` and `src/webui` (`resources/tools/ast-diagram/main.ts`, `webui/quarto-preview/build.ts`) is left alone.
**Phase:** 1. **Depends on:** PR 09 (layer + codemod), PR 02 (ratchet); lands after PR 08 and PR 22 (landing order below). **Unblocks:** PR 25.
**Branch:** `rt/13-codemod-fs-rest`.
**Suggested executor:** Sonnet. Mechanical codemod plus one alias import; the review is about the diff and the exclusion list.
**Size:** M. 35 files rewritten by the codemod across seven directories (122 replacements, measured by a dry run of PR 09's codemod logic on `b86f98d`; 9 + 15 + 9 + 4 + 3 + 1 + 2 files use `Deno.*`); 1 edited by hand.
**Ships on:** Deno; the existing test suite must stay green.

## Spec

### Context

Last of the four codemod PRs (assessment section 11, order of work step 3; PR 09 ships the tool). After this PR every fs/temp call site in `src/` that *can* import the layer has moved; what remains is the process (PR 08), env (PR 14), net/http/watch/kv/platform (PRs 15–19) families and the standalone scripts listed below.

Measured on `main` at `b86f98d` (2026-10-15) with `grep -rhoE '\bDeno\.[A-Za-z_]+(\.[A-Za-z_]+)?' <dir> --include=*.ts --exclude-dir=node_modules --exclude-dir=extension-subtrees | sort | uniq -c | sort -rn`:

`src/execute` (56 sites, 9 files): `readTextFileSync` 19, `writeTextFileSync` 7, `env.set` 7, `cwd` 4, `Conn` 4, `makeTempFileSync` 2, `env.get` 2, `connect` 2, `Command` 2, `writeFileSync` 1, `remove` 1, `readTextFile` 1, `readFileSync` 1, `pid` 1, `execPath` 1, `ChildProcess` 1. This PR: 30 fs + 2 temp. Others: PR 08 (`cwd`, `Command`, `pid`, `execPath`, `ChildProcess`), PR 14 (`env`), PR 15 (`Conn`, `connect`).

`src/publish` (43 sites, 15 files): `env.get` 11, `writeTextFileSync` 7, `statSync` 7, `readTextFileSync` 5, `readFileSync` 4, `readFile` 2, `open` 2, `readDirSync` 1, `openSync` 1 (a commented-out line, `common/bundle.ts:106`), `inspect` 1, `copyFileSync` 1, `chmod` 1. This PR: 30 fs code sites (the comment stays for PR 25's comment cleanup). Others: PR 14 (`env`), PR 19 (`inspect`).

`src/tools` (54 sites, 9 files): `env.get` 15, `writeTextFileSync` 5, `readTextFileSync` 4, `makeTempDirSync` 4, `exit` 4, `statSync` 3, `remove` 3, `readTextFile` 2, `readDirSync` 2, `readDir` 2, `build.arch` 2, `writeTextFile` 1, `symlink` 1, `stdout.writeSync` 1, `realPath` 1, `permissions.query` 1, `makeTempFileSync` 1, `lstat` 1, `chmodSync` 1. This PR: 26 fs + 5 temp. Others: PR 08 (`exit`, `stdout`), PR 14 (`env`), PR 19 (`build.arch`, `permissions`).

`src/extension` (19 sites, 4 files): `statSync` 8, `readDirSync` 4, `cwd` 3, `remove` 2, `renameSync` 1, `readTextFileSync` 1. This PR: 16 fs. Others: PR 08 (`cwd`).

`src/preview` (13 sites, 3 files): `readTextFileSync` 4, `writeTextFileSync` 2, `stderr.writeSync` 2, `readTextFile` 1, `readFile` 1, `makeTempDirSync` 1, `kill` 1, `Command` 1. This PR: 8 fs + 1 temp. Others: PR 08.

`src/inspect` (2 sites, 1 file): `statSync` 1 (this PR), `cwd` 1 (PR 08).

`src/render` (5 sites, 2 files: `notebook/notebook-context.ts`, `notebook/notebook-contributor-qmd.ts`): `copyFileSync` 2, `statSync` 2, `writeTextFileSync` 1. This PR: all 5.

Excluded paths, with the reason. PR 09's codemod skips all of them by construction (`kCodemodExclusions` = PR 02's `kSrcExclusions` plus `src/core/lib` and `src/resources/tools/ast-diagram`), and this PR does not pass `src/resources` or `src/webui` to it anyway:

| Path | Sites | Why it cannot import `src/deno_ral` | Who handles it |
|---|---|---|---|
| `src/resources/extension-subtrees/julia-engine/**` | 72 (21 + 31 + 20 in three files) | git subtree of `PumasAI/quarto-julia-engine`; local edits are overwritten by `quarto dev-call pull-git-subtree` | upstream (decision 7: no in-tree edit; the subtree is pulled before PR 32) |
| `src/resources/tools/ast-diagram/main.ts` | 6 | shipped under `share/tools/`, run by `deno run` without the import map (`src/command/dev-call/make-ast-diagram/cmd.ts:23-29`); imports `https://deno.land/std/path/mod.ts` | PR 25 moves it into the ratchet allow-list (out of the `src` scope, counted under `resources`); PR 35 ports it with the `quarto run` work |
| `src/resources/scripts/check-usage.ts`, `src/resources/scripts/juice.ts` | 2 + 2 | resource scripts run standalone (`check-usage.ts:1` imports `https://deno.land/std@0.76.0/io/bufio.ts`) | counted in PR 02's `resources` scope; PR 35 |
| `src/resources/create/extensions/engine/src/qstart-filesafename-qend.ejs.ts` | 1 | an EJS template that becomes the user's extension source; it must keep working outside the Quarto tree | counted in `resources`; PR 35/36 |
| `src/webui/quarto-preview/build.ts` | 8 | that package's build script, run with `deno run --no-config -A build.ts` (`package/src/common/previewjs.ts:14`), i.e. without the import map; `src/deno_ral/fs.ts` imports `fs/copy`, `fs/walk`, … through the import map, so the script cannot import it; PR 08 leaves its process calls too | PR 25 keeps it in the allow-list (`kSrcExclusions`) until PR 33 ports the build tooling |

Files in scope that need attention beyond the codemod (verified):

| File | Why |
|---|---|
| `src/tools/impl/tinytex.ts:662` | `const realPath = await Deno.realPath(texLivePath);` — the local `realPath` binding collides with the layer's `realPath`; the tool reports it. Fix with an alias import. (`realPath` is the symlink-resolving async variant; the layer keeps that semantics.) |
| `src/publish/common/bundle.ts:106-108` | a commented-out `Deno.openSync` block; left for PR 25's comment cleanup. Lines 114-115 (`Deno.open` twice, `src.readable.pipeThrough(...).pipeTo(dest.writable)`) are rewritten by the codemod; `FsFile` has `readable`/`writable`. |
| `src/execute/ojs/extract-resources.ts:561` | a trailing comment `// Deno.readTextFileSync(thisResolvedImportPath);` after code on the same line; the AST codemod ignores it and the acceptance `rg` filters it explicitly; PR 25's comment cleanup removes it. |
| `src/tools/tools.ts:387,413` | `Deno.symlink` → `symlink`, `Deno.lstat` → `lstat` (async variants added by PR 09). Review only. |
| `src/publish/common/account.ts:100` | `Deno.chmod(tokensPath, 0o600)` (not awaited) → `chmod(...)`. Review only; keep it un-awaited as today. |
| `src/tools/impl/verapdf.ts:208,212`, `src/tools/impl/chrome-headless-shell.ts:122,128`, `src/extension/extension.ts:296,477,683`, `src/extension/install.ts:289`, `src/publish/gh-pages/gh-pages.ts:219` | `Deno.readDir`/`readDirSync` loops; extension discovery (`extension.ts`) now visits extension directories in sorted order, which only matters when two extensions declare the same id (last wins today, in filesystem order; now in name order). `tests/smoke/extensions/` covers discovery. Review only. |
| `src/execute/jupyter/jupyter-kernel.ts:275`, `src/execute/rmd.ts:450` | `Deno.makeTempFileSync(...)` → `makeTempFileSync(...)` (temp rule). The surrounding `Deno.Conn`/`Deno.connect` (PR 15) and `Deno.env` (PR 14) stay. Review only. |
| `src/preview/preview-text.ts:170`, `src/tools/tools.ts:139,207,235`, `src/tools/impl/chrome-headless-shell.ts:94`, `src/tools/impl/chrome-for-testing.ts:248` | `Deno.makeTemp*` → temp rule. Review only. |

### Scope

In: the codemod with `--rules fs,temp` on `src/execute`, `src/publish`, `src/tools`, `src/extension`, `src/preview`, `src/inspect`, `src/render`; the `tinytex.ts` alias; `deno fmt`; baseline update; a note in `.claude/rules/typescript/deno-ral.md` listing the excluded standalone scripts.
Out: everything in the exclusion table; comment lines that mention `Deno.*` (PR 25); `Deno.env` (PR 14); process/net/platform APIs (PRs 08, 15, 19); `Deno.errors` (none in these directories).

### Landing order and conflict protocol

Phase 1 lands in the order 08 → 22 → 10–13 → 14 (README, review finding S10). PRs 10–13 cover disjoint directories, but PR 08, PR 22 and PR 14 edit the import blocks of many of the same files (34–38 files overlap), and the codemod inserts its import after the last import, the same anchor every one of them uses. Conflicts in this PR are therefore expected and are resolved mechanically, never by hand-merging a codemodded hunk:

1. `git rebase origin/main`; for every conflicted file under this PR's directories, `git checkout origin/main -- <file>` (reset the file to `main`).
2. Re-run the codemod on exactly those files: `quarto run --dev tools/codemod-deno-ral.ts --rules <this PR's rules> --file <file> [--file <file>...]`.
3. Re-apply this PR's hand edits for those files (each is listed with its exact code below), then `package/dist/bin/tools/x86_64/deno fmt <file>...`.
4. `git add` the files and `git rebase --continue`; run the type check and the dry run of Task 1 again (it must report `0 replacements` for the PR's directories once the hand edits are back).

This works because PR 09's collision detection is symbol-based and reuses existing alias imports: a re-run over a partly migrated file finishes it and does not report the layer's own imports as collisions.

### Interfaces

No new interfaces. Alias import used by the hand fix:

```ts
// src/tools/impl/tinytex.ts
import { realPath as fsRealPath } from "../../deno_ral/fs.ts";
```

### Files

- Modify (codemod): every `*.ts` under the seven directories that uses an fs/temp API (35 files)
- Modify (hand): `src/tools/impl/tinytex.ts:662`, `src/publish/common/bundle.ts:106-108`
- Modify: `tools/runtime-boundary-baseline.json`, `.claude/rules/typescript/deno-ral.md`

### Acceptance criteria

- AST check (comments never count): `quarto run --dev tools/codemod-deno-ral.ts --rules fs,temp --dir src/execute --dir src/publish --dir src/tools --dir src/extension --dir src/preview --dir src/inspect --dir src/render --dry-run | tail -1` → `Summary: 172 files scanned, 0 would be rewritten, 0 replacements, 0 with collisions, 0 skipped`.
- Text check, comment lines (and comments trailing code) excluded:

  ```bash
  rg -n '\bDeno\.(readTextFileSync|readTextFile|readFileSync|readFile|writeTextFileSync|writeTextFile|writeFileSync|writeFile|statSync|stat|lstatSync|lstat|mkdirSync|mkdir|removeSync|remove|renameSync|rename|copyFileSync|copyFile|readDirSync|readDir|symlinkSync|symlink|readLinkSync|realPath|realPathSync|chmodSync|chmod|utimeSync|truncateSync|open|openSync|create|makeTempDirSync|makeTempDir|makeTempFileSync|makeTempFile|FileInfo|DirEntry|MakeTempOptions|errors)\b' \
    src/execute src/publish src/tools src/extension src/preview src/inspect src/render -g '*.ts' \
    | rg -v '^[^:]+:[0-9]+:\s*(//|/\*|\*)' | rg -v "^[^:]+:[0-9]+:[^\"'\`]*//.*\bDeno\."
  ```
  prints nothing (`bundle.ts:106-108` and `extract-resources.ts:561` are filtered).
- `quarto run --dev tools/check-runtime-boundary.ts` passes, with the `src` scope count exactly 123 lower than before (122 codemod replacements + the `tinytex.ts` collision site).
- `cd src && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --unstable-ffi --import-map=import_map.json quarto.ts` passes.
- The tests in Verification pass.

## Plan

Assumes PR 09 landed. In the prescribed order PR 08 and PR 22 have landed; independent of PRs 10, 11, 12.

### Task 1: Dry run and review

- [ ] **Step 1: Dry run**

Run: `quarto run --dev tools/codemod-deno-ral.ts --rules fs,temp --dir src/execute --dir src/publish --dir src/tools --dir src/extension --dir src/preview --dir src/inspect --dir src/render --dry-run > /tmp/codemod-rest.txt; tail -1 /tmp/codemod-rest.txt`
Expected: `Summary: 172 files scanned, 35 would be rewritten, 122 replacements, 1 with collisions, 0 skipped` (measured on `b86f98d`); `git status --short src` is empty.

- [ ] **Step 2: Review the report**

Run: `grep -E 'skipped|collision' /tmp/codemod-rest.txt`
Expected exactly:
```
src/tools/impl/tinytex.ts:662: collision: local binding 'realPath' conflicts with deno_ral/fs.ts; left as Deno.*
```

Run: `grep '→' /tmp/codemod-rest.txt | awk -F'→' '{print $2}' | sort | uniq -c | sort -rn`
Expected: only `fs`/`temp` rule targets.

- [ ] **Step 3: Confirm the exclusions are not in the walk**

Run: `grep -c 'src/resources\|src/webui' /tmp/codemod-rest.txt`
Expected: `0` (those directories were not passed; `src/resources/extension-subtrees` would be skipped by the tool anyway).

### Task 2: Apply the codemod

- [ ] **Step 1: Rewrite**

Run: `quarto run --dev tools/codemod-deno-ral.ts --rules fs,temp --dir src/execute --dir src/publish --dir src/tools --dir src/extension --dir src/preview --dir src/inspect --dir src/render | tail -1`
Expected: `Summary: 172 files scanned, 35 rewritten, 122 replacements, 1 with collisions, 0 skipped`.

- [ ] **Step 2: Format and type-check**

Run: `git diff --name-only | xargs package/dist/bin/tools/x86_64/deno fmt`
Expected: `git diff --stat | tail -1` lists only files under the seven directories.

Run: `cd src && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --unstable-ffi --import-map=import_map.json quarto.ts`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/execute src/publish src/tools src/extension src/preview src/inspect src/render
git commit -m "execute/publish/tools/extension/preview/inspect/render: codemod Deno fs/temp calls to deno_ral (mechanical)"
```

### Task 3: Hand fixes

**Files:**
- Modify: `src/tools/impl/tinytex.ts`

- [ ] **Step 1: `src/tools/impl/tinytex.ts`**

Add `realPath as fsRealPath` to the file's `../../deno_ral/fs.ts` import (the codemod created or extended it for `writeTextFileSync`/`readTextFileSync`/… in the same file) and change line 662:

```ts
    const realPath = await fsRealPath(texLivePath);
```

- [ ] **Step 2: Verify and commit**

Run: `rg -n 'Deno\.realPath\b' src/tools -g '*.ts'`
Expected: empty. (`Deno.openSync` still appears in the `bundle.ts:106` comment; PR 25 removes it.)

Run: `cd src && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --unstable-ffi --import-map=import_map.json quarto.ts`
Expected: no errors.

```bash
git add src/tools/impl/tinytex.ts
git commit -m "tools: resolve realPath collision in tinytex.ts"
```

### Task 4: Tests, docs, ratchet, commit

- [ ] **Step 1: Unit tests that exercise the seven directories**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent $(find unit/tools/ -name '*.test.ts') $(find unit/extension/ -name '*.test.ts') $(find unit/jupyter/ -name '*.test.ts') $(find unit/confluence/ -name '*.test.ts') $(find unit/project/ -name '*.test.ts') unit/preview-compatibility.test.ts unit/preview-brand-cache.test.ts unit/preview-external-links.test.ts unit/preview-initial-path.test.ts unit/preview-subdir-knitr-cwd.test.ts unit/exec-process-stdin.test.ts unit/render-shared-output-dir.test.ts`
Expected: `0 failed` (`unit/tools/` holds `chrome-for-testing`, `chrome-headless-shell` and `tinytex` tests; `unit/project/` exercises `src/render/notebook` through the project context).

- [ ] **Step 2: Smoke tests across engines, extensions, preview, tools**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent $(find smoke/engine/ -name '*.test.ts') $(find smoke/jupyter/ -name '*.test.ts') $(find smoke/extensions/ -name '*.test.ts') $(find smoke/ojs/ -name '*.test.ts') $(find smoke/embed/ -name '*.test.ts') $(find smoke/env/ -name '*.test.ts') $(find smoke/run/ -name '*.test.ts') smoke/check/check.test.ts smoke/inspect/inspect-extensions.test.ts smoke/render/render-jupyter.test.ts smoke/render/render-r.test.ts smoke/render/render-ojs.test.ts smoke/render/render-verapdf.test.ts`
Expected: `0 failed` (Jupyter/R/veraPDF tests skip when their prerequisites are missing; note any skip in the PR). Publishing code has no smoke tests (network); `unit/confluence/` is its unit coverage.

- [ ] **Step 3: Document the exclusions**

In `.claude/rules/typescript/deno-ral.md`, under the "Moving code off `Deno.*`" subsection added by PR 09, append:

```
Standalone scripts that run without the import map cannot import `deno_ral` and keep their `Deno.*` calls until the PR that owns them: `src/resources/scripts/*.ts` and `src/resources/create/**/*.ejs.ts` (PR 35), `src/resources/tools/ast-diagram/main.ts` (allow-listed by PR 25, ported by PR 35), `src/webui/quarto-preview/build.ts` (allow-listed until PR 33), and the `src/resources/extension-subtrees/` git subtrees (upstream). The codemod skips all of them.
```

- [ ] **Step 4: Ratchet**

Run: `quarto run --dev tools/check-runtime-boundary.ts --update-baseline && quarto run --dev tools/check-runtime-boundary.ts`
Expected: passes; `git diff tools/runtime-boundary-baseline.json` shows the `src` count lower by exactly 123 and no increase in any scope.

- [ ] **Step 5: Commit**

```bash
git add tools/runtime-boundary-baseline.json .claude/rules/typescript/deno-ral.md
git commit -m "Lower runtime boundary baseline after remaining fs/temp codemod; document excluded scripts"
```

## Verification

- Task 4 steps 1–2 → `0 failed`.
- `quarto run --dev tools/check-runtime-boundary.ts` → passes at the new baseline.
- The AST dry run and the `rg` in Acceptance criteria → as stated.
- `cd src && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --unstable-ffi --import-map=import_map.json quarto.ts` → exit 0.
- Manual: `package/dist/bin/quarto tools list` (tools code: reads/writes through the layer); with network, `cd $(mktemp -d) && package/dist/bin/quarto add quarto-ext/lightbox --no-prompt && package/dist/bin/quarto list extensions` (extension install + discovery through sorted `readDirSync`) → both succeed; `package/dist/bin/quarto preview tests/docs/test.qmd --no-browser` serves and exits on Ctrl-C.

## Review checklist

- [ ] `git diff` under the seven directories contains only `Deno.x` → `x` rewrites, import lines and the `fsRealPath` alias; no comment line changed.
- [ ] `account.ts:100` `chmod` is still fire-and-forget (unchanged semantics).
- [ ] `bundle.ts` still pipes `src.readable` through `CompressionStream` into `dest.writable`.
- [ ] No file under `src/resources`, `src/webui` or the subtree changed.
- [ ] The rules doc lists the excluded scripts; the baseline only decreased.

## Risks and rollback

- Extension discovery order is now sorted; a project with two extensions of the same id in different directories may resolve to a different one than before. No supported configuration relies on that (ids are expected to be unique); `tests/smoke/extensions/` passes.
- `src/tools/impl/verapdf.ts` and `chrome-headless-shell.ts` scan extracted archives; sorted order does not change which file they find (they search by name pattern).
- `deno fmt` may reflow unrelated lines; revert unrelated hunks if a diff becomes hard to review.
- Rollback: `git revert` the three commits; the layer stays.

## Decisions needed

None. (The exclusion list is a statement of fact about scripts that run without the import map, not a choice; PR 25 records `ast-diagram/main.ts` and `quarto-preview/build.ts` in the ratchet allow-list, PRs 33 and 35 port them.) Review items closed here: counts (35 files / 122 replacements), the comment-matching grep (AST dry run plus filtered `rg`, including the trailing comment at `extract-resources.ts:561`), the `realPath` collision, the contradiction with PR 25 on the two standalone scripts, landing order and the reset-and-re-run protocol.
