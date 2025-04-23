#!/usr/bin/env bash

source configuration

# Defaults are set in configuration file, but can be overridden here.
#  We can't put these overrides in the configuration file because it is parsed
#  very naively on windows.
export DENO=${DENO_VERSION=$DENO}
export DENO_DOM=${DENO_DOM_VERSION=$DENO_DOM}
export PANDOC=${PANDOC_VERSION=$PANDOC}
export DARTSASS=${DART_SASS_VERSION=$DARTSASS}
export ESBUILD=${ESBUILD_VERSION=$ESBUILD}
export TYPST=${TYPST_VERSION=$TYPST}

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
export DENO_DIR=$QUARTO_BIN_PATH/deno_cache

echo Revendoring quarto dependencies

# remove deno_cache directory first
if [ -d "$DENO_DIR" ]; then
  rm -rf $DENO_DIR
fi

pushd ${QUARTO_SRC_PATH}
set +e
for entrypoint in quarto.ts vendor_deps.ts ../tests/test-deps.ts ../package/scripts/deno_std/deno_std.ts; do
  $DENO_BIN_PATH install --allow-all --no-config --entrypoint $entrypoint --importmap=$QUARTO_SRC_PATH/import_map.json
done
return_code="$?"
set -e
if [[ ${return_code} -ne 0 ]]; then
  echo "deno vendor failed (likely because of a download error)."
  exit 1
else
  rm -rf vendor-${today}
fi
popd
