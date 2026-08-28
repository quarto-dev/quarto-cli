---
paths:
  - "src/resources/formats/html/**"
---

# Vendored HTML Dependencies

Files under `src/resources/formats/html/*/` (e.g. `axe`, `anchor`, `popper`, `clipboard`,
`tippy`, `glightbox`, `fuse`, `bootstrap`) are vendored third-party dependencies, managed by
`package/src/common/update-html-dependencies.ts` — not hand-edited.

## Verify provenance before trusting a change

Reviewing a change to one of these files: fetch the same version from upstream and compare
hashes rather than trusting the diff — `curl -sL <upstream-url> | sha256sum` against the
committed file. These same-origin vendored files don't need SRI (`integrity=`); that only
protects cross-origin CDN loads, which is what vendoring replaces.
