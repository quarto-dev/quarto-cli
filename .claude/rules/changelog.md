---
paths:
  - news/**
---

# Changelog Conventions

## File Organization

- One file per major.minor version: `news/changelog-{version}.md` (e.g., `changelog-1.9.md`)
- Check `configuration` file for current `QUARTO_VERSION`
- First line: `All changes included in {version}:`

## Section Hierarchy (strict order)

1. **`## Regression fixes`** - Always FIRST if present
2. **`## Dependencies`** - Bundled tool updates
3. **`## Formats`** - By output format (H3 subsections)
4. **`## Projects`** - By project type (H3 subsections)
5. **`## Publishing`** - By platform (H3 subsections)
6. **`## Lua API`** - Filter API changes
7. **`## Commands`** - CLI commands (H3 subsections)
8. **`## Extensions`** - Extension system changes
9. **`## Engines`** - Execution engines (H3 subsections)
10. **`## Other fixes and improvements`** - Always LAST

### Format Subsections
Use H3 headings with backtick-wrapped names:
```markdown
### `html`
### `typst`
### `pdf`
```

## Entry Format

```markdown
- ([#issue](url)): Description ending with period.
```

For external contributors (not core team):
```markdown
- ([#issue](url)): Description. (author: @username)
```

**Variations:**
- Pull requests: `([#13441](https://github.com/quarto-dev/quarto-cli/pull/13441))`
- External repos: `([rstudio/tinytex-releases#49](url))`
- No issue/PR (rare): Reference commit hash instead: `([commit](https://github.com/quarto-dev/quarto-cli/commit/abc123))`

## Writing Entries

**Language patterns:**
- **Fixes:** Start with "Fix" - describe what was broken
  - "Fix `icon=false` not working with typst format."
- **Enhancements:** Start with "Add" or "Support" - describe what was added
  - "Add support for `icon=false` in callouts."
- **Updates:** Start with "Update"
  - "Update `pandoc` to 3.8.3"

**Style:**
- Use backticks for code/options: `` `icon=false` ``
- Period at end of every description
- Author attribution `(author: @username)` for **external contributors only** - do NOT add for quarto-cli core team members

## Regression Fixes

**What qualifies:** Bugs introduced in recent versions (same major.minor)

**Placement:** Always at TOP of the file, before Dependencies

**Workflow:** If you initially place an entry elsewhere and later determine it's a regression, move it to the Regression fixes section

## Backports

When a fix is backported to a stable branch:
1. Entry exists in current version changelog (e.g., `changelog-1.9.md`)
2. **Also add entry to stable version changelog** (e.g., `changelog-1.8.md`)

## What NOT to Put Here

**Highlights** are NOT changelog entries. They are:
- Promotional content for release announcements
- Managed in quarto-web: `docs/prerelease/{version}/_highlights.qmd`
- Separate from technical changelog

## Publication

Changelogs are published to quarto.org via:
- GitHub release attaches `changelog.md` asset
- quarto-web fetches and displays at `/docs/download/changelog/{version}/`
