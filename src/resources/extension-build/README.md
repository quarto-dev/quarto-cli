# Extension Build Resources

This directory contains default configuration files for TypeScript execution engine extensions.

## Files

- **deno.json** - Default TypeScript compiler configuration
- **import-map.json** - Import mappings for @quarto/types and Deno standard library
- **quarto-types.d.ts** - Type definitions (copied from packages/quarto-types/dist/ during packaging)

## Usage

These files are used by `quarto dev-call build-ts-extension` when a user project doesn't have its own `deno.json`.

**Dev mode:** Accessed via `resourcePath("extension-build/")`
- `import-map.json` points to `../../../packages/quarto-types/dist/index.d.ts`
- This relative path works from `src/resources/extension-build/`

**Distribution mode:** Copied to `share/extension-build/` during packaging
- `import-map.json` is transformed by `updateImportMap()` in prepare-dist.ts
- `@quarto/types` path changed to `./quarto-types.d.ts`
- Deno std versions updated from `src/import_map.json`

## Updating Versions

Deno std library versions are automatically synced from `src/import_map.json` during packaging.
No manual updates needed to this directory's import-map.json versions.
