#!/bin/bash

source configuration

export DENOFILE=deno-x86_64-apple-darwin.zip
export PANDOCFILE=pandoc-$PANDOC-macOS.zip
source $QUARTO_PACKAGE_DIR/scripts/configure-base.sh