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

Use `--no-browser` to control browser connection. `--port` behavior depends on whether you pass
it: omit it and `quarto preview` silently picks a random open port between 3000–8000
(`findOpenPort` in `src/core/port.ts`); pass an explicit `--port` that's already occupied and it
polls for up to 5 seconds, then **throws** `Requested port <n> is already in use` and exits
(`resolvePreviewOptions` in `src/command/preview/preview.ts`) — it does not fall back to another
port. If you need a guaranteed-free port, omit `--port` rather than guessing one. Either way,
read the actual URL from the `Browse at <url>` line the process prints on startup (see Startup
Readiness below) rather than assuming it — cheap insurance even when you passed `--port`
yourself.

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

Quarto's logger (including the `Browse at` readiness line) writes to **stderr**, not stdout
(`StdErrOutputHandler` in `src/core/log.ts`) — redirect both streams or the log file used for
readiness polling below will stay empty:

```bash
# Linux/macOS (after venv activation)
./package/dist/bin/quarto preview <file> --no-browser --port 4444 > preview.log 2>&1 &
PREVIEW_PID=$!
# ... run verification ...
kill $PREVIEW_PID

# Windows (Git Bash, after venv activation)
./package/dist/bin/quarto.cmd preview <file> --no-browser --port 4444 > preview.log 2>&1 &
PREVIEW_PID=$!
# ... run verification ...
kill $PREVIEW_PID
```

```powershell
# Windows (native PowerShell)
$proc = Start-Process -FilePath ".\package\dist\bin\quarto.cmd" `
  -ArgumentList "preview","<file>","--no-browser","--port","4444" `
  -RedirectStandardOutput preview.log -RedirectStandardError preview.log -PassThru
# ... run verification ...
# quarto.cmd is a batch wrapper: $proc.Id is the cmd.exe host, and Deno runs as its CHILD, so
# Stop-Process on that PID alone leaves the actual preview server (and its port) running.
# Kill the whole tree instead:
taskkill /PID $($proc.Id) /T /F
```

### Startup readiness

Don't gate the first browser check on a fixed sleep. Tail the log (or poll `preview.log`) until
the `Browse at` line appears — that's the process's own readiness signal, and (when `--port` was
omitted) it also carries the port that got picked:

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
6. Stop preview (see the PID-based stop commands above — never by process name), then verify
   cleanup *if the stop was graceful* (see Windows Limitations below for the automated/Windows
   case)

## What to Verify

**In browser** (via `/agent-browser`): Page loads, content matches source, updates reflect edits.

**In terminal/logs**: No `BadResource` errors, no crashes, preview stays responsive.

**On filesystem, for a graceful (interactive Ctrl+C) shutdown only**: no orphaned
`quarto-session*` temp directories left under the OS temp dir (`src/core/temp.ts`) after the
process exits — list the temp dir before starting and diff it after stopping, rather than
assuming cleanup ran. For an automated/backgrounded stop, see Windows Limitations — don't apply
this check there, it will always "fail".

## Windows Limitations

On Windows, `kill`/`Stop-Process`/`taskkill` against a backgrounded PID does not trigger
Quarto's `onCleanup` handler — Deno only wires `SIGINT` to a console control handler for
interactive Ctrl+C (`src/core/main.ts`), and a background kill terminates the process directly
without going through that handler. So a forced/automated stop is expected to leave its
`quarto-session*` temp directory behind — that's not a bug to chase, it's what a hard kill does.
Cleanup-on-exit verification requires an interactive terminal with Ctrl+C; for automated
testing, verify artifacts *during* preview instead (confirm the session directory exists and
looks right while the process is up), and treat an automated stop as "process gone" evidence
only, not "cleanup ran" evidence.

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
