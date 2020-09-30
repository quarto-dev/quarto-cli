#!/bin/zsh
export QUARTO_RESOURCES=`realpath ../src/resources/`
deno test --allow-run --allow-env --allow-read --unstable --importmap=../src/import_map.json $@
