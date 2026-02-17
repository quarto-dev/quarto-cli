# Cloudsmith Package Publishing

Publishes Linux packages (DEBs and RPMs) to Cloudsmith's `posit/open` repository.

**Workflow**: [.github/workflows/publish-cloudsmith.yml](../.github/workflows/publish-cloudsmith.yml)

## Automatic Publishing

Called automatically by `create-release.yml` for stable releases (non-prereleases).

## Manual Publishing

Use for:
- Republishing older releases
- Fixing package issues
- Testing with dry-run

### Steps

1. Go to [Actions → Publish to Cloudsmith](https://github.com/quarto-dev/quarto-cli/actions/workflows/publish-cloudsmith.yml)
2. Click "Run workflow"
3. Configure:
   - **version**: `v1.8.26` (release tag)
   - **dry-run**: Check for testing, uncheck for production
4. Run workflow

### Dry-Run First

**Always test with dry-run before production:**

```yaml
dry-run: true   # Test - validates but doesn't publish
dry-run: false  # Production - publishes to Cloudsmith
```

Dry-run downloads packages and validates parameters without pushing to Cloudsmith.

## Required Assets

Workflow expects these in the GitHub release:

```
quarto-${VERSION}-linux-amd64.deb
quarto-${VERSION}-linux-arm64.deb
quarto-${VERSION}-linux-x86_64.rpm
quarto-${VERSION}-linux-aarch64.rpm
```

Verify with:
```bash
gh release view v1.8.26 --json assets --jq '.assets[].name' | grep -E '(deb|rpm)'
```

## Architecture

- **Validation**: Checks assets exist via GitHub API
- **Matrix**: 4 parallel jobs (deb/rpm × x86_64/aarch64)
- **Publishing**: Uses `cloudsmith push` with `--republish` flag
- **Repository**: `posit/open/any-distro/any-version` (distribution-agnostic)

## Troubleshooting

**Assets missing**: Run [Build Installers](https://github.com/quarto-dev/quarto-cli/actions/workflows/create-release.yml) workflow to rebuild packages

**Authentication failed**: Check `CLOUDSMITH_API_KEY` secret in repository settings
