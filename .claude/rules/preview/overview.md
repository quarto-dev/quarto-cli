---
paths:
  - "src/command/preview/**"
  - "src/project/serve/**"
  - "src/preview/**"
---

# Preview System

For how `quarto preview` works end-to-end — CLI entry, the branching logic in `cmd.ts`, single-file vs project preview lifecycle, and file watching — see `llm-docs/preview-architecture.md`.

## Verifying a preview change

No automated test starts the preview server: unit tests call preview internals directly, and the Playwright suite serves pre-rendered files with `python -m http.server`. Automated preview coverage is a project of its own, tracked in #10696, so a fix PR verifies manually with the `/quarto-preview-test` skill. Keep throwaway harness scripts outside the repo; a reusable technique goes in that skill's `references/`, not in `tests/`.
