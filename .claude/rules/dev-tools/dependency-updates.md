---
description: "Bundled dependency version bumps (Deno, Pandoc, Dart Sass, Typst, esbuild, veraPDF)"
paths:
  - "configuration"
  - "src/command/check/check.ts"
---

# Bundled Dependency Updates

Bumping any bundled binary version starts here: see `dev-docs/upgrade-dependencies.md` for the general procedure (version numbers, `check.ts` constraints, the installer signing/notarization dry-run gate before merging). For Pandoc specifically, `dev-docs/upgrade-dependencies.md` links to `dev-docs/update-pandoc-checklist.md` (template resync, schema/lua-types checks, CI smoke-test path).
