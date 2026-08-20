# Fixture site: brand-light-only

A regression fixture for one decision: when may a dark cell reuse its light
sibling's result?

`_brand.yml` sets light values only. Quarto answers such a brand with the
colour-scheme link machinery but no dark theme to select:

```html
<link rel="stylesheet" class="quarto-color-scheme" data-mode="light" ...>
<link rel="stylesheet" class="quarto-color-scheme quarto-color-alternate"
      data-mode="light" href=".../bootstrap-dark-....min.css">
<link rel="stylesheet" class="quarto-color-scheme-extra" data-mode="light" ...>
```

Three traps sit in that markup. Every link is tagged `data-mode="light"`, one
of them carries `quarto-color-alternate`, and one points at a *dark* Bootstrap
build. A probe that asks for `[data-mode]`, or for the alternate class, or for a
`-dark` href, reads all this as "there is a dark theme". It then scans both
themes for nothing and reports duplicate coverage as if it were real. Found on a
live brand.yml site, 2026-08-20.

There is no `.quarto-color-scheme-toggle` on the page. The scanner asks for
`link.quarto-color-scheme[data-mode="dark"]`, finds none, and reuses.

**Do not add dark values to `_brand.yml`.** That would make this an ordinary
two-theme site and delete the regression it guards.

## Why a real project and not a hand-written page

The markup above belongs to Quarto. A hand-written page that reproduces it is a
mock of a contract we do not own, so it would keep passing after Quarto changed
what it emits. This site renders in the smoke test's setup, so the fixture
tracks Quarto.

The mock came first and was correct on the essential point. The real render is
richer: the mock had no `quarto-color-alternate` link and no dark Bootstrap
href, so it never covered two of the three traps.

## Planted violation

One bare `<button></button>` in `index.qmd`, so `button-name` fires. Reuse that
returned an empty result would look exactly like a clean page, so the comparison
needs something to find.

Keep this page minimal. A second, conditional finding would blur the one
comparison the site exists to make.

## Intent against observed

<!-- OBSERVED-BEGIN -->
Recorded from a full scan: 4/4 cells ok, 2 of 4 cells reused, 1 finding (1 new,
0 known), axe-core 4.10.3, signature scheme 1.

| signature | impact | scope | n | pages | viewports | themes |
|---|---|---|---|---|---|---|
| `button-name :: button` | critical | localized | 1 | index.html | both | both |

| cell | `colorScheme` |
|---|---|
| `index__1440x900__light` | `emulated` |
| `index__390x844__light` | `emulated` |
| `index__1440x900__dark` | `assumed-identical` |
| `index__390x844__dark` | `assumed-identical` |
<!-- OBSERVED-END -->

`assumed-identical` is an assumption, not a proof. A page with hand-written
`@media (prefers-color-scheme: dark)` CSS and no Quarto dark theme would be
reused wrongly, and its dark-only findings missed. This site does not contain
that case, so nothing here would catch the mistake. `--themes dark` alone scans
such a page correctly, because there is then no sibling to reuse from.

### Regenerating

```bash
cd tests/docs/axe-scan/sites/brand-light-only
quarto render
quarto dev-call axe _site          # writes _axe-checks/ next to _quarto.yml
```

Both `_site/` and `_axe-checks/` are throwaway. The smoke test removes them.
