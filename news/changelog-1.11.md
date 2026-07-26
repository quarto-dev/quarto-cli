All changes included in 1.11:

## Regression fixes

- ([#PRNUM](https://github.com/quarto-dev/quarto-cli/pull/PRNUM)): Fix `QUARTO_VENDOR_BINARIES=false` builds silently succeeding with missing binaries. The `configure` step's "is it on PATH?" check for `typst-gather`, `typst`, `pandoc` and `esbuild` compared an unawaited `Promise` against `undefined`, so the guard never fired. A build with `typst-gather` neither vendored nor on PATH reported success and produced a Quarto tree without it, surfacing only at render time as `typst-gather analyze failed; staging all packages as fallback`. The missing-binary error message now also names the path that was checked and the `QUARTO_TYPST_GATHER` environment variable.
