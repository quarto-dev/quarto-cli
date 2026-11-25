# PR 12: Run the fs/temp codemod on `src/project` and `src/format`

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move every plain filesystem and temp-file call in `src/project` and `src/format` from `Deno.*` to `src/deno_ral/fs.ts` / `src/deno_ral/temp.ts` with the codemod, and replace the four `Deno.errors.*` uses in `src/project` (three `instanceof` checks and one type alias) with the `deno_ral/errors.ts` predicates.
**Phase:** 1.
**Depends on:** PR 09 (layer + codemod), PR 02 (ratchet); lands before PR 08 and PR 22 (README, decided 2026-11-17).
**Unblocks:** PR 14 (the env codemod runs after the fs codemods), PR 25.
**Branch:** `rt/12-codemod-fs-project-format`.
**Suggested executor:** Sonnet.
Mechanical codemod; three small hand edits with the exact code given below; the only judgement is reading the diff and checking the order-sensitive `readDirSync` loop in MECA bundling.
**Size:** L by file count, mechanical: 51 files rewritten by the codemod (159 replacements, measured by a dry run on `2d133a903`; 38 files in `src/project` and 17 in `src/format` use `Deno.*`); 2 edited by hand.
**Ships on:** Deno; the existing test suite must stay green.

## Spec

### Context

Third of the four codemod PRs (assessment section 11, order of work step 3; PR 09 ships the tool).
`src/project` holds project types (website, book, manuscript, …), serve and the project context; `src/format` holds the output format handlers.
Both are almost pure filesystem users: 95 of 109 sites in `src/project` and 63 of 66 in `src/format` are fs calls.

Measured on `main` at `b86f98d` (2026-10-15) with `grep -rhoE '\bDeno\.[A-Za-z_]+(\.[A-Za-z_]+)?' <dir> --include=*.ts | sort | uniq -c | sort -rn`:

`src/project` (109 sites in 38 files):

| API | Sites | Handled by |
|---|---|---|
| `Deno.readTextFileSync` | 33 | this PR (fs) |
| `Deno.writeTextFileSync` | 25 | this PR (fs) |
| `Deno.statSync` | 25 | this PR (fs) |
| `Deno.open` | 4 | this PR (fs `open`) |
| `Deno.errors.PermissionDenied` | 3 | this PR (`isPermissionDenied`; one is a type alias) |
| `Deno.env.get` / `.set` | 3 / 2 | PR 14 |
| `Deno.copyFileSync` | 3 | this PR |
| `Deno.renameSync`, `Deno.removeSync`, `Deno.readFileSync`, `Deno.readFile`, `Deno.readDirSync`, `Deno.makeTempDirSync` | 1 each | this PR (`makeTempDirSync`: temp rule) |
| `Deno.errors.NotFound` | 1 | this PR (`isNotFound`) |
| `Deno.pid`, `Deno.kill`, `Deno.cwd` | 1 each | PR 08 |
| `Deno.FsEvent` | 1 | PR 17 |

`src/format` (66 sites in 17 files):

| API | Sites | Handled by |
|---|---|---|
| `Deno.readTextFileSync` | 31 | this PR |
| `Deno.writeTextFileSync` | 17 | this PR |
| `Deno.statSync`, `Deno.copyFileSync`, `Deno.cwd` | 3 each | this PR, this PR, PR 08 |
| `Deno.writeTextFile`, `Deno.readTextFile`, `Deno.open` | 2 each | this PR |
| `Deno.renameSync`, `Deno.readFileSync`, `Deno.readDirSync` | 1 each | this PR |

This PR rewrites 159 sites with the codemod (the grep tables above count 159 on `b86f98d` including the commented-out `Deno.writeTextFileSync` at `src/project/types/book/book-render.ts:619`, which is text, not code; `src/project/project-shared.ts` gained one `Deno.readTextFileSync` in #15101) plus 4 `Deno.errors` sites by hand: the `src` ratchet count drops by exactly 163.
The comment at `book-render.ts:619` stays for PR 25.

Files that need attention beyond the codemod (verified):

| File | Why |
|---|---|
| `src/project/project-context.ts:733,1160` | `e instanceof Deno.errors.PermissionDenied` → `isPermissionDenied(e)`. |
| `src/project/project-context.ts:1055` | `type InputWalkError = Deno.errors.PermissionDenied & { [kInputWalkProject]?: … }` is a *type* position the codemod does not touch; it becomes `Error & { … }` (the symbol-keyed field is what matters; `frameInputWalkError` and the tests in `tests/unit/project/project-context-unreadable-dir.test.ts` read it through `isPermissionDenied`/`assertInstanceOf(e, Error)`). |
| `src/project/project-index.ts:250` | `e instanceof Deno.errors.NotFound` → `isNotFound(e)`. |
| `src/project/types/manuscript/manuscript-config.ts:88`, `manuscript.ts:704` | `await Deno.open(file)` then `readLines(reader)` from `deno_ral/io.ts` (`@std/io` `readLines` takes a `Reader`, i.e. anything with `read(p)`; the layer's `FsFile` has it). Codemod rewrites to `open`; review only. |
| `src/project/types/website/website-sitemap.ts:170` | `await Deno.open(sitemapPath)` handed to `xmlp`'s `SAXParser.parse(reader)` (a `Reader`) then `reader.close()`. Codemod; review only. (PR 04 replaces `xmlp`.) |
| `src/project/types/website/listing/website-listing-feed.ts:532` | `await Deno.open(path, { write: true, create: true })` then writes with `feedFile.write(...)`. Codemod; review only. |
| `src/format/jats/format-jats-postprocess.ts:79`, `src/format/pdf/format-pdf.ts:494` | `await Deno.open(...)` + `readLines` imported directly from `io/read-lines` (PR 22 routes that through the layer); same `Reader` compatibility. Codemod; review only. |
| `src/project/types/manuscript/manuscript-meca.ts:427` | `for (const subPath of Deno.readDirSync(path))` builds the MECA `items` list recursively; the order now is sorted by name per directory. `tests/smoke/manuscript/render-manuscript.test.ts` and `tests/smoke/jats/render-manuscript.test.ts` cover the MECA bundle; if a verifier compares item order, the sorted order is the intended one. |
| `src/format/html/format-html-shared.ts:163` | `Deno.readDirSync(bsLibDir)` concatenating bslib SCSS; PR 01 adds an explicit sort here; with the layer's sorted result both are consistent. Keep PR 01's sort (harmless) if it landed. |
| `src/project/serve/serve.ts` | `Deno.FsEvent` (PR 17), `Deno.pid`/`Deno.kill` (PR 08), `Deno.env` (PR 14): untouched here. |
| `src/project/types/website/website-llms.ts:340` | `Deno.makeTempDirSync()` → temp rule. Review only. |

### Scope

In: the codemod with `--rules fs,temp` on `src/project` and `src/format`; the three `Deno.errors` edits in `src/project`; `deno fmt` on changed files; baseline update.
Out: `Deno.env` (PR 14), `Deno.cwd`/`pid`/`kill` (PR 08), `Deno.FsEvent` (PR 17), any other directory.

### Landing order and conflict protocol

Phase 1 lands the filesystem codemods 10–13 first, then 14, then 08 and 22 (README, decided 2026-11-17).
PRs 10–13 cover disjoint directories, but PR 08, PR 22 and PR 14 edit the import blocks of many of the same files (34–38 files overlap), and the codemod inserts its import after the last import, the same anchor every one of them uses.
If `main` moves between the codemod run and the merge, conflicts in this PR are resolved mechanically, never by hand-merging a codemodded hunk:

1. `git rebase origin/main`; for every conflicted file under this PR's directories, `git checkout origin/main -- <file>` (reset the file to `main`).
2. Re-run the codemod on exactly those files: `quarto run --dev tools/codemod-deno-ral.ts --rules <this PR's rules> --file <file> [--file <file>...]`.
3. Re-apply this PR's hand edits for those files (each is listed with its exact code below), then `package/dist/bin/tools/x86_64/deno fmt <file>...`.
4. `git add` the files and `git rebase --continue`; run the type check and the dry run of Task 1 again (it must report `0 replacements` for the PR's directories once the hand edits are back).

This works because PR 09's collision detection is symbol-based and reuses existing alias imports: a re-run over a partly migrated file finishes it and does not report the layer's own imports as collisions.

### Interfaces

No new interfaces.
No alias imports are expected: the dry run (Task 1) must report zero collisions for these two directories (verified by grep: no local `remove`/`stat`/`open`/… bindings coexist with the corresponding `Deno.*` call in `src/project` or `src/format`; `src/project/project-shared.ts:483,615` and `src/inspect/inspect.ts:72` bind `const stat = Deno.statSync(...)`, which maps to `statSync`, not `stat`, so there is no clash).

### Files

- Modify (codemod): every `*.ts` under `src/project` and `src/format` that uses an fs/temp API (51 files)
- Modify (hand): `src/project/project-context.ts:652,967,1072`, `src/project/project-index.ts:250`
- Modify: `tools/runtime-boundary-baseline.json`

### Acceptance criteria

- AST check (comments never count): `quarto run --dev tools/codemod-deno-ral.ts --rules fs,temp --dir src/project --dir src/format --dry-run | tail -1` → `Summary: 123 files scanned, 0 would be rewritten, 0 replacements, 0 with collisions, 0 skipped`.
- Text check, comment lines excluded:

  ```bash
  rg -n '\bDeno\.(readTextFileSync|readTextFile|readFileSync|readFile|writeTextFileSync|writeTextFile|writeFileSync|writeFile|statSync|stat|lstatSync|lstat|mkdirSync|mkdir|removeSync|remove|renameSync|rename|copyFileSync|copyFile|readDirSync|readDir|symlinkSync|symlink|readLinkSync|realPath|realPathSync|chmodSync|chmod|utimeSync|truncateSync|open|openSync|create|makeTempDirSync|makeTempDir|makeTempFileSync|makeTempFile|FileInfo|DirEntry|MakeTempOptions|errors)\b' src/project src/format -g '*.ts' \
    | rg -v '^[^:]+:[0-9]+:\s*(//|/\*|\*)'
  ```
  prints nothing (`book-render.ts:619` is a `//` line and is filtered).
- `quarto run --dev tools/check-runtime-boundary.ts` passes, with the `src` scope count exactly 163 lower than before.
- `cd src && ../package/dist/bin/tools/x86_64/deno check --allow-import --unstable-kv --unstable-ffi --import-map=import_map.json quarto.ts` passes.
- The tests in Verification pass.

## Plan

Assumes PR 09 landed; PRs 10 and 11 are merged; PR 08 and PR 22 have not landed.
Independent of PRs 13 and 17.

### Task 1: Dry run and review

README ground rule 7 applies: this PR is generated from fresh `main` the day it is opened and merged the same day; the reviewer named in README "Roles" is booked for that day.
PRs 10–13 are independent (disjoint directories) but every one of them edits `tools/runtime-boundary-baseline.json` with an exact delta: open them one at a time, or rebase and regenerate the baseline (ground rule 8) before each merge; the expected delta of this plan is then read against the new `main`.


- [x] **Step 1: Dry run**

Run: `mkdir -p .claude/docs && quarto run --dev tools/codemod-deno-ral.ts --rules fs,temp --dir src/project --dir src/format --dry-run > .claude/docs/codemod-project-format.txt; tail -1 .claude/docs/codemod-project-format.txt` Expected: `Summary: 123 files scanned, 51 would be rewritten, 159 replacements, 0 with collisions, 0 skipped` (measured on `2d133a903`); `git status --short src` is empty.
The report is ignored by git and later steps read it from that path.

- [x] **Step 2: Review the report**

Run: `grep -E 'skipped|collision' .claude/docs/codemod-project-format.txt` Expected: only the summary line.
If a collision is reported, read that file and resolve it with an alias import (`import { x as fsX } from ".../deno_ral/fs.ts"`, replace the blocked `Deno.x(` with `fsX(`) before Task 2.

Run: `grep '→' .claude/docs/codemod-project-format.txt | awk -F'→' '{print $2}' | sort | uniq -c | sort -rn` Expected: only `fs`/`temp` rule targets; `open` appears 6 times (the file-handle sites listed above).

### Task 2: Apply the codemod

- [ ] **Step 1: Rewrite**

Run: `quarto run --dev tools/codemod-deno-ral.ts --rules fs,temp --dir src/project --dir src/format | tail -1` Expected: `Summary: 123 files scanned, 51 rewritten, 159 replacements, 0 with collisions, 0 skipped`.

- [ ] **Step 2: Format and type-check**

Run: `git diff --name-only | xargs package/dist/bin/tools/x86_64/deno fmt` Expected: `git diff --stat | tail -1` lists only files under `src/project` and `src/format`.

Run: `cd src && ../package/dist/bin/tools/x86_64/deno check --allow-import --unstable-kv --unstable-ffi --import-map=import_map.json quarto.ts` Expected: no errors.
If `readLines(reader)` or `parser.parse(reader)` reports that `FsFile` is not assignable to `Reader`, the layer's `FsFile.read` signature is wrong; fix it in `src/deno_ral/fs.ts` (it must be `read(p: Uint8Array): Promise<number | null>`) rather than casting at the call site.

- [ ] **Step 3: Review the six `open` sites**

Run: `git diff -U2 src/project/types/manuscript/manuscript-config.ts src/project/types/manuscript/manuscript.ts src/project/types/website/website-sitemap.ts src/project/types/website/listing/website-listing-feed.ts src/format/jats/format-jats-postprocess.ts src/format/pdf/format-pdf.ts | grep '^[-+]' | grep -v '^[-+][-+]'` Expected: each hunk is `Deno.open(` → `open(` plus an import line; every handle is still closed in the same `finally`/after the same loop as before.

- [ ] **Step 4: Commit**

```bash
git add src/project src/format
git commit -m "project/format: codemod Deno fs/temp calls to deno_ral (mechanical)"
```

### Task 3: `Deno.errors` → predicates in `src/project`

**Files:**
- Modify: `src/project/project-context.ts`, `src/project/project-index.ts`

- [ ] **Step 1: `src/project/project-context.ts`**

Add `import { isPermissionDenied } from "../deno_ral/errors.ts";`.
Lines 733 and 1160:

```ts
      if (isPermissionDenied(e)) {
```

Lines 1055-1057:

```ts
type InputWalkError = Error & {
  [kInputWalkProject]?: { dir: string; configFile?: string | null };
};
```

- [ ] **Step 2: `src/project/project-index.ts`**

Add `import { isNotFound } from "../deno_ral/errors.ts";`.
Line 250: `if (isNotFound(e)) {`.

- [ ] **Step 3: Verify and commit**

Run: `rg -n 'Deno\.errors' src/project src/format -g '*.ts'` Expected: empty.

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/project/project-context-unreadable-dir.test.ts unit/project/project-detect-denied-path.test.ts smoke/project/project-unreadable-dir.test.ts smoke/project/project-detect-denied-config.test.ts` Expected: `0 failed` (these are the tests for the PermissionDenied tagging; on a root Unix session they skip themselves via `canMakeUnreadableDir`).

```bash
git add src/project/project-context.ts src/project/project-index.ts
git commit -m "project: Deno.errors checks through deno_ral/errors predicates"
```

### Task 4: Tests, ratchet, commit

- [ ] **Step 1: Unit tests that exercise `src/project` and `src/format`**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent $(find unit/project/ -name '*.test.ts') unit/book-title-block-attr.test.ts unit/format-detection.test.ts unit/format-html-math.test.ts unit/giscus.test.ts unit/scrollable-regions.test.ts unit/preview-compatibility.test.ts unit/preview-initial-path.test.ts unit/render-shared-output-dir.test.ts unit/single-file-input-abs-12401.test.ts unit/typst-fonts.test.ts` Expected: `0 failed`.

- [ ] **Step 2: Smoke tests across project types and formats**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent $(find smoke/project/ -name '*.test.ts') $(find smoke/site/ -name '*.test.ts') $(find smoke/website/ -name '*.test.ts') $(find smoke/book/ -name '*.test.ts') $(find smoke/manuscript/ -name '*.test.ts') $(find smoke/jats/ -name '*.test.ts') $(find smoke/search/ -name '*.test.ts') $(find smoke/embed/ -name '*.test.ts') $(find smoke/scholar/ -name '*.test.ts') smoke/render/render-html.test.ts smoke/render/render-docx.test.ts smoke/render/render-reveal.test.ts smoke/render/render-pdf.test.ts smoke/render/render-latex-output.test.ts smoke/render/render-typst-package-staging.test.ts smoke/render/render-page-layout.test.ts smoke/render/render-title-block.test.ts` Expected: `0 failed` (PDF/LaTeX tests may skip without TinyTeX; note it in the PR).

- [ ] **Step 3: Ratchet**

Run: `quarto run --dev tools/check-runtime-boundary.ts --update-baseline && quarto run --dev tools/check-runtime-boundary.ts` Expected: passes; `git diff tools/runtime-boundary-baseline.json` shows the `src` count lower by exactly 163 and no increase in any scope.

- [ ] **Step 4: Commit**

```bash
git add tools/runtime-boundary-baseline.json
git commit -m "Lower runtime boundary baseline after project/format fs/temp codemod"
```

## Verification

- Task 3 step 3 and Task 4 steps 1–2 → `0 failed`.
- `quarto run --dev tools/check-runtime-boundary.ts` → passes at the new baseline.
- The AST dry run and the `rg` in Acceptance criteria → as stated.
- `cd src && ../package/dist/bin/tools/x86_64/deno check --allow-import --unstable-kv --unstable-ffi --import-map=import_map.json quarto.ts` → exit 0.
- Manual: `package/dist/bin/quarto render tests/docs/websites/search` (a website with listing/feed/sitemap; `_site/sitemap.xml` is written) and `package/dist/bin/quarto render tests/docs/manuscript/base` (the MECA bundle is written under its `_manuscript/` output); both complete without errors.
  Remove the generated output afterwards: run `git clean -ndx tests/docs/websites/search tests/docs/manuscript/base`, check that the list holds only generated output, then run it again with `-fdx`.

## Review checklist

- [ ] `git diff` under the two directories contains only `Deno.x` → `x` rewrites, import lines, the three `isPermissionDenied`/`isNotFound` edits and the `InputWalkError` type change.
- [ ] Every `open()` handle is still closed on every path it was closed on before.
- [ ] `InputWalkError`'s symbol-keyed field is unchanged; `frameInputWalkError` still compiles.
- [ ] The MECA item order change (sorted) is understood and the manuscript smoke tests pass.
- [ ] Baseline only decreased.

## Risks and rollback

- `manuscript-meca.ts` and `format-html-shared.ts` now iterate directories in sorted order; MECA manifests and the bslib SCSS concatenation become deterministic across filesystems, which can change byte order in generated outputs.
  Snapshot differences that are pure reordering are the intended determinism (PR 01 makes the same call for bslib).
- `InputWalkError` widens from `Deno.errors.PermissionDenied & …` to `Error & …`; the runtime checks use the predicate, so behaviour is unchanged; a type that previously narrowed on the Deno class would now narrow on `Error`.
- Rollback: `git revert` the three commits; the layer stays.

## Decisions needed

None.
Review items closed here: counts (51 files / 159 replacements), the comment-matching grep (`book-render.ts:619`; now AST dry run plus comment-filtered `rg`), zero predicted collisions confirmed, landing order and the reset-and-re-run protocol.

## Execution log

### Step 0 — coordinator preflight at `2d133a903`

- Prerequisites: README marks PRs 02, 09, 10 and 11 merged; the layer (`fs.ts`, `temp.ts`, `errors.ts`), the codemod and the ratchet are on this base. PRs 08 and 22 have not landed, as the dated landing order (2026-11-17) allows. The plan's "lands after PR 08 and PR 22" header, landing-order paragraph and Plan intro are corrected.
- Citation audit (`rg -n` in `src/project`, `src/format`, compared with `b86f98d`): the README's audit-row lines hold: `project-context.ts:733,1055,1160`, `website-listing-feed.ts:532`, `format-html-shared.ts:163`, `project-shared.ts:483,615`. Same at `project-index.ts:250`, `manuscript-config.ts:88`, `manuscript.ts:704`, `website-sitemap.ts:170`, `format-jats-postprocess.ts:79`, `format-pdf.ts:494`, `manuscript-meca.ts:427`, `website-llms.ts:340`, `book-render.ts:619` (a `//` line), `inspect.ts:72`. All six `Deno.open(` sites are present. `format-html-shared.ts:163` still iterates `Deno.readDirSync` directly because PR 01 has not landed.
- Dry run (Windows, Deno 2.9.8): `package/dist/bin/quarto.cmd run --dev tools/codemod-deno-ral.ts --rules fs,temp --dir src/project --dir src/format --dry-run` printed `Summary: 123 files scanned, 51 would be rewritten, 159 replacements, 0 with collisions, 0 skipped`; `git status --short src` printed nothing. `package/dist/bin/quarto.cmd run --dev tools/check-runtime-boundary.ts` printed `src 670 (baseline 670)` and `OK`. The expected drop is 159 + 4 = 163 (670 → 507 if the base does not move); Task 4 measures it.
- Type check on the untouched base: `deno.exe check --allow-import --unstable-kv --unstable-ffi --import-map=import_map.json quarto.ts` from `src` exits 0 with no `TS` errors.
- Layer prerequisites: `isNotFound` and `isPermissionDenied` (`errors.ts:54,62`), `open`/`openSync` (`fs.ts:501,505`), `FsFile.read(p: Uint8Array): Promise<number | null>` (`fs.ts:239`), `makeTempDirSync` (`temp.ts:58`) and the sorted `readDirSync` exist. `rg 'ReaderSync|readAllSync|readSync' src/project src/format` prints nothing, so the `FsFile` problem PR 10 hit in `console.ts` does not arise here.
- Formatting: `deno fmt --check` over the 51 files at base reports 3 already unformatted: `src/project/types/website/website-sitemap.ts`, `src/project/types/manuscript/manuscript.ts` and `src/format/reveal/format-reveal.ts`. Task 2 Step 2's whole-file `deno fmt` would add unrelated hunks to them; the README row for PR 12 Task 2 Step 2 amends it. Task 2 Step 4's `git add src/project src/format` stages directories; the same row set amends it to explicit paths.
- Code-block audit: `rg -n 'function \w+'` and the indirect-`Deno` grep print nothing in code blocks (the hits are prose); no PR-number code comment. Plan corrections: counts 158 → 159 and 162 → 163, moved lines, the report path moved from `/tmp` to `.claude/docs/codemod-project-format.txt`, `--allow-import` on the three `deno check` commands (README row), and `git clean -ndx` before the final `git clean -fdx` in Verification.
- Windows and tests: every test file named in Tasks 3 and 4 exists; `tests/docs/websites/search` and `tests/docs/manuscript/base` exist; the Task 4 `find` directories hold 8 (`unit/project`), 12 (`smoke/project`), 15 (`smoke/site`), 6 (`smoke/website`), 2 (`smoke/book`), 1 (`smoke/manuscript`), 2 (`smoke/jats`), 1 (`smoke/search`), 2 (`smoke/embed`) and 1 (`smoke/scholar`) test files. The `.cmd` launcher and PowerShell `run-tests.ps1` forms replace the POSIX ones at execution time.
- Gate inputs: no `Plan defect` or `Plan gap` bead names PR 12; 29 commits touched `src/project` or `src/format` since `b86f98d`, all covered by the citation audit.

### Task 1 — dry run and review

- Step 1: the plan's dry run used the worktree's Windows `.cmd` launcher (shown repository-relatively):

  ```bash
  mkdir -p .claude/docs && package/dist/bin/quarto.cmd run --dev tools/codemod-deno-ral.ts --rules fs,temp --dir src/project --dir src/format --dry-run > .claude/docs/codemod-project-format.txt && tail -1 .claude/docs/codemod-project-format.txt
  ```

  It printed the expected summary:

  ```text
  Summary: 123 files scanned, 51 would be rewritten, 159 replacements, 0 with collisions, 0 skipped
  ```

  `git status --short src` printed nothing, confirming that the dry run left `src` unchanged. The durable report is `.claude/docs/codemod-project-format.txt`; it is ignored and is not part of the task commit.
- Step 2: `grep -E 'skipped|collision' .claude/docs/codemod-project-format.txt` printed only the summary line quoted above. `grep '→' .claude/docs/codemod-project-format.txt | awk -F'→' '{print $2}' | sort | uniq -c | sort -rn` printed the complete replacement-name inventory:

  ```text
       65  readTextFileSync
       41  writeTextFileSync
       28  statSync
        6  open
        6  copyFileSync
        2  writeTextFile
        2  renameSync
        2  readTextFile
        2  readFileSync
        2  readDirSync
        1  removeSync
        1  readFile
        1  makeTempDirSync
  ```

  Every target is in the `fs` or `temp` rule table, and `open` appears exactly six times. No collision or skipped file requires a hand edit before Task 2. No codemod was applied and no source or baseline file changed.
- Deviations: only the prescribed Windows `.cmd` launcher adaptation. Outstanding: Tasks 2–4 and the final Verification remain for later sessions.
