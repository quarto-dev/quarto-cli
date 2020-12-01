#!/bin/bash

#  common data
source configuration

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
cp -a ../../src/resources/* $QUARTO_SHARE_DIR/

## Binary Directory
if [ ! -d "$QUARTO_BIN_DIR" ]; then
	mkdir -p "$QUARTO_BIN_DIR"
fi
pushd $QUARTO_BIN_DIR

# Download Dependencies
## TODO: Convert to S3 / repo location
DENOURL=https://github.com/denoland/deno/releases/download/
DENOFILE=deno-x86_64-apple-darwin.zip
curl -fail -L $DENOURL/$DENO/$DENOFILE -o $DENOFILE --no-include
unzip -o $DENOFILE
rm $DENOFILE

PANDOCURL=https://github.com/jgm/pandoc/releases/download/
PANDOCFILE=pandoc-$PANDOC-macOS.zip
PANDOCDIR=pandoc-$PANDOC
curl -fail -L $PANDOCURL/$PANDOC/$PANDOCFILE -o $PANDOCFILE --no-include
unzip -o $PANDOCFILE
cp $PANDOCDIR/bin/pandoc .
rm -rf $PANDOCDIR
rm $PANDOCFILE

popd

# Move the quarto shell script into place
cp ../scripts/macos/quarto $QUARTO_BIN_DIR/quarto

# setup local symlink
ln -fs $(realpath $QUARTO_BIN_DIR/quarto) /usr/local/bin/quarto

popd