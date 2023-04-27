#!/bin/bash

source configuration

# Defaults are set in configuration file, but can be overridden here.
#  We can't put these overrides in the configuration file because it is parsed
#  very naively on windows.
export DENO=${DENO_VERSION=$DENO}
export DENO_DOM=${DENO_DOM_VERSION=$DENO_DOM}
export PANDOC=${PANDOC_VERSION=$PANDOC}
export DARTSASS=${DART_SASS_VERSION=$DARTSASS}
export ESBUILD=${ESBUILD_VERSION=$ESBUILD}

source package/scripts/common/utils.sh
source package/src/set_package_paths.sh

QUARTO_VENDOR_BINARIES=${QUARTO_VENDOR_BINARIES=true}

DENO_BIN=${QUARTO_DENO=$QUARTO_BIN_PATH/tools/$DENO_DIR/deno}

if [[ "${QUARTO_VENDOR_BINARIES}" = "true" ]]; then
  export DENO_BIN_PATH=$QUARTO_BIN_PATH/tools/$DENO_DIR/deno
else
  if [ -z "$DENO_BIN_PATH" ]; then
    echo "DENO_BIN_PATH is not set. You either need to allow QUARTO_VENDOR_BINARIES or set DENO_BIN_PATH to the path of a deno binary."
    exit 1
  fi
fi

echo Revendoring quarto dependencies

pushd ${QUARTO_SRC_PATH}
today=`date +%Y-%m-%d`
mv vendor vendor-${today}
set +e
$DENO_BIN_PATH vendor --no-config quarto.ts $QUARTO_ROOT/tests/test-deps.ts --importmap=$QUARTO_SRC_PATH/import_map.json
return_code="$?"
set -e
if [[ ${return_code} -ne 0 ]]; then
  echo "deno vendor failed (likely because of a download error). Please run the configure script again."
  rm -rf vendor
  mv vendor-${today} vendor
  exit 1
else
  rm -rf vendor-${today}
fi
$DENO_BIN_PATH run --no-config --unstable --allow-all --importmap=$QUARTO_SRC_PATH/import_map.json $QUARTO_PACKAGE_PATH/src/common/create-dev-import-map.ts
