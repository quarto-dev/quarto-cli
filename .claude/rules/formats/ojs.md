---
paths:
  - "src/execute/ojs/**"
  - "packages/ojs/**"
  - "src/resources/formats/html/ojs/**"
  - "src/resources/filters/quarto-post/ojs.lua"
---

# OJS

`src/resources/formats/html/ojs/quarto-ojs-runtime{,.min}.js` are build output of `packages/ojs`: change the sources there, then rebuild with `npm ci && npm run build` in `packages/ojs` and commit both bundles with the source change. CI fails when committed bundles differ from a rebuild. `quarto-ojs.css` is edited in place.

Architecture (compile path, runtime injection, inline expressions, `ojs_define`, tests): `llm-docs/ojs-architecture.md`. Update procedure and verification checklist: `dev-docs/update-ojs-runtime.md`.
