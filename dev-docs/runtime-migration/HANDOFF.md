# Session handoff: runtime migration planning

## Start here: reading order for a new session

1. This file, to the end: state of the branch, what was decided, how to resume.
2. `00-assessment.md` section 0 (errata and decisions), then sections 1, 2, 7 and 11: why Node, what depends on Deno, the phased plan, the runtime-layer design.
3. `REVIEW-2026-10-15.md` sections 1, 2, 3 and 6: readiness per phase, the structural findings that shaped the rework, the landing strategy, the decisions table.
3b.
`REVIEW-2026-10-16.md` (the Codex review of the reworked plans, 21 findings) and `TRIAGE-2026-10-16.md` (every finding verified; the work split into maintainer decisions A1–A8, taken; a cross-plan reconciliation pass B1–B9, landed, one commit per item listed in the triage; and per-plan local corrections, bucket C, applied, and its step-4 re-read, done).
Its A9–A11 are still open: see "Known loose ends" below for where each is written.
4. `README.md`: the executable sequence, conventions, dependency graph and ratchet baseline.
   The index you consult while working, not the context.
5. `_TEMPLATE.md`: the normative vocabulary every plan uses.
6. `SPIKES.md`, then the plan file for the PR being executed.

The meeting summary with the roadmap and architecture drawings is a Claude doc (private until shared): https://claude.ai/code/artifact/4868893e-2d5f-4b0c-8035-bfbaa5f264fd.
The assessment is also published as a page: https://claude.ai/artifact/9thKkB7s15659uYgtwYUmW.
Both derive from the files here; the files are canonical.

Written 2026-10-15 at the end of the planning session, updated 2026-10-16 at the end of the reconciliation pass, for whoever (human or agent) picks this up in a fresh session.

## State

- The plans merged to `main` as #15133 on 2026-10-20.
- Everything durable is in this directory (`dev-docs/runtime-migration/`):
  - `README.md`: entry point, the ordered table of 45 PRs, two spikes and one milestone, dependency graph, conventions the plans decided, progress metric.
  - `00-assessment.md`: decision record (why Node, impact, phased plan, spike results, module-by-module refactoring plan).
  - `_TEMPLATE.md`: plan structure and the normative shared vocabulary for `src/deno_ral/` (every plan uses these names).
  - `00a-*.md` to `39-*.md`: one plan per PR (45 PRs), plus `SPIKES.md`.
  - `REVIEW-2026-10-15.md`, `REVIEW-2026-10-16.md`, `TRIAGE-2026-10-16.md`: the two reviews and the triage of the second one (what was decided, what was reconciled, what is still to correct locally).
  - `spike/`: the Node bundler, shim, launcher and test documents from the spike that ran the unmodified CLI on Node 22.
- The published assessment page (same content as `00-assessment.md` with the spike and refactoring sections): https://claude.ai/artifact/9thKkB7s15659uYgtwYUmW is private to its owner until shared from its Share menu; the canonical copy is `00-assessment.md` here.

## What was local to the planning container and is NOT on the branch

These were throwaway and are recreated by the plans when needed:

- `.spike-node/` (18 MB of GitHub clones of cliffy/deno_dom/etc., 146 MB of `node_modules`, `dist/quarto.js`, the Deno-baseline import map).
  The scripts that matter are committed under `spike/`; PR 26 turns them into `tools/node-bundle/`.
- `spike-node-tests/` outputs (rendered HTML, Deno-baseline renders).
- `package/dist/bin/tools/x86_64/` binaries (Deno 2.7.14, Pandoc 3.10, Dart Sass, Typst, typst-gather, esbuild) downloaded by hand because the planning sandbox's proxy blocked `deno.land`.
  A normal checkout gets them from `./configure.sh`.

## Review and rework (2026-10-15)

`REVIEW-2026-10-15.md` is the principal review of the first draft (13 structural findings, per-plan defects, the landing strategy, the decisions taken in its section 6).
Every plan was then reworked against it: six new PRs (00a, 00b, 00c, 02b, 14b, 20b, 27b), PR 21 folded into 25, PR 07 and PR 39 rewritten and renamed, `SPIKES.md` added, `_TEMPLATE.md` vocabulary updated, `00-assessment.md` given an errata section.
`README.md` carries the new table, dependency graph, conventions and baseline.
The plans are now executable in the README order; PR 02 (#15135), 02c (#15153) and 02d (#15218) are merged, 09 (the `src/deno_ral/` fs, temp and errors layer) is in progress, and the next to run are 00a, then 00b.

## Reconciliation pass (bucket B of `TRIAGE-2026-10-16.md`): done on 2026-10-16

All nine items are committed and pushed, one commit per item (verified with `git log` on the branch).
`README.md` "Shared rules and tables" is the index of where each rule now lives; this table adds the commit.

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

The README table, dependency graph and progress metric were checked once against every plan's `**Depends on:**` line after B8: they agree (B2 and B6 had already moved PR 39 and Spike V; B7 added 35 → 36).

Three "Decision needed" entries were added by B7 where the triage did not cover a mechanism, each with its recommendation picked and the plan written for it: PR 35 Decision 3, PR 36 Decisions 3 and 4 (above).
The C-row correction of `aliasTarget()` in PR 36 is subsumed by PR 36 Decision 4.

Two notes for whoever continues: the B1 commit carries the maintainer's author identity by mistake (an amend and force-push was refused; the attribution line is in the message); the triage's C rows for PRs 33, 35 and 36 overlapped files that B2, B4, B7 and B8 edited, and were run after the pass landed (all three are done).

## Pending on `rt/09` before its PR opens

Written 2026-10-28; delete this section once both items are done.

1. Rebase onto `main`: PR 02d merged as #15218 (`623cd99e8`).
   `HANDOFF.md` conflicts on the two status lines both branches edited; resolve them to "02d (#15218) is merged, 09 is in progress".
   After the rebase, set the README `02d` row to `merged`.
   `tools/runtime-boundary-baseline.json` merges without a conflict; `quarto run --dev tools/check-runtime-boundary.ts` should then report `src` 992, `resources` 12, `tests` 875 and no "rose" message.
2. Task 4 review: the committed codemod (`c5af406bc`) had four defects, each to be fixed with a fixture before Task 5.
   Reverse mode turned a shorthand property (`{ os }`) into invalid syntax (`{ Deno.build.os }`); a type-only namespace import (`import type * as fs`) was overwritten with named imports; an existing `import { type statSync }` plus a `Deno.statSync(...)` call produced a duplicate binding; and forward mode rewrote calls on a local binding named `Deno`.

## How to resume

1. Work from an up-to-date `main`: the plans are there.
2. Read `README.md`, then `00-assessment.md` sections 10 and 11, then `_TEMPLATE.md`.
3. The section 9 decisions are taken (`REVIEW-2026-10-15.md` section 6); the test runner is decided by Spike V in `SPIKES.md` before PR 31.
4. Apply the local corrections of `TRIAGE-2026-10-16.md` bucket C (one task per plan file, in parallel where the triage marks it), then the re-read of 02, 25, 26, 27, 29, 33, 35, 36 the triage's step 4 asks for (02, 25, 26, 27 and 29 done 2026-10-16, 33, 35 and 36 done 2026-10-17: step 4 is complete).
5. PR 02, 02c and 02d are merged, 09 is in progress; open the remaining plans as PRs against `main` in the README order: 00a and 00b, then 03–06 in parallel, then 07.
   Each plan names its branch, executor and verification commands.
   For the per-worktree session ritual (window model, trust, fresh conversation, concurrency ceiling), check
   `local/multi-worktree-workflow.md` if it exists — it is a maintainer-local, untracked note.
6. Keep the README status column current as PRs merge.

## Organisation review (2026-10-17)

A management pre-validation of the plans (report in French under `/mnt/project-files/revue-organisation/`) found the content complete and the organisation incomplete: no named roles, no release dates in the index, no merge rule for shared files, two stale hand-offs (00b → 07, 22 → 27b).
Its corrections are in README ("Roles", "Release calendar", "Open decisions with an owner", ground rule 8, step 0 of "How to execute a plan"), `SPIKES.md` (decider column), `_TEMPLATE.md` and the plan headers it lists.
The "Roles" table has since been filled in for a solo maintainer (Chris) plus LLM-driven agents; the cut dates remain Chris's to confirm before Phase 0 starts.

## Known loose ends in the plans

- `00-assessment.md` still cites the inventory-era "71 files with direct std imports" and "166 `testing/asserts` imports"; PR 02's script measures 75 `src` files before the std boundary allow-list and 49 after it (B1), and 161 in `tests`, and says so.
  Not reconciled on purpose (narrative vs.
  tool output).
- Bucket C of `TRIAGE-2026-10-16.md` is applied for 00b (R20: lock scope, `tools/check-test-imports.ts`, Decision 2) and for 14b/28/34 (R10: the Windows `taskkill /T` case in `process-group.test.ts`, both preview tests on three OSes, a website preview test, the "Windows coverage" table; the Windows branch of `killProcess` moved from `preview-server.ts` into PR 08's layer so that PR 28 keeps one contract) and for 26 (R03: the "Resolver scope" rule in Interfaces, the `node_modules` importer check and `resolveDir` choice in the plugin, `resolveBare`'s `mapped` flag, `build.test.mjs`; the R04 interop prelude was already done by B4) and for 27 (R05: `openFlagBits()` and the "Open flags" rule, writes through the descriptor with `truncate: !append`; R06: the one-descriptor-owner `NodeFsFile`, streams closing through the object, idempotent `close()`, decision A8; R19: the Windows link type from `stat` of the source with a dangling-link fallback; tests for each in Tasks 2 and 4, checked on Node 22 only, Deno covered by the tests) and for 29 (R07: the "Server lifecycle" rule in Interfaces, decision A7; `shutdown()` awaits `listening` before closing, a per-server set of owned `ws` sockets closed with 1001 and terminated in the forced path, `Request.signal` from the response's `close` with `writableFinished === false`, the body loop racing `drain` with `close` and cancelling the reader; five R07 tests in Task 3; the body and all ten cases were run on Node 22.22 with `ws` 8.22, Deno not run) and for 30 (R18, decision A6: the "Lock ownership" rule in Interfaces and an exported `lockIndex()`; `<lock>/owner` with pid, host and nonce written on acquire, a `process.kill(pid, 0)` probe before breaking so a live owner's lock is never broken by age, a gone owner's at once and an unknown owner's after 10 s; `release()` and the final `rename` only while the marker matches; readers no longer delete a corrupt index; the Decision and Risks say best-effort exclusion; three R18 cases in Task 1; the body and the nine cases run on Node 22.22, plus a `kill -STOP` of a live writer for 12 s with a second writer waiting, Deno not run) and for 31 (R13: a "Leak guarantees" table in Interfaces, one mechanism per event; the per-test timeout, `QUARTO_TEST_TIMEOUT`, is a watchdog for hangs and "per-file" is corrected everywhere; `runChecked()` in `tests/harness.ts` fails a test that leaves a child, a listening server or a timer open (`process.getActiveResourcesInfo()` before and two `setImmediate` turns after the test) or that calls `exit()` (`process.exit` guarded), with `sanitize` mapped onto it; the forced exit bounds the run and detects nothing; open files, client sockets and pending fs operations are intentionally undetected on Node; a sixth `harness-node.test.ts` case and four one-file examples in Task 5; `runChecked()` run on Node 22.22, Deno and Vitest not run) and for 32 (R14: a "Parity evidence" table in Interfaces; `parity-compare` needs `node-buckets` too and fails in its first step on any `needs.*.result` other than `success`, then `compare-junit.mjs --buckets N` (`N_BUCKETS`, a new output of `node-buckets`) refuses a runtime with other than `N` bucket artifacts, a bucket without a report, a report without a case, a case without a file or a missing path with `parity: NO EVIDENCE`; `compare()` counts any failure on either side against `ok` (`failedDeno` never allowlisted, `failedNode` only for Julia); a test is `<file> :: <name>` (`caseId` and `cases` in PR 26's `junit.mjs`, the file from the case's `file` attribute, written by node:test's reporter on Node 26, a file-looking `classname`, Deno's, or the file suite, Vitest's; Node 22's reporter writes no file, so `junit-finish.mjs`, which replaces `junit-prereq.mjs`, keeps a `--file` wrap the runner scripts do not use); the artifact download patterns are `d[0-9][0-9]`/`n[0-9][0-9]` so that `denosanity` and `nbin` do not count as buckets; five `compare-junit.test.mjs` cases and two more in `junit.test.mjs`; the three scripts and their cases run on Node 26.12.0 and 22.22, the reporter's `file` attribute measured on both, the workflow not run; PR 37's file list renamed accordingly) and for 33 (R18: `ensure.mjs`'s `withLock()` copies PR 30's "Lock ownership" rule, restated in PR 33 Interfaces, since it cannot import `kv.ts`: `<lock>/owner` with pid, host and nonce, the `process.kill(pid, 0)` probe, a gone owner's lock broken at once, an unknown owner's after 120 s, a live owner's never, release only while the marker matches, the 300 s timeout naming the owner; `bundle()` gains an optional `beforeCommit` input, called before its first write and between the bundle's temporary file and its rename, which `ensure.mjs` passes as the lock's `assertHeld()`, added to PR 26's builder contract table; three R18 cases in Task 2 Step 2 and a by-hand check in Verification; R04's part, `banner`/`define` kept and the three-global prelude, was already done by B4 and is now named in the review checklist; `ensure.mjs` and the cases ran on Node 26.12.0 and 22.22, Deno not run) and for 35 (R05: `deno-members.cjs` copies PR 27's `openFlagBits()` and write mapping, "Open flags (PR 27's rule, copied)" in Interfaces, no string flag left, so `{ create: false }` truncates and never creates and `{ append,
  create: false }` never creates; R15: `Deno.Command` copies PR 28's rules, "Child processes (PR 28's rules, copied)": an enumerated option subset with a `TypeError` for anything else, per-method stdio defaults, `spawn()` handing out Web Streams with a `TypeError` for a non-piped getter, `128 +
  n` for a signal exit, `.bat`/`.cmd` through `cmd.exe` with a copy of `batchCommandLine()`, the differences from Deno stated; R09: the changelog names the member table and the `Command` subset instead of "the common `Deno` API calls" (B7 had already dropped "keep working"; R08's `architectureToolsPath("node")` was B8's); six R05/R15 cases in Task 3, the `.cmd` one Windows-only, a vectors case for the copy, review-checklist items that diff both copies against the layer, two Risks entries; the table and the cases other than the Windows one ran on Node 26.12.0 and 22.22, Deno not involved) and for 36 (R16: a "Config precedence" decision, one rule for the options and the map: `package.json` governs only through a `quarto.build` section, even an empty one, and a `deno.json` next to it is ignored whole and named by one warning; a `package.json` without `quarto.build` decides nothing and hides no `deno.json`; `resolveConfig()` rewritten on that rule with an `ignored` field the command warns from, a non-object `quarto.build` an error; the Goal, "Which map", "Config", the Interfaces comment, an acceptance bullet for the two mixed cases, a review item and a Risks entry say the same thing; the unit test's precedence case covers both mixed cases, the empty section and the error; the body and the case ran under `node --test` on Node 26.12.0 and 22.22; R17's `aliasTarget()` part was B7's PR 36 Decision 4).
  The step-4 re-read of 36 (2026-10-17) ran its `fs-log` engine as written against the packages PR 35's builder makes from the root pins, on Node 26.12.0 and 22.22, and found `path` served raw (`@std/path@1.0.8`'s `resolve()` reads `Deno.cwd()`: now `@quarto/std-path`), the member table's messages putting `Deno.Command` into every package (now `kDeno`), the `FileHandler` check lost under `minify: true` (now a `"quarto-unsupported:<member>"` literal), and two defects in PR 35's builder (the gate's loader on `unsupported.ts`, the gate scanning the inlined table); the R17 forms joined PR 36's version-rule test and the residue inspection its Verification.
  Every per-plan C row is applied, and the cross-cutting fact-check (triage row, 2026-10-16: pins, Node flags, package versions and OS minimums re-checked against the primary sources; four wrong facts fixed in 00a, 26, 31 and 33, Intel macOS note added to 34).
  The `--reverse` backport demo after PR 10 remains (next bullet).
  The line numbers in the review and triage were measured at `075cbf4`; re-grep before trusting one.
- Still open on 2026-10-17, each written where the session that needs it will read it, so none needs this file to be remembered: triage A9 (who opens the upstream issue with PumasAI, whether the process/network interfaces freeze first) in PR 08 "Decisions needed" and README row J; A10 (owners for the packaging readiness gate, the HTTP publishing contract, distribution compliance, the offline promise) as the README "Decisions and conventions" bullet to fill in; A11 (performance baseline and thresholds) in PR 34 "Decisions needed" 4; the `--reverse` backport demo (triage cross-cutting row 2) in PR 10 "Follow-up after merge", repeated by PR 37 Task 6 Step 2 after the flip; PR 25's two-command residue inspection in PR 37's Acceptance criteria and review checklist (PR 37 had repeated only the `execPath()` grep).
- Spike V may end inconclusive (`SPIKES.md` rule 4): PR 31 then keeps both harness variants and PR 32 cannot make the Node matrix required until the spike is re-run.
  README "The sequence" now carries the rows `27x–30x` (fix PRs for the runtime gaps rule 0 records) and `SV-rerun` between SV and 31.
- PR 07: decided (`REVIEW-2026-10-15.md` decision 8): the unused puppeteer launch helpers and the deprecated `chromium` tool are deleted, not ported; the plan is written that way.
  Nothing to decide before executing it.
- PR 13 counts 72 `Deno.*` sites in the Julia engine subtree; PR 02's script rule counts 74.
  Both are excluded from the ratchet from the start.
- Windows behaviour, interactive Cliffy prompts, Posit Connect publishing without a cookie jar, and the deno_dom WASM performance gate (PR 20) were reasoned about, not run.
- The plans were written against `main` at `b86f98d` (2026-10-14).
  Line references drift as `main` moves; re-grep before trusting a line number.

## Tracking

This repository has no issue tracker for this work: the files in this directory are the whole record.
The order, dependencies and status of every PR, spike and milestone are in `README.md` (the sequence tables and the dependency graph), and each plan file holds its own checkbox steps.

Anyone who wants issue-level tracking sets it up in their own tooling, from the README "The sequence" tables: one item per row (45 PRs, two spikes, one milestone), a dependency for each "depends on" entry, and a link to the row's plan file.
The maintainer does this in a private tracker that is not committed.
Keep the plans as the source for design; a tracker only needs status and ordering.
