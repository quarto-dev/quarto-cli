# Fixtures for `quarto dev-call axe`

Deliberately inaccessible sites. Every violation is planted on purpose, so the
scanner's grouping, matrix and baseline behaviour can be asserted against known
intent rather than against whatever a real site happens to contain.

**Do not fix the accessibility problems in these directories.** They are the
test data.

## One site per concern

There were once one site and one smoke test. Every concern shared one page list,
so adding a page moved assertions in unrelated verifiers. That happened twice.
Each site below now carries one concern, and each has its own smoke test.

| site | concern | smoke test |
|---|---|---|
| `sites/findings/` | grouping, systemic against localized, the impact spread, baseline reconciliation, the report, and a page Quarto did not render | `tests/smoke/axe/axe-findings.test.ts` |
| `sites/matrix/` | the viewport and mode axes: conditional failures each reachable by exactly one route | `tests/smoke/axe/axe-matrix.test.ts` |
| `sites/brand-light-only/` | a `_brand.yml` with light values only, which must not read as a dark mode | `tests/smoke/axe/axe-brand.test.ts` |
| `sites/darkly/` | a single dark-coloured theme: one `default` cell, annotated dark-coloured | `tests/smoke/axe/axe-darkly.test.ts` |

`cells/` holds raw per-cell payloads captured from two of these sites. The unit
tests read them, so the aggregate stage can be exercised without a browser.

## Ground rules for adding a fixture

Add the page to the site whose concern it belongs to. If it belongs to no site,
add a site. A page in the wrong site is how the coupling came back last time.

Keep each planted violation reachable by one route only. A finding that appears
in every cell proves nothing about the matrix.

The sites are source only. Each smoke test renders its site, scans it, then
removes the render and the scan artifacts. A committed render would carry
`site_libs/` and go stale on every Quarto change.

## Regenerating a site's observed table

Each site's README records what that site actually produces. axe chooses a
minimal unique selector from the DOM as it finds it, so a signature is
discovered, not decreed.

```bash
cd tests/docs/axe-scan/sites/<site>
quarto render
quarto dev-call axe _site          # writes _axe-checks/ next to _quarto.yml
```

Then update the table from `_axe-checks/findings.json`, and read the diff. A
change there is either a fixture change or a signature-scheme change, and the
two need different responses.
