# Extension Build Resources

This directory contains default configuration files for TypeScript execution engine extensions.

## Files

- **deno.json** - Default TypeScript compiler configuration
- **import-map.json** - Import mappings for @quarto/types and Deno standard library
- **quarto-types.d.ts** - Type definitions for Quarto API (copied from packages/quarto-types/dist/ during build)

## Usage

These files are used by `quarto dev-call build-ts-extension` when a user project doesn't have its own `deno.json`.

In dev mode: accessed via `resourcePath("extension-build/")`
In distribution: copied to `share/extension-build/` during packaging

## Updating Versions

When updating Deno standard library versions:
1. Update `src/import_map.json` (main Quarto CLI import map)
2. Update `import-map.json` in this directory to match

The versions should stay in sync with Quarto CLI's dependencies.
