# Captured per-cell axe payloads

Eight cells from one scan of `../site`, saved verbatim as `tests/unit/`
fixtures so the aggregate stage can be exercised against genuine axe-core
output without launching a browser.

**Verbatim is the point.** These are not trimmed to the fields the aggregate
stage happens to read: keeping the whole payload means an axe upgrade that
changes its shape — how `color-contrast` reports its colour pair, how
`failureSummary` is worded — surfaces in a fast unit test rather than only in
the browser-driven smoke test.

The eight are chosen to cover every axis the unit tests assert, not to be a
complete scan:

| cell | why it's here |
|---|---|
| `media__1440x900__light` | the desktop/light baseline for the theme and viewport comparisons |
| `media__1440x900__dark` | the dark-only `color-contrast` failure |
| `media__390x844__light` | the mobile-only `color-contrast` failure |
| `media__390x844__dark` | both conditional failures in one cell |
| `index__1440x900__light` | the localized `link-name` and `heading-order` |
| `index__390x844__light` | a second cell of the same page, for the matrix union |
| `about__1440x900__light` | a second page carrying the systemic `image-alt` |
| `static_legacy__1440x900__light` | hand-written non-Quarto DOM: the digit-run and volatile-attribute cases |

Regenerate by re-scanning `../site` and copying the matching files out of its
`_axe-checks/cells/`. If the set changes, update `../site/README.md`'s observed
table too — the two describe the same scan.
