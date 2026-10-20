# PR 24: Codemod `package/src` onto `src/deno_ral/`

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the build tooling under `package/src` off direct `Deno.*` calls: confirm PR 08's process conversions, replace `Deno.create` + `writeAll` and the `ln -s` process with layer file calls, and run the codemod for the remaining ~215 sites, so that `package/src` reaches zero in the ratchet; the Deno CLI invocations behind `execPath()`/`QUARTO_DENO` stay, by design, for PR 33.
**Phase:** 1. **Depends on:** PR 08 (Task 8 converted every `Deno.run` and `new Deno.Command` in `package/src`), PR 09 (codemod tool, `fs.ts`/`temp.ts`/`errors.ts`), PR 14 (`env.ts`), PR 19 (`platform.ts`, `main.ts`), PR 22 (`src/deno_ral/colors.ts`; it already rewrote `package/src`'s `fmt/colors` and `jsr:/@std/fmt` imports), PR 02 (ratchet). **Unblocks:** PR 25, PR 33.
**Branch:** `rt/24-codemod-package-src`.
**Suggested executor:** Sonnet. Two small hand edits and a codemod run with a fixed target; the judgement (what stays a Deno CLI call) is decided below.
**Size:** M. About 38 files touched by the codemod, 2 by hand, the baseline.
**Ships on:** Deno; `quarto-bld` keeps working (it is how the distribution is built).

## Spec

### Context

Assessment section 11, "Order of work" step 8: `package/src` drops `Deno.*` in favour of the layer. Section 3.1: build tooling is Deno TS using `Deno.run`, `deno info`, `deno compile`, `deno install`.

Inventory (`main` at `b86f98d`): 240 `Deno.` occurrences in 40 files. By API: `env` 48, `writeTextFileSync` 29, `removeSync` 29, `readTextFileSync` 23, `copyFileSync` 21, `args` 16, `run` 13 (11 calls plus 2 in `@ts-expect-error` comments in `util/tar.ts:95,119`), `exit` 8, `cwd` 7, `renameSync` 6, `remove` 5, `copyFile` 5, `readDirSync` 4, `makeTempDirSync` 4, `writeFileSync` 3, `chmodSync` 3, `chdir` 3, `build` 3, `makeTempFile` 2, `Command` 2, `writeTextFile` 1, `symlinkSync` 1, `execPath` 1, `errors` 1, `create` 1, `CommandStatus` 1. Largest files: `common/update-html-dependencies.ts` 57, `common/configure.ts` 19, `common/import-report/explain-all-cycles.ts` 11, `macos/installer.ts` 10, `common/import-report/explain-import-chain.ts` 10.

Already handled by earlier PRs, so not repeated here:

- **PR 08, Task 8** converts the 11 `Deno.run` calls (`util/tar.ts` 2, `util/git.ts` 3, `common/configure.ts` 1, `import-report/{deno-info,explain-import-chain,explain-all-cycles,report-risky-files,report-bundle-async-cycles}.ts` 1 each), the two `new Deno.Command` sites (`util/cmd.ts`, `common/previewjs.ts`) and `Deno.CommandStatus` to `exec`/`execSync` from `src/deno_ral/process.ts`. Task 1 verifies; it does not redo them.
- **PR 19** replaces `Deno.build.arch` (`common/config.ts:100`) and the `import.meta.main` guards. `Deno.build.target` in `common/compile-quarto-latexmk.ts:58,107` disappears with that file (PR 39, decision 9).
- **PR 22** routes `package/src/util/git.ts`'s `fmt/colors` and the two `jsr:/@std/fmt@^0.224.0/colors` imports (`import-report/find-bad-imports.ts:2`, `find-bad-types-constants.ts:2`) through `src/deno_ral/colors.ts`.

Hand conversions left for this PR:

| Site | Today | Replacement |
|---|---|---|
| `package/src/util/utils.ts:20-28` (`download`) | `Deno.create(dest)` + `writeAll(file, contents)` from `io/write-all` | `writeFileSync(dest, contents)` from `fs.ts` |
| `package/src/common/configure.ts:169-175` | a process for `ln -s <arch>/pandoc pandoc` (`execSync("ln", …)` after PR 08; an un-awaited `Deno.run` before) | `symlinkSync(linkTarget, join(targetDir, "pandoc"))` from `fs.ts` (relative target kept) |

**What stays a Deno CLI invocation (owned by PR 33 Task 16; the complete list with gates is the runtime residue table in PR 25, Context).** "Zero `Deno.*`" in this scope is not "runtime neutral": these calls start the Deno binary through `execPath()` or `QUARTO_DENO` and stay until PR 33 ports or retires each one:

| File | Command |
|---|---|
| `package/src/common/import-report/deno-info.ts` | `<deno> info <root> --json` (module graph for the import reports) |
| `package/src/common/cyclic-dependencies.ts:141-169` | `<QUARTO_DENO> info src/quarto.ts --json --unstable` |
| `package/src/common/import-report/report-bundle-async-cycles.ts:28-63` | `<deno> run … explain-all-cycles.ts …` |
| `package/src/common/previewjs.ts` | `<execPath()> run --no-config -A build.ts` (the preview JS build) |
| `package/src/util/deno.ts` | `<QUARTO_DENO> run …/tools/deno-esbuild-bundle.ts` (the bundle), `<QUARTO_DENO> compile` / `install` |

The first draft replaced `deno info` with an esbuild metafile adapter importing `jsr:@luca/esbuild-deno-loader`; that loader itself shells out to `deno info --json`, the plan wrote the metafile into `package/pkg-working/bin/` (copied wholesale into every installer by `package/src/linux/installer.ts:133` and its siblings), and it contradicted this PR's own no-`jsr:` rule. The module graph and the metafile move to PR 33, which replaces the bundler and has a metafile anyway. This PR keeps PR 08's `exec` call for `deno info`.

Assumptions: `tools/codemod-deno-ral.ts --dir package/src` computes imports relative to `src/deno_ral` from outside `src/` (PR 09's tool handles arbitrary `--dir`) and maps `Deno.errors.NotFound` instanceof checks with its `errors` rule (PR 10 uses it); `src/deno_ral/fs.ts` exports `writeFileSync` and `symlinkSync` (vocabulary, PR 09).

### Scope

In: verifying PR 08's conversions; the two hand conversions; the codemod over `package/src`; baseline.
Out: the Deno CLI invocations listed above (PR 33); `compile-quarto-latexmk.ts` (PR 39 deletes it); the `npm:` pins in `report-bundle-async-cycles.ts:13-15` (`npm:acorn@8.14.0`, `npm:acorn-walk@8.3.4`, `npm:javascript-lp-solver`: build-tool dependencies of a dev script, not runtime seams); `tools/deno-esbuild-bundle.ts`; `package/src/quarto-bld` shell launchers (PR 33).

### Interfaces

No new interface. `package/src/util/utils.ts`'s `download(src: string, dest: string): Promise<void>` keeps its signature.

### Files

- Modify: `package/src/util/utils.ts:1,20-28`; `package/src/common/configure.ts:160-176`.
- Modify: every other `package/src` file the codemod touches (import lines plus `Deno.` prefix removal), about 38 files.
- Modify: `tools/runtime-boundary-baseline.json`.
- No file is created under `package/pkg-working/` or anywhere else.

### Acceptance criteria

- `grep -rnE '\bDeno\.' package/src --include=*.ts | grep -v 'common/compile-quarto-latexmk.ts'` prints nothing (that file has `Deno.build.target` until PR 39 deletes it).
- `grep -rn 'from "jsr:\|from "https:' package/src --include=*.ts` prints nothing.
- `grep -rln 'execPath()\|"QUARTO_DENO"' package/src --include=*.ts | sort` prints exactly `package/src/common/cyclic-dependencies.ts`, `package/src/common/import-report/deno-info.ts`, `package/src/common/import-report/report-bundle-async-cycles.ts`, `package/src/common/previewjs.ts`, `package/src/util/deno.ts` (plus `compile-quarto-latexmk.ts` until PR 39), the Deno CLI invocations PR 33 owns.
- `package/src/quarto-bld configure` and `package/src/quarto-bld prepare-dist` complete; `ls -l package/dist/bin/tools/pandoc` shows a symlink to `<arch>/pandoc` (Linux/macOS).
- `package/src/quarto-bld cycle-dependencies -o "$(mktemp -d)/cycles.json"` writes JSON with the same top-level shape as before.
- `quarto run --dev package/src/common/import-report/find-bad-imports.ts src/quarto.ts` runs and exits 0.
- Ratchet: `package/src` `Deno.` count 0 (or the 2 `Deno.build.target` occurrences until PR 39); baseline committed.

## Plan

### Task 1: Confirm PR 08's process conversions

**Files:** none changed when PR 08 is complete.

- [ ] **Step 1: Check**

Run: `grep -rn 'Deno\.run(\|new Deno\.Command\|Deno\.CommandStatus' package/src --include=*.ts`
Expected: nothing. If a line prints, PR 08 Task 8 (`dev-docs/runtime-migration/08-ral-process.md`, steps 1–6) did not cover that file: apply that task's replacement for it verbatim (same `exec`/`execSync` call shapes), and note the file in the PR description.

Run: `grep -rn '@ts-expect-error `Deno.run()`' package/src/util/tar.ts`
Expected: nothing (PR 08 removed both comments with the calls).

- [ ] **Step 2: Commit (only if Step 1 changed files)**

```bash
git add package/src
git commit -m "package/src: process calls PR 08 missed, through deno_ral/process"
```

### Task 2: The two hand conversions

**Files:**
- Modify: `package/src/util/utils.ts:1,20-28`, `package/src/common/configure.ts:160-176`

- [ ] **Step 1: `utils.ts` `download`**

Replace line 1 (`import { writeAll } from "io/write-all";`) with:

```ts
import { writeFileSync } from "../../../src/deno_ral/fs.ts";
```

and lines 20–28 with:

```ts
export async function download(src: string, dest: string): Promise<void> {
  const response = await fetch(src);
  const contents = new Uint8Array(await response.arrayBuffer());
  writeFileSync(dest, contents);
}
```

(The old body went through a `Blob` and a file handle to do the same thing.)

- [ ] **Step 2: `configure.ts` `copyPandocScript`**

Add `symlinkSync` to the file's `../../../src/deno_ral/fs.ts` import (and drop `execSync` from its `process.ts` import if nothing else uses it: `grep -n 'execSync(' package/src/common/configure.ts`). Replace the `if (!isWindows) { … }` block of `copyPandocScript` (the `ln -s` process) with:

```ts
  if (!isWindows) {
    info("> creating pandoc symlink");
    // Relative target, as `ln -s <arch>/pandoc pandoc` run in targetDir made.
    symlinkSync(linkTarget, pandocFile);
  }
```

(`linkTarget` is `join(config.arch, "pandoc")` and `pandocFile` is `join(targetDir, "pandoc")`, both defined above in the same function; the existing-link removal before it is unchanged.)

- [ ] **Step 3: Verify**

Run: `package/src/quarto-bld configure 2>&1 | tail -3` → finishes.
Run: `ls -l package/dist/bin/tools/pandoc` → `pandoc -> x86_64/pandoc` (or `aarch64/pandoc`).
Run: `package/dist/bin/tools/pandoc --version | head -1` → `pandoc <version>`.
Run: `package/dist/bin/tools/x86_64/deno check --unstable-kv --import-map=src/import_map.json package/src/bld.ts` → exit 0.

- [ ] **Step 4: Commit**

```bash
git add package/src/util/utils.ts package/src/common/configure.ts
git commit -m "package/src: writeFileSync and symlinkSync instead of Deno.create/writeAll and an ln process"
```

### Task 3: Codemod the rest

README ground rule 7 applies: fresh `main`, opened and merged the same day, conflicts by reset + re-run. PR 20 edits `package/src/common/{configure,prepare-dist}.ts`, `package/src/util/deno.ts`, `dependencies.ts` and `macos/installer.ts`, which this codemod rewrites: land PR 20 first (README ground rule 8), or, if PR 20 has not landed, note that `configure.ts` still contains `Deno.env.get("DENO_DOM")` and the codemod takes it (PR 20 then rebases).


**Files:** every `package/src` file with remaining `Deno.*`

- [ ] **Step 1: Measure before**

```bash
grep -rhoE '\bDeno\.[A-Za-z_]+' package/src --include=*.ts | sort | uniq -c | sort -rn
```

Expected: the `env`/fs/`args`/`exit`/`cwd`/`chdir`/`execPath`/`errors` rows of the inventory (about 215 sites) and `Deno.build` ×2 (`compile-quarto-latexmk.ts`, if PR 39 has not landed); no `run`, `Command`, `CommandStatus`, `create`.

- [ ] **Step 2: Run**

```bash
quarto run --dev tools/codemod-deno-ral.ts --rules fs,temp,env,process,platform --dir package/src --dry-run | head -80
quarto run --dev tools/codemod-deno-ral.ts --rules fs,temp,env,process,platform --dir package/src
grep -rnE '\bDeno\.' package/src --include=*.ts | grep -v 'common/compile-quarto-latexmk.ts'
```

Expected: the dry run shows only `Deno.x(` → `x(` substitutions plus added imports; the final grep prints nothing. Hand-fix any `skipped:` lines the tool reported (for example `Deno.errors.NotFound` at `common/validate-bundle.ts:72` becomes `isNotFound(e)` from `src/deno_ral/errors.ts` if the rule did not cover it).

- [ ] **Step 3: Verify the build tooling end to end**

Run: `package/src/quarto-bld --help | head -3` → command list.
Run: `package/src/quarto-bld configure` → completes.
Run: `package/src/quarto-bld prepare-dist` → completes; `package/pkg-working/bin/quarto.js` exists and `git status --short package/pkg-working` shows nothing new beyond what `main` produces (no extra files).
Run: `package/src/quarto-bld cycle-dependencies -o "$(mktemp -d)/cycles.json"` → JSON written (`deno info` through PR 08's `exec`).
Run: `quarto run --dev package/src/common/import-report/find-bad-imports.ts src/quarto.ts` → exit 0.
Run: `package/src/quarto-bld update-html-dependencies --help` → prints usage (compiles the 57-site file).
Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/tar-command.test.ts unit/macos-notarize-status.test.ts smoke/render/render-html.test.ts` → pass.
CI: `.github/workflows/test-bundle.yml` exercises `prepare-dist` and the bundle on three OSes; `create-release.yml` (no-publish dispatch) exercises the installers.

- [ ] **Step 4: Commit**

```bash
git add package/src
git commit -m "package/src: codemod remaining Deno.* calls to deno_ral"
```

### Task 4: Ratchet

- [ ] **Step 1:** `quarto run --dev tools/check-runtime-boundary.ts --update-baseline` → `package/src` `Deno.` count 0 (2 while `compile-quarto-latexmk.ts` exists); std-import counts not higher.
- [ ] **Step 2: Commit**

```bash
git add tools/runtime-boundary-baseline.json
git commit -m "ratchet baseline: package/src at zero"
```

## Verification

- Acceptance greps → as stated (the `execPath()`/`QUARTO_DENO` list matches exactly).
- `package/src/quarto-bld configure && package/src/quarto-bld prepare-dist` → succeed; nothing new under `package/pkg-working/`.
- `package/src/quarto-bld cycle-dependencies -o <file>` → JSON written.
- `quarto run --dev package/src/common/import-report/find-bad-imports.ts src/quarto.ts` → exit 0.
- `quarto run --dev tools/check-runtime-boundary.ts` → passes at the new baseline.

## Review checklist

- [ ] No `Deno.run`/`Deno.Command` left (PR 08's conversions intact, not duplicated here).
- [ ] No subprocess is spawned for `ln -s`; the symlink target stays relative.
- [ ] `download` writes the same bytes (`writeFileSync` of the response body).
- [ ] Codemod commit contains only prefix removals and import lines.
- [ ] No `jsr:`/`https:` import added; no file written under `package/pkg-working/bin` by any new code.
- [ ] The PR description lists the remaining Deno CLI invocations (the `execPath()`/`QUARTO_DENO` table) as PR 33's.
- [ ] `npm:` pins in `report-bundle-async-cycles.ts` unchanged and listed as intentional.

## Risks and rollback

- A codemod rewrite inside a build script breaks only the build, not Quarto: `test-bundle.yml` and a local `prepare-dist` catch it before merge.
- `symlinkSync` with a relative target behaves like `ln -s` (the link resolves relative to its own directory); on Windows the branch is not taken, as before.
- Rollback: revert the commits; PR 08's conversions are unaffected.

## Decisions needed

None. Not changed because: the review found the first draft's esbuild-metafile replacement for `deno info` pointless (the loader shells out to `deno info` itself), self-contradictory (a `jsr:` import in a PR forbidding them) and harmful (a multi-MB metafile in `pkg-working/bin`, shipped by installers); it is removed from this PR and the module-graph work belongs to PR 33's bundler change.
