# PR 11: Run the fs/temp codemod on `src/command`

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move every plain filesystem and temp-file call in `src/command` from `Deno.*` to `src/deno_ral/fs.ts` / `src/deno_ral/temp.ts` with the codemod, fix the one reported collision by hand, and replace the single `instanceof Deno.errors.NotFound` in `src/command` with `isNotFound`.
**Phase:** 1. **Depends on:** PR 09 (layer + codemod), PR 02 (ratchet); lands after PR 08 and PR 22 (landing order below). **Unblocks:** PR 25.
**Branch:** `rt/11-codemod-fs-command`.
**Suggested executor:** Sonnet. Mechanical codemod plus two small hand edits; the review is about reading the diff, not designing anything.
**Size:** L by file count, mechanical: 43 of the 59 `src/command` files that use `Deno.*` are rewritten by the codemod (149 replacements, fs and temp, measured by a dry run of PR 09's codemod logic on `b86f98d`); 2 edited by hand.
**Ships on:** Deno; the existing test suite must stay green.

## Spec

### Context

Second of the four codemod PRs (assessment section 11, order of work step 3; PR 09 ships the tool). `src/command` holds the CLI commands (`render/`, `preview/`, `create/`, `use/`, `call/`, `dev-call/`, `inspect/`, `check/`, …) and is the second-largest `Deno.*` user after `src/core`.

Measured on `main` at `b86f98d` (2026-10-15) with `grep -rhoE '\bDeno\.[A-Za-z_]+(\.[A-Za-z_]+)?' src/command --include=*.ts | sort | uniq -c | sort -rn` (266 sites in 59 files):

| API | Sites | Handled by |
|---|---|---|
| `Deno.writeTextFileSync` | 43 | this PR (fs) |
| `Deno.readTextFileSync` | 38 | this PR (fs) |
| `Deno.exit` | 32 | PR 08 |
| `Deno.env.get` / `.set` / `.delete` / `.toObject` | 31 / 5 / 1 / 1 | PR 14 |
| `Deno.cwd` | 28 | PR 08 |
| `Deno.statSync` | 21 | this PR |
| `Deno.readDirSync` | 14 | this PR (now sorted) |
| `Deno.copyFileSync` | 5 | this PR |
| `Deno.readFileSync` | 4 | this PR |
| `Deno.stdout.writeSync` | 3 | PR 08 |
| `Deno.renameSync`, `Deno.remove`, `Deno.mkdirSync`, `Deno.makeTempDirSync` | 3 each | this PR (`makeTempDirSync`: temp rule) |
| `Deno.writeTextFile`, `Deno.readDir`, `Deno.copyFile`, `Deno.removeSync` | 2 each | this PR |
| `Deno.stdin`, `Deno.serve` | 2 each | PR 08, PR 16 |
| `Deno.writeFile`, `Deno.stat`, `Deno.realPathSync` (comment in `call/axe/cmd.ts:184`), `Deno.readTextFile`, `Deno.readFile`, `Deno.lstat`, `Deno.chmodSync`, `Deno.errors.NotFound` | 1 each | this PR (the comment stays; it describes why `realPathSync` was not used) |
| `Deno.version.deno`, `Deno.stdout`, `Deno.stdin.close`, `Deno.listen`, `Deno.execPath`, `Deno.args`, `Deno.CommandOptions`, `Deno.Command` | 1 each | PR 19, PR 08, PR 08, PR 15, PR 08, PR 08, PR 08, PR 08 |

This PR rewrites 149 sites with the codemod (146 fs, 3 temp), 1 collision site and 1 `Deno.errors` site by hand: the `src` ratchet count drops by exactly 151. The comment at `call/axe/cmd.ts:184` (and the other comment lines PR 25 lists) stays.

Files that need attention beyond the codemod (verified):

| File | Why |
|---|---|
| `src/command/dev-call/pull-git-subtree/cmd.ts:91` | `const stat = await Deno.stat(prefixPath);` — the local `stat` binding collides with the layer's `stat`; the tool reports it and leaves the call. Fix with an alias import. |
| `src/command/render/pandoc.ts:1645-1648` | `await Deno.lstat(...)` (rewritten) followed by `if (!(err instanceof Deno.errors.NotFound))` → `isNotFound(err)`. |
| `src/command/capabilities/capabilities.ts:75` | `for await (const dirEntry of Deno.readDir(themesPath))` builds the `themes` array in `quarto capabilities` output; it becomes sorted. No test covers the order (grep for `capabilities` under `tests/` finds none); the manual check below prints it. |
| `src/command/call/build-ts-extension/cmd.ts:118` | `Deno.readDir(srcDir)` lists `.ts` entry files; order now sorted (was filesystem order). `tests/smoke/build-ts-extension/` covers the command. |
| `src/command/render/output-typst.ts:162,167`, `render/project.ts:660`, `render/freeze.ts:186,191,250`, `use/commands/template.ts:234,373`, `use/commands/brand.ts:86,96,555,682,701,706`, `extension`-like scans | `Deno.readDirSync` loops that copy, count or test for emptiness; order-independent. `brand.ts:706` spreads the result (`[...Deno.readDirSync(subdir)]`), which keeps working on an array. Review only. |
| `src/command/render/pandoc.ts:262` | `args: Deno.CommandOptions` — PR 08's concern (becomes `SpawnOptions`); not touched here. |
| `src/command/render/latexmk/quarto-latexmk.ts` | standalone `tinitex` entry, deleted by PR 39 (decision 9). It has no fs/temp call, so the codemod does not change it; its `Deno.args` is not this PR's (PR 08 leaves it for PR 39). |
| `src/command/serve/cmd.ts:88`, `src/command/preview/cmd.ts:315,334` | `tempDir: Deno.makeTempDirSync()` → `makeTempDirSync()` (temp rule). Review only. |

### Scope

In: the codemod with `--rules fs,temp` on `src/command`; the `pull-git-subtree` alias fix; `pandoc.ts:1648` predicate; `deno fmt` on changed files; baseline update.
Out: `Deno.exit`/`cwd`/`args`/`execPath`/stdio/`Command` (PR 08), `Deno.env` (PR 14), `Deno.serve`/`listen` (PR 15/16), `Deno.version` (PR 19), any directory other than `src/command`.

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
// src/command/dev-call/pull-git-subtree/cmd.ts
import { stat as fsStat } from "../../../deno_ral/fs.ts";
```

### Files

- Modify (codemod): every `*.ts` under `src/command` that uses an fs/temp API (43 files)
- Modify (hand): `src/command/dev-call/pull-git-subtree/cmd.ts:91`, `src/command/render/pandoc.ts:1648`
- Modify: `tools/runtime-boundary-baseline.json`

### Acceptance criteria

- AST check (comments never count): `quarto run --dev tools/codemod-deno-ral.ts --rules fs,temp --dir src/command --dry-run | tail -1` → `Summary: 107 files scanned, 0 would be rewritten, 0 replacements, 0 with collisions, 0 skipped`.
- Text check, comment lines excluded:

  ```bash
  rg -n '\bDeno\.(readTextFileSync|readTextFile|readFileSync|readFile|writeTextFileSync|writeTextFile|writeFileSync|writeFile|statSync|stat|lstatSync|lstat|mkdirSync|mkdir|removeSync|remove|renameSync|rename|copyFileSync|copyFile|readDirSync|readDir|symlinkSync|symlink|readLinkSync|realPath|realPathSync|chmodSync|chmod|utimeSync|truncateSync|open|openSync|create|makeTempDirSync|makeTempDir|makeTempFileSync|makeTempFile|FileInfo|DirEntry|MakeTempOptions|errors)\b' src/command -g '*.ts' \
    | rg -v '^[^:]+:[0-9]+:\s*(//|/\*|\*)'
  ```
  prints nothing (`call/axe/cmd.ts:184` is a JSDoc line and is filtered).
- `quarto run --dev tools/check-runtime-boundary.ts` passes, with the `src` scope count exactly 151 lower than before.
- `cd src && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --unstable-ffi --import-map=import_map.json quarto.ts` passes.
- The tests in Verification pass.

## Plan

Assumes PR 09 landed. In the prescribed order PR 08 and PR 22 have landed (`pandoc.ts` already imports from `deno_ral/process.ts`; that import is unrelated to the `deno_ral/fs.ts` one the codemod adds). Independent of PR 10, 12, 13.

### Task 1: Dry run and review

- [ ] **Step 1: Dry run**

Run: `quarto run --dev tools/codemod-deno-ral.ts --rules fs,temp --dir src/command --dry-run > /tmp/codemod-command.txt; tail -1 /tmp/codemod-command.txt`
Expected: `Summary: 107 files scanned, 43 would be rewritten, 149 replacements, 1 with collisions, 0 skipped` (measured on `b86f98d`); `git status --short src` is empty.

- [ ] **Step 2: Review the report**

Run: `grep -E 'skipped|collision' /tmp/codemod-command.txt`
Expected exactly:
```
src/command/dev-call/pull-git-subtree/cmd.ts:91: collision: local binding 'stat' conflicts with deno_ral/fs.ts; left as Deno.*
```
Any other collision line means a local name shadows a layer function; read that file and plan an alias import like Task 3 before continuing.

Run: `grep '→' /tmp/codemod-command.txt | awk -F'→' '{print $2}' | sort | uniq -c | sort -rn`
Expected: only names from the `fs`/`temp` rule tables (`writeTextFileSync`, `readTextFileSync`, `statSync`, `readDirSync`, …).

### Task 2: Apply the codemod

- [ ] **Step 1: Rewrite**

Run: `quarto run --dev tools/codemod-deno-ral.ts --rules fs,temp --dir src/command | tail -1`
Expected: `Summary: 107 files scanned, 43 rewritten, 149 replacements, 1 with collisions, 0 skipped`.

- [ ] **Step 2: Format and type-check**

Run: `git diff --name-only | xargs package/dist/bin/tools/x86_64/deno fmt`
Expected: `git diff --stat | tail -1` lists only files under `src/command`.

Run: `cd src && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --unstable-ffi --import-map=import_map.json quarto.ts`
Expected: no errors. A `FileInfo` member error would mean a caller reads a field the layer's `FileInfo` lacks (`src/command` reads `isFile`, `isDirectory`, `mtime`, `size`): stop and raise it on PR 09's vocabulary rather than casting.

- [ ] **Step 3: Commit**

```bash
git add src/command
git commit -m "command: codemod Deno fs/temp calls to deno_ral (mechanical)"
```

### Task 3: Fix the collision and the `Deno.errors` site by hand

**Files:**
- Modify: `src/command/dev-call/pull-git-subtree/cmd.ts`, `src/command/render/pandoc.ts`

- [ ] **Step 1: `src/command/dev-call/pull-git-subtree/cmd.ts`**

The file now imports nothing from `deno_ral/fs.ts` for `stat` (blocked). Add `import { stat as fsStat } from "../../../deno_ral/fs.ts";` (merge into the existing `deno_ral/fs.ts` import if the codemod created one for `existsSync`/other names) and change line 91:

```ts
    const stat = await fsStat(prefixPath);
```

- [ ] **Step 2: `src/command/render/pandoc.ts`**

Add `import { isNotFound } from "../../deno_ral/errors.ts";`. Replace line 1648:

```ts
          if (!isNotFound(err)) {
```

(Line 1645 is already `await lstat(join(font_cache, path));` after the codemod.)

- [ ] **Step 3: Verify and commit**

Run: `rg -n 'Deno\.errors|Deno\.stat\(' src/command -g '*.ts'`
Expected: empty.

Run: `cd src && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --unstable-ffi --import-map=import_map.json quarto.ts`
Expected: no errors.

```bash
git add src/command/dev-call/pull-git-subtree/cmd.ts src/command/render/pandoc.ts
git commit -m "command: resolve stat collision and use isNotFound in pandoc font cache"
```

### Task 4: Tests, ratchet, commit

- [ ] **Step 1: Unit tests that exercise `src/command`**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/render/ unit/latexmk/ unit/axe-config.test.ts unit/axe-artifacts.test.ts unit/axe-postrender.test.ts unit/axe-mode-discovery.test.ts unit/preview-compatibility.test.ts unit/preview-initial-path.test.ts unit/preview-external-links.test.ts unit/preview-subdir-knitr-cwd.test.ts unit/chrome-launch.test.ts unit/render-shared-output-dir.test.ts unit/single-file-input-abs-12401.test.ts unit/typst-fonts.test.ts unit/print-call-r-diagnostics.test.ts`
Expected: `0 failed`.

- [ ] **Step 2: Smoke tests for the commands whose files changed**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/render/render-html.test.ts smoke/render/render-freeze.test.ts smoke/render/render-docx.test.ts smoke/render/render-pdf.test.ts smoke/render/render-templates.test.ts smoke/render/render-output-dir.test.ts smoke/render/render-cli-metadata-file.test.ts smoke/create/ smoke/use/ smoke/use-brand/ smoke/inspect/ smoke/check/ smoke/build-ts-extension/ smoke/typst-gather/ smoke/crossref/figures.test.ts smoke/convert/ smoke/filters/editor-support.test.ts smoke/axe/axe-exit-codes.test.ts smoke/run/ smoke/project/project-simple.test.ts`
Expected: `0 failed`. (`render-pdf.test.ts` needs TinyTeX; if it is skipped for prerequisites, that is acceptable, note it in the PR.)

- [ ] **Step 3: Manual check of the one order-sensitive output**

Run: `package/dist/bin/quarto capabilities | python3 -c "import json,sys; t=json.load(sys.stdin)['themes']; print(t[:5], t[1:] == sorted(t[1:]))"`
Expected: `['default', 'cerulean', 'cosmo', 'cyborg', 'darkly'] True` (`"default"` is pushed first by `capabilities.ts:73`; the directory entries after it are now sorted).

- [ ] **Step 4: Ratchet**

Run: `quarto run --dev tools/check-runtime-boundary.ts --update-baseline && quarto run --dev tools/check-runtime-boundary.ts`
Expected: passes; `git diff tools/runtime-boundary-baseline.json` shows the `src` count lower by exactly 151 and no increase in any scope.

- [ ] **Step 5: Commit**

```bash
git add tools/runtime-boundary-baseline.json
git commit -m "Lower runtime boundary baseline after command fs/temp codemod"
```

## Verification

- Task 4 steps 1–2 → `0 failed`.
- `quarto run --dev tools/check-runtime-boundary.ts` → passes at the new baseline.
- The AST dry run and the `rg` in Acceptance criteria → as stated.
- `cd src && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --unstable-ffi --import-map=import_map.json quarto.ts` → exit 0.
- Manual: `package/dist/bin/quarto create project default /tmp/qc-$$ --no-prompt --no-open && package/dist/bin/quarto render /tmp/qc-$$ && package/dist/bin/quarto inspect /tmp/qc-$$ | head -3` → renders and prints JSON (create/render/inspect all write and read files through the layer now).

## Review checklist

- [ ] `git diff` under `src/command` contains, apart from the two hand-edited files, only `Deno.x` → `x` rewrites and import lines.
- [ ] `pull-git-subtree/cmd.ts` keeps its local `stat` variable; the call goes to `fsStat`.
- [ ] `pandoc.ts` keeps the `throw err` for non-NotFound errors in the font cache check.
- [ ] `brand.ts:706` spread still compiles (array).
- [ ] No file under `src/command` gained a `Deno.*` call; the baseline only decreased.

## Risks and rollback

- `quarto capabilities` lists themes in sorted order now; a consumer relying on filesystem order (none known: the VS Code extension sorts client-side) would see a different order.
- `build-ts-extension` now bundles entry files in sorted order; the bundle content is unchanged, only the discovery order in log output.
- `deno fmt` may reflow unrelated lines; revert unrelated hunks if a diff becomes hard to review.
- Rollback: `git revert` the three commits; the layer stays.

## Decisions needed

None. Review items closed here: counts (43 files / 149 replacements), the comment-matching grep (AST dry run plus comment-filtered `rg`), the predicted `stat` collision, landing order and the reset-and-re-run protocol. `quarto-latexmk.ts` is no longer described as a sidecar this PR keeps working (decision 9).
