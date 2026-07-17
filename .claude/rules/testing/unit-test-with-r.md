---
paths:
  - "tests/unit/preview-subdir-knitr-cwd.test.ts"
---

# `preview-subdir-knitr-cwd.test.ts` — forced renv activation

The first test case (`preview of a knitr subdir doc from that subdir's cwd
renders (#14683)`) writes a `.Rprofile` into its scratch project directory
during `setup()`. If this test starts failing on CI with an R error like:

```
Error in library(rmarkdown) : there is no package called 'rmarkdown'
```

read this before touching product code (`src/execute/rmd.ts`,
`src/execute/engine.ts`) — it is very likely this workaround, not a
regression in Quarto itself.

## Why it's there

The test reproduces quarto-dev/quarto-cli#14683, which only manifests when
the process's working directory is the *document's subdirectory* (not the
project root, not `tests/`). The test harness enforces this with
`TestContext.cwd(() => e2eLabsDir)`, which does a real `Deno.chdir()` into a
scratch temp dir outside the repo checkout for the duration of the test.

R's own `.Rprofile` lookup at startup is **cwd-exact** — it checks only the
process's own working directory, with no parent-directory search. Normal
smoke-all knitr renders never `chdir` away from `tests/` (they compute a
path *relative to* the current cwd instead — see `smoke-all.test.ts`), so
their R subprocess spawns with cwd = `tests/`, finds `tests/.Rprofile`, and
activates the `tests/renv` project automatically. This test's cwd is a
scratch dir with no `.Rprofile` of its own, so that activation never
happens.

On CI, rmarkdown/knitr are installed **only** inside `tests/renv`'s project
library (see `tests/renv.lock`, `tests/configure-test-env.ps1|sh`) — not in
a global/system R library. Without renv activation, R falls back to
`R_LIBS_USER`/the base library, rmarkdown/knitr aren't there, and the
knitr subprocess fails before ever reaching the #14683 code path. The
failure is fast (well under a second) and mostly silent: `renderProject`
swallows the underlying rejection into a bare `Error` with no message
(see `src/command/render/render-files.ts`'s catch block), so the test's own
`result.error` diagnostic won't show the real cause either — only the raw
Rscript stderr does.

This never showed up locally because a typical dev machine (e.g. an R
install managed by `rig`) has rmarkdown/knitr in a library that's on
`.libPaths()` regardless of renv activation.

## The fix

`setup()` writes a `.Rprofile` into the scratch project dir (`e2eProjDir` —
the directory `callR` actually spawns Rscript in for a non-single-file
project) containing:

```r
Sys.setenv(RENV_PROJECT = "<absolute path to tests/>")
source("<absolute path to tests/>/renv/activate.R")
```

`tests/renv/activate.R` reads `RENV_PROJECT` to determine the project root
if it's set, falling back to `getwd()` otherwise (see the top of that file).
Setting it explicitly makes renv activate against the *real* `tests/renv`
project and library, regardless of the fixture's own cwd. The absolute path
is derived from `import.meta.url` (this test file's own location), not an
env var, so it's self-contained.

## If this breaks again

- Confirm the theory by reading the raw Rscript stderr in the CI log for
  this test (search the job log for `preview-subdir-knitr-cwd`) — a missing
  package error confirms renv never activated.
- Check whether `tests/renv/activate.R`'s `RENV_PROJECT` handling changed
  (a renv version bump could alter this contract).
- Check whether `withinActiveRenv()` in `src/execute/rmd.ts` changed — it
  decides the R subprocess's actual spawn cwd (`Deno.cwd()` vs
  `projectDir`), which is where R looks for `.Rprofile` at startup.
- The second test in this file (`fileExecutionEngineAndTarget yields an
  absolute target...`) is R-free and does not need this workaround — it
  only exercises `fileExecutionEngineAndTarget`, never spawns Rscript.
