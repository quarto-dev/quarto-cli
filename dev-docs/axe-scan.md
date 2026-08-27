# Scanning a site with `quarto dev-call axe`

`quarto dev-call axe` scans a rendered Quarto site for accessibility
violations with axe-core. It drives headless Chrome over every page, at
desktop and mobile widths, in each colour mode the page ships. It groups
violations by root cause, compares them against a committed baseline, and
writes a report you can read, commit review comments from, or gate CI on.

**Status: experimental.** The command is hidden under `dev-call` and makes
no stability promise — flags, artifact shapes, and semantics can change
between prereleases. This page is contributor-facing documentation; it
graduates to quarto.org when the command sheds `dev-call` (the same path the
`axe:` render option's docs took).

Prerequisite: a Chromium the scanner can find. `quarto install
chrome-headless-shell` is the reliable route; an installed system Chrome or
Edge also works.

## When to reach for it

The render-time `axe:` option checks the page you are looking at, in your
browser, while you author. This command checks the *site*: every page, both
viewports, light and dark, at audit time or in CI. Reach for it when you
want a site-wide inventory, a regression gate, or output an agent can work
through.

## First scan

```sh
quarto render
quarto dev-call axe _site
```

The scan prints its matrix up front (`43 pages (40 light+dark, 3 default) ×
2 viewports — 166 cells`), then one line per cell, then a findings summary.
Artifacts land at the project root (the nearest `_quarto.yml` at or above
the site dir):

- `_axe-checks/findings.json` — every finding, machine-readable.
- `_axe-checks/report.md` — the human summary, GitHub-flavored markdown.
- `_axe-checks/README.md` — generated docs for the artifacts, including the
  baseline how-to. Read this after a scan; it is written for whoever (or
  whatever) has only the artifact directory in front of them.
- `_axe-checks/cells/` — raw axe output per page × viewport × mode cell.

`_axe-checks/` ignores itself (`.gitignore` with `*`): it is a disposable
snapshot, not a thing to commit.

A finding is one *root cause*, not one element: an alt-less image in a
shared include is one finding with an instance count, however many pages
repeat it. Findings on many pages usually come from a shared source — a
template, the theme, Quarto's own chrome — and one fix clears them all.

## Flags

| flag | default | |
|---|---|---|
| `--pages <globs>` | all `*.html` | comma-separated site-relative globs |
| `--exclude <globs>` | — | skip globs, applied after `--pages` |
| `--max-pages <n>` | ∞ | deterministic cap (sorted, first n) |
| `--viewports <WxH,...>` | `1440x900,390x844` | |
| `--themes <light,dark>` | `light,dark` | filters two-mode pages; one-mode pages always scan once |
| `--timeout <ms>` | `30000` | per-cell budget |
| `--settle <ms>` | `50` | extra delay after the page reports ready |
| `--fail-on <impact>` | off | exit 1 on new findings at/above `minor`/`moderate`/`serious`/`critical` |
| `--report <path>` | `_axe-checks/report.md` | put the report elsewhere, e.g. inside your site source |

A subset scan (`--pages`, `--exclude`, `--max-pages`) says so loudly in
every artifact: its counts describe the subset, not the site.

## The baseline workflow

The first scan of a real site reports findings you will not fix today:
upstream defects, deferred best-practice items, known false positives. The
baseline is the committed ledger of those decisions — `_axe-baseline.json`
at the project root, beside (not inside) `_axe-checks/`.

1. Scan, then fix what you can from `report.md`.
2. For each finding you are accepting instead: copy it out of
   `findings.json` into the baseline's `findings` array, trim it, and write
   a `note` saying why. The generated `_axe-checks/README.md` documents the
   entry shape and the scoping rules (`pages: []` accepts site-wide;
   a listed `pages` re-alerts anywhere else).
3. Commit `_axe-baseline.json`.

From then on, reports separate **new** findings from **baselined** ones,
and only new findings can fail CI. A baselined finding that escalates in
impact, or shows up on a page outside its scope, re-alerts as new. Entries
a full-site scan no longer sees are reported as stale — prune them by hand.

There is deliberately no `--update-baseline`: every entry exists because
someone wrote it and said why.

## Exit codes and the CI recipe

| exit | meaning |
|---|---|
| `0` | scan complete; no new findings at/above `--fail-on` (when given) |
| `1` | complete scan, new findings at/above the `--fail-on` threshold |
| `2` | scan incomplete — a cell timed out or errored, no browser, nothing to scan. Takes precedence over 1: an incomplete scan never reads as a pass |

A minimal GitHub Actions gate:

```yaml
- uses: quarto-dev/quarto-actions/setup@v2
- run: quarto install chrome-headless-shell --no-prompt
- run: quarto render
- run: quarto dev-call axe _site --fail-on serious
```

`report.md` is GitHub-flavored markdown, so posting it as a PR comment is
workflow configuration, not tooling:

```yaml
- if: failure()
  uses: actions/github-script@v7
  with:
    script: |
      const fs = require("fs");
      const body = fs.readFileSync("_axe-checks/report.md", "utf8");
      await github.rest.issues.createComment({
        ...context.repo,
        issue_number: context.issue.number,
        body: body.slice(0, 65536),
      });
```

(GitHub caps comment bodies at 65,536 characters; a whole-site report on a
large site can exceed it — trim or attach as an artifact instead.)

## Reading the output as an agent

Point the agent at `_axe-checks/` and let it read the generated `README.md`
first. Finding ids are stable across runs (`image-alt-6e3b76`), so "fix
`image-alt-6e3b76`" is a well-defined instruction, and each finding's
`occurrences[]` carries real selectors and HTML excerpts. Fixes belong in
Quarto *source* (`.qmd`, `_quarto.yml`, `_brand.yml`, theme `.scss`) — never
in the rendered site directory.

## Where the pieces are documented

- How it works and why: `llm-docs/axe-scan-architecture.md`.
- What the artifacts mean, baseline entry shape: the generated
  `_axe-checks/README.md` (regenerated every scan, always matches the build
  that wrote it).
- Render-time single-page checking: the `axe:` HTML format option.
