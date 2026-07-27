---
paths:
  - "**/*.ts"
  - "**/*.js"
  - "**/*.lua"
---

# Copyright headers

New source files get a single current-year header — `Copyright (C) <year> Posit Software, PBC` (e.g. `2026`), not a back-dated `2020-<year>` range. Leave existing files' headers alone unless you're already substantially editing them.

Don't guess the year — read it from the system (`date +%Y`, or the current date stated at session start). Copying a header from an existing file carries a stale year.
