#!/bin/zsh

#  common data
source configure

pushd package

rm -rf $WORKING_DIR

if [ ! -d "$WORKING_DIR" ]; then
	mkdir -p $WORKING_DIR
fi
pushd $WORKING_DIR

## Gather the resources
if [ ! -d "$RESOURCES_DIR" ]; then
	mkdir -p "$RESOURCES_DIR"
fi
cp -a ../../src/resources/* $RESOURCES_DIR/

if [ ! -d "$BIN_DIR" ]; then
	mkdir -p "$BIN_DIR"
fi
pushd $BIN_DIR

# Download Dependencies
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

PANDOCCROSSREFURL=https://github.com/lierdakil/pandoc-crossref/releases/download/
PANDOCCROSSREFFILE=pandoc-crossref-macOS.tar.xz
curl -fail -L $PANDOCCROSSREFURL/$PANDOCCROSSREF/$PANDOCCROSSREFFILE -o $PANDOCCROSSREFFILE --no-include
tar -xf $PANDOCCROSSREFFILE
rm $PANDOCCROSSREFFILE

popd

# Move the quarto shell script into place
cp ../scripts/macos/quarto $BIN_DIR/quarto

## Gather license and other information
cp ../../COPYRIGHT .
cp ../../COPYING.md .

# setup symlink
ln -fs $(realpath $BIN_DIR/quarto) /usr/local/bin/quarto

popd