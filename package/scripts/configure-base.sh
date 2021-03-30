#!/bin/bash

#  common data
source configuration

# capture install dir
INSTALL_DIR=`pwd`

# Ensure directory is there for Deno
echo "Creating Package Directories..."

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

popd
popd
