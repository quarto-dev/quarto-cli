#!/bin/bash

source configuration

source $QUARTO_PACKAGE_DIR/scripts/configure-base.sh

pushd $QUARTO_PACKAGE_DIR/$QUARTO_DIST_DIR/$QUARTO_BIN_DIR

# Download Dependencies
## TODO: Convert to S3 / repo location
DENOURL=https://github.com/denoland/deno/releases/download/
DENOFILE=deno-x86_64-apple-darwin.zip
wget -O $DENOFILE $DENOURL/$DENO/$DENOFILE
unzip -o $DENOFILE
rm $DENOFILE

PANDOCURL=https://github.com/jgm/pandoc/releases/download/
PANDOCFILE=pandoc-$PANDOC-macOS.zip
PANDOCDIR=pandoc-$PANDOC
wget -O $PANDOCFILE $PANDOCURL/$PANDOC/$PANDOCFILE
unzip -o $PANDOCFILE
cp $PANDOCDIR/bin/pandoc .
rm -rf $PANDOCDIR
rm $PANDOCFILE

popd




