#!/bin/bash

source configuration

source $QUARTO_PACKAGE_DIR/scripts/configure-base.sh

pushd $QUARTO_PACKAGE_DIR/$QUARTO_DIST_DIR/$QUARTO_BIN_DIR

# Download Dependencies
## TODO: Convert to S3 / repo location
DENOURL=https://github.com/denoland/deno/releases/download/
DENOFILE=deno-x86_64-unknown-linux-gnu.zip
wget -q --show-progress -O $DENOFILE $DENOURL/$DENO/$DENOFILE
unzip -o $DENOFILE
rm $DENOFILE

PANDOCURL=https://github.com/jgm/pandoc/releases/download/
PANDOCFILE=pandoc-$PANDOC-linux-amd64.tar.gz

PANDOCDIR=pandoc-$PANDOC
wget -q --show-progress -O $PANDOCFILE $PANDOCURL/$PANDOC/$PANDOCFILE
tar -xzf $PANDOCFILE
cp $PANDOCDIR/bin/pandoc .
rm -rf $PANDOCDIR
rm $PANDOCFILE

DARTSASSURL=https://github.com/sass/dart-sass/releases/
DARTSASSFILE=dart-sass-$DARTSASS-linux-x64.tar.gz
DARTSASSDIR=dart-sass
wget -q --show-progress -O $DARTSASSFILE $DARTSASSURL/download/$DARTSASS/$DARTSASSFILE
rm -rf $DARTSASSDIR 
tar -xzf $DARTSASSFILE
rm $DARTSASSFILE

# Run the quarto command with 'reload', which will force the import_map dependencies
# to be reloaded
export QUARTO_DENO_EXTRA_OPTIONS="--reload"
quarto --version

popd






