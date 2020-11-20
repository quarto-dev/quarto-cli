source ../configure

pushd $WORKING_DIR

# Create the Deno bundle
$BIN_DIR/deno bundle --unstable --importmap=../../src/import_map.json ../../src/quarto.ts bin/quarto.js

# TODO: compose lua filters

popd