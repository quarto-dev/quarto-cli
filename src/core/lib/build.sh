#!/bin/bash

echo "// deno-lint-ignore-file" > core-lib.js
esbuild --bundle index.ts --outfile=/dev/stdout --format=iife >> core-lib.js
cp core-lib.js ../../resources/editor/tools/yaml

