---
paths:
  - "llm-docs/**"
---

# LLM Documentation Maintenance

The `llm-docs/` directory contains documentation written for LLM assistants working on the Quarto codebase. These docs capture architectural understanding that would otherwise require extensive codebase exploration.

## Staleness Check

Each document has YAML frontmatter with analysis metadata:

```yaml
---
main_commit: abc1234   # merge-base with main (stable reference)
analyzed_date: 2025-01-22
key_files:
  - path/to/file1.ts
  - path/to/file2.lua
---
```

**Why merge-base?** Branch commits can be rebased or disappear. The merge-base with main is stable and represents the baseline from main that was analyzed.

**Before relying on a document**, check if key files have changed:

```bash
git log --oneline <main_commit>..main -- <key_files>
```

If there are significant changes, re-explore the codebase and update the document.

## Updating Documents

After re-analyzing, update the frontmatter:

```bash
# Get merge-base with main (use upstream/main if that's the main remote)
git merge-base HEAD main | cut -c1-9
```

Then update `main_commit`, `analyzed_date`, and verify `key_files` list is complete.

**Date verification:** Before writing dates, check today's date from the system environment (shown at conversation start). This avoids year typos like writing 2025 when it's 2026.

## Document Purpose

These docs are:
- Architectural overviews for AI assistants
- File location maps for common tasks
- Pattern documentation for consistency

They are NOT:
- User documentation (that's at quarto.org)
- Code comments (those live in source files)
- Issue-specific notes (those go in PR descriptions)
