#!/bin/bash

export DENO_DIR=src/resources/deno_std/cache 
deno cache --unstable --lock package/scripts/deno_std/deno_std.lock --lock-write package/scripts/deno_std/deno_std.ts
