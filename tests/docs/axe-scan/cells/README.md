# Captured per-cell axe payloads

Cells from scans of the fixture sites, saved verbatim as `tests/unit/` fixtures.
They let the aggregate stage run against genuine axe-core output without
launching a browser.

**Verbatim is the point.** These are not trimmed to the fields the aggregate
stage happens to read. Keeping the whole payload means an axe upgrade that
changes its shape — how `color-contrast` reports its colour pair, how
`failureSummary` is worded — surfaces in a fast unit test rather than only in
the browser-driven smoke tests.

One directory per site, and the unit tests aggregate each set separately,
exactly as a real scan of either site would. Do not merge them. A union of two
sites is a scan that never happened, and its page list and cell counts would
mean nothing.

## `findings/` — from `../sites/findings`

| cell | why it is here |
|---|---|
| `index__1440x900__light` | the desktop and light baseline |
| `index__390x844__light` | a second cell of the same page, for the matrix union |
| `index__1440x900__dark` | with the two above and below, one page in all four cells |
| `index__390x844__dark` | so a finding's per-page cell list can be asserted in full |
| `about__1440x900__light` | a second page carrying the systemic `image-alt` |
| `static_legacy__1440x900__default` | hand-written non-Quarto DOM: one-mode (`default`) cell, and the digit-run and volatile-attribute cases |

## `matrix/` — from `../sites/matrix`

| cell | why it is here |
|---|---|
| `media__1440x900__light` | the baseline the other three are compared against |
| `media__1440x900__dark` | the dark-only `color-contrast` failure |
| `media__390x844__light` | the mobile-only `color-contrast` failure |
| `media__390x844__dark` | both conditional failures in one cell |

`theme.qmd`'s failure — reachable only by seeding Quarto's colour-scheme
localStorage key — has no capture. Nothing about it is visible in an
aggregated payload, because mode selection is a property of the scan and not
of the result. `tests/smoke/axe/axe-matrix.test.ts` covers it.

## Regenerating

Re-scan the site, then copy the matching files out of its `_axe-checks/cells/`:

```bash
cd tests/docs/axe-scan/sites/findings
quarto render
quarto call axe _site
cp _axe-checks/cells/index__1440x900__light.json ../../cells/findings/
```

If the set changes, update this file and the site's observed table. The two
describe the same scan.
