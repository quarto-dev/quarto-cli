---
paths:
  - .github/workflows/test-smokes.yml
  - .github/workflows/test-smokes-built.yml
  - .github/workflows/test-smokes-parallel.yml
  - .github/workflows/test-ff-matrix.yml
  - .github/workflows/update-test-timing.yml
  - src/tools/github.ts
  - tests/test.ts
  - tests/gha-grouping.ts
  - tests/integration/playwright-tests.test.ts
  - tests/tools/check-gha-log.ts
  - tests/unit/check-gha-log.test.ts
  - tests/unit/gha-grouping.test.ts
  - tests/unit/github-actions-reporting.test.ts
  - tests/unit/harness-failure-reporting.test.ts
  - tests/unit/harness-reporting-fixture.ts
---

# GitHub Actions test reporting

`llm-docs/github-actions-test-reporting.md` is the deep dive. Read only the
sections relevant to the edit:

- Workflow ownership or environment wiring: "Ownership" and "Workflow contract".
- Group opening, closing, or log validation: "Log grouping" and "Verification".
- Annotations, labels, excerpts, or step summaries: "Failure reporting" and
  "Annotation budget and labels".

For a trivial edit, the invariants below are sufficient.

Keep these invariants:

- A step has one group and annotation owner. Bucket loops set
  `QUARTO_TESTS_GHA_ORCHESTRATED=1`; otherwise the harness owns them.
- Step-summary entries are emitted in both paths.
- Failure lines and Deno's final failure sections remain outside groups.
- The annotation count is step-wide; Deno module state is only per test file.
- Every reusable-workflow call passes a `label-tag` that distinguishes same-OS
  jobs in the run summary.
- Do not enable parallel test-file execution without redesigning grouping.
