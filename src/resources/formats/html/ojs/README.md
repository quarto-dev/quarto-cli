# Notes on the Quarto OJS runtime

We use a bundled JS module to package all of the required JS for
the OJS integration in quarto.

## A single bundle file is needed

Although ES modules are very convenient to program in, they break the
fancy conversion of javascript resources into data URLs that is
necessary for self-contained files, specifically in that local imports
can be specified in javascript code, and those do not get translated
into data URLs themselves (perhaps in the future this could be done
through a fancy client-side import map trick?)

Our solution is to take all required javascript files and bundle them
together with `esbuild`.

## Building

We use `esbuild` to create esbuild-bundle.js, a single JS module which
combines all of the necessary local JS into a single file. Although this
should be eventually automated, it currently isn't. As a result, every time
you change JavaScript code, you need to run the following:

    $ esbuild --bundle quarto-ojs.js --outfile=esbuild-bundle.js --format=esm
    
## Organization

The important files are:

* `ojs-connector.js`: quarto-independent functionality to provide a
  minimal integration between Observable and other JS runtimes
* `quarto-ojs.js`: Provides the quarto OJS runtime, extending
  `OJSConnector` from `ojs-connector.js` with quarto-specific
  functionality.
* `quarto-observable-shiny.js`: Code to orchestrate Quarto, OJS and
  Shiny (specifically Shiny reactives).
* `pandoc-code-decorator.js`:
  [this](https://github.com/cscheid/pandoc-code-decorator), required
  to dynamically decorate code ranges with CSS classes (in our case
  arising from OJS runtime errors)
* `stdlib.js`: A minimally-forked version of Observable's `stdlib.js`
  which includes from [our local patched version of
  `d3-require`](https://github.com/cscheid/d3-require), while [this
  PR](https://github.com/d3/d3-require/pull/40) isn't merged.
* `esbuild-bundle.js`: The resulting build product.
