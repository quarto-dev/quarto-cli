# core/lib

`core/lib` contains functions and classes that are both usable from within the
Deno side of quarto and as a buildable standalone library through `esbuild`.

This is so that these functions can be called from JS code in the IDE.

## Building

From this directory:

    $ esbuild --bundle index.ts --outfile=core-lib.js --format=iife

Then, copy the file to where it might be needed (currently only for yaml IDE
support)

    $ cp core-lib.js ../../resources/editor/tools/yaml/

or run `./build.sh`
