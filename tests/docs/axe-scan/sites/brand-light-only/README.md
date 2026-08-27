# Fixture site: brand-light-only

A regression fixture for one decision: when does a page have a dark mode to
scan?

`_brand.yml` sets light values only. Quarto answers such a brand with the
colour-scheme link machinery but no dark mode behind it:

```html
<link rel="stylesheet" class="quarto-color-scheme" data-mode="light" ...>
<link rel="stylesheet" class="quarto-color-scheme quarto-color-alternate"
      data-mode="light" href=".../bootstrap-dark-....min.css">
<link rel="stylesheet" class="quarto-color-scheme-extra" data-mode="light" ...>
```

Three traps sit in that markup. Every link is tagged `data-mode="light"`, one
of them carries `quarto-color-alternate`, and one points at a *dark* Bootstrap
build. A probe that asks for `[data-mode]`, or for the alternate class, or for
a `-dark` href, reads all this as "there is a dark theme". It then scans both
themes for nothing and reports duplicate coverage as if it were real. Found on
a live brand.yml site, 2026-08-20.

What the page does **not** carry is the inline before-body script (the one
that defines `window.quartoToggleColorScheme`): Quarto emits it iff the page
really has two modes. Mode discovery reads that marker, so each page here gets
exactly one cell, labelled `default`.

**Do not add dark values to `_brand.yml`.** That would make this an ordinary
two-mode site and delete the regression it guards.

## Why a real project and not a hand-written page

The markup above belongs to Quarto. A hand-written page that reproduces it is
a mock of a contract we do not own, so it would keep passing after Quarto
changed what it emits. This site renders in the smoke test's setup, so the
fixture tracks Quarto. (The sniffer's reading of a distilled copy of this
markup is pinned browser-free in `tests/unit/axe-mode-discovery.test.ts`.)

The mock came first and was correct on the essential point. The real render is
richer: the mock had no `quarto-color-alternate` link and no dark Bootstrap
href, so it never covered two of the three traps.

## Planted violation

One bare `<button></button>` in `index.qmd`, so `button-name` fires and the
single `default` cell demonstrably scanned the page — a clean result would
look exactly like a page that was never scanned at all.

Keep this page minimal. A second, conditional finding would blur the one
comparison the site exists to make.

## Intent against observed

<!-- OBSERVED-BEGIN -->
Recorded from a full scan: 2/2 cells ok (one page, two viewports, one mode),
1 finding (1 new, 0 known), axe-core 4.10.3, signature scheme 1.

| signature | impact | scope | n | pages | viewports | themes |
|---|---|---|---|---|---|---|
| `button-name :: button` | critical | localized | 1 | index.html | both | default |

The cells are `index__1440x900__default` and `index__320x568__default` —
no light/dark pair, and no `darkColoured` annotation (the links measure
light).
<!-- OBSERVED-END -->

One mode discovered means one presentation scanned. A page with hand-written
`@media (prefers-color-scheme: dark)` CSS and no Quarto dark mode still scans
once, and its dark-only findings are missed — the documented v1 blind spot
(see the design note's "The theme axis, settled").

### Regenerating

```bash
cd tests/docs/axe-scan/sites/brand-light-only
quarto render
quarto call axe _site          # writes _axe-checks/ next to _quarto.yml
```

Both `_site/` and `_axe-checks/` are throwaway. The smoke test removes them.
