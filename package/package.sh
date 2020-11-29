#!/bin/sh

# Packages Quarto into an installer

# TODO: Signing
# TODO: Notarize
# TODO: Platforms

source ../configure

# Packaging Configuration
export IDENTIFIER=org.rstudio.quarto
export PKGNAME=quarto-${VERSION}.pkg
export OUT_DIR=out
# export SIGNING_IDENTITY=$TBD

SCRIPTS_DIR=scripts/macos/pkg

# Clean the out dir
rm -rf $OUT_DIR
mkdir $OUT_DIR

# codesign --force --options runtime -s "$SIGNING_IDENTITY" $WORKING_DIR/bin/quarto

# Package the product
pkgbuild --root "${WORKING_DIR}" \
         --identifier "${IDENTIFIER}" \
         --version "${VERSION}" \
         --install-location "/Library/Quarto" \
         --scripts ${SCRIPTS_DIR} \
         --ownership recommended \
         ${OUT_DIR}/${PKGNAME}

# Sign the package
# codesign --force --options runtime -s "$SIGNING_IDENTITY" ${OUT_DIR}/${PKGNAME}