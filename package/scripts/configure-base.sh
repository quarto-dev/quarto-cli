#!/bin/bash

#  common data
source configuration

echo "Creating Package Directories..."

pushd $QUARTO_PACKAGE_DIR

rm -rf $QUARTO_DIST_DIR

if [ ! -d "$QUARTO_DIST_DIR" ]; then
	mkdir -p $QUARTO_DIST_DIR
fi
pushd $QUARTO_DIST_DIR

## Share Directory
if [ ! -d "$QUARTO_SHARE_DIR" ]; then
	mkdir -p "$QUARTO_SHARE_DIR"
fi

## Binary Directory
if [ ! -d "$QUARTO_BIN_DIR" ]; then
	mkdir -p "$QUARTO_BIN_DIR"
fi

echo "Creating Quarto Scipt..."

# Move the quarto shell script into place
cp ../scripts/common/quarto $QUARTO_BIN_DIR/quarto

echo "Creating Quarto Symlink..."

# setup local symlink
sudo ln -fs $(realpath $QUARTO_BIN_DIR/quarto) /usr/local/bin/quarto

popd
popd
