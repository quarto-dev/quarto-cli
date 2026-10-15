# PR 39: `quarto-latexmk` (`tinitex`) without `deno compile`

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Decide how the `tinitex` latexmk tool is delivered once `deno compile` is gone, implement the chosen option, and keep a documented rollback to building it with the last Deno release.
**Phase:** 3. **Depends on:** PR 33 (Node runtime; `test-quarto-latexmk.yml` temporarily uses `denoland/setup-deno`). **Unblocks:** PR 37 may delete `package/src/util/deno.ts` once this lands (PR 37 leaves it alone otherwise).
**Branch:** `rt/39-quarto-latexmk-packaging`.
**Suggested executor:** Sonnet. The decision is made in this plan; the implementation is a small Cliffy subcommand, a workflow rewrite and deletions.
**Size:** S (8 files).
**Ships on:** Node. Gates: `tests/smoke/call/latexmk.test.ts`, the rewritten `test-quarto-latexmk.yml`.

## Spec

### Context

Assessment section 3.6 and the "quarto-latexmk" paragraph of section 11: `src/command/render/latexmk/quarto-latexmk.ts` is a Cliffy program (`pdf(args)`) around the same `generatePdf()` the CLI uses; it became runtime-neutral with the Phase 1 codemods. Only its packaging is Deno-specific: `package/src/common/compile-quarto-latexmk.ts` rewrites the three constants of `quarto-latexmk-metadata.ts` (`kExeVersion = "1.1"`, `kExeName = "tinitex"`, `kExeDescription`) and calls `compile()` in `package/src/util/deno.ts`, which runs `deno compile --unstable-kv --unstable-ffi --v8-flags=... --importmap=... --output <bin>/tinitex/<target>/tinitex --allow-all <entry>` for each `--target` (`x86_64-unknown-linux-gnu`, `x86_64-pc-windows-msvc`, `x86_64-apple-darwin`, `aarch64-apple-darwin`). The `--development` flag uses `deno install` plus `updateDenoPath()` to put a `tinitex` shim on the developer's PATH.

How `tinitex` is consumed today (verified 2026-10-14 by `grep -rn "tinitex\|quarto-latexmk"` over the repository): only `.github/workflows/test-quarto-latexmk.yml` builds it, on three OS runners, runs `tinitex --help`, and uploads `tinitex-<os>` as a workflow artifact. No installer includes it (`prepare-dist.ts` never calls `compile`), no release asset carries it, no documentation page in this repository mentions it, and `src/` never spawns it. It is a standalone build that the project keeps compiling to make sure the latexmk module can run outside the CLI.

Facts about the options (checked 2026-10-14):

- **Node single executable applications** (`doc/api/single-executable-applications.md`, Node 26): Stability 1.1 "Active development". `node --build-sea sea-config.json` produces the executable in one step; the config takes `main` (a single script, CommonJS by default; ESM only with `"useVfs": true`, which is Stability 1.0 "Early development"), `executable` (the Node binary to inject into; defaults to the running one), `output`, `useCodeCache`, `useSnapshot`, `assets`. Cross-platform generation is allowed only with `useCodeCache` and `useSnapshot` off, and "the version of the Node.js binary used to produce the blob must be the same as the one to which the blob will be injected". The result must be signed after generation (`codesign --sign` on macOS; `signtool` optional on Windows). Size: the Node binary (123 MB for Node 22 x64 Linux in the spike; Node 26 is in the same range) plus the bundle (under 1 MB for latexmk).
- **`deno compile`**: works unchanged with Deno 2.7.14 from `denoland/setup-deno` (PR 33 wired it into the workflow). Size: the embedded `denort` runtime, on the order of 100 MB per target (not measured in this sandbox; the full `deno` binary is 124 MB). Cross-compiles to all four targets from one host. Stops receiving updates when Deno's maintenance ends (about October 2027).
- **Bun** `bun build --compile --target=bun-<os>-<arch>`: cross-compiles from one host to Linux x64/arm64, macOS x64/arm64, Windows x64; output is the Bun runtime plus the bundle (about 100 MB; `bun.sh` was not reachable from this sandbox, so the size and the macOS signing requirements of compiled Bun binaries are from memory and must be checked before choosing this option). Adds a second runtime vendor to the toolchain, which is what the assessment (section 5, Option B) argued against.
- **A script run by the bundled Node** (`quarto call latexmk`): zero extra binary, zero signing work, the code path is exercised by the normal test matrix, and the help/version output comes from Quarto. It changes the invocation from `tinitex input.tex` to `quarto call latexmk input.tex`, which only the workflow uses today.

Comparison on the requested criteria:

| Criterion | A. keep `deno compile` until a date | B. Node SEA | C. Bun `--compile` | D. `quarto call latexmk` |
|---|---|---|---|---|
| Binary size per target | ~100 MB (estimate) | ~124 MB | ~100 MB (unverified) | 0 (inside the installer) |
| Signing on macOS/Windows | needed if ever shipped; not done today (artifact only) | needed (documented `codesign` step); the release pipeline already signs every Mach-O/PE, but tinitex is not in it | needed; requirements for compiled Bun binaries not verified here | none beyond the existing installer |
| Cross-compilation from the CI matrix | yes (`--target`) | per-OS native builds (the workflow already runs on three OSes); cross-build possible without code cache but needs the target `node` binary (which `prepare-dist` downloads anyway) | yes (`--target`) | n/a |
| Maintenance burden | none until Oct 2027, then a dead end; keeps `package/src/util/deno.ts` and a Deno download in CI | a `sea-config.json`, a CommonJS entry (the latexmk module graph has no top-level await, but `import.meta` uses must be guarded), an experimental API that moved three times since Node 20 | a new runtime in the toolchain, one more GitHub action, two vendors to track | one Cliffy subcommand and a smoke test |
| User impact | none (nobody downloads it) | none | none | the standalone invocation disappears; `quarto` is required |

**Recommendation: D**, `quarto call latexmk`, with A as the rollback. Nothing ships `tinitex`; the value of the workflow is to prove that the latexmk module works as an entry point, which a subcommand proves equally well on every OS the matrix runs. If a standalone binary is wanted later (for example by TinyTeX users who do not have Quarto), option B is the path and the Appendix gives the recipe; it does not have to be decided now.

Assumptions about earlier PRs:

- PR 33 landed its `test-quarto-latexmk.yml` change (`denoland/setup-deno@v2` with `deno-version: v2.7.14` and `QUARTO_DENO` exported), kept `compile()`/`install()`/`updateDenoPath()` in `package/src/util/deno.ts`, and deleted `bundle()`.
- PR 19 replaced `import.meta.main` in `quarto-latexmk.ts:128` with `isMainModule(import.meta)` and `Deno.args` with `args()`; PR 08 provides `args()`.
- The `call` command (`src/command/call/cmd.ts`) is the place for subsystem entry points (`engine`, `build-ts-extension`, `typst-gather`, `axe`).

### Scope

In:
- `src/command/call/latexmk-cmd.ts` (new) and its registration; `pdf()` gains an optional program name.
- Delete `package/src/common/compile-quarto-latexmk.ts`, `package/src/util/deno.ts`, the `compileQuartoLatexmkCommand()` registration in `package/src/bld.ts`.
- Rewrite `.github/workflows/test-quarto-latexmk.yml` to test the subcommand on the three OSes (keep the file name; `test-ff-matrix.yml` and `test-smokes-parallel.yml` list it under `paths-ignore`).
- Smoke test, changelog, a note in `dev-docs/runtime-migration/docs-updates.md`.

Out:
- Shipping a standalone `tinitex` (Appendix only).
- Changing `generatePdf()` or the latexmk options.

### Interfaces

```ts
// src/command/render/latexmk/quarto-latexmk.ts
/**
 * Run the latexmk CLI. `programName` is what --help prints as the command
 * (kExeName "tinitex" for the standalone build, "quarto call latexmk" inside Quarto).
 */
export async function pdf(args: string[], programName?: string): Promise<void>;
```

```ts
// src/command/call/latexmk-cmd.ts
export const latexmkCommand: Command; // name "latexmk", stopEarly, passes raw args to pdf(args, "quarto call latexmk")
```

CLI:

```
quarto call latexmk <input.tex> [--pdf-engine <engine>] [--pdf-engine-opt=<file>] [--index-engine <engine>]
                    [--index-engine-opt=<file>] [--bib-engine <engine>] [--no-auto-install] [--tlmgr-opt=<file>]
                    [--no-auto-mk] [--min <n>] [--max <n>] [--output-dir <dir>] [--no-clean] [--log-level <level>]
```

(the option list is `pdf()`'s today, unchanged).

### Files

- Create: `src/command/call/latexmk-cmd.ts`
- Modify: `src/command/call/cmd.ts:1-20` (import and `.command("latexmk", latexmkCommand)`)
- Modify: `src/command/render/latexmk/quarto-latexmk.ts:61-66,128-132` (`programName` parameter; `isMainModule` call passes `kExeName`)
- Delete: `package/src/common/compile-quarto-latexmk.ts`, `package/src/util/deno.ts`
- Modify: `package/src/bld.ts:15-17,111-113` (remove the import and the `commands.push(compileQuartoLatexmkCommand())`)
- Modify: `.github/workflows/test-quarto-latexmk.yml` (whole file)
- Test: `tests/smoke/call/latexmk.test.ts`
- Modify: `news/changelog-1.11.md`, `dev-docs/runtime-migration/docs-updates.md`

### Acceptance criteria

- `quarto call latexmk --help` prints the latexmk usage with the program name `quarto call latexmk` and exits 0; `quarto call latexmk --version` prints `1.1` (the `kExeVersion`; see Decisions).
- With TinyTeX available (`quarto install tinytex` or TeX Live on PATH), `quarto call latexmk tests/docs/latexmk/minimal.tex --output-dir <tmp>` produces `<tmp>/minimal.pdf` and exits 0; without TeX the smoke test is skipped with `ignore`.
- `grep -rn "compile-quarto-latexmk\|util/deno.ts\|deno compile\|setup-deno" . --include=*.ts --include=*.yml --include=*.md | grep -v "dev-docs/runtime-migration\|news/"` prints nothing.
- `test-quarto-latexmk.yml` runs `quarto call latexmk --help` on Linux, macOS and Windows and is green.
- `cd package/src && ./quarto-bld --help` no longer lists `compile-quarto-latexmk`.

## Plan

### Task 1: The subcommand

**Files:**
- Modify: `src/command/render/latexmk/quarto-latexmk.ts`
- Create: `src/command/call/latexmk-cmd.ts`
- Modify: `src/command/call/cmd.ts`
- Test: `tests/smoke/call/latexmk.test.ts`

- [ ] **Step 1: Write the failing smoke test**

Create `tests/docs/latexmk/minimal.tex`:

```latex
\documentclass{article}
\begin{document}
Hello, latexmk.
\end{document}
```

`tests/smoke/call/latexmk.test.ts`:

```ts
/*
 * latexmk.test.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 */
import { assert, assertStringIncludes } from "../../asserts.ts";
import { unitTest } from "../../test.ts";
import { execProcess } from "../../../src/core/process.ts";
import { quartoDevCmd } from "../../utils.ts";
import { quartoSpawnEnvOptions } from "../../quarto-cmd.ts";
import { which } from "../../../src/core/path.ts";
import { join } from "../../../src/deno_ral/path.ts";
import { existsSync, removeSync } from "../../../src/deno_ral/fs.ts";
import { makeTempDirSync } from "../../../src/deno_ral/temp.ts";

unitTest("quarto call latexmk --help", async () => {
  const result = await execProcess({
    cmd: quartoDevCmd(),
    args: ["call", "latexmk", "--help"],
    stdout: "piped",
    stderr: "piped",
    ...quartoSpawnEnvOptions(),
  });
  assert(result.success, result.stderr);
  assertStringIncludes(result.stdout ?? "", "quarto call latexmk");
  assertStringIncludes(result.stdout ?? "", "--pdf-engine");
});

const hasPdflatex = (await which("pdflatex")) !== undefined;

unitTest("quarto call latexmk compiles a minimal document", async () => {
  const outDir = makeTempDirSync({ prefix: "latexmk" });
  try {
    const result = await execProcess({
      cmd: quartoDevCmd(),
      args: ["call", "latexmk", "docs/latexmk/minimal.tex", "--output-dir", outDir, "--no-auto-install"],
      stdout: "piped",
      stderr: "piped",
      ...quartoSpawnEnvOptions(),
    });
    assert(result.success, (result.stdout ?? "") + (result.stderr ?? ""));
    assert(existsSync(join(outDir, "minimal.pdf")), "minimal.pdf not produced");
  } finally {
    removeSync(outDir, { recursive: true });
  }
}, { ignore: !hasPdflatex });
```

- [ ] **Step 2: Run it and see it fail**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/call/latexmk.test.ts`
Expected: the `--help` test fails (`Unknown command "latexmk"`), the compile test fails or is ignored.

- [ ] **Step 3: `programName` in `pdf()`**

In `src/command/render/latexmk/quarto-latexmk.ts`:

- Line 61: `export async function pdf(args: string[]) {` -> `export async function pdf(args: string[], programName: string = kExeName) {`
- Line 66: `.name(kExeName)` -> `.name(programName)`
- Lines 128-132 (the main guard) stay: `if (isMainModule(import.meta)) { await mainRunner(async () => { await pdf(args()); }); }` (standalone invocation keeps the `tinitex` name).

- [ ] **Step 4: The `call` subcommand**

`src/command/call/latexmk-cmd.ts`:

```ts
/*
 * latexmk-cmd.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 *
 * `quarto call latexmk`: the latexmk engine as a subcommand. Replaces the
 * standalone `tinitex` binary that was built with `deno compile`.
 */

import { Command } from "cliffy/command/mod.ts";
import { pdf } from "../render/latexmk/quarto-latexmk.ts";

export const latexmkCommand = new Command()
  .name("latexmk")
  .arguments("[...args]")
  .stopEarly()
  .description(
    "Compile a LaTeX document to PDF with Quarto's latexmk engine " +
      "(automatic package installation, bibliography and index runs).\n\n" +
      "Run `quarto call latexmk --help` for the engine's own options.",
  )
  .action(async (_options: unknown, ...args: string[]) => {
    await pdf(args, "quarto call latexmk");
  });
```

`stopEarly()` hands every argument after `latexmk`, including `--help`, to `pdf()`, which builds the real Cliffy command (with `appendLogOptions`) and parses them; this is how the standalone program parsed `Deno.args`.

In `src/command/call/cmd.ts`: add `import { latexmkCommand } from "./latexmk-cmd.ts";` and `.command("latexmk", latexmkCommand)` after `typst-gather`.

- [ ] **Step 5: Run the tests**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/call/latexmk.test.ts`
Expected: `--help` passes; the compile test passes where `pdflatex` exists (CI runners with TinyTeX), otherwise shows as ignored.

- [ ] **Step 6: Commit**

```bash
git add src/command/call/latexmk-cmd.ts src/command/call/cmd.ts src/command/render/latexmk/quarto-latexmk.ts tests/smoke/call/latexmk.test.ts tests/docs/latexmk/minimal.tex
git commit -m "call: add quarto call latexmk (the latexmk engine as a subcommand)"
```

### Task 2: Remove the Deno compile path

**Files:**
- Delete: `package/src/common/compile-quarto-latexmk.ts`, `package/src/util/deno.ts`
- Modify: `package/src/bld.ts`

- [ ] **Step 1: Delete and unregister**

```bash
git rm package/src/common/compile-quarto-latexmk.ts package/src/util/deno.ts
```

In `package/src/bld.ts` delete lines 15-17 (`import { compileQuartoLatexmkCommand, } from "./common/compile-quarto-latexmk.ts";`) and lines 111-113 (`commands.push(compileQuartoLatexmkCommand(),);`).

Run: `grep -rn "compile-quarto-latexmk\|util/deno\|QUARTO_DENO" package/src` -> no output; `cd package/src && ./quarto-bld --help | grep -c latexmk` -> `0`.

- [ ] **Step 2: Commit**

```bash
git add package/src/bld.ts
git commit -m "build: remove compile-quarto-latexmk and the deno compile helper"
```

### Task 3: Workflow

**Files:**
- Modify: `.github/workflows/test-quarto-latexmk.yml`

- [ ] **Step 1: Rewrite**

```yaml
# Test the latexmk engine entry point (`quarto call latexmk`) on every OS.
# Until Quarto 1.11 this built a standalone `tinitex` binary with `deno compile`;
# see dev-docs/runtime-migration/39-quarto-latexmk-packaging.md.
on:
  workflow_dispatch:
  push:
    branches: main
    paths-ignore:
      - ".claude/**"
  pull_request:
    branches: main
    paths-ignore:
      - ".claude/**"
name: Test quarto-latexmk

jobs:
  quarto-latexmk:
    runs-on: ${{ matrix.config.os }}

    name: ${{ matrix.config.os }}

    strategy:
      fail-fast: false
      matrix:
        config:
          - { os: windows-latest }
          - { os: macOS-latest }
          - { os: ubuntu-latest }

    steps:
      - uses: actions/checkout@v6
        with:
          fetch-depth: 0

      - name: Configure Quarto
        uses: ./.github/workflows/actions/quarto-dev

      - name: Install TinyTeX
        shell: bash
        run: quarto install tinytex --no-prompt

      - name: latexmk --help
        shell: bash
        run: |
          quarto call latexmk --help
          quarto call latexmk --version

      - name: Compile a minimal document
        shell: bash
        run: |
          mkdir -p out
          quarto call latexmk tests/docs/latexmk/minimal.tex --output-dir out --no-auto-install
          test -f out/minimal.pdf
```

`quarto install tinytex` is what `test-install.yml` already exercises on these runners; if the TinyTeX download is flaky, mark the compile step `continue-on-error: false` only after one green run.

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/test-quarto-latexmk.yml
git commit -m "ci: test-quarto-latexmk exercises quarto call latexmk instead of deno compile"
```

### Task 4: Changelog and docs

**Files:**
- Modify: `news/changelog-1.11.md`, `dev-docs/runtime-migration/docs-updates.md`

- [ ] **Step 1: Changelog**

Under `## Commands`, `### \`call\``:

```markdown
- ([#NNNNN](https://github.com/quarto-dev/quarto-cli/pull/NNNNN)): Add `quarto call latexmk <input.tex>`, Quarto's latexmk engine (automatic package installation, bibliography and index runs) as a subcommand. The experimental standalone `tinitex` build is no longer produced.
```

- [ ] **Step 2: Docs checklist**

Append a row to `dev-docs/runtime-migration/docs-updates.md`: `docs/output-formats/pdf-engine.qmd` (or wherever latexmk options are documented; verify) — mention `quarto call latexmk` for compiling an existing `.tex` file with Quarto's engine.

- [ ] **Step 3: Commit**

```bash
git add news/changelog-1.11.md dev-docs/runtime-migration/docs-updates.md
git commit -m "docs: quarto call latexmk"
```

## Verification

- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/call/latexmk.test.ts smoke/render/render-pdf*.test.ts` (whatever PDF smoke tests exist under `tests/smoke/render/`): green.
- `package/dist/bin/quarto call latexmk --help` prints usage; `package/dist/bin/quarto call latexmk tests/docs/latexmk/minimal.tex --output-dir /tmp/lmk` writes `/tmp/lmk/minimal.pdf` when TeX is installed.
- `cd package/src && ./quarto-bld --help` lists no `compile-quarto-latexmk`.
- `test-quarto-latexmk.yml` green on three OSes.
- `quarto run --dev tools/check-runtime-boundary.ts`: unchanged.

## Review checklist

- [ ] `pdf()` keeps its standalone behaviour (`tinitex` name) when run as a module entry; `quarto call latexmk --help` shows `quarto call latexmk`.
- [ ] `stopEarly()` is set so `--help`, `--log-level` and engine options reach `pdf()` untouched.
- [ ] No `deno compile`, `QUARTO_DENO`, `setup-deno` reference remains outside `dev-docs/runtime-migration/`.
- [ ] The workflow installs TinyTeX and compiles a document on all three OSes.
- [ ] Changelog entry under `## Commands`.

## Risks and rollback

- **Someone depends on the `tinitex-<os>` workflow artifacts.** Nothing in the repository or its documentation does; the artifacts expire after the retention period and were never attached to releases. If a user reports a need, implement the Appendix (Node SEA) in a follow-up.
- **`quarto call latexmk` and `quarto render --to pdf` share `generatePdf()`**: a bug in the subcommand plumbing cannot affect rendering because `pdf()` is only reached through `call latexmk` or the standalone entry.
- **Rollback to "keep Deno for tinitex"** (option A), if the subcommand must be withdrawn or a standalone binary is needed before the SEA path is built:

  ```bash
  git revert <commit of Task 2>          # restores compile-quarto-latexmk.ts, util/deno.ts, bld.ts registration
  git checkout <PR 33 merge commit> -- .github/workflows/test-quarto-latexmk.yml   # the setup-deno version
  ```

  `package/src/util/deno.ts` `compile()` needs `QUARTO_DENO` to point at a Deno binary; `denoland/setup-deno@v2` with `deno-version: v2.7.14` (the last release Quarto shipped) provides it in CI, and `quarto install deno` (PR 35) provides it locally (`QUARTO_DENO="$(quarto tools 2>/dev/null; echo ~/.local/share/quarto/deno/deno)"`; use `quarto check install` to find the path). This keeps working until Deno's releases stop being downloadable; the plan's recommendation exists so that date never matters.

## Decisions needed

1. **Keep `kExeVersion = "1.1"` as the `--version` of `quarto call latexmk`, or report Quarto's version?** Recommendation: report Quarto's version (`quartoConfig.version()`) when `programName !== kExeName`; one line in `pdf()`. The plan's acceptance criterion says `1.1` to match current behaviour; change both if the team prefers Quarto's version.
2. **Confirm that no standalone binary is required** (assessment section 9, decision 5). The team can answer this in the PR; if the answer is "required", execute the Appendix instead of Task 2 and keep the workflow building per OS.

## Appendix: Node SEA recipe (only if a standalone binary is required)

Untested in this sandbox (no `node --build-sea` run was possible here); every step comes from `doc/api/single-executable-applications.md` for Node 26.

1. Add a CommonJS entry, `src/command/render/latexmk/quarto-latexmk-sea.ts`:

   ```ts
   import { pdf } from "./quarto-latexmk.ts";
   import { mainRunner } from "../../../core/main.ts";
   import { args } from "../../../deno_ral/process.ts";
   mainRunner(() => pdf(args()));
   ```

2. Bundle it as CommonJS: extend `tools/node-bundle/build.mjs` with `--format cjs` (esbuild `format: "cjs"`, `--log-override:empty-import-meta=silent` because `isMainModule(import.meta)` in `quarto-latexmk.ts` evaluates `import.meta` as `{}` under CJS and returns false, which is correct).
3. `sea-config.json`:

   ```json
   { "main": "package/dist/bin/tinitex/tinitex.cjs", "output": "package/dist/bin/tinitex/tinitex", "disableExperimentalSEAWarning": true, "useCodeCache": false, "useSnapshot": false, "execArgv": ["--enable-experimental-regexp-engine", "--stack-trace-limit=100"] }
   ```

4. Per OS in `test-quarto-latexmk.yml`: `node --build-sea sea-config.json`, then `codesign --sign - package/dist/bin/tinitex/tinitex` on macOS (ad-hoc; the release pipeline would use the Developer ID), optional `signtool` on Windows, `./tinitex --help`.
5. Expect about 124 MB per binary; cross-building from Linux for the other OSes is possible by passing the target platform's `node` binary (downloaded by `package/src/common/dependencies/node.ts`) as `"executable"`, with code cache and snapshot off as above.
