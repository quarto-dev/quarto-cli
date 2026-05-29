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

## Blast-radius regression protocol

The fix touches two surfaces with different reach:

- **A — `invalidateForFile(input)` loop in `src/project/serve/watch.ts`.** Runs in **project preview only**. Calls a function already used elsewhere (#14281, `preview.ts`); only the call site is new.
- **B — `mtime + size` guard in `projectResolveFullMarkdownForFile` (`src/project/project-shared.ts`).** Runs **everywhere** the function is called: every render (single doc + project), the single-file project type, `quarto inspect`, and the knitr (`rmd.ts`) and jupyter (`jupyter.ts`) execute paths.

Outside preview, B is functionally a no-op (a one-shot context never sees the source change mid-life, so the guard always agrees with the old cache), but it adds one `Deno.statSync` per cache hit. The cases below confirm both that the fix works on its target surfaces and that the wide change B introduces no regression or perceptible cost elsewhere.

These are interactive preview tests (require real file-save events) and cannot run as automated smoke tests. Drive them with `/quarto-preview-test`. The `#14281` accumulation matrix in `README.md` covers transient-notebook *accumulation*; the cases here cover *content freshness after an edit*, a different axis.

### P1: Critical

#### T8: Single-document preview — freshness after body edit (guard B, single-file path)

- **Setup:** `tests/docs/manual/preview/plain.qmd` (pure markdown, no project).
- **Steps:**
  1. `quarto preview tests/docs/manual/preview/plain.qmd`.
  2. Edit a body line to `MARKER-T8`. Save. Wait 5s.
  3. `curl http://127.0.0.1:<port>/ | Select-String MARKER-T8` and reload the browser.
- **Expected:** Both find `MARKER-T8`.
- **Catches:** Guard B regressing the single-file project type's resolve path — the one surface where single-doc preview leans on B alone (no watcher invalidation A).

#### T9: Project + Jupyter `.qmd` — freshness after edit, no accumulation

- **Setup:** In `project-preview/`, add `pycell.qmd` with a Python cell (`print("v1")`) and link it from `index.qmd`. Requires the Python test env.
- **Steps:**
  1. `cd tests/docs/manual/preview/project-preview && quarto preview`.
  2. Open `/pycell.html`. Change the cell to `print("v2")`. Save. Wait 10s.
  3. Check `_site/pycell.html` and the served page for `v2`.
  4. `ls *.quarto_ipynb*` — confirm at most one `pycell.quarto_ipynb`, no `_1`/`_2` variants.
- **Expected:** Fresh `v2` output; at most one transient notebook; zero after Ctrl+C.
- **Catches:** A interacting badly with the #14281 transient cleanup, or stale jupyter output surviving the edit.

#### T10: Project + raw `.ipynb` input — source preserved, content fresh

- **Setup:** Copy a native `.ipynb` (the `T11` notebook from the README #14281 matrix, or any executed notebook) into `project-preview/` as `notebook.ipynb`; link from `index.qmd`.
- **Steps:**
  1. `quarto preview` the project. Open `/notebook.html`.
  2. Edit a markdown cell in `notebook.ipynb` to add `MARKER-T10`. Save. Wait 10s.
  3. After Ctrl+C, confirm `notebook.ipynb` still exists on disk.
- **Expected:** `MARKER-T10` in served HTML; `notebook.ipynb` **not deleted** (its cache entry has `transient = false`, so `invalidateForFile` must not `safeRemoveSync` it).
- **Catches:** The new A call site firing `invalidateForFile` on a user `.ipynb` and wrongly deleting the source.

### P2: Important

#### T11: Project + knitr `.qmd` — freshness after edit (regression for guard B on `rmd.ts`)

- **Setup:** In `project-preview/`, add `rcell.qmd` with `engine: knitr` and an R cell (`print("r-v1")`); link from `index.qmd`. Requires the R test env.
- **Steps:** Preview the project; change the cell to `print("r-v2")`; save; wait 10s; check served `/rcell.html`.
- **Expected:** Fresh `r-v2`. No `.quarto_ipynb` files (knitr has no jupyter intermediate).
- **Catches:** Guard B regressing the knitr resolve path (`src/execute/rmd.ts:245`).

#### T12: Format-change + stale-body invalidation coexist in one project preview

- **Setup:** `project-preview/about.qmd`, default `format: html`.
- **Steps:**
  1. Preview the project. Edit `about.qmd` body to `MARKER-T12a`. Save. Confirm fresh (the #10392 path, A).
  2. Without restarting, edit `about.qmd` frontmatter to `format: typst`. Save. Trigger one render.
- **Expected:** Step 1 serves fresh body; step 2 detects the format change (#14533) without the two invalidation sites — `watch.ts` (A) and `preview.ts` compatibility check — conflicting.
- **Catches:** Double-invalidation interaction (over-eager eviction → spurious 404, or under-eager → stale format). Cross-ref `README.md` #14533 T20–T25.

### P3: Polish

#### T13: `quarto inspect` after an edit (guard B + added `statSync`)

- **Setup:** Any project file.
- **Steps:** `quarto inspect <file>`, edit the file, `quarto inspect <file>` again in the same shell.
- **Expected:** Both succeed; second reflects the edit. No error from the added `Deno.statSync`.
- **Catches:** Guard B or the stat breaking the inspect resolve calls (`src/inspect/inspect.ts`).

#### T14: Book / many-file project — perf sanity for per-hit `statSync`

- **Setup:** A multi-chapter book (10+ inputs), e.g. `quarto create project book`.
- **Steps:** `quarto render` the book cold, then `quarto preview` and edit one chapter.
- **Expected:** No perceptible slowdown vs `upstream/main`; edited chapter renders fresh.
- **Catches:** The extra `Deno.statSync` per cache hit (guard B) becoming a noticeable cost at scale. Expected negligible; this is the explicit check.

## Cleanup

`quarto preview` exit (Ctrl+C). No persistent state to clean up beyond `_site/` which the next preview run rebuilds. Remove any ad-hoc fixtures added for T9–T14 (`pycell.qmd`, `notebook.ipynb`, `rcell.qmd`) — they are not committed.

## Related

- `tests/docs/manual/preview/README.md` — manual preview test matrix
- `tests/docs/manual/preview/14281-quarto-ipynb-accumulation.qmd` — neighboring manual test (different bug, similar structure)
