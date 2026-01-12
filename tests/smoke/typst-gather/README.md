# typst-gather smoke tests

These tests verify that `quarto call typst-gather` correctly:

1. Auto-detects Typst template files from `_extension.yml`
2. Scans those files for `@preview` package imports
3. Downloads the packages to `typst/packages/` directory
4. Uses `rootdir` from config file to resolve relative paths
5. Generates config with `--init-config`
6. Copies `@local` packages when configured in `[local]` section
7. Detects `@local` imports when generating config with `--init-config`

## Test fixtures

### `_extensions/test-format/`

Minimal Typst format extension for auto-detection test:

- `_extension.yml` - Defines template and template-partials
- `template.typ` - Imports `@preview/example:0.1.0`
- `typst-show.typ` - A template partial (no imports)

### `with-config/`

Test fixture with explicit `typst-gather.toml` config:

- `typst-gather.toml` - Config with `rootdir = "_extensions/config-format"`
- `_extensions/config-format/` - Extension directory

### `with-local/`

Test fixture for `@local` package support:

- `typst-gather.toml` - Config with `rootdir` and `[local]` section
- `_extensions/local-format/` - Extension that imports `@local/my-local-pkg`
- `local-packages/my-local-pkg/` - Local typst package source

## Manual testing

```bash
# Test auto-detection
cd tests/smoke/typst-gather
quarto call typst-gather

# Test config with rootdir
cd tests/smoke/typst-gather/with-config
quarto call typst-gather

# Test @local packages
cd tests/smoke/typst-gather/with-local
quarto call typst-gather

# Test --init-config
cd tests/smoke/typst-gather
quarto call typst-gather --init-config
```

## Cleanup

To reset the test fixtures:

```bash
rm -rf _extensions/test-format/typst/packages
rm -rf with-config/_extensions/config-format/typst/packages
rm -rf with-local/_extensions/local-format/typst/packages
rm -f typst-gather.toml
```
