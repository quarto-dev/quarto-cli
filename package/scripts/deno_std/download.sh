#!/bin/bash

export DENO_DIR=src/resources/deno_std/cache 
package/dist/bin/deno cache --unstable --lock src/resources/deno_std/deno_std.lock "$@" package/scripts/deno_std/deno_std.ts


