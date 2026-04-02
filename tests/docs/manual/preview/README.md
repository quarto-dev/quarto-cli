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
