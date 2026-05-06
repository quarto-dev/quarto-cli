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

**What qualifies:** Bugs introduced in a previous major.minor version (e.g., a 1.8 feature that broke in 1.9)

**Skip changelog entirely** when the regression was introduced by another change in the same version cycle. For example, if a 1.9 bug fix introduced a new bug also fixed in 1.9, the fix does not need a changelog entry — the original entry covers the feature area.

**Placement:** Always at TOP of the file, before Dependencies

**Workflow:** If you initially place an entry elsewhere and later determine it's a regression, move it to the Regression fixes section

## Backports

A backport adds the entry to **two changelog files**, each with its own location:

### On `main` (current dev version, e.g. `changelog-1.10.md`)

Entry goes under `## Regression fixes` (or another appropriate section). One file, flat `##` section list — same as any other entry on main. The `Regression fixes` section signals the change is also backported to stable; non-backported fixes go under `## Other fixes and improvements`.

### On the stable release branch (e.g. `changelog-1.9.md` on `v1.9`)

The stable changelog has a dual top-level structure that does NOT exist on main:

```markdown
# v1.10 backports

## In this release          <- backports landing in the next v1.9.x patch
## In previous releases     <- backports already shipped in earlier v1.9.x patches

# v1.9 changes

## Shortcodes
## Regression fixes         <- original v1.9 release fixes (NOT backports)
## Dependencies
...
```

**Backport entries always go under `# v{next} backports > ## In this release`.** Never under `## Regression fixes` of the `# v{this} changes` section — that section is frozen and tracks the original v1.x release.

**Lifecycle:** When the next v1.x.y patch ships, entries under `## In this release` get demoted to `## In previous releases` as part of release prep. Don't pre-empt this — leave them under `In this release` until release time.

### Workflow

1. Land the change on main with an entry in `changelog-{next}.md`.
2. Backport via cherry-pick to the stable branch. Drop the main changelog change from the cherry-pick (it modifies a file that doesn't exist on stable).
3. Add a separate commit on the stable branch adding the entry under `# v{next} backports > ## In this release` of `changelog-{this}.md`.

## What NOT to Put Here

**Highlights** are NOT changelog entries. They are:
- Promotional content for release announcements
- Managed in quarto-web: `docs/prerelease/{version}/_highlights.qmd`
- Separate from technical changelog

## Publication

Changelogs are published to quarto.org via:
- GitHub release attaches `changelog.md` asset
- quarto-web fetches and displays at `/docs/download/changelog/{version}/`
