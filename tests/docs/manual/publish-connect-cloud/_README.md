# Posit Connect Cloud Publishing Test Fixtures

Manual test documents for `quarto publish posit-connect-cloud`.

## Fixtures

- **single-doc/document.qmd** — Minimal single HTML document
- **simple-website/** — Minimal 2-page website with navigation

## Usage

All manual testing targets the **staging** environment:

```bash
export POSIT_CONNECT_CLOUD_ENVIRONMENT=staging
./package/dist/bin/quarto.cmd publish posit-connect-cloud <path>
```

## Notes

- `_publish.yml` files are created during testing and should not be committed
- Revert any content edits after testing: `git checkout -- .`
