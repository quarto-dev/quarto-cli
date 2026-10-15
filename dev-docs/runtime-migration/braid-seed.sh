#!/usr/bin/env bash
# Seed a braid skein with one strand per runtime-migration PR, wired with the
# dependencies from README.md, under a parent epic.
#
# Prerequisites: a configured skein (`braid init` or `braid init --join <doc-id>`
# in the repository root; never commit .braid.toml). Run from the repository
# root. Idempotence is not attempted: run once per skein.
#
# Usage: dev-docs/runtime-migration/braid-seed.sh [--dry-run]
set -euo pipefail

DRY_RUN=false
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=true

PLAN_DIR="dev-docs/runtime-migration"
declare -A ID

create() {
  # create <key> <title> <phase> <priority> <executor> <size> <plan-file> <deps: space-separated keys>
  local key=$1 title=$2 phase=$3 prio=$4 exec=$5 size=$6 plan=$7 deps=${8:-}
  local depflags=()
  [[ -n "${ID[epic]:-}" ]] && depflags+=(--deps "parent-child:${ID[epic]}")
  for d in $deps; do depflags+=(--deps "blocks:${ID[$d]}"); done
  local desc="Plan: ${PLAN_DIR}/${plan}. Executor: ${exec}. Size: ${size}. Phase ${phase}. See ${PLAN_DIR}/README.md for order and conventions."
  if $DRY_RUN; then
    echo "braid create \"$title\" --type task --priority $prio --label runtime-migration --label phase-$phase ${depflags[*]}"
    ID[$key]="br-dry-$key"
  else
    ID[$key]=$(braid create "$title" --type task --priority "$prio" \
      --label runtime-migration --label "phase-$phase" --label "executor-${exec,,}" \
      --description "$desc" "${depflags[@]}")
    echo "$key -> ${ID[$key]}"
  fi
}

if $DRY_RUN; then
  ID[epic]="br-dry-epic"
  echo "braid create \"Runtime migration: move quarto-cli off Deno\" --type epic --priority 1 --label runtime-migration"
else
  ID[epic]=$(braid create "Runtime migration: move quarto-cli off Deno" --type epic --priority 1 \
    --label runtime-migration \
    --description "Umbrella for the 39 PRs in ${PLAN_DIR}/README.md. Decision record: ${PLAN_DIR}/00-assessment.md.")
  echo "epic -> ${ID[epic]}"
fi

# Phase 0
create 01 "PR 01: quick fixes from the Node spike" 0 1 Sonnet S 01-quick-fixes-from-spike.md
create 02 "PR 02: runtime boundary ratchet in CI" 0 1 Sonnet S 02-runtime-boundary-check.md
create 03 "PR 03: skypack dependencies to npm" 0 1 Sonnet M 03-deps-skypack-to-npm.md
create 04 "PR 04: small deno.land/x dependencies replaced" 0 1 Opus M 04-deps-deno-land-x-small.md
create 05 "PR 05: deno_dom from JSR" 0 1 Opus M 05-deps-deno-dom-jsr.md
create 06 "PR 06: Cliffy 1.x from JSR" 0 1 Opus L 06-deps-cliffy-jsr.md
create 07 "PR 07: puppeteer-core from npm" 0 1 Opus M 07-deps-puppeteer-core.md
# Phase 1
create 08 "PR 08: deno_ral/process.ts" 1 1 Opus L 08-ral-process.md "02"
create 09 "PR 09: deno_ral fs/temp/errors layer and codemod tool" 1 1 Opus M 09-ral-fs-and-temp-layer.md "02"
create 10 "PR 10: fs codemod on src/core" 1 2 Sonnet M 10-codemod-fs-core.md "09"
create 11 "PR 11: fs codemod on src/command" 1 2 Sonnet M 11-codemod-fs-command.md "09"
create 12 "PR 12: fs codemod on src/project and src/format" 1 2 Sonnet M 12-codemod-fs-project-format.md "09"
create 13 "PR 13: fs codemod on the remaining src directories" 1 2 Sonnet M 13-codemod-fs-rest.md "09"
create 14 "PR 14: deno_ral/env.ts and codemod" 1 2 Sonnet M 14-ral-env.md "02"
create 15 "PR 15: deno_ral/net.ts and async port probing" 1 1 Opus M 15-ral-net-async-ports.md "08"
create 16 "PR 16: deno_ral/http.ts" 1 1 Opus M 16-ral-http.md "15"
create 17 "PR 17: deno_ral/watch.ts" 1 2 Sonnet S 17-ral-watch.md "09"
create 18 "PR 18: deno_ral/kv.ts" 1 2 Opus S 18-ral-kv.md "09"
create 19 "PR 19: platform.ts, main.ts, permissions" 1 2 Sonnet S 19-ral-platform-main-permissions.md "08"
create 20 "PR 20: remove deno_dom FFI plugin" 1 2 Opus M 20-remove-deno-dom-ffi.md "05"
create 21 "PR 21: Deno type references sweep" 1 3 Sonnet S 21-ral-types-sweep.md "08 09 15 17 18"
create 22 "PR 22: std import seams" 1 2 Sonnet M 22-std-import-seams.md "04"
create 23 "PR 23: codemod tests and harness adapter" 1 2 Opus L 23-codemod-tests.md "09 14 22"
create 24 "PR 24: codemod package/src" 1 2 Sonnet M 24-codemod-package-src.md "09 14"
create 25 "PR 25: boundary at zero, monkey-patch removed" 1 1 Sonnet S 25-boundary-zero-and-monkey-patch-removal.md "10 11 12 13 14 15 16 17 18 19 20 21 22 23 24"
# Phase 2
create 26 "PR 26: Node bundle tooling and CI job" 2 1 Opus M 26-node-build-job.md "03 04 05 06 07"
create 27 "PR 27: fs layer on Node APIs" 2 1 Opus L 27-ral-fs-on-node-apis.md "25"
create 28 "PR 28: process layer on Node APIs" 2 1 Opus M 28-ral-process-on-node-apis.md "25"
create 29 "PR 29: net, http, watch on Node APIs" 2 1 Opus M 29-ral-net-http-watch-on-node-apis.md "25"
create 30 "PR 30: kv on a JSON index" 2 2 Sonnet S 30-ral-kv-on-node.md "25"
create 31 "PR 31: test harness on Node" 2 1 Opus L 31-test-harness-on-node.md "26 23"
create 32 "PR 32: Node CI matrix required" 2 1 Sonnet S 32-node-ci-required.md "27 28 29 30 31"
# Phase 3
create 33 "PR 33: build tooling on Node" 3 1 Opus L 33-build-tooling-node.md "32"
create 34 "PR 34: installers, launcher, quarto check" 3 1 Opus M 34-installers-and-check.md "33"
create 35 "PR 35: user TypeScript scripts compatibility" 3 1 Opus L 35-user-scripts-compat.md "33"
create 36 "PR 36: build-ts-extension on esbuild" 3 2 Opus M 36-build-ts-extension-node.md "33"
create 37 "PR 37: CI switch and Deno removal" 3 1 Sonnet M 37-ci-switch-and-deno-removal.md "33 34 35 36"
create 38 "PR 38: lint, format and typecheck tooling" 3 2 Sonnet M 38-lint-format-typecheck-tooling.md "37"
create 39 "PR 39: quarto-latexmk packaging" 3 3 Sonnet S 39-quarto-latexmk-packaging.md "33"

echo "Seeded ${#ID[@]} strands. Next: braid ready"
