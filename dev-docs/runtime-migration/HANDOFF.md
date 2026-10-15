# Session handoff: runtime migration planning

Written 2026-10-15 at the end of the planning session, for whoever (human or
agent) picks this up in a fresh session.

## State

- Branch `runtime-migration-plans` on `cderv/quarto-cli` (fork), based on
  `main` at `b86f98d`. Seven commits, all pushed. Working tree clean.
- Everything durable is in this directory (`dev-docs/runtime-migration/`):
  - `README.md`: entry point, the ordered table of 39 PRs, dependency graph,
    conventions the plans decided, progress metric.
  - `00-assessment.md`: decision record (why Node, impact, phased plan, spike
    results, module-by-module refactoring plan).
  - `_TEMPLATE.md`: plan structure and the normative shared vocabulary for
    `src/deno_ral/` (every plan uses these names).
  - `01-*.md` to `39-*.md`: one plan per PR.
  - `spike/`: the Node bundler, shim, launcher and test documents from the
    spike that ran the unmodified CLI on Node 22.
- The published assessment page (same content as `00-assessment.md` with the
  spike and refactoring sections): https://claude.ai/artifact/9thKkB7s15659uYgtwYUmW
  is private to its owner until shared from its Share menu; the canonical
  copy is `00-assessment.md` here.

## What was local to the planning container and is NOT on the branch

These were throwaway and are recreated by the plans when needed:

- `.spike-node/` (18 MB of GitHub clones of cliffy/deno_dom/etc., 146 MB of
  `node_modules`, `dist/quarto.js`, the Deno-baseline import map). The scripts
  that matter are committed under `spike/`; PR 26 turns them into
  `tools/node-bundle/`.
- `spike-node-tests/` outputs (rendered HTML, Deno-baseline renders).
- `package/dist/bin/tools/x86_64/` binaries (Deno 2.7.14, Pandoc 3.10, Dart
  Sass, Typst, typst-gather, esbuild) downloaded by hand because the planning
  sandbox's proxy blocked `deno.land`. A normal checkout gets them from
  `./configure.sh`.

## How to resume

1. `git fetch origin && git checkout runtime-migration-plans`.
2. Read `README.md`, then `00-assessment.md` sections 10 and 11, then
   `_TEMPLATE.md`.
3. Decide the open items listed in `00-assessment.md` section 9 (Node 26 LTS
   baseline, user-script deprecation policy, test runner choice,
   `quarto-latexmk` packaging). The plans carry recommendations for each.
4. Open the plans as PRs against `main` in the README order. Phase 0 plans
   (01–07) are independent and can run in parallel. Each plan names its
   branch, executor and verification commands.
5. Keep the README status column current as PRs merge.

## Known loose ends in the plans

- `00-assessment.md` and PR 22 still cite the inventory-era "71 files with
  direct std imports" and "166 `testing/asserts` imports"; PR 02's script
  measures 76 and 161 with a wider module list and says so. Not reconciled on
  purpose (narrative vs. tool output).
- PR 07 was written for porting puppeteer to `puppeteer-core` as asked, but
  its author found the launch helpers have no callers and recommends deleting
  them instead. Decide before executing PR 07.
- PR 13 counts 72 `Deno.*` sites in the Julia engine subtree; PR 02's script
  rule counts 74. Both are excluded from the ratchet from the start.
- Windows behaviour, interactive Cliffy prompts, Posit Connect publishing
  without a cookie jar, and the deno_dom WASM performance gate (PR 20) were
  reasoned about, not run.
- The plans were written against `main` at `b86f98d` (2026-10-14). Line
  references drift as `main` moves; re-grep before trusting a line number.

## Tracking with braid (optional)

braid 0.7.0 is installed in the cloud session image, but no skein is
configured for this repository (no `.braid.toml`, no `.braid-project`
marker), so nothing was created. To track the PRs as strands with their
dependencies: configure a skein (`braid init`, or `braid init --join <doc-id>`
with an existing one; keep `.braid.toml` out of git), then run
`dev-docs/runtime-migration/braid-seed.sh` once from the repository root.
It creates an epic plus 39 `task` strands labelled `runtime-migration`,
`phase-N` and `executor-<model>`, with `blocks` dependencies matching the
README order, so `braid ready` lists exactly the PRs that can start.
