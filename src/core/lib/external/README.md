# External dependencies

Some external dependencies that we bundle for a variety of reasons.
Mostly these are larger external dependencies we want to bundle via esbuild.

- regexpp: `regexpp.mjs`
  repo: https://github.com/mysticatea/regexpp

  We need a regexp parser in core/lib to emit regexps that recognize prefixes of
  other regexps.

- colors: `colors.ts`
  repo: https://deno.land/std@0.118.0/fmt/colors.ts

  We use colors inside core/lib which undergoes an `esbuild` step. This
  simplifies our build, though ideally our `esbuild` step should bundle (the
  sufficiently simple) parts of the deno stdlib.
