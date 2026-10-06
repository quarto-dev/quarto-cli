---
paths:
  - "src/command/render/render.ts"
  - "src/command/render/pandoc.ts"
  - "src/command/render/types.ts"
  - "src/format/html/**/*"
  - "src/project/types/website/**/*"
---

# HTML postprocessors and finalizers

Adding or changing an HTML postprocessor or finalizer: factories take the raw render inputs (`source`, `project`, `format`, `flags`, ...) and derive what they need inside, not narrow pre-computed values. Contracts, run order, and output gating: see `llm-docs/html-postprocessors-finalizers.md`.
