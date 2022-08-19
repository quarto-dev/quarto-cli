#!/bin/bash
SCRIPT_PATH=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
source $SCRIPT_PATH/../../../configuration
source $SCRIPT_PATH/../../src/set_package_paths.sh

if [ -z "$QUARTO_DENO" ]; then
  export QUARTO_DENO=$QUARTO_DIST_PATH/bin/tools/deno
fi

export DENO_DIR=src/resources/deno_std/cache
$QUARTO_DENO cache --unstable --lock $QUARTO_SRC_PATH/resources/deno_std/deno_std.lock "$@" $QUARTO_PACKAGE_PATH/scripts/deno_std/deno_std.ts
