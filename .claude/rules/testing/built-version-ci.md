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

Use `llm-docs/built-version-testing-architecture.md` for detailed context. Read only the sections relevant to the edit:

- OS lists, bucket globs, concurrency-group suffixes, `runners:` inputs → "Built-mode test legs" (scheduler layout).
- Adding/reordering a leg, changing `quarto-install` resolution or artifact plumbing → "Flow diagrams" + "Built-mode test legs".
- Removing, inverting, or simplifying an existing mechanism → "Design decisions" (D1-D11) first.

For a one-line YAML edit, the invariants below and the document map are enough.

Invariants when editing:

- Playwright and ff-matrix legs in `test-smokes-built.yml` must check both `needs.resolve-mode.outputs.mode` and `github.event.inputs.buckets == ''`.
- `test-ff-matrix.yml` owns the ff-matrix bucket glob.
- Scheduler jobs in `test-smokes-built.yml` set per-leg OS scope through their `runners:` inputs.
- Keep the per-call suffix in `test-ff-matrix.yml`'s concurrency group so sibling calls cannot cancel one another.
- Every `test-smokes.yml` / `test-ff-matrix.yml` call site passes a `label-tag`: it is what keeps CI failure labels distinct between same-OS jobs in a run's concatenated step summary. Tags need only differ among call sites that can land on the same OS — the per-OS nightly legs share one tag deliberately, since the label already carries an OS prefix.
