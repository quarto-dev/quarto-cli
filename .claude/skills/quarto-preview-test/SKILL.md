---
name: quarto-preview-test
description: Use when testing preview functionality, verifying live reload, or validating preview fixes. Covers starting preview with port/logging, browser verification via /agent-browser, and checking logs/filesystem for artifacts.
---

# Quarto Preview Test

Interactive testing of `quarto preview` with automated browser verification.

## Tools

| Tool | When to use |
|------|-------------|
| `/agent-browser` | **Preferred.** Token-efficient browser automation. Navigate, verify content, screenshot. |
| Chrome DevTools MCP | Deep debugging: console messages, network requests, DOM inspection. |
| `jq` / `grep` | Parse debug log output. |

## Prerequisites

- Quarto dev version built (`./configure.sh` or `./configure.cmd`)
- Test environment configured (`tests/configure-test-env.sh` or `tests/configure-test-env.ps1`)
- `/agent-browser` CLI installed (preferred), OR Chrome + Chrome DevTools MCP connected

## Starting Preview

Preview needs the test venv for Jupyter tests. Activate it first (`tests/.venv`), matching how `run-tests.sh` / `run-tests.ps1` do it.

```bash
# Linux/macOS
source tests/.venv/bin/activate
./package/dist/bin/quarto preview <file-or-dir> --no-browser --port 4444

# Windows (Git Bash)
source tests/.venv/Scripts/activate
./package/dist/bin/quarto.cmd preview <file-or-dir> --no-browser --port 4444
```

```powershell
# Windows (native PowerShell)
tests\.venv\Scripts\Activate.ps1
.\package\dist\bin\quarto.cmd preview <file-or-dir> --no-browser --port 4444
```

Use `--no-browser` to control browser connection. `--port` is a *suggestion*: if it's already
taken, `quarto preview` silently picks a random open port between 3000–8000 instead of erroring
(`src/core/port.ts`). Don't assume the requested port bound — read the actual URL from the
`Browse at <url>` line the process prints on startup (see Startup Readiness below) before
pointing `/agent-browser` at it.

### With debug logging

```bash
# Linux/macOS or Windows Git Bash
./package/dist/bin/quarto preview <file> --no-browser --port 4444 --log-level debug 2>&1 | tee preview.log
```

```powershell
# Windows (native PowerShell)
.\package\dist\bin\quarto.cmd preview <file> --no-browser --port 4444 --log-level debug 2>&1 | Tee-Object preview.log
```

### In background

```bash
# Linux/macOS (after venv activation)
./package/dist/bin/quarto preview <file> --no-browser --port 4444 &
PREVIEW_PID=$!
# ... run verification ...
kill $PREVIEW_PID

# Windows (Git Bash, after venv activation)
./package/dist/bin/quarto.cmd preview <file> --no-browser --port 4444 &
PREVIEW_PID=$!
# ... run verification ...
kill $PREVIEW_PID
```

```powershell
# Windows (native PowerShell)
$proc = Start-Process -FilePath ".\package\dist\bin\quarto.cmd" `
  -ArgumentList "preview","<file>","--no-browser","--port","4444" `
  -RedirectStandardOutput preview.log -PassThru
# ... run verification ...
Stop-Process -Id $proc.Id -Force   # target the captured PID only, never by process name
```

### Startup readiness

Don't gate the first browser check on a fixed sleep. Tail the log (or poll `preview.log`) until
the `Browse at` line appears — that's the process's own readiness signal, and it also carries
the actual bound port when the requested one was occupied:

```bash
timeout 30 bash -c 'until grep -q "Browse at" preview.log 2>/dev/null; do sleep 0.5; done'
grep -o 'Browse at .*' preview.log
```

## Edit-Verify Cycle

The core test pattern:

1. Start preview with `--no-browser --port 4444`, capturing its PID and log path
2. Wait for the `Browse at` line (Startup Readiness above), then use `/agent-browser` to
   navigate to that URL and verify content
3. Edit source file, wait 3-5 seconds for re-render
4. Verify content updated in browser
5. Check filesystem for unexpected artifacts (see below)
6. Stop preview by PID (never by process name — see `Stop-Process`/`kill` above), then verify
   cleanup

## What to Verify

**In browser** (via `/agent-browser`): Page loads, content matches source, updates reflect edits.

**In terminal/logs**: No `BadResource` errors, no crashes, preview stays responsive.

**On filesystem**: No orphaned `quarto-session*` temp directories left under the OS temp dir
(`src/core/temp.ts`) after the process exits — list the temp dir before starting and diff it
after stopping, rather than assuming cleanup ran.

## Windows Limitations

On Windows, `kill`/`Stop-Process` against a backgrounded PID does not trigger Quarto's
`onCleanup` handler — Deno only wires `SIGINT` to a console control handler for interactive
Ctrl+C (`src/core/main.ts`), and a background kill terminates the process directly without
going through that handler. Cleanup-on-exit verification requires an interactive terminal with
Ctrl+C. For automated testing, verify artifacts *during* preview instead (see filesystem check
above), and treat a background stop as "process gone" verification only, not "cleanup ran".

## Context Types

Preview behaves differently depending on input:

| Input | Code path |
|-------|-----------|
| Single file (no project) | `preview()` -> `renderForPreview()` |
| File within a project | May redirect to project preview via `serveProject()` |
| Project directory | `serveProject()` -> `watchProject()` |

See `llm-docs/preview-architecture.md` for the full architecture.

## When NOT to Use

- Automated smoke tests — use `tests/smoke/` instead
- Testing render output only (no live preview needed) — use `quarto render`
- CI environments without browser access

## Test Matrix

The full test matrix lives in `tests/docs/manual/preview/README.md`. Test fixtures live alongside it in `tests/docs/manual/preview/`.

### Running specific tests by ID

When invoked with test IDs (e.g., `/quarto-preview-test T17 T18`):

1. Read `tests/docs/manual/preview/README.md`
2. Find each requested test by its ID (e.g., `#### T17:`)
3. Parse the **Setup**, **Steps**, and **Expected** fields
4. Execute each test following the steps, using the fixtures in `tests/docs/manual/preview/`
5. Report PASS/FAIL for each test with the actual vs expected result

### Running tests by topic

When invoked with a topic description instead of IDs (e.g., `/quarto-preview-test root URL` or "run preview tests for single-file"):

1. Read `tests/docs/manual/preview/README.md`
2. Search test titles and descriptions for matches (keywords, issue numbers, feature area)
3. Present the matched tests to the user for confirmation before running:
   ```
   Found these matching tests:
   - T17: Single-file preview — root URL accessible (#14298)
   - T18: Single-file preview — named output URL also accessible
   Run these? [Y/n]
   ```
4. Only execute after user confirms

### Running without arguments

When invoked without test IDs or topic (e.g., `/quarto-preview-test`), use the general Edit-Verify Cycle workflow described above for ad-hoc preview testing. The test matrix is for targeted regression testing.

## Baseline Comparison

Compare dev build against installed release to distinguish regressions:

```bash
quarto --version                        # installed
./package/dist/bin/quarto --version     # dev
```

If both show the same issue, it's pre-existing.
