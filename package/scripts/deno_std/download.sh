#!/bin/bash
SCRIPT_PATH=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
source "$SCRIPT_PATH/../common/utils.sh"
source "$SCRIPT_PATH/../../../configuration"
source "$SCRIPT_PATH/../../src/set_package_paths.sh"

if [ -z "$QUARTO_DENO" ]; then
  export QUARTO_DENO="$QUARTO_DIST_PATH/bin/tools/$DENO_DIR/deno"
fi


export DENO_DIR="$QUARTO_SRC_PATH/resources/deno_std/cache"
"$QUARTO_DENO" cache --no-config --unstable-ffi --lock "$QUARTO_SRC_PATH/resources/deno_std/deno_std.lock" "$@" "$QUARTO_PACKAGE_PATH/scripts/deno_std/deno_std.ts"