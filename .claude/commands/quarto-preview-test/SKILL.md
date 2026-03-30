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
- `/agent-browser` CLI installed (preferred), OR Chrome + Chrome DevTools MCP connected

## Starting Preview

```bash
# Linux/macOS
./package/dist/bin/quarto preview <file-or-dir> --no-browser --port 4444

# Windows
./package/dist/bin/quarto.cmd preview <file-or-dir> --no-browser --port 4444
```

Use `--no-browser` to control browser connection. Use `--port` for a predictable URL.

### With debug logging

```bash
./package/dist/bin/quarto preview <file> --no-browser --port 4444 --log-level debug 2>&1 | tee preview.log
```

Filter log entries with `grep` or `jq` for structured output.

### In background

```bash
# Linux/macOS
./package/dist/bin/quarto preview <file> --no-browser --port 4444 &
PREVIEW_PID=$!
# ... run verification ...
kill $PREVIEW_PID

# Windows (PowerShell)
$proc = Start-Process -PassThru -NoNewWindow ./package/dist/bin/quarto.cmd preview, <file>, --no-browser, --port, 4444
# ... run verification ...
Stop-Process $proc
```

## Edit-Verify Cycle

The core test pattern:

1. Start preview with `--no-browser --port 4444`
2. Use `/agent-browser` to navigate to `http://localhost:4444/` and verify content
3. Edit source file, wait 3-5 seconds for re-render
4. Verify content updated in browser
5. Check filesystem for unexpected artifacts
6. Stop preview (Ctrl+C or kill), verify cleanup

## What to Verify

**In browser** (via `/agent-browser`): Page loads, content matches source, updates reflect edits.

**In terminal/logs**: No `BadResource` errors, no crashes, preview stays responsive.

**On filesystem**: No orphaned temp files, cleanup happens on exit.

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

## Test Cases

Specific test matrices live in `tests/docs/manual/preview/README.md`. This skill covers the general workflow.

## Baseline Comparison

Compare dev build against installed release to distinguish regressions:

```bash
quarto --version                        # installed
./package/dist/bin/quarto --version     # dev
```

If both show the same issue, it's pre-existing.
