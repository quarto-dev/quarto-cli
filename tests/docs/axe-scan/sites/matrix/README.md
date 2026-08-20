# Fixture site: matrix

The two axes that justify scanning every page four times.

Every planted failure here is conditional, and each is reachable by exactly one
route. A cell that took the wrong route therefore fails an assertion, rather
than quietly reporting a duplicate.

**Do not fix the accessibility problems in this directory.** They are the test
data.

Keep unconditional violations out of this site. One would appear in all four
cells of every comparison the site exists to make. There is no
`_axe-baseline.json` here either, which also exercises a first run with no
ledger.

## Planted violations

| rule | impact | placement | reachable by |
|---|---|---|---|
| `color-contrast` | serious | `media.qmd`, inside `@media (prefers-color-scheme: dark)` | emulating a dark colour-scheme preference |
| `color-contrast` | serious | `media.qmd`, inside `@media (max-width: 500px)` | the narrow viewport |
| `color-contrast` | serious | `theme.qmd`, from darkly's own palette | clicking Quarto's colour-scheme toggle |

Absence matters as much as presence. The dark-only findings must **not** appear
in the light cells, and the mobile-only finding must **not** appear at
1440x900.

## Two routes into a theme

The theme axis tests the two themes the author ships, not the two states a
user's OS can be in. A page can offer either route, so the scanner sets both and
then reads back which theme is really active.

- `media.qmd`'s failure is in author CSS under `@media (prefers-color-scheme:
  dark)`, so **emulation** reaches it.
- `theme.qmd`'s failure is in darkly itself, so **the colour-scheme toggle**
  reaches it. Emulation cannot. Quarto ignores `prefers-color-scheme` unless
  `respect-user-color-scheme` is set, and this site leaves it at its default of
  false. Before the scanner drove the toggle, this failure was invisible and the
  dark cells rendered the light theme.

Each cell records its route in `colorScheme`. Watch for `toggled` on a *light*
cell. The toggle writes `localStorage` and every cell is served from one origin,
so a page can load in the theme a previous cell selected and need clicking back.

Reuse must never happen on this site. Every page here has a real dark theme, so
an `assumed-identical` cell would mean a dark cell was never scanned. The smoke
test asserts that count is zero. `assumed-identical` is covered where it is
correct, in `../brand-light-only/` and on `../findings/static/legacy.html`.

## Intent against observed

<!-- OBSERVED-BEGIN -->
Recorded from a full scan: 12/12 cells ok, 4 findings (4 new, 0 known),
axe-core 4.10.3, signature scheme 1.

| signature | impact | scope | n | pages | viewports | themes |
|---|---|---|---|---|---|---|
| `color-contrast :: #555555 on #333333` | serious | localized | 1 | media.html | both | dark |
| `color-contrast :: #f8f8f8 on #f0f0f0` | serious | localized | 1 | media.html | 390x844 | both |
| `color-contrast :: #6c757d on #222222` | serious | localized | 1 | theme.html | both | dark |
| `aria-allowed-role :: .navbar-toggler` | minor | systemic | 3 | index.html, media.html, theme.html | 390x844 | both |
<!-- OBSERVED-END -->

`aria-allowed-role :: .navbar-toggler` comes from Quarto's own navbar, not from
this fixture. It can change or disappear on a Quarto upgrade, so no test depends
on it.

### Regenerating

```bash
cd tests/docs/axe-scan/sites/matrix
quarto render
quarto dev-call axe _site          # writes _axe-checks/ next to _quarto.yml
```

Both `_site/` and `_axe-checks/` are throwaway. The smoke test removes them.
