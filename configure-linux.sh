#!/bin/bash

source configuration

export DENOFILE=deno-x86_64-unknown-linux-gnu.zip
export PANDOCFILE=andoc-2.11.2-linux-amd64.tar.gz

source $QUARTO_PACKAGE_DIR/scripts/configure-base.sh