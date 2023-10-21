#!/bin/bash

DIRNAME=~/repos/github/quarto-dev/quarto-cli/tests
cd $DIRNAME
quarto deno run --allow-all test-server/test-worker.ts $SERVER_URL
