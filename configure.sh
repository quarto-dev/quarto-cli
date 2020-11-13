#!/bin/zsh

# TODO JUPYTEXT

#  get the versions
source configure

VERSION=0.1

WORKING_DIR=dist
RESOURCES_DIR=share
BIN_DIR=bin
CONF_DIR=conf

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
cp ../../src/resources/* $RESOURCES_DIR/

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

TINYTEXURL=https://github.com/yihui/tinytex-releases/releases/download/
TINYTEXFILE=TinyTeX-1-$TINYTEX.tgz
curl -fail -L $TINYTEXURL/$TINYTEX/$TINYTEXFILE -o $TINYTEXFILE --no-include
tar -xf $TINYTEXFILE
rm $TINYTEXFILE

popd

# Create the Deno bundle
$BIN_DIR/deno bundle --unstable --importmap=../../src/import_map.json ../../src/quarto.ts bin/quarto.js

# Move the quarto shell script into place
cp ../quarto $BIN_DIR/quarto

## Gather license and other information
cp ../../COPYRIGHT .
cp ../../COPYING.md .

if [ ! -d "$CONF_DIR" ]; then
	mkdir -p "$CONF_DIR"
fi
pushd $CONF_DIR

cp ../../link.sh .
cp ../../unlink.sh .

popd


# ^^^ PACKAGING



# notarize the package
	# generate an hcl to notarize (gon ./gon.hcl)
		# productbuild
			# pkgbuild
				# sign files at all? probably not useful
					# Build directory and paths



# /\/\/\/\/\/\/\/ INSTALLATION ON USER SYSTEM

# TODO: export QUARTO_RESOURCES=$(realpath ./resources)
# TODO: export PATH="$(realpath ./bin):$(realpath ./bin/pandoc-$PANDOC/bin):$PATH"
# TODO: need to 'Add /Users/charlesteague/.deno/bin to PATH'

