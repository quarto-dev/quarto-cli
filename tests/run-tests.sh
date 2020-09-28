#!/bin/zsh
deno test --allow-run --allow-env --unstable --importmap=../src/import_map.json $@
