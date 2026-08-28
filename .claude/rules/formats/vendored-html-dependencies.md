---
paths:
  - "src/resources/formats/html/**"
---

# Vendored HTML Dependencies

Files under `src/resources/formats/html/*/` (e.g. `axe`, `anchor`, `popper`, `clipboard`,
`tippy`, `glightbox`, `fuse`, `bootstrap`) are vendored third-party dependencies, managed by
`package/src/common/update-html-dependencies.ts` — not hand-edited.

## Verify provenance before trusting a change

When reviewing a change to one of these files, fetch the same version from upstream and compare
its hash with the committed file using `curl -sL <upstream-url> | sha256sum`. Do not rely on
the diff alone. These same-origin vendored files don't need SRI (`integrity=`), which protects
cross-origin CDN loads rather than vendored files.

Note: `anchor`, `popper`, `clipboard`, `tippy`, and `fuse` have their `sourceMappingURL`
comment stripped by the updater (`cleanSourceMap()` in `update-html-dependencies.ts`) before
being committed. As a result, a raw hash against upstream will differ by that line even for a
correctly generated file. Strip the same comment before comparing, or rerun the updater and
diff its output instead of calculating the hash manually. `axe` and `glightbox` aren't
post-processed this way and hash directly against upstream.
