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

# All entrypoints are vendored in a single call so that they share one lockfile
# (deno.lock at the repository root). The lockfile is checked in and the install
# is --frozen: it fails if the lockfile is out of date instead of silently
# re-resolving dependencies. Set QUARTO_UPDATE_DENO_LOCK=1 to update deno.lock
# (see dev-docs/add-typescript-dependency.md).
LOCK_FLAGS="--frozen"
if [ "${QUARTO_UPDATE_DENO_LOCK}" = "1" ]; then
  LOCK_FLAGS="--frozen=false"
fi

pushd "${QUARTO_SRC_PATH}"
$DENO_BIN_PATH install --allow-import --no-config $LOCK_FLAGS "--lock=$QUARTO_SRC_PATH/../deno.lock" \
  --entrypoint quarto.ts vendor_deps.ts ../tests/test-deps.ts ../package/scripts/deno_std/deno_std.ts ../package/src/bld.ts ../tools/deno-esbuild-bundle.ts \
  "--importmap=$QUARTO_SRC_PATH/import_map.json"
popd
