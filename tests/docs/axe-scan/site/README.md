# Fixture site for `quarto dev-call axe`

A deliberately inaccessible Quarto site. Every violation here is planted on
purpose, so the scanner's grouping, matrix and baseline behaviour can be
asserted against known intent rather than against whatever a real site happens
to contain.

**Do not fix the accessibility problems in this directory.** They are the test
data. `_axe-baseline.json` next to this file is committed for the same reason.

The site is source only — the smoke test renders it into `_site/` and removes
that afterwards, because a committed render would carry `site_libs/` and go
stale on every Quarto change.

## Planted violations

`scope` is what the scanner should conclude, not where the markup lives:
`systemic` = repeated from a shared source (three or more elements, or more
than one page), `localized` = a one-off.

| rule | impact | placement | scope | why it's here |
|---|---|---|---|---|
| `image-alt` | critical | `_systemic.qmd`, included by every content page | systemic | the critical end of the impact spread, and the systemic case |
| `link-name` | serious | `index.qmd` only | localized | the serious middle, and the localized case |
| `heading-order` | moderate | `index.qmd` only (h2 → h4) | localized | the moderate end |
| `color-contrast` | serious | `media.qmd`, inside `@media (prefers-color-scheme: dark)` | localized | proves the theme axis of the matrix earns its cost |
| `color-contrast` | serious | `media.qmd`, inside `@media (max-width: 500px)` | localized | proves the viewport axis earns its cost |
| `image-alt` | critical | `examples.qmd`, marked `.a11y-accepted-example` | localized | a deliberate teaching example; v1 has no exclude-in-source, so the baseline absorbs it |
| `color-contrast` | serious | `theme.qmd`, from Quarto's **dark theme** | localized | the theme axis has two routes and only one is a media query — this one is reachable only by driving Quarto's colour-scheme toggle |

Two dimensions are deliberately exercised by *absence* as well: the dark-only
and mobile-only findings must **not** appear in the light or desktop cells.

The two dark findings are deliberately different in kind, because the theme axis
has two routes into a theme and a scanner has to take both:

- `media.qmd`'s failure is in author CSS under `@media (prefers-color-scheme:
  dark)`, so **emulation** reaches it. This is also the only route on a
  non-Quarto page.
- `theme.qmd`'s failure is in Quarto's dark theme itself, so **the colour-scheme
  toggle** reaches it. Emulation cannot: Quarto ignores `prefers-color-scheme`
  unless `respect-user-color-scheme` is set, and this fixture leaves it at its
  default. Before the scanner drove the toggle, this finding was invisible.

Each cell records which route it took, in `colorScheme`. Watch for `toggled` on a
*light* cell: the toggle writes `localStorage` and every cell shares one origin,
so a page can load in the theme a previous cell selected and need clicking back.

`static/legacy.html` shows the fourth value, `assumed-identical`: it offers no
Quarto dark theme, so its dark cells reuse the light payload instead of running
axe twice. That is an assumption, not a proof — a page with hand-written
`@media (prefers-color-scheme: dark)` CSS and no Quarto dark theme would be
reused wrongly, and its dark-only findings missed. This fixture does not contain
that case, so nothing here would catch the mistake; `--themes dark` alone scans
such a page correctly, because there is then no sibling to reuse from.

## Committed baseline

`_axe-baseline.json` exercises all four reconcile outcomes in one file:

| entry | outcome | why |
|---|---|---|
| `image-alt` on the systemic include, `pages: []` | **known** | site-wide acceptance, the right shape for shared chrome |
| `link-name` on `index.html`, `pages: ["index.html"]` | **known** | page-scoped acceptance that covers every page the finding occurs on |
| the `.a11y-accepted-example` image, page-scoped | **known** | stands in for exclude-in-source. When that ships, this entry should turn **stale** — a designed test of stale reporting |
| dark-only `color-contrast`, accepted at `impact: minor` | **new** | planted as `serious`, so escalation past the accepted impact re-alerts |
| a signature matching nothing | **stale** | reported for hand-pruning, never auto-removed |

## Tier 2: raw HTML

`static/legacy.html` is hand-written, not Quarto output. It proves "any
rendered site scans as-is" doesn't secretly depend on Quarto's DOM, and gives
exact control over the signature-normalization edge cases — digit-run ids and
volatile attributes — without fighting Pandoc.

## Intent versus observed

axe chooses a minimal unique selector from the DOM as it finds it, so the
*signature* a planted violation produces is discovered, not decreed. The table
below records what this fixture actually produces, and is the contract the unit
and smoke tests assert against. Regenerate it after any change to the fixture
or to the normalizer, and re-read it: a diff here is either a fixture change or
a scheme change, and the two need different responses.

<!-- OBSERVED-BEGIN -->
Recorded from a full scan: 24/24 cells ok, 12 findings (9 new, 3 known), axe-core 4.10.3, signature scheme 1.

| signature | impact | scope | n | pages | viewports | themes | status |
|---|---|---|---|---|---|---|---|
| `image-alt :: img` | critical | systemic | 4 | about.html, index.html, media.html, theme.html | both | both | known |
| `button-name :: button[data-widget-target="#panel-*"]` | critical | systemic | 3 | static/legacy.html | both | both | new |
| `image-alt :: img[width="*"]` | critical | localized | 2 | examples.html | both | both | known |
| `image-alt :: #hero` | critical | localized | 2 | static/legacy.html | both | both | new |
| `button-name :: button[data-widget-target="#settings-dialog"]` | critical | localized | 1 | static/legacy.html | both | both | new |
| `link-name :: a` | serious | localized | 2 | static/legacy.html | both | both | new |
| `link-name :: p > a` | serious | localized | 1 | index.html | both | both | known |
| `color-contrast :: #555555 on #333333` | serious | localized | 1 | media.html | both | dark | new |
| `color-contrast :: #f8f8f8 on #f0f0f0` | serious | localized | 1 | media.html | 390x844 | both | new |
| `color-contrast :: #6c757d on #222222` | serious | localized | 1 | theme.html | both | dark | new |
| `heading-order :: h4` | moderate | localized | 1 | index.html | both | both | new |
| `aria-allowed-role :: .navbar-toggler` | minor | systemic | 5 | about.html, examples.html, index.html, media.html, theme.html | 390x844 | both | new |

Stale baseline entries: `region-fixture0`.
<!-- OBSERVED-END -->

### Notes on the table

Two rows are not planted, and one planted row collapses further than it looks.

- **`aria-allowed-role :: .navbar-toggler`** comes from Quarto's own navbar, not
  from this fixture. It is a genuine finding and a useful one — systemic across
  four pages and mobile-only — but it belongs to Quarto, so it may change or
  disappear on a Quarto upgrade. Tests must not depend on it, and must not
  depend on the total finding count either.
- **`image-alt :: #hero`** collapses two images whose `id` and `style` both
  differ. axe selected them by id (`#hero-14`, `#hero-15`), so the collapse came
  from the instance-id rule rather than the volatile-attribute rule. Either way
  the two become one finding, which is the intent.
- **`link-name :: a`** is the widest collapse the scheme performs. axe keyed
  those two links on `href`, which is dropped as volatile, leaving the bare tag.
  Anything accepted at that signature is accepted for every unnamed `a` on the
  listed pages, which is exactly why the baseline's `pages` scope — not the
  signature — is what keeps such an acceptance honest.

### Regenerating

```bash
cd tests/docs/axe-scan/site
quarto render
quarto dev-call axe _site          # writes _axe-checks/ next to _quarto.yml
```

Then update the table above from `_axe-checks/findings.json`. Both `_site/` and
`_axe-checks/` are throwaway; the smoke test removes them.
