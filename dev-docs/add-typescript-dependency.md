## Adding a new Typescript dependency to the project

FIXME THIS ALL NEEDS UPDATING FOR 1.46.3 AND LATER

We vendor all external dependencies to avoid downloads during the execution of quarto in installed environments. To add a new dependency, edit the `./src/import_map.json` file.

- If the dependency comes from the Deno standard library, make sure you match the version number (otherwise we can end up with duplicate imports from different versions)

- If the dependency is used in our test suite, add an explicit import statement to `tests/test-deps.ts`. This file is combined with `quarto.ts` in the vendoring process described below, and ensures that the dependencies are visible without having to scan the entire test suite.

- If the dependency is meant to be exposed to quarto typescript script (through `quarto run`), then add the import to `package/scripts/deno_std/deno_std.ts` as well (notice the slightly different syntax there, and adapt accordingly).

Then, rerun `./configure.sh`, which calls the `./package/scripts/vendoring/vendor.sh` scripts to update the deno cache with the downloaded dependencies. 

## The Deno lockfile

`deno.lock` at the repository root pins the exact version and integrity hash of every remote (`jsr:`, `npm:`, `https:`) module reachable from the vendored entrypoints (`src/quarto.ts`, `src/vendor_deps.ts`, `tests/test-deps.ts`, `package/scripts/deno_std/deno_std.ts`, `package/src/bld.ts`, `tools/deno-esbuild-bundle.ts`). It is committed so that builds, including downstream packaging (e.g. Homebrew), are reproducible and verified.

`vendor.sh` / `vendor.cmd` run `deno install --frozen`, so they fail if the lockfile does not match the import map. After changing `src/import_map.json` or adding an import to one of the entrypoints, update the lockfile and commit it with your change:

```
QUARTO_UPDATE_DENO_LOCK=1 ./configure.sh   # Windows: set QUARTO_UPDATE_DENO_LOCK=1 && configure.cmd
```

This is separate from `src/resources/deno_std/deno_std.lock`, which pins the standard library modules offered to `quarto run` scripts.
