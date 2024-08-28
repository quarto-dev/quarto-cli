#!/usr/bin/env bash

# run this from the top-level quarto-cli directory
deno lint -c deno.jsonc 2>&1 |  grep ' *at ' | sed "s/:.*$//" | sort | uniq | sort