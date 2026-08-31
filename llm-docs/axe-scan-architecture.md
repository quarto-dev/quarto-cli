---
main_commit: abc6a78ed
analyzed_date: 2026-08-31
key_files:
  - src/command/call/axe/cmd.ts
  - src/command/call/axe/config.ts
  - src/command/call/axe/discover.ts
  - src/command/call/axe/scan.ts
  - src/command/call/axe/aggregate.ts
  - src/command/call/axe/schemas.ts
  - src/command/call/axe/conformance.ts
  - src/command/call/axe/report.ts
  - src/command/call/axe/readme.ts
  - src/core/cri/launch.ts
---

# Axe Scan Architecture (`quarto call axe`)

`quarto call axe <site-dir>` scans an already-rendered site for
accessibility violations. It serves the site dir locally, drives headless
Chrome over raw CDP, and runs quarto-cli's vendored axe-core against every
page × viewport × colour-mode cell. It groups violations by root-cause
signature, reconciles them against a hand-written baseline, and writes
`findings.json`, `report.md`, and a generated `README.md`.

The command is a hidden prototype under `call` (hidden while experimental —
it does not show in `quarto call` help). It validates the
semantics for a future public `quarto axe` command. How to *use* it is in
`dev-docs/axe-scan.md`; this document explains how it works and why.

Two sibling documents cover adjacent systems: the render-time `axe:` overlay
(`llm-docs/axe-accessibility-architecture.md`) and the dark-mode plumbing the
mode axis is built on (`llm-docs/html-dark-mode-architecture.md`).

## Pipeline

```
discover.ts        scan.ts              aggregate.ts        report.ts / readme.ts
pages + modes  →   cells (raw axe   →   findings.json   →   report.md, README.md
redirect stubs     payloads, on disk)   (the contract)
```

`cmd.ts` orchestrates: it resolves the artifact anchor, reads the baseline,
serves the site dir (`handleHttpRequests` from `src/core/http-server.ts`),
launches Chrome, chains the stages, prints the summary, and maps the result
to an exit code. Each stage also works standalone, so tests feed captured
cell payloads straight into the aggregate stage without a browser.

The one architectural change from the quarto-web harness this was ported
from: axe is injected at scan time (`formatResourcePath("html",
"axe/axe.min.js")`), not by a render-time hook. Any rendered site scans
as-is, offline, on one known axe version.

**Default viewports** (`kDefaultViewports`, config.ts): `1440x900` renders
the desktop chrome (full navbar, sidebar, margin TOC); `320x568` renders
the reflowed mobile chrome (hamburger, off-canvas). The narrow width is the
one viewport WCAG names — SC 1.4.10 Reflow forbids 2-D scrolling at 320 CSS
px, the 400%-zoom equivalent of a 1280 window. axe has no automated reflow
rule; the point is that the *whole ruleset* runs against the reflowed
layout, and overflow the reflow failure creates surfaces indirectly (e.g.
`scrollable-region-focusable`). The pair is one viewport per chrome regime,
not device fidelity — any width in the same Bootstrap breakpoint band
exercises nearly identical markup. (The narrow default was `390x844`, the
iPhone 12-14 logical size inherited from the harness, until 2026-08-28.)

## Discovery: the matrix is known before the browser launches

`discoverPages` walks `<site-dir>` for `*.html` (skipping `_axe-checks` and
`site_libs`), applies `--pages`, then `--exclude`, then `--max-pages` (sorted
first, so the cap is deterministic). It reads each surviving file once and
classifies it:

- **Redirect stubs** (`aliases:` meta-refresh pages, `_redirects` scripts)
  are site furniture, not content. They are set aside and *recorded* — in
  the console, in `findings.json` under `redirects[]` — never silently
  dropped. The scan-time redirect guard (below) stays the fail-closed net
  for redirects this sniff cannot see.
- **Pages** get their colour modes sniffed from the HTML. The marker for
  "this page has two modes" is the inline before-body script that defines
  `window.quartoToggleColorScheme`. Quarto emits that script iff
  `formatDarkMode(format) !== undefined` — the single upstream predicate.
  The sniff matches the *definition* (`window.quartoToggleColorScheme =`),
  not the bare name, so documentation about the toggle does not
  false-trigger. The emitting template
  (`quarto-html-before-body.ejs`) carries a pointer back at the sniffer.

A two-mode page contributes `light` and `dark` cells — the author's two
slots. A one-mode page contributes one `default` cell, whatever colour its
single presentation is; a dark-coloured single theme (`theme: darkly`) is an
*annotation* (`darkColoured`), never a cell name. The alternate-stylesheet
links are not a usable marker: a light-only `_brand.yml` emits them with no
dark mode behind them (fixture: `tests/docs/axe-scan/sites/brand-light-only`).

`--themes` filters the discovered matrix. It prunes the light/dark pair on
two-mode pages; `default` cells always stay, so `--themes light` means "one
cell per page". A filter that matches zero cells is an error, not an empty
scan.

## The scan stage: raw CDP, fail-closed cells

Think of a Chrome driver as three layers — launcher, transport, task logic —
because the answer to "why not reuse quarto's existing one?" is different at
each. The launcher and the transport are now shared with `src/core/cri/cri.ts`,
which drives Chrome for mermaid. The task logic never will be: mermaid's
commands and the scanner's commands are different jobs.

**Launcher.** `launchChrome()` (`src/core/cri/launch.ts`) is the one place
quarto's CDP drivers start headless Chrome — this scanner and cri.ts.
(`src/core/puppeteer.ts` keeps a separate `puppeteer.launch()` path —
`withHeadlessBrowser`, reached through `withPuppeteerBrowserAndPage` and
`inPuppeteer` — which nothing outside that file enters today.) It owns the
flag set, the
`QUARTO_CHROMIUM_HEADLESS_MODE` escape hatch, stderr draining, exit cleanup,
and the wait for the CDP endpoint; callers pass in only what they genuinely
disagree about — `--hide-scrollbars` and a throwaway profile dir here (so a
scan cannot attach to, or be short-circuited by, a Chrome the user already has
running), `--renderer-process-limit=1` for mermaid. Browser *discovery* is
shared a level up again: `getBrowserExecutablePath()`
(`src/core/puppeteer.ts`) encodes `QUARTO_CHROMIUM` → installed
`chrome-headless-shell` → system Chrome/Edge.

**Transport.** `CdpClient` in `scan.ts` has three capabilities: send a command
and await its result, wait (cancellably) for one event, close. The socket
under it is the vendored `deno-cri` (`src/core/cri/deno-cri/`), the same
generic send-any-command client cri.ts connects with. `CdpClient` is the typed
layer over it, and what it adds is the behaviour fail-closed cells depend on
and `deno-cri` does not have: a dropped connection rejects every command still
in flight, so a crashed tab fails one cell inside `--timeout` rather than
hanging the scan. Because the command surface is so small there is no wrapper
library on top; puppeteer-core is the named fallback if raw CDP gets painful.

What is still *not* reused is cri.ts's **facade**, and it is worth being
precise about why: it exposes mermaid's commands only
(navigate/query/screenshot — no emulation, no `awaitPromise`, no per-command
timeout, so a hung `axe.run()` would hang forever). The cleaner end state,
where cri.ts *exports* a typed transport as a core surface and the scanner
consumes it, waits on the scanner's own needs settling — concurrent tabs in
particular.

**Task logic** is the six CDP *commands* `scanCell` sends through the
transport: navigate, viewport override, media emulation,
evaluate-with-`awaitPromise`, an on-new-document script, the load event.
Those stay the scanner's responsibility under any refactor.

**Cells fail closed.** A timeout, an evaluation error, a payload that is not
an axe result, or a page that moved is an infrastructure failure in the
output and the exit code — never a pass. Per cell, `scanCell`:

1. Sets viewport and `prefers-color-scheme` emulation.
2. On a two-mode page, seeds `localStorage["quarto-color-scheme"]`
   (`"alternate"` = the dark slot) via `Page.addScriptToEvaluateOnNewDocument`,
   which runs before parse. The before-body script applies a stored value
   before first paint, and an explicit stored value wins in both
   `respect-user-color-scheme` settings — so this *selects* the mode
   deterministically. No toggle click, no cross-cell leak.
3. Navigates, waits for load, then for readiness (webfonts + two animation
   frames, capped at 2s), then `--settle` on top.
4. Verifies the document is still the requested page (`redirectTarget`), and
   that the seeded mode took (`quarto-light`/`quarto-dark` body class).
5. Injects the vendored axe source and awaits `axe.run(document,
   { resultTypes: ["violations"] })` — all under the per-cell `--timeout`.
   After a timeout the tab is reset to `about:blank` so a hung run cannot
   bleed into the next cell.

Raw payloads land in `_axe-checks/cells/<slug>__<viewport>__<mode>.json` as
they complete. Slugs map `/` to `_`; two pages whose slugs collide get a
short path-hash suffix (`pageSlugs`). Page paths are percent-encoded per
segment before navigation.

## Aggregation: signatures, findings.json

`aggregate.ts` turns ok cells into findings grouped by **root-cause
signature**, so one defect repeated by shared or generated code is one
finding with a multiplicity count. Across pages this is a same-root-cause
*heuristic*: axe picks a minimal unique selector per page, so an anonymous
element in different DOM contexts can normalize to different signatures and
split one cause into two findings (fixture-verified for the collapse case:
the shared include in `sites/findings` yields `img` on both pages). The
baseline's `pages` scoping exists because the heuristic can also be wrong
the other way — identical signatures on different pages that are unrelated
elements.

The signature is hybrid (`signatureOf`): for `color-contrast` it is the
colour pair (`color-contrast :: #767676 on #ffffff`) — the root cause lives
in the theme, not the element. Everything else keys on the normalized
selector (`normalizeSelector`): `nth-child` stripped, volatile attributes
(`href`, `id`, `style`, …) dropped, other attribute *values* kept with digit
runs wildcarded, trailing instance ids collapsed (`#cb12-1` → `#cb`).
Keeping values matters: stripping them once reduced
`div[data-bs-target=".callout-4-contents"]` to a selector every Bootstrap
collapse matched, so one accepted defect suppressed unrelated failures
site-wide. The scheme has known warts (it eats citation-key years, truncates
digit-final hex hashes, and `[id="x"]` vs `#x` disagree); they are pinned by
`tests/unit/axe-signature.test.ts` and deliberately deferred — fixing them
re-keys every signature.

`findings.json` is the contract everything else reads. Two version fields
guard it (`schemas.ts`):

- `version` (`kFindingsVersion`) — the field *shape*. Additive fields ship
  as `nullish` without a bump so old files keep validating; breaking changes
  bump it.
- `signatureScheme` (`kSignatureScheme`) — the normalizer. A normalizer
  change re-keys every signature while every field name survives; without
  this field that is indistinguishable from "everything fixed, equally many
  new problems". Bump it whenever `normalizeSelector` or `signatureOf`
  changes existing signatures.

A finding's `id` is `<rule>-<md5(signature) prefix>`: stable across runs and
machines, so "fix `image-alt-6e3b76`" is a well-defined instruction. Paths
in `findings.json` (`config.siteDir`, `baseline.file`) are emitted relative
to the artifact anchor, so the file says the same thing on every machine.

## The baseline

`_axe-baseline.json` is the hand-written, committed ledger of accepted
findings. There is no capture flag — every entry exists because someone
wrote it and said why (`note` is required and non-empty). An entry is a
projection of a finding; the scanner reads three fields:

- `signature` — the join key.
- `pages` — the scope. `[]` accepts site-wide (right for chrome). A listed
  `pages` fails closed at finding level: the finding is known only while
  *every* page it occurs on is listed, so the same signature on one unlisted
  page re-alerts the whole finding.
- `impact` — the impact *at acceptance*. Escalation past it re-alerts
  instead of hiding behind an old acceptance.

Stale entries (not seen this scan) are reported, never auto-pruned: on a
subset scan an entry may live on an unscanned page. The ledger is validated
on read with a strict Zod schema — a typo'd field is a named error, and
scheme/version mismatches produce migration instructions rather than a pile
of unknown-key errors. Signature-scheme semantics and the residual warts are
recorded in the private investigation notes; the code and
`tests/unit/axe-signature.test.ts` are the authoritative record.

## Artifacts and the anchor

Artifacts anchor at the nearest project root at or above the site dir
(`resolveAnchor`: walk up for a `_quarto.yml`; fall back to the working
directory for loose HTML). They sit *beside* the output dir, never inside
it: a full website/book render deletes the output dir, and anything that
survived there would be published. Reading the project's own `output-dir`
would need `projectContext()` and its build-artifacts dependency, so the
prototype declines it; the cheap check agrees with `ProjectContext.dir`
wherever a project config exists.

`_axe-checks/` writes its own `.gitignore` (`*`): a `--pages` subset scan
overwrites `findings.json` with a subset snapshot, so a committed copy would
diff as if findings were fixed. The committed contract is the baseline,
which lives beside the directory. Summary artifacts (`findings.json`,
`report.md`) are deleted up front so an aborted scan cannot leave stale ones
reading as current; per-cell payloads accumulate by name.

Three human/agent surfaces, one data source:

- `report.md` — GitHub-flavored markdown (decision 2026-08-25, superseding
  the harness's HTML report): it renders on GitHub, drops into a site via
  `--report`, and is accessible by construction. It is a dumb view —
  grouping, labelling and reconciliation all live in the aggregate stage.
  The rich sortable drill-down belongs to a future Quarto extension, not to
  CLI code.
- `README.md` — generated beside the artifacts, and the *agent enabler*
  (superseding the HTML report's per-finding AI-briefing buttons): nothing
  else can reach a consumer working in a scanned site's repo, so the
  baseline how-to lives there inline.
- `findings.json` — the machine contract.

## Exit codes

- `0` — scan complete; with `--fail-on`, no new finding reached the
  threshold.
- `1` — a *complete* scan found NEW (non-baselined) findings at or above
  `--fail-on <impact>`. Only possible when the flag is given: findings alone
  never fail the command.
- `2` — scan incomplete (any not-ok cell, no browser, nothing to scan).
  Takes precedence over 1: an incomplete scan never reads as a pass.

The threshold logic is `failingFindings` in `aggregate.ts`; the precedence
lives in `axeScan`'s return order. End-to-end coverage runs in a subprocess
(`tests/smoke/axe/axe-exit-codes.test.ts`) because the action exits through
`exitWithCleanup`.

## Conformance labels: mirrored, pinned

`conformance.ts` mirrors `axeConformanceLevel`, `impactRank` and
`standardRank` from the render-time overlay's `axe-check.js`, so a finding
reads identically from a scan and from the in-page report. Importing the
browser module was tried and reverted: it inlines the whole overlay into the
CLI bundle and its page globals break `validate-bundle`. The duplication is
pinned by `tests/unit/axe-conformance-parity.test.ts`; extracting a shared
pure module is deferred until the command goes public, because it would
change the render path every `axe:` user hits.

## Testing map

- `tests/unit/axe-signature.test.ts` — normalization scheme 1, warts included.
- `tests/unit/axe-aggregate.test.ts` — grouping, matrix coverage,
  anchor-relative paths, `failingFindings`, against captured real payloads.
- `tests/unit/axe-baseline-parse.test.ts` / `axe-baseline-reconcile.test.ts`
  — ledger validation; known/new/stale and escalation semantics.
- `tests/unit/axe-mode-discovery.test.ts` — the mode sniff, stub sniff,
  page selection.
- `tests/unit/axe-scan-cell.test.ts` — transport fail-closed with a stubbed
  CDP client; slugs; URL encoding.
- `tests/unit/axe-config.test.ts` — flag parsing and its errors.
- `tests/unit/axe-report-readme.test.ts`, `axe-conformance-parity.test.ts` —
  the views and the mirrored labellers.
- `tests/smoke/axe/*.test.ts` — full command over fixture sites
  (`tests/docs/axe-scan/sites/`): findings/baseline behaviour, the
  viewport×mode matrix, brand and darkly edge cases, exit codes.

## Deliberately not here (yet)

Deferred to the public command, in rough order of demand: `_axe.yml` config,
interaction states + state scripts, ruleset scoping (`standard` /
`best-practice` / raw `options`), source mapping (`.qmd` → output), the
report extension, output-dir defaulting, exclude-in-source tagging. Known
blind spots, documented rather than solved: a dark presentation Quarto does
not know about (hand-written `prefers-color-scheme` CSS, bslib shadow-root
rules) scans once; client-side render races (`--settle` mitigates; the
baseline absorbs stable false positives); reveal decks scan as resting DOM.
