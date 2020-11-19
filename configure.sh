#!/bin/zsh

# TODO JUPYTEXT

#  get the versions
source configure

WORKING_DIR=dist
RESOURCES_DIR=share
BIN_DIR=bin
SCRIPTS_DIR=scripts/macos/pkg
OUT_DIR=out

PKGNAME=quarto

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

# Create the Deno bundle
$BIN_DIR/deno bundle --unstable --importmap=../../src/import_map.json ../../src/quarto.ts bin/quarto.js

# Move the quarto shell script into place
cp ../scripts/macos/quarto $BIN_DIR/quarto

## Gather license and other information
cp ../../COPYRIGHT .
cp ../../COPYING.md .


# pkgbuild --root "dist" --identifier=org.rstudio.quarto --version 0.1 --install-location "/Library/Quarto" quarto.pkg


popd


rm -rf $OUT_DIR
mkdir $OUT_DIR

echo pkgbuild --root "${WORKING_DIR}" --identifier "${IDENTIFIER}" --version "${VERSION}" --install-location "/Library/Quarto" --scripts ${SCRIPTS_DIR} ${OUT_DIR}/${PKGNAME}.pkg
pkgbuild --root "${WORKING_DIR}" --identifier "${IDENTIFIER}" --version "${VERSION}" --install-location "/Library/Quarto" --scripts ${SCRIPTS_DIR} ${OUT_DIR}/${PKGNAME}.pkg


#mkdir scripts
# make file postinstall

# What are we getting out of bundling, if anything
	# maybe should just bundle ts files to get good stack traces
	# if better than 200ms startup time, that would be worth it
	# test with wrapper doing simple render and timing it

#!/bin/sh
# echo "Running postinstall" > /tmp/my_postinstall.log
# TODO: symlink quarto
# exit 0 # all good

# ^^^ PACKAGING

# notarize the package
	# generate an hcl to notarize (gon ./gon.hcl)
		# productbuild
			# pkgbuild
				# sign files at all? probably not useful
					# Build direcquartotory and paths



# /\/\/\/\/\/\/\/ INSTALLATION ON USER SYSTEM