# You should not need to run this script directly. 
# It is sourced by the configure.sh script.
if [[ "${QUARTO_VENDOR_BINARIES}" = "true" ]]; then
  export DENO_BIN_PATH=$QUARTO_BIN_PATH/tools/$DENO_ARCH_DIR/deno
else
  if [ -z "$DENO_BIN_PATH" ]; then
    echo "DENO_BIN_PATH is not set. You either need to allow QUARTO_VENDOR_BINARIES or set DENO_BIN_PATH to the path of a deno binary."
    exit 1
  fi
fi

if [ -z "$DENO_DIR" ]; then
  export DENO_DIR=$QUARTO_BIN_PATH/deno_cache
fi

echo Revendoring quarto dependencies

# remove deno_cache directory first, unless explicitly told to preserve
# (CI sets QUARTO_SKIP_DENO_CACHE_WIPE=1 so a restored cache survives vendor.sh)
if [ -d "$DENO_DIR" ] && [ "${QUARTO_SKIP_DENO_CACHE_WIPE}" != "1" ]; then
  rm -rf "$DENO_DIR"
fi

pushd "${QUARTO_SRC_PATH}"
set +e
for entrypoint in quarto.ts vendor_deps.ts ../tests/test-deps.ts ../package/scripts/deno_std/deno_std.ts; do
  $DENO_BIN_PATH install --allow-all --no-config --entrypoint $entrypoint "--importmap=$QUARTO_SRC_PATH/import_map.json"
done
set -e
popd
