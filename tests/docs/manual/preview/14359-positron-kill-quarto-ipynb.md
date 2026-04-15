# Manual Test: .quarto_ipynb cleanup on ungraceful termination (#14359)

## Purpose

Verify that `.quarto_ipynb` files are cleaned up after render even when preview
is killed ungracefully (e.g., Positron terminal bin icon). This tests the fix
that restores immediate deletion in `cleanupNotebook()`.

**Why manual?** Ungraceful termination bypasses normal cleanup handlers.
The fix ensures deletion happens right after execution, before any signal
could interrupt the process.

## Automated coverage

The smoke-all test `tests/docs/smoke-all/2025/05/21/keep_ipynb_single-file/14359.qmd`
verifies the core behavior (file deleted after render). This manual test
covers the interactive preview scenario.

## Steps

1. Open Positron (or VS Code with Quarto extension)
2. Open `tests/docs/manual/preview/14281-quarto-ipynb-accumulation.qmd`
3. Start Quarto Preview (terminal or Quarto extension)
4. Wait for first render to complete
5. Check directory: `ls *.quarto_ipynb*` — should be zero files (file was deleted after render)
6. Edit and save the file to trigger a re-render
7. After re-render completes, check again — still zero `.quarto_ipynb` files
8. Kill preview ungracefully (Positron terminal bin icon / close terminal)
9. Check directory — still zero `.quarto_ipynb` files

## Expected

- Zero `.quarto_ipynb` files at all times (the file is deleted immediately
  after each execution, not deferred to cleanup handlers)
- Ungraceful termination does not leave stale files because deletion already
  happened

## Note on Positron fix

Quarto extension v1.131.0 (posit-dev/positron#13006) now sends
`previewTerminateRequest()` when the terminal is closed, giving Quarto
a clean shutdown. Our fix (immediate deletion after execution) and their
fix (clean shutdown signal) are complementary — either alone prevents
stale files, both together provide defense in depth.

## Related

- #14281 — within-session accumulation (fixed by PR #14287)
- #12780 — `keep-ipynb` support (PR #12793 introduced this regression)
- posit-dev/positron#13006 — Killing Quarto Preview should exit process (fixed in extension v1.131.0)
