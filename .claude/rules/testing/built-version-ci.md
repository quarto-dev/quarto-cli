---
paths:
  - .github/workflows/test-smokes.yml
  - .github/workflows/test-smokes-built.yml
  - .github/workflows/test-ff-matrix.yml
  - .github/workflows/create-release.yml
  - .github/actions/build-dist-tarball/**
  - .github/actions/merge-extension-tests/**
---

# Built-Version CI Workflows

Before changing these files, read `llm-docs/built-version-testing-architecture.md`.
It records the resolver and scheduler design, test legs, OS policy, and reusable workflow interfaces.

Invariants when editing:

- Playwright and ff-matrix legs in `test-smokes-built.yml` must check both the source mode and `github.event.inputs.buckets == ''`.
- `test-ff-matrix.yml` owns the ff-matrix bucket glob.
- Scheduler jobs in `test-smokes-built.yml` set per-leg OS scope through their `runners:` inputs.
- Keep the per-call suffix in `test-ff-matrix.yml`'s concurrency group so sibling calls cannot cancel one another.
