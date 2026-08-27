# Fixture site: darkly

A regression fixture for one decision: a one-mode page is one cell, whatever
colour that mode is.

`theme: darkly` ships a single dark-coloured presentation. Quarto's own
machinery still calls it the light slot: the rendered page says
`body.quarto-light`, and its sole `id="quarto-bootstrap"` link is tagged
`data-mode="dark"` only because the compiled CSS measures as dark (a blackness
sentinel, threshold 40%). So every declaration-level signal is misleading in
one direction or the other.

The scanner must:

- discover **one** mode and label the cell `default` — never `dark`, and never
  a light/dark pair;
- record the measured colour as an annotation — `darkColoured: true` in the
  cell payload, and a note on the console — never in the cell's name.

**Do not add a `light:`/`dark:` theme pair here.** That would make this an
ordinary two-mode site and delete the case it guards.

## Planted violation

One bare `<button></button>` in `index.qmd`, so `button-name` fires and the
`default` cell demonstrably scanned the page.

## Intent against observed

<!-- OBSERVED-BEGIN -->
Recorded from a full scan: 2/2 cells ok (one page, two viewports, one mode),
1 finding (1 new, 0 known), axe-core 4.10.3, signature scheme 1.

| signature | impact | scope | n | pages | viewports | themes |
|---|---|---|---|---|---|---|
| `button-name :: button` | critical | localized | 1 | index.html | both | default |

Both cells carry `darkColoured: true`, and the console prints the
dark-coloured note for `index.html`.
<!-- OBSERVED-END -->

### Regenerating

```bash
cd tests/docs/axe-scan/sites/darkly
quarto render
quarto call axe _site          # writes _axe-checks/ next to _quarto.yml
```

Both `_site/` and `_axe-checks/` are throwaway. The smoke test removes them.
