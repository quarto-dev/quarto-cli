# PR 39: Remove the `quarto-latexmk` (`tinitex`) standalone build

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Delete the `deno compile` build of the standalone `tinitex` binary (`quarto-bld compile-quarto-latexmk`, its CI workflow and the standalone entry module), because `tinitex` is being rewritten in Rust as a separate project; the latexmk modules that `quarto render --to pdf` uses stay.
**Phase:** 1, after PR 08 and before PR 25.
**Depends on:** nothing functionally (PR 08 first, so that neither PR edits `quarto-latexmk.ts` after the other deleted it).
**Unblocks:** PR 25 (its `src` and `package/src` zero needs `quarto-latexmk.ts`'s `Deno.args` and `compile-quarto-latexmk.ts`'s `Deno.build.target` gone: row 5 of PR 25's runtime residue table), PR 37 (which stops downloading Deno; this PR removes the last `deno compile`).
**Branch:** `rt/39-remove-quarto-latexmk-compile`.
**Suggested executor:** Sonnet.
Deletions from a complete inventory.
**Size:** S (8 files: 4 deleted, 4 edited).
**Ships on:** whatever runtime `main` is on when it lands (Deno before PR 33, Node after).
Gates: `tests/unit/latexmk/`, `tests/smoke/render/render-pdf.test.ts`, `test-bundle.yml`.

## Spec

### Context

Decision 9 (`REVIEW-2026-10-15.md` section 6): `tinitex` is rewritten in Rust as a separate project, which replaces the standalone binary.
The CLI plan therefore stops building `quarto-latexmk` at all; the earlier draft of this PR (option D, a `quarto call latexmk` subcommand, with the `stopEarly` passthrough fix and the `isMainModule` guard question) is withdrawn with it.

How the standalone build works today, and everything that refers to it (`rg -n -i --hidden "tinitex|quarto-latexmk|compile-quarto-latexmk|compileQuartoLatexmk|kExeName|kExeVersion|kExeDescription" --glob '!.git/**'`, excluding `news/` history and `dev-docs/runtime-migration/`):

| Path | What it is | Action |
|---|---|---|
| `package/src/common/compile-quarto-latexmk.ts` | `quarto-bld compile-quarto-latexmk`: rewrites `quarto-latexmk-metadata.ts`, runs `deno compile` per `--target`, or `deno install` with `--development` | delete |
| `package/src/bld.ts:15-17,111-113` | import and registration of `compileQuartoLatexmkCommand()` | edit |
| `package/src/util/deno.ts` (`compile`, `install`, `updateDenoPath`) | the `deno compile`/`deno install` drivers, only used by the file above | delete those three functions; delete the file if PR 33 already removed `bundle()` |
| `package/src/common/config.ts:21,109,114` (`importmap`) | only read by `compile`/`install` (`--importmap=`) | delete the field (re-grep `\.importmap\b` in `package/src` first) |
| `src/command/render/latexmk/quarto-latexmk.ts` | the standalone Cliffy entry (`pdf(args)`, `import.meta.main` guard at line 128, `Deno.args` at 130) | delete |
| `src/command/render/latexmk/quarto-latexmk-metadata.ts` | `kExeVersion`, `kExeName = "tinitex"`, `kExeDescription`; imported only by the entry and the compile script | delete |
| `.github/workflows/test-quarto-latexmk.yml` | builds `tinitex` on three OSes and uploads it as an artifact | delete |
| `.github/workflows/test-ff-matrix.yml:69,84`, `.github/workflows/test-smokes-parallel.yml:34` | `paths-ignore` entries naming that workflow | delete the lines |

No installer, release asset, `src/` code path or documentation page ships or spawns `tinitex` (`prepare-dist.ts` never calls `compile`).
`news/changelog-1.3.md` mentions it as history and is not edited.

Kept, unchanged: `src/command/render/latexmk/{latex,latexmk,parse-error,pdf,pkgmgr,texlive,types}.ts`, the modules `quarto render --to pdf` uses.
They become runtime-neutral through the Phase 1 codemods like the rest of `src/` (none of them imports the two deleted files: `rg -n "quarto-latexmk" src/command/render/latexmk` lists only the two files themselves).

### When to land

In Phase 1, after PR 08 and before PR 25 (README order; `REVIEW-2026-10-16.md` R02).
It touches nothing the runtime migration changes except files it deletes, and PR 25 assumes the files are gone (no conditional allow-list entry exists for them).
The plans below still carry conditional lines for the window between PR 08 and this PR; once it lands, the coordinator removes those lines from the ones that have not executed yet:

- PR 06: the `src/command/render/latexmk/quarto-latexmk.ts` Cliffy edits and the `deno check ... quarto-latexmk.ts` commands.
- PR 08: `Deno.args` at `quarto-latexmk.ts:130` (if PR 08 has not landed yet; otherwise it already edited the file this PR deletes).
- PR 11: the `quarto-latexmk.ts` row of its table.
- PR 19: `import.meta.main` at `quarto-latexmk.ts:128` and `Deno.build.target` at `compile-quarto-latexmk.ts:58,107` (its Task 5).
- PR 22: `quarto-latexmk.ts` in the `flags` seam list.
- PR 24: the `compile-quarto-latexmk.ts`/`util/deno.ts` out-of-scope note.
- PR 33: the `test-quarto-latexmk.yml` `setup-deno` note (already removed from PR 33's current text).
- PR 25: nothing (it already assumes this PR landed).

### Scope

In: the inventory table.
Out: the latexmk modules used by `render --to pdf`; the Rust `tinitex` (separate project).

### Interfaces

None added.
Removed: the `quarto-bld compile-quarto-latexmk` command; `compile`, `install`, `updateDenoPath` from `package/src/util/deno.ts`; `Configuration.importmap`.

### Files

- Delete: `package/src/common/compile-quarto-latexmk.ts`, `src/command/render/latexmk/quarto-latexmk.ts`, `src/command/render/latexmk/quarto-latexmk-metadata.ts`, `.github/workflows/test-quarto-latexmk.yml`
- Modify: `package/src/bld.ts:15-17,111-113`, `package/src/util/deno.ts`, `package/src/common/config.ts:21,109,114`, `.github/workflows/test-ff-matrix.yml:69,84`, `.github/workflows/test-smokes-parallel.yml:34`
- Test: existing `tests/unit/latexmk/parse-error.test.ts`, `tests/unit/latexmk/fmtutil-handler.test.ts`, `tests/smoke/render/render-pdf.test.ts`

### Acceptance criteria

- `rg -n -i --hidden "tinitex|quarto-latexmk|compileQuartoLatexmk|kExeName" --glob '!.git/**' --glob '!news/**' --glob '!dev-docs/runtime-migration/**' .` prints nothing.
- `cd package/src && ./quarto-bld --help` no longer lists `compile-quarto-latexmk`; `./quarto-bld prepare-dist --set-version 99.9.9` succeeds.
- `tests/unit/latexmk/` and `tests/smoke/render/render-pdf.test.ts` pass; `test-bundle.yml` passes.
- `grep -rn "deno compile\|\"compile\"" package/src` prints nothing.

## Plan

### Task 1: Delete the standalone build

**Files:** as listed.

- [ ] **Step 1: Confirm the inventory is complete**

Run: `rg -n -i --hidden "tinitex|quarto-latexmk|compile-quarto-latexmk|compileQuartoLatexmk|kExeName|kExeVersion|kExeDescription" --glob '!.git/**' --glob '!news/**' --glob '!dev-docs/runtime-migration/**' .` Expected: only the paths in the Context table.
Any other hit is added to this PR (and to its description).

- [ ] **Step 2: Delete and edit**

```bash
git rm package/src/common/compile-quarto-latexmk.ts src/command/render/latexmk/quarto-latexmk.ts src/command/render/latexmk/quarto-latexmk-metadata.ts .github/workflows/test-quarto-latexmk.yml
```

- `package/src/bld.ts`: delete the `import { compileQuartoLatexmkCommand } from "./common/compile-quarto-latexmk.ts";` block (lines 15-17) and the `commands.push(compileQuartoLatexmkCommand());` block (lines 111-113).
- `package/src/util/deno.ts`: delete `compile`, `install` and `updateDenoPath`, and the imports only they used (`isWindows`).
  If `bundle()` is also gone (PR 33 landed first), `git rm package/src/util/deno.ts`.
- `package/src/common/config.ts`: run `rg -n "\.importmap\b" package/src`; when only the definition remains, delete the `importmap: string;` field (line 21), the `const importmap = ...` line (109) and `importmap,` (114).
- `.github/workflows/test-ff-matrix.yml`: delete the two `- ".github/workflows/test-quarto-latexmk.yml"` lines (69, 84).
  `.github/workflows/test-smokes-parallel.yml`: delete line 34 (same text).

- [ ] **Step 3: Verify**

Run:
```bash
rg -n -i --hidden "tinitex|quarto-latexmk|compileQuartoLatexmk|kExeName" --glob '!.git/**' --glob '!news/**' --glob '!dev-docs/runtime-migration/**' .
cd package/src && ./quarto-bld --help | grep -c compile-quarto-latexmk
cd ../../tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent $(find unit/latexmk/ -name '*.test.ts') smoke/render/render-pdf.test.ts
```
Expected: no output; `0`; all tests pass (the PDF smoke test needs TinyTeX, as today).

- [ ] **Step 4: Commit**

```bash
git add -A package/src src/command/render/latexmk .github/workflows
git commit -m "build: remove the deno compile build of tinitex (rewritten in Rust separately)"
```

### Task 2: PR description and coordination

- [ ] **Step 1:** In the PR description: one paragraph pointing to the Rust `tinitex` project as the replacement for the standalone binary (link to its repository when it exists), the list of deleted paths, and, when this lands before PR 33, the list of plans in "When to land" whose lines about these files the coordinator removes.

No changelog entry: nothing user-visible was ever shipped.

## Verification

- The three commands of Task 1 step 3.
- Push: `test-bundle.yml`, `test-smokes.yml` green; the `Test quarto-latexmk` check no longer appears (remove it from branch protection if it was required; name it in the description).

## Review checklist

- [ ] Only the inventory's files changed; the seven latexmk modules used by `render --to pdf` are untouched.
- [ ] No reference to `tinitex`, `quarto-latexmk` or `compile-quarto-latexmk` outside history.
- [ ] `package/src/util/deno.ts` keeps `bundle()` only if PR 33 has not landed.

## Risks and rollback

- **Someone used the workflow artifact `tinitex-<os>`** (it was never released).
  The Rust project replaces it; until it ships, `git revert` restores the workflow, which builds with the Deno still downloaded before PR 37.
- **Rollback:** revert the commit.

## Decisions needed

1. Not changed because decision 9 withdrew it: the review's findings on the previous draft (option D's `src/quarto.ts:129` passthrough for `latexmk`, and the `isMainModule` guard firing inside the bundle) concern a subcommand this PR no longer adds.
