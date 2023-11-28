## bundle bug finder

This is a hack^Wtool to find badly-generated `deno bundle` code.

- run `npm install` in this directory
- copy the bundled file you generated with `./quarto-bld prepare-dist` to this directory.
- cat the prelude and the built file together: `cat _prelude.js quarto.js > bundle.js`
- run eslint on the bundle: `npx eslint bundle.js`

In a recent instance of a bundler bug, this is the resulting report:

```
$ npx eslint bundle.js

/Users/cscheid/repos/github/quarto-dev/quarto-cli/tools/bundle-bug-finder/bundle.js
  6322:18  error  'isGlob' is not defined  no-undef

✖ 1 problem (1 error, 0 warnings)
```
