---
name: quarto-preview-test
description: Use when testing `quarto preview` behavior — verifying live reload, validating a preview-related bug fix, or running the manual preview test matrix by ID or topic.
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
port. To use an available port automatically, omit `--port`. In either case, read the actual
URL from the `Browse at <url>` line that the process prints on startup (see Startup Readiness
below), even when you passed `--port`.

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

Quarto's logger, including the `Browse at` readiness line, writes to **stderr**, not stdout
(`StdErrOutputHandler` in `src/core/log.ts`). Redirect both streams so the log file used for
readiness polling below receives this line:

```bash
# Linux/macOS (after venv activation)
./package/dist/bin/quarto preview <file> --no-browser --port 4444 > preview.log 2>&1 &
PREVIEW_PID=$!
# ... run verification ...
kill $PREVIEW_PID
```

On Windows, use the native PowerShell block below instead of Git Bash for backgrounded runs:
`quarto.cmd` is a `cmd.exe` wrapper around Deno, so Git Bash's `kill $PID` only stops that
wrapper, leaving the Deno preview server and its port active. The PowerShell command below
stops the entire process tree.

```powershell
# Windows (native PowerShell)
# -RedirectStandardOutput and -RedirectStandardError must be different files — PowerShell
# rejects Start-Process if both point at the same path.
$proc = Start-Process -FilePath ".\package\dist\bin\quarto.cmd" `
  -ArgumentList "preview","<file>","--no-browser","--port","4444" `
  -RedirectStandardOutput preview.out.log -RedirectStandardError preview.log -PassThru
# ... run verification — poll preview.log for "Browse at" (Startup Readiness below) ...
# quarto.cmd is a batch wrapper: $proc.Id is the cmd.exe host, and Deno runs as its CHILD, so
# Stop-Process on that PID alone leaves the actual preview server and its port active.
# Stop the whole tree instead:
taskkill /PID $($proc.Id) /T /F
```

### Startup readiness

Don't gate the first browser check on a fixed sleep. Tail the log (or poll `preview.log`) until
the `Browse at` line appears. This line signals that the process is ready and, when `--port`
was omitted, reports the selected port:

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
process exits. List the temp directory before starting and compare it after stopping instead
of assuming cleanup ran. Do not apply this check after an automated background stop; see
Windows Limitations.

## Windows Limitations

On Windows, `kill`/`Stop-Process`/`taskkill` against a backgrounded PID does not trigger
Quarto's `onCleanup` handler — Deno only wires `SIGINT` to a console control handler for
interactive Ctrl+C (`src/core/main.ts`), and a background kill terminates the process directly
without going through that handler. A forced or automated stop is therefore expected to leave
its `quarto-session*` temp directory behind.
Cleanup-on-exit verification requires an interactive terminal with Ctrl+C; for automated
testing, verify artifacts *during* preview instead (confirm the session directory exists and
has the expected contents while the process is running). An automated stop confirms only that
the process ended, not that cleanup ran.

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

Invoked with test IDs (e.g. `/quarto-preview-test T17 T18`) or a topic description (e.g.
`/quarto-preview-test root URL`)? See `references/test-matrix.md` for how to look up and run
matching tests from `tests/docs/manual/preview/README.md`. Invoked without IDs or a topic, use
the Edit-Verify Cycle above instead — the test matrix is for targeted regression testing.

## Baseline Comparison

Compare dev build against installed release to distinguish regressions:

```bash
quarto --version                        # installed
./package/dist/bin/quarto --version     # dev
```

If both show the same issue, it's pre-existing.
