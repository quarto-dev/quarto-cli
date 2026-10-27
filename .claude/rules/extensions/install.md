---
paths:
  - "src/extension/**"
  - "src/command/add/**"
  - "src/command/update/**"
  - "src/command/remove/**"
  - "src/command/use/**"
  - "tests/smoke/extensions/install.test.ts"
  - "tests/smoke/use/**"
---

# Extension installation

For how extensions are staged, namespaced and installed under `_extensions/`, how ids are looked up, and which behaviors the tests pin, see `llm-docs/extension-install-architecture.md`.

The namespace of an installed extension comes from where it is installed from (the GitHub owner, or none for local paths and archives), not from an owner folder in the source. This is deliberate: it keeps a fork or copy from overwriting another owner's extension. Read the doc's "The namespace rule" section before changing install layout or lookup.
