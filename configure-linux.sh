#!/bin/bash
set -e
source configuration

# Selects curl or wget based on availability and https support.
function download() {
	url=$1
	destination=$2

	if curl --version | grep -qF ' https '; then
	  curl --fail -L -o "$destination" "$url"
	else
	  wget -q -O "$destination" "$url"
	fi
}

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

mkdir tools
pushd tools

# Download Deno
DENOURL=https://github.com/denoland/deno/releases/download
DENOFILE=deno-x86_64-unknown-linux-gnu.zip
download "$DENOURL/$DENO/$DENOFILE" "$DENOFILE"
unzip -o $DENOFILE
rm $DENOFILE

# If a canary commit is provided, upgrade to that
if [ ! -z "$DENO_CANARY_COMMIT" ]; then
	echo [Upgrading Deno to Canary]
	./deno upgrade --canary --version $DENO_CANARY_COMMIT
fi
./deno cache --reload ../../../../src/quarto.ts --unstable --importmap=../../../../src/import_map.json

popd
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
