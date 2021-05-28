#!/bin/zsh

export QUARTO_ACTION=test
export QUARTO_IMPORT_MAP=$(realpath ../src/import_map.json)
export QUARTO_TARGET=""
export QUARTO_DENO_EXTRA_OPTIONS="--coverage=cov_profile"

quarto $@