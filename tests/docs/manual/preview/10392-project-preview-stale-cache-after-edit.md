# Project preview serves stale rendered output after source edit (#10392)

Manual preview test for the `fileInformationCache.fullMarkdown` staleness bug on the project preview path (website / book). Reproduces deterministically.

## What this catches

In a project preview, after editing a non-index `.qmd`:

- The HTML file in `_site/` IS regenerated (mtime advances).
- The HTML body content does NOT contain the edit.
- The browser reload signal fires but the served HTML is stale.
- Stopping and restarting `quarto preview` clears the bug for the first edit; the second edit reproduces it.

**Root cause:** the persistent `ProjectContext` returned by `watcher.project()` owns a long-lived `fileInformationCache`. The HTTP-handler render in `src/project/serve/serve.ts` reuses that context. Without invalidation on watcher events, `projectResolveFullMarkdownForFile` (`src/project/project-shared.ts`) returned the pre-edit expanded markdown for the post-watcher HTTP-handler render call. The fix invalidates on watcher events (surgical) and adds an `mtime + size` freshness check to the cache (defense-in-depth).

## Setup

Use the existing website fixture at `tests/docs/manual/preview/project-preview/`. It contains:

```
_quarto.yml          # type: website
index.qmd            # home page
about.qmd            # non-index page used by T1, T2, T6, T7
styles.css
```

The bug does not require code execution; pure prose edits to `about.qmd` trigger it. T7 needs a Jupyter-flavored input — use `tests/docs/manual/preview/keep-ipynb.qmd` or any `.qmd` with a Python code cell.

## P1: Critical

### T1: Edit a non-index `.qmd`, observe stale HTML body

- **Setup:** Use the fixture `tests/docs/manual/preview/project-preview/`. The default body of `about.qmd` is `About this site`.
- **Steps:**
  1. `cd tests/docs/manual/preview/project-preview && quarto preview`.
  2. Wait for preview to load and the default browser tab to open.
  3. Navigate the browser to `http://localhost:<port>/about.html`.
  4. In `about.qmd`, replace `About this site` with `MARKER-UNIQUE-STRING`. Save.
  5. Wait 10 seconds (let watcher + re-render settle).
  6. `Select-String -Path '_site/about.html' -Pattern MARKER-UNIQUE-STRING`
  7. `curl http://127.0.0.1:<port>/about.html | Select-String MARKER-UNIQUE-STRING`
  8. Reload the browser tab.
- **Expected (after fix):** Step 6 and step 7 both return a match. Step 8 shows the new paragraph.
- **Catches:** Persistent `watcher.project().fileInformationCache.fullMarkdown` returning stale expanded markdown to the HTTP-handler `renderProject` call site in `src/project/serve/serve.ts`.

### T2: Repeat the edit a second time

- **Setup:** Same as T1. Preview already running.
- **Steps:**
  1. After T1 (do not restart preview).
  2. Edit `about.qmd` again, change `MARKER-UNIQUE-STRING` to `MARKER-SECOND-STRING`. Save.
  3. Wait 10 seconds.
  4. Repeat steps 6-8 of T1 with the new string.
- **Expected (after fix):** Both checks find the new string.
- **Catches:** Second-edit regression — verifies the fix invalidates the cache on every edit, not only on the first.

### T3: Edit `index.qmd`

- **Setup:** Same project.
- **Steps:**
  1. Edit `index.qmd`, add `INDEX-MARKER.` paragraph. Save.
  2. Wait 10 seconds.
  3. Check `_site/index.html` and the served `/index.html` for `INDEX-MARKER`.
- **Expected:** Both find the marker. This case worked before the fix too — keep it in the suite to confirm no regression on the index path.

## P2: Important

### T4: Edit affects sibling pages via cross-reference

- **Setup:** Extend the fixture: add a `secondary.qmd` next to `about.qmd` containing a figure with `#fig-x`, then in `about.qmd` reference it via `@fig-x`.
- **Steps:**
  1. Preview running.
  2. Edit the `#fig-x` label in `secondary.qmd`.
  3. Verify `_site/about.html` cross-reference text updates.
- **Catches:** Cache invalidation does not propagate to other files in the project that reference the changed file. Lower priority because the immediate symptom (stale body on the directly-edited file) is the main bug.

### T7: Concurrent saves during in-flight HTTP-handler render (Jupyter input)

This case proves the surgical-fix invalidation is correctly serialized with the render queue. Before the fix at the queue level, `invalidateForFile` ran **before** `submitRender`, so a concurrent in-flight render (typically the HTTP-handler's `renderProject` call) could lose its transient `.quarto_ipynb` mid-read and fail intermittently. After the fix, invalidation runs inside the `submitRender` callback so the queue serializes it with prior renders.

- **Setup:** Use a Jupyter `.qmd` (e.g., `tests/docs/manual/preview/keep-ipynb.qmd` rendered into a website project, or copy a Python-cell `.qmd` into `project-preview/`). The input must produce a transient `.quarto_ipynb` for the race to be reachable.
- **Steps:**
  1. `quarto preview` against the project containing the Jupyter `.qmd`.
  2. Open the page in the browser to trigger an HTTP-handler render that reads the transient `.quarto_ipynb`.
  3. While the HTTP-handler render is still in flight (best done by editing during a long-running Python cell), save the `.qmd` 5 times in quick succession (≤ 1s between saves). Aim to fire the watcher while step 2's render is still executing.
  4. Watch the `quarto preview` console for errors of the form "file not found" / "cannot read `.quarto_ipynb`" / `ENOENT`.
- **Expected (after fix):** No file-not-found errors in the console. All renders complete cleanly. Final HTML reflects the latest edit.
- **Catches:** Race between watcher-triggered `invalidateForFile` and an in-flight render holding the transient notebook open. Window is narrow but reproducible on slow Python cells (use a `time.sleep(5)` cell to widen it).

## P3: Polish

### T5: `freeze: auto` + pure markdown edit

- **Setup:** Add `execute: freeze: auto` to `_quarto.yml`.
- **Steps:**
  1. T1 with `freeze: auto`.
- **Expected:** Same outcome as T1 (freeze should not affect plain markdown).

### T6: WebSocket reload target points at the right page

- **Setup:** Browser open on `/about.html`.
- **Steps:** T1, watch the browser console.
- **Expected:** WebSocket reload signal fires; the page reloads with the new content.

## Cleanup

`quarto preview` exit (Ctrl+C). No persistent state to clean up beyond `_site/` which the next preview run rebuilds.

## Related

- `tests/docs/manual/preview/README.md` — manual preview test matrix
- `tests/docs/manual/preview/14281-quarto-ipynb-accumulation.qmd` — neighboring manual test (different bug, similar structure)
