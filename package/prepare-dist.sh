#!/bin/sh

# Prepares Quarto source files for packaging

source ../configure

pushd $WORKING_DIR

# TODO: What are we getting out of bundling, if anything
	# maybe should just bundle ts files to get good stack traces
	# if better than 200ms startup time, that would be worth it
	# test with wrapper doing simple render and timing it

# Create the Deno bundle
$BIN_DIR/deno bundle --unstable --importmap=../../src/import_map.json ../../src/quarto.ts bin/quarto.js

# TODO: compose lua filters

popd