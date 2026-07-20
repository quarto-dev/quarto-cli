---
paths:
  - ".github/workflows/test-smokes.yml"
  - ".github/workflows/test-smokes-built.yml"
  - ".github/workflows/test-ff-matrix.yml"
  - ".github/actions/build-dist-tarball/**"
---

# Built-Version CI Workflows

Before changing these workflows, read `llm-docs/built-version-testing-architecture.md` — the decision record (D1–D10) for the resolver + scheduler topology, the three test legs (smoke / playwright / ff-matrix), per-leg OS policy, and the reusable `test-ff-matrix.yml` interface. Settled trade-offs (no windows playwright leg, per-OS `playwright-report-*` artifact names, `workflow_run` wiring, the ff-matrix concurrency-group suffix) are recorded there — don't relitigate them by accident.

Invariants when editing:

- Every playwright/ff-matrix leg's `if:` in `test-smokes-built.yml` must keep BOTH the mode-resolution expression and the `github.event.inputs.buckets == ''` clause (a new leg that forgets the latter silently breaks the buckets-override semantics, with green CI).
- `test-ff-matrix.yml` owns the ff-matrix bucket glob — never duplicate it in a caller.
- Per-leg OS scope is set via the explicit `runners:` inputs on the scheduler jobs in `test-smokes-built.yml`, and only there.
- `test-ff-matrix.yml`'s top-level `concurrency` group needs its per-call suffix: a called workflow's concurrency evaluates in the caller's context, and a shared cancel-in-progress group would let one leg cancel a sibling.
