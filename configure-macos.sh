#!/bin/bash

source configuration

source $QUARTO_PACKAGE_DIR/scripts/configure-base.sh

pushd $QUARTO_PACKAGE_DIR/$QUARTO_DIST_DIR/$QUARTO_BIN_DIR

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


DARTSASSURL=https://github.com/sass/dart-sass/releases/
DARTSASSFILE=dart-sass-$DARTSASS-macos-x64.tar.gz
DARTSASSDIR=dart-sass
curl -fail -L $DARTSASSURL/download/$DARTSASS/$DARTSASSFILE -o $DARTSASSFILE --no-include
rm -rf $DARTSASSDIR 
tar -xzf $DARTSASSFILE
rm $DARTSASSFILE

# Run the quarto command with 'reload', which will force the import_map dependencies
# to be reloaded
export QUARTO_DENO_EXTRA_OPTIONS="--reload"
quarto --version

popd