---
name: triage-ci-failures
description: Use when a quarto-cli PR has red CI checks or a workflow run failed, to find which tests failed on which OSes and why, without loading raw job logs into context. Covers dependency-bump PRs (Pandoc, Typst, Deno) where many assertions break at once.
---

# Triage CI Failures

A red PR on quarto-cli fans out into dozens of failed jobs (test buckets × OSes), each log several hundred KB. Check-run annotations only name the bucket, and `gh run view --log` silently truncates near 750 KB. The script below downloads the failed-job logs to a cache directory and prints a compact digest: one row per unique failing test, the OSes it failed on, and the assertion that broke.

## Step 1: Digest the failures

```bash
bash .claude/skills/triage-ci-failures/scripts/ci-failures.sh <pr-number>
bash .claude/skills/triage-ci-failures/scripts/ci-failures.sh --run <run-id>   # one run, e.g. a scheduled run on main
```

The PR form takes every failing run on the PR's head commit. Logs are cached per job id under `$CI_FAILURES_DIR` (default `${TMPDIR:-/tmp}/quarto-ci-failures`), so re-running after a new push only fetches the new jobs.

The output has up to three sections:

- **unique failing tests**: `[OSes] <test>`, then one representative `[verify]` check and its message (up to 6 lines, including `noErrors` diagnostics). The excerpt identifies its OS and job; the row lists every contributing log in the cache directory. Missing output (`No output created message`, a missing path) may indicate a render failure, so the row includes the captured render output from the test's `OUTPUT:` tail. A row with no excerpt may have failed during prereq or teardown and names the log to grep.
- **step errors**: `##[error]` lines from failed jobs that had no failing test (runtime-boundary, lint, setup).
- **failed jobs with no recognised failure**: a log shape the script does not parse (Playwright and feature-format-matrix jobs are unverified). Grep the printed log path for the cause (`grep -n -E 'Error|FAIL' <log> | head`) rather than reading the log whole.

Step 1 is done when every failed job is accounted for by a test row, a step error, or a cause found by grep in its log.

## Step 2: Group rows by cause

Several rows may share one cause, such as a Pandoc change affecting several docx crossref tests. Compare diagnostics in the listed logs before grouping failures across OSes; the representative excerpt may not describe every failure. Investigate failures limited to one OS for platform differences or intermittent behavior; see `dev-docs/debugging-flaky-tests.md`.

## Step 3: Classify each cause before changing any test

For each cause, decide **drift** or **regression** before touching an assertion or snapshot:

- **Drift**: the dependency changed its output in a way that is correct or neutral for users (reordered attributes, hashed bookmark names, new whitespace). Update the assertion or snapshot, and say in the commit which upstream change caused it.
- **Regression**: the rendered result is now wrong for users (missing content, broken cross-reference, a document that no longer renders). Fix Quarto or report upstream; the test stays as it is.

Decide from the rendered output, not the assertion text: render the test document with the dev build and inspect it (`.claude/rules/testing/smoke-all-tests.md` covers how smoke-all tests declare their checks). For a dependency bump, the dependency's changelog usually names the change.

Step 3 is done when every cause carries a drift-or-regression verdict with the evidence behind it. Track one work item per cause, so each verdict and fix can be reviewed on its own.
