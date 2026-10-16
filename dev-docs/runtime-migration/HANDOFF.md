# Session handoff: runtime migration planning

## Start here: reading order for a new session

1. This file, to the end: state of the branch, what was decided, how to resume.
2. `00-assessment.md` section 0 (errata and decisions), then sections 1, 2, 7
   and 11: why Node, what depends on Deno, the phased plan, the runtime-layer
   design.
3. `REVIEW-2026-10-15.md` sections 1, 2, 3 and 6: readiness per phase, the
   structural findings that shaped the rework, the landing strategy, the
   decisions table.
3b. `REVIEW-2026-10-16.md` (the Codex review of the reworked plans, 21
   findings) and `TRIAGE-2026-10-16.md` (every finding verified; the work
   split into maintainer decisions A1–A8, taken; a cross-plan reconciliation
   pass B1–B9, landed, one commit per item listed in the triage; and
   per-plan local corrections, bucket C, still to do). Read the triage's
   bucket C table before executing any plan it names.
4. `README.md`: the executable sequence, conventions, dependency graph and
   ratchet baseline. The index you consult while working, not the context.
5. `_TEMPLATE.md`: the normative vocabulary every plan uses.
6. `SPIKES.md`, then the plan file for the PR being executed.

The meeting summary with the roadmap and architecture drawings is a Claude doc
(private until shared): https://claude.ai/code/artifact/4868893e-2d5f-4b0c-8035-bfbaa5f264fd.
The assessment is also published as a page: https://claude.ai/artifact/9thKkB7s15659uYgtwYUmW.
Both derive from the files here; the files are canonical.

Written 2026-10-15 at the end of the planning session, updated 2026-10-16 at
the end of the reconciliation pass, for whoever (human or agent) picks this
up in a fresh session.

## State

- Branch `runtime-migration-plans` on `cderv/quarto-cli` (fork), based on
  `main` at `b86f98d`. All commits pushed.
- Everything durable is in this directory (`dev-docs/runtime-migration/`):
  - `README.md`: entry point, the ordered table of 39 PRs, dependency graph,
    conventions the plans decided, progress metric.
  - `00-assessment.md`: decision record (why Node, impact, phased plan, spike
    results, module-by-module refactoring plan).
  - `_TEMPLATE.md`: plan structure and the normative shared vocabulary for
    `src/deno_ral/` (every plan uses these names).
  - `00a-*.md` to `39-*.md`: one plan per PR (46 PRs), plus `SPIKES.md`.
  - `REVIEW-2026-10-15.md`, `REVIEW-2026-10-16.md`, `TRIAGE-2026-10-16.md`:
    the two reviews and the triage of the second one (what was decided,
    what was reconciled, what is still to correct locally).
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

## Review and rework (2026-10-15)

`REVIEW-2026-10-15.md` is the principal review of the first draft (13
structural findings, per-plan defects, the landing strategy, the decisions
taken in its section 6). Every plan was then reworked against it: six new PRs
(00a, 00b, 00c, 02b, 14b, 20b, 27b), PR 21 folded into 25, PR 07 and PR 39
rewritten and renamed, `SPIKES.md` added, `_TEMPLATE.md` vocabulary updated,
`00-assessment.md` given an errata section. `README.md` carries the new
table, dependency graph, conventions and baseline. The plans are now
executable in the README order; the first three to run are PR 02, 00a, 00b.

## Reconciliation pass (bucket B of `TRIAGE-2026-10-16.md`): done on 2026-10-16

All nine items are committed and pushed, one commit per item (verified with
`git log` on the branch). `README.md` "Shared rules and tables" is the index
of where each rule now lives; this table adds the commit.

| Item | Commit | Where the rule or table lives |
|---|---|---|
| B1 | `11d115f` | PR 02, Context "The std boundary rule" (`kStdAllowListed`; PR 22's table is the source); baseline `src` 49, `package/src` 3 |
| B2 | `22993e6` | PR 25, Context "Runtime residue table" (17 rows); PR 39 before PR 25; PR 33 Task 16; PR 35 Task 6 |
| B3 | `0480a47` | `_TEMPLATE.md` (env keys, `exit`, KV file rule); PR 28 acceptance; PRs 33/37 lose `--unstable-kv` and the stale KV-backend sentences |
| B4 | `7023b19` | PR 26, Interfaces "The builder contract"; PR 33 Task 2 step 4 keeps it |
| B5 | `91aa3ef` | PR 37, Context "The CI graph after this PR" (decision 5: `render-parity` = dev bundle vs distribution bundle) |
| B6 | `63b94d8` | `SPIKES.md` Spike V (after PR 30; rule 0 classification; rule 4 inconclusive) |
| B7 | `be2ea17` | PR 35, Spec "Supported migration surface" (the matrix, the "not available on Node" table, the version rule, the governing-lockfile table); PR 35 Decision 3 (module-local `Deno` binding for the `stdlib/*` bundles); PR 36 Decisions 3 and 4 (`@quarto/std-*` packages; root lockfile versions, the version rule as a warning); PRs 00c, 34, 37 refer to the matrix; README graph 35 → 36 |
| B8 | `99a5328` | PR 33, "Dual-runtime combinations until PR 37" (after Task 13) and the `execPath()` rule; PR 35 `runOnNode()` and PR 36 `typeCheck()` on `architectureToolsPath("node")`; doc comment on `execPath()` in PR 28 and `_TEMPLATE.md`; acceptance greps in 33, 35, 36, 37 |
| B9 | the commit that updated this file | README (review bullet, "Shared rules and tables", rows 33 and 35), this file, the resolution list in `TRIAGE-2026-10-16.md` |

The README table, dependency graph and progress metric were checked once
against every plan's `**Depends on:**` line after B8: they agree (B2 and B6
had already moved PR 39 and Spike V; B7 added 35 → 36).

Three "Decision needed" entries were added by B7 where the triage did not
cover a mechanism, each with its recommendation picked and the plan written
for it: PR 35 Decision 3, PR 36 Decisions 3 and 4 (above). The C-row
correction of `aliasTarget()` in PR 36 is subsumed by PR 36 Decision 4.

Two notes for whoever continues: the B1 commit carries the maintainer's
author identity by mistake (an amend and force-push was refused; the
attribution line is in the message); the triage's C rows for PRs 33, 35
and 36 overlap files that B2, B4, B7 and B8 edited, and can run now that
the pass has landed.

## How to resume

1. `git fetch origin && git checkout runtime-migration-plans`.
2. Read `README.md`, then `00-assessment.md` sections 10 and 11, then
   `_TEMPLATE.md`.
3. The section 9 decisions are taken (`REVIEW-2026-10-15.md` section 6); the
   test runner is decided by Spike V in `SPIKES.md` before PR 31.
4. Apply the local corrections of `TRIAGE-2026-10-16.md` bucket C (one task
   per plan file, in parallel where the triage marks it), then the re-read
   of 02, 25, 26, 27, 29, 33, 35, 36 the triage's step 4 asks for.
5. Open the plans as PRs against `main` in the README order: PR 02 first, then
   00a and 00b, then 03–06 in parallel, then 07. Each plan names its
   branch, executor and verification commands.
6. Keep the README status column current as PRs merge.

## Known loose ends in the plans

- `00-assessment.md` still cites the inventory-era "71 files with direct std
  imports" and "166 `testing/asserts` imports"; PR 02's script measures 75
  `src` files before the std boundary allow-list and 49 after it (B1), and
  161 in `tests`, and says so. Not reconciled on purpose (narrative vs. tool
  output).
- Bucket C of `TRIAGE-2026-10-16.md` is not applied: plans 00b, 14b, 26, 27,
  28, 29, 30, 31, 32, 33, 34, 35, 36 still carry the defects its C table
  names. The line numbers in the review and triage were measured at
  `075cbf4`; re-grep before trusting one.
- Spike V may end inconclusive (`SPIKES.md` rule 4): PR 31 then keeps both
  harness variants and PR 32 cannot make the Node matrix required until the
  spike is re-run. The schedule has no slot for that re-run yet.
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
It creates an epic plus 46 `task` strands, two spike strands and one milestone labelled `runtime-migration`,
`phase-N` and `executor-<model>`, with `blocks` dependencies matching the
README order, so `braid ready` lists exactly the PRs that can start.
