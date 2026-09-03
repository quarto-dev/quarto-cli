# Scanning a site with `quarto call axe`

`quarto call axe` scans a rendered Quarto site for accessibility
violations with axe-core. It drives headless Chrome over every page, at
desktop and mobile widths, in each colour mode the page ships. It groups
violations by root cause, compares them against a committed baseline, and
writes a report you can read, commit review comments from, or gate CI on.

**Status: experimental.** The command is hidden (it does not show in
`quarto call` help) and makes no stability promise — flags, artifact shapes,
and semantics can change between prereleases. This page is contributor-facing
documentation; it graduates to quarto.org when the command is unhidden (the
same path the `axe:` render option's docs took).

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
quarto call axe _site
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

### Reading report.md

The report is GitHub-flavored markdown, made to be read where markdown
already renders: your editor's preview, GitHub, or the sticky PR comment
from the CI recipe below. Rendering it is optional. For a standalone HTML
view:

```sh
quarto render _axe-checks/report.md
```

then open `_axe-checks/report.html` in your browser. The output lands
beside the report, inside the self-ignoring artifact directory.

`quarto preview _axe-checks/report.md` does **not** work from inside a
project: `_`-prefixed directories are not project inputs, so preview stops
with `No output created by quarto render report.md`. Use render-then-open,
or pass `--report` a path inside your site source (see the flags table) to
render and preview the report as part of the site.

A finding is one *root cause*, not one element: an alt-less image in a
shared include shows up as one finding with an instance count, not once per
page. Grouping keys on axe's element selector (normalized), so this holds
when the pages describe the element the same way — reliably true for
Quarto's own chrome and for repeated template output, and occasionally
wrong for an anonymous element whose surrounding DOM differs page to page
(axe then picks different selectors, and one cause splits into two
findings). Findings on many pages usually come from a shared source — a
template, the theme, Quarto's own chrome — and one fix clears them all.

## Flags

| flag | default | |
|---|---|---|
| `--pages <globs>` | all `*.html` | comma-separated site-relative globs |
| `--exclude <globs>` | — | skip globs, applied after `--pages` |
| `--max-pages <n>` | ∞ | deterministic cap (sorted, first n) |
| `--viewports <WxH,...>` | `1440x900,320x568` | |
| `--themes <light,dark>` | `light,dark` | filters two-mode pages; one-mode pages always scan once |
| `--timeout <ms>` | `30000` | per-cell budget |
| `--settle <ms>` | `50` | extra delay after the page reports ready |
| `--fail-on <impact>` | off | exit 1 on new findings at/above `minor`/`moderate`/`serious`/`critical` |
| `--report <path>` | `_axe-checks/report.md` | put the report elsewhere, e.g. inside your site source |

The narrow default viewport is 320 CSS px — the width WCAG's reflow
criterion (SC 1.4.10) names, equivalent to 400% zoom on a 1280 px window —
so every rule runs against the reflowed mobile layout.

A subset scan (`--pages`, `--exclude`, `--max-pages`) says so loudly in
every artifact: its counts describe the subset, not the site.

## Running it as a post-render step

The command works as a project `post-render` script, so a full render scans
itself:

```yaml
project:
  type: website
  post-render:
    - quarto call axe _site/
```

The script runs from the project directory after the outputs are written,
so the relative site dir and the artifact anchor resolve exactly as they do
on the command line. Exit codes propagate: without `--fail-on`, findings
never fail the render; with `--fail-on`, a new finding at the threshold —
or an incomplete scan — fails `quarto render` itself, with the scan's error
line in the render output. This runs on every full render of the project,
which adds the scan's runtime to each render.

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
- run: quarto call axe _site --fail-on serious
```

`report.md` is GitHub-flavored markdown, so a workflow can post it straight
into the PR — no Quarto-side tooling needed. Use a sticky comment, which
updates in place on each push rather than adding one comment per run:

```yaml
- if: always()
  uses: marocchino/sticky-pull-request-comment@v2
  with:
    header: axe
    path: _axe-checks/report.md
```

(`if: always()` keeps the comment current when `--fail-on` fails the job;
`header` keys the comment so other sticky comments are untouched. GitHub
caps comment bodies at 65,536 characters; a whole-site report on a large
site can exceed it — trim or attach as an artifact instead.)

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
