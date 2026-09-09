---
paths:
  - "src/command/call/axe/**"
  - "tests/unit/axe-*.test.ts"
  - "tests/smoke/axe/**"
  - "tests/docs/axe-scan/**"
---

# Axe Scan Command (`quarto call axe`)

For the scanner's architecture — pipeline, mode discovery, signatures,
baseline semantics, exit codes, and the rationale behind each — see
`llm-docs/axe-scan-architecture.md`.

For how to use the command (flags, baseline workflow, CI recipe), see
`dev-docs/axe-scan.md`.

The signature normalization scheme is pinned by
`tests/unit/axe-signature.test.ts`: changing `normalizeSelector` or
`signatureOf` in a way that re-keys signatures requires bumping
`kSignatureScheme` in `schemas.ts` on purpose.
