#!/bin/bash

# https://stackoverflow.com/a/246128
SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )

deno info --import-map dev_import_map.json quarto.ts | grep https | gsed -r 's/\x1B\[[0-9;]*[JKmsu]//g' | sed 's/[^ht]*ht/ht/g' | grep -v '\*$' | deno run --allow-read ${SCRIPT_DIR}/check-usage.ts $*

## Info on how to read the output
#
# The two biggest offenders right now are deno_dom and
# media_types. however, those two files are almost entirely composed
# of big strings, which take little compilation overhead.
#
# We tested this by creating a version of deno_dom which
# loaded its big string from a file, and the dry startup time
# didn't go down at all (even though the total file size did.)
#


