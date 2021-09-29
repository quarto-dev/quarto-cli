#!/bin/bash

esbuild --bundle index.ts --outfile=core-lib.js --format=iife
cp core-lib.js ../../resources/editor/tools/yaml

