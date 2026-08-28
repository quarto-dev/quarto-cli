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

Note: `anchor`, `popper`, `clipboard`, `tippy`, and `fuse` have their `sourceMappingURL`
comment stripped by the updater (`cleanSourceMap()` in `update-html-dependencies.ts`) before
being committed, so a raw hash against upstream will mismatch on that one line even for a
correctly generated file — strip the same comment before comparing, or re-run the updater and
diff its output instead of hand-hashing. `axe` and `glightbox` aren't post-processed this way
and hash directly against upstream.
