# PR 12: Run the fs/temp codemod on `src/project` and `src/format`

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move every plain filesystem and temp-file call in `src/project` and `src/format` from `Deno.*` to `src/deno_ral/fs.ts` / `src/deno_ral/temp.ts` with the codemod, and replace the four `Deno.errors.*` uses in `src/project` (three `instanceof` checks and one type alias) with the `deno_ral/errors.ts` predicates.
**Phase:** 1. **Depends on:** PR 09 (layer + codemod), PR 02 (ratchet). **Unblocks:** PR 25.
**Branch:** `rt/12-codemod-fs-project-format`.
**Suggested executor:** Sonnet. Mechanical codemod; three small hand edits with the exact code given below; the only judgement is reading the diff and checking the order-sensitive `readDirSync` loop in MECA bundling.
**Size:** M. About 48 files rewritten mechanically (38 files in `src/project` and 17 in `src/format` use `Deno.*`); 2 edited by hand.
**Ships on:** Deno; the existing test suite must stay green.

## Spec

### Context

Third of the four codemod PRs (assessment section 11, order of work step 3; PR 09 ships the tool). `src/project` holds project types (website, book, manuscript, …), serve and the project context; `src/format` holds the output format handlers. Both are almost pure filesystem users: 95 of 109 sites in `src/project` and 63 of 66 in `src/format` are fs calls.

Measured on `main` at a4d0979 (2026-10-14) with `grep -rhoE '\bDeno\.[A-Za-z_]+(\.[A-Za-z_]+)?' <dir> --include=*.ts | sort | uniq -c | sort -rn`:

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

This PR rewrites 95 + 1 (temp) sites in `src/project` and 63 in `src/format`, plus 4 `Deno.errors`. Expected counts after the PR: `src/project` 109 − 100 = 9 (5 env, 3 process, 1 FsEvent), `src/format` 66 − 63 = 3 (cwd), each ±2 for comment mentions.

Files that need attention beyond the codemod (verified):

| File | Why |
|---|---|
| `src/project/project-context.ts:652,1072` | `e instanceof Deno.errors.PermissionDenied` → `isPermissionDenied(e)`. |
| `src/project/project-context.ts:967` | `type InputWalkError = Deno.errors.PermissionDenied & { [kInputWalkProject]?: … }` is a *type* position the codemod does not touch; it becomes `Error & { … }` (the symbol-keyed field is what matters; `frameInputWalkError` and the tests in `tests/unit/project/project-context-unreadable-dir.test.ts` read it through `isPermissionDenied`/`assertInstanceOf(e, Error)`). |
| `src/project/project-index.ts:250` | `e instanceof Deno.errors.NotFound` → `isNotFound(e)`. |
| `src/project/types/manuscript/manuscript-config.ts:88`, `manuscript.ts:704` | `await Deno.open(file)` then `readLines(reader)` from `deno_ral/io.ts` (`@std/io` `readLines` takes a `Reader`, i.e. anything with `read(p)`; the layer's `FsFile` has it). Codemod rewrites to `open`; review only. |
| `src/project/types/website/website-sitemap.ts:170` | `await Deno.open(sitemapPath)` handed to `xmlp`'s `SAXParser.parse(reader)` (a `Reader`) then `reader.close()`. Codemod; review only. (PR 04 replaces `xmlp`.) |
| `src/project/types/website/listing/website-listing-feed.ts:521` | `await Deno.open(path, { write: true, create: true })` then writes with `feedFile.write(...)`. Codemod; review only. |
| `src/format/jats/format-jats-postprocess.ts:79`, `src/format/pdf/format-pdf.ts:494` | `await Deno.open(...)` + `readLines` imported directly from `io/read-lines` (PR 22 routes that through the layer); same `Reader` compatibility. Codemod; review only. |
| `src/project/types/manuscript/manuscript-meca.ts:427` | `for (const subPath of Deno.readDirSync(path))` builds the MECA `items` list recursively; the order now is sorted by name per directory. `tests/smoke/manuscript/render-manuscript.test.ts` and `tests/smoke/jats/render-manuscript.test.ts` cover the MECA bundle; if a verifier compares item order, the sorted order is the intended one. |
| `src/format/html/format-html-shared.ts:133` | `Deno.readDirSync(bsLibDir)` concatenating bslib SCSS; PR 01 adds an explicit sort here; with the layer's sorted result both are consistent. Keep PR 01's sort (harmless) if it landed. |
| `src/project/serve/serve.ts` | `Deno.FsEvent` (PR 17), `Deno.pid`/`Deno.kill` (PR 08), `Deno.env` (PR 14): untouched here. |
| `src/project/types/website/website-llms.ts:340` | `Deno.makeTempDirSync()` → temp rule. Review only. |

### Scope

In: the codemod with `--rules fs,temp` on `src/project` and `src/format`; the three `Deno.errors` edits in `src/project`; `deno fmt` on changed files; baseline update.
Out: `Deno.env` (PR 14), `Deno.cwd`/`pid`/`kill` (PR 08), `Deno.FsEvent` (PR 17), any other directory.

### Interfaces

No new interfaces. No alias imports are expected: the dry run (Task 1) must report zero collisions for these two directories (verified by grep: no local `remove`/`stat`/`open`/… bindings coexist with the corresponding `Deno.*` call in `src/project` or `src/format`; `src/project/project-shared.ts:482,592` and `src/inspect/inspect.ts:72` bind `const stat = Deno.statSync(...)`, which maps to `statSync`, not `stat`, so there is no clash).

### Files

- Modify (codemod): every `*.ts` under `src/project` and `src/format` that uses an fs/temp API (about 48 files)
- Modify (hand): `src/project/project-context.ts:652,967,1072`, `src/project/project-index.ts:250`
- Modify: `tools/runtime-boundary-baseline.json`

### Acceptance criteria

- `grep -rnE '\bDeno\.(readTextFileSync|readTextFile|readFileSync|readFile|writeTextFileSync|writeTextFile|writeFileSync|writeFile|statSync|stat|lstatSync|lstat|mkdirSync|mkdir|removeSync|remove|renameSync|rename|copyFileSync|copyFile|readDirSync|readDir|symlinkSync|symlink|readLinkSync|realPath|chmodSync|chmod|utimeSync|truncateSync|open|openSync|create|makeTempDirSync|makeTempDir|makeTempFileSync|makeTempFile|FileInfo|DirEntry|MakeTempOptions|errors)\b' src/project src/format --include=*.ts` is empty.
- `quarto run --dev tools/check-runtime-boundary.ts` passes, with the `src` scope count about 163 lower than before (the baseline has one count per scope, PR 02); `grep -rhoE '\bDeno\.' src/project --include=*.ts | wc -l` ≤ 12 and the same for `src/format` ≤ 5.
- `cd src && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --unstable-ffi --import-map=import_map.json quarto.ts` passes.
- The tests in Verification pass.

## Plan

Assumes PR 09 landed. Independent of PRs 08, 10, 11, 14, 17.

### Task 1: Dry run and review

- [ ] **Step 1: Dry run**

Run: `quarto run --dev tools/codemod-deno-ral.ts --rules fs,temp --dir src/project --dir src/format --dry-run > /tmp/codemod-pf.txt; tail -1 /tmp/codemod-pf.txt`
Expected: `Summary: <N> files scanned, <M> would be rewritten, <R> replacements, 0 with collisions, 0 skipped` with R about 159 and M about 48; `git status --short src` is empty.

- [ ] **Step 2: Review the report**

Run: `grep -E 'skipped|collision' /tmp/codemod-pf.txt`
Expected: empty. If a collision is reported, read that file and resolve it with an alias import (`import { x as fsX } from ".../deno_ral/fs.ts"`, replace the blocked `Deno.x(` with `fsX(`) before Task 2.

Run: `grep '→' /tmp/codemod-pf.txt | awk -F'→' '{print $2}' | sort | uniq -c | sort -rn`
Expected: only `fs`/`temp` rule targets; `open` appears 6 times (the file-handle sites listed above).

### Task 2: Apply the codemod

- [ ] **Step 1: Rewrite**

Run: `quarto run --dev tools/codemod-deno-ral.ts --rules fs,temp --dir src/project --dir src/format | tail -1`
Expected: the same M and R as the dry run.

- [ ] **Step 2: Format and type-check**

Run: `git diff --name-only | xargs package/dist/bin/tools/x86_64/deno fmt`
Expected: `git diff --stat | tail -1` lists only files under `src/project` and `src/format`.

Run: `cd src && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --unstable-ffi --import-map=import_map.json quarto.ts`
Expected: no errors. If `readLines(reader)` or `parser.parse(reader)` reports that `FsFile` is not assignable to `Reader`, the layer's `FsFile.read` signature is wrong; fix it in `src/deno_ral/fs.ts` (it must be `read(p: Uint8Array): Promise<number | null>`) rather than casting at the call site.

- [ ] **Step 3: Review the six `open` sites**

Run: `git diff -U2 src/project/types/manuscript/manuscript-config.ts src/project/types/manuscript/manuscript.ts src/project/types/website/website-sitemap.ts src/project/types/website/listing/website-listing-feed.ts src/format/jats/format-jats-postprocess.ts src/format/pdf/format-pdf.ts | grep '^[-+]' | grep -v '^[-+][-+]'`
Expected: each hunk is `Deno.open(` → `open(` plus an import line; every handle is still closed in the same `finally`/after the same loop as before.

- [ ] **Step 4: Commit**

```bash
git add src/project src/format
git commit -m "project/format: codemod Deno fs/temp calls to deno_ral (mechanical)"
```

### Task 3: `Deno.errors` → predicates in `src/project`

**Files:**
- Modify: `src/project/project-context.ts`, `src/project/project-index.ts`

- [ ] **Step 1: `src/project/project-context.ts`**

Add `import { isPermissionDenied } from "../deno_ral/errors.ts";`. Lines 652 and 1072:

```ts
      if (isPermissionDenied(e)) {
```

Lines 967-969:

```ts
type InputWalkError = Error & {
  [kInputWalkProject]?: { dir: string; configFile?: string | null };
};
```

- [ ] **Step 2: `src/project/project-index.ts`**

Add `import { isNotFound } from "../deno_ral/errors.ts";`. Line 250: `if (isNotFound(e)) {`.

- [ ] **Step 3: Verify and commit**

Run: `grep -rn 'Deno\.errors' src/project src/format --include=*.ts`
Expected: empty.

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/project/project-context-unreadable-dir.test.ts unit/project/project-detect-denied-path.test.ts smoke/project/project-unreadable-dir.test.ts smoke/project/project-detect-denied-config.test.ts`
Expected: `0 failed` (these are the tests for the PermissionDenied tagging; on a root Unix session they skip themselves via `canMakeUnreadableDir`).

```bash
git add src/project/project-context.ts src/project/project-index.ts
git commit -m "project: Deno.errors checks through deno_ral/errors predicates"
```

### Task 4: Tests, ratchet, commit

- [ ] **Step 1: Unit tests that exercise `src/project` and `src/format`**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/project/ unit/book-title-block-attr.test.ts unit/format-detection.test.ts unit/format-html-math.test.ts unit/giscus.test.ts unit/scrollable-regions.test.ts unit/preview-compatibility.test.ts unit/preview-initial-path.test.ts unit/render-shared-output-dir.test.ts unit/single-file-input-abs-12401.test.ts unit/typst-fonts.test.ts`
Expected: `0 failed`.

- [ ] **Step 2: Smoke tests across project types and formats**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/project/ smoke/site/ smoke/website/ smoke/book/ smoke/manuscript/ smoke/jats/ smoke/search/ smoke/embed/ smoke/scholar/ smoke/render/render-html.test.ts smoke/render/render-docx.test.ts smoke/render/render-reveal.test.ts smoke/render/render-pdf.test.ts smoke/render/render-latex-output.test.ts smoke/render/render-typst-package-staging.test.ts smoke/render/render-page-layout.test.ts smoke/render/render-title-block.test.ts`
Expected: `0 failed` (PDF/LaTeX tests may skip without TinyTeX; note it in the PR).

- [ ] **Step 3: Ratchet**

Run: `quarto run --dev tools/check-runtime-boundary.ts --update-baseline && quarto run --dev tools/check-runtime-boundary.ts`
Expected: passes; `git diff tools/runtime-boundary-baseline.json` shows the `src` count lower by about 163 and no increase in any scope; `for d in src/project src/format; do printf "%s %s\n" $d $(grep -rhoE '\bDeno\.' $d --include=*.ts | wc -l); done` → `src/project` ≤ 12, `src/format` ≤ 5.

- [ ] **Step 4: Commit**

```bash
git add tools/runtime-boundary-baseline.json
git commit -m "Lower runtime boundary baseline after project/format fs/temp codemod"
```

## Verification

- Task 3 step 3 and Task 4 steps 1–2 → `0 failed`.
- `quarto run --dev tools/check-runtime-boundary.ts` → passes at the new baseline.
- The grep in Acceptance criteria → empty.
- `cd src && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --unstable-ffi --import-map=import_map.json quarto.ts` → exit 0.
- Manual: `package/dist/bin/quarto render tests/docs/websites/search` (a website with listing/feed/sitemap; `_site/sitemap.xml` is written) and `package/dist/bin/quarto render tests/docs/manuscript/base` (the MECA bundle is written under its `_manuscript/` output); both complete without errors. Remove the generated output afterwards (`git clean -fdx tests/docs/websites/search tests/docs/manuscript/base`).

## Review checklist

- [ ] `git diff` under the two directories contains only `Deno.x` → `x` rewrites, import lines, the three `isPermissionDenied`/`isNotFound` edits and the `InputWalkError` type change.
- [ ] Every `open()` handle is still closed on every path it was closed on before.
- [ ] `InputWalkError`'s symbol-keyed field is unchanged; `frameInputWalkError` still compiles.
- [ ] The MECA item order change (sorted) is understood and the manuscript smoke tests pass.
- [ ] Baseline only decreased.

## Risks and rollback

- `manuscript-meca.ts` and `format-html-shared.ts` now iterate directories in sorted order; MECA manifests and the bslib SCSS concatenation become deterministic across filesystems, which can change byte order in generated outputs. Snapshot differences that are pure reordering are the intended determinism (PR 01 makes the same call for bslib).
- `InputWalkError` widens from `Deno.errors.PermissionDenied & …` to `Error & …`; the runtime checks use the predicate, so behaviour is unchanged; a type that previously narrowed on the Deno class would now narrow on `Error`.
- Rollback: `git revert` the three commits; the layer stays.

## Decisions needed

None.
