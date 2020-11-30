#!/bin/sh

# Prepares Quarto source files for packaging
source ../configuration

pushd $WORKING_DIR

# TODO: Consider generating a source map or something to get a good stack
# Create the Deno bundle
# $BIN_DIR/deno bundle --unstable --importmap=../../src/import_map.json ../../src/quarto.ts bin/quarto.js

# Compose crossref lua filter
cd $SHARE_DIR/filters
../../$BIN_DIR/deno run --allow-read --allow-write ../../../scripts/package-filters.ts

popd