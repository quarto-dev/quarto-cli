## Adding a new Typescript dependency to the project

FIXME THIS ALL NEEDS UPDATING FOR 1.46.3 AND LATER

We vendor all external dependencies to avoid downloads during the execution of quarto in installed environments. To add a new dependency, edit the `./src/import_map.json` file.

- If the dependency comes from the Deno standard library, make sure you match the version number (otherwise we can end up with duplicate imports from different versions)

- If the dependency is used in our test suite, add an explicit import statement to `tests/test-deps.ts`. This file is combined with `quarto.ts` in the vendoring process described below, and ensures that the dependencies are visible without having to scan the entire test suite.

- If the dependency is meant to be exposed to quarto typescript script (through `quarto run`), then add the import to `package/scripts/deno_std/deno_std.ts` as well (notice the slightly different syntax there, and adapt accordingly).

Then, rerun `./configure.sh`, which calls the `./package/scripts/vendoring/vendor.sh` scripts to update the deno cache with the downloaded dependencies. 

## The Deno lockfile

`deno.lock` at the repository root pins the exact version and integrity hash of every remote (`jsr:`, `npm:`, `https:`) module reachable from the vendored entrypoints (`src/quarto.ts`, `src/vendor_deps.ts`, `tests/test-deps.ts`, `package/scripts/deno_std/deno_std.ts`, `package/src/bld.ts`, `tools/deno-esbuild-bundle.ts`). It is committed so that builds, including downstream packaging (e.g. Homebrew), are reproducible and verified.

The build tools use the lockfile frozen: `vendor.sh` / `vendor.cmd` run `deno install --frozen`, and `quarto-bld` and the bundler run with `--lock=deno.lock --frozen`, so they fail with `The lockfile is out of date` instead of silently adding entries to it. Since `configure.sh` / `configure.cmd` run `quarto-bld` first, a stale lockfile stops `configure`. (`deno.jsonc` does not freeze the lockfile, because other scripts run in the repository, e.g. test helpers and `quarto-bld compile-quarto-latexmk`, use modules outside the vendored entrypoints.) After changing `src/import_map.json` or adding an import to one of the entrypoints, update the lockfile and commit it with your change:

```
QUARTO_UPDATE_DENO_LOCK=1 ./configure.sh
```

On Windows (the quotes matter, otherwise the value includes the trailing space before `&&`):

```
set "QUARTO_UPDATE_DENO_LOCK=1" && configure.cmd
```

and then `set "QUARTO_UPDATE_DENO_LOCK="` to clear it again in that shell.

Updating only adds entries; it never removes ones that are no longer used. For example, after changing a version in the import map, `deno.lock` contains both the old and the new version. To get rid of stale entries, delete `deno.lock` before running the update. Note that this re-resolves *all* dependencies, so transitive dependencies with version ranges may move to newer versions; review the resulting diff.

This is separate from `src/resources/deno_std/deno_std.lock`, which pins the standard library modules offered to `quarto run` scripts.
