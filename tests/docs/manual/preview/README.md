# Manual Preview Tests

Tests for `quarto preview` behavior that require an interactive session with file-save events. These cannot run in automated smoke tests.

## Automation

Use the `/quarto-preview-test` command for the general workflow of starting preview, verifying with browser automation, and checking logs/filesystem. It documents the tools and patterns.

For browser interaction, `/agent-browser` is preferred over Chrome DevTools MCP (more token-efficient). See the command for details.

## Test Matrix: quarto_ipynb Accumulation (#14281)

After every test involving Jupyter execution (Python/Julia cells), verify:
1. `ls *.quarto_ipynb*` — at most one `{name}.quarto_ipynb` (no `_1`, `_2` variants)
2. After Ctrl+C exit — no `.quarto_ipynb` files remain (unless `keep-ipynb: true`)

For tests without Jupyter execution (T9, T10, T11), verify no `.quarto_ipynb` files are created at all.

### P1: Critical

#### T1: Single .qmd with Python — re-render accumulation

- **Setup:** `test.qmd` with Python code cell
- **Steps:** `quarto preview test.qmd`, save 5 times, check files, Ctrl+C
- **Expected:** At most one `.quarto_ipynb` at any time. Zero after exit.
- **Catches:** `invalidateForFile()` not deleting transient file before cache eviction

#### T2: Single .qmd with Python — startup duplicate

- **Setup:** Same `test.qmd`
- **Steps:** `quarto preview test.qmd`, check files immediately after first render (before any saves), Ctrl+C
- **Expected:** Exactly one `.quarto_ipynb` during render. Zero after exit.
- **Catches:** `cmd.ts` not passing ProjectContext to `preview()`

#### T3: .qmd in project — project-level preview

- **Setup:** Website project (`_quarto.yml` with `type: website`), `index.qmd` with Python cell
- **Steps:** `quarto preview` (project dir), save `index.qmd` 3 times, check files, Ctrl+C
- **Expected:** At most one `index.quarto_ipynb`. Zero after exit.
- **Catches:** Fix works when `projectContext()` finds a real project

#### T4: .qmd in project — single file preview

- **Setup:** Same project as T3
- **Steps:** `quarto preview index.qmd`, save 3 times, check files, Ctrl+C
- **Expected:** Same as T3. May redirect to project preview (expected behavior).
- **Catches:** Context passing works for files inside serveable projects

### P2: Important

#### T5: .qmd with Julia code cells

- **Setup:** `julia-test.qmd` with Julia cell
- **Steps:** Same as T1
- **Expected:** Same as T1. Julia uses the same Jupyter engine path.

#### T6: Rapid successive saves

- **Setup:** Same `test.qmd` as T1
- **Steps:** Save 5 times within 2-3 seconds (faster than render completes)
- **Expected:** At most one `.quarto_ipynb`. Debounce/queue coalesces saves.
- **Catches:** Race condition in invalidation during in-progress render

#### T7: `keep-ipynb: true`

- **Setup:** `test.qmd` with `keep-ipynb: true` in YAML
- **Steps:** Preview, save 3 times, Ctrl+C, check files
- **Expected:** `test.quarto_ipynb` persists after exit (not cleaned up). No `_1` variants during preview.
- **Catches:** `invalidateForFile()` respects the `transient = false` flag set by `cleanupNotebook()`

#### T8: `--to pdf` format

- **Setup:** Same `test.qmd` (requires TinyTeX)
- **Steps:** `quarto preview test.qmd --to pdf`, save 3 times
- **Expected:** Same as T1. Transient notebook logic is format-independent.

#### T9: Plain .qmd — no code cells (regression)

- **Setup:** `plain.qmd` with only markdown content
- **Steps:** Preview, save 3 times, check for `.quarto_ipynb` files
- **Expected:** No `.quarto_ipynb` files ever created.
- **Catches:** Fix is a no-op when no Jupyter engine is involved

#### T10: .qmd with R/knitr engine (regression)

- **Setup:** `r-test.qmd` with R code cell and `engine: knitr`
- **Steps:** Preview, save 3 times, check for `.quarto_ipynb` files
- **Expected:** No `.quarto_ipynb` files. Knitr doesn't use Jupyter intermediate.

#### T10b: File excluded from project inputs (regression)

- **Setup:** Website project with `_quarto.yml`. Create `_excluded.qmd` with a Python cell (files starting with `_` are excluded from project inputs by default)
- **Steps:** `quarto preview _excluded.qmd`, save 3 times, check files, Ctrl+C
- **Expected:** Falls back to single-file preview (not project preview). At most one `.quarto_ipynb`.
- **Catches:** Context reuse from cmd.ts incorrectly applying project semantics to excluded files

### P3: Nice-to-Have

#### T11: Native .ipynb file

- **Setup:** `notebook.ipynb` (native Jupyter notebook)
- **Steps:** Preview, save 3 times
- **Expected:** No transient `.quarto_ipynb` — the `.ipynb` is the source, not transient.

#### T12: File with spaces in name

- **Setup:** `my document.qmd` with Python cell
- **Steps:** `quarto preview "my document.qmd"`, save 3 times
- **Expected:** At most one `my document.quarto_ipynb`. Path normalization handles spaces.

#### T13: File in subdirectory

- **Setup:** `subdir/deep/test.qmd` with Python cell
- **Steps:** Preview from parent dir, save 3 times
- **Expected:** At most one transient notebook in `subdir/deep/`.

#### T14: Change code cell content

- **Setup:** `test.qmd` with `x = 1; print(x)`
- **Steps:** Change to `x = 2`, save; change to `x = 3`, save
- **Expected:** At most one `.quarto_ipynb`. Code changes trigger re-execution but file is cleaned.

#### T15: Change YAML metadata

- **Setup:** `test.qmd` with `title: "Test"`
- **Steps:** Change title, save; add `theme: cosmo`, save
- **Expected:** Same as T1. Metadata changes go through the same render/invalidation path.

#### T16: Multiple .qmd files in project

- **Setup:** Website with `index.qmd` (Python), `about.qmd` (Python), `plain.qmd` (no code)
- **Steps:** Preview project, edit index, navigate to about, edit about
- **Expected:** At most one `.quarto_ipynb` per Jupyter-using file. No accumulation.

## Test Matrix: Single-file Preview Root URL (#14298)

After every change to preview URL or handler logic, verify that single-file previews serve content at the root URL and print the correct Browse URL.

### P1: Critical

#### T17: Single-file preview — root URL accessible

- **Setup:** `plain.qmd` with only markdown content (no code cells)
- **Steps:** `quarto preview plain.qmd --port XXXX --no-browser`, then `curl -s -o /dev/null -w "%{http_code}" http://localhost:XXXX/`
- **Expected:** HTTP 200. Browse URL prints `http://localhost:XXXX/` (no filename appended).
- **Catches:** `projectHtmlFileRequestHandler` used for single files (defaultFile=`index.html` instead of output filename), or `previewInitialPath` returning filename instead of `""`

#### T18: Single-file preview — named output URL also accessible

- **Setup:** Same `plain.qmd`
- **Steps:** `quarto preview plain.qmd --port XXXX --no-browser`, then `curl -s -o /dev/null -w "%{http_code}" http://localhost:XXXX/plain.html`
- **Expected:** HTTP 200. The output filename path also serves the rendered content.
- **Catches:** Handler regression where only root or only named path works

### P2: Important

#### T19: Project preview — non-index file URL correct

- **Setup:** Website project with `_quarto.yml`, `index.qmd`, and `about.qmd`
- **Steps:** `quarto preview --port XXXX --no-browser`, navigate to `http://localhost:XXXX/about.html`
- **Expected:** HTTP 200. Browse URL may include path for non-index files in project context.
- **Catches:** `isSingleFile` guard accidentally excluding real project files from path computation

#### T33: knitr doc in a subdirectory — preview from that subdirectory (#14683)

- **Setup:** Fixture `knitr-subdir-14683/` — a website project with a knitr doc at `labs/doc.qmd` (an `{r}` chunk plus a `QUARTO_DOCUMENT_PATH` echo). Requires R + `rmarkdown`/`knitr`.
- **Steps:** From `knitr-subdir-14683/labs/` (the doc's own directory), run `quarto preview doc.qmd --to html --no-watch-inputs --no-browser --port XXXX` — the shape RStudio's Render button uses (bare filename, cwd = the doc's subdirectory).
- **Expected:** Renders without `Error in rmarkdown:::abs_path(input)`; `_site/labs/doc.html` is produced showing `[1] 2` (the R chunk executed). The echoed `QUARTO_DOCUMENT_PATH` is the doc's absolute subdirectory (ends in `labs`), not `.` / the project root (#12401).
- **Catches:** `fileExecutionEngineAndTarget` not normalizing the input to absolute — a cwd-relative `target.input`/`source` in the shared preview cache makes the knitr R subprocess (cwd = project dir) fail `abs_path` on the subdirectory-relative filename.
- **Automated coverage:** `tests/unit/preview-subdir-knitr-cwd.test.ts` exercises this same scenario end-to-end (real R/knitr subprocess) plus a deterministic cache-key guard. Manual rerun of this test is optional — only needed to hand-verify against a real `quarto preview` CLI/browser session (e.g. after changing the preview HTTP/format-resolution layer), since the automated test calls the internal render functions directly rather than spinning up the actual preview server.

## Test Matrix: Format Change Detection (#14533)

After every change to `previewRenderRequestIsCompatible` or the
`fileInformationCache` invalidation path, verify that a frontmatter
format edit is detected on the **first** render request.

### P1: Critical

#### T20: Single .qmd — `format: html` → `format: typst`

- **Setup:** `14533-format-change-detection.qmd` with `format: html`
- **Steps:** `quarto preview tests/docs/manual/preview/14533-format-change-detection.qmd`, edit frontmatter to `format: typst`, save, trigger one Preview render
- **Expected:** Output switches to typst on the first request. Preview process restarts.
- **Catches:** Stale `fileInformationCache` entry leaking previous format into `previewRenderRequestIsCompatible`

#### T21: Single .qmd — `format: typst` → `format: html`

- **Setup:** Same doc but starting at `format: typst`
- **Steps:** Same as T20 but reverse direction
- **Expected:** Same as T20 — direction-independent
- **Catches:** Asymmetric format-resolution path that only fires for html start state

### P2: Important

#### T22: Multi-format frontmatter — first-format change detected

- **Setup:** `format: [html, pdf]` initially
- **Steps:** Edit to `format: [typst, pdf]`, save, trigger one Preview render
- **Expected:** First format (typst) drives the compatibility check, preview restarts
- **Catches:** `previewFormat` picking up the wrong array element after invalidation

#### T23: Format change while preview is mid-render

- **Setup:** Doc with code cell long enough to render for several seconds
- **Steps:** Trigger preview, immediately edit frontmatter format mid-render, save
- **Expected:** No deadlock. Next render request after the in-flight one finishes resolves the new format.
- **Catches:** Cache-invalidation racing with cache-population in `renderForPreview`

### P3: Nice-to-Have

#### T24: File with spaces in name

- **Setup:** `my doc.qmd` with `format: html`
- **Steps:** Same as T20
- **Expected:** Same as T20. Path normalization handles the cache key correctly.

### Regression Guard

#### T25: Unchanged frontmatter — no spurious restart

- **Setup:** Any preview-able `.qmd`
- **Steps:** Save the file without editing the frontmatter format, trigger a Preview render
- **Expected:** No preview process restart. Render runs in the same process.
- **Catches:** Over-eager invalidation triggering 404 when the format is in fact unchanged

## Test Matrix: Brand Detection (#14593)

After every change to `projectResolveBrand` or the `project.brandCache` guard,
verify that a sibling `_brand.yml` added or removed **while a preview is running**
takes effect on the next render — without restarting the preview process. Fixture:
`brand-detection/` (`report.qmd`, `brand-imperial.yml`); drive it with the
`/quarto-preview-test` workflow. The
brand signal in the kept `report.typ` is the line
`#show link: set text(fill: rgb("#bc1e22")` (present ⇒ brand applied). See
`brand-detection/README.md` for the on/off check.

### P1: Critical

#### T28: Single .qmd — `_brand.yml` added mid-preview

- **Setup:** `brand-detection/report.qmd` (`format: typst`, `keep-typ: true`), no `_brand.yml` present
- **Steps:** `quarto preview report.qmd --to typst --no-browser`, copy `brand-imperial.yml` to `_brand.yml`, force one re-render (e.g. touch `report.qmd`), grep `report.typ`
- **Expected:** `report.typ` gains the brand link-color line. Brand applies without restarting preview.
- **Catches:** Stale `project.brandCache` serving "no brand" after a `_brand.yml` appeared

#### T29: Single .qmd — `_brand.yml` removed mid-preview

- **Setup:** Same fixture with `_brand.yml` present and the link colored
- **Steps:** Remove `_brand.yml`, force one re-render, grep `report.typ`
- **Expected:** The brand link-color line disappears — output reverts to no-brand
- **Catches:** Stale `project.brandCache` holding the previous brand after the file was removed

### P2: Important

#### T30: HTML format — `_brand.yml` added mid-preview

- **Setup:** `report.qmd` with `format: html`, no `_brand.yml`
- **Steps:** As T28, inspect the rendered HTML/CSS for the brand primary color
- **Expected:** Brand applies. `projectResolveBrand` is format-independent, so the same guard covers HTML.
- **Catches:** A fix that only worked for the typst code path

#### T31: Project (`_quarto.yml`) — `_brand.yml` added/removed mid-preview

- **Setup:** Website/book project with `_quarto.yml`, no project-level `_brand.yml`
- **Steps:** `quarto preview` the project, add then remove a `_brand.yml`, force re-renders between
- **Expected:** Brand applies on add and reverts on remove, both without restart
- **Catches:** The project (multi-file) `ProjectContext` sharing the same stale `brandCache`

### Regression Guard

#### T32: Unchanged `_brand.yml` — no spurious re-resolve cost

- **Setup:** A preview with a stable `_brand.yml`
- **Steps:** Save the source repeatedly without touching `_brand.yml`
- **Expected:** Brand stays applied; the source-state token matches so the cache is reused (only cheap stat calls per resolve)
- **Catches:** A guard that re-loads the brand on every render even when nothing changed

## Test Matrix: Sass Cache Reuse (#14594)

After every change to `SassCache.cleanup()` or the `_sassCache` registry in
`src/core/sass/cache.ts`, verify that a book/website preview survives repeated
re-renders instead of crashing with `BadResource: Bad resource ID`. On each
re-render the serve/watch reload path runs `refreshProjectConfig`
(`src/project/serve/watch.ts`, ~line 277 for HTML; also on config changes,
~line 305), which calls `project.cleanup()` and closes the session Sass KV
handle; the next render must open a fresh handle rather than reuse the closed
one. Fixture: `sass-cache-crash-14594/` (a flat multi-chapter book with
`theme: cosmo` + `css:`, which routes the theme through the session Sass cache);
drive it with the `/quarto-preview-test` workflow. Deterministic unit coverage
lives in `tests/unit/sass-cache.test.ts` — this matrix is the interactive
regression guide that path can't cover.

### P1: Critical

#### T34: Book project preview — `_quarto.yml` edit does not crash on Sass recompile

- **Setup:** `sass-cache-crash-14594/` book (`theme: cosmo`, `css: styles.css`), no prior `.quarto/` or `_book/`
- **Steps:** From the fixture dir, `quarto preview --no-browser --port XXXX`; after the first render, edit `_quarto.yml` (tweak the title or append a comment line) and save 3-5 times, watching the preview log
- **Expected:** Every re-render completes and reloads. No `BadResource: Bad resource ID` in the log. The cosmo theme + custom CSS keep recompiling/serving.
- **Catches:** `SassCache.cleanup()` closing the KV handle but leaving the stale instance in `_sassCache`, so the next resolve reuses a closed handle (#14594, #13955)

### P2: Important

#### T35: Book project preview — chapter content edit (content re-render path)

- **Setup:** Same fixture
- **Steps:** `quarto preview --no-browser --port XXXX`; after the first render, edit a chapter body (`index.qmd` / `chapter1.qmd`) and save 3-5 times
- **Expected:** Same as T34 — no crash, pages keep reloading
- **Catches:** The HTML reload path (`refreshProjectConfig` at watch.ts ~277) closes the session KV on a plain content re-render too, so a content save must not reuse a closed handle either

### Regression Guard

#### T36: Single-file preview — unaffected by the registry cleanup

- **Setup:** `plain.qmd` (markdown-only, no project)
- **Steps:** `quarto preview plain.qmd --no-browser --port XXXX`, save 3-5 times
- **Expected:** No crash and no behavior change — the fix is a no-op for the common single-file preview path
- **Catches:** The registry-entry deletion in cleanup accidentally breaking or churning the non-project preview path

## Extension Format PDF Preview (#14582)

### P1: Core functionality

#### T26: Book preview with extension PDF format
- **Setup**: `extension-pdf-book/` fixture
- **Steps**: `quarto preview . --to dummy-extension-pdf --no-browser --port 4444`
- **Expected**: Browse URL contains `web/viewer.html`. PDF.js viewer loads in browser with live-reload.
- **Catches**: `isFormatTo` startsWith check failing for extension format strings.

#### T27: Book preview with extension HTML format (no regression)
- **Setup**: Same fixture
- **Steps**: `quarto preview . --to dummy-extension-html --no-browser --port 4444`
- **Expected**: Normal HTML preview with live-reload. No PDF.js viewer.
- **Catches**: Fix doesn't accidentally enable PDF mode for non-PDF extension formats.

## Test File Templates

**Minimal Python .qmd:**
```yaml
---
title: "Preview Test"
---
```

````
```{python}
print("Hello from Python")
```
````

```
Edit this line to trigger re-renders.
```

**Minimal website project (`_quarto.yml`):**
```yaml
project:
  type: website
```

**keep-ipynb variant:**
```yaml
---
title: "Keep ipynb Test"
execute:
  keep-ipynb: true
---
```
