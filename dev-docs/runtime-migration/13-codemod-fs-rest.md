# PR 13: Run the fs/temp codemod on `src/execute`, `src/publish`, `src/tools`, `src/extension`, `src/preview` and the remaining `src/` directories

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move every plain filesystem and temp-file call in `src/execute`, `src/publish`, `src/tools`, `src/extension`, `src/preview`, `src/inspect` and `src/render` from `Deno.*` to `src/deno_ral/fs.ts` / `src/deno_ral/temp.ts` with the codemod, fix the one reported collision by hand, and record why the standalone TypeScript under `src/resources` and `src/webui` (`resources/tools/ast-diagram/main.ts`, `webui/quarto-preview/build.ts`) is left alone.
**Phase:** 1.
**Depends on:** PR 09 (layer + codemod), PR 02 (ratchet); lands before PR 08 and PR 22 (README, decided 2026-11-17).
**Unblocks:** PR 14 (the env codemod runs after the fs codemods), PR 25.
**Branch:** `rt/13-codemod-fs-rest`.
**Suggested executor:** Sonnet.
Mechanical codemod plus one alias import; the review is about the diff and the exclusion list.
**Size:** M.
35 files rewritten by the codemod across seven directories (122 replacements, measured by a dry run on `2d133a903`; 9 + 15 + 9 + 4 + 3 + 1 + 2 files use `Deno.*`); 1 edited by hand.
**Ships on:** Deno; the existing test suite must stay green.

## Spec

### Context

Last of the four codemod PRs (assessment section 11, order of work step 3; PR 09 ships the tool).
After this PR every fs/temp call site in `src/` that *can* import the layer has moved; what remains is the process (PR 08), env (PR 14), net/http/watch/kv/platform (PRs 15–19) families and the standalone scripts listed below.

Measured on `main` at `b86f98d` (2026-10-15) with `grep -rhoE '\bDeno\.[A-Za-z_]+(\.[A-Za-z_]+)?' <dir> --include=*.ts --exclude-dir=node_modules --exclude-dir=extension-subtrees | sort | uniq -c | sort -rn`:

`src/execute` (56 sites, 9 files): `readTextFileSync` 19, `writeTextFileSync` 7, `env.set` 7, `cwd` 4, `Conn` 4, `makeTempFileSync` 2, `env.get` 2, `connect` 2, `Command` 2, `writeFileSync` 1, `remove` 1, `readTextFile` 1, `readFileSync` 1, `pid` 1, `execPath` 1, `ChildProcess` 1.
This PR: 30 fs + 2 temp.
Others: PR 08 (`cwd`, `Command`, `pid`, `execPath`, `ChildProcess`), PR 14 (`env`), PR 15 (`Conn`, `connect`).

`src/publish` (43 sites, 15 files): `env.get` 11, `writeTextFileSync` 7, `statSync` 7, `readTextFileSync` 5, `readFileSync` 4, `readFile` 2, `open` 2, `readDirSync` 1, `openSync` 1 (a commented-out line, `common/bundle.ts:106`), `inspect` 1, `copyFileSync` 1, `chmod` 1.
This PR: 30 fs code sites (the comment stays for PR 25's comment cleanup).
Others: PR 14 (`env`), PR 19 (`inspect`).

`src/tools` (54 sites, 9 files): `env.get` 15, `writeTextFileSync` 5, `readTextFileSync` 4, `makeTempDirSync` 4, `exit` 4, `statSync` 3, `remove` 3, `readTextFile` 2, `readDirSync` 2, `readDir` 2, `build.arch` 2, `writeTextFile` 1, `symlink` 1, `stdout.writeSync` 1, `realPath` 1, `permissions.query` 1, `makeTempFileSync` 1, `lstat` 1, `chmodSync` 1.
This PR: 26 fs + 5 temp.
Others: PR 08 (`exit`, `stdout`), PR 14 (`env`), PR 19 (`build.arch`, `permissions`).

`src/extension` (19 sites, 4 files): `statSync` 8, `readDirSync` 4, `cwd` 3, `remove` 2, `renameSync` 1, `readTextFileSync` 1.
This PR: 16 fs.
Others: PR 08 (`cwd`).

`src/preview` (13 sites, 3 files): `readTextFileSync` 4, `writeTextFileSync` 2, `stderr.writeSync` 2, `readTextFile` 1, `readFile` 1, `makeTempDirSync` 1, `kill` 1, `Command` 1.
This PR: 8 fs + 1 temp.
Others: PR 08.

`src/inspect` (2 sites, 1 file): `statSync` 1 (this PR), `cwd` 1 (PR 08).

`src/render` (5 sites, 2 files: `notebook/notebook-context.ts`, `notebook/notebook-contributor-qmd.ts`): `copyFileSync` 2, `statSync` 2, `writeTextFileSync` 1.
This PR: all 5.

Excluded paths, with the reason.
PR 09's codemod skips all of them by construction (`kCodemodExclusions` = PR 02's `kSrcExclusions` plus `src/core/lib` and `src/resources/tools/ast-diagram`), and this PR does not pass `src/resources` or `src/webui` to it anyway:

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
| `src/tools/impl/tinytex.ts:738` | `const realPath = await Deno.realPath(texLivePath);` — the local `realPath` binding collides with the layer's `realPath`; the tool reports it. Fix with an alias import. (`realPath` is the symlink-resolving async variant; the layer keeps that semantics.) |
| `src/publish/common/bundle.ts:106-108` | a commented-out `Deno.openSync` block; left for PR 25's comment cleanup. Lines 114-115 (`Deno.open` twice, `src.readable.pipeThrough(...).pipeTo(dest.writable)`) are rewritten by the codemod; `FsFile` has `readable`/`writable`. |
| `src/execute/ojs/extract-resources.ts:561` | a trailing comment `// Deno.readTextFileSync(thisResolvedImportPath);` after code on the same line; the AST codemod ignores it and the acceptance `rg` filters it explicitly; PR 25's comment cleanup removes it. |
| `src/tools/tools.ts:397,423` | `Deno.symlink` → `symlink`, `Deno.lstat` → `lstat` (async variants added by PR 09). Review only. |
| `src/publish/common/account.ts:100` | `Deno.chmod(tokensPath, 0o600)` (not awaited) → `chmod(...)`. Review only; keep it un-awaited as today. |
| `src/tools/impl/verapdf.ts:208,212`, `src/tools/impl/chrome-headless-shell.ts:122,128`, `src/extension/extension.ts:296,477,685`, `src/extension/install.ts:289`, `src/publish/gh-pages/gh-pages.ts:219` | `Deno.readDir`/`readDirSync` loops; extension discovery (`extension.ts`) now visits extension directories in sorted order. That changes which extension wins when two declare the same id (last wins today, in filesystem order; now in name order), and the row order of `quarto list extensions`, which prints extensions in discovery order (`src/command/list/cmd.ts:101`). `tests/smoke/extensions/` covers discovery. Review only. |
| `src/execute/jupyter/jupyter-kernel.ts:275`, `src/execute/rmd.ts:450` | `Deno.makeTempFileSync(...)` → `makeTempFileSync(...)` (temp rule). The surrounding `Deno.Conn`/`Deno.connect` (PR 15) and `Deno.env` (PR 14) stay. Review only. |
| `src/preview/preview-text.ts:170`, `src/tools/tools.ts:145,213,242`, `src/tools/impl/chrome-headless-shell.ts:94`, `src/tools/impl/chrome-for-testing.ts:248` | `Deno.makeTemp*` → temp rule. Review only. |

### Scope

In: the codemod with `--rules fs,temp` on `src/execute`, `src/publish`, `src/tools`, `src/extension`, `src/preview`, `src/inspect`, `src/render`; the `tinytex.ts` alias; `deno fmt`; baseline update; a note in `.claude/rules/typescript/deno-ral.md` listing the excluded standalone scripts; the changelog entry for sorted directory listings.
Out: everything in the exclusion table; comment lines that mention `Deno.*` (PR 25); `Deno.env` (PR 14); process/net/platform APIs (PRs 08, 15, 19); `Deno.errors` (none in these directories).

### Landing order and conflict protocol

Phase 1 lands the filesystem codemods 10–13 first, then 14, then 08 and 22 (README, decided 2026-11-17).
PRs 10–13 cover disjoint directories, but PR 08, PR 22 and PR 14 edit the import blocks of many of the same files (34–38 files overlap), and the codemod inserts its import after the last import, the same anchor every one of them uses.
Conflicts in this PR are therefore expected and are resolved mechanically, never by hand-merging a codemodded hunk:

1. `git fetch upstream && git rebase upstream/main`; for every conflicted file under this PR's directories, `git checkout upstream/main -- <file>` (reset the file to `main`).
2. Re-run the codemod on exactly those files: `quarto run --dev tools/codemod-deno-ral.ts --rules <this PR's rules> --file <file> [--file <file>...]`.
3. Re-apply this PR's hand edits for those files (each is listed with its exact code below), then `package/dist/bin/tools/x86_64/deno fmt <file>...`, leaving out the five files that are unformatted on `main` (see the README row for Task 2 Step 2).
4. `git add` the files and `git rebase --continue`; run the type check and the dry run of Task 1 again (it must report `0 replacements` for the PR's directories once the hand edits are back).

This works because PR 09's collision detection is symbol-based and reuses existing alias imports: a re-run over a partly migrated file finishes it and does not report the layer's own imports as collisions.

### Interfaces

No new interfaces.
Alias import used by the hand fix:

```ts
// src/tools/impl/tinytex.ts
import { realPath as fsRealPath } from "../../deno_ral/fs.ts";
```

### Files

- Modify (codemod): every `*.ts` under the seven directories that uses an fs/temp API (35 files)
- Modify (hand): `src/tools/impl/tinytex.ts:738` (`src/publish/common/bundle.ts:106-108` is a commented-out block left for PR 25)
- Modify: `tools/runtime-boundary-baseline.json`, `.claude/rules/typescript/deno-ral.md`, `news/changelog-1.12.md`

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
- `cd src && ../package/dist/bin/tools/x86_64/deno check --allow-import --unstable-kv --unstable-ffi --import-map=import_map.json quarto.ts` passes.
- The tests in Verification pass.

## Plan

Assumes PR 09 landed.
PRs 09, 10, 11 and 12 are merged; PR 08 and PR 22 have not landed. PR 12 merged as #15426 and edited only `src/project` and `src/format`; this branch is rebased onto `f23c186c8`, which includes it, and the `src` baseline on that base is 507 (execution log, "Base refresh").

### Task 1: Dry run and review

README ground rule 7 applies: this PR is generated from fresh `main` the day it is opened and merged the same day; the reviewer named in README "Roles" is booked for that day.
PRs 10–13 are independent (disjoint directories) but every one of them edits `tools/runtime-boundary-baseline.json` with an exact delta: open them one at a time, or rebase and regenerate the baseline (ground rule 8) before each merge; the expected delta of this plan is then read against the new `main`.


- [x] **Step 1: Dry run**

Run: `mkdir -p .claude/docs && quarto run --dev tools/codemod-deno-ral.ts --rules fs,temp --dir src/execute --dir src/publish --dir src/tools --dir src/extension --dir src/preview --dir src/inspect --dir src/render --dry-run > .claude/docs/codemod-rest.txt; tail -1 .claude/docs/codemod-rest.txt` Expected: `Summary: 172 files scanned, 35 would be rewritten, 122 replacements, 1 with collisions, 0 skipped` (measured on `b86f98d`, again on `f23c186c8`); `git status --short src` is empty.

- [x] **Step 2: Review the report**

Run: `grep -E 'skipped:|collision:' .claude/docs/codemod-rest.txt` Expected exactly (the `Summary:` line does not match these markers):
```
src/tools/impl/tinytex.ts:738: collision: local binding 'realPath' conflicts with deno_ral/fs.ts; left as Deno.*
```

Run: `grep '→' .claude/docs/codemod-rest.txt | awk -F'→' '{print $2}' | sort | uniq -c | sort -rn` Expected: only `fs`/`temp` rule targets.

- [x] **Step 3: Confirm the exclusions are not in the walk**

Run: `grep -c 'src/resources\|src/webui' .claude/docs/codemod-rest.txt` Expected: `0` (those directories were not passed; `src/resources/extension-subtrees` would be skipped by the tool anyway).

### Task 2: Apply the codemod

- [x] **Step 1: Rewrite**

Run: `quarto run --dev tools/codemod-deno-ral.ts --rules fs,temp --dir src/execute --dir src/publish --dir src/tools --dir src/extension --dir src/preview --dir src/inspect --dir src/render | tail -1` Expected: `Summary: 172 files scanned, 35 rewritten, 122 replacements, 1 with collisions, 0 skipped`.

- [x] **Step 2: Format and type-check**

Run: `git diff --shortstat`, then `git diff --name-only -- src/execute src/publish src/tools src/extension src/preview src/inspect src/render | rg -v '^src/(execute/ojs/annotate-source|publish/confluence/confluence|tools/impl/chrome-for-testing|tools/impl/chrome-headless-shell|tools/impl/tinytex)\.ts$' | xargs package/dist/bin/tools/x86_64/deno fmt`, then `git diff --shortstat` again. Expected: 30 files formatted; the five left out are unformatted on `main` (README row for this step), so formatting them would add hunks unrelated to the codemod. `git diff --name-only` still lists exactly 35 files, all under the seven directories, and each file's diff holds only its import line and the `Deno.x` → `x` rewrites (wrap a rewritten call by hand only when it exceeds the line width).

Run: `cd src && ../package/dist/bin/tools/x86_64/deno check --allow-import --unstable-kv --unstable-ffi --import-map=import_map.json quarto.ts` Expected: no errors.

- [x] **Step 3: Commit**

```bash
git status --short -- src/execute src/publish src/tools src/extension src/preview src/inspect src/render   # only the 35 modified files, no untracked file
git diff --name-only -- src/execute src/publish src/tools src/extension src/preview src/inspect src/render | xargs git add --
git commit -m "execute/publish/tools/extension/preview/inspect/render: codemod Deno fs/temp calls to deno_ral (mechanical)"
```

### Task 3: Hand fixes

**Files:**
- Modify: `src/tools/impl/tinytex.ts`

- [x] **Step 1: `src/tools/impl/tinytex.ts`**

Add `realPath as fsRealPath` to the file's `../../deno_ral/fs.ts` import (the codemod created or extended it for `writeTextFileSync`/`readTextFileSync`/… in the same file) and change the `const realPath = await Deno.realPath(texLivePath);` line (738 on `2d133a903`; the codemod's import line moves it):

```ts
    const realPath = await fsRealPath(texLivePath);
```

- [x] **Step 2: Verify and commit**

Run: `rg -n 'Deno\.realPath\b' src/tools -g '*.ts'` Expected: empty.
(`Deno.openSync` still appears in the `bundle.ts:106` comment; PR 25 removes it.)

Run: `cd src && ../package/dist/bin/tools/x86_64/deno check --allow-import --unstable-kv --unstable-ffi --import-map=import_map.json quarto.ts` Expected: no errors.

```bash
git add src/tools/impl/tinytex.ts
git commit -m "tools: resolve realPath collision in tinytex.ts"
```

### Task 4: Tests, docs, ratchet, commit

- [ ] **Step 1: Unit tests that exercise the seven directories**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent $(find unit/tools/ -name '*.test.ts') $(find unit/extension/ -name '*.test.ts') $(find unit/jupyter/ -name '*.test.ts') $(find unit/confluence/ -name '*.test.ts') $(find unit/project/ -name '*.test.ts') unit/preview-compatibility.test.ts unit/preview-brand-cache.test.ts unit/preview-external-links.test.ts unit/preview-initial-path.test.ts unit/preview-subdir-knitr-cwd.test.ts unit/exec-process-stdin.test.ts unit/render-shared-output-dir.test.ts` Expected: `0 failed` (`unit/tools/` holds `chrome-for-testing`, `chrome-headless-shell` and `tinytex` tests; `unit/project/` exercises `src/render/notebook` through the project context).

- [ ] **Step 2: Smoke tests across engines, extensions, preview, tools**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent $(find smoke/engine/ -name '*.test.ts') $(find smoke/jupyter/ -name '*.test.ts') $(find smoke/extensions/ -name '*.test.ts') $(find smoke/ojs/ -name '*.test.ts') $(find smoke/embed/ -name '*.test.ts') $(find smoke/env/ -name '*.test.ts') $(find smoke/run/ -name '*.test.ts') smoke/check/check.test.ts smoke/inspect/inspect-extensions.test.ts smoke/render/render-jupyter.test.ts smoke/render/render-r.test.ts smoke/render/render-ojs.test.ts smoke/render/render-verapdf.test.ts` Expected: `0 failed` (Jupyter/R/veraPDF tests skip when their prerequisites are missing; note any skip in the PR).
Publishing code has no smoke tests (network); `unit/confluence/` is its unit coverage.

- [ ] **Step 3: Document the exclusions**

In `.claude/rules/typescript/deno-ral.md`, under the "Moving code off `Deno.*`" subsection added by PR 09, append:

```
Standalone scripts that run without the import map cannot import `deno_ral` and keep their `Deno.*` calls until the PR that owns them: `src/resources/scripts/*.ts` and `src/resources/create/**/*.ejs.ts` (PR 35), `src/resources/tools/ast-diagram/main.ts` (allow-listed by PR 25, ported by PR 35), `src/webui/quarto-preview/build.ts` (allow-listed until PR 33), and the `src/resources/extension-subtrees/` git subtrees (upstream). The codemod skips all of them.
```

- [ ] **Step 4: Changelog entry for sorted directory listings**

This PR moves extension discovery onto the sorted `readDir`/`readDirSync` of `src/deno_ral/fs.ts`, the last of the listings that #15286 dropped from the changelog as premature (README row "PRs 13 and 14, what PRs 10–12 found", item 5).
Run: `rg -n 'Deno\.readDir' src/extension/extension.ts src/command/capabilities/capabilities.ts src/command/use/commands/brand.ts src/format/html/format-html-shared.ts src/project/types/manuscript/manuscript-meca.ts` Expected: nothing (each listing named below reads through the layer).
The `rg` cannot see indirect reads: `walkSync`/`walk` are std's unsorted walker re-exported by `src/deno_ral/fs.ts`, so listings built on them stay out of the entry (the MECA source items gathered by `walkSync` outside a Git repository, `manuscript-meca.ts:177`; the extension file lists of `extension.ts:515,528`, which do not decide discovery).
In `news/changelog-1.12.md`, append to the end of `## Other fixes and improvements` (the maintainer replaces `N` with this PR's number and moves the entry to its ascending position):

```markdown
- ([#N](https://github.com/quarto-dev/quarto-cli/pull/N)): Directories are now read in a fixed order (sorted by name in character-code order, not by locale) on every platform.
  Extension discovery, the theme list of `quarto capabilities`, the brand extension that `quarto use brand` picks, the order of the bslib component SCSS files, and the manifest entries for the files of a supporting directory in a MECA bundle no longer depend on the file system's listing order; when two extensions share an id, which one wins can differ from earlier versions.
```

- [ ] **Step 5: Ratchet**

Run: `quarto run --dev tools/check-runtime-boundary.ts --update-baseline && quarto run --dev tools/check-runtime-boundary.ts` Expected: passes; `git diff tools/runtime-boundary-baseline.json` shows the `src` count lower by exactly 123 (507 → 384 on `f23c186c8`) and no increase in any scope.

- [ ] **Step 6: Commit**

```bash
git add tools/runtime-boundary-baseline.json .claude/rules/typescript/deno-ral.md news/changelog-1.12.md
git commit -m "Lower runtime boundary baseline after remaining fs/temp codemod; document excluded scripts and sorted directory order"
```

## Verification

- Task 4 steps 1–2 → `0 failed`.
- `quarto run --dev tools/check-runtime-boundary.ts` → passes at the new baseline.
- The AST dry run and the `rg` in Acceptance criteria → as stated.
- `cd src && ../package/dist/bin/tools/x86_64/deno check --allow-import --unstable-kv --unstable-ffi --import-map=import_map.json quarto.ts` → exit 0.
- Manual: `package/dist/bin/quarto tools list` (tools code: reads/writes through the layer); with network, `q="$PWD/package/dist/bin/quarto"; (cd "$(mktemp -d)" && "$q" add quarto-ext/lightbox --no-prompt && "$q" list extensions 2>&1 | grep -F quarto-ext/lightbox)` (extension install + discovery through sorted `readDirSync`; the subshell keeps the checkout root as the working directory) → both succeed and the listing shows `quarto-ext/lightbox`; `package/dist/bin/quarto preview tests/docs/test.qmd --no-browser` serves and exits on Ctrl-C.

## Review checklist

- [ ] `git diff` under the seven directories contains only `Deno.x` → `x` rewrites, import lines and the `fsRealPath` alias; no comment line changed.
- [ ] `account.ts:100` `chmod` is still fire-and-forget (unchanged semantics).
- [ ] `bundle.ts` still pipes `src.readable` through `CompressionStream` into `dest.writable`.
- [ ] No file under `src/resources`, `src/webui` or the subtree changed.
- [ ] The rules doc lists the excluded scripts; the baseline only decreased.
- [ ] The changelog entry names only listings that read through the sorted `deno_ral` helpers.

## Risks and rollback

- Extension discovery order is now sorted; a project with two extensions of the same id in different directories may resolve to a different one than before, and `quarto list extensions` lists rows in discovery order with the entries of each scanned directory sorted by name, where the filesystem enumerated them otherwise.
  No supported configuration relies on that (ids are expected to be unique); `tests/smoke/extensions/` passes.
- `src/tools/impl/verapdf.ts` and `chrome-headless-shell.ts` scan extracted archives; sorted order does not change which file they find (they search by name pattern).
- `deno fmt` may reflow unrelated lines; revert unrelated hunks if a diff becomes hard to review.
- Rollback: `git revert` the three commits; the layer stays.

## Decisions needed

None.
(The exclusion list is a statement of fact about scripts that run without the import map, not a choice; PR 25 records `ast-diagram/main.ts` and `quarto-preview/build.ts` in the ratchet allow-list, PRs 33 and 35 port them.)
Review items closed here: counts (35 files / 122 replacements), the comment-matching grep (AST dry run plus filtered `rg`, including the trailing comment at `extract-resources.ts:561`), the `realPath` collision, the contradiction with PR 25 on the two standalone scripts, landing order and the reset-and-re-run protocol.

## Execution log

### Step 0 — coordinator preflight at `2d133a903`

- Prerequisites: README marks PRs 02, 09, 10 and 11 merged; the layer (`fs.ts`, `temp.ts`, `errors.ts`), the codemod and the ratchet are on this base. PRs 08 and 22 have not landed, as the dated landing order (2026-11-17) allows; the header, landing-order paragraph and Plan intro are corrected. PR 12 (#15426) is open on disjoint directories; it and this PR share only `tools/runtime-boundary-baseline.json` and README rows, so whichever merges second rebases and regenerates the baseline.
- Citation audit (`git grep` on `2d133a903`, compared with `b86f98d`): same at `bundle.ts:106,114-115`, `extract-resources.ts:561`, `account.ts:100`, `verapdf.ts:208,212`, `chrome-headless-shell.ts:94,122,128`, `extension.ts:296,477`, `install.ts:289`, `gh-pages.ts:219`, `jupyter-kernel.ts:275`, `rmd.ts:450`, `preview-text.ts:170`, `chrome-for-testing.ts:248`, `make-ast-diagram/cmd.ts:29`, `previewjs.ts:14`, `check-usage.ts:1`. Moved: `tinytex.ts:662` → 738, `tools.ts:139,207,235` → 145,213,242, `tools.ts:387,413` → 397,423, `extension.ts:683` → 685 (README PR 13 audit row). None gone. Task 3 now names the `realPath` statement instead of a line number, since the codemod's import line shifts it.
- Dry run (Windows, Deno 2.9.8): `package/dist/bin/quarto.cmd run --dev tools/codemod-deno-ral.ts --rules fs,temp --dir src/execute --dir src/publish --dir src/tools --dir src/extension --dir src/preview --dir src/inspect --dir src/render --dry-run` printed `Summary: 172 files scanned, 35 would be rewritten, 122 replacements, 1 with collisions, 0 skipped` and the single collision `src/tools/impl/tinytex.ts:738: collision: local binding 'realPath' conflicts with deno_ral/fs.ts; left as Deno.*`. Targets: `readTextFileSync` 32, `writeTextFileSync` 22, `statSync` 21, `readDirSync` 7, `remove` 6, `readFileSync` 5, `makeTempDirSync` 5, `readTextFile` 4, `readFile` 3, `makeTempFileSync` 3, `copyFileSync` 3, `readDir` 2, `open` 2, and one each of `writeTextFile`, `writeFileSync`, `symlink`, `renameSync`, `lstat`, `chmodSync`, `chmod`. `git status --short src` printed nothing. `check-runtime-boundary.ts` printed `src 670 (baseline 670)` and `OK`; the expected drop is 122 + 1 = 123 (670 → 547 if the base does not move, 507 → 384 after PR 12).
- Type check on the untouched base: `deno.exe check --allow-import --unstable-kv --unstable-ffi --import-map=import_map.json quarto.ts` from `src` exits 0. The three `deno check` commands gain `--allow-import` (README row "Any plan that type-checks `src/quarto.ts`").
- Formatting: `deno fmt --check` on each of the 35 files at base reports 5 already unformatted: `src/execute/ojs/annotate-source.ts`, `src/publish/confluence/confluence.ts`, `src/tools/impl/chrome-for-testing.ts`, `src/tools/impl/chrome-headless-shell.ts` and `src/tools/impl/tinytex.ts`. Task 2 Step 2's whole-file `deno fmt` would add unrelated hunks to them, and Task 2 Step 3 stages seven directories; the README rows for PR 13 Task 2 Steps 2 and 3 amend both, and the plan carries the corrected commands in those steps (review of the step 0 commit). The same review tightened Task 1 Step 2's grep to the `collision:`/`skipped:` markers (the `Summary:` line matched the old pattern), ran the manual `quarto add` check in a subshell with a `grep` for `quarto-ext/lightbox`, documented the `quarto list extensions` row-order change, and corrected README row 13's directory list.
- Code-block audit: `rg -n 'function \w+'` prints nothing; the indirect-`Deno` and `PR [0-9]` code-comment greps hit only prose. Other corrections: the report path moved from `/tmp` to `.claude/docs/codemod-rest.txt`; the conflict protocol uses `upstream/main` (README row from PR 12's review); `bundle.ts:106-108` leaves "Modify (hand)" and the manual `quarto add` check calls the dev build by absolute path (README PR 13 audit row).
- Tests: every file named in Task 4 and `tests/docs/test.qmd` exist; the `find` directories hold 4 (`unit/tools`), 1 (`unit/extension`), 1 (`unit/jupyter`), 1 (`unit/confluence`), 8 (`unit/project`), 3 (`smoke/engine`), 4 (`smoke/jupyter`), 7 (`smoke/extensions`), 3 (`smoke/ojs`), 2 (`smoke/embed`), 2 (`smoke/env`) and 3 (`smoke/run`) test files. The `.cmd` launcher and PowerShell `run-tests.ps1` forms replace the POSIX ones at execution time.
- Gate inputs: the only `Plan defect`/`Plan gap` bead that applies is the `--allow-import` one, already a README row; the Windows review rates this plan "Conventions" with E05 only (the `cd` path, covered); 8 commits touched the seven directories since `b86f98d`, all covered by the citation audit and the unchanged counts.

### Task 1: Dry run and review

- Step 1 (Windows): `mkdir -p .claude/docs && package/dist/bin/quarto.cmd run --dev tools/codemod-deno-ral.ts --rules fs,temp --dir src/execute --dir src/publish --dir src/tools --dir src/extension --dir src/preview --dir src/inspect --dir src/render --dry-run > .claude/docs/codemod-rest.txt` retained the report at `.claude/docs/codemod-rest.txt`. `tail -1 .claude/docs/codemod-rest.txt` printed `Summary: 172 files scanned, 35 would be rewritten, 122 replacements, 1 with collisions, 0 skipped`; `git status --short src` printed nothing.
- Step 2: `grep -E 'skipped:|collision:' .claude/docs/codemod-rest.txt` printed exactly `src/tools/impl/tinytex.ts:738: collision: local binding 'realPath' conflicts with deno_ral/fs.ts; left as Deno.*`. `grep '→' .claude/docs/codemod-rest.txt | awk -F'→' '{print $2}' | sort | uniq -c | sort -rn` printed only fs/temp targets: `readTextFileSync` 32, `writeTextFileSync` 22, `statSync` 21, `readDirSync` 7, `remove` 6, `readFileSync` 5, `makeTempDirSync` 5, `readTextFile` 4, `readFile` 3, `makeTempFileSync` 3, `copyFileSync` 3, `readDir` 2, `open` 2, and one each of `writeTextFile`, `writeFileSync`, `symlink`, `renameSync`, `lstat`, `chmodSync`, `chmod`.
- Step 3: `grep -c 'src/resources\|src/webui' .claude/docs/codemod-rest.txt` printed `0` and exited 1 because there were no matches, as expected.
- Deviations: the Windows `.cmd` dev launcher was used; otherwise none. Tasks 2–4 remain unexecuted.

### Base refresh — rebase onto `f23c186c8` after PR 12

The records above were taken on `2d133a903`, before PR 12 (#15426) merged; they stay as written.
The branch was rebased once onto `upstream/main` at `f23c186c8` ("Reconcile runtime migration docs with main after PRs 10-12"), which includes PR 12 (`330120538`) and its closeout (`75452bd80`).
PR 12 changed only `src/project` and `src/format`, so no file under this PR's seven directories conflicted.

- Rebase conflicts: two, both in README "Open decisions with an owner". Kept `main`'s "PR 13 (audit of 2026-11-16)" row (counts held on `1d80652`, re-read from the dry run) and its new "PRs 13 and 14, what PRs 10–12 found" row, and kept this branch's "PR 13 Task 2 Step 2" and "Task 2 Step 3" rows as last corrected on the branch. Every other branch commit applied without conflict.
- Dry run (Windows, Deno 2.9.8, same command as Task 1 Step 1, report rewritten to `.claude/docs/codemod-rest.txt`): `Summary: 172 files scanned, 35 would be rewritten, 122 replacements, 1 with collisions, 0 skipped`. `grep -E 'skipped:|collision:'` printed only `src/tools/impl/tinytex.ts:738: collision: local binding 'realPath' conflicts with deno_ral/fs.ts; left as Deno.*`. The targets are the same as Task 1 Step 2's list, count for count. `grep -c 'src/resources\|src/webui'` printed `0`; `git status --short src` printed nothing. Task 1 stays ticked.
- Ratchet on the clean base: `package/dist/bin/quarto.cmd run --dev tools/check-runtime-boundary.ts` printed `src 507 (baseline 507)` and `OK: no count exceeds the baseline.` The expected Task 4 result is `src` 507 → 384 (122 codemod replacements + the `tinytex.ts` collision site = 123).
- Type check on the clean base: `deno.exe check --allow-import --unstable-kv --unstable-ffi --import-map=import_map.json quarto.ts` from `src` exits 0.
- "PRs 13 and 14, what PRs 10–12 found": items (1)–(3) are already in this plan (report path, the five unformatted files left out of `deno fmt`, staging by path). Item (4), the "Pending checks" list, belongs to the PR description at wrap-up. Item (5), the changelog entry for sorted directory listings that PR 13 owes, is Task 4 Step 4, added in review of this refresh; its five call sites were checked on this base (`capabilities.ts:76`, `brand.ts:97`, `format-html-shared.ts:164`, `manuscript-meca.ts:431` import the sorted helpers, and `extension.ts` does after Task 2).

### Task 2: Apply the codemod

- Steps 1–2, restored diff: the 35 files already carried the earlier session's codemod and scoped-format output after the rebase, so neither the codemod nor the formatter was run again. The Step 1 `Summary:` line was not captured for this diff. `git diff --shortstat` printed `35 files changed, 254 insertions(+), 145 deletions(-)` before and after validation. `git diff --name-only -- src/execute src/publish src/tools src/extension src/preview src/inspect src/render > .claude/docs/pr13-task2-current-paths.txt && cmp .claude/docs/pr13-task2-current-paths.txt .claude/docs/pr13-task2-paths.txt` was silent, confirming the exact 35-path list. `git diff --binary -- src/execute src/publish src/tools src/extension src/preview src/inspect src/render | cmp - .claude/docs/pr13-task2-pre-rebase.patch` was also silent, confirming a byte-identical restored diff.
- Step 2, diff review: filtering the five already-unformatted paths out of `git diff --name-only` left 30 files. `git diff --unified=0` over all seven directories showed only import changes, `Deno.x` → `x` rewrites and line wrapping of rewritten calls; the same command over `src/execute/ojs/annotate-source.ts`, `src/publish/confluence/confluence.ts`, `src/tools/impl/chrome-for-testing.ts`, `src/tools/impl/chrome-headless-shell.ts` and `src/tools/impl/tinytex.ts` confirmed no extra formatting in those five files. The changed-comment grep printed nothing, `git diff --check` passed, and `git diff --name-only -- src/resources src/webui` printed nothing. `account.ts` keeps `chmod(tokensPath, 0o600)` un-awaited and `bundle.ts` keeps its stream pipeline. `tinytex.ts:738` still has `const realPath = await Deno.realPath(texLivePath);`, as expected before Task 3.
- Step 2, type check: `cd src && ../package/dist/bin/tools/x86_64/deno.exe check --allow-import --unstable-kv --unstable-ffi --import-map=import_map.json quarto.ts` exited 0 with no output.
- Additional restored-state check: `package/dist/bin/quarto.cmd run --dev tools/check-runtime-boundary.ts` printed `src 385 (baseline 507)` and `OK: no count exceeds the baseline.` The one remaining count is the `tinytex.ts` collision owned by Task 3; the baseline update remains Task 4 Step 5.
- Step 3: `git status --short -- src/execute src/publish src/tools src/extension src/preview src/inspect src/render` showed only the 35 modified files and no untracked files. The source files were staged by the plan's `git diff --name-only … | xargs git add --` command; the plan update was staged by its explicit path. Deviations: validation replaced Steps 1–2 as directed for the restored diff, and the Windows `.cmd`/`.exe` launchers were used. Tasks 3–4 remain unexecuted.

### Task 3: Hand fixes

- Step 1: Added `realPath as fsRealPath` to the existing `../../deno_ral/fs.ts` import in `src/tools/impl/tinytex.ts` and changed the collision site to `const realPath = await fsRealPath(texLivePath);`. `git diff --shortstat -- src/tools/impl/tinytex.ts` printed `1 file changed, 2 insertions(+), 2 deletions(-)`; `git diff --check -- src/tools/impl/tinytex.ts` passed. The diff contains only the alias import and the `Deno.realPath` rewrite. The file was not formatted, as the README row for Task 3 Step 1 directs.
- Step 2: `rg -n 'Deno\.realPath\b' src/tools -g '*.ts'` printed nothing and exited 1 because there were no matches, as expected. `cd src && ../package/dist/bin/tools/x86_64/deno.exe check --allow-import --unstable-kv --unstable-ffi --import-map=import_map.json quarto.ts` printed `Check quarto.ts` and exited 0 with no errors.
- Deviations: the Windows `.exe` Deno launcher was used; otherwise none. Task 4 remains unexecuted.
