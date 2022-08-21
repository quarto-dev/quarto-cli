#!/bin/bash
set -ex
source configuration

# Defaults are set in configuration file, but can be overridden here.
#  We can't put these overrides in the configuration file because it is parsed
#  very naively on windows.
export DENO=${DENO_VERSION=$DENO}
export DENO_DOM=${DENO_DOM_VERSION=$DENO_DOM}
export PANDOC=${PANDOC_VERSION=$PANDOC}
export DARTSASS=${DART_SASS_VERSION=$DARTSASS}
export ESBUILD=${ESBUILD_VERSION=$ESBUILD}

source package/src/set_package_paths.sh

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

QUARTO_VENDOR_BINARIES=${QUARTO_VENDOR_BINARIES=true}

DENO_BIN=${QUARTO_DENO=$QUARTO_BIN_PATH/tools/deno}

if [[ "${QUARTO_VENDOR_BINARIES}" = "true" ]]; then
  DENO_VERSION_NO_V=$(echo $DENO | sed 's/v//')
  if [[ (! -f $DENO_BIN) || $($DENO_BIN --version | grep $DENO_VERSION_NO_V) == "" ]]; then
    # Ensure directory is there for Deno
    echo "Bootstrapping Deno..."

    rm -rf $QUARTO_DIST_PATH

    ## Binary Directory
    mkdir -p "$QUARTO_BIN_PATH/tools"
    cd $QUARTO_BIN_PATH/tools

    # Download Deno
    DENOURL=https://github.com/denoland/deno/releases/download
    if [[ $OSTYPE == 'darwin'* ]]; then
      DENOFILE=deno-x86_64-apple-darwin.zip
    else
      DENOFILE=deno-x86_64-unknown-linux-gnu.zip
    fi
    download "$DENOURL/$DENO/$DENOFILE" "$DENOFILE"
    unzip -o $DENOFILE
    rm $DENOFILE

    # If a canary commit is provided, upgrade to that
    if [ ! -z "$DENO_CANARY_COMMIT" ]; then
      echo [Upgrading Deno to Canary]
      ./deno upgrade --canary --version $DENO_CANARY_COMMIT
    fi
  fi
  export DENO_BIN_PATH=$QUARTO_BIN_PATH/tools/deno
else
  if [ -z "$DENO_BIN_PATH" ]; then
    echo "DENO_BIN_PATH is not set. You either need to allow QUARTO_VENDOR_BINARIES or set DENO_BIN_PATH to the path of a deno binary."
    exit 1
  fi
fi

echo "Downloading Deno Stdlib"
${QUARTO_PACKAGE_PATH}/scripts/deno_std/download.sh

pushd $QUARTO_PACKAGE_PATH/src/

# Run the configure command to bootstrap installation
./quarto-bld configure --log-level info


if [[ "$CI" != "true" && ( ( "$QUARTO_SRC_PATH/import_map.json" -nt "$QUARTO_SRC_PATH/dev_import_map.json" ) || ( "$QUARTO_SRC_PATH/vendor/import_map.json" -nt "$QUARTO_SRC_PATH/dev_import_map.json" ) ) ]]; then
	echo [Revendoring quarto dependencies]

	pushd ${QUARTO_SRC_PATH}
	today=`date +%Y-%m-%d`
	mv vendor vendor-${today}
	set +e
	$DENO_BIN_PATH vendor quarto.ts $QUARTO_ROOT/tests/test-deps.ts --importmap=$QUARTO_SRC_PATH/import_map.json
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
	$DENO_BIN_PATH run --unstable --allow-all --importmap=$QUARTO_SRC_PATH/import_map.json $QUARTO_PACKAGE_PATH/src/common/create-dev-import-map.ts
fi

# Run the quarto command with 'reload', which will force the import_map dependencies
# to be reloaded
if ! quarto_loc="$(type -p quarto)" || [[ -z $quarto_loc ]]; then
  echo "Quarto symlink doesn't appear to be configured."
else
  export QUARTO_DENO_EXTRA_OPTIONS="--reload"
	quarto --version
fi
