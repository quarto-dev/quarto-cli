# Fixture site: findings

Grouping, the systemic against localized call, the impact spread, baseline
reconciliation, and the report. Also one page Quarto did not render.

The conditional findings that prove the scan matrix live in `../matrix/`, and
light-only brand markup lives in `../brand-light-only/`. Keep them there. This
site's assertions read page lists, and a conditional finding added here would
appear in some cells and not others for reasons unrelated to grouping.

**Do not fix the accessibility problems in this directory.** They are the test
data. `_axe-baseline.json` is committed for the same reason.

## Planted violations

`scope` is what the scanner must conclude, not where the markup lives.
`systemic` means repeated from a shared source, which is three or more elements
or more than one page. `localized` means a one-off.

| rule | impact | placement | scope | why it is here |
|---|---|---|---|---|
| `image-alt` | critical | `_systemic.qmd`, included by every content page | systemic | the critical end of the impact spread, and the systemic case |
| `link-name` | serious | `index.qmd` only | localized | the serious middle, and the localized case |
| `heading-order` | moderate | `index.qmd` only, h2 to h4 | localized | the moderate end |
| `image-alt` | critical | `examples.qmd`, marked `.a11y-accepted-example` | localized | a deliberate teaching example. v1 has no exclude-in-source, so the baseline absorbs it |
| `button-name` x2, `image-alt`, `link-name` | critical and serious | `static/legacy.html` | systemic and localized | signature edge cases in exact markup, and a page with no Quarto DOM |

## The page Quarto did not render

`static/legacy.html` is hand-written and copied through as a resource. A real
Quarto site does this whenever it ships a page Pandoc never touched.

The page earns its place for one reason: nothing in the scanner may require
Quarto's DOM. It has no colour-scheme machinery at all, so mode discovery must
give it one `default` cell per viewport while the Quarto pages around it get
the light/dark pair. The smoke test asserts both on the same scan, so a single
cell is provably a discovery about this page and not the scanner giving up
everywhere.

The page also carries exact markup for the signature-normalization edge cases,
which is convenient but not the reason it is here. Those cases are pinned
browser-free in `tests/unit/axe-signature.test.ts` and
`tests/unit/axe-aggregate.test.ts`.

## Committed baseline

`_axe-baseline.json` exercises all four reconcile outcomes in one file.

| entry | outcome | why |
|---|---|---|
| `image-alt` on the systemic include, `pages: []` | **known** | site-wide acceptance, the right shape for shared chrome |
| `link-name` on `index.html`, `pages: ["index.html"]` | **known** | page-scoped acceptance that covers every page the finding occurs on |
| the `.a11y-accepted-example` image, page-scoped | **known** | stands in for exclude-in-source. When that ships, this entry must turn **stale**, which is a designed test of stale reporting |
| `heading-order`, accepted at `impact: minor` | **new** | planted as moderate, so escalation past the accepted impact re-alerts |
| a signature matching nothing | **stale** | reported for hand-pruning, never removed automatically |

## Intent against observed

axe chooses a minimal unique selector from the DOM as it finds it, so the
signature a planted violation produces is discovered, not decreed. The table
below records what this site actually produces. It is the contract the smoke
test asserts against.

<!-- OBSERVED-BEGIN -->
Recorded from a full scan: 14/14 cells ok (three light+dark pages, one
`default` page), 9 findings (6 new, 3 known), axe-core 4.10.3, signature
scheme 1.

| signature | impact | scope | n | pages | viewports | themes | status |
|---|---|---|---|---|---|---|---|
| `button-name :: button[data-widget-target="#panel-*"]` | critical | systemic | 3 | static/legacy.html | both | default | new |
| `image-alt :: img` | critical | systemic | 2 | about.html, index.html | both | both | known |
| `image-alt :: img[width="*"]` | critical | localized | 2 | examples.html | both | both | known |
| `image-alt :: #hero` | critical | localized | 2 | static/legacy.html | both | default | new |
| `button-name :: button[data-widget-target="#settings-dialog"]` | critical | localized | 1 | static/legacy.html | both | default | new |
| `link-name :: a` | serious | localized | 2 | static/legacy.html | both | default | new |
| `link-name :: p > a` | serious | localized | 1 | index.html | both | both | known |
| `heading-order :: h4` | moderate | localized | 1 | index.html | both | both | new |
| `aria-allowed-role :: .navbar-toggler` | minor | systemic | 3 | about.html, examples.html, index.html | 320x568 | both | new |

Stale baseline entries: `region-fixture0`.
<!-- OBSERVED-END -->

### Notes on the table

Three rows deserve a note.

- **`aria-allowed-role :: .navbar-toggler`** comes from Quarto's own navbar, not
  from this fixture. It is a genuine finding and a useful one, systemic across
  three pages and mobile-only. It belongs to Quarto, so it can change or
  disappear on a Quarto upgrade. No test depends on it, and no test depends on
  the total finding count either.
- **`image-alt :: #hero`** collapses two images whose `id` and `style` both
  differ. axe selected them by id (`#hero-14`, `#hero-15`), so the collapse came
  from the instance-id rule and not from the volatile-attribute rule. Either way
  the two become one finding, which is the intent.
- **`link-name :: a`** is the widest collapse the scheme performs. axe keyed
  those two links on `href`, which is dropped as volatile, leaving the bare tag.
  Anything accepted at that signature is accepted for every unnamed `a` on the
  listed pages. That is exactly why the baseline's `pages` scope, and not the
  signature, is what keeps such an acceptance honest.

### Regenerating

```bash
cd tests/docs/axe-scan/sites/findings
quarto render
quarto call axe _site          # writes _axe-checks/ next to _quarto.yml
```

Both `_site/` and `_axe-checks/` are throwaway. The smoke test removes them.
