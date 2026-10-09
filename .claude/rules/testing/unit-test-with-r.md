---
paths:
  - "tests/unit/preview-subdir-knitr-cwd.test.ts"
  - "tests/smoke/embed/render-embed-website-rerender.test.ts"
---

# R tests that change working directory

These tests run a knitr subprocess with cwd set to a scratch or fixture
directory (required to reproduce the bug). R's `.Rprofile` lookup is
cwd-exact, so it won't pick up `tests/renv` activation there — on CI the R
subprocess fails with `there is no package called 'rmarkdown'`. `setup()`
calls `writeTestsRenvProfile(dir)` (`tests/utils.ts`), which writes a
`.Rprofile` into the fixture dir to re-activate renv against the real
`tests/` project. Any new test whose knitr cwd is outside `tests/` needs the
same call.

**Details:** `llm-docs/testing-patterns.md` → "R Tests That Change Working Directory"
