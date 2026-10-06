# Brand detection during preview (#14593)

Manual fixture for the bug where `quarto preview` ignored a sibling `_brand.yml`
added or removed while the preview was running: `project.brandCache` was resolved
once and never invalidated, so the brand only took effect after restarting the
preview process. RStudio's "Render" button hits the same persistent preview
server, so it observed the same stale brand.

Drive this with the `/quarto-preview-test` workflow (start preview, mutate
`_brand.yml`, force a re-render, inspect output). See the parent
`../README.md` "Test Matrix: Brand Detection (#14593)" for the T28–T32 cases.

## Files

| File | Role |
|------|------|
| `report.qmd` | Minimal Typst doc with a link; `keep-typ: true` so the `.typ` is inspectable |
| `brand-imperial.yml` | A brand setting `primary: imperial-red` (`#BC1E22`) |

`report.typ`, `report.pdf`, `_brand.yml`, and `.quarto/` are scratch produced by a
run — only `report.qmd` and `brand-imperial.yml` are tracked.

## Brand signal

The brand is applied when the kept `report.typ` contains:

```
#show link: set text(fill: rgb("#bc1e22")
```

Present ⇒ brand ON (link colored). Absent ⇒ brand OFF.

## Manual on/off check

1. Start with no `_brand.yml` and preview the doc:
   `quarto preview report.qmd --to typst --no-browser`.
2. **ON** — copy `brand-imperial.yml` to `_brand.yml`, force a re-render (touch
   `report.qmd`), and confirm `report.typ` gains the brand link-color line.
3. **OFF** — remove `_brand.yml`, force another re-render, and confirm the
   line disappears.

Before the fix the brand stayed at its first-resolved state (OFF in the add case,
ON in the remove case) until the preview process was stopped. After the fix, the
resolve-time source-state guard on `project.brandCache` notices the `_brand.yml`
appear/disappear and re-resolves on the next render. A separate `quarto render`
(fresh context) always resolved the brand correctly, which is the disambiguator
that isolates the bug to the persistent preview context.
