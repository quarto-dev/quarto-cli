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

`llm-docs/built-version-testing-architecture.md` is the deep dive. Read only what the edit needs:

- OS lists, bucket globs, concurrency-group suffixes, `runners:` inputs → "Built-mode test legs" (scheduler layout).
- Adding/reordering a leg, changing `quarto-install` resolution or artifact plumbing → "Flow diagrams" + "Built-mode test legs".
- Removing, inverting, or "simplifying" an existing mechanism → "Design decisions" (D1-D11) first — each records why the obvious alternative was rejected.

Trivial one-line YAML edits: the invariants below plus the doc's "Document map" intro paragraph are enough.

Invariants when editing:

- Playwright and ff-matrix legs in `test-smokes-built.yml` must check both the source mode and `github.event.inputs.buckets == ''`.
- `test-ff-matrix.yml` owns the ff-matrix bucket glob.
- Scheduler jobs in `test-smokes-built.yml` set per-leg OS scope through their `runners:` inputs.
- Keep the per-call suffix in `test-ff-matrix.yml`'s concurrency group so sibling calls cannot cancel one another.
