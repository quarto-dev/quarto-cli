#!/bin/bash

source configuration


# Ensure directory is there for Deno
echo "Bootstrapping Deno..."

pushd $QUARTO_PACKAGE_DIR
rm -rf $QUARTO_DIST_DIR

if [ ! -d "$QUARTO_DIST_DIR" ]; then
	mkdir -p $QUARTO_DIST_DIR
fi
pushd $QUARTO_DIST_DIR

## Binary Directory
if [ ! -d "$QUARTO_BIN_DIR" ]; then
	mkdir -p "$QUARTO_BIN_DIR"
fi

pushd $QUARTO_BIN_DIR

# Download Dependencies
DENOURL=https://github.com/denoland/deno/releases/download/
DL_ARCH="x86_64"
if [ "$(arch)" = "arm64" ]; then
  # deno canary commits only release per x86 arches
	# These are the currently supported target tuples:
    # Apple x86 (64-bit): x86_64-apple-darwin
    # Linux x86 (64-bit): x86_64-unknown-linux-gnu
    # Windows x86 (64-bit): x86_64-pc-windows-msvc
	echo "unsetting canary commit from $DENO_CANARY_COMMIT as not built on ARM"
	# hmm just unset was not seeming to work properly
	# we can just manually zero it out 
	DENO_CANARY_COMMIT=""
  DL_ARCH="aarch64"
fi
DENOFILE="deno-${DL_ARCH}-apple-darwin.zip"
curl -fail -L $DENOURL/$DENO/$DENOFILE -o $DENOFILE --no-include
unzip -o $DENOFILE
rm $DENOFILE

# If a canary commit is provided, upgrade to that
if [ ! -z "$DENO_CANARY_COMMIT" ]; then
	echo [Upgrading Deno to Canary]
	./deno upgrade --canary --version $DENO_CANARY_COMMIT
fi
./deno cache --reload ../../../src/quarto.ts --unstable --importmap=../../../src/import_map.json

popd
popd
popd

pushd $QUARTO_PACKAGE_DIR/src/

# Run the configure command to bootstrap installation
./quarto-bld configure --log-level info

popd

echo "Downloading Deno Stdlib"
./package/scripts/deno_std/download.sh

# Run the quarto command with 'reload', which will force the import_map dependencies
# to be reloaded
if ! quarto_loc="$(type -p quarto)" || [[ -z $quarto_loc ]]; then
  echo "Quarto symlink doesn't appear to be configured."
else 
  export QUARTO_DENO_EXTRA_OPTIONS="--reload"
	quarto --version
fi
