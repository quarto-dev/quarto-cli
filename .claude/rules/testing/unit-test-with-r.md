---
paths:
  - "tests/unit/preview-subdir-knitr-cwd.test.ts"
---

# R unit test that changes working directory

This test runs a knitr subprocess with cwd set to a scratch directory
(required to reproduce the bug). R's `.Rprofile` lookup is cwd-exact, so it
won't pick up `tests/renv` activation there — on CI the R subprocess fails
with `there is no package called 'rmarkdown'`. `setup()` writes a
`.Rprofile` into the fixture dir to re-activate renv against the real
`tests/` project.

**Details:** `llm-docs/testing-patterns.md` → "R Tests That Change Working Directory"
