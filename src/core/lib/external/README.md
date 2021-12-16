# External dependencies

Some external dependencies that we bundle for a variety of reasons

* ajv: `ajv-bundle.js`

  repo: https://github.com/cscheid/ajv (fork of https://github.com/ajv-validator/ajv)

  We currently need a minor patch on ajv in order for the standalone
  code generator to be successfully imported in the ES6 module. (see https://github.com/ajv-validator/ajv/issues/1852)
  
  We also add an export to `lib/ajv.ts`, and then build a bundle with
  `esbuild --bundle --format=esm` from `dist/ajv.js`
  
* regexpp: `regexpp.mjs`

  repo: https://github.com/mysticatea/regexpp

  We need a regexp parser in core/lib to emit regexps that recognize
  prefixes of other regexps.
