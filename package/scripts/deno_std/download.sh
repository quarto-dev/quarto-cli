#!/bin/bash
SCRIPT_PATH=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
source $SCRIPT_PATH/../../../configuration
source $SCRIPT_PATH/../../src/set_package_paths.sh

if [[ "$OSTYPE" == "cygwin" || "$OSTYPE" == "msys" || "$OSTYPE" == "win32" || "$WSL_DISTRO_NAME" != "" ]]; then
  export ON_WIN=true
  executable_extension=.exe
fi

if [ -z "$QUARTO_DENO" ]; then
  export QUARTO_DENO=$QUARTO_DIST_PATH/bin/tools/deno${executable_extension}
fi

export DENO_DIR=src/resources/deno_std/cache
$QUARTO_DENO cache --unstable --lock $QUARTO_SRC_PATH/resources/deno_std/deno_std.lock "$@" $QUARTO_PACKAGE_PATH/scripts/deno_std/deno_std.ts
