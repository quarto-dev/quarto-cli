#!/bin/bash

source configuration
source $QUARTO_PACKAGE_DIR/scripts/configure-base.sh

# capture install dir
INSTALL_DIR=`pwd`


pushd $QUARTO_PACKAGE_DIR/$QUARTO_DIST_DIR/$QUARTO_BIN_DIR

# Download Dependencies
DENOURL=https://github.com/denoland/deno/releases/download/
DENOFILE=deno-x86_64-apple-darwin.zip
curl -fail -L $DENOURL/$DENO/$DENOFILE -o $DENOFILE --no-include
unzip -o $DENOFILE
rm $DENOFILE

popd

pushd $QUARTO_PACKAGE_DIR/src/

# Run the configure command to bootstrap installation
./quarto-bld configure

popd


pushd $QUARTO_PACKAGE_DIR/$QUARTO_DIST_DIR/$QUARTO_BIN_DIR

# Run the quarto command with 'reload', which will force the import_map dependencies
# to be reloaded
export QUARTO_DENO_EXTRA_OPTIONS="--reload"
quarto --version

popd