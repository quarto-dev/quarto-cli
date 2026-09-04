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
| `color-contrast` | serious | `theme.qmd`, from darkly's own palette | seeding Quarto's colour-scheme localStorage key |

Absence matters as much as presence. The dark-only findings must **not** appear
in the light cells, and the mobile-only finding must **not** appear at
1440x900.

## Two routes into a dark cell

The theme axis tests the two presentations the author ships, not the two
states a user's OS can be in. A dark presentation can live in two places, and a
dark cell must select both:

- `media.qmd`'s failure is in author CSS under `@media (prefers-color-scheme:
  dark)`, so **emulation** reaches it.
- `theme.qmd`'s failure is in darkly itself, so only **seeding
  `localStorage["quarto-color-scheme"] = "alternate"` before navigation**
  reaches it. Emulation cannot: Quarto's themes ignore `prefers-color-scheme`
  unless `respect-user-color-scheme` is set, and this site leaves it at its
  default of false. Without the seed, this failure is invisible and the dark
  cells render the light theme — which is why its assertion is the one that
  fails if mode selection regresses.

Every page here carries the before-body script marker, so discovery must give
every page the light/dark pair. A `default` cell on this site would mean a
dark cell silently vanished from the matrix; the smoke test asserts the pair
on every page. One-mode discovery is covered where it is correct, in
`../brand-light-only/`, `../darkly/` and on `../findings/static/legacy.html`.

## Intent against observed

<!-- OBSERVED-BEGIN -->
Recorded from a full scan: 12/12 cells ok, 4 findings (4 new, 0 known),
axe-core 4.10.3, signature scheme 1.

| signature | impact | scope | n | pages | viewports | themes |
|---|---|---|---|---|---|---|
| `color-contrast :: #555555 on #333333` | serious | localized | 1 | media.html | both | dark |
| `color-contrast :: #f8f8f8 on #f0f0f0` | serious | localized | 1 | media.html | 320x568 | both |
| `color-contrast :: #6c757d on #222222` | serious | localized | 1 | theme.html | both | dark |
| `aria-allowed-role :: .navbar-toggler` | minor | systemic | 3 | index.html, media.html, theme.html | 320x568 | both |
<!-- OBSERVED-END -->

`aria-allowed-role :: .navbar-toggler` comes from Quarto's own navbar, not from
this fixture. It can change or disappear on a Quarto upgrade, so no test depends
on it.

### Regenerating

```bash
cd tests/docs/axe-scan/sites/matrix
quarto render
quarto call axe _site          # writes _axe-checks/ next to _quarto.yml
```

Both `_site/` and `_axe-checks/` are throwaway. The smoke test removes them.
