#!/bin/bash
set -e
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

mkdir tools
pushd tools

# Download Dependencies
DENOURL=https://github.com/denoland/deno/releases/download/
DENOFILE=deno-x86_64-apple-darwin.zip
curl -fail -L $DENOURL/$DENO/$DENOFILE -o $DENOFILE --no-include
unzip -o $DENOFILE
rm $DENOFILE


# If a canary commit is provided, upgrade to that
if [ ! -z "$DENO_CANARY_COMMIT" ]; then
	echo [Upgrading Deno to Canary]
	./deno upgrade --canary --version $DENO_CANARY_COMMIT
fi

popd
popd
popd
popd

pushd $QUARTO_PACKAGE_DIR/src/

# Run the configure command to bootstrap installation
./quarto-bld configure --log-level info

popd

if [[ "$CI" != "true" && ( ( "./src/import_map.json" -nt "./src/dev_import_map.json" ) || ( "./src/vendor/import_map.json" -nt "./src/dev_import_map.json" ) ) ]]; then
	echo [Revendoring quarto dependencies]

	today=`date +%Y-%m-%d`
	mv ./src/vendor ./src/vendor-${today}
	pushd src
	set +e
	../package/dist/bin/tools/deno vendor quarto.ts ../tests/test-deps.ts --importmap=./import_map.json
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
	popd
	./package/dist/bin/tools/deno run --unstable --allow-all --importmap=./src/import_map.json package/src/common/create-dev-import-map.ts
fi

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
