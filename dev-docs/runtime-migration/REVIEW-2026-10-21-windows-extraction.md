# Windows-executability review, phase 1: command extraction

Date: 2026-10-21. Branch `rt/02-runtime-boundary-check`. Scope: every file in `dev-docs/runtime-migration/` that carries executor commands: README, _TEMPLATE, SPIKES, 00-assessment and every plan 00a to 39 (49 files). Read-only extraction; no plan or code file was edited. Phase 2 verifies the (c) and (u) rows.

Classes: (a) works on Windows as written; (b) works with a mechanical adaptation named in the note; (c) likely blocked or behavior differs; (d) covered by the README per-OS manual-verification table (Windows: PRs 00b, 05, 06, 08, 14b, 28); (u) uncertain.

Row columns: `#`, `line` (line number in the plan file), `section`, command quoted, class, note. Rows that are test code the PR writes (not commands the executor types) say so in the note.

## Totals

**2550 commands extracted**: (a) 1028, (b) 990, (c) 163, (d) 58, (u) 311.

| File | Commands | a | b | c | d | u | Windows lines added by sweep |
|---|---|---|---|---|---|---|---|
| README.md | 13 | 6 | 4 | 0 | 0 | 3 | 0 |
| _TEMPLATE.md | 16 | 5 | 9 | 1 | 0 | 1 | 0 |
| SPIKES.md | 68 | 15 | 31 | 18 | 0 | 4 | 0 |
| 00-assessment.md | 8 | 2 | 4 | 0 | 0 | 2 | 0 |
| 00a-deno-bump.md | 25 | 10 | 15 | 0 | 0 | 0 | 0 |
| 00b-lockfile-and-bundle-gate.md | 99 | 27 | 41 | 8 | 14 | 9 | 15 |
| 00c-quarto-run-deprecation-notice.md | 22 | 6 | 14 | 1 | 0 | 1 | 0 |
| 01-quick-fixes-from-spike.md | 21 | 6 | 15 | 0 | 0 | 0 | 0 |
| 02-runtime-boundary-check.md | 55 | 29 | 24 | 1 | 0 | 1 | 0 |
| 02b-node-compatible-ts-syntax.md | 62 | 24 | 36 | 0 | 0 | 2 | 0 |
| 03-deps-skypack-to-npm.md | 54 | 16 | 26 | 1 | 0 | 11 | 0 |
| 04-deps-deno-land-x-small.md | 51 | 19 | 24 | 0 | 0 | 8 | 0 |
| 05-deps-deno-dom-jsr.md | 60 | 21 | 18 | 0 | 5 | 16 | 0 |
| 06-deps-cliffy-jsr.md | 53 | 12 | 21 | 0 | 18 | 2 | 0 |
| 07-remove-puppeteer-and-chromium-tool.md | 64 | 19 | 36 | 1 | 0 | 8 | 0 |
| 08-ral-process.md | 96 | 33 | 29 | 5 | 3 | 26 | 9 |
| 09-ral-fs-and-temp-layer.md | 54 | 19 | 30 | 0 | 0 | 5 | 0 |
| 10-codemod-fs-core.md | 41 | 18 | 21 | 0 | 0 | 2 | 0 |
| 11-codemod-fs-command.md | 33 | 13 | 15 | 1 | 0 | 4 | 0 |
| 12-codemod-fs-project-format.md | 33 | 15 | 16 | 1 | 0 | 1 | 0 |
| 13-codemod-fs-rest.md | 35 | 14 | 19 | 0 | 0 | 2 | 0 |
| 14b-coverage-first.md | 52 | 13 | 13 | 11 | 11 | 4 | 1 |
| 14-ral-env.md | 47 | 10 | 24 | 4 | 0 | 9 | 0 |
| 15-ral-net-async-ports.md | 41 | 17 | 17 | 0 | 3 | 4 | 0 |
| 16-ral-http.md | 38 | 12 | 18 | 1 | 1 | 6 | 0 |
| 17-ral-watch.md | 26 | 7 | 11 | 2 | 0 | 6 | 0 |
| 18-ral-kv.md | 36 | 13 | 15 | 2 | 0 | 6 | 0 |
| 19-ral-platform-main-permissions.md | 44 | 24 | 19 | 1 | 0 | 0 | 17 |
| 20b-hidden-deno-uses.md | 65 | 35 | 28 | 0 | 0 | 2 | 0 |
| 20-remove-deno-dom-ffi.md | 71 | 47 | 18 | 0 | 0 | 6 | 13 |
| 22-std-import-seams.md | 37 | 16 | 13 | 1 | 0 | 7 | 0 |
| 23-codemod-tests.md | 68 | 32 | 24 | 1 | 0 | 11 | 0 |
| 24-codemod-package-src.md | 40 | 17 | 17 | 3 | 0 | 3 | 0 |
| 25-boundary-zero-and-monkey-patch-removal.md | 62 | 42 | 17 | 0 | 0 | 3 | 1 |
| 26-node-build-job.md | 106 | 47 | 24 | 19 | 0 | 16 | 4 |
| 27b-ral-platform-env-tar-log-on-node.md | 43 | 8 | 17 | 6 | 0 | 12 | 0 |
| 27-ral-fs-on-node-apis.md | 42 | 14 | 13 | 2 | 0 | 13 | 27 |
| 28-ral-process-on-node-apis.md | 49 | 13 | 15 | 5 | 3 | 13 | 56 |
| 29-ral-net-http-watch-on-node-apis.md | 50 | 13 | 19 | 4 | 0 | 14 | 0 |
| 30-ral-kv-on-node.md | 46 | 21 | 15 | 2 | 0 | 8 | 0 |
| 31-test-harness-on-node.md | 95 | 36 | 40 | 13 | 0 | 6 | 0 |
| 32-node-ci-required.md | 76 | 63 | 4 | 2 | 0 | 7 | 1 |
| 33-build-tooling-node.md | 167 | 79 | 52 | 24 | 0 | 12 | 2 |
| 34-installers-and-check.md | 39 | 13 | 14 | 10 | 0 | 2 | 0 |
| 35-user-scripts-compat.md | 69 | 32 | 34 | 1 | 0 | 2 | 3 |
| 36-build-ts-extension-node.md | 40 | 15 | 21 | 0 | 0 | 4 | 0 |
| 37-ci-switch-and-deno-removal.md | 66 | 29 | 16 | 4 | 0 | 17 | 4 |
| 38-lint-format-typecheck-tooling.md | 52 | 19 | 18 | 7 | 0 | 8 | 0 |
| 39-remove-quarto-latexmk-compile.md | 20 | 12 | 6 | 0 | 0 | 2 | 0 |

## Least sure items

1. **Preview-reload on Windows is contradicted across plans.** Plan 15 (L596) and plan 17 (L92) say `preview-reload` "is ignored on Windows". Plan 14b (L33) says its first draft ignored the tests on Windows and that this version runs the preview tests there. Four (d) rows in plans 15, 16 and 17 credit 14b's Windows coverage, so they are only as good as 14b's claim. One plan 17 row (L91, "passes on Linux, macOS and Windows CI") was reclassified (d) to (u) at assembly because its own note says plan 17 is not README-listed.
2. **Launchers with no confirmed Windows form.** `tools/node-bundle/quarto-node` (extensionless), `package/scripts/vendoring/update-lock.sh`, `tools/rewrite-import-specifier.sh` (needs `python3`; a bare `python3` hung in the extractor's Git Bash), `parsehtml-gate.sh` and `run-tests-node.sh` are all classed (u), and none has a `.cmd` or `.ps1` counterpart named in any plan. Checked since extraction: `package/src/quarto-bld.cmd` exists, `package/dist/bin/` holds `quarto.cmd` and no extensionless `quarto`, and `tests/run-tests.ps1` parses `--agent` and honors `QUARTO_TESTS_NO_CONFIG`. Not checked: the `$(find ...)` file-list expansion the (b) rows hand to `run-tests.ps1`.
3. **MSYS path conversion in Git Bash.** `/tmp/...` paths handed to Windows binaries (`node --import <absolute path>`, env-var values, paths inside `node -e` strings), `$$` as an MSYS pid, and `/usr/bin/time` in Git for Windows are classed (u), (b) or (c) inconsistently across plans 31, 32, 33, 35, 37 and 38. Phase 2 should settle one rule and re-class these rows together.
4. **What (d) covers.** 58 rows are (d). Placement was checked: all sit in plans 00b, 05, 06, 08, 14b and 28, plus four transitive rows in 15, 16 and 17. Whether each row is really the manual per-OS step the README table means is not checked. The 00b `windows-latest` CI rows are the least certain, and the extractors for plans 03 to 06 and 27 to 29 never opened the README table.
5. **Spawning `.cmd` and `.exe` launchers from Deno and Node code.** `execFileSync("quarto", ...)` on Windows (plan 35 L2142, classed (c) from the Node rule against spawning `.cmd` without a shell), the `cmd /c` test cases in plan 08, `deno` versus `deno.exe` checks (plans 37 and 38), and the esbuild `NODE_PATH` / `--packages` builder on Windows (plan 36) all depend on behavior nobody ran.

## Method and verification notes

- **How it was produced.** 13 Sonnet subagents each read a slice of the files in full and wrote a partial table. The partials were concatenated in plan order by script. Class tallies were recomputed from the rows, not taken from the extractors' reports.
- **Row counts.** Declared and actual row counts match for all 49 files (2550 rows).
- **Class normalization.** One row had a non-standard class ("(d)? no", plan 35 row 69); its own note says it is counted as (b), so it is (b). Plan 17 L91 was changed from (d) to (u) (see least-sure item 1). No other class was changed.
- **Line citations.** Each row's quoted command was searched for at its cited line. 113 rows failed that strict test. Widening to a window of 6 lines either side and the longest literal piece of the command (to allow `...` abbreviations and multi-line statements) left 36 rows. Those 36 were read against the source: two citations were wrong and are fixed (plan 16 row 31, L20 to L30; plan 18 row 30, L26-28 to L99). The rest are test code split over lines, "implied" or duplicate rows that say so in their note (plan 14 row 45, plan 26 row 22, plan 23 rows 40 and 42), or commands whose `\|` escape defeats the search. Five rows in plan 33 with annotated line cells (rows 33, 34, 76, 77, 78) were checked by hand and are correct. 19 rows carry no backtick-quoted command and were not line-checked.
- **Not verified.** The class judgments themselves. Parts 10 and 13 and several others were written without re-grepping line numbers, which is why the mechanical check above was run.
- **Windows mentions.** The extractors' lists missed 153 matching lines (largest gaps: plan 28, 56; plan 27, 27; plan 19, 17; plan 00b, 15; plan 20, 13). A grep sweep added them verbatim under "Windows mentions added by grep sweep at assembly" in each affected plan. Some may duplicate a line the extractor cited by range or paraphrase.
- **Section order.** Plans appear in the order the extractors received them: `02` before `02b`, `14b` before `14`, `20b` before `20`, `27b` before `27`.

# Per-plan extraction

## README.md

Extracted commands: 13 (a=6, b=4, c=0, d=0, u=3)

| # | line | section | command | class | note |
|---|---|---|---|---|---|
| 1 | 73 | Ground rules, rule 8 | `quarto run --dev tools/check-runtime-boundary.ts --update-baseline` (also `--accept-tests-increase`, L74) | b | quarto -> package\dist\bin\quarto.cmd; plan assumes POSIX launcher name |
| 2 | 76 | Ground rules, rule 8 | `package/scripts/vendoring/update-lock.sh` (also L126) | u | bash script, no .cmd twin named; probably runs only under Git Bash; phase 2 should check it and the deno path it uses |
| 3 | 78 | Ground rules, rule 8 | `node tools/node-bundle/build.mjs --check-shim` | a | plain node script (needs Node installed; tool arrives with PR 26) |
| 4 | 79 | Ground rules, rule 8 | `run-unit-on-node.mjs` (path not given) | a | .mjs run by node, cross-platform by itself |
| 5 | 174 | Decisions and conventions | `$(find unit/ral -name '*.test.ts')` | b | bash command substitution + GNU find; fine in Git Bash; under PowerShell `find` is find.exe, use `Get-ChildItem -Recurse -Filter *.test.ts` |
| 6 | 185 | Roles (also 338) | `gh pr create`, `git push`, `gh workflow run`, `gh label create` | a | gh/git are cross-platform; maintainer-only actions, not run by the executor |
| 7 | 326 | How to execute a plan | `git checkout main && git pull` | a | `&&` works in Git Bash and PowerShell 7 |
| 8 | 327 | How to execute a plan | `git worktree add ../<branch-named-in-the-plan> -b <branch-named-in-the-plan>` | a | git cross-platform |
| 9 | 329 | How to execute a plan | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent <test files named in the plan>` | b | `VAR=x cmd` is bash-only; Git Bash needs DENO_DIR=x86_64, or PowerShell `$env:QUARTO_TESTS_NO_CONFIG='true'; ./run-tests.ps1 --agent ...`; bash assumed |
| 10 | 375 | The sequence, Phase 0, PR 07 row | `rg 'deno\.land\|skypack'` (in a table cell; `\|` is the markdown escape, so the real pattern is `deno\.land|skypack`) | a | rg works the same on Windows; single-quoted pattern ok in Git Bash and PowerShell |
| 11 | 397 | The sequence, Phase 1, PR 20 row | `tools/parsehtml-gate.sh` | u | .sh gate script, "three OSes"; Windows run unclear; check for ps1/Git Bash handling |
| 12 | 418 | The sequence, Phase 2, PR 31 row | `run-tests-node.sh` | u | bash wrapper; Windows equivalent not named here |
| 13 | 425 | The sequence, Phase 3, PR 33 row | `quarto install deno` | b | quarto -> quarto.cmd |

### Windows mentions

- L192 (Roles, table row "Manual verification on a machine the executor lacks"): "Windows (PRs 00b, 05, 06, 08, 14b, 28), macOS 12 and Apple Silicon (PR 34), a Posit Connect server (PR 04), a browser (PR 16), Shiny with a second host (PR 15), a corporate CA (PR 34). The result is pasted in the PR description; CI on that OS is the evidence when nobody can run it by hand"
- L255 (Shared rules and tables): "`spawn` inherits and `exec` pipes; `.bat`/`.cmd` through `cmd.exe /e:ON /v:OFF /d /c` with `batchCommandLine()`, Rust std's escaping; `128 + n` for a signal exit; Web Streams on the child): PR 28, Interfaces"
- L296-298 (Shared rules and tables): "The Windows coverage table (which POSIX process and preview assertions have a Windows equivalent, through which mechanism, and which have none): PR 14b, Context, "Windows coverage" (PRs 28 and 34 refer to it)."
- L348 (How to execute a plan): "a manual Windows or macOS step the executor cannot do is done by Chris (see "Roles")"
- L382 (Sequence, PR 08 row): "`killProcess` (group on POSIX, `taskkill /T` tree on Windows)"
- L391 (Sequence, PR 14b row): "process-group kill (POSIX) and `taskkill /T` tree kill (Windows)"
- L412 (Sequence, PR 28 row): "BatBadBut-safe batch quoting; draining `exit`; `taskkill /T`"
- L419 (Sequence, PR 32 row): "Bucketed Node matrix (Linux, Windows per PR; macOS nightly) required"


## _TEMPLATE.md

Extracted commands: 16 (a=5, b=9, c=1, d=0, u=1)

| # | line | section | command | class | note |
|---|---|---|---|---|---|
| 1 | 56 | Structure of a plan, Verification (inside template code block) | `quarto run --dev tools/check-runtime-boundary.ts` | b | quarto -> quarto.cmd |
| 2 | 57 | Structure of a plan, Verification | `package/dist/bin/quarto render <doc>` | b | package\dist\bin\quarto.cmd; no extensionless launcher on Windows |
| 3 | 49 | Structure of a plan, Task step 5 | `git add ...; git commit -m "..."` | a | `;` separator works in bash and PowerShell; git cross-platform |
| 4 | 93 | Repository conventions | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/<file>.test.ts` | b | VAR=x cmd bash-only; Git Bash with DENO_DIR=x86_64 or run-tests.ps1; bash assumed |
| 5 | 102 | Repository conventions | `package/dist/bin/tools/x86_64/deno` | b | Windows path `tools\x86_64\deno.exe` (the template says so at L103) |
| 6 | 108 | Repository conventions | `./configure.sh`, then `package/dist/bin/quarto ...` | b | configure.sh -> configure.cmd; quarto -> quarto.cmd |
| 7 | 109 | Repository conventions | `quarto run --dev <script.ts>` | b | quarto -> quarto.cmd |
| 8 | 121 | Tooling table, boundary ratchet | `quarto run --dev tools/check-runtime-boundary.ts` (and `--update-baseline`) | b | quarto -> quarto.cmd |
| 9 | 122 | Tooling table, codemod | `quarto run --dev tools/codemod-deno-ral.ts --rules fs,temp --dir src/core` (`--dry-run`, `--reverse`) | b | quarto -> quarto.cmd; PowerShell may need `--rules` comma value quoted (`"fs,temp"`) since comma is an array operator |
| 10 | 123 | Tooling table, TS syntax check | `node tools/node-bundle/check-ts-syntax.mjs [dir...]` | a | node script |
| 11 | 124 | Tooling table, Node bundle | `node tools/node-bundle/build.mjs [--entry src/quarto.ts] [--out tools/node-bundle/dist/quarto.mjs] [--check-shim] && tools/node-bundle/quarto-node render <doc>` | c | `tools/node-bundle/quarto-node` is extensionless shell launcher; likely no Windows form (phase 2 verify) |
| 12 | 124 | Tooling table, Node bundle | `node tools/node-bundle/check-deps.mjs [--write]` | a | node script |
| 13 | 124 | Tooling table, Node bundle | `node tools/node-bundle/normalize-html.mjs <dir>` | a | node script |
| 14 | 126 | Tooling table, Node test loader | `node --import tools/node-bundle/register-import-map.mjs --test --test-force-exit <files>` (or `vitest run`; also `tests/run-tests-node.sh`, named at L126) | u | node/vitest cross-platform, but `<files>` glob/forward-slash handling and the .sh wrapper unverified |
| 15 | 127 | Tooling table, Bundle freshness | `node tools/node-bundle/ensure.mjs --entry <file.ts> --outfile <file.js> [--watch-dir <dir>]...` | a | node script |
| 16 | 386 | Shared vocabulary (end) | `$(find unit/ral -name '*.test.ts')` (run-tests.sh files only) | b | same as README row 5 |

### Windows mentions

- L103: "Commands in the plans write the Linux path `package/dist/bin/tools/x86_64/deno`; on Apple Silicon it is `tools/aarch64/deno`, on Windows `tools\x86_64\deno.exe`."
- L187 (fs.ts vocabulary): "Deno.realPathSync, which already strips the Windows `\\?\` prefix; PR 27: fs.realpathSync.native"
- L230 (process.ts vocabulary): "`detached: true` makes the child a process-group leader (POSIX: `setsid`/`detached`; Windows: CREATE_NEW_PROCESS_GROUP) so `killProcess(-pid)` reaches its children."
- L255 (process.ts vocabulary): "a negative pid addresses a process group on POSIX and the process tree rooted at -pid on Windows (`taskkill /PID <-pid> /T /F`, ESRCH when gone; PR 08, kept by PR 28)"
- L310 (platform.ts vocabulary): `export const isWindows: boolean;` (type declaration only)

## SPIKES.md

Plan shell assumption: every bash block is POSIX bash (arrays, `$!`, `kill`, `/tmp`, `/usr/bin/time`, `VAR=x cmd`). On Windows these only work under Git Bash, and `/tmp/...` passed to node.exe/deno.exe is read as `C:\tmp\...` (Git Bash `/tmp` is %TEMP%), so every `/tmp` row is class b at best. (Least certain point of this slice: MSYS rewrites plain `/tmp/x` arguments to native programs but may not rewrite env values or `--opt=/tmp/x` forms; the /tmp notes here and in 00b and 01 are hedged accordingly, phase 2 should test one.)

Extracted commands: 68 (a=15, b=31, c=18, d=0, u=4)

| # | line | section | command | class | note |
|---|---|---|---|---|---|
| 1 | 59 | Spike #2, 2.0 Step 1 | `git checkout main && git pull && git checkout -b spike/2-dual-runtime` | a | git cross-platform |
| 2 | 60 | Spike #2, 2.0 Step 1 | `export DENO="$PWD/package/dist/bin/tools/$(uname -m \| sed 's/arm64/aarch64/')/deno"` | b | bash only; append `.exe` (tools/x86_64/deno.exe); uname -m gives x86_64 under Git Bash |
| 3 | 61 | Spike #2, 2.0 Step 1 | `"$DENO" --version \| head -1` | b | deno.exe; Git Bash |
| 4 | 62 | Spike #2, 2.0 Step 1 | `node --version` | a | node cross-platform |
| 5 | 63 | Spike #2, 2.0 Step 1 | `npm ci` | b | npm -> npm.cmd under Git Bash |
| 6 | 64 | Spike #2, 2.0 Step 1 | `mkdir -p dev-docs/runtime-migration/spike/spike2` | a | works in Git Bash; PowerShell has no `-p` (use `New-Item -ItemType Directory -Force`) |
| 7 | 92 | Spike #2, 2.0 Step 2, workflow YAML | `run: npm ci` | a | runs on GitHub-hosted windows-latest with `shell: bash` set for the next step |
| 8 | 97-99 | Spike #2, 2.0 Step 2, workflow YAML | `for s in http-ws.mjs watch.mjs child.mjs; do ... node "$s" ...; ... deno run --allow-all --no-config "$s" ...; done` | a | CI step with `shell: bash` (Git Bash on windows-latest); designed for 3 OSes; local Windows run needs Git Bash |
| 9 | 103 | Spike #2, 2.0 Step 2 | `gh workflow run spike2.yml --ref spike/2-dual-runtime && gh run watch` | a | gh cross-platform; maintainer-only action (push to quarto-dev/quarto-cli) |
| 10 | 112 | Spike #2, 2.1 Step 1 | `node tools/node-bundle/build.mjs --check-shim` | a | node script |
| 11 | 113 | Spike #2, 2.1 Step 1 | `ls -la tools/node-bundle/dist/quarto.mjs` | a | Git Bash; PowerShell `ls -la` fails |
| 12 | 121 | Spike #2, 2.1 Step 2 | `rm -rf /tmp/spike2 && mkdir -p /tmp/spike2` | b | Git Bash ok; /tmp = %TEMP% only for MSYS tools, node/deno see C:\tmp |
| 13 | 122 | Spike #2, 2.1 Step 2 | `for rt in deno-src deno-bundle node-bundle; do cp -r dev-docs/runtime-migration/spike/tests "/tmp/spike2/$rt"; done` | b | bash loop; /tmp mismatch with node.exe |
| 14 | 123 | Spike #2, 2.1 Step 2 | `export QUARTO_BIN_PATH="$PWD/package/dist/bin" QUARTO_SHARE_PATH="$PWD/src/resources" QUARTO_DEBUG=false` | u | $PWD is a /c/Users/... MSYS path; unsure MSYS converts env values for native node/deno; may need `cygpath -m` |
| 15 | 125 | Spike #2, 2.1 Step 2 | `DENO_BUNDLE=("$DENO" run --allow-all --no-config --unstable-kv --v8-flags=--enable-experimental-regexp-engine,--max-old-space-size=8192 tools/node-bundle/dist/quarto.mjs)` | b | bash array; deno.exe; no direct PowerShell form (needs rewrite as array/splat) |
| 16 | 126 | Spike #2, 2.1 Step 2 | `"${DENO_BUNDLE[@]}" --version` | b | bash array expansion |
| 17 | 128 | Spike #2, 2.1 Step 2 | `package/dist/bin/quarto render "/tmp/spike2/deno-src/$doc"` | b | quarto -> quarto.cmd; /tmp path |
| 18 | 129 | Spike #2, 2.1 Step 2 | `"${DENO_BUNDLE[@]}" render "/tmp/spike2/deno-bundle/$doc"` | b | bash array; /tmp path |
| 19 | 130 | Spike #2, 2.1 Step 2 | `tools/node-bundle/quarto-node render "/tmp/spike2/node-bundle/$doc"` | c | `quarto-node` is an extensionless launcher (PR 26 creates it); Windows form unknown |
| 20 | 132-134 | Spike #2, 2.1 Step 2 | `node tools/node-bundle/normalize-html.mjs --root /tmp/spike2/deno-src /tmp/spike2/deno-src` (and deno-bundle, node-bundle; 3 lines) | b | node script; /tmp path. Note: `--root` flag differs from the `<dir>`-only usage in _TEMPLATE.md L124 |
| 21 | 135-136 | Spike #2, 2.1 Step 2 | `diff -r -x .quarto /tmp/spike2/deno-src /tmp/spike2/deno-bundle && echo "DENO BUNDLE IDENTICAL"` (and node-bundle line) | b | GNU diff in Git Bash; PowerShell `diff` is Compare-Object |
| 22 | 144 | Spike #2, 2.1 Step 3 | `"${DENO_BUNDLE[@]}" check 2>&1 \| tail -20` | b | bash array; Git Bash tail |
| 23 | 145 | Spike #2, 2.1 Step 3 | `"${DENO_BUNDLE[@]}" preview /tmp/spike2/deno-bundle/simple.qmd --no-browser --port 4411 > /tmp/spike2/preview.log 2>&1 &` | c | background `&` of a long-lived app from Git Bash; /tmp mismatch; PowerShell needs Start-Process |
| 24 | 146 | Spike #2, 2.1 Step 3 | `PREVIEW=$!; sleep 15` | c | `$!` is the MSYS pid, not necessarily the Windows process |
| 25 | 147 | Spike #2, 2.1 Step 3 | `node dev-docs/runtime-migration/spike/tests/ws-client.mjs 4411 /; echo "ws exit=$?"` | c | the bare `/` argument is rewritten by Git Bash to `C:/Program Files/Git/`; needs MSYS_NO_PATHCONV=1; `$?` bash-only |
| 26 | 148 | Spike #2, 2.1 Step 3 | `kill $PREVIEW` | c | bash kill of a native Windows child may not stop it; needs `taskkill /PID <winpid> /T /F` from PowerShell |
| 27 | 149 | Spike #2, 2.1 Step 3 | `"${DENO_BUNDLE[@]}" inspect /tmp/spike2/deno-bundle/website \| head -c 200; echo` | b | bash array; /tmp path |
| 28 | 150 | Spike #2, 2.1 Step 3 | `/usr/bin/time -p "${DENO_BUNDLE[@]}" --version` | c | GNU `/usr/bin/time` likely not shipped with Git for Windows; use bash `time` or PowerShell `Measure-Command` |
| 29 | 151 | Spike #2, 2.1 Step 3 | `/usr/bin/time -p package/dist/bin/quarto --version` | c | same, plus quarto -> quarto.cmd |
| 30 | 217-220 | Spike #2, 2.2 Step 2 | `cd dev-docs/runtime-migration/spike/spike2`; `node http-ws.mjs`; `"$DENO" run --allow-all --no-config http-ws.mjs`; `cd -` | b | node line is a; `$DENO` -> deno.exe; `cd -` is bash only (PowerShell 7 has it too) |
| 31 | 282-285 | Spike #2, 2.3 Step 2 | `cd .../spike2`; `node watch.mjs`; `"$DENO" run --allow-all --no-config watch.mjs`; `cd -` | b | same as row 30; watch behaviour on Windows is the spike's question |
| 32 | 338-341 | Spike #2, 2.4 Step 2 | `cd .../spike2`; `node child.mjs`; `"$DENO" run --allow-all --no-config child.mjs`; `cd -` | b | same as row 30; script itself has a win32 branch (spawns cmd.exe, taskkill) |
| 33 | 351 | Spike #2, 2.5 Step 1 | `grep -n "Deno.permissions\|Deno?.permissions" tools/node-bundle/dist/quarto.mjs \| head` | a | Git Bash GNU grep; plan says this step is Linux or macOS but the grep itself runs |
| 34 | 352 | Spike #2, 2.5 Step 1 | `grep -rn "files: true\|suggestions:" src --include=*.ts \| grep -v "core/lib/yaml-validation" \| head` | a | Git Bash GNU grep |
| 35 | 372 | Spike #2, 2.5 Step 2 | `node tools/node-bundle/build.mjs --entry dev-docs/runtime-migration/spike/spike2/prompt.mjs --out /tmp/spike2/prompt.mjs` | b | /tmp path |
| 36 | 374 | Spike #2, 2.5 Step 2 | `printf '\033[B\ry\r' \| script -q -c "node /tmp/spike2/prompt.mjs" /dev/null \| tail -2` | c | util-linux `script` pty; plan itself restricts to Linux/macOS (L346); no Windows equivalent |
| 37 | 376 | Spike #2, 2.5 Step 2 | `( sleep 1; printf '\003' ) \| script -q -c "node /tmp/spike2/prompt.mjs; echo EXIT=\$?; stty -a \| grep -o '\-icanon\|icanon'" /dev/null \| tail -3` | c | `script`, `stty` pty/termios, Linux/macOS only |
| 38 | 379 | Spike #2, 2.5 Step 2 | `script -q /dev/null node /tmp/spike2/prompt.mjs` (macOS variant) | c | macOS-only |
| 39 | 381 | Spike #2, 2.5 Step 2 | `"$DENO" run --allow-all --no-config /tmp/spike2/prompt.mjs` | c | needs the same pty harness, Linux/macOS only |
| 40 | 417 | Spike #2, 2.6 Step 2 | `node dev-docs/runtime-migration/spike/spike2/proxy.mjs 8899 > /tmp/spike2/proxy.log 2>&1 &` | c | background `&` from Git Bash, /tmp mismatch |
| 41 | 418 | Spike #2, 2.6 Step 2 | `PROXY=$!; sleep 1` | c | `$!` MSYS pid |
| 42 | 419 | Spike #2, 2.6 Step 2 | `export HTTPS_PROXY=http://127.0.0.1:8899 HTTP_PROXY=http://127.0.0.1:8899` | b | bash export; PowerShell `$env:HTTPS_PROXY=...` |
| 43 | 420 | Spike #2, 2.6 Step 2 | `node -e 'const r = await fetch("https://quarto.org/docs/download/_download.json"); console.log("no flag", r.status)'` | a | works in Git Bash; in PowerShell the embedded double quotes need care |
| 44 | 421 | Spike #2, 2.6 Step 2 | `node --use-env-proxy -e '...fetch(...)...console.log("flag", r.status)'` | a | same as row 43 (Node 26 flag) |
| 45 | 422 | Spike #2, 2.6 Step 2 | `NO_PROXY=quarto.org node --use-env-proxy -e '...console.log("no_proxy", r.status)'` | b | `VAR=x cmd` bash-only; PowerShell `$env:NO_PROXY=...` first |
| 46 | 423-424 | Spike #2, 2.6 Step 2 | `QUARTO_BIN_PATH="$PWD/package/dist/bin" QUARTO_SHARE_PATH="$PWD/src/resources" node --use-env-proxy --enable-experimental-regexp-engine tools/node-bundle/dist/quarto.mjs tools 2>&1 \| tail -5` | u | bash inline env + `$PWD` MSYS path as in row 14; `quarto tools` network lookups |
| 47 | 425 | Spike #2, 2.6 Step 2 | `"$DENO" eval 'const r = await fetch("https://quarto.org/docs/download/_download.json"); console.log("deno", r.status)'` | b | deno.exe |
| 48 | 426 | Spike #2, 2.6 Step 2 | `kill $PROXY; unset HTTPS_PROXY HTTP_PROXY` | c | bash kill of native child; `unset` bash only |
| 49 | 427 | Spike #2, 2.6 Step 2 | `cat /tmp/spike2/proxy.log` | b | Git Bash only; /tmp (MSYS side) vs node's C:\tmp mismatch |
| 50 | 430 | Spike #2, 2.6 Step 2 (prose) | `NODE_USE_ENV_PROXY=1` instead of the flag | b | bash inline env var |
| 51 | 500 | Spike V, Step 1 | `git checkout main && git pull && git checkout -b spike/v-test-runner` | a | git |
| 52 | 501 | Spike V, Step 1 | `npm install --save-dev vitest@3` | b | npm.cmd under Git Bash |
| 53 | 509-510 | Spike V, Step 2 | `cd tests`; `FILES="unit/path.test.ts unit/text.test.ts ... smoke/project/project-website.test.ts"` | a | bash variable; Git Bash |
| 54 | 511 | Spike V, Step 2 | `QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent $FILES` | b | `VAR=x cmd` bash-only; Git Bash with DENO_DIR=x86_64 or run-tests.ps1 |
| 55 | 512-513 | Spike V, Step 2 | `node --import ../tools/node-bundle/register-import-map.mjs --test --test-concurrency=1 --test-force-exit --test-timeout=600000 --test-reporter=dot --test-reporter=junit --test-reporter-destination=stdout --test-reporter-destination=/tmp/v-node.xml $FILES` | b | `/tmp/v-node.xml` read by node.exe as C:\tmp (dir may not exist); unquoted `$FILES` word-splitting is bash |
| 56 | 514 | Spike V, Step 2 | `npx vitest run --config vitest.config.mjs --reporter=dot --reporter=junit --outputFile.junit=/tmp/v-vitest.xml $FILES` | b | npx -> npx.cmd; /tmp path; bash `$FILES` |
| 57 | 515 | Spike V, Step 2 | `QUARTO_TEST_ARGS=docs/smoke-all/2023/02/08/4272.qmd node --import ../tools/node-bundle/register-import-map.mjs --test smoke/smoke-all.test.ts` | b | `VAR=x cmd` bash-only |
| 58 | 516 | Spike V, Step 2 | `QUARTO_TEST_ARGS=docs/smoke-all/2023/02/08/4272.qmd npx vitest run --config vitest.config.mjs smoke/smoke-all.test.ts` | b | `VAR=x cmd`; npx.cmd |
| 59 | 517 | Spike V, Step 2 | `cd ..` | a | |
| 60 | 518-519 | Spike V, Step 2 | `node tools/node-bundle/junit.mjs summary /tmp/v-node.xml`; `... /tmp/v-vitest.xml` | b | node script; /tmp path |
| 61 | 522 | Spike V, Step 2 (prose) | `npx playwright install chromium` | b | npx.cmd; interactive prompts: run from PowerShell |
| 62 | 527-532 | Spike V, Step 3 | `cd tests`; `for i in 1 2 3; do ... done` | b | bash loop |
| 63 | 529 | Spike V, Step 3 | `/usr/bin/time -f "node:test %e s" node --import ../tools/node-bundle/register-import-map.mjs --test --test-concurrency=1 --test-force-exit --test-reporter=dot $FILES 2>&1 \| tail -1` | c | GNU `/usr/bin/time -f` likely absent on Git Bash; use bash `time`/Measure-Command |
| 64 | 530 | Spike V, Step 3 | `/usr/bin/time -f "vitest %e s" npx vitest run --config vitest.config.mjs --reporter=dot $FILES 2>&1 \| tail -1` | c | same |
| 65 | 531 | Spike V, Step 3 | `/usr/bin/time -f "deno %e s" ./run-tests.sh --agent $FILES 2>&1 \| tail -1` | c | same; plus run-tests.sh needs DENO_DIR |
| 66 | 534-537 | Spike V, Step 3 | four `/usr/bin/time -f "... startup/render-html.test.ts %e s" node --import ... --test <file> > /dev/null` and `npx vitest run ... <file> > /dev/null` lines | c | same `/usr/bin/time -f` problem |
| 67 | 549-557 | Spike V, Step 4 feature table | `--test-reporter=junit` / `--reporter=junit --outputFile.junit=`; `node --test --watch unit/path.test.ts`; `npx vitest unit/path.test.ts`; `--test-timeout` / `testTimeout`; `--test-concurrency=1`; `tests/run-parallel-tests.mjs --dry-run`; `run-tests-node.sh`; `npm ls vitest` | u | table of per-feature commands; node/npx commands as above; `run-tests-node.sh` (PR 31, bash) has a `.ps1` sibling only mentioned at L573; `GITHUB_ACTIONS=true` env |
| 68 | 573-574 | Spike V, "What each outcome changes" | `run-tests-node.sh`/`.ps1`; `npx vitest run --config tests/vitest.config.mjs` | u | PR 32 runner commands; `.ps1` existence unverified (only a mention) |

### Windows mentions

- L32 (Ground rules): "- "Linux", "macOS", "Windows" means: run it there. A machine you do not have is covered by the dispatch workflow in step 2.0, which runs the same scripts on the three GitHub-hosted runners."
- L47 (Spike #2 Goal, question d): "does Deno's `child_process` honour `windowsVerbatimArguments`; does it refuse `.bat`/`.cmd` without a shell as Node does?"
- L81 (2.0 Step 2 workflow): `os: [ubuntu-latest, macos-latest, windows-latest]`
- L290 (2.4 heading): "#### 2.4 (d) Process groups, `windowsVerbatimArguments`, `.bat` spawning (one day, three OSes)"
- L297: "// Spike 2 (d): detached process groups and Windows batch-file spawning."
- L308: `if (process.platform !== "win32") {`
- L317-318: windowsVerbatimArguments probe, `spawnSync(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", '"echo "a b" ^& echo two"'], { windowsVerbatimArguments: true, ...})`
- L326-330: "// Tree kill: taskkill /T on a cmd that starts a ping grandchild." ... `spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], ...)`; "`taskkill /T status=...`"
- L344: "Expected on Windows, Node: `verbatim stdout=...`, `direct .bat error=EINVAL`, `taskkill /T status=0`. The Deno lines are the answers: whether `windowsVerbatimArguments` is honoured ... and whether Deno spawns the `.bat` directly ..."
- L438 (Exit criteria, (a)): "Steps 2.1.2 and 2.1.3 pass on Linux and on one of macOS/Windows"
- L441 (Exit criteria, (d)): "on Windows the Deno `verbatim` line equal to Node's, or the direct-`.bat` behaviour recorded"
- L457 (outcomes table, (d)): "falls back to `taskkill`-style tree walk via `ps -o pid= --ppid` (POSIX)"
- L458 (outcomes table, (d)): "Deno ignores `windowsVerbatimArguments` | PR 28's `.bat`/`.cmd` path spawns the file directly on Deno ... (`kBatchViaCmd = runtime().name === "node"`)"
- L573 (Spike V outcomes table): "runner commands `run-tests-node.sh`/`.ps1`"

## 00-assessment.md

Mostly prose and decision record; no step list. Rows below are the only places an executor is told, or the text implies, to run something.

Extracted commands: 8 (a=2, b=4, c=0, d=0, u=2)

| # | line | section | command | class | note |
|---|---|---|---|---|---|
| 1 | 97 | 3.4 Dependencies | `npx jsr add` (JSR packages onto Node) | b | npx -> npx.cmd under Git Bash; prose suggestion, no exact invocation |
| 2 | 112 | 3.5 TypeScript, lint, format | `tsc --noEmit` with `@types/node` | a | node tool, cross-platform; run via npx.cmd/Git Bash if not on PATH (u whether installed) |
| 3 | 198 | 6 Impact, Core team | `node --strip-types` or `tsx` instead of `deno run --check` | a | Node flag / npm tool; prose |
| 4 | 240 | 7 Plan, Phase 3 step 1 | launchers start `node bin/quarto.js` with the same V8 flags; `configure.sh` installs Node | b | description of PR 33 behaviour, not a command to run now; configure.sh -> configure.cmd |
| 5 | 299 | 10 Spike results, Setup | `configure.sh` (could not run in the sandbox) | b | configure.sh -> configure.cmd |
| 6 | 398 | 11 Order of work, step 1 | script counting `\bDeno\.` outside `src/deno_ral/` and direct std imports (grep) | u | idea only; implemented as `tools/check-runtime-boundary.ts` by PR 02 |
| 7 | 400 | 11 Order of work, step 3 | `ts-morph` script "run with `quarto run --dev`" | b | quarto -> quarto.cmd |
| 8 | 344 | 11 Three facts | `deno run bin/quarto.js` (launchers) and `tools/deno-esbuild-bundle.ts` | u | description of existing behaviour; launcher is `quarto.cmd` on Windows |

### Windows mentions

- L91 (3.3, table row Monkey patches): "`realPathSync` on Windows UNC paths, temp-file retry, `Deno.copy` shim for old deps"
- L117 (3.6): "launcher scripts (`package/scripts/common/quarto`, `quarto.cmd`, plus a small Rust launcher for `quarto.exe` on Windows)"
- L151 (5, Option B): "Windows support is younger than Node's."
- L240 (7, Phase 3 step 1): "Launchers (`quarto`, `quarto.cmd`, Rust `quarto.exe`) start `node bin/quarto.js` with the same V8 flags"
- L241 (7, Phase 3 step 2): "CI runs the full matrix (Linux, macOS, Windows, x64, arm64) on Node"
- L275 (8 Risks): "Process-spawning differences (stdin chunking, signal handling, Windows quoting) surface as flaky tests"
- L276 (8 Risks): "Windows path edge cases (UNC, long paths) differ between runtimes"
- L330 (10, Not exercised): "Windows and macOS, knitr and R, LaTeX PDF through TinyTeX, ..." (the spike never ran on Windows)
- L334 (10, What the spike changes): "the untested areas (test harness, build tooling, installers, Windows) are where the remaining work is"
- L378 (11 Module plan, fs.ts): "The `realPathSync` Windows monkey patch and the read-error path annotation move here."


## 00a-deno-bump.md

Extracted commands: 25 (a=10, b=15, c=0, d=0, u=0)

| # | line | section | command | class | note |
|---|---|---|---|---|---|
| 1 | 23 | Spec, Context | `rg -n '2\.7\.14\|DENO=v'` (the `\|` is only the table-cell escape of `\|`; the file text is `rg -n '2\.7\.14|DENO=v'`) | a | rg works the same on Windows; single-quoted regex fine in Git Bash and PowerShell |
| 2 | 61 | Acceptance criteria | `package/dist/bin/tools/x86_64/deno --version` | b | plan itself says `deno.exe` on Windows |
| 3 | 62 | Acceptance criteria | `package/dist/bin/quarto check versions` | b | quarto -> quarto.cmd |
| 4 | 63 | Acceptance criteria | `git status --short` after `./configure.sh` | b | configure.sh -> configure.cmd |
| 5 | 74 | Task 1 Step 1 | `gh release list --repo denoland/deno --limit 20 \| grep -E '^v2\.9\.' \| head -1` | b | needs grep/head: Git Bash only (PowerShell: `Select-String`/`Select-Object -First 1`) |
| 6 | 81-85 | Task 1 Step 2 | `V=v2.9.7; for f in deno-x86_64-unknown-linux-gnu.zip ... deno-x86_64-pc-windows-msvc.zip; do printf '%s ' "$f"; curl -sIL -o /dev/null -w '%{http_code}\n' "https://github.com/denoland/deno/releases/download/$V/$f"; done` | a | bash loop; works in Git Bash (curl.exe, MSYS maps /dev/null); not in PowerShell (curl alias) |
| 7 | 110 | Task 2 Step 1 | `./configure.sh` (Windows: `.\configure.cmd`) | b | the plan itself names the Windows form |
| 8 | 115 | Task 2 Step 2 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/check/check-versions-no-mismatch.test.ts` | b | `VAR=x cmd` bash-only; Git Bash with DENO_DIR=x86_64 or run-tests.ps1 |
| 9 | 131 | Task 2 Step 4 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/check/check-versions-no-mismatch.test.ts smoke/check/check.test.ts` | b | same as row 8 |
| 10 | 136 | Task 2 Step 5 | `git status --short` | a | |
| 11 | 137 | Task 2 Step 5 | `git diff src/resources/deno_std/deno_std.lock`; `git checkout -- src/resources/deno_std/deno_std.lock` | a | git; the checkout is a destructive revert step for the executor |
| 12 | 142-143 | Task 2 Step 6 | `git add configuration src/command/check/check.ts` / `git commit -m "Update Deno to v2.9.7 ..."` (multi-line message) | a | git; multi-line `-m` in double quotes is bash-style; PowerShell/Windows rule says use `-F file` |
| 13 | 159 | Task 3 Step 1 | `grep -c 'h6046fbb_0' .github/workflows/create-release.yml` | a | Git Bash grep; PowerShell lacks grep |
| 14 | 176-177 | Task 3 Step 3 | `git add .github/workflows/create-release.yml dev-docs/upgrade-dependencies.md` / `git commit -m "Point the RHEL Deno download at the 2.9.7 conda-forge build; refresh upgrade doc"` | a | git |
| 15 | 189 | Task 4 Step 1 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent $(find unit -name '*.test.ts')` | b | bash `$(...)` + GNU find (PowerShell `find` is find.exe); VAR=x cmd |
| 16 | 190-192 | Task 4 Step 1 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent $(find smoke/render ...) $(find smoke/site ...) ... $(find smoke/logging -name '*.test.ts')` (eleven `find` substitutions) | b | same as row 15; long Windows suite, OneDrive/path-length risk unverified |
| 17 | 200 | Task 4 Step 2 | `package/dist/bin/quarto run tests/docs/run/test-stdlib.ts; echo "exit=$?"` | b | quarto -> quarto.cmd; `$?` bash-only (PowerShell `$LASTEXITCODE`) |
| 18 | 201-202 | Task 4 Step 2 | `cd package/src && ./quarto-bld prepare-dist --set-version $(cat ../../version.txt) && cd ../pkg-working/bin && (mv ../../../src/quarto.ts ../../../src/quarto1.ts; ./quarto --version; ./quarto check; mv ../../../src/quarto1.ts ../../../src/quarto.ts)` | b | `./quarto-bld` -> `quarto-bld.cmd` (exists in package/src); `./quarto` -> `quarto.cmd`; subshell/`mv`/`$(cat ...)` bash-only |
| 19 | 214 | Task 5 Step 1 | `git push -u origin rt/00a-deno-bump && gh pr create --draft --fill && gh pr view --json number -q .number` | a | git/gh cross-platform; push/`gh pr create` are maintainer-only per README |
| 20 | 231-233 | Task 5 Step 3 | `git add news/changelog-1.11.md dev-docs/runtime-migration/README.md` / `git commit -m "Changelog: Deno 2.9.7"` / `git push` | a | git |
| 21 | 247 | Task 6 Step 2 | `gh workflow run create-release.yml --repo quarto-dev/quarto-cli --ref rt/00a-deno-bump -f publish-release=false` | a | gh cross-platform; maintainer-only; result checks `make-installer-win` |
| 22 | 252 | Verification | `package/dist/bin/quarto check versions` | b | quarto -> quarto.cmd |
| 23 | 253 | Verification | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/check/check-versions-no-mismatch.test.ts` | b | as row 8 |
| 24 | 254 | Verification | `quarto run tests/docs/run/test-stdlib.ts` | b | quarto -> quarto.cmd |
| 25 | 255 | Verification | `quarto run --dev tools/check-runtime-boundary.ts` | b | quarto -> quarto.cmd |

### Windows mentions

- L32 (Context table): "`package/scripts/common/utils.sh:4-27`, `configure.cmd:50` | `DENOURL`, `DENOFILES` per platform | no edit (same asset names)"
- L33 (Context table): "`package/scripts/common/quarto:76-89`, `package/scripts/windows/quarto.cmd:52-69` | compare `package/dist/config/deno-version` with `configuration` and re-run `configure` on mismatch | no edit; this is how developers pick up the bump"
- L61 (Acceptance criteria): "`package/dist/bin/tools/x86_64/deno --version` (Linux x64; `aarch64` on Apple Silicon, `deno.exe` on Windows) prints `deno 2.9.7`."
- L83 (Task 1 Step 2): asset name `deno-x86_64-pc-windows-msvc.zip`
- L110 (Task 2 Step 1): "Run: `./configure.sh` (Windows: `.\configure.cmd`)"
- L242 (Task 6 Step 1): "`Parallel Smokes Tests` (the full suite in buckets on Linux and Windows)"

## 00b-lockfile-and-bundle-gate.md

Shell assumption: bash blocks throughout (Git Bash on Windows would be needed); Windows-specific launchers and the three-OS CI gate are written in cmd/pwsh. PR 00b is one of the PRs the README lists for Windows manual verification, so class d is used for the steps that are the Windows leg of this PR (vendor.cmd, quarto.cmd, quarto-bld.cmd, the windows-latest Bundle Test leg, `configure.cmd`/`set QUARTO_DENO_LOCK_MODE=update`). Rows marked "edit-only" are file-content snippets the executor pastes into POSIX scripts, not commands run by hand; they do not run on Windows.

Extracted commands: 99 (a=27, b=41, c=8, d=14, u=9)

| # | line | section | command | class | note |
|---|---|---|---|---|---|
| 1 | 71 | Spec, Interfaces | `quarto run --dev tools/check-bundle-externals.ts <bundle.js>` | b | quarto -> quarto.cmd |
| 2 | 94 | Spec, Interfaces | `quarto run --dev tools/check-test-imports.ts [--root <dir>]` | b | quarto -> quarto.cmd; it spawns `deno info --json --no-config --no-lock --unstable-kv --unstable-ffi --importmap=src/import_map.json` via `architectureToolsPath("deno")` (resolves deno.exe itself) |
| 3 | 96 | Spec, Interfaces | `package/scripts/vendoring/update-lock.sh [--refresh]` | d | bash-only; the plan names the Windows path: `set QUARTO_DENO_LOCK_MODE=update` then `configure.cmd` (cmd syntax; PowerShell needs `$env:QUARTO_DENO_LOCK_MODE='update'`); `--refresh` has no Windows equivalent stated |
| 4 | 98 | Spec, Interfaces | `QUARTO_DENO_LOCK_MODE=update`; `QUARTO_DENO_LOCK_OPTIONS=--no-lock` (env vars) | b | `VAR=x cmd` bash-only on POSIX; cmd `set`/PowerShell `$env:` on Windows |
| 5 | 131 | Acceptance criteria | `git ls-files deno.lock` | a | git |
| 6 | 131 | Acceptance criteria | `./configure.sh` on a clean checkout leaves `git status --short` empty | b | configure.sh -> configure.cmd |
| 7 | 132 | Acceptance criteria | `./configure.sh` (expects `The lockfile is out of date`) then `package/scripts/vendoring/update-lock.sh` | d | Windows leg: configure.cmd + `set QUARTO_DENO_LOCK_MODE=update` (see row 3) |
| 8 | 133 | Acceptance criteria | `package/dist/bin/quarto check` | b | quarto -> quarto.cmd |
| 9 | 133 | Acceptance criteria | `quarto run --dev tools/check-runtime-boundary.ts` | b | quarto -> quarto.cmd |
| 10 | 134 | Acceptance criteria | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/tools/check-bundle-externals.test.ts unit/tools/check-test-imports.test.ts` | b | `VAR=x cmd` bash-only; Git Bash with DENO_DIR=x86_64 or run-tests.ps1 |
| 11 | 135 | Acceptance criteria | `quarto run --dev tools/check-test-imports.ts` | b | quarto -> quarto.cmd |
| 12 | 136 | Acceptance criteria | `Bundle Test` green on ubuntu-latest, macos-latest, windows-latest | d | Windows leg is the manual-verification evidence for PR 00b (CI on windows-latest) |
| 13 | 137 | Acceptance criteria | `rg -n 'deno\.land' tools/deno-esbuild-bundle.ts` | a | rg cross-platform |
| 14 | 149 | Task 1 Step 1 | `D=package/dist/bin/tools/$(uname -m \| sed 's/arm64/aarch64/')/deno` | b | bash; deno.exe |
| 15 | 150 | Task 1 Step 1 | `export DENO_DIR=$(mktemp -d)` | u | Git Bash mktemp gives an MSYS /tmp path; deno.exe reads it as C:\tmp\... |
| 16 | 151-153 | Task 1 Step 1 | `for e in quarto.ts vendor_deps.ts ../tests/test-deps.ts ../package/scripts/deno_std/deno_std.ts ../package/src/bld.ts ../tools/deno-esbuild-bundle.ts; do (cd src && "$D" install --allow-all --no-config --no-lock --importmap="$PWD/import_map.json" --entrypoint "$e" > /dev/null 2>&1; echo "$e exit=$?"); done` | u | bash loop/subshell; `$PWD` is an MSYS path (/c/...) embedded in an `--importmap=` value that deno.exe reads, MSYS arg conversion may not rewrite `--opt=/path` forms reliably |
| 17 | 154 | Task 1 Step 1 | `rm -rf "$DENO_DIR"; unset DENO_DIR` | b | Git Bash; destructive on a temp dir the step created |
| 18 | 156 | Task 1 Step 1 (prose) | `grep -rn jszip src package/src tests --include=*.ts` | a | Git Bash GNU grep |
| 19 | 169 | Task 2 Step 1 | edit `.gitignore` (delete `deno.lock` lines), `deno.jsonc`, `package/src/common/deno-meta.json` | a | file edits only |
| 20 | 199-207 | Task 2 Step 2 | replacement body for `package/scripts/vendoring/vendor.sh` (`pushd "${QUARTO_SRC_PATH}"; ... $DENO_BIN_PATH install --allow-all --no-config --lock=... $QUARTO_DENO_FROZEN_FLAG --importmap=... --entrypoint quarto.ts vendor_deps.ts ../tests/test-deps.ts ../package/scripts/deno_std/deno_std.ts ../package/src/bld.ts ../tools/deno-esbuild-bundle.ts; popd`) | u | edit-only POSIX script; configure.cmd calls vendor.cmd instead (row 21) |
| 21 | 232-263 | Task 2 Step 3 | replacement body for `package/scripts/vendoring/vendor.cmd` (`CALL !DENO_BIN_PATH! install --allow-all --no-config --lock="!QUARTO_SRC_PATH!\..\deno.lock" !QUARTO_DENO_FROZEN_FLAG! --importmap=... --entrypoint quarto.ts vendor_deps.ts ..\tests\test-deps.ts ..\package\scripts\deno_std\deno_std.ts ..\package\src\bld.ts ..\tools\deno-esbuild-bundle.ts` with `IF ERRORLEVEL 1 ... EXIT /B 1`) | d | the Windows leg of PR 00b; note the new `--frozen` is also what Decision 2 insists on for Windows |
| 22 | 268 | Task 2 Step 4 | `chmod +x` on `package/scripts/vendoring/update-lock.sh` ("mode 755") | c | chmod is a no-op on NTFS; the exec bit must be set with `git update-index --chmod=+x` |
| 23 | 271-302 | Task 2 Step 4 | content of `update-lock.sh` (`#!/usr/bin/env bash`, `BASH_SOURCE`, `source .../configuration`, `source .../utils.sh`, `source .../set_package_paths.sh`, `rm -f "$QUARTO_ROOT/deno.lock"`, `export QUARTO_DENO_LOCK_MODE=update`, `source vendor.sh`) | c | bash-only script (comment at L282: "Windows: set QUARTO_DENO_LOCK_MODE=update, then run configure.cmd") |
| 24 | 308 | Task 2 Step 5 | `package/scripts/vendoring/update-lock.sh --refresh` | c | bash-only; Windows alternative is only "set QUARTO_DENO_LOCK_MODE=update; configure.cmd", which has no `--refresh` (delete deno.lock by hand) |
| 25 | 309 | Task 2 Step 5 | `git status --short deno.lock` | a | git |
| 26 | 310 | Task 2 Step 5 | `./configure.sh && git status --short` | b | configure.sh -> configure.cmd |
| 27 | 318 | Task 2 Step 6 | `sed -i.bak 's\|"zod": "npm:/zod@3.24.4"\|"zod": "npm:/zod@3.24.3"\|' src/import_map.json` | b | GNU sed `-i.bak` works in Git Bash; no PowerShell equivalent without rewriting |
| 28 | 319 | Task 2 Step 6 | `./configure.sh; echo "exit=$?"` | b | configure.cmd; `$?` bash-only (`%ERRORLEVEL%` / `$LASTEXITCODE`) |
| 29 | 320 | Task 2 Step 6 | `mv src/import_map.json.bak src/import_map.json` | a | Git Bash mv |
| 30 | 327-336 | Task 2 Step 7 | `git add .gitignore deno.jsonc package/src/common/deno-meta.json deno.lock package/scripts/vendoring/vendor.sh ... \` ; `git add src/vendor_deps.ts 2>/dev/null \|\| true` ; `git commit -m "..."` (multi-line message) | b | git is fine; `\` continuation, `2>/dev/null \|\| true` and multi-line `-m` are bash-only (write message to a file, `git commit -F`) |
| 31 | 347-362 | Task 3 Step 1 | POSIX launcher edits to `package/scripts/common/quarto` (`QUARTO_DENO_LOCK_OPTIONS="--lock=$QUARTO_ROOT/deno.lock --frozen"`, `QUARTO_DENO_LOCK_OPTIONS="--no-lock"`, replace `--no-lock` at line 186 with `${QUARTO_DENO_LOCK_OPTIONS}`) | u | edit-only; POSIX launcher does not run on Windows (Windows counterpart row 32) |
| 32 | 366-378 | Task 3 Step 2 | edits to `package/scripts/windows/quarto.cmd` (`IF NOT DEFINED QUARTO_DENO_LOCK_OPTIONS ( SET "QUARTO_DENO_LOCK_OPTIONS=--lock=""!QUARTO_ROOT!\deno.lock"" --frozen" )`, `SET "QUARTO_DENO_LOCK_OPTIONS=--no-lock"`, `SET "QUARTO_DENO_OPTIONS=--unstable-kv --unstable-ffi --no-config !QUARTO_DENO_LOCK_OPTIONS! --allow-all !QUARTO_DENO_OPTIONS!"`) | d | Windows leg of PR 00b; the only place the cmd quoting (`""!QUARTO_ROOT!\deno.lock""`) is exercised |
| 33 | 385-390 | Task 3 Step 3 | edit `package/src/quarto-bld` last line: `"$QUARTO_DENO" run --no-check --no-config "--lock=${SCRIPT_PATH}/../../deno.lock" $QUARTO_DENO_FROZEN_FLAG --unstable-kv --unstable-ffi --allow-all --v8-flags=--enable-experimental-regexp-engine,--stack-trace-limit=100 --importmap="${SCRIPT_PATH}/../../src/import_map.json" "$SCRIPT_PATH/bld.ts" $@` | u | edit-only POSIX script; Windows twin row 34 |
| 34 | 394-396 | Task 3 Step 3 | edit `package/src/quarto-bld.cmd` last line: `"%QUARTO_DENO%" run --no-check --no-config --lock=%~dp0\..\..\deno.lock %QUARTO_DENO_FROZEN_FLAG% --unstable-kv --unstable-ffi --allow-all --v8-flags=... --importmap=%~dp0\..\..\src\import_map.json %~dp0\bld.ts %*` | d | Windows leg of PR 00b; `%~dp0` ends in `\` so `%~dp0\..` yields a double backslash (unverified) |
| 35 | 401-419 | Task 3 Step 4 | edits to `package/src/util/deno.ts` (`denoBundleCmd.push("--no-config")`, `--lock=${join(configuration.directoryInfo.root, "deno.lock")}`, `--frozen`) and `tools/deno-esbuild-bundle.ts` (`lockPath = Deno.realPathSync("../deno.lock")`) | a | TypeScript; paths via `join`/`realPathSync`; cross-platform |
| 36 | 455 | Task 3 Step 5 | `package/dist/bin/quarto check` | b | quarto -> quarto.cmd |
| 37 | 456 | Task 3 Step 5 | `package/dist/bin/quarto render tests/docs/minimal.qmd --to html --output-dir /tmp/rt00b && rm -rf /tmp/rt00b` | b | quarto.cmd; `/tmp` here is MSYS-only (quarto.cmd/deno.exe read it as C:\tmp), use a Windows temp path |
| 38 | 457 | Task 3 Step 5 | `package/dist/bin/quarto run --dev tools/check-runtime-boundary.ts` | b | quarto -> quarto.cmd |
| 39 | 458 | Task 3 Step 5 | `cd package/src && ./quarto-bld prepare-dist --set-version $(cat ../../version.txt) && cd ../..` | b | `./quarto-bld` -> `quarto-bld.cmd` (exists); `$(cat ...)` bash-only (PowerShell `(Get-Content ..\..\version.txt)`, as the CI step at L1084 does) |
| 40 | 459 | Task 3 Step 5 | `git status --short` | a | git |
| 41 | 467 | Task 3 Step 6 | `sed -i.bak 's\|"zod": "npm:/zod@3.24.4"\|"zod": "npm:/zod@3.24.3"\|' src/import_map.json` | b | same as row 27 |
| 42 | 468 | Task 3 Step 6 | `package/dist/bin/quarto check; echo "exit=$?"` | b | quarto.cmd; `$?` bash-only |
| 43 | 469 | Task 3 Step 6 | `mv src/import_map.json.bak src/import_map.json` | a | Git Bash mv |
| 44 | 470 | Task 3 Step 6 | `QUARTO_DENO_LOCK_OPTIONS=--no-lock package/dist/bin/quarto check > /dev/null; echo "escape-hatch exit=$?"` | b | `VAR=x cmd` bash-only; quarto.cmd; `> /dev/null` (PowerShell `$null`) |
| 45 | 477-481 | Task 3 Step 7 | `git add package/scripts/common/quarto package/scripts/windows/quarto.cmd package/src/quarto-bld package/src/quarto-bld.cmd package/src/util/deno.ts tools/deno-esbuild-bundle.ts` / `git commit -m "..."` | a | git (multi-line -m: see row 30) |
| 46 | 491-499 | Task 4 Step 1 | edit `package/scripts/deno_std/download.sh` last lines (`FROZEN_FLAG="--frozen"`, `--update-lock` handling, `"$QUARTO_DENO" cache --allow-import --no-config --unstable-ffi --lock "$QUARTO_SRC_PATH/resources/deno_std/deno_std.lock" $FROZEN_FLAG "$@" ...deno_std.ts`) | u | edit-only POSIX script; Windows twin row 48 |
| 47 | 500-503 | Task 4 Step 1 | edit `package/scripts/deno_std/lock.sh` to call `package/scripts/deno_std/download.sh --update-lock` | c | bash-only, no Windows twin of `lock.sh`/update flag in the plan (download.bat is frozen-only) |
| 48 | 504-507 | Task 4 Step 1 | edit `package/scripts/deno_std/download.bat` last line: `%QUARTO_DENO% cache --allow-import --no-config --unstable-ffi --lock %~dp0\..\..\..\src\resources\deno_std\deno_std.lock --frozen %~dp0\deno_std.ts` | d | Windows leg of PR 00b |
| 49 | 511 | Task 4 Step 2 | `rm -rf src/resources/deno_std/cache && package/scripts/deno_std/download.sh && git status --short src/resources/deno_std/` | b | download.sh -> download.bat (needs %QUARTO_DENO% set by configure.cmd); rm -rf Git Bash |
| 50 | 512 | Task 4 Step 2 (prose) | `package/scripts/deno_std/lock.sh` | c | bash-only; see row 47 |
| 51 | 517-518 | Task 4 Step 3 | `git add package/scripts/deno_std/download.sh package/scripts/deno_std/download.bat package/scripts/deno_std/lock.sh` / `git commit -m "..."` | a | git |
| 52 | 586 | Task 5 Step 2 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/tools/check-bundle-externals.test.ts` | b | `VAR=x cmd` bash-only; run-tests.ps1 |
| 53 | 601 | Task 5 Step 3 (file header comment) | `quarto run --dev tools/check-bundle-externals.ts package/pkg-working/bin/quarto.js` | b | quarto -> quarto.cmd |
| 54 | 650 | Task 5 Step 4 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/tools/check-bundle-externals.test.ts` | b | same as row 52 |
| 55 | 655 | Task 5 Step 5 | `package/dist/bin/quarto run --dev tools/check-bundle-externals.ts package/pkg-working/bin/quarto.js; echo "exit=$?"` | b | quarto.cmd; `$?` bash-only |
| 56 | 656 | Task 5 Step 5 (prose) | `sed -n '<line>p' package/pkg-working/bin/quarto.js \| cut -c1-300` | a | Git Bash sed/cut; allowlisted-but-prompting per reading-file rules |
| 57 | 661-662 | Task 5 Step 6 | `git add tools/check-bundle-externals.ts tests/unit/tools/check-bundle-externals.test.ts` / `git commit -m "..."` | a | git |
| 58 | 678 | Task 6 Step 1 | `T=$(mktemp -d)` | u | MSYS temp path; later passed to deno.exe |
| 59 | 679 | Task 6 Step 1 | `for f in $(find tests -name '*.ts' -not -path 'tests/docs/*' -not -path 'tests/integration/playwright/*' \| sort); do echo "import \"file://$PWD/$f\";"; done > "$T/tests-graph.ts"` | c | `file://$PWD/...` renders `file:///c/Users/...` under Git Bash, not a valid Windows file URL (`file:///C:/...`); GNU find vs find.exe |
| 60 | 680 | Task 6 Step 1 | `for f in src/quarto.ts src/vendor_deps.ts tests/test-deps.ts package/scripts/deno_std/deno_std.ts package/src/bld.ts tools/deno-esbuild-bundle.ts; do echo "import \"file://$PWD/$f\";"; done > "$T/locked-graph.ts"` | c | same as row 59 |
| 61 | 681 | Task 6 Step 1 | `"$D" info --json --no-config --no-lock --unstable-kv --unstable-ffi --importmap=src/import_map.json "$T/tests-graph.ts" > "$T/tests.json"; echo "tests exit=$?"` | u | deno.exe with an MSYS temp path argument; `$?` bash |
| 62 | 682 | Task 6 Step 1 | `"$D" info --json ... "$T/locked-graph.ts" > "$T/locked.json"; echo "locked exit=$?"` | u | same as row 61 |
| 63 | 683 | Task 6 Step 1 | `jq -r '.modules[].specifier' "$T/locked.json" \| sort > "$T/locked.txt"` | a | jq present on Chris's Windows; Git Bash sort (PATH order could pick sort.exe from System32) |
| 64 | 684 | Task 6 Step 1 | `jq -r '.modules[].specifier' "$T/tests.json" \| grep -E '^(npm:\|jsr:\|https?:)' \| sort \| comm -23 - "$T/locked.txt"` | a | Git Bash grep/sort/comm; same PATH caveat as row 63 |
| 65 | 772 | Task 6 Step 2 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/tools/check-test-imports.test.ts` | b | `VAR=x cmd` bash-only |
| 66 | 905 | Task 6 Step 3 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/tools/check-test-imports.test.ts` | b | same as row 65 |
| 67 | 910 | Task 6 Step 4 | `package/dist/bin/quarto run --dev tools/check-test-imports.ts; echo "exit=$?"` | b | quarto.cmd; `$?` |
| 68 | 925 | Task 6 Step 4 | `package/dist/bin/quarto run --dev tools/check-test-imports.ts; echo "exit=$?"` | b | same as row 67 |
| 69 | 926 | Task 6 Step 4 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent $(find smoke/inspect -name '*.test.ts'); cd ..` | b | bash `$(find ...)`; VAR=x cmd |
| 70 | 927 | Task 6 Step 4 | `package/dist/bin/quarto run --dev tools/check-runtime-boundary.ts --update-baseline` | b | quarto.cmd |
| 71 | 928 | Task 6 Step 4 | `git diff --stat tools/runtime-boundary-baseline.json` | a | git |
| 72 | 936 | Task 6 Step 5 | `echo 'import "https://deno.land/std@0.224.0/assert/assert_exists.ts";' >> tests/smoke/inspect/inspect-cleanup.test.ts` | b | `>>` append is bash-only (PowerShell `Add-Content`); works in Git Bash |
| 73 | 937 | Task 6 Step 5 | `package/dist/bin/quarto run --dev tools/check-test-imports.ts; echo "exit=$?"` | b | same as row 67 |
| 74 | 938 | Task 6 Step 5 | `git checkout tests/smoke/inspect/inspect-cleanup.test.ts` | a | git; reverts a scratch edit the step itself made |
| 75 | 945-951 | Task 6 Step 6 | `git add tools/check-test-imports.ts tests/unit/tools/check-test-imports.test.ts tests/smoke/inspect tools/runtime-boundary-baseline.json` / `git commit -m "..."` | a | git |
| 76 | 962-1017 | Task 7 Step 1 | `.github/workflows/actions/quarto-dev/action.yml` replacement (input `deno-cache`, `if: inputs.deno-cache == 'true'`, cache key adds `deno.lock`) | a | GitHub Actions YAML; no shell |
| 77 | 1065 | Task 7 Step 2, workflow `Set Path` | `echo "$HOME/bin" >> $GITHUB_PATH` (`shell: bash`) | a | CI step on all three runners with bash (Git Bash on windows-latest) |
| 78 | 1076-1077 | Task 7 Step 2, workflow `Build bundle (Linux, macOS)` | `pushd package/src` / `./quarto-bld prepare-dist --set-version $(cat ../../version.txt)` | a | runs only `if: runner.os != 'Windows'` |
| 79 | 1083-1084 | Task 7 Step 2, workflow `Build bundle (Windows)` | `Push-Location package\src` / `.\quarto-bld.cmd prepare-dist --set-version (Get-Content ..\..\version.txt)` (`shell: pwsh`) | d | Windows leg of PR 00b CI |
| 80 | 1089 | Task 7 Step 2, workflow `No external module specifiers in quarto.js` | `quarto run --dev tools/check-bundle-externals.ts package/pkg-working/bin/quarto.js` (`shell: pwsh`, all three OSes) | d | relies on `quarto` resolving to quarto.cmd on PATH on windows-latest (how configure.cmd places it is unverified) |
| 81 | 1094 | Task 7 Step 2, workflow `Every remote module the tests reach is pinned` | `quarto run --dev tools/check-test-imports.ts` (`shell: pwsh`) | d | same as row 80 |
| 82 | 1099-1134 | Task 7 Step 2, workflow `Run the bundle from an empty DENO_DIR` (`shell: bash`) | `set -euo pipefail`; `mv src/quarto.ts src/quarto1.ts`; `export DENO_DIR="$RUNNER_TEMP/empty-deno-dir"`; `rm -rf "$DENO_DIR" && mkdir -p "$DENO_DIR"`; `Q="$PWD/package/pkg-working/bin/quarto.cmd"` when `RUNNER_OS = Windows`; `run check check`, `run html render tests/docs/callouts.qmd --to html`, `run website render tests/docs/website-image-base`, `run ojs render tests/docs/ojs/test-ojs.qmd --to html`, `run mermaid render tests/docs/smoke-all/2026/02/12/mermaid-typst.qmd --to typst`, `run manuscript render tests/docs/manuscript/base`; five `test -f` | d | Windows leg of the gate; invokes quarto.cmd from Git Bash on the runner; the step leaves `src/quarto.ts` moved (no restore step) |
| 83 | 1148-1149 | Task 7 Step 2, workflow `Validate Bundle` | `pushd package/src` / `./quarto-bld validate-bundle` | a | `if: runner.os == 'Linux'` only |
| 84 | 1156 | Task 7 Step 3 | `package/dist/bin/tools/x86_64/deno eval 'import { parse } from "jsr:@std/yaml@1.0.5"; for (const f of [".github/workflows/test-bundle.yml", ".github/workflows/actions/quarto-dev/action.yml"]) console.log(f, Object.keys(parse(Deno.readTextFileSync(f)) as Record<string, unknown>))'` | b | deno.exe path; single-quoted JS with double quotes ok in Git Bash, needs quoting care in PowerShell |
| 85 | 1161 | Task 7 Step 4 (prose) | run the workflow body with `RUNNER_TEMP=$(mktemp -d)` and `RUNNER_OS=$(uname)` exported, then `mv src/quarto1.ts src/quarto.ts` | c | `RUNNER_OS=$(uname)` is `MINGW64_NT-...` under Git Bash, so the body's `[ "$RUNNER_OS" = "Windows" ]` picks the extensionless `quarto` path and fails; plan says "Linux or macOS" |
| 86 | 1162 | Task 7 Step 4 | `git clean -ndx` (dry run) then `git clean -fdx tests/docs/callouts.html tests/docs/callouts_files tests/docs/website-image-base/_site tests/docs/ojs tests/docs/smoke-all/2026/02/12 tests/docs/manuscript/base/_manuscript` | a | git; destructive: dry run is prescribed first |
| 87 | 1167-1172 | Task 7 Step 5 | `git add .github/workflows/actions/quarto-dev/action.yml .github/workflows/test-bundle.yml` / `git commit -m "..."` | a | git |
| 88 | 1213-1214 | Task 8 Step 3 | `git add dev-docs/add-typescript-dependency.md dev-docs/ci-deno-caching.md dev-docs/runtime-migration/README.md` / `git commit -m "..."` | a | git |
| 89 | 1190 | Task 8 Step 1, doc text | `package/scripts/vendoring/update-lock.sh` (Windows: `set QUARTO_DENO_LOCK_MODE=update` then `configure.cmd`) | d | documents the Windows procedure; cmd syntax |
| 90 | 1223 | Task 9 Step 1 | PR checks `Bundle Test (ubuntu-latest)`, `(macos-latest)`, `(windows-latest)` and "Basic dev mode sanity check" of Smoke Tests, Parallel Smokes Tests, Test Tool Install, Runtime Boundary | d | CI on windows-latest is the Windows evidence |
| 91 | 1227 | Task 9 Step 2 | `package/scripts/vendoring/update-lock.sh` (Windows: `set QUARTO_DENO_LOCK_MODE=update` and `configure.cmd`), then `git diff deno.lock` | d | cmd `set` syntax; PowerShell `$env:QUARTO_DENO_LOCK_MODE='update'` |
| 92 | 1231 | Verification | `./configure.sh` on a clean checkout, `git status --short` empty | b | configure.cmd |
| 93 | 1233 | Verification | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/tools/check-bundle-externals.test.ts unit/tools/check-test-imports.test.ts` | b | VAR=x cmd |
| 94 | 1234 | Verification | `quarto run --dev tools/check-test-imports.ts` | b | quarto.cmd |
| 95 | 1235 | Verification | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent $(find smoke/inspect -name '*.test.ts')` | b | `$(find ...)` bash |
| 96 | 1236 | Verification | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent $(find smoke/run -name '*.test.ts') $(find smoke/check -name '*.test.ts') smoke/render/render-minimal.test.ts` | b | `$(find ...)` bash |
| 97 | 1237 | Verification | `quarto run --dev tools/check-runtime-boundary.ts` | b | quarto.cmd |
| 98 | 1249 | Review checklist | `rg -n 'deno\.land' tests --glob '!tests/docs/**'` | a | rg cross-platform; single quotes ok in Git Bash and PowerShell (`!` is not special in either) |
| 99 | 21/49/1262 | Context, Scope (Out) and Decision 1 | `tests/run-tests.sh:72` and `tests/run-tests.ps1:130` keep `--no-lock` (existing scripts; not run by the plan) | a | existing runners; both exist (`tests/run-tests.ps1` confirmed present) |

### Windows mentions

- L21: "The launchers pass `--no-config --no-lock` (`package/scripts/common/quarto:186`, `package/scripts/windows/quarto.cmd:131`, `package/launcher/src/main.rs:84-88`) and `--cached-only` in dev and release mode (`quarto:71`, `quarto:95`, `quarto.cmd:71`, `quarto.cmd:107`, `main.rs:89`)."
- L22: "`vendor.cmd` does the same and prints `Warning: Failed to vendor ..., continuing...`." (Context; the Windows vendoring currently continues on failure)
- L23: "The tests run with `--no-lock` and without `--cached-only` (`tests/run-tests.sh:72`, `tests/run-tests.ps1:130`)."
- L40 (Scope, In): "Two generated aggregate modules keep each `deno info` call to one argument, so there is no 700-file command line on Windows."
- L43 (Scope, In): "`test-bundle.yml`: matrix `ubuntu-latest`, `macos-latest`, `windows-latest`; cold dev cache for the build (`deno-cache: "false"`); ... five renders; debug logs kept as an artifact."
- L98: "`QUARTO_DENO_LOCK_MODE` (`update` → `--frozen=false` in `vendor.sh`/`vendor.cmd`/`quarto-bld`/`quarto-bld.cmd`; ...)"
- L136 (Acceptance criteria): "`Bundle Test` is green on `ubuntu-latest`, `macos-latest` and `windows-latest`: no external specifier in `quarto.js`; `quarto check` and the five renders succeed with an empty `DENO_DIR`."
- L228 (Task 2 Step 3 heading): "Rewrite the vendoring call (Windows)"
- L282 (update-lock.sh header comment): "# Windows: set QUARTO_DENO_LOCK_MODE=update, then run configure.cmd."
- L364 (Task 3 Step 2 heading): "Windows launcher"
- L381 (Task 3 Step 3 heading): "`quarto-bld` (POSIX and Windows)"
- L419: "(it imports `execProcess`, `info`, `isWindows` and `Configuration` today, not `join`)"
- L1073 / L1079-1080 / L1107-1108 (workflow): `if: runner.os != 'Windows'`, `- name: Build bundle (Windows)` / `if: runner.os == 'Windows'`, `if [ "$RUNNER_OS" = "Windows" ]; then Q="$PWD/package/pkg-working/bin/quarto.cmd"`
- L1084: `.\quarto-bld.cmd prepare-dist --set-version (Get-Content ..\..\version.txt)`
- L1168 (commit message): "Gate the release bundle on Linux, macOS and Windows"
- L1190 (docs text): "Run `package/scripts/vendoring/update-lock.sh` (Windows: `set QUARTO_DENO_LOCK_MODE=update` then `configure.cmd`)."
- L1192 (docs text): "renders documents with it on Linux, macOS and Windows."
- L1223 (Task 9 Step 1): "`Bundle Test (ubuntu-latest)`, `(macos-latest)`, `(windows-latest)` green"
- L1227 (Task 9 Step 2): "On that OS run `package/scripts/vendoring/update-lock.sh` (Windows: `set QUARTO_DENO_LOCK_MODE=update` and `configure.cmd`), confirm `git diff deno.lock` only adds entries, commit, and re-run the other two OSes."
- L1243 / L1245 / L1249 / L1250 (Review checklist): "`vendor.sh` and `vendor.cmd`"; "`quarto-bld`, `quarto-bld.cmd`"; "`vendor.cmd` runs `--frozen` like `vendor.sh`; if it does not, the PR description carries the evidence Decision 2 asks for."
- L1257 (Risks): "run the Windows and macOS legs only on `push` to `main` and on PRs that touch `src/import_map.json`, `deno.lock`, `package/**` or `tools/**`."
- L1262 (Decision 1): "`tests/run-tests.sh:72` and `run-tests.ps1:130` keep `--no-lock`"
- L1263 (Decision 2): "That would leave Windows, a supported OS, with the drift detection the rest of this PR exists to add. ... (b) keep `--frozen=false` on Windows ... (c) drop frozen enforcement on Windows."

### Windows mentions added by grep sweep at assembly
Lines matching `windows|win32|.cmd|.ps1|taskkill` (case-insensitive) that the extractor's list above did not cite. Quoted verbatim, trimmed to 300 characters; section is the nearest preceding heading.

- L5 (PR 00b: Commit `deno.lock`, run frozen, and gate the release bundle on three OSes): "**Goal:** Every module reachable from six entrypoints (`src/quarto.ts`, `src/vendor_deps.ts`, `tests/test-deps.ts`, `package/scripts/deno_std/deno_std.ts`, `package/src/bld.ts`, `tools/deno-esbuild-bundle.ts`: the dev launcher, the build and the declared test dependencies) is pinned in a committed ` ..."
- L37 (Scope): "- Frozen by default: `vendor.sh`/`vendor.cmd`, `quarto-bld`/`quarto-bld.cmd`, the bundle step (`package/src/util/deno.ts` and `lockPath` in `tools/deno-esbuild-bundle.ts`), the dev-mode launchers. `QUARTO_DENO_LOCK_MODE=update` (set by the new `package/scripts/vendoring/update-lock.sh`) switches the ..."
- L49 (Scope): "- Locking the test runs themselves: `tests/run-tests.sh:72` and `tests/run-tests.ps1:130` keep `--no-lock`; `tools/check-test-imports.ts` is what keeps the tests' graph inside the lockfile (Decisions, 1)."
- L115 (Files): "- Modify: `package/scripts/vendoring/vendor.sh:22-29`, `package/scripts/vendoring/vendor.cmd:28-34`"
- L117 (Files): "- Modify: `package/scripts/common/quarto:37-66,91-96,186`, `package/scripts/windows/quarto.cmd:33-36,102-108,131`"
- L118 (Files): "- Modify: `package/src/quarto-bld:20`, `package/src/quarto-bld.cmd:13`, `package/src/util/deno.ts:23-25`, `tools/deno-esbuild-bundle.ts:1-14`"
- L163 (Task 2: Lockfile policy and the frozen vendoring): "- Modify: `package/scripts/vendoring/vendor.sh`, `package/scripts/vendoring/vendor.cmd`"
- L230 (Task 2: Lockfile policy and the frozen vendoring): "In `package/scripts/vendoring/vendor.cmd` replace"
- L328 (Task 2: Lockfile policy and the frozen vendoring): "package/scripts/vendoring/vendor.sh package/scripts/vendoring/vendor.cmd package/scripts/vendoring/update-lock.sh"
- L341 (Task 3: Frozen lockfile in the dev launchers, `quarto-bld` and the bundle step): "- Modify: `package/scripts/common/quarto`, `package/scripts/windows/quarto.cmd`"
- L342 (Task 3: Frozen lockfile in the dev launchers, `quarto-bld` and the bundle step): "- Modify: `package/src/quarto-bld`, `package/src/quarto-bld.cmd`, `package/src/util/deno.ts`"
- L366 (Task 3: Frozen lockfile in the dev launchers, `quarto-bld` and the bundle step): "In `package/scripts/windows/quarto.cmd`, in the dev branch after `SET "QUARTO_IMPORT_MAP_ARG=--importmap=""!QUARTO_SRC_PATH!\import_map.json"""` (line 41) add:"
- L392 (Task 3: Frozen lockfile in the dev launchers, `quarto-bld` and the bundle step): "In `package/src/quarto-bld.cmd` replace the last line with:"
- L477 (Task 3: Frozen lockfile in the dev launchers, `quarto-bld` and the bundle step): "git add package/scripts/common/quarto package/scripts/windows/quarto.cmd package/src/quarto-bld package/src/quarto-bld.cmd package/src/util/deno.ts tools/deno-esbuild-bundle.ts"
- L1053 (Task 7: The CI cache input and the three-OS bundle gate): "os: [ubuntu-latest, macos-latest, windows-latest]"

## 00c-quarto-run-deprecation-notice.md

Extracted commands: 22 (a=6, b=14, c=1, d=0, u=1)

| # | line | section | command | class | note |
|---|---|---|---|---|---|
| 1 | 84 | Acceptance criteria | `quarto render tests/docs/project/prepost/deno-notice` with `QUARTO_RUN_DENO_NOTICE=1` | b | quarto -> quarto.cmd; `VAR=x cmd` bash-only (`$env:` in PowerShell); fixture runs `.ts` pre/post scripts via deno.exe |
| 2 | 85 | Acceptance criteria | same render with `QUARTO_RUN_DENO_NOTICE=0` | b | as row 1 |
| 3 | 86 | Acceptance criteria | `quarto run tests/docs/project/prepost/deno-notice/pre.ts`; `quarto run --dev tools/check-runtime-boundary.ts` | b | quarto -> quarto.cmd |
| 4 | 87 | Acceptance criteria | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/run/deno-notice.test.ts $(find smoke/run -name '*.test.ts') smoke/project/project-prepost.test.ts` | b | `VAR=x cmd` and `$(find ...)` bash-only; Git Bash with DENO_DIR=x86_64 or run-tests.ps1 |
| 5 | 88 | Acceptance criteria | `quarto run --dev tools/check-runtime-boundary.ts` | b | quarto -> quarto.cmd |
| 6 | 164 | Task 1 Step 2 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/run/deno-notice.test.ts` | b | `VAR=x cmd` bash-only |
| 7 | 233 | Task 1 Step 4 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/run/deno-notice.test.ts` | b | same as row 6 |
| 8 | 238-240 | Task 1 Step 5 | `git add src/core/run/deno-notice.ts tests/unit/run/deno-notice.test.ts` / `git commit -m "..."` | a | git |
| 9 | 355 | Task 2 Step 3 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/run/run-deno-notice.test.ts` | b | `VAR=x cmd`; the smoke test spawns `quartoDevCmd()` (TS helper, should pick quarto.cmd) |
| 10 | 382 | Task 2 Step 5 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/run/run-deno-notice.test.ts unit/run/deno-notice.test.ts` | b | as row 9 |
| 11 | 387-393 | Task 2 Step 6 | `git add src/core/run/deno.ts tests/smoke/run/run-deno-notice.test.ts tests/docs/project/prepost/deno-notice` / `git commit -m "..."` (multi-line message) | a | git; multi-line -m is bash-style |
| 12 | 402-407 | Task 3 Step 1 | edit `tests/run-tests.sh` after line 70: `export QUARTO_RUN_DENO_NOTICE=0` | u | edit-only POSIX runner (Windows twin row 13) |
| 13 | 408-413 | Task 3 Step 1 | edit `tests/run-tests.ps1` after line 60: `$Env:QUARTO_RUN_DENO_NOTICE = "0"` | a | PowerShell-native; `tests/run-tests.ps1` exists |
| 14 | 414-417 | Task 3 Step 1 | edit `tests/run-parallel-tests.sh`: `QUARTO_RUN_DENO_NOTICE=0 quarto run run-parallel-tests.ts $*` | c | bash-only; only `run-parallel-tests.sh` and `.ts` exist in tests/, no `.ps1`/`.cmd` twin, so Windows has no way to run it |
| 15 | 421 | Task 3 Step 2 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent $(find smoke/run -name '*.test.ts') smoke/project/project-prepost.test.ts smoke/website/drafts.test.ts $(find smoke/search -name '*.test.ts')` | b | bash `$(find ...)`, `VAR=x cmd` |
| 16 | 426-428 | Task 3 Step 3 | `git add tests/run-tests.sh tests/run-tests.ps1 tests/run-parallel-tests.sh` / `git commit -m "..."` | a | git |
| 17 | 439 | Task 4 Step 1 | `git push -u origin rt/00c-quarto-run-deprecation-notice && gh pr create --draft --fill && gh pr view --json number -q .number` | a | git/gh; push and `gh pr create` are maintainer-only |
| 18 | 464-468 | Task 4 Step 4 | `git add news/changelog-1.11.md dev-docs/runtime-migration/README.md` / `git commit -m "..."` / `git push` | a | git |
| 19 | 472 | Verification | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/run/deno-notice.test.ts $(find smoke/run -name '*.test.ts')` | b | bash `$(find ...)`, `VAR=x cmd` |
| 20 | 473 | Verification | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/project/project-prepost.test.ts smoke/website/drafts.test.ts` | b | `VAR=x cmd` |
| 21 | 474 | Verification | `package/dist/bin/quarto run tests/docs/project/prepost/deno-notice/pre.ts` (and with `QUARTO_RUN_DENO_NOTICE=0`) | b | quarto -> quarto.cmd; `VAR=x cmd` for the second form |
| 22 | 475 | Verification | `package/dist/bin/quarto run --dev tools/check-runtime-boundary.ts` | b | quarto -> quarto.cmd |

### Windows mentions

- L31 (Scope): "`QUARTO_RUN_DENO_NOTICE=0` in `tests/run-tests.sh`, `tests/run-tests.ps1` and `tests/run-parallel-tests.sh`"
- L78 (Files): "Modify: `tests/run-tests.sh:70`, `tests/run-tests.ps1:60`, `tests/run-parallel-tests.sh:3`"
- L398 (Task 3 Files): "Modify: `tests/run-tests.sh:70`, `tests/run-tests.ps1:60`, `tests/run-parallel-tests.sh:3`"
- L408-409 (Task 3 Step 1): "In `tests/run-tests.ps1` after line 60 (`$Env:QUARTO_DEBUG = "true"`) add:" with a `powershell` code block setting `$Env:QUARTO_RUN_DENO_NOTICE = "0"`
- L427 (Task 3 Step 3): "`git add tests/run-tests.sh tests/run-tests.ps1 tests/run-parallel-tests.sh`"


## 01-quick-fixes-from-spike.md

Extracted commands: 21 (a=6, b=15, c=0, d=0, u=0)

| # | line | section | command | class | note |
|---|---|---|---|---|---|
| 1 | 60 | Acceptance criteria | `grep -rn 'assert: { type: "json" }' src --include=*.ts` (and `grep -rn 'with: { type: "json" }' src --include=*.ts`) | a | Git Bash GNU grep; PowerShell has no grep |
| 2 | 61 | Acceptance criteria | `package/dist/bin/quarto dev-call build-artifacts` then `git status --short src/resources/editor` | b | quarto -> quarto.cmd |
| 3 | 64 | Acceptance criteria | `quarto run --dev tools/check-runtime-boundary.ts` after `--update-baseline --accept-tests-increase` | b | quarto -> quarto.cmd |
| 4 | 65 | Acceptance criteria | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/format-html-bslib-order.test.ts smoke/site/render-site-themes.test.ts smoke/render/render-html.test.ts` | b | `VAR=x cmd` bash-only; Git Bash with DENO_DIR=x86_64 or run-tests.ps1 |
| 5 | 77 | Task 1 Step 1 | `grep -rn 'assert: { type: "json" }' src --include=*.ts` | a | Git Bash grep |
| 6 | 126 | Task 1 Step 4 | `package/dist/bin/tools/x86_64/deno check --import-map src/import_map.json src/core/lib/yaml-intelligence/yaml-intelligence.ts src/core/lib/yaml-intelligence/parsing.ts` | b | plan states the Windows form: `package\dist\bin\tools\x86_64\deno.exe` (L127) |
| 7 | 132 | Task 1 Step 5 | `package/dist/bin/quarto dev-call build-artifacts && git status --short src/resources/editor` | b | quarto -> quarto.cmd; dev-call build-artifacts runs esbuild; byte-identical check may differ with Windows CRLF autocrlf (u) |
| 8 | 133 | Task 1 Step 5 | `git diff --stat`; `git checkout -- <file>` for unrelated regenerated files | a | git; destructive revert named in the step |
| 9 | 137-143 | Task 1 Step 6 | `git add src/core/lib/yaml-intelligence/yaml-intelligence.ts src/core/lib/yaml-intelligence/parsing.ts` / `git commit -m "..."` (multi-line message) | a | git |
| 10 | 221 | Task 2 Step 2 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/format-html-bslib-order.test.ts` | b | `VAR=x cmd` bash-only |
| 11 | 294 | Task 2 Step 4 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/format-html-bslib-order.test.ts` | b | same as row 10 |
| 12 | 299 | Task 2 Step 5 | `package/dist/bin/quarto render tests/docs/callouts.qmd --to html --output-dir /tmp/rt01 && ls /tmp/rt01/callouts_files/libs/bootstrap/` | b | quarto.cmd; `/tmp/rt01` handling under Git Bash vs native binaries (see SPIKES note); `ls` is Git Bash |
| 13 | 300 | Task 2 Step 5 (prose) | remove `/tmp/rt01` afterwards (no command given; `rm -rf /tmp/rt01` implied) | b | destructive on a temp dir the step created; Git Bash |
| 14 | 304 | Task 2 Step 6 | `package/dist/bin/quarto run --dev tools/check-runtime-boundary.ts --update-baseline --accept-tests-increase && git diff tools/runtime-boundary-baseline.json` | b | quarto -> quarto.cmd |
| 15 | 309-316 | Task 2 Step 7 | `git add src/format/html/format-html-shared.ts tests/unit/format-html-bslib-order.test.ts tools/runtime-boundary-baseline.json` / `git commit -m "..."` | a | git |
| 16 | 322 | Verification | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/format-html-bslib-order.test.ts` | b | `VAR=x cmd` |
| 17 | 323 | Verification | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/site/render-site-themes.test.ts smoke/render/render-html.test.ts $(find smoke/yaml-intelligence -name '*.test.ts')` | b | `$(find ...)` bash, `VAR=x cmd` |
| 18 | 324 | Verification | `package/dist/bin/quarto dev-call build-artifacts && git status --short src/resources/editor` | b | quarto.cmd |
| 19 | 325 | Verification | `grep -rn 'assert: { type' src --include=*.ts` | a | Git Bash grep |
| 20 | 326 | Verification | `package/dist/bin/tools/x86_64/deno lint src/format/html/format-html-shared.ts src/core/lib/yaml-intelligence/parsing.ts src/core/lib/yaml-intelligence/yaml-intelligence.ts` | b | deno.exe |
| 21 | 327 | Verification | `package/dist/bin/quarto run --dev tools/check-runtime-boundary.ts` | b | quarto.cmd |

### Windows mentions

- L127 (Task 1 Step 4): "(on macOS use `tools/aarch64/deno` or `tools/x86_64/deno`; on Windows `package\dist\bin\tools\x86_64\deno.exe`)"
- (not matched by the Windows/.cmd/.ps1/taskkill pattern, noted for context) L19 (Context): "That order is whatever the filesystem returns: hash order on ext4, and no sorted-order guarantee on APFS or NTFS either."


## 02-runtime-boundary-check.md

Extracted commands: 55 (a=29, b=24, c=1, d=0, u=1)

Row convention: a `git add` + `git commit` pair in one code block is one row (lines "X-Y"). Shell assumed by the plan: Git Bash/POSIX throughout (`VAR=x cmd`, `>>`, `$?`, `$(find ...)`, `&&`, `cd tests && ...`); the execution log (session 2) confirms it ran under Git Bash and needed `DENO_DIR=x86_64`. Rows in the Execution log (lines 1158+) are executor history, not instructions; they are included because they name commands.

| # | line | section | command | class | note |
|---|---|---|---|---|---|
| 1 | 60 | Spec / Context | `rg -n 'execPath\(\)\|QUARTO_DENO'` (PR 25 Task 7 step 2, referenced only) | a | rg is cross-platform; reference to another plan, not run here |
| 2 | 156 | Spec / Interfaces (CLI contract) | `quarto run --dev tools/check-runtime-boundary.ts [--update-baseline [--accept-tests-increase]] [--root <dir>]` | b | quarto -> package/dist/bin/quarto.cmd (log line 1247) |
| 3 | 196 | Spec / Acceptance criteria | `quarto run --dev tools/check-runtime-boundary.ts` | b | quarto -> quarto.cmd |
| 4 | 200 | Spec / Acceptance criteria | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/tools/check-runtime-boundary.test.ts unit/asserts.test.ts` | b | needs `DENO_DIR=x86_64` prefix under Git Bash (log line 1174), or tests/run-tests.ps1; env-prefix syntax is bash-only |
| 5 | 259 | Plan / Task 1 step 2 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/asserts.test.ts` | b | same as row 4 |
| 6 | 270 | Plan / Task 1 step 3 | `./configure.cmd` (once, before Task 3's `quarto run --dev`) | a | already the Windows form; log says run from PowerShell (line 1238) |
| 7 | 302 | Plan / Task 1 step 4 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/asserts.test.ts` | b | same as row 4 |
| 8 | 308-309 | Plan / Task 1 step 5 | `git add src/import_map.json tests/asserts.ts tests/unit/asserts.test.ts` + `git commit -m "Add tests/asserts.ts as the single assertion import for tests"` | a | git is cross-platform |
| 9 | 556 | Plan / Task 2 step 2 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/tools/check-runtime-boundary.test.ts` | b | same as row 4 |
| 10 | 575 | Plan / Task 2 step 3 (script header "Usage") | `quarto run --dev tools/check-runtime-boundary.ts` | b | quarto.cmd; comment text inside the script |
| 11 | 576 | Plan / Task 2 step 3 (script header "Usage") | `quarto run --dev tools/check-runtime-boundary.ts --update-baseline` | b | quarto.cmd |
| 12 | 577 | Plan / Task 2 step 3 (script header "Usage") | `quarto run --dev tools/check-runtime-boundary.ts --update-baseline --accept-tests-increase` | b | quarto.cmd |
| 13 | 578 | Plan / Task 2 step 3 (script header "Usage") | `quarto run --dev tools/check-runtime-boundary.ts --root /path/to/quarto-cli` | b | quarto.cmd; placeholder path |
| 14 | 897 | Plan / Task 2 step 4 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/tools/check-runtime-boundary.test.ts unit/asserts.test.ts` | b | same as row 4 |
| 15 | 902 | Plan / Task 2 step 5 | `package/dist/bin/tools/x86_64/deno lint tools/check-runtime-boundary.ts tests/unit/tools/check-runtime-boundary.test.ts tests/asserts.ts tests/unit/asserts.test.ts` | b | deno -> deno.exe (Git Bash resolves without suffix; unverified in PowerShell) |
| 16 | 908-909 | Plan / Task 2 step 6 | `git add tools/check-runtime-boundary.ts tests/unit/tools/check-runtime-boundary.test.ts` + `git commit -m "Add runtime boundary ratchet script ..."` (multi-line -m) | a | git; multi-line quoted -m works in Git Bash |
| 17 | 923 | Plan / Task 3 step 1 | `package/dist/bin/quarto run --dev tools/check-runtime-boundary.ts; echo "exit=$?"` | b | quarto -> quarto.cmd; `echo "exit=$?"` is bash-only (PowerShell: `$LASTEXITCODE`) |
| 18 | 947 | Plan / Task 3 step 2 | `package/dist/bin/quarto run --dev tools/check-runtime-boundary.ts --update-baseline && cat tools/runtime-boundary-baseline.json` | b | quarto.cmd; `cat` present in Git Bash |
| 19 | 977 | Plan / Task 3 step 3 | `package/dist/bin/quarto run --dev tools/check-runtime-boundary.ts; echo "exit=$?"` | b | quarto.cmd; bash `$?` |
| 20 | 984 | Plan / Task 3 step 4 | `echo 'const _rt02 = Deno.cwd();' >> src/command/utils.ts` | a | bash `>>`; works in Git Bash (appends LF) |
| 21 | 985 | Plan / Task 3 step 4 | `echo 'Deno.cwd();' >> src/core/cri/deno-cri/chrome.js` | a | same as row 20 |
| 22 | 986 | Plan / Task 3 step 4 | `echo "import { join as _rt02j } from 'https://deno.land/std/path/mod.ts';" >> src/core/mime.ts` | a | echo itself fine; consequence is in row 24 |
| 23 | 987 | Plan / Task 3 step 4 | `echo 'import { delay as _rt02d } from "async";' >> src/core/path.ts` | a | same as row 20 |
| 24 | 988 | Plan / Task 3 step 4 | `package/dist/bin/quarto run --dev tools/check-runtime-boundary.ts; echo "exit=$?"` | c | log lines 1246-1253: Windows launcher runs outer Deno with `--cached-only --check`, so the uncached `https://deno.land/std/path/mod.ts` import fails before the script runs unless `package/dist/bin/deno_cache` is pre-warmed; also quarto.cmd and bash `$?` |
| 25 | 989 | Plan / Task 3 step 4 | `git checkout -- src/command/utils.ts src/core/cri/deno-cri/chrome.js src/core/mime.ts src/core/path.ts` | a | git; discards the probe edits (destructive, named files) |
| 26 | 997 | Plan / Task 3 step 5 | `echo 'const _rt02 = Deno.cwd();' >> src/command/utils.ts` | a | bash `>>` |
| 27 | 998 | Plan / Task 3 step 5 | `echo 'const _rt02 = Deno.cwd();' >> tests/utils.ts` | a | bash `>>` |
| 28 | 999 | Plan / Task 3 step 5 | `package/dist/bin/quarto run --dev tools/check-runtime-boundary.ts --update-baseline` | b | quarto.cmd |
| 29 | 1000 | Plan / Task 3 step 5 | `git diff --stat tools/runtime-boundary-baseline.json` | a | git |
| 30 | 1001 | Plan / Task 3 step 5 | `package/dist/bin/quarto run --dev tools/check-runtime-boundary.ts --update-baseline --accept-tests-increase` | b | quarto.cmd |
| 31 | 1002 | Plan / Task 3 step 5 | `git diff tools/runtime-boundary-baseline.json` | a | git |
| 32 | 1003 | Plan / Task 3 step 5 | `git checkout -- src/command/utils.ts tests/utils.ts tools/runtime-boundary-baseline.json` | a | git; destructive on named files (this also resets the baseline file) |
| 33 | 1004 | Plan / Task 3 step 5 | `package/dist/bin/quarto run --dev tools/check-runtime-boundary.ts --accept-tests-increase; echo "exit=$?"` | b | quarto.cmd; bash `$?` |
| 34 | 1011-1012 | Plan / Task 3 step 6 | `git add tools/runtime-boundary-baseline.json` + `git commit -m "Add runtime boundary baseline ..."` (multi-line -m) | a | git |
| 35 | 1069-1070 | Plan / Task 4 step 1 (workflow YAML) | `echo "$HOME/bin" >> $GITHUB_PATH` (shell: bash, `Set Path` step) | a | runs on ubuntu-latest in CI, not locally |
| 36 | 1073 | Plan / Task 4 step 1 (workflow YAML) | `uses: ./.github/workflows/actions/quarto-dev` | a | CI action on ubuntu-latest, not run locally |
| 37 | 1078 | Plan / Task 4 step 1 (workflow YAML) | `quarto run --dev tools/check-runtime-boundary.ts` (shell: bash) | a | CI on ubuntu-latest |
| 38 | 1083 | Plan / Task 4 step 2 | `package/dist/bin/tools/x86_64/deno eval 'import { parse } from "jsr:@std/yaml@1.0.5"; ...Deno.readTextFileSync(".github/workflows/runtime-boundary.yml")...'` | b | deno.exe; single-quote outer form is bash (PowerShell quoting would differ); needs network for jsr |
| 39 | 1093-1094 | Plan / Task 4 step 4 | `git add .github/workflows/runtime-boundary.yml dev-docs/runtime-migration/README.md` + `git commit -m "Run the runtime boundary ratchet in CI"` | a | git |
| 40 | 1103 | Verification | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/tools/check-runtime-boundary.test.ts unit/asserts.test.ts` | b | same as row 4 |
| 41 | 1104 | Verification | `package/dist/bin/quarto run --dev tools/check-runtime-boundary.ts` | b | quarto.cmd |
| 42 | 1106 | Verification | `package/dist/bin/tools/x86_64/deno lint tools/check-runtime-boundary.ts tests/asserts.ts` | b | deno.exe |
| 43 | 1126 | Risks and rollback | `quarto dev-call build-artifacts` (mentioned, not an instruction) | b | quarto.cmd dev-call build-artifacts |
| 44 | 1128 | Risks and rollback | `deno run --allow-read --import-map src/import_map.json tools/check-runtime-boundary.ts` (a later PR's option, "not part of this PR") | u | not instructed; not assessed |
| 45 | 1138 | Decisions needed (evidence) | `deno info` | a | evidence only, not an instruction; deno is cross-platform |
| 46 | 1174 | Execution log session 2 | `cd tests && DENO_DIR=x86_64 QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent <files>` | b | already the Windows Git Bash adaptation; bash env-prefix syntax |
| 47 | 1182 | Execution log session 2 | `deno info` | a | evidence only |
| 48 | 1229 | Execution log session 3 | `./configure.cmd` | a | Windows form already |
| 49 | 1238 | Execution log session 4 | `./configure.cmd` (run once from PowerShell) | a | Windows form already |
| 50 | 1239, 1277 | Execution log session 4 | `git status --short` | a | git |
| 51 | 1247 | Execution log session 4 | `package/dist/bin/quarto.cmd` (dev launcher) | a | Windows form already |
| 52 | 1252 | Execution log session 4 | `deno cache https://deno.land/std/path/mod.ts` (warms package/dist/bin/deno_cache) | a | undocumented-in-steps prerequisite for row 24; deno cross-platform |
| 53 | 1267 | Execution log session 4 | `git show b86f98d:src/core/text.ts` | a | git |
| 54 | 1296 | Execution log session 5 | `package/dist/bin/quarto.cmd run --dev ...` | a | Windows form already |
| 55 | 1299 | Execution log session 5 | `git status --short` | a | git |

### Windows mentions

- L60 (Spec / Context): "a `deno` command in a launcher such as `package/src/quarto-bld`, `configure.sh` or a `.cmd` file, a `deno run` in a workflow) is not a count and never lowers or raises a baseline."
- L270 (Plan / Task 1 step 3): "on Linux and macOS the next `quarto` command reconfigures by itself, on Windows it stops with \"Quarto requires reconfiguration\"; run `./configure.cmd` once before Task 3's `quarto run --dev`."
- L1172 (Execution log session 2): "Environment (Windows Git Bash): `tests/run-tests.sh` line 53 sets `DENO_ARCH_DIR=$DENO_DIR`, so tests run as `cd tests && DENO_DIR=x86_64 QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent <files>`."
- L1229 (Execution log session 3): "On Windows run `./configure.cmd` once before Task 3's `quarto run --dev` (the import-map hash changed)."
- L1238 (Execution log session 4): "`./configure.cmd` run once from PowerShell after the import-map change"
- L1246-1248 (Execution log session 4): "Windows adaptations (no plan text changed for them): the dev launcher is `package/dist/bin/quarto.cmd` (there is no extensionless `quarto` on Windows), and the Windows launcher runs the outer Deno with `--cached-only --check` over `src/quarto.ts`, so a probe that adds an uncached remote import to the CLI graph fails before the script runs."
- L1295-1296 (Execution log session 5): "The amended step 4 was run once on Windows against the uncommitted session-4 baseline (`package/dist/bin/quarto.cmd run --dev ...`)"


## 02b-node-compatible-ts-syntax.md

Extracted commands: 62 (a=24, b=36, c=0, d=0, u=2)

Row convention: `git add`+`git commit` pair in one block is one row. Shell assumed by the plan: Git Bash/POSIX (`$(find ...)`, pipes to `tail`/`grep`/`xargs`/`wc`, `perl`, `2>&1`, `cd src && ...`). The plan has no Windows-specific text; CI rows run on ubuntu-latest (Node 26).

| # | line | section | command | class | note |
|---|---|---|---|---|---|
| 1 | 100 | Spec / Acceptance criteria | `node --no-warnings tools/node-bundle/check-ts-syntax.mjs` | a | Node cross-platform; script normalises `\\` in paths; needs Node 22.13+ on PATH |
| 2 | 101 | Spec / Acceptance criteria | `node --test tools/node-bundle/check-ts-syntax.test.mjs` | a | test spawns `process.execPath`, uses os.tmpdir |
| 3 | 102 | Spec / Acceptance criteria | `package/dist/bin/tools/x86_64/deno test --allow-all --import-map=src/import_map.json tools/codemod/codemod-import-type.test.ts` | b | deno -> deno.exe |
| 4 | 103 | Spec / Acceptance criteria | `quarto run --dev tools/codemod-import-type.ts --check src tests package/src` | b | quarto -> quarto.cmd |
| 5 | 104 | Spec / Acceptance criteria | `cd src && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --unstable-ffi --import-map=import_map.json quarto.ts` | b | deno.exe; project memory notes 3 known deno-check errors on main, so "no errors" may not hold (u on the expected output) |
| 6 | 106 | Spec / Acceptance criteria | `quarto run --dev tools/check-runtime-boundary.ts` | b | quarto.cmd |
| 7 | 110 | Plan (preamble) | `./configure.sh` | b | configure.sh -> configure.cmd |
| 8 | 110 | Plan (preamble) | `node --version` | a | Node cross-platform |
| 9 | 184 | Plan / Task 1 step 2 | `node --test tools/node-bundle/check-ts-syntax.test.mjs` | a | Node |
| 10 | 254 | Plan / Task 1 step 4 | `node --test tools/node-bundle/check-ts-syntax.test.mjs` | a | Node |
| 11 | 257 | Plan / Task 1 step 4 | `node --no-warnings tools/node-bundle/check-ts-syntax.mjs \| tail -1` | b | `tail` available in Git Bash; PowerShell needs `Select-Object -Last 1` |
| 12 | 263-264 | Plan / Task 1 step 5 | `git add tools/node-bundle/check-ts-syntax.mjs tools/node-bundle/check-ts-syntax.test.mjs` + `git commit -m "..."` | a | git |
| 13 | 384 | Plan / Task 2 step 4 | `rg -n 'AccountTokenType\[' src` | a | rg cross-platform |
| 14 | 407 | Plan / Task 2 step 5 | `rg -n 'AccountSetup' src` | a | rg |
| 15 | 411 | Plan / Task 2 step 6 | `cd src && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --unstable-ffi --import-map=import_map.json quarto.ts` | b | deno.exe; see row 5 note |
| 16 | 414 | Plan / Task 2 step 6 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent $(find unit/confluence/ -name '*.test.ts') unit/giscus.test.ts $(find unit/project/ -name '*.test.ts')` | b | DENO_DIR=x86_64 prefix under Git Bash or run-tests.ps1; `$(find ...)` is bash/GNU find |
| 17 | 418-419 | Plan / Task 2 step 6 | `git add src/core/giscus.ts ...` + `git commit -m "Replace enums and a runtime namespace with as-const objects"` | a | git |
| 18 | 430 | Plan / Task 3 step 1 | `rg -c '^  constructor\(public readonly httpRequest: BaseHttpRequest\) \{\}$' src/publish/netlify/api/services \| wc -l` | u | `$` anchor breaks if files are CRLF in the Windows checkout; `wc` from Git Bash |
| 19 | 433 | Plan / Task 3 step 1 | `perl -0pi -e 's/^  constructor\(...\) \{\}$/...\n.../m' src/publish/netlify/api/services/*Service.ts` | u | perl ships with Git for Windows but is bash-only here (glob expansion); `^...$` with /m fails on CRLF files |
| 20 | 582 | Plan / Task 3 step 4 | `cd src && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --unstable-ffi --import-map=import_map.json quarto.ts` | b | deno.exe |
| 21 | 585 | Plan / Task 3 step 4 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/gha-grouping.test.ts ... unit/windows-arm-r-error.test.ts unit/print-call-r-diagnostics.test.ts $(find smoke/use-brand/ -name '*.test.ts')` | b | DENO_DIR=x86_64 / run-tests.ps1; `$(find ...)` bash; unit/windows-arm-r-error.test.ts and axe/preview tests may be OS-sensitive (u) |
| 22 | 589-590 | Plan / Task 3 step 4 | `git add src tests` + `git commit -m "Replace constructor parameter properties with explicit fields"` | a | git |
| 23 | 605 | Plan / Task 4 step 1 | `perl -pi -e 's/return <(\w+)> await response\.json\(\);/return (await response.json()) as $1;/' src/publish/quarto-pub/api/index.ts` | b | perl via Git Bash; single-quoted `$1` is bash form (no CRLF-anchor issue: no `$`/`^`) |
| 24 | 606 | Plan / Task 4 step 1 | `rg -n '<\w+> ' src/publish/quarto-pub/api/index.ts src/config/types.ts` | a | rg; single quotes are bash form |
| 25 | 613 | Plan / Task 4 step 2 | `node --no-warnings tools/node-bundle/check-ts-syntax.mjs \| tail -1` | b | `tail` bash |
| 26 | 616 | Plan / Task 4 step 2 | `cd src && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --unstable-ffi --import-map=import_map.json quarto.ts` | b | deno.exe |
| 27 | 620-621 | Plan / Task 4 step 2 | `git add src/config/types.ts src/publish/quarto-pub/api/index.ts` + `git commit -m "Use as-casts instead of angle-bracket assertions"` | a | git |
| 28 | 641 | Plan / Task 5 step 1 (test file header comment) | `package/dist/bin/tools/x86_64/deno test --allow-all --import-map=src/import_map.json tools/codemod/` | b | deno.exe |
| 29 | 706 | Plan / Task 5 step 2 | `package/dist/bin/tools/x86_64/deno test --allow-all --import-map=src/import_map.json tools/codemod/codemod-import-type.test.ts` | b | deno.exe; test imports `npm:ts-morph@28.0.0` (network) |
| 30 | 896 | Plan / Task 5 step 4 | `package/dist/bin/tools/x86_64/deno test --allow-all --import-map=src/import_map.json tools/codemod/codemod-import-type.test.ts` | b | deno.exe |
| 31 | 901 | Plan / Task 5 step 5 | `package/dist/bin/tools/x86_64/deno cache --lock=deno.lock --frozen=false --import-map=src/import_map.json tools/codemod-import-type.ts` | b | deno.exe; conditional on PR 00b's deno.lock |
| 32 | 904-905 | Plan / Task 5 step 5 | `git add tools/codemod-import-type.ts tools/codemod/codemod-import-type.test.ts deno.lock` + `git commit -m "..."` | a | git |
| 33 | 946 | Plan / Task 6 step 1 | `node -e 'const j=require("./package/src/common/deno-meta.json"); console.log(JSON.stringify(j.compilerOptions))'` | a | Node; single-quote outer form is bash (PowerShell quoting differs) |
| 34 | 950 | Plan / Task 6 step 2 | `cd src && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --unstable-ffi --import-map=import_map.json quarto.ts 2>&1 \| grep -c 'TS1484'` | b | deno.exe; `2>&1 \| grep -c` bash/Git Bash grep |
| 35 | 955 | Plan / Task 6 step 3 | `quarto run --dev tools/codemod-import-type.ts --dry-run src tests package/src \| tail -1` | b | quarto.cmd; `tail` bash |
| 36 | 958 | Plan / Task 6 step 3 | `quarto run --dev tools/codemod-import-type.ts src tests package/src \| tail -1` | b | quarto.cmd; `tail` bash; rewrites ~500 files (CRLF/LF preservation unverified) |
| 37 | 958 | Plan / Task 6 step 3 | `git diff --name-only \| grep '\.ts$' \| xargs package/dist/bin/tools/x86_64/deno fmt` | b | Git Bash pipeline; deno.exe; no direct PowerShell equivalent |
| 38 | 963 | Plan / Task 6 step 4 | `cd src && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --unstable-ffi --import-map=import_map.json quarto.ts` | b | deno.exe |
| 39 | 966 | Plan / Task 6 step 4 | `git checkout -- src/core/text.ts` | a | git; discards the probe edit (destructive, single named file) |
| 40 | 968 | Plan / Task 6 step 4 | `quarto run --dev tools/codemod-import-type.ts --check src tests package/src \| tail -1` | b | quarto.cmd; `tail` bash |
| 41 | 971 | Plan / Task 6 step 4 | `node --no-warnings tools/node-bundle/check-ts-syntax.mjs \| tail -1` | b | `tail` bash |
| 42 | 973 | Plan / Task 6 step 4 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent $(find unit/ -name '*.test.ts')` | b | DENO_DIR=x86_64 / run-tests.ps1; `$(find ...)` GNU find in Git Bash |
| 43 | 976 | Plan / Task 6 step 4 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/render/render-html.test.ts smoke/site/render-site.test.ts smoke/inspect/inspect-project.test.ts smoke/check/check.test.ts` | b | same as row 42; smoke/check may behave differently on Windows (u) |
| 44 | 979 | Plan / Task 6 step 4 | `package/src/quarto-bld prepare-dist` | b | extensionless bash script; Windows form quarto-bld.cmd (existence not verified here) |
| 45 | 984-986 | Plan / Task 6 step 5 | `git add package/src/common/deno-meta.json deno.jsonc tests/test-conf.json` + `git add -u src tests package/src` + `git commit -m "verbatimModuleSyntax: mark type-only imports (codemod-import-type)"` | a | git |
| 46 | 1028 | Plan / Task 7 step 1 (workflow YAML) | `node --test tools/node-bundle/check-ts-syntax.test.mjs` | a | CI, ubuntu-latest, Node 26 |
| 47 | 1030 | Plan / Task 7 step 1 (workflow YAML) | `node --no-warnings tools/node-bundle/check-ts-syntax.mjs` | a | CI, ubuntu-latest |
| 48 | 1039 | Plan / Task 7 step 2 (workflow YAML) | `package/dist/bin/quarto run --dev tools/codemod-import-type.ts --check src tests package/src` | a | CI on ubuntu-latest, not local |
| 49 | 1041 | Plan / Task 7 step 2 (workflow YAML) | `package/dist/bin/tools/x86_64/deno test --allow-all --import-map=src/import_map.json tools/codemod/` | a | CI on ubuntu-latest, not local |
| 50 | 1055 | Plan / Task 7 step 3 (rule text) | `quarto run --dev tools/codemod-import-type.ts <dir>` | b | quarto.cmd; contributor-rule wording |
| 51 | 1064-1065 | Plan / Task 7 step 4 | `git add .github/workflows/check-ts-syntax.yml .github/workflows/runtime-boundary.yml .claude/rules/typescript/deno-essentials.md` + `git commit -m "CI: Node type-stripping syntax check and type-only import guard"` | a | git |
| 52 | 1070 | Verification | `node --test tools/node-bundle/check-ts-syntax.test.mjs` | a | Node |
| 53 | 1070 | Verification | `node --no-warnings tools/node-bundle/check-ts-syntax.mjs` | a | Node |
| 54 | 1071 | Verification | `package/dist/bin/tools/x86_64/deno test --allow-all --import-map=src/import_map.json tools/codemod/codemod-import-type.test.ts` | b | deno.exe |
| 55 | 1072 | Verification | `quarto run --dev tools/codemod-import-type.ts --check src tests package/src` | b | quarto.cmd |
| 56 | 1073 | Verification | `cd src && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --unstable-ffi --import-map=import_map.json quarto.ts` | b | deno.exe |
| 57 | 1074 | Verification | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent $(find unit/ -name '*.test.ts')` | b | same as row 42 |
| 58 | 1074 | Verification | `$(find smoke/ -name '*.test.ts')` (full smoke suite, "in CI on three OSes") | b | same shell forms as row 57; full smoke run locally on Windows not assessed (u on duration/flakiness) |
| 59 | 1075 | Verification | `package/src/quarto-bld prepare-dist` | b | quarto-bld -> quarto-bld.cmd (existence not verified) |
| 60 | 1075 | Verification | `package/dist/bin/quarto render tests/docs/test.qmd` | b | quarto -> quarto.cmd |
| 61 | 1076 | Verification | `quarto run --dev tools/check-runtime-boundary.ts` | b | quarto.cmd |
| 62 | 1077 | Verification | `node --no-warnings tools/node-bundle/check-ts-syntax.mjs` | a | Node |

### Windows mentions

- L512 (Plan / Task 3 step 2): "`src/core/knitr.ts` (`WindowsArmX64RError`): add `readonly exitCode: number;` after `readonly diagnosticLines: readonly string[];`..." (class name only; no Windows execution instruction)
- L585 (Plan / Task 3 step 4): command lists `unit/windows-arm-r-error.test.ts` (test file name only)
- No sentence in 02b mentions Windows, win32, .cmd, .ps1 or taskkill as an instruction.


## 03-deps-skypack-to-npm.md

Extracted commands: 54 (a=16, b=26, c=1, d=0, u=11)

| # | line | section | command | class | note |
|---|---|---|---|---|---|
| 1 | 97 | Acceptance criteria | `grep -c skypack src/import_map.json` | a | GB; plain grep |
| 2 | 98 | Acceptance criteria | `grep -rn 'from "diff"\|from "js-yaml"' src package/src tests tools --include=*.ts` | a | GB |
| 3 | 99 | Acceptance criteria | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/npm-deps-interop.test.ts` | b | RT |
| 4 | 100 | Acceptance criteria | `package/dist/bin/quarto dev-call build-artifacts && git status --short src/resources` | b | Q |
| 5 | 102 | Acceptance criteria | `grep -cE '"npm:(js-yaml\|dayjs\|...\|scss-parser)@' deno.lock` | a | GB |
| 6 | 241 | Task 1 Step 2 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/npm-deps-interop.test.ts` | b | RT; same command as #3 |
| 7 | 247-248 | Task 1 Step 3 | `git add tests/unit/npm-deps-interop.test.ts` / `git commit -m "Add contract test ..."` | a | git |
| 8 | 292 | Task 2 Step 1 | `package/scripts/vendoring/update-lock.sh && git diff --stat deno.lock` | u | UL |
| 9 | 297 | Task 2 Step 2 | `package/dist/bin/tools/x86_64/deno check --import-map src/import_map.json src/core/yaml.ts src/core/date.ts src/core/ansi-colors.ts src/core/hash.ts` | b | D |
| 10 | 300 | Task 2 Step 2 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/npm-deps-interop.test.ts unit/yaml.test.ts unit/sass-cache.test.ts` | b | RT |
| 11 | 305 | Task 2 Step 3 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/render/render-date.test.ts smoke/render/render-title-block.test.ts` | b | RT |
| 12 | 308 | Task 2 Step 3 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent docs/smoke-all/jupyter/error/traceback.qmd docs/smoke-all/2024/02/03/8580-b.qmd` | b | RT |
| 13 | 309 | Task 2 Step 3 | `./configure-test-env.sh` (prose: "requires the test Python environment from ./configure-test-env.sh") | u | Windows counterpart (configure-test-env.ps1?) not stated in plan |
| 14 | 314 | Task 2 Step 4 | `package/scripts/vendoring/update-lock.sh` | u | UL |
| 15 | 315-316 | Task 2 Step 4 | `git add src/import_map.json deno.lock` / `git commit -m "Resolve js-yaml, dayjs, ..."` | a | git |
| 16 | 347 | Task 3 Step 1 | `package/scripts/vendoring/update-lock.sh` | u | UL |
| 17 | 351 | Task 3 Step 2 | `package/dist/bin/tools/x86_64/deno check --import-map src/import_map.json src/execute/ojs/extract-resources.ts src/execute/ojs/compile.ts src/execute/ojs/ojs-tools.ts src/command/dev-call/build-artifacts/cmd.ts` | b | D |
| 18 | 354 | Task 3 Step 2 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/npm-deps-interop.test.ts` | b | RT |
| 19 | 359 | Task 3 Step 3 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/render/render-ojs.test.ts smoke/ojs/complex-layout.test.ts smoke/ojs/dependency-traversal.test.ts smoke/ojs/ojs-define-precision.test.ts` | b | RT |
| 20 | 364 | Task 3 Step 4 | `package/dist/bin/quarto dev-call build-artifacts && git status --short src/resources` | b | Q |
| 21 | 370 | Task 3 Step 5 | `package/scripts/vendoring/update-lock.sh` | u | UL |
| 22 | 371-372 | Task 3 Step 5 | `git add src/import_map.json deno.lock` / `git commit -m "Resolve acorn, acorn-walk and @observablehq/parser from npm ..."` | a | git |
| 23 | 394 | Task 4 Step 1 | `package/scripts/vendoring/update-lock.sh` | u | UL |
| 24 | 398 | Task 4 Step 2 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/npm-deps-interop.test.ts unit/scss-analyzer-parse.test.ts smoke/site/render-site-themes.test.ts` | b | RT |
| 25 | 404 | Task 4 Step 3 | `package/scripts/vendoring/update-lock.sh` | u | UL |
| 26 | 406 | Task 4 Step 3 | `git add src/import_map.json deno.lock` / `git commit -m "Resolve scss-parser from npm"` | a | git |
| 27 | 416 | Task 5 Step 1 | `grep -rn 'from "diff"\|from "diff/\|from "js-yaml"\|from "js-yaml/' src package/src tests tools --include=*.ts --include=*.js` | a | GB |
| 28 | 448 | Task 5 Step 2 | `package/scripts/vendoring/update-lock.sh` | u | UL |
| 29 | 452 | Task 5 Step 3 | `grep -c skypack src/import_map.json; package/dist/bin/tools/x86_64/deno eval 'JSON.parse(Deno.readTextFileSync("src/import_map.json")); console.log("valid")'` | b | D; deno eval itself cross-platform; single-quoted JS needs GB (PowerShell quoting differs) |
| 30 | 457 | Task 5 Step 4 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/npm-deps-interop.test.ts unit/binary-search.test.ts` | b | RT |
| 31 | 460 | Task 5 Step 4 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent docs/smoke-all/2024/09/30/10931.qmd docs/smoke-all/2024/04/26/9365.qmd docs/smoke-all/crossrefs/float/docx/docx-jupyter-1.qmd` | b | RT |
| 32 | 466 | Task 5 Step 5 | `package/scripts/vendoring/update-lock.sh` | u | UL |
| 33 | 467-468 | Task 5 Step 5 | `git add src/import_map.json deno.lock` / `git commit -m "Resolve test-only packages from npm; ..."` | a | git |
| 34 | 482 | Task 6 Step 1 | `cd package/src && ./quarto-bld prepare-dist --set-version $(cat ../../version.txt) && cd ../..` | u | extensionless bash script `quarto-bld`; Windows .cmd counterpart not verified |
| 35 | 483 | Task 6 Step 1 | `package/dist/bin/quarto run --dev tools/check-bundle-externals.ts package/pkg-working/bin/quarto.js` | b | Q |
| 36 | 484 | Task 6 Step 1 | `mv src/quarto.ts src/quarto1.ts` | a | GB |
| 37 | 485 | Task 6 Step 1 | `export DENO_DIR=$(mktemp -d) XDG_CACHE_HOME=$(mktemp -d)` | c | XDG_CACHE_HOME is a Linux var (plan itself says macOS needs a different line); Windows Sass cache location differs so the "empty Sass cache" intent is not met; also bash-only `export`/`mktemp` |
| 38 | 486 | Task 6 Step 1 | `package/pkg-working/bin/quarto render tests/docs/date/fr.qmd --to html && grep -c octobre tests/docs/date/fr.html` | b | Q |
| 39 | 487 | Task 6 Step 1 | `package/pkg-working/bin/quarto render tests/docs/callouts.qmd --to html` | b | Q |
| 40 | 488 | Task 6 Step 1 | `package/pkg-working/bin/quarto render tests/docs/ojs/test-ojs.qmd --to html` | b | Q |
| 41 | 489 | Task 6 Step 1 | `mv src/quarto1.ts src/quarto.ts; unset DENO_DIR XDG_CACHE_HOME` | a | GB |
| 42 | 491 | Task 6 Step 1 | `git clean -fdx tests/docs/date tests/docs/callouts.html tests/docs/callouts_files tests/docs/ojs` after `git clean -ndx` | a | git; destructive, plan already does dry run (-ndx) first |
| 43 | 501 | Task 6 Step 2 (workflow edit) | `run date render tests/docs/date/fr.qmd --to html` (inside test-bundle.yml bash step) | u | CI-only; `run` is a function of PR 00b's workflow; Windows runner behavior depends on that file |
| 44 | 509 | Task 6 Step 2 (workflow edit) | `grep -q octobre tests/docs/date/fr.html` | a | GB (CI bash step) |
| 45 | 515-516 | Task 6 Step 3 | `git add .github/workflows/test-bundle.yml` / `git commit -m "Bundle gate: render a French date ..."` | a | git |
| 46 | 536 | Verification | `rm -rf package/dist/bin/deno_cache && ./configure.sh` | b | configure.sh -> configure.cmd |
| 47 | 537 | Verification | `git status --short` | a | git |
| 48 | 538 | Verification | `package/dist/bin/quarto --version` | b | Q |
| 49 | 539 | Verification | `package/dist/bin/quarto check` | b | Q |
| 50 | 540-545 | Verification | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/npm-deps-interop.test.ts ... $(find smoke/ojs -name '*.test.ts') smoke/site/render-site-themes.test.ts` | b | RT; also `\` line continuation and `$(find ...)` are bash-only (PowerShell: Get-ChildItem) |
| 51 | 546-548 | Verification | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent docs/smoke-all/jupyter/error/traceback.qmd docs/smoke-all/2024/09/30/10931.qmd docs/smoke-all/2024/04/26/9365.qmd docs/smoke-all/crossrefs/float/docx/docx-jupyter-1.qmd` | b | RT; `\` continuation |
| 52 | 549 | Verification | `package/dist/bin/quarto dev-call build-artifacts && git status --short src/resources` | b | Q |
| 53 | 550 | Verification | `quarto run --dev tools/check-runtime-boundary.ts` | b | bare `quarto` -> quarto.cmd on PATH (or Q) |
| 54 | 527-528 | Task 7 Step 1 | `git add dev-docs/runtime-migration/README.md` / `git commit -m "runtime-migration: PR 03 in progress"` | a | git |

### Windows mentions

none


## 04-deps-deno-land-x-small.md

Extracted commands: 51 (a=19, b=24, c=0, d=0, u=8)

| # | line | section | command | class | note |
|---|---|---|---|---|---|
| 1 | 111 | Acceptance criteria | `grep -n 'deno.land/x/\(semver\|media_types\|xmlp\|xml\|another_cookiejar\|cache\|events\)@' src/import_map.json` | a | GB |
| 2 | 112 | Acceptance criteria | `grep -rn 'from "semver/\|from "media_types/\|...\|from "events/' src package/src tests tools --include=*.ts --include=*.js` | a | GB |
| 3 | 113 | Acceptance criteria | `package/dist/bin/tools/x86_64/deno check --import-map src/import_map.json src/quarto.ts` | b | D |
| 4 | 116 | Acceptance criteria | `quarto run --dev tools/check-runtime-boundary.ts` | b | bare quarto -> quarto.cmd |
| 5 | 188 | Task 1 Step 2 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/semver.test.ts` | b | RT |
| 6 | 221 | Task 1 Step 4 | `package/scripts/vendoring/update-lock.sh && cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/semver.test.ts` | u | UL + RT |
| 7 | 255 | Task 1 Step 6 | `grep -rn 'from "semver/' src package/src tests tools --include=*.ts; package/dist/bin/tools/x86_64/deno check --import-map src/import_map.json src/quarto.ts` | b | GB + D |
| 8 | 260 | Task 1 Step 7 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/semver.test.ts smoke/check/check.test.ts $(find smoke/extensions -name '*.test.ts') $(find smoke/engine -name '*.test.ts')` | b | RT; `$(find ...)` bash-only |
| 9 | 263 | Task 1 Step 7 | `QUARTO_VERSION_REQUIREMENT=">=1.4" package/dist/bin/quarto --version; QUARTO_VERSION_REQUIREMENT=">=100" package/dist/bin/quarto render tests/docs/minimal.qmd --to html; echo "exit=$?"` | b | Q; VAR=x prefix and `$?` bash-only (GB, or $env: and $LASTEXITCODE) |
| 10 | 269-276 | Task 1 Step 8 | `git add src/import_map.json deno.lock src/deno_ral/semver.ts ... src/core/knitr.ts` / `git commit -m "Replace deno.land/x/semver ..."` | a | git |
| 11 | 344 | Task 2 Step 3 | `package/scripts/vendoring/update-lock.sh && package/dist/bin/tools/x86_64/deno check --import-map src/import_map.json src/execute/ojs/extract-resources.ts && cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/ojs/dependency-traversal.test.ts smoke/render/render-ojs.test.ts` | u | UL + D + RT |
| 12 | 350-351 | Task 2 Step 4 | `git add src/import_map.json deno.lock src/execute/ojs/extract-resources.ts` / `git commit -m "Replace deno.land/x/media_types ..."` | a | git |
| 13 | 423 | Task 3 Step 2 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/project/website-sitemap-parse.test.ts` | b | RT |
| 14 | 520 | Task 3 Step 5 | `package/scripts/vendoring/update-lock.sh && cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/project/website-sitemap-parse.test.ts smoke/website/drafts.test.ts smoke/website/drafts-env.test.ts` | u | UL + RT |
| 15 | 527 | Task 3 Step 6 | `mkdir -p /tmp/rt04site` | a | GB; /tmp = %TEMP% in Git Bash |
| 16 | 528 | Task 3 Step 6 | `printf 'project:\n  type: website\nwebsite:\n  site-url: https://example.com/\n' > /tmp/rt04site/_quarto.yml` | a | GB |
| 17 | 529 | Task 3 Step 6 | `printf -- '---\ntitle: Home\n---\n\nhome\n' > /tmp/rt04site/index.qmd` | a | GB |
| 18 | 530 | Task 3 Step 6 | `printf -- '---\ntitle: About\n---\n\nabout\n' > /tmp/rt04site/about.qmd` | a | GB |
| 19 | 531 | Task 3 Step 6 | `package/dist/bin/quarto render /tmp/rt04site && cat /tmp/rt04site/_site/sitemap.xml` | b | Q; `/tmp/...` arg handed to a Windows binary (MSYS usually converts, not guaranteed; safer C:/ path) |
| 20 | 532 | Task 3 Step 6 | `sleep 1; touch /tmp/rt04site/about.qmd` | a | GB |
| 21 | 533 | Task 3 Step 6 | `package/dist/bin/quarto render /tmp/rt04site/about.qmd && cat /tmp/rt04site/_site/sitemap.xml` | b | Q; same /tmp caveat |
| 22 | 535 | Task 3 Step 6 | "Remove `/tmp/rt04site` afterwards" (no literal command; implies rm -rf) | a | GB; destructive, dry-run first per user rules |
| 23 | 540-541 | Task 3 Step 7 | `git add src/import_map.json deno.lock src/project/types/website/website-sitemap.ts tests/unit/project/website-sitemap-parse.test.ts` / `git commit -m "Replace deno.land/x/xmlp ..."` | a | git |
| 24 | 615 | Task 4 Step 2 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/project/manuscript-meca-xml.test.ts` | b | RT |
| 25 | 730 | Task 4 Step 5 | `package/scripts/vendoring/update-lock.sh && cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/project/manuscript-meca-xml.test.ts` | u | UL + RT |
| 26 | 735 | Task 4 Step 6 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/manuscript/render-manuscript.test.ts smoke/jats/render-manuscript.test.ts` | b | RT |
| 27 | 736 | Task 4 Step 6 | `npm install -g meca` | u | npm.cmd under Git Bash; whether the `meca` CLI runs on Windows PATH not known |
| 28 | 740 | Task 4 Step 6 | `package/dist/bin/quarto render tests/docs/manuscript/base --to jats` | b | Q |
| 29 | 741 | Task 4 Step 6 | `unzip -p tests/docs/manuscript/base/_manuscript/index-meca.zip manifest.xml \| head -3` | u | unzip is not shipped with Git for Windows; head is GB |
| 30 | 742 | Task 4 Step 6 | `rm -rf tests/docs/manuscript/base/_manuscript` | a | GB; destructive |
| 31 | 749-750 | Task 4 Step 7 | `git add src/import_map.json deno.lock src/project/types/manuscript/meca.ts tests/unit/project/manuscript-meca-xml.test.ts` / `git commit -m "Replace deno.land/x/xml ..."` | a | git |
| 32 | 831 | Task 5 Step 2 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/publish/rsconnect-cookie-fetch.test.ts` | b | RT |
| 33 | 844 | Task 5 Step 3 | `package/scripts/vendoring/update-lock.sh` | u | UL |
| 34 | 902 | Task 5 Step 6 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/publish/rsconnect-cookie-fetch.test.ts && cd .. && package/dist/bin/tools/x86_64/deno check --import-map src/import_map.json src/publish/rsconnect/api/index.ts src/publish/rsconnect/rsconnect.ts && package/dist/bin/quarto publish connect --help \| head -3` | b | RT + D + Q |
| 35 | 908-909 | Task 5 Step 7 | `git add src/import_map.json deno.lock src/publish/rsconnect/api/cookie-fetch.ts ... ` / `git commit -m "Keep the Connect cookie jar on tough-cookie ..."` | a | git |
| 36 | 923 | Task 6 Step 1 | `grep -rn '"cache/' src package/src tests tools --include=*.ts --include=*.js --include=*.mjs` | a | GB |
| 37 | 948 | Task 6 Step 4 | `package/scripts/vendoring/update-lock.sh && cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent docs/smoke-all/2026/02/12/mermaid-typst.qmd docs/smoke-all/2026/02/12/mermaid-multi-diagram.qmd` | u | UL + RT; needs Chrome on Windows |
| 38 | 949 | Task 6 Step 4 | `package/dist/bin/quarto install chrome-headless-shell --no-prompt` | b | Q |
| 39 | 949 | Task 6 Step 4 | `package/dist/bin/quarto check` | b | Q |
| 40 | 954-955 | Task 6 Step 5 | `git add src/import_map.json deno.lock src/core/cri/deno-cri/chrome.js ...` / `git commit -m "Use node:events in deno-cri; ..."` | a | git |
| 41 | 967 | Task 7 Step 1 | `package/dist/bin/quarto run --dev tools/check-runtime-boundary.ts` | b | Q |
| 42 | 973-974 | Task 7 Step 2 | `git add dev-docs/runtime-migration/README.md` / `git commit -m "runtime-migration: PR 04 in progress"` | a | git |
| 43 | 980 | Verification | `rm -rf package/dist/bin/deno_cache && ./configure.sh` | b | configure.sh -> configure.cmd |
| 44 | 981 | Verification | `git status --short` | a | git |
| 45 | 982 | Verification | `grep -n 'deno.land/x' src/import_map.json` | a | GB |
| 46 | 983 | Verification | `package/dist/bin/tools/x86_64/deno check --import-map src/import_map.json src/quarto.ts package/src/bld.ts` | b | D |
| 47 | 984 | Verification | `package/dist/bin/quarto check` | b | Q |
| 48 | 985-991 | Verification | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/semver.test.ts ... $(find smoke/extensions -name '*.test.ts') $(find smoke/engine -name '*.test.ts') ...` | b | RT; `\` continuations and `$(find)` bash-only |
| 49 | 992-993 | Verification | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent docs/smoke-all/2026/02/12/mermaid-typst.qmd docs/smoke-all/2026/02/12/mermaid-multi-diagram.qmd` | b | RT |
| 50 | 994 | Verification | `package/dist/bin/quarto run --dev tools/check-runtime-boundary.ts` | b | Q |
| 51 | 997 | Verification | `CONNECT_SERVER=<url> CONNECT_API_KEY=<key> package/dist/bin/quarto publish connect tests/docs/minimal.qmd --no-prompt` | b | Q; VAR=x prefix bash-only; needs a Connect server |

### Windows mentions

none


## 05-deps-deno-dom-jsr.md

Extracted commands: 60 (a=21, b=18, c=0, d=5, u=16)

| # | line | section | command | class | note |
|---|---|---|---|---|---|
| 1 | 83 | Acceptance criteria | `grep -rn 'from "deno_dom/\|import("deno_dom/' src tests package/src --include=*.ts` | a | GB |
| 2 | 84 | Acceptance criteria | `grep -n deno_dom src/import_map.json` | a | GB |
| 3 | 85 | Acceptance criteria | `QUARTO_LOG_LEVEL=debug package/dist/bin/quarto render tests/docs/minimal.qmd --to html 2>&1 \| grep deno-dom-native` | d | README per-OS table lists Windows for PR 05; as written is bash (Q + `$env:QUARTO_LOG_LEVEL` in PowerShell; Task 5 gives the PowerShell form) |
| 4 | 86 | Acceptance criteria | `QUARTO_DENO_DOM=/nonexistent/libplugin.so` (same render command as #3) | u | whether quarto.cmd forwards `QUARTO_DENO_DOM` to DENO_DOM_PLUGIN is not stated; VAR=x prefix bash-only |
| 5 | 88 | Acceptance criteria | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/core/deno-dom.test.ts` | b | RT |
| 6 | 90 | Acceptance criteria | `quarto run --dev tools/check-runtime-boundary.ts` (after `--update-baseline --accept-tests-increase`) | b | bare quarto -> quarto.cmd |
| 7 | 100 | Task 1 Step 1 | `gh release list --repo b-fuze/deno-dom --limit 40` | a | gh |
| 8 | 100 | Task 1 Step 1 | `gh api repos/b-fuze/deno-dom/compare/v0.1.41...v0.1.56 --jq '.commits[].commit.message' \| head -100` | a | gh; head is GB |
| 9 | 105 | Task 1 Step 2 | `for t in $(gh release list --repo b-fuze/deno-dom --limit 40 --json tagName -q '.[].tagName' \| grep -E '^v0\.1\.(4[2-9]\|5[0-6])'); do echo "== $t"; gh release view "$t" --repo b-fuze/deno-dom --json body -q .body; done` | a | bash loop, GB |
| 10 | 110 | Task 1 Step 3 | `rg -n 'template' src --type ts \| rg -i 'querySelector\|children\|childNodes\|innerHTML\|\.content\b' ; rg -n '<template' src --type ts` | a | rg; single-quoted regexes need GB |
| 11 | 200 | Task 2 Step 2 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/core/deno-dom.test.ts` | b | RT |
| 12 | 206-207 | Task 2 Step 3 | `git add tests/unit/core/deno-dom.test.ts` / `git commit -m "Add contract test for the deno-dom seam"` | a | git |
| 13 | 229 | Task 3 Step 2 | `package/dist/bin/tools/x86_64/deno check --import-map src/import_map.json src/core/deno-dom.ts` | b | D |
| 14 | 332 | Task 3 Step 4 | `package/scripts/vendoring/update-lock.sh && package/dist/bin/tools/x86_64/deno check --import-map src/import_map.json src/core/deno-dom.ts && cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/core/deno-dom.test.ts` | u | UL + D + RT |
| 15 | 337 | Task 3 Step 5 | `QUARTO_LOG_LEVEL=debug package/dist/bin/quarto render tests/docs/minimal.qmd --to html --output-dir /tmp/rt05 2>&1 \| grep -i 'deno-dom-native'` | d | Windows dev-mode native load is covered by Task 5 / README table; as written bash + Linux plugin path (`libplugin.so`) |
| 16 | 340 | Task 3 Step 5 | `QUARTO_DENO_DOM=/nonexistent/libplugin.so QUARTO_LOG_LEVEL=debug package/dist/bin/quarto render tests/docs/minimal.qmd --to html --output-dir /tmp/rt05 2>&1 \| grep -i 'deno-dom-native'; ls /tmp/rt05/minimal.html` (then "Remove /tmp/rt05") | u | QUARTO_DENO_DOM honoring by quarto.cmd unknown; /tmp path to Windows binary |
| 17 | 346-347 | Task 3 Step 6 | `git add src/import_map.json deno.lock src/core/deno-dom.ts` / `git commit -m "Resolve deno_dom from jsr:@b-fuze/deno-dom ..."` | a | git |
| 18 | 377 | Task 4 Step 2 | `grep -rn 'from "deno_dom/\|import("deno_dom/' src tests package/src --include=*.ts; package/dist/bin/tools/x86_64/deno check --import-map src/import_map.json src/quarto.ts` | b | GB + D |
| 19 | 382 | Task 4 Step 3 | `package/dist/bin/tools/x86_64/deno lint src/core/deno-dom.ts src/core/pandoc/self-contained.ts src/project/types/website/about/website-about.ts src/project/types/website/listing/ src/project/types/website/util/discover-meta.ts` | b | D |
| 20 | 387 | Task 4 Step 4 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/site/render-listings.test.ts ... smoke/render/render-html.test.ts` | b | RT |
| 21 | 393-394 | Task 4 Step 5 | `git add src/core/pandoc/self-contained.ts ... src/project/types/website/util/discover-meta.ts` / `git commit -m "Import DOM types through core/deno-dom.ts everywhere"` | a | git |
| 22 | 404 | Task 5 Step 1 | `$env:QUARTO_LOG_LEVEL="debug"; package\dist\bin\quarto.cmd render tests\docs\minimal.qmd --to html 2>&1 \| Select-String deno-dom-native` | d | already PowerShell and already quarto.cmd; Windows is in the README per-OS table |
| 23 | 421 | Task 5 Step 3 | "Run: the command of Step 1." (same PowerShell command as #22) | d | as #22 |
| 24 | 427-428 | Task 5 Step 4 | `git add package/scripts/windows/quarto.cmd` / `git commit -m "Point quarto.cmd at the packaged deno_dom plugin (tools\x86_64\deno_dom) ..."` | a | git; single backslashes only (no `\\`) |
| 25 | 443 | Task 6 Step 1 | `cd package/src && ./quarto-bld prepare-dist --set-version $(cat ../../version.txt) && cd ../..` | u | step says "(Linux or macOS)"; Windows counterpart not stated |
| 26 | 444 | Task 6 Step 1 | `package/dist/bin/quarto run --dev tools/check-bundle-externals.ts package/pkg-working/bin/quarto.js` | b | Q |
| 27 | 445 | Task 6 Step 1 | `mv src/quarto.ts src/quarto1.ts` | a | GB |
| 28 | 446 | Task 6 Step 1 | `DENO_DIR=$(mktemp -d) QUARTO_LOG_LEVEL=debug package/pkg-working/bin/quarto render tests/docs/callouts.qmd --to html 2>&1 \| grep -i 'deno-dom-native'` | b | Q; VAR=x prefix bash-only (GB); step labeled Linux or macOS, Windows is via CI gate |
| 29 | 447 | Task 6 Step 1 | `mv src/quarto1.ts src/quarto.ts` | a | GB |
| 30 | 456 | Task 6 Step 2 (workflow edit) | `if ! grep -q 'Loaded deno-dom-native' "$LOGS/html.log"; then grep -i 'deno-dom-native' "$LOGS/html.log" \|\| true; echo "::error::..."; exit 1; fi` | u | CI bash step; depends on `$LOGS` set by PR 00b's workflow on the Windows runner |
| 31 | 466-467 | Task 6 Step 3 | `git add .github/workflows/test-bundle.yml` / `git commit -m "Bundle gate: ..."` | a | git |
| 32 | 506-508 | Task 7 Step 1 (script body) | `QUARTO_REPORT_PERFORMANCE_METRICS=functionTimes QUARTO_REPORT_PERFORMANCE_METRICS_FILE="$file" "$QUARTO" render "$@" --quiet` | u | bash script; `$QUARTO` must be a launcher runnable from bash (quarto.cmd or the CI shim) |
| 33 | 509 | Task 7 Step 1 (script body) | `jq -r --arg l "$LABEL" ... '[...] \| @tsv' "$file"` | a | jq via scoop; single-quoted filter needs GB |
| 34 | 515 | Task 7 Step 1 (script body) | `time_render website tests/docs/smoke-all/typst/margin-layout --to html` | u | script-internal; renders an 86-doc site; Windows timing run not described locally |
| 35 | 516 | Task 7 Step 1 (script body) | `time_render book tests/docs/books/visualization-curriculum --to html` | u | script-internal |
| 36 | 523 | Task 7 Step 2 | `tools/parsehtml-timing.sh package/dist/bin/quarto native 3 \| tee /tmp/rt05-native.tsv` | b | Q (launcher arg -> quarto.cmd); run via `bash tools/parsehtml-timing.sh` under Git Bash |
| 37 | 524 | Task 7 Step 2 | `QUARTO_DENO_DOM=/nonexistent tools/parsehtml-timing.sh package/dist/bin/quarto wasm 3 \| tee /tmp/rt05-wasm.tsv` | b | Q; VAR=x prefix bash-only (GB) |
| 38 | 525 | Task 7 Step 2 | `git status --short tests/docs` | a | git |
| 39 | 527 | Task 7 Step 2 | `git clean -fdx tests/docs/smoke-all/typst/margin-layout tests/docs/books/visualization-curriculum` after `git clean -ndx` | a | git; destructive, dry run (-ndx) specified first |
| 40 | 527 | Task 7 Step 2 | `tests/configure-test-env.sh` (conditional, "If the book render asks for Python") | u | Windows counterpart not stated |
| 41 | 565 | Task 7 Step 3 (workflow) | `echo "$HOME/bin" >> $GITHUB_PATH` | u | CI step on windows-latest in bash shell; not verified locally |
| 42 | 567 | Task 7 Step 3 (workflow) | `uses: ./.github/workflows/actions/quarto-dev` | u | existing composite action; Windows behavior not in this plan |
| 43 | 573-576 | Task 7 Step 3 (workflow) | `quarto_cmd=$(command -v quarto.cmd)` / `dir=$(dirname "$quarto_cmd")` / `printf '#!/bin/bash\nexec "%s" "$@"\n' "$quarto_cmd" > "$dir/quarto"` / `chmod +x "$dir/quarto"` | u | the plan's own Windows shim (quarto -> quarto.cmd) for bash steps; unverified |
| 44 | 581 | Task 7 Step 3 (workflow) | `QUARTO_LOG_LEVEL=debug quarto render tests/docs/minimal.qmd --to html 2>&1 \| grep 'Loaded deno-dom-native'` | u | relies on the shim in #43 |
| 45 | 588 | Task 7 Step 3 (workflow) | `tools/parsehtml-timing.sh quarto native "${{ inputs.runs }}" \| tee "$PARSEHTML_TIMING_OUT-native.tsv"` | u | CI Windows via shim; path in `runner.temp` is a Windows path |
| 46 | 596 | Task 7 Step 3 (workflow) | `tools/parsehtml-timing.sh quarto wasm "${{ inputs.runs }}" \| tee "$PARSEHTML_TIMING_OUT-wasm.tsv"` (env `QUARTO_DENO_DOM: /nonexistent`) | u | as #45 |
| 47 | 609-610 | Task 7 Step 4 | `git add tools/parsehtml-timing.sh .github/workflows/parsehtml-timing.yml` / `git commit -m "Add parseHtml timing script and workflow ..."` | a | git |
| 48 | 611 | Task 7 Step 4 | `git push` | a | git; pushes a branch (per user rules, propose first before pushing CI-triggering branches) |
| 49 | 612 | Task 7 Step 4 | `gh workflow run parsehtml-timing.yml --ref rt/05-deps-deno-dom-jsr -f runs=3` | a | gh; fires CI (user rules: needs approval) |
| 50 | 623 | Task 8 Step 1 | `package/dist/bin/quarto run --dev tools/check-runtime-boundary.ts --update-baseline --accept-tests-increase && git diff tools/runtime-boundary-baseline.json` | b | Q |
| 51 | 629-630 | Task 8 Step 2 | `git add tools/runtime-boundary-baseline.json dev-docs/runtime-migration/README.md` / `git commit -m "runtime-migration: PR 05 in progress; lower src boundary count"` | a | git |
| 52 | 638 | Verification | `rm -rf package/dist/bin/deno_cache && ./configure.sh` | b | configure.sh -> configure.cmd |
| 53 | 639 | Verification | `git status --short` | a | git |
| 54 | 640 | Verification | `package/dist/bin/quarto check` | b | Q |
| 55 | 641-645 | Verification | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/core/deno-dom.test.ts smoke/render/render-html.test.ts ... $(find smoke/site ...) $(find smoke/website ...) $(find smoke/book ...) $(find smoke/crossref ...) $(find smoke/self-contained ...) $(find smoke/search ...) $(find smoke/axe ...)` | b | RT; `$(find)` and `\` bash-only |
| 56 | 646 | Verification | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent 'docs/smoke-all/dashboard/**/*.qmd'` | b | RT; quoted glob expanded by smoke-all |
| 57 | 647 | Verification | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent 'docs/smoke-all/2024/**/*.qmd'` | b | RT |
| 58 | 648 | Verification | `QUARTO_LOG_LEVEL=debug package/dist/bin/quarto render tests/docs/callouts.qmd --to html 2>&1 \| grep 'Loaded deno-dom-native'` | d | Windows is in README per-OS table for PR 05; PowerShell form per Task 5 |
| 59 | 649 | Verification | `QUARTO_DENO_DOM=/nonexistent QUARTO_LOG_LEVEL=debug package/dist/bin/quarto render tests/docs/callouts.qmd --to html 2>&1 \| grep 'Error loading deno-dom-native'` | u | QUARTO_DENO_DOM forwarding in quarto.cmd unknown |
| 60 | 650 | Verification | `package/dist/bin/quarto run --dev tools/check-runtime-boundary.ts` | b | Q |

### Windows mentions

- Overview "Size" (line 9): "M (import map, `deno.lock`, `src/core/deno-dom.ts`, 8 importer files, `package/scripts/windows/quarto.cmd`, 1 unit test, ...)"
- Spec > Context (line 24): "Three launchers set `DENO_DOM_PLUGIN` ... `package/launcher/src/main.rs:65-68,75` (the Windows release `quarto.exe`: `tools\x86_64\deno_dom\plugin.dll`) and `package/scripts/windows/quarto.cmd:118`, which points at `tools\deno_dom\plugin.dll`. ... so on Windows the `.cmd` launcher (dev mode, and the release `quarto.cmd`) never loads the native plugin today and silently falls back to WASM. Pre-existing; fixed in Task 5 because this PR's acceptance checks the native path on Windows." (line truncated by grep; read in full from file)
- Spec > Context (line 28): "Decision 6 makes PR 20 gate on `parseHtml` time for these two, per OS including arm64 macOS and Windows, at most 2x the native plugin" (long line; sentence located by read)
- Scope > In (line 37): "`package/scripts/windows/quarto.cmd:118` plugin path;"
- Scope > Out (line 46): "the Rust launcher (`package/launcher/src/main.rs`; its Windows path is already right);"
- Files (line 74): "Modify: `package/scripts/windows/quarto.cmd:118`"
- Acceptance criteria (line 85): "... prints `Loaded deno-dom-native` on Linux x86_64, macOS (x86_64 and arm64) and Windows x86_64 (the last needs Task 5)."
- Task 3 Step 3 code comment (line 292): "// package/scripts/windows/quarto.cmd, package/launcher/src/main.rs), so the"
- Task 5 heading (line 397): "### Task 5: Windows `.cmd` launcher plugin path"
- Task 5 Files (line 400): "Modify: `package/scripts/windows/quarto.cmd:118`"
- Task 5 Step 1 (line 402): "**Step 1: See it fail (Windows)**"
- Task 5 Step 1 (line 404): "Run (PowerShell, dev build): `$env:QUARTO_LOG_LEVEL=\"debug\"; package\dist\bin\quarto.cmd render tests\docs\minimal.qmd --to html 2>&1 | Select-String deno-dom-native`"
- Task 5 Step 2 (line 409): "In `package/scripts/windows/quarto.cmd` replace line 118"
- Task 5 Step 2 (line 415): "REM packaging installs the plugin under tools\<arch>\deno_dom (package/src/common/dependencies/deno_dom.ts); Windows ships x86_64 only"
- Task 5 Step 3 (line 419): "**Step 3: Run it again (Windows)**"
- Task 5 Step 4 (lines 427-431): "git add package/scripts/windows/quarto.cmd" / "Point quarto.cmd at the packaged deno_dom plugin (tools\x86_64\deno_dom)" / "The .cmd launcher looked in tools\deno_dom, where packaging never puts" / "the plugin, so Windows dev builds and quarto.cmd always fell back to WASM."
- Task 7 workflow (line 556): "os: [ubuntu-latest, macos-latest, windows-latest]"
- Task 7 workflow (line 569): "- name: Make quarto available in bash (Windows)"
- Task 7 workflow (line 570): "if: runner.os == 'Windows'"
- Task 7 workflow (line 573): "quarto_cmd=$(command -v quarto.cmd)"
- Task 7 Step 4 (line 614): "one row per OS (`ubuntu-latest` x86_64, `macos-latest` arm64, `windows-latest` x86_64)"
- Verification (line 653): "On the PR: `Smoke Tests` on Linux and Windows, `Parallel Smokes Tests`, `Bundle Test` on three OSes ..."
- Review checklist (line 661): "`quarto.cmd` points at `tools\x86_64\deno_dom\plugin.dll`; the Rust launcher is untouched."
- Risks (line 673): "Windows dev builds and `quarto.cmd` users switch from WASM (the silent fallback) to the native plugin with Task 5. ... if a Windows-specific native problem appears, `QUARTO_DENO_DOM=` pointing at a non-existent path restores WASM per process."
- Decisions needed (line 679): "the `quarto.cmd:118` path is fixed (Task 5; it was pre-existing)"


## 06-deps-cliffy-jsr.md

Extracted commands: 53 (a=12, b=21, c=0, d=18, u=2)

| # | line | section | command | class | note |
|---|---|---|---|---|---|
| 1 | 154 | Acceptance criteria | `grep -n 'deno.land/x/cliffy' src/import_map.json` | a | GB |
| 2 | 154 | Acceptance criteria | `grep -rhoE 'from "cliffy/[^"]+"' src package/src tests tools --include=*.ts \| sort -u` | a | GB (sort must be GNU sort; PowerShell/cmd `sort` differs) |
| 3 | 155 | Acceptance criteria | `package/dist/bin/tools/x86_64/deno check --import-map src/import_map.json src/quarto.ts package/src/bld.ts src/command/render/latexmk/quarto-latexmk.ts` | b | D |
| 4 | 156 | Acceptance criteria | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/cli/cli-argv.test.ts unit/core/quarto-command-errors.test.ts unit/core/append-log-options.test.ts` | b | RT |
| 5 | 157 | Acceptance criteria | `package/dist/bin/quarto --help`, `render --help`, `quarto` (no args), `quarto nosuch`, `quarto check --nosuch`, `quarto -V` | b | Q (six invocations in one criterion) |
| 6 | 235 | Task 1 Step 2 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/core/quarto-command-errors.test.ts` | b | RT |
| 7 | 240-242 | Task 1 Step 3 | `git add tests/unit/core/quarto-command-errors.test.ts` / `git commit -m "Pin the Cliffy error and argument contract quarto.ts relies on"` | a | git |
| 8 | 587 | Task 2 Step 4 | `package/dist/bin/quarto run --dev tools/cli-argv-snapshot.ts 1.0.0-rc.3` | b | Q |
| 9 | 588 | Task 2 Step 4 | `grep -c '"argv"' tests/unit/cli/argv-snapshot.json` | a | GB |
| 10 | 589 | Task 2 Step 4 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/cli/cli-argv.test.ts` | b | RT |
| 11 | 597 | Task 2 Step 5 | `mkdir -p /tmp/rt06` | a | GB |
| 12 | 598 | Task 2 Step 5 | `package/dist/bin/quarto dev-call cli-info \| jq -S . > /tmp/rt06/cli-info-rc3.json` | b | Q; jq via scoop |
| 13 | 599-602 | Task 2 Step 5 | `for a in "" "-V" "tools" "call" "dev-call" "check --nosuch" "nosuch"; do echo "== quarto $a"; package/dist/bin/quarto $a > "/tmp/rt06/out-$(echo "$a" \| tr ' ' '_').txt" 2>&1; echo "exit=$?"; done \| tee /tmp/rt06/exits-rc3.txt` | b | Q; bash loop, `$?`, tr (GB); `/tmp` path handed to GB redirect only (fine) |
| 14 | 608-610 | Task 2 Step 6 | `git add tests/unit/cli/cli-argv.ts tests/unit/cli/cli-argv.test.ts tests/unit/cli/argv-snapshot.json tools/cli-argv-snapshot.ts` / `git commit -m "Characterise argv parsing ..."` | a | git |
| 15 | 640 | Task 3 Step 2 | `package/scripts/vendoring/update-lock.sh; git diff --stat deno.lock` | u | UL |
| 16 | 645 | Task 3 Step 3 | `package/dist/bin/tools/x86_64/deno check --import-map src/import_map.json src/quarto.ts src/command/render/latexmk/quarto-latexmk.ts 2>&1 \| grep -E 'TS[0-9]+\|error:' \| sort -u` | b | D; GB grep/sort |
| 17 | 656-658 | Task 3 Step 4 | `git add src/import_map.json deno.lock` / `git commit -m "Resolve cliffy from jsr:@cliffy/* 1.3.1"` | a | git |
| 18 | 735 | Task 4 Step 4 | `package/dist/bin/tools/x86_64/deno check --import-map src/import_map.json src/quarto.ts src/command/render/latexmk/quarto-latexmk.ts package/src/bld.ts && package/dist/bin/tools/x86_64/deno lint src/quarto.ts src/command/render/latexmk/quarto-latexmk.ts src/command/create/cmd.ts` | b | D |
| 19 | 740 | Task 4 Step 5 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/core/append-log-options.test.ts unit/core/quarto-command-errors.test.ts` | b | RT |
| 20 | 748 | Task 4 Step 6 | `package/dist/bin/quarto; echo "exit=$?"` | d | README per-OS table lists Windows for PR 06 ("Task 4 Step 6 ... by hand ... on Windows", line 887); as written Q + bash `$?` |
| 21 | 749 | Task 4 Step 6 | `package/dist/bin/quarto --help \| head -20; echo "exit=$?"` | d | same; note `$?` reports `head`, not quarto |
| 22 | 750 | Task 4 Step 6 | `package/dist/bin/quarto render --help \| head -40` | d | same |
| 23 | 751 | Task 4 Step 6 | `package/dist/bin/quarto help render \| head -5` | d | same |
| 24 | 752 | Task 4 Step 6 | `package/dist/bin/quarto completions bash \| head -3` | d | same |
| 25 | 753 | Task 4 Step 6 | `package/dist/bin/quarto nosuch; echo "exit=$?"` | d | same |
| 26 | 754 | Task 4 Step 6 | `package/dist/bin/quarto render --nosuch; echo "exit=$?"` | d | same |
| 27 | 755 | Task 4 Step 6 | `package/dist/bin/quarto check --nosuch; echo "exit=$?"` | d | same |
| 28 | 756 | Task 4 Step 6 | `package/dist/bin/quarto render tests/docs/minimal.qmd --to html --log-level debug 2>&1 \| head -3` | d | same |
| 29 | 757 | Task 4 Step 6 | `package/dist/bin/quarto tools list` | d | same |
| 30 | 758 | Task 4 Step 6 | `package/dist/bin/quarto --version` | d | same; launcher short-circuits --version (plan line 36), quarto.cmd also does |
| 31 | 766-771 | Task 4 Step 7 | `git add src/quarto.ts src/command/render/latexmk/quarto-latexmk.ts src/command/create/cmd.ts` / `git commit -m "Adapt to @cliffy 1.x exports ..."` | a | git |
| 32 | 781 | Task 5 Step 1 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/cli/cli-argv.test.ts 2>&1 \| tee /tmp/rt06/argv-diff.txt` | b | RT |
| 33 | 794 | Task 5 Step 3 | `package/dist/bin/quarto call engine julia --help \| head -20; echo "exit=$?"` | d | Task 5 listed for by-hand Windows verification (line 887) |
| 34 | 802 | Task 5 Step 4 | `package/dist/bin/quarto dev-call cli-info \| jq -S . > /tmp/rt06/cli-info-131.json` | d | as #33 |
| 35 | 803 | Task 5 Step 4 | `diff -u /tmp/rt06/cli-info-rc3.json /tmp/rt06/cli-info-131.json > /tmp/rt06/cli-info.diff; wc -l /tmp/rt06/cli-info.diff` | d | as #33; diff/wc are GB |
| 36 | 804-806 | Task 5 Step 4 | `for a in "" "-V" "tools" "call" "dev-call" "check --nosuch" "nosuch"; do ... package/dist/bin/quarto $a > "/tmp/rt06/out131-...txt" 2>&1; echo "exit=$?"; done \| tee /tmp/rt06/exits-131.txt` | d | as #33 |
| 37 | 807 | Task 5 Step 4 | `diff /tmp/rt06/exits-rc3.txt /tmp/rt06/exits-131.txt` | d | as #33 |
| 38 | 815 | Task 5 Step 5 | `package/dist/bin/quarto run --dev tools/cli-argv-snapshot.ts 1.3.1` | b | Q |
| 39 | 816 | Task 5 Step 5 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/cli/cli-argv.test.ts` | b | RT |
| 40 | 820-824 | Task 5 Step 5 | `git add tests/unit/cli/argv-snapshot.json` / `git commit -m "Re-baseline the argv characterisation under Cliffy 1.3.1 ..."` | a | git |
| 41 | 834 | Task 6 Step 1 | `cd /tmp && rm -rf rt06p && /home/user/quarto-cli/package/dist/bin/quarto create project` | d | interactive prompts; plan says "Repeat on Windows (`quarto.cmd`; raw stdin differs there)"; hard-coded `/home/user/quarto-cli/...` path does not exist on Windows (must be replaced by worktree path + quarto.cmd) |
| 42 | 837 | Task 6 Step 1 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent $(find smoke/create smoke/use smoke/extensions -name '*.test.ts')` | b | RT; `$(find)` bash-only |
| 43 | 842 | Task 6 Step 2 | `cd package/src && ./quarto-bld --help \| head -20 && ./quarto-bld prepare-dist --set-version $(cat ../../version.txt) && cd ../.. && package/dist/bin/quarto run --dev tools/check-bundle-externals.ts package/pkg-working/bin/quarto.js` | u | extensionless `quarto-bld` bash script; Windows counterpart not verified |
| 44 | 847 | Task 6 Step 3 | `git push -u origin rt/06-deps-cliffy-jsr && gh pr create --draft --fill && gh pr view --json number -q .number` | a | git/gh; note user rules: stop after push and let Chris review before `gh pr create` |
| 45 | 866-869 | Task 6 Step 5 | `git add news/changelog-1.11.md dev-docs/runtime-migration/README.md` / `git commit -m "Changelog: Cliffy 1.3.1"` / `git push` | a | git |
| 46 | 875 | Verification | `rm -rf package/dist/bin/deno_cache && ./configure.sh` | b | configure.sh -> configure.cmd |
| 47 | 876 | Verification | `git status --short` | a | git |
| 48 | 877 | Verification | `package/dist/bin/tools/x86_64/deno check --import-map src/import_map.json src/quarto.ts package/src/bld.ts src/command/render/latexmk/quarto-latexmk.ts` | b | D |
| 49 | 878 | Verification | `package/dist/bin/quarto check` | b | Q |
| 50 | 879-882 | Verification | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/cli/cli-argv.test.ts ... $(find smoke/create smoke/use smoke/extensions smoke/check smoke/inspect smoke/convert smoke/run smoke/logging smoke/env -name '*.test.ts') smoke/render/render-minimal.test.ts smoke/render/render-cli-metadata-file.test.ts` | b | RT; `$(find)`/`\` bash-only |
| 51 | 883 | Verification | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent $(find smoke/typst-gather smoke/axe -name '*.test.ts')` | b | RT; `$(find)` bash-only |
| 52 | 884 | Verification | `package/dist/bin/quarto run --dev tools/check-runtime-boundary.ts` | b | Q |
| 53 | 887 | Verification | "Plus Task 4 Step 6, Task 5 and Task 6 Step 1 by hand on at least one Unix platform and on Windows." | d | explicit Windows manual verification |

### Windows mentions

- Spec > Context (line 36): "The launchers short-circuit `--version` and `-v` (`package/scripts/common/quarto:40-47,112-119`, `quarto.cmd`, `package/launcher/src/main.rs:36-41`), but `-V` reaches Cliffy ..."
- Acceptance criteria (line 159): "`quarto create project` prompts work interactively on Unix and Windows; the `--no-prompt` tests pass."
- Task 6 Step 1 (line 835): "Repeat on Windows (`quarto.cmd`; raw stdin differs there)."
- Verification (line 887): "Plus Task 4 Step 6, Task 5 and Task 6 Step 1 by hand on at least one Unix platform and on Windows."
- Verification (line 889): "On the PR: `Smoke Tests` (Linux and Windows), `Bundle Test` (three OSes), `Test quarto-latexmk` ..."


## 07-remove-puppeteer-and-chromium-tool.md

Extracted commands: 64 (a=19, b=36, c=1, d=0, u=8)

| # | line | section | command | class | note |
|---|---|---|---|---|---|
| 1 | 119 | Acceptance criteria | `rg -n 'puppeteer' src package/src tests tools --type ts -i` | a | rg is cross-platform |
| 2 | 120 | Acceptance criteria | `grep -c 'deno\.land\|skypack\|jspm' src/import_map.json` | a | grep under Git Bash |
| 3 | 122 | Acceptance criteria | `quarto install chromium --no-prompt` and `quarto update tool chromium --no-prompt` | b | quarto -> quarto.cmd |
| 4 | 123 | Acceptance criteria | `quarto check` / `quarto uninstall chromium` with fake `<userDataDir>/quarto/chromium/linux-869685/chrome-linux/` | b | quarto.cmd; fake dir must be under `%LOCALAPPDATA%\quarto` (revision regex accepts `linux-` too) |
| 5 | 125 | Acceptance criteria | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/core/browser-discovery.test.ts unit/tools/chromium-legacy.test.ts` -> `3 passed` | b | run-tests.ps1 |
| 6 | 126 | Acceptance criteria | `quarto run --dev tools/check-runtime-boundary.ts` (after `--update-baseline`) | b | quarto.cmd |
| 7 | 167 | Task 1 / Step 2 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/core/browser-discovery.test.ts` | b | run-tests.ps1 |
| 8 | 231 | Task 1 / Step 5 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/core/browser-discovery.test.ts` | b | run-tests.ps1 |
| 9 | 233 | Task 1 / Step 5 | `package/dist/bin/tools/x86_64/deno check --import-map src/import_map.json src/core/puppeteer.ts src/core/cri/launch.ts src/command/check/check.ts` | b | deno.exe |
| 10 | 234 | Task 1 / Step 5 | `deno check --import-map src/import_map.json src/quarto.ts 2>&1 \| grep -c 'tools/impl/chromium.ts'` | b | deno.exe; `2>&1 \| grep` bash/Git Bash |
| 11 | 239 | Task 1 / Step 6 | `git add src/core/puppeteer.ts ...` ; `git commit -m "Remove the unused puppeteer launch helpers ..."` (multi-line -m, L240) | a | git; multi-line quoted message is bash syntax |
| 12 | 313 | Task 2 / Step 2 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/tools/chromium-legacy.test.ts` | b | run-tests.ps1 |
| 13 | 378 | Task 2 / Step 4 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/tools/chromium-legacy.test.ts` | b | run-tests.ps1 |
| 14 | 384 | Task 2 / Step 5 | `git add src/tools/impl/chromium-legacy.ts tests/unit/tools/chromium-legacy.test.ts` ; `git commit -m "Add detection and removal of an old 'quarto install chromium' download"` (L385) | a | git |
| 15 | 428 | Task 3 / Step 1 | `grep -n isWSL src/tools/tools.ts` | a | grep under Git Bash |
| 16 | 542 | Task 3 / Step 5 | `git rm src/tools/impl/chromium.ts` | a | git |
| 17 | 547 | Task 3 / Step 5 | `package/scripts/vendoring/update-lock.sh` | u | .sh; no .cmd twin named in this plan (Task 6 names vendor.cmd only); Git Bash may work |
| 18 | 552 | Task 3 / Step 6 | `package/dist/bin/tools/x86_64/deno check --import-map src/import_map.json src/quarto.ts && rg -n 'chromiumInstallable\|isDeprecatedTool\|getPuppeteer\|from "puppeteer"' src` | b | deno.exe |
| 19 | 555 | Task 3 / Step 6 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/core/browser-discovery.test.ts ... $(find smoke/check smoke/env -name '*.test.ts')` | b | run-tests.ps1; `$(find ...)` is bash (Git Bash GNU find ok) |
| 20 | 560 | Task 3 / Step 6 | `D="${XDG_DATA_HOME:-$HOME/.local/share}/quarto/chromium/linux-869685/chrome-linux"` | b | plan labels block "Linux"; Windows data dir is `%LOCALAPPDATA%\quarto` (L558), so D must be re-pointed |
| 21 | 561 | Task 3 / Step 6 | `mkdir -p "$D"` | b | same D re-pointing; mkdir -p ok in Git Bash |
| 22 | 562 | Task 3 / Step 6 | `QUARTO_CHROMIUM=/nonexistent package/dist/bin/quarto check install 2>&1 \| grep -A3 'Checking Chrome Headless'` | b | quarto.cmd; inline `VAR=x cmd` is bash-only (use $env:QUARTO_CHROMIUM in PowerShell) |
| 23 | 563 | Task 3 / Step 6 | `package/dist/bin/quarto list tools 2>&1 \| grep -ci chromium` | b | quarto.cmd |
| 24 | 564 | Task 3 / Step 6 | `package/dist/bin/quarto uninstall chromium --no-prompt; test ! -e "${D%/linux-869685/chrome-linux}" && echo removed` | b | quarto.cmd; `test`/`${D%...}` bash-only; D re-pointing |
| 25 | 565 | Task 3 / Step 6 | `package/dist/bin/quarto install chromium --no-prompt 2>&1 \| head -2` | b | quarto.cmd |
| 26 | 572 | Task 3 / Step 7 | `git add src/tools/tools.ts ... deno.lock` ; `git commit -m "Remove the deprecated chromium tool and the puppeteer 9 port ..."` (L573) | a | git |
| 27 | 586 | Task 4 / Step 1 | `package/dist/bin/quarto install chrome-headless-shell --no-prompt` | b | quarto.cmd |
| 28 | 588 | Task 4 / Step 1 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/axe/axe-findings.test.ts` | b | run-tests.ps1 |
| 29 | 589 | Task 4 / Step 1 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent docs/smoke-all/2026/02/12/mermaid-typst.qmd docs/smoke-all/2026/02/12/mermaid-multi-diagram.qmd docs/smoke-all/2023/12/11/4376.qmd` | b | run-tests.ps1; `\` continuation is bash |
| 30 | 591 | Task 4 / Step 1 | `cd package/src && ./quarto-bld prepare-dist --set-version $(cat ../../version.txt) && cd ../..` | u | extensionless quarto-bld (a .cmd twin is likely but not confirmed by the plan); `$(cat)` bash |
| 31 | 592 | Task 4 / Step 1 | `package/dist/bin/quarto run --dev tools/check-bundle-externals.ts package/pkg-working/bin/quarto.js` | b | quarto.cmd |
| 32 | 603 | Task 5 / Step 1 | `git push -u origin rt/07-remove-puppeteer-and-chromium-tool && gh pr create --draft --fill && gh pr view --json number -q .number` | a | git/gh cross-platform |
| 33 | 616 | Task 5 / Step 3 | `git add news/changelog-1.11.md` ; `git commit -m "Changelog: chromium tool removed"` ; `git push` | a | git |
| 34 | 635 | Task 6 / Step 1 | `grep -c 'deno\.land/x\|skypack' src/import_map.json; grep -cE '"(semver\|deno_dom/\|cliffy/command/mod.ts\|yaml)": "(npm\|jsr):' src/import_map.json` | a | grep under Git Bash |
| 35 | 641 | Task 6 / Step 2 | `grep -l 'deno.land/std@0.93.0' tests/smoke/inspect/*.test.ts; grep -n 'vendor_deps' tools/check-test-imports.ts dev-docs/add-typescript-dependency.md package/scripts/vendoring/update-lock.sh` | a | grep + bash glob |
| 36 | 643 | Task 6 / Step 2 | `quarto run --dev tools/check-test-imports.ts` | b | bare `quarto` needs quarto.cmd on PATH |
| 37 | 650 | Task 6 / Step 3 | `D=package/dist/bin/tools/$(uname -m \| sed 's/arm64/aarch64/')/deno` | u | `uname -m` in Git Bash gives x86_64; path lacks `.exe` (Git Bash may still resolve it) |
| 38 | 651 | Task 6 / Step 3 | `T=$(mktemp -d)` | u | Git Bash /tmp; later passed to a Windows deno.exe |
| 39 | 652 | Task 6 / Step 3 | loop `for f in src/quarto.ts src/vendor_deps.ts tests/test-deps.ts ... $(git ls-files 'tests/**/*.test.ts' 'tools/*.ts') ...; do echo "import \"file://$PWD/$f\";"; done` (L652-659; echo at L657) | c | `$PWD` in Git Bash is `/c/Users/...`, giving `file:///c/Users/...` which is not a valid Windows file URL for Deno; needs `file:///C:/...` |
| 40 | 660 | Task 6 / Step 3 | `"$D" info --json --import-map src/import_map.json "$T/entrypoints.ts" > "$T/info.json"` | u | deno.exe; depends on row 39 URLs and network |
| 41 | 661 | Task 6 / Step 3 | `"$D" eval --no-config '...JSON.parse(Deno.readTextFileSync(Deno.args[0]))...' "$T/info.json"` (L661-670) | u | single-quoted multi-line JS in bash; `/tmp/...` arg path conversion by MSYS unverified |
| 42 | 691 | Task 6 / Step 4 | `package/dist/bin/tools/x86_64/deno eval 'JSON.parse(Deno.readTextFileSync("src/import_map.json")); console.log("valid")'` | b | deno.exe; quoting is bash-style (PowerShell would strip inner quotes) |
| 43 | 695 | Task 6 / Step 5 | `git rm src/vendor_deps.ts` | a | git |
| 44 | 700 | Task 6 / Step 6 | `git rm src/dev_import_map.json src/import_map_additional_entries.json package/src/common/create-dev-import-map.ts` | a | git |
| 45 | 700 | Task 6 / Step 6 | `rg -n 'dev_import_map\|import_map_additional_entries\|create-dev-import-map' --hidden -g '!dev-docs/runtime-migration/**' .` | a | rg |
| 46 | 718 | Task 6 / Step 6 | `cd tests && ./run-parallel-tests.sh -n=2 --dry-run \| head -5` | u | .sh; no .ps1/.cmd twin named; Git Bash behavior unknown |
| 47 | 725 | Task 6 / Step 7 | `rg -n 'deno\.land\|skypack\|jspm' src package tests tools -g '!src/resources/deno_std/**' ... -g '!src/publish/confluence/confluence-helper.ts'` (L725-732) | a | rg with `\` continuations (bash) |
| 48 | 733 | Task 6 / Step 7 | `echo "exit=$?"` | a | bash `$?` (Git Bash assumed); PowerShell has no direct equivalent (`$LASTEXITCODE`) |
| 49 | 741 | Task 6 / Step 8 | `package/scripts/vendoring/update-lock.sh` | u | same as row 17 |
| 50 | 742 | Task 6 / Step 8 | `rm -rf package/dist/bin/deno_cache && ./configure.sh && git status --short` | b | ./configure.sh -> configure.cmd; rm -rf ok in Git Bash |
| 51 | 743 | Task 6 / Step 8 | `package/dist/bin/tools/x86_64/deno check --import-map src/import_map.json src/quarto.ts package/src/bld.ts` | b | deno.exe |
| 52 | 744 | Task 6 / Step 8 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent $(find smoke/inspect smoke/check -name '*.test.ts') unit/tools/check-runtime-boundary.test.ts` | b | run-tests.ps1; `$(find)` |
| 53 | 745 | Task 6 / Step 8 | `cd .. && package/dist/bin/quarto run --dev tools/check-runtime-boundary.ts --update-baseline && git diff tools/runtime-boundary-baseline.json` | b | quarto.cmd |
| 54 | 752 | Task 6 / Step 9 | `git add -A src/import_map.json deno.lock tests/smoke/inspect package/scripts/vendoring ...` (L752-755) ; `git commit -m "Phase 0 exit: ..."` (L756) | a | git |
| 55 | 768 | Task 7 / Step 1 | `git add dev-docs/runtime-migration/README.md` ; `git commit -m "runtime-migration: PR 07 in progress"` | a | git |
| 56 | 775 | Verification | `rm -rf package/dist/bin/deno_cache && ./configure.sh` | b | configure.cmd |
| 57 | 776 | Verification | `git status --short` | a | git |
| 58 | 777 | Verification | `package/dist/bin/tools/x86_64/deno check --import-map src/import_map.json src/quarto.ts package/src/bld.ts` | b | deno.exe |
| 59 | 778 | Verification | `package/dist/bin/quarto install chrome-headless-shell --no-prompt` | b | quarto.cmd |
| 60 | 779 | Verification | `package/dist/bin/quarto check` | b | quarto.cmd |
| 61 | 780 | Verification | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/core/browser-discovery.test.ts ... $(find smoke/check smoke/env smoke/inspect -name '*.test.ts') smoke/axe/axe-findings.test.ts` (L780-783) | b | run-tests.ps1; `$(find)` |
| 62 | 784 | Verification | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent docs/smoke-all/2026/02/12/mermaid-typst.qmd ... docs/smoke-all/2023/12/11/4376.qmd` (L784-786) | b | run-tests.ps1 |
| 63 | 787 | Verification | `package/dist/bin/quarto install chromium --no-prompt 2>&1 \| head -2` | b | quarto.cmd |
| 64 | 788 | Verification | `package/dist/bin/quarto run --dev tools/check-runtime-boundary.ts` | b | quarto.cmd |

### Windows mentions

- L30 (Context): "puppeteer 9 stored downloads under `quartoDataDir("chromium")` as `<linux|mac|win32|win64>-<revision>/<archive>/<executable>`." (win32/win64 are directory-name tokens; the line is long, trimmed)
- L81 (Interfaces, chromium-legacy.ts doc comment): "True when `dir` holds at least one `<linux|mac|win32|win64>-<digits>` directory (one downloaded revision)."
- L110 (Files): "Modify (Task 6): `package/scripts/vendoring/vendor.sh`, `vendor.cmd`, `.github/workflows/actions/quarto-dev/action.yml:19`, ..."
- L326 (Task 2 / Step 3 code): " * <linux|mac|win32|win64>-<revision>/. The tool is removed; Quarto only"
- L340 (Task 2 / Step 3 code): "const kRevisionDirRe = /^(linux|mac|win32|win64)-\d+$/;"
- L558 (Task 3 / Step 6): "Run (Linux; on macOS the data dir is `~/Library/Application Support/quarto`, on Windows `%LOCALAPPDATA%\quarto`):"
- L629 (Task 6 Files): "Modify: `package/scripts/vendoring/vendor.sh`, `package/scripts/vendoring/vendor.cmd`, ..."
- L696 (Task 6 / Step 5): "In `package/scripts/vendoring/vendor.sh` and `vendor.cmd` remove `vendor_deps.ts` from the `--entrypoint` list (PR 00b's single `deno install` call)."
- (no hit text, relevant) L304 test body `assertEquals(legacyChromiumDir().replaceAll("\\", "/").endsWith("quarto/chromium"), true);` handles Windows separators; L709 `tests/README.md:369` edit contains a literal `C:\Users\chris\...` path.


## 08-ral-process.md

Extracted commands: 96 (a=33, b=29, c=5, d=3, u=26)

| # | line | section | command | class | note |
|---|---|---|---|---|---|
| 1 | 222 | Acceptance criteria | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/process.test.ts` -> `ok \| 17 passed \| 0 failed` | b | run-tests.ps1; plan itself says POSIX-only cases return early on Windows |
| 2 | 226 | Acceptance criteria | `rg -n '\bDeno\.(Command\|run\|exit\|cwd\|...)\b' src -g '*.ts' -g '!src/deno_ral/**' ... \| rg -v '^[^:]+:[0-9]+:\s*(//\|/\*\|\*)'` (L226-228) | a | rg pipe; bash `\` continuation |
| 3 | 231 | Acceptance criteria | `rg -n 'Deno\.run\(\|new Deno\.Command' package/src -g '*.ts'` | a | rg |
| 4 | 232 | Acceptance criteria | `cd src && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --unstable-ffi --import-map=import_map.json quarto.ts` | b | deno.exe |
| 5 | 233 | Acceptance criteria | `quarto run --dev tools/check-runtime-boundary.ts` | b | quarto.cmd |
| 6 | 245 | Plan preamble | `add_import() { sed -i "0,/^import /{s\|^import \|$2\nimport \|}" "$1"; }` | u | GNU sed `0,/re/` + `\n` in replacement; Git Bash sed is GNU but CRLF checkouts may get mixed line endings; macOS note `gsed` |
| 7 | 254 | Task 0 / Step 1 | `package/dist/bin/tools/x86_64/deno types \| grep -n -A3 'detached?: boolean'` | b | deno.exe |
| 8 | 305 | Task 1 / Step 1 (test code) | `shell()` helper: `isWindows ? ["cmd", ["/c", script]] : ["sh", ["-c", script]]` | u | cmd /c quoting of args by Deno unverified; test-file content, not a command the executor types |
| 9 | 331 | Task 1 / Step 1 (test code) | `shell("echo out & echo err 1>&2")` on Windows | u | cmd /c with `&`; unverified |
| 10 | 341 | Task 1 / Step 1 (test code) | `shell("exit 3")` | u | cmd /c exit 3 |
| 11 | 347 | Task 1 / Step 1 (test code) | `exec("quarto-no-such-binary-7f3a", { args: ["--version"] })` | u | relies on Deno.errors.NotFound on Windows for missing exe |
| 12 | 358 | Task 1 / Step 1 (test code) | `shell("exit 0")` with `stdout: "inherit", stderr: "null"` | u | cmd /c |
| 13 | 365 | Task 1 / Step 1 (test code) | `shell("echo sync")` via `execSync` | u | cmd /c |
| 14 | 372 | Task 1 / Step 1 (test code) | `shell("echo %QUARTO_RAL_TEST%")` with `env: { QUARTO_RAL_TEST: "hello-ral" }` | u | cmd /c env expansion |
| 15 | 378 | Task 1 / Step 1 (test code) | `shell("echo %PATH%")` (merge case) | u | cmd /c; `%PATH%` expansion |
| 16 | 387 | Task 1 / Step 1 (test code) | `exec("/bin/sh", { args: ["-c", 'echo "${HOME:-unset}"'], clearEnv: true })` | a | returns early on Windows (L386 `if (isWindows) return;`) |
| 17 | 394 | Task 1 / Step 1 (test code) | `shell("cd")` with `cwd: dir` (basename comparison) | u | cmd `cd` prints cwd; 8.3/short-path differences possible |
| 18 | 401 | Task 1 / Step 1 (test code) | `["cmd", ["/c", "more"]]` spawn with piped stdin/stdout | u | `more` as cat replacement; unverified |
| 19 | 416 | Task 1 / Step 1 (test code) | `["cmd", ["/c", "ping -n 30 127.0.0.1 > NUL"]]` then `child.kill("SIGTERM")` | u | SIGTERM semantics via Deno on Windows and orphaned ping child unverified |
| 20 | 427 | Task 1 / Step 1 (test code) | `spawn("sh", { args: ["-c", "sleep 30 & echo $!; wait"], detached: true })` | a | returns early on Windows (L426) |
| 21 | 448 | Task 1 / Step 1 (test code) | `exec("ps", { args: ["-o", "stat=", "-p", String(grandchild)] })` | a | only reached on POSIX (after early return) |
| 22 | 474 | Task 1 / Step 1 (test code) | `exec(s.cmd, { args: s.args })` where cmd=`execPath()` args=`run --no-config --allow-all <script>` (1 MiB write then `exit(3)`) | u | pipe size/BrokenPipe behavior on Windows unverified |
| 23 | 485 | Task 1 / Step 1 (test code) | `spawn(s.cmd, ...)` with `reader.cancel()` (`\| head -c 1` case) | u | Windows broken-pipe error shape unverified |
| 24 | 515 | Task 1 / Step 1 (test code) | `spawn(s.cmd, ...)` stdin piped, `readStdinLines` early break | u | Deno.stdin.close() release on Windows unverified |
| 25 | 538 | Task 1 / Step 2 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/process.test.ts` | b | run-tests.ps1 |
| 26 | 765 | Task 1 / Step 3 (code) | `new Deno.Command("taskkill", { args: ["/PID", String(-pid), "/T", "/F"], ... }).outputSync()` ; `if (r.code === 128) throw ... "ESRCH"` | u | the layer's own Windows tree kill; exit 128 on missing pid is asserted by the comment, unverified |
| 27 | 865 | Task 1 / Step 4 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/process.test.ts` -> `ok \| 17 passed \| 0 failed` | b | run-tests.ps1 |
| 28 | 873 | Task 1 / Step 5 | `git add src/deno_ral/process.ts tests/unit/ral/process.test.ts` ; `git commit -m "deno_ral/process: spawn/exec interface with contract test"` | a | git |
| 29 | 885 | Task 2 / Step 1 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/exec-process-stdin.test.ts` -> `4 passed` (3 on Windows) | b | run-tests.ps1; plan says Windows expects 3 |
| 30 | 1031 | Task 2 / Step 3 | `cd src && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --unstable-ffi --import-map=import_map.json quarto.ts` | b | deno.exe |
| 31 | 1034 | Task 2 / Step 3 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/exec-process-stdin.test.ts unit/ral/process.test.ts` -> `21 passed` | b | run-tests.ps1 |
| 32 | 1040 | Task 2 / Step 4 | `git add src/core/process.ts` ; `git commit -m "core/process: implement execProcess on deno_ral spawn"` | a | git |
| 33 | 1054 | Task 3 / Step 1 (code) | `exec(configureScript[0], { args: configureScript.slice(1), cwd: quartoDir })` (runs `./configure.sh` / `configure.cmd`, L25) | u | `.cmd` via Deno.Command on Windows; code the PR writes, not a command to run |
| 34 | 1068 | Task 3 / Step 2 (code) | `exec(execPath(), { args: ["fmt", source] })` | a | deno.exe via execPath; code the PR writes |
| 35 | 1077 | Task 3 / Step 3 (code) | `spawn(app, { args, stdout: "null", stderr: "piped" })` (Chrome) | a | same as before on Windows; code the PR writes |
| 36 | 1110 | Task 3 / Step 5 (code) | `spawn(cmd[0], { ..., detached: !isWindows })` (external preview server) | u | Windows path relies on layer taskkill (row 26); code the PR writes |
| 37 | 1165 | Task 3 / Step 6 (code) | `exec(execPath(), { args: ["check", file, "-c", ..., "--importmap=..."], stderr: "piped" })` | a | deno.exe; code the PR writes |
| 38 | 1185 | Task 3 / Step 7 (code) | `spawn("tail", { args: ["-F", "-n", "0", kernelLogFile()] })` | c | `tail` is not a Windows binary (Git Bash only); debug-mode only per L31; code the PR writes |
| 39 | 1197 | Task 3 / Step 8 (code) | `exec(typstGatherBinary, { args: ["gather", tomlPath], cwd: quartoRoot, stdout: "inherit", stderr: "inherit" })` | a | same as before; code the PR writes |
| 40 | 1214 | Task 3 / Step 9 | `cd src && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --unstable-ffi --import-map=import_map.json quarto.ts` | b | deno.exe |
| 41 | 1217 | Task 3 / Step 9 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/chrome-launch.test.ts unit/chrome-launch-flags.test.ts smoke/typst-gather/typst-gather.test.ts smoke/ojs/dependency-traversal.test.ts smoke/jupyter/issue-10097.test.ts` | b | run-tests.ps1 |
| 42 | 1223 | Task 3 / Step 10 | `git add src/core/devconfig.ts ... src/command/dev-call/typst-gather/cmd.ts` ; `git commit -m "Route direct Deno.Command sites through deno_ral/process"` (L1224) | a | git |
| 43 | 1235 | Task 4 / Step 1 | `for f in src/core/path.ts src/core/mapped-text.ts src/core/bibliography.ts; do add_import "$f" '...'; sed -i 's/Deno\.cwd()/cwd()/g' "$f"; done` (L1235-1238) | u | bash loop + GNU sed -i; CRLF handling unverified |
| 44 | 1239 | Task 4 / Step 1 | `for f in src/core/jupyter/jupyter-shared.ts ... src/core/schema/validated-yaml.ts; do add_import "$f" '...'; sed -i 's/Deno\.cwd()/cwd()/g' "$f"; done` (L1239-1242) | u | same as row 43 |
| 45 | 1276 | Task 4 / Step 6 | `grep -n 'readAllSync\|writeAllSync' src/core/console.ts` | a | grep |
| 46 | 1288 | Task 4 / Step 7 | `rg -n '\bDeno\.(exit\|cwd\|args\|addSignalListener\|stdin\|stdout\|stderr)\b' src/core -g '*.ts' \| rg -v '^[^:]+:[0-9]+:\s*(//\|/\*\|\*)'` | a | rg |
| 47 | 1291 | Task 4 / Step 7 | `cd src && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --unstable-ffi --import-map=import_map.json quarto.ts` | b | deno.exe |
| 48 | 1294 | Task 4 / Step 7 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/path.test.ts unit/environment.test.ts unit/core/append-log-options.test.ts $(find smoke/logging/ -name '*.test.ts')` | b | run-tests.ps1; `$(find)` |
| 49 | 1298 | Task 4 / Step 7 | `git add src/core` ; `git commit -m "core: exit/cwd/args/signals/stdio through deno_ral/process"` | a | git |
| 50 | 1316 | Task 5 / Step 1 | `for f in src/command/call/cmd.ts ... src/command/call/typst-gather/cmd.ts; do sed -i 's/Deno\.exit(/exit(/g' "$f"; done` (L1316-1318) | u | bash loop + GNU sed -i |
| 51 | 1319 | Task 5 / Step 1 | `sed -i 's/Deno\.cwd()/currentDir()/g' src/command/call/build-ts-extension/cmd.ts src/command/call/typst-gather/cmd.ts` | u | GNU sed -i |
| 52 | 1333 | Task 5 / Step 2 | `sed -i 's/Deno\.cwd()/cwd()/g' FILE` (per file in the L1326-1331 table) | u | GNU sed -i, per-file repetition |
| 53 | 1365 | Task 5 / Step 5 | `rg -n '\bDeno\.(exit\|cwd\|args\|execPath\|stdin\|stdout\|stderr\|CommandOptions)\b' src/command -g '*.ts' -g '!src/command/render/latexmk/quarto-latexmk.ts' \| rg -v '...'` | a | rg |
| 54 | 1368 | Task 5 / Step 5 | `cd src && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --unstable-ffi --import-map=import_map.json quarto.ts` | b | deno.exe |
| 55 | 1371 | Task 5 / Step 5 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/create/create.test.ts smoke/inspect/inspect-project.test.ts smoke/check/check.test.ts $(find smoke/build-ts-extension/ -name '*.test.ts') smoke/use/template.test.ts smoke/render/render-html.test.ts $(find unit/render/ -name '*.test.ts')` | b | run-tests.ps1; `$(find)` |
| 56 | 1374 | Task 5 / Step 5 (Manual) | `echo '{"type":"project","directive":{"type":"default"},"directory":"'$(mktemp -d)'/p"}' \| package/dist/bin/quarto create --json` | c | Git Bash `/tmp/...` from mktemp is read by the Windows binary as `C:\tmp\...` (not %TEMP%); also quarto.cmd and bash-only quoting |
| 57 | 1374 | Task 5 / Step 5 (Manual) | `package/dist/bin/quarto capabilities \| head -3` | b | quarto.cmd |
| 58 | 1377 | Task 5 / Step 5 | `git add src/command` ; `git commit -m "command: exit/cwd/args/execPath/stdio through deno_ral/process"` | a | git |
| 59 | 1399 | Task 6 / Step 2 | `rg -n '\bDeno\.(exit\|cwd\|pid\|kill\|stdin\|stdout\|stderr)\b' src/project src/format src/execute src/extension src/inspect src/tools src/preview -g '*.ts' \| rg -v '...'` | a | rg |
| 60 | 1402 | Task 6 / Step 2 | `cd src && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --unstable-ffi --import-map=import_map.json quarto.ts` | b | deno.exe |
| 61 | 1405 | Task 6 / Step 2 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent $(find unit/project/ ...) $(find unit/extension/ ...) $(find unit/tools/ ...) smoke/project/project-simple.test.ts smoke/site/render-site.test.ts smoke/extensions/install.test.ts smoke/render/render-jupyter.test.ts` | b | run-tests.ps1; `$(find)`; render-jupyter needs Python env (plan: fallback issue-10097) |
| 62 | 1409 | Task 6 / Step 2 | `git add src/project src/format src/execute src/extension src/inspect src/tools` ; `git commit -m "project/format/execute/extension/tools: process calls through deno_ral/process"` | a | git |
| 63 | 1422 | Task 7 / Step 1 | `sed -i 's/Deno\.exit(/exit(/g' src/quarto.ts` | u | GNU sed -i |
| 64 | 1426 | Task 7 / Step 2 | `package/dist/bin/quarto --version && package/dist/bin/quarto pandoc --version \| head -1 && package/dist/bin/quarto typst --version` | b | quarto.cmd |
| 65 | 1429 | Task 7 / Step 2 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/run/command-passthrough.test.ts smoke/run/run-script.test.ts` | b | run-tests.ps1 |
| 66 | 1435 | Task 7 / Step 3 | `git add src/quarto.ts` ; `git commit -m "quarto.ts: exit/args through deno_ral/process"` | a | git |
| 67 | 1441 | Task 8 (intro) | `grep -rn 'Deno\.run(\|new Deno\.Command' package/src --include=*.ts` | a | grep |
| 68 | 1506 | Task 8 / Step 2 (code) | `execSync(execPath(), { args: ["run","--no-config","-A","build.ts"], cwd: ..., env: ... })` | a | deno.exe via execPath; code the PR writes |
| 69 | 1523 | Task 8 / Step 3 (code) | `exec(tarCmd[0], { args: tarCmd.slice(1), stdout: "inherit", stderr: "inherit" })` (tar.ts L95) | c | `tar` on Windows: bare tar may resolve to GNU tar (Git Bash PATH) and .zip fails; code the PR writes |
| 70 | 1533 | Task 8 / Step 3 (code) | `exec(tarCmd[0], { args: tarCmd.slice(1), cwd, ... })` (tar.ts L119) | c | same as row 69 |
| 71 | 1548 | Task 8 / Step 4 (code) | `exec(gitCmd[0], { args: gitCmd.slice(1), cwd: dir, ... })` (git checkout) | a | git; code the PR writes |
| 72 | 1562 | Task 8 / Step 4 (code) | `exec(gitCmd[0], { ..., cwd: workingDir, stdout: "inherit", stderr: "piped" })` (git clone) | a | git; code the PR writes |
| 73 | 1581 | Task 8 / Step 4 (code) | `exec(gitCmd[0], { args: gitCmd.slice(1), ... })` (git apply) | a | git; code the PR writes |
| 74 | 1596 | Task 8 / Step 5 (code) | `execSync("ln", { args: ["-s", linkTarget, "pandoc"], cwd: targetDir, ... })` | u | `ln -s` is POSIX; whether this configure.ts branch runs on Windows is not stated |
| 75 | 1608 | Task 8 / Step 6 (code) | `exec(denoBinary, { args: ["info", args()[0], "--json"], stderr: "inherit" })` | a | deno; code the PR writes |
| 76 | 1619 | Task 8 / Step 6 (code) | `exec("quarto", { args: ["preview", filename], stdin: "inherit", ... })` (explain-all-cycles/explain-import-chain) | c | bare "quarto" with Deno.Command will not find quarto.cmd on Windows (needs explicit extension); code the PR writes |
| 77 | 1630 | Task 8 / Step 6 (code) | `exec(denoBinary, { args: ["run","--allow-read",...,"--simplify","--toon", cyclesFile] })` | a | deno; code the PR writes |
| 78 | 1658 | Task 8 / Step 6 (code) | `exec("rg", { args: ["-l", "export const"] })` | a | rg must be on PATH; code the PR writes |
| 79 | 1671 | Task 8 / Step 7 | `grep -rn 'Deno\.run(\|new Deno\.Command\|Deno\.CommandStatus' package/src --include=*.ts` | a | grep |
| 80 | 1674 | Task 8 / Step 7 | `package/dist/bin/tools/x86_64/deno check --unstable-kv --unstable-ffi --import-map=src/import_map.json package/src/bld.ts package/src/common/import-report/report-risky-files.ts ...` | b | deno.exe |
| 81 | 1677 | Task 8 / Step 7 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/tar-command.test.ts unit/macos-notarize-status.test.ts` | b | run-tests.ps1 |
| 82 | 1680 | Task 8 / Step 7 | `package/src/quarto-bld prepare-dist --help` | u | extensionless quarto-bld; a .cmd twin is likely but not confirmed |
| 83 | 1684 | Task 8 / Step 7 | `git add package/src` ; `git commit -m "package/src: Deno.run and Deno.Command through deno_ral/process"` | a | git |
| 84 | 1703 | Task 9 / Step 2 | `quarto run --dev tools/check-runtime-boundary.ts --update-baseline && quarto run --dev tools/check-runtime-boundary.ts` | b | quarto.cmd |
| 85 | 1704 | Task 9 / Step 2 | `git diff tools/runtime-boundary-baseline.json` | a | git |
| 86 | 1719 | Task 9 / Step 4 | `git add news/changelog-1.11.md tools/runtime-boundary-baseline.json .claude/rules/typescript/deno-ral.md` ; `git commit -m "Changelog, rules doc and lower runtime boundary baseline after process layer"` | a | git |
| 87 | 1725 | Verification | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/process.test.ts` -> `ok \| 17 passed \| 0 failed` | b | run-tests.ps1 |
| 88 | 1726 | Verification | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/exec-process-stdin.test.ts unit/chrome-launch.test.ts ... $(find unit/project/ ...) $(find unit/render/ ...) $(find unit/tools/ ...) unit/tar-command.test.ts $(find unit/ral/ ...)` | b | run-tests.ps1; `$(find)` |
| 89 | 1727 | Verification | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/render/render-html.test.ts smoke/render/render-typst-package-staging.test.ts smoke/jupyter/issue-10097.test.ts smoke/create/create.test.ts $(find smoke/inspect/ ...) smoke/check/check.test.ts $(find smoke/typst-gather/ ...) $(find smoke/run/ ...) smoke/project/project-simple.test.ts smoke/site/render-site.test.ts smoke/ojs/dependency-traversal.test.ts $(find smoke/build-ts-extension/ ...)` | b | run-tests.ps1; many `$(find)` |
| 90 | 1728 | Verification | `cd src && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --unstable-ffi --import-map=import_map.json quarto.ts` | b | deno.exe |
| 91 | 1729 | Verification | `quarto run --dev tools/check-runtime-boundary.ts` | b | quarto.cmd |
| 92 | 1730 | Verification | "The acceptance `rg` -> empty" (re-run of row 2) | a | rg |
| 93 | 1731 | Verification (Manual) | `package/dist/bin/quarto preview tests/docs/test.qmd` then Ctrl-C; check no orphan `pandoc`/`deno` processes in `ps` | d | README lists Windows for PR 08 (row content not seen by me); `ps` is POSIX |
| 94 | 1732 | Verification (Manual) | `package/dist/bin/quarto preview <doc>.qmd`, Ctrl-C; `ps -ef \| grep -c '[u]vicorn'` -> 0 ; Windows: `tasklist \| findstr python` | d | plan names the Windows variant itself; README lists Windows for PR 08 |
| 95 | 1733 | Verification (Manual) | `package/dist/bin/quarto inspect tests/docs/test.qmd \| head -c 1; echo " exit=$?"` | d | README lists Windows for PR 08; bash `$?`/`head` |
| 96 | 1734 | Verification (Manual) | `package/dist/bin/quarto render` of a document with a `{mermaid}` cell to `pdf` or `docx`; `quarto check` | b | quarto.cmd; needs Chrome |

### Windows mentions

(Grep hits at L474, 485, 515, 951, 954, 975, 979 are false positives: `s.cmd`, `options.cmd`, `kWindowSize`; not listed.)

- L18 (Context): "...The new type drops the other `Deno.CommandOptions` fields (`uid`, `gid`, `windowsRawArguments`, `ref`, numeric stdio): no caller in the tree passes them..."
- L25 (inventory row 2): "`src/core/devconfig.ts:142` | runs `./configure.sh` / `configure.cmd`, output discarded | `exec`"
- L29 (inventory row 6): "... `spawn` with `detached: true` on POSIX + `killProcess(-pid)`; Windows tree kill with `taskkill /T`"
- L57 (Process-level behaviours, Process groups): "On Windows there are no process groups to signal; `killProcess(-pid)` ends the tree rooted at `-pid` with `taskkill /PID <pid> /T /F` (which walks parent pids, so it does not need `detached`), and `preview-server.ts` calls the same `killProcess(-pid)` on every OS. The Windows branch lives in the layer ... PR 14b's `tests/unit/process-group.test.ts` covers it on Windows CI (its Windows case; review R10)." (long line, trimmed)
- L104 / L573 (SpawnOptions doc): "Windows: the runtime's detached semantics (Node: DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP); Quarto passes it on POSIX only."
- L151 / L743 (onSignal doc): "\"SIGTERM\" is a no-op on Windows (Deno rejects it there); \"SIGINT\" works on every platform."
- L162 / L759 (killProcess doc): "and, on Windows, the process tree rooted at -pid (`taskkill /PID <-pid> /T /F`, the signal is ignored); throws an Error with code \"ESRCH\" when that tree is gone."
- L222 (Acceptance criteria): "(on Windows the POSIX-only cases return early and count as passed)."
- L284 / L556 / L1096: `import { isWindows } from ...` lines (import statements only).
- L305: `return isWindows ? ["cmd", ["/c", script]] : ["sh", ["-c", script]];`
- L331, L372, L378, L394, L401, L415-416: `isWindows ? ...` branches using `cmd /c`, `%QUARTO_RAL_TEST%`, `%PATH%`, `cd`, `more`, `ping -n 30 127.0.0.1 > NUL`.
- L386: `if (isWindows) return; // cmd.exe needs SystemRoot; the semantics are tested on POSIX only`
- L422: `if (!isWindows) assertEquals(status.signal, "SIGTERM");`
- L426: `if (isWindows) return; // process groups are POSIX; the Windows tree kill (taskkill /T) is PR 14b's process-group.test.ts`
- L750: `if (signal === "SIGTERM" && isWindows) {`
- L762-765, L771: `if (isWindows && pid < 0) {` ... `// No process groups to signal: end the tree rooted at -pid. taskkill` ... `new Deno.Command("taskkill", {` ... `throw Object.assign(new Error(\`taskkill: no process ${-pid}\`), {`
- L886 (Task 2 / Step 1): "Expected: `ok | 4 passed | 0 failed` (3 on Windows, where the tests return early)."
- L1116: `detached: !isWindows,`
- L1146-1147 (preview-server code comment): "// POSIX: SIGTERM to the group the child leads. Windows: the layer runs // taskkill /T on the tree rooted at the child (no groups to signal)."
- L1158: "...PR 14b's `tests/unit/process-group.test.ts` exercises this path end to end: the group kill on POSIX, the `taskkill /T` tree kill on Windows."
- L1251: "Replace the `isWindows` import (line 19) with `import { args as processArgs, onSignal } ...` (`isWindows` has no other use in the file)."
- L1254: "// install termination signal handlers (SIGTERM is a no-op on Windows,"
- L1698 (changelog text): "Other Deno-specific options (`uid`, `gid`, `windowsRawArguments`, numeric stdio) were never part of the declared API and are now ignored."
- L1732: "On Windows the same check with `tasklist | findstr python` after Ctrl-C prints nothing."
- L1741 (Review checklist): "`detached` reaches `Deno.Command`; `preview-server.ts` passes `detached: !isWindows` and stops with `killProcess(-pid)` on POSIX, `taskkill /T` on Windows."
- L1770: "Windows tree kill: `killProcess(-pid)` runs `taskkill /T`, and only the external preview server calls it; Chrome's helper processes exit with the browser process. Not changed for `cri/launch.ts` because no orphan has been observed there."

### Windows mentions added by grep sweep at assembly
Lines matching `windows|win32|.cmd|.ps1|taskkill` (case-insensitive) that the extractor's list above did not cite. Quoted verbatim, trimmed to 300 characters; section is the nearest preceding heading.

- L474 (Task 1: `src/deno_ral/process.ts` with its unit test): "const r = await exec(s.cmd, { args: s.args });"
- L485 (Task 1: `src/deno_ral/process.ts` with its unit test): "const child = spawn(s.cmd, {"
- L515 (Task 1: `src/deno_ral/process.ts` with its unit test): "const child = spawn(s.cmd, {"
- L758 (Task 1: `src/deno_ral/process.ts` with its unit test): "* by -pid (POSIX; spawn the leader with `detached: true`) or, on Windows, the"
- L951 (Task 2: `execProcess` on `spawn`): "debug(`[execProcess] ${[options.cmd, ...(options.args || [])].join(" ")}`);"
- L954 (Task 2: `execProcess` on `spawn`): "const process = spawn(options.cmd, {"
- L975 (Task 2: `execProcess` on `spawn`): "const kWindowSize = 4096;"
- L979 (Task 2: `execProcess` on `spawn`): "const end = Math.min(offset + kWindowSize, buffer.length);"
- L1093 (Task 3: the direct `Deno.Command` sites in `src/`): "Replace the import of `isWindows` (line 8) with:"

## 09-ral-fs-and-temp-layer.md

Extracted commands: 54 (a=19, b=30, c=0, d=0, u=5)

| # | line | section | command | class | note |
|---|---|---|---|---|---|
| 1 | 144 | Spec > Interfaces > tools/codemod-deno-ral.ts | `quarto run --dev tools/codemod-deno-ral.ts --rules <r1,r2> (--dir <d> \| --file <f>)... [--dry-run] [--reverse] [--ral-dir <path>]` | (b) | quarto -> quarto.cmd (usage line; `--ral-dir` is an absolute path) |
| 2 | 207 | Spec > Acceptance criteria | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent $(find unit/ral/ -name '*.test.ts')` | (b) | run-tests.sh needs DENO_DIR=x86_64 under Git Bash, or run-tests.ps1; env prefix + `$(find)` are bash-only |
| 3 | 208 | Spec > Acceptance criteria | `package/dist/bin/tools/x86_64/deno test --allow-all --import-map=src/import_map.json tools/codemod/` | (b) | deno.exe when not in Git Bash |
| 4 | 209 | Spec > Acceptance criteria | `quarto run --dev tools/codemod-deno-ral.ts --rules fs,temp --dir src/core --dry-run` | (b) | quarto.cmd |
| 5 | 209 | Spec > Acceptance criteria | `git status --short src` | (a) | git |
| 6 | 210 | Spec > Acceptance criteria | `quarto run --dev tools/check-runtime-boundary.ts` | (b) | quarto.cmd |
| 7 | 211 | Spec > Acceptance criteria | `cd src && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --unstable-ffi --import-map=import_map.json quarto.ts` | (b) | deno.exe outside Git Bash |
| 8 | 215 | Plan (preamble) | `./configure.sh` | (b) | configure.cmd |
| 9 | 314 | Task 1 Step 2 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/errors.test.ts` | (b) | run-tests.ps1 / DENO_DIR=x86_64; expects "Module not found" failure |
| 10 | 424 | Task 1 Step 4 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/errors.test.ts` | (b) | same as #9 |
| 11 | 430-431 | Task 1 Step 5 | `git add src/deno_ral/errors.ts tests/unit/ral/errors.test.ts` / `git commit -m "deno_ral/errors: runtime-neutral error predicates"` | (a) | git |
| 12 | 557 | Task 2 Step 2 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/temp.test.ts` | (b) | as #9 |
| 13 | 639 | Task 2 Step 4 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/temp.test.ts` | (b) | as #9 |
| 14 | 645-646 | Task 2 Step 5 | `git add src/deno_ral/temp.ts tests/unit/ral/temp.test.ts` / `git commit -m "deno_ral/temp: makeTemp* retrying on AlreadyExists only"` | (a) | git |
| 15 | 864 | Task 3 Step 2 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/fs.test.ts` | (b) | as #9 |
| 16 | 1192 | Task 3 Step 4 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/fs.test.ts $(find unit/ral/ -name '*.test.ts')` | (b) | as #9; the new fs test has Windows-skipped symlink/chmod cases (lines 753, 805, 819, 839) |
| 17 | 1195 | Task 3 Step 4 | `cd src && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --unstable-ffi --import-map=import_map.json quarto.ts` | (b) | as #7 |
| 18 | 1201-1202 | Task 3 Step 5 | `git add src/deno_ral/fs.ts tests/unit/ral/fs.test.ts` / `git commit -m "deno_ral/fs: plain filesystem calls, canonicalPathSync, layer-typed helpers"` | (a) | git |
| 19 | 1537 | Task 4 Step 2 (code comment in test file) | `package/dist/bin/tools/x86_64/deno test --allow-all --import-map=src/import_map.json tools/codemod/` | (b) | comment-embedded command, same as #3 |
| 20 | 1734 | Task 4 Step 3 | `package/dist/bin/tools/x86_64/deno test --allow-all --import-map=src/import_map.json tools/codemod/` | (b) | as #3; expects "Module not found" |
| 21 | 1749 | Task 4 Step 4 (code comment in tool header) | `quarto run --dev tools/codemod-deno-ral.ts --rules fs,temp --dir src/core [--dry-run]` | (b) | quarto.cmd |
| 22 | 2351 | Task 4 Step 5 | `package/dist/bin/tools/x86_64/deno test --allow-all --import-map=src/import_map.json tools/codemod/` | (b) | as #3; needs network for npm:ts-morph first run; codemod uses `replaceAll("\\", "/")` so Windows paths handled in code, but untested there (u for tool behavior) |
| 23 | 2358 | Task 4 Step 6 | `quarto run --dev tools/codemod-deno-ral.ts --rules fs,temp --dir src/core --dir src/quarto-core --dir src/config --dry-run \| grep -E 'skipped\|collision\|Summary'` | (b) | quarto.cmd; grep via Git Bash; output paths use `/` (normalised in tool) |
| 24 | 2368 | Task 4 Step 6 | `git status --short src` | (a) | git |
| 25 | 2373-2374 | Task 4 Step 7 | `git add tools/codemod-deno-ral.ts tools/codemod` / `git commit -m "tools: ts-morph codemod for Deno.* <-> deno_ral rewrites, with fixtures"` | (a) | git |
| 26 | 2387 | Task 5 Step 1 | `package/dist/bin/tools/x86_64/deno cache --lock=deno.lock --frozen=false --import-map=src/import_map.json tools/codemod-deno-ral.ts tools/codemod/codemod-deno-ral.test.ts` | (b) | deno.exe |
| 27 | 2388 | Task 5 Step 1 | `git diff --stat deno.lock` | (a) | git |
| 28 | 2398 | Task 5 Step 2 (yaml) | `run: package/dist/bin/tools/x86_64/deno test --allow-all --import-map=src/import_map.json tools/codemod/` | (b) | GitHub Actions step on the Linux job; locally deno.exe |
| 29 | 2411 | Task 5 Step 3 (backport block) | `c=<commit>` | (u) | bash variable assignment; no PowerShell equivalent as written |
| 30 | 2412 | Task 5 Step 3 | `w=$(mktemp -d)/bp` | (u) | bash; Git Bash mktemp gives /tmp path (= %TEMP%) that Windows binaries may read differently |
| 31 | 2413 | Task 5 Step 3 | `git worktree add --detach "$w" "$c^"` | (u) | git ok; `^` is fine in bash, special in cmd; /tmp path to git |
| 32 | 2414-2419 | Task 5 Step 3 | `rev() { for f in $(git diff --name-only --diff-filter=AM "$c^" "$c" -- '*.ts'); do quarto run --dev tools/codemod-deno-ral.ts --reverse --rules fs,temp,env,process,platform --ral-dir "$w/src/deno_ral" --file "$w/$f"; done }` | (u) | bash function; quarto -> quarto.cmd; `/tmp/...` path passed as `--ral-dir`/`--file` to a Windows binary (MSYS path conversion); codemod resolves `--file` via `resolve` |
| 33 | 2420 | Task 5 Step 3 | `rev && git -C "$w" commit -qam "reversed base" --allow-empty` | (a) | git under bash |
| 34 | 2421 | Task 5 Step 3 | `git -C "$w" checkout "$c" -- $(git diff --name-only --diff-filter=AM "$c^" "$c")` | (a) | git under bash |
| 35 | 2422 | Task 5 Step 3 | `for f in $(git diff --name-only --diff-filter=D "$c^" "$c"); do git -C "$w" rm -q "$f"; done` | (a) | bash loop |
| 36 | 2423 | Task 5 Step 3 | `rev` | (u) | same as #32 |
| 37 | 2424 | Task 5 Step 3 | `git -C "$w" add -A && git -C "$w" diff --cached HEAD > "$w.patch"` | (a) | git; CRLF/autocrlf in the produced patch not checked |
| 38 | 2425 | Task 5 Step 3 | `git worktree remove --force "$w"` | (a) | git (removes a temp worktree) |
| 39 | 2428 | Task 5 Step 3 | `git apply -3 "$w.patch" && git commit -C "$c"` | (a) | git; run on stable branch; CRLF in patches possible (u) |
| 40 | 2428 | Task 5 Step 3 | `grep the patch for deno_ral/errors.ts and isNotFound(` | (a) | plain grep, no exact command given |
| 41 | 2431 | Task 5 Step 3 | `git apply --check` (on `v1.10`) | (a) | git |
| 42 | 2450 | Task 5 Step 4 (rules doc text) | `quarto run --dev tools/codemod-deno-ral.ts --rules fs,temp --dir src/<dir> --dry-run` | (b) | quarto.cmd |
| 43 | 2451 | Task 5 Step 4 (rules doc text) | `quarto run --dev tools/codemod-deno-ral.ts --rules fs,temp --dir src/<dir>` | (b) | quarto.cmd |
| 44 | 2482-2483 | Task 5 Step 6 | `git add deno.lock .github/workflows/runtime-boundary.yml dev-docs/checklist-backport-a-pr.md ...` / `git commit -m "codemod CI step, backport step, rules docs and changelog for deno_ral fs/temp/errors"` | (a) | git |
| 45 | 2488 | Verification | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent $(find unit/ral/ -name '*.test.ts')` | (b) | as #2 |
| 46 | 2489 | Verification | `package/dist/bin/tools/x86_64/deno test --allow-all --import-map=src/import_map.json tools/codemod/` | (b) | as #3 |
| 47 | 2490 | Verification | `cd src && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --unstable-ffi --import-map=import_map.json quarto.ts` | (b) | as #7 |
| 48 | 2491 | Verification | `quarto run --dev tools/check-runtime-boundary.ts` | (b) | quarto.cmd |
| 49 | 2491 | Verification | `git diff --stat tools/runtime-boundary-baseline.json` | (a) | git |
| 50 | 2492 | Verification | `git status --short src` (after the Task 4 Step 6 dry run) | (a) | git |
| 51 | 2493 | Verification | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/render/render-html.test.ts unit/ral/safe-remove-dir.test.ts smoke/check/check-info-project.test.ts` | (b) | as #9; `safeRemoveDirSync`/canonicalPathSync on Windows is the real risk, phase 2 to verify (u for behavior) |
| 52 | 22 | Context (prose, "verified" check) | `rg 'Deno\.realPathSync\('` over `src`, `tests`, `package/src` | (a) | rg; not an instruction to run |
| 53 | 28 | Context (prose) | `quarto run --dev <script>` runs `deno run --import-map src/import_map.json --allow-all` | (b) | descriptive; quarto.cmd |
| 54 | 2354 | Task 4 Step 5 (prose) | `deno fmt` (run by PRs 10-14 after the codemod) | (b) | deno.exe |

### Windows mentions

- line 21 (Context): "`normalizePath` in `src/core/path.ts:319-328` makes the path absolute against `Deno.cwd()`, normalises it, and upper-cases a Windows drive letter; it does not resolve symlinks and removes no prefix"
- line 95 (Interfaces, `canonicalPathSync` doc comment): "Symlinks resolved; the runtime itself returns no Windows `\\?\` prefix; throws when `path` does not exist."
- line 674 (Task 3 Step 1, test code): `import { isWindows } from "../../../src/deno_ral/platform.ts";`
- lines 753, 805, 819 (Task 3 test code): `if (!isWindows) {` guards symlink cases (symlinkSync/lstat isSymlink/readLinkSync, canonicalPathSync symlink resolution, getFileInfoType "symlink")
- line 804 (Task 3 test code): `assert(!canonicalReal.startsWith("\\\\?\\"), "no Windows verbatim prefix");`
- line 839 (Task 3 test code): `if (isWindows) return;` in the chmodSync (POSIX) test
- line 1123 (Task 3 Step 3, code comment): "The canonical absolute path: symlinks resolved, and no Windows `\\?\` prefix (Deno strips it itself, so nothing is sliced here)."
- lines 1486, 1493 (Task 4 fixtures): `Deno.build.os === "windows" ? "\\" : "/"` and the rewritten `os === "windows" ? ...` (fixture data, not a Windows instruction)


## 10-codemod-fs-core.md

Extracted commands: 41 (a=18, b=21, c=0, d=0, u=2)

| # | line | section | command | class | note |
|---|---|---|---|---|---|
| 1 | 69 | Spec > Landing order and conflict protocol | `git rebase origin/main`; `git checkout origin/main -- <file>` | (a) | git |
| 2 | 70 | Landing order and conflict protocol | `quarto run --dev tools/codemod-deno-ral.ts --rules <this PR's rules> --file <file> [--file <file>...]` | (b) | quarto.cmd |
| 3 | 71 | Landing order and conflict protocol | `package/dist/bin/tools/x86_64/deno fmt <file>...` | (b) | deno.exe outside Git Bash |
| 4 | 72 | Landing order and conflict protocol | `git add` the files and `git rebase --continue` | (a) | git |
| 5 | 95 | Spec > Acceptance criteria | `quarto run --dev tools/codemod-deno-ral.ts --rules fs,temp --dir src/core --dir src/quarto-core --dir src/config --dry-run \| tail -1` | (b) | quarto.cmd; `tail` from Git Bash (PowerShell: Select-Object -Last 1) |
| 6 | 99-101 | Spec > Acceptance criteria (bash block) | `rg -n '\bDeno\.(readTextFileSync\|...\|errors)\b' src/core src/quarto-core src/config -g '*.ts' -g '!src/core/deno/monkey-patch.ts' -g '!src/core/performance/metrics.ts' \| rg -v '^[^:]+:[0-9]+:\s*(//\|/\*\|\*)'` | (a) | rg, single-quoted regex and `\` continuation need bash; PowerShell quoting differs |
| 7 | 104 | Spec > Acceptance criteria | `quarto run --dev tools/check-runtime-boundary.ts` | (b) | quarto.cmd |
| 8 | 105 | Spec > Acceptance criteria | `cd src && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --unstable-ffi --import-map=import_map.json quarto.ts` | (b) | deno.exe |
| 9 | 119 | Task 1 Step 1 | `quarto run --dev tools/codemod-deno-ral.ts --rules fs,temp --dir src/core --dir src/quarto-core --dir src/config --dry-run > /tmp/codemod-core.txt; tail -3 /tmp/codemod-core.txt` | (b) | quarto.cmd; `/tmp` is %TEMP% under Git Bash, only Git Bash tools read it back |
| 10 | 119 | Task 1 Step 1 | `git status --short src` (expected empty) | (a) | git |
| 11 | 124 | Task 1 Step 2 | `grep -E 'skipped\|collision' /tmp/codemod-core.txt` | (a) | Git Bash grep |
| 12 | 135 | Task 1 Step 2 | `grep -c '→' /tmp/codemod-core.txt` | (u) | non-ASCII `→` in a pattern; depends on the codemod writing UTF-8 to the file and the shell locale |
| 13 | 135 | Task 1 Step 2 | `grep '→' /tmp/codemod-core.txt \| awk -F'→' '{print $2}' \| sort \| uniq -c \| sort -rn` | (u) | multibyte `-F` separator in awk; Git Bash gawk likely fine, unverified; GNU sort picked from Git Bash PATH |
| 14 | 141 | Task 2 Step 1 | `quarto run --dev tools/codemod-deno-ral.ts --rules fs,temp --dir src/core --dir src/quarto-core --dir src/config \| tail -1` | (b) | quarto.cmd; this one rewrites files |
| 15 | 146 | Task 2 Step 2 | `git diff --name-only \| xargs package/dist/bin/tools/x86_64/deno fmt` | (b) | deno.exe; xargs from Git Bash |
| 16 | 147 | Task 2 Step 2 | `git diff --stat \| tail -1` | (a) | git + tail |
| 17 | 149 | Task 2 Step 2 | `cd src && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --unstable-ffi --import-map=import_map.json quarto.ts` | (b) | deno.exe |
| 18 | 155-156 | Task 2 Step 3 | `git add src/core src/quarto-core src/config` / `git commit -m "core: codemod Deno fs/temp calls to deno_ral (mechanical)"` | (a) | git |
| 19 | 176 | Task 3 Step 2 | `grep -rn 'qualified-path.ts' src tests --include=*.ts` | (a) | Git Bash grep |
| 20 | 194 | Task 3 Step 3 | `cd src && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --unstable-ffi --import-map=import_map.json quarto.ts` | (b) | deno.exe |
| 21 | 197 | Task 3 Step 3 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/paths/qualified-path.test.ts unit/file-permissions.test.ts` | (b) | run-tests.ps1 / DENO_DIR=x86_64; `file-permissions` test may be POSIX-oriented (u) |
| 22 | 201-202 | Task 3 Step 3 | `git add src/core/copy.ts src/core/qualified-path.ts` / `git commit -m "core: resolve codemod collisions in copy.ts and qualified-path.ts"` | (a) | git |
| 23 | 252 | Task 4 Step 8 | `grep -rn 'Deno\.errors' src/core src/quarto-core src/config --include=*.ts` | (a) | Git Bash grep |
| 24 | 255 | Task 4 Step 8 | `cd src && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --unstable-ffi --import-map=import_map.json quarto.ts` | (b) | deno.exe |
| 25 | 259-260 | Task 4 Step 8 | `git add src/core` / `git commit -m "core: Deno.errors instanceof checks through deno_ral/errors predicates"` | (a) | git |
| 26 | 267 | Task 5 Step 1 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent $(find unit/core/ -name '*.test.ts') $(find unit/paths/ ...) unit/path.test.ts ... unit/chrome-launch.test.ts unit/preview-brand-cache.test.ts` | (b) | run-tests.ps1 / DENO_DIR; `$(find ...)` bash-only; includes `unit/chrome-launch.test.ts`, `unit/file-permissions.test.ts`, `unit/exec-process-stdin.test.ts` whose Windows behavior is (u) |
| 27 | 272 | Task 5 Step 2 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/render/render-html.test.ts smoke/render/render-freeze.test.ts ... smoke/extensions/install.test.ts` | (b) | as #26; smoke tests need R/Python/Julia installed |
| 28 | 277 | Task 5 Step 3 | `quarto run --dev tools/check-runtime-boundary.ts --update-baseline && quarto run --dev tools/check-runtime-boundary.ts` | (b) | quarto.cmd (two invocations) |
| 29 | 278 | Task 5 Step 3 | `git diff tools/runtime-boundary-baseline.json` | (a) | git |
| 30 | 283-284 | Task 5 Step 4 | `git add tools/runtime-boundary-baseline.json` / `git commit -m "Lower runtime boundary baseline after core fs/temp codemod"` | (a) | git |
| 31 | 290 | Verification | `quarto run --dev tools/check-runtime-boundary.ts` | (b) | quarto.cmd |
| 32 | 292 | Verification | `cd src && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --unstable-ffi --import-map=import_map.json quarto.ts` | (b) | deno.exe |
| 33 | 293 | Verification (manual) | `package/dist/bin/quarto render tests/docs/test.qmd --to html` | (b) | quarto.cmd |
| 34 | 293 | Verification (manual) | `package/dist/bin/quarto preview tests/docs/test.qmd --no-browser` (Ctrl-C after it serves) | (b) | quarto.cmd; Ctrl-C handling of the cmd wrapper / child deno on Windows (u) |
| 35 | 293 | Verification (manual) | `QUARTO_REPORT_PERFORMANCE_METRICS=fileReads package/dist/bin/quarto render tests/docs/test.qmd` | (b) | quarto.cmd; `VAR=x cmd` prefix is bash-only (PowerShell: `$env:QUARTO_REPORT_PERFORMANCE_METRICS="fileReads"`) |
| 36 | 297 | Review checklist | `git diff -U0 src/core \| grep '^[-+]' \| grep -v '^[-+][-+]' \| grep -v 'deno_ral/\(fs\|temp\|errors\)\.ts' \| grep -vE 'Deno\.\|FileInfo\|TempOptions\|^[+-]\s*$\|^[+-]\s*(import\|\}\|[a-zA-Z]+,\|type [A-Za-z]+,)'` | (a) | pure git + GNU grep under bash |
| 37 | 310 | Risks and rollback | `git revert` the four commits | (a) | git |
| 38 | 318 | Follow-up after merge | `git log --oneline main -- src/core/path.ts \| head` | (a) | git + head |
| 39 | 318 | Follow-up after merge | `git apply -3` (backport step, scratch branch off `v1.10`) | (a) | git |
| 40 | 318 | Follow-up after merge | "the backport step PR 37 Task 6 Step 1 spells out ... the codemod runs through `quarto run --dev`" | (b) | cross-reference to another plan; quarto.cmd |
| 41 | 18 | Spec > Context (prose) | `grep -rhoE '\bDeno\.[A-Za-z_]+(\.[A-Za-z_]+)?' <dir> --include=*.ts \| sort \| uniq -c \| sort -rn` | (a) | measurement command (documentation, not an executor step); Git Bash grep/sort |

### Windows mentions

none


## 11-codemod-fs-command.md

Extracted commands: 33 (a=13, b=15, c=1, d=0, u=4)

| # | line | section | command | class | note |
|---|---|---|---|---|---|
| 1 | 62 | Spec > Landing order and conflict protocol | `git rebase origin/main`; `git checkout origin/main -- <file>` | (a) | git |
| 2 | 63 | Landing order and conflict protocol | `quarto run --dev tools/codemod-deno-ral.ts --rules <this PR's rules> --file <file> [--file <file>...]` | (b) | quarto.cmd |
| 3 | 64 | Landing order and conflict protocol | `package/dist/bin/tools/x86_64/deno fmt <file>...` | (b) | deno.exe |
| 4 | 65 | Landing order and conflict protocol | `git add` the files and `git rebase --continue` | (a) | git |
| 5 | 86 | Spec > Acceptance criteria | `quarto run --dev tools/codemod-deno-ral.ts --rules fs,temp --dir src/command --dry-run \| tail -1` | (b) | quarto.cmd; tail from Git Bash |
| 6 | 89-92 | Spec > Acceptance criteria (bash block) | `rg -n '\bDeno\.(readTextFileSync\|...\|errors)\b' src/command -g '*.ts' \| rg -v '^[^:]+:[0-9]+:\s*(//\|/\*\|\*)'` | (a) | rg under bash |
| 7 | 94 | Spec > Acceptance criteria | `quarto run --dev tools/check-runtime-boundary.ts` | (b) | quarto.cmd |
| 8 | 95 | Spec > Acceptance criteria | `cd src && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --unstable-ffi --import-map=import_map.json quarto.ts` | (b) | deno.exe |
| 9 | 109 | Task 1 Step 1 | `quarto run --dev tools/codemod-deno-ral.ts --rules fs,temp --dir src/command --dry-run > /tmp/codemod-command.txt; tail -1 /tmp/codemod-command.txt` | (b) | quarto.cmd; /tmp under Git Bash |
| 10 | 110 | Task 1 Step 1 | `git status --short src` (expected empty) | (a) | git |
| 11 | 114 | Task 1 Step 2 | `grep -E 'skipped\|collision' /tmp/codemod-command.txt` | (a) | Git Bash grep |
| 12 | 121 | Task 1 Step 2 | `grep '→' /tmp/codemod-command.txt \| awk -F'→' '{print $2}' \| sort \| uniq -c \| sort -rn` | (u) | multibyte awk separator and UTF-8 redirected output; unverified |
| 13 | 128 | Task 2 Step 1 | `quarto run --dev tools/codemod-deno-ral.ts --rules fs,temp --dir src/command \| tail -1` | (b) | quarto.cmd |
| 14 | 133 | Task 2 Step 2 | `git diff --name-only \| xargs package/dist/bin/tools/x86_64/deno fmt` | (b) | deno.exe; xargs from Git Bash |
| 15 | 134 | Task 2 Step 2 | `git diff --stat \| tail -1` | (a) | git + tail |
| 16 | 136 | Task 2 Step 2 | `cd src && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --unstable-ffi --import-map=import_map.json quarto.ts` | (b) | deno.exe |
| 17 | 142-143 | Task 2 Step 3 | `git add src/command` / `git commit -m "command: codemod Deno fs/temp calls to deno_ral (mechanical)"` | (a) | git |
| 18 | 171 | Task 3 Step 3 | `rg -n 'Deno\.errors\|Deno\.stat\(' src/command -g '*.ts'` | (a) | rg; bash quoting |
| 19 | 174 | Task 3 Step 3 | `cd src && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --unstable-ffi --import-map=import_map.json quarto.ts` | (b) | deno.exe |
| 20 | 178-179 | Task 3 Step 3 | `git add src/command/dev-call/pull-git-subtree/cmd.ts src/command/render/pandoc.ts` / `git commit -m "command: resolve stat collision and use isNotFound in pandoc font cache"` | (a) | git |
| 21 | 186 | Task 4 Step 1 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent $(find unit/render/ -name '*.test.ts') $(find unit/latexmk/ -name '*.test.ts') unit/axe-config.test.ts ... unit/print-call-r-diagnostics.test.ts` | (b) | run-tests.ps1 / DENO_DIR; `$(find)` bash; `unit/chrome-launch.test.ts` and axe tests need a browser (u) |
| 22 | 191 | Task 4 Step 2 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/render/render-html.test.ts ... smoke/project/project-simple.test.ts` | (b) | as #21; needs TinyTeX for render-pdf, R/Python/Julia; `smoke/build-ts-extension`, `smoke/typst-gather` Windows behavior (u) |
| 23 | 196 | Task 4 Step 3 | `package/dist/bin/quarto capabilities \| python3 -c "import json,sys; t=json.load(sys.stdin)['themes']; print(t[:5], t[1:] == sorted(t[1:]))"` | (c) | quarto.cmd; `python3` on Windows is often a Store stub (`python`/`py`); double-quoted bash string with single quotes breaks in PowerShell |
| 24 | 201 | Task 4 Step 4 | `quarto run --dev tools/check-runtime-boundary.ts --update-baseline && quarto run --dev tools/check-runtime-boundary.ts` | (b) | quarto.cmd (two invocations) |
| 25 | 202 | Task 4 Step 4 | `git diff tools/runtime-boundary-baseline.json` | (a) | git |
| 26 | 207-208 | Task 4 Step 5 | `git add tools/runtime-boundary-baseline.json` / `git commit -m "Lower runtime boundary baseline after command fs/temp codemod"` | (a) | git |
| 27 | 214 | Verification | `quarto run --dev tools/check-runtime-boundary.ts` | (b) | quarto.cmd |
| 28 | 216 | Verification | `cd src && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --unstable-ffi --import-map=import_map.json quarto.ts` | (b) | deno.exe |
| 29 | 217 | Verification (manual) | `package/dist/bin/quarto create project default /tmp/qc-$$ --no-prompt --no-open` | (u) | quarto.cmd; `$$` is bash-only; `/tmp/qc-$$` is an MSYS path that Git Bash converts for native args but the .cmd wrapper path handling is unverified |
| 30 | 217 | Verification (manual) | `package/dist/bin/quarto render /tmp/qc-$$` | (u) | as #29 |
| 31 | 217 | Verification (manual) | `package/dist/bin/quarto inspect /tmp/qc-$$ \| head -3` | (u) | as #29 |
| 32 | 232 | Risks and rollback | `git revert` the three commits | (a) | git |
| 33 | 18 | Spec > Context (prose) | `grep -rhoE '\bDeno\.[A-Za-z_]+(\.[A-Za-z_]+)?' src/command --include=*.ts \| sort \| uniq -c \| sort -rn` | (a) | measurement documentation; Git Bash |

### Windows mentions

none


## 12-codemod-fs-project-format.md

Extracted commands: 33 (a=15, b=16, c=1, d=0, u=1)

| # | line | section | command | class | note |
|---|---|---|---|---|---|
| 1 | 73 | Spec > Landing order and conflict protocol | `git rebase origin/main`; `git checkout origin/main -- <file>` | (a) | git |
| 2 | 74 | Landing order and conflict protocol | `quarto run --dev tools/codemod-deno-ral.ts --rules <this PR's rules> --file <file> [--file <file>...]` | (b) | quarto.cmd |
| 3 | 75 | Landing order and conflict protocol | `package/dist/bin/tools/x86_64/deno fmt <file>...` | (b) | deno.exe |
| 4 | 76 | Landing order and conflict protocol | `git add` the files and `git rebase --continue` | (a) | git |
| 5 | 92 | Spec > Acceptance criteria | `quarto run --dev tools/codemod-deno-ral.ts --rules fs,temp --dir src/project --dir src/format --dry-run \| tail -1` | (b) | quarto.cmd |
| 6 | 95-98 | Spec > Acceptance criteria (bash block) | `rg -n '\bDeno\.(readTextFileSync\|...\|errors)\b' src/project src/format -g '*.ts' \| rg -v '^[^:]+:[0-9]+:\s*(//\|/\*\|\*)'` | (a) | rg under bash |
| 7 | 100 | Spec > Acceptance criteria | `quarto run --dev tools/check-runtime-boundary.ts` | (b) | quarto.cmd |
| 8 | 101 | Spec > Acceptance criteria | `cd src && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --unstable-ffi --import-map=import_map.json quarto.ts` | (b) | deno.exe |
| 9 | 115 | Task 1 Step 1 | `quarto run --dev tools/codemod-deno-ral.ts --rules fs,temp --dir src/project --dir src/format --dry-run > /tmp/codemod-pf.txt; tail -1 /tmp/codemod-pf.txt` | (b) | quarto.cmd; /tmp |
| 10 | 116 | Task 1 Step 1 | `git status --short src` (expected empty) | (a) | git |
| 11 | 120 | Task 1 Step 2 | `grep -E 'skipped\|collision' /tmp/codemod-pf.txt` | (a) | Git Bash grep |
| 12 | 123 | Task 1 Step 2 | `grep '→' /tmp/codemod-pf.txt \| awk -F'→' '{print $2}' \| sort \| uniq -c \| sort -rn` | (u) | multibyte awk separator, UTF-8 redirected output |
| 13 | 130 | Task 2 Step 1 | `quarto run --dev tools/codemod-deno-ral.ts --rules fs,temp --dir src/project --dir src/format \| tail -1` | (b) | quarto.cmd |
| 14 | 135 | Task 2 Step 2 | `git diff --name-only \| xargs package/dist/bin/tools/x86_64/deno fmt` | (b) | deno.exe; xargs |
| 15 | 136 | Task 2 Step 2 | `git diff --stat \| tail -1` | (a) | git + tail |
| 16 | 138 | Task 2 Step 2 | `cd src && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --unstable-ffi --import-map=import_map.json quarto.ts` | (b) | deno.exe |
| 17 | 143 | Task 2 Step 3 | `git diff -U2 src/project/types/manuscript/manuscript-config.ts ... src/format/pdf/format-pdf.ts \| grep '^[-+]' \| grep -v '^[-+][-+]'` | (a) | git + grep under bash |
| 18 | 149-150 | Task 2 Step 4 | `git add src/project src/format` / `git commit -m "project/format: codemod Deno fs/temp calls to deno_ral (mechanical)"` | (a) | git |
| 19 | 180 | Task 3 Step 3 | `rg -n 'Deno\.errors' src/project src/format -g '*.ts'` | (a) | rg |
| 20 | 183 | Task 3 Step 3 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/project/project-context-unreadable-dir.test.ts unit/project/project-detect-denied-path.test.ts smoke/project/project-unreadable-dir.test.ts smoke/project/project-detect-denied-config.test.ts` | (c) | run-tests.ps1 / DENO_DIR; these are PermissionDenied (unreadable-dir) tests: "on a root Unix session they skip themselves via `canMakeUnreadableDir`"; chmod-based unreadable dirs likely behave differently on Windows (ACLs) |
| 21 | 187-188 | Task 3 Step 3 | `git add src/project/project-context.ts src/project/project-index.ts` / `git commit -m "project: Deno.errors checks through deno_ral/errors predicates"` | (a) | git |
| 22 | 195 | Task 4 Step 1 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent $(find unit/project/ -name '*.test.ts') unit/book-title-block-attr.test.ts ... unit/typst-fonts.test.ts` | (b) | run-tests.ps1 / DENO_DIR; `$(find)` bash |
| 23 | 200 | Task 4 Step 2 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent $(find smoke/project/ -name '*.test.ts') $(find smoke/site/ ...) ... smoke/render/render-title-block.test.ts` | (b) | as #22; PDF/LaTeX tests need TinyTeX; ~9 `$(find)` expansions |
| 24 | 205 | Task 4 Step 3 | `quarto run --dev tools/check-runtime-boundary.ts --update-baseline && quarto run --dev tools/check-runtime-boundary.ts` | (b) | quarto.cmd (two invocations) |
| 25 | 206 | Task 4 Step 3 | `git diff tools/runtime-boundary-baseline.json` | (a) | git |
| 26 | 211-212 | Task 4 Step 4 | `git add tools/runtime-boundary-baseline.json` / `git commit -m "Lower runtime boundary baseline after project/format fs/temp codemod"` | (a) | git |
| 27 | 220 | Verification | `cd src && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --unstable-ffi --import-map=import_map.json quarto.ts` | (b) | deno.exe |
| 28 | 218 | Verification | `quarto run --dev tools/check-runtime-boundary.ts` | (b) | quarto.cmd |
| 29 | 221 | Verification (manual) | `package/dist/bin/quarto render tests/docs/websites/search` | (b) | quarto.cmd |
| 30 | 221 | Verification (manual) | `package/dist/bin/quarto render tests/docs/manuscript/base` | (b) | quarto.cmd |
| 31 | 221 | Verification (manual) | `git clean -fdx tests/docs/websites/search tests/docs/manuscript/base` | (a) | git; destructive (needs a dry run `-n` first per Chris's rules) |
| 32 | 235 | Risks and rollback | `git revert` the three commits | (a) | git |
| 33 | 18 | Spec > Context (prose) | `grep -rhoE '\bDeno\.[A-Za-z_]+(\.[A-Za-z_]+)?' <dir> --include=*.ts \| sort \| uniq -c \| sort -rn` | (a) | measurement documentation; Git Bash |

### Windows mentions

none


## 13-codemod-fs-rest.md

Extracted commands: 35 (a=14, b=19, c=0, d=0, u=2)

| # | line | section | command | class | note |
|---|---|---|---|---|---|
| 1 | 66 | Spec > Landing order and conflict protocol | `git rebase origin/main`; `git checkout origin/main -- <file>` | (a) | git |
| 2 | 67 | Landing order and conflict protocol | `quarto run --dev tools/codemod-deno-ral.ts --rules <this PR's rules> --file <file> [--file <file>...]` | (b) | quarto.cmd |
| 3 | 68 | Landing order and conflict protocol | `package/dist/bin/tools/x86_64/deno fmt <file>...` | (b) | deno.exe |
| 4 | 69 | Landing order and conflict protocol | `git add` the files and `git rebase --continue` | (a) | git |
| 5 | 90 | Spec > Acceptance criteria | `quarto run --dev tools/codemod-deno-ral.ts --rules fs,temp --dir src/execute --dir src/publish --dir src/tools --dir src/extension --dir src/preview --dir src/inspect --dir src/render --dry-run \| tail -1` | (b) | quarto.cmd |
| 6 | 93-97 | Spec > Acceptance criteria (bash block) | `rg -n '\bDeno\.(readTextFileSync\|...\|errors)\b' src/execute src/publish src/tools src/extension src/preview src/inspect src/render -g '*.ts' \| rg -v '^[^:]+:[0-9]+:\s*(//\|/\*\|\*)' \| rg -v "^[^:]+:[0-9]+:[^\"'\`]*//.*\bDeno\."` | (a) | rg; the third pattern mixes `"`, `'` and a backtick, needs bash quoting |
| 7 | 99 | Spec > Acceptance criteria | `quarto run --dev tools/check-runtime-boundary.ts` | (b) | quarto.cmd |
| 8 | 100 | Spec > Acceptance criteria | `cd src && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --unstable-ffi --import-map=import_map.json quarto.ts` | (b) | deno.exe |
| 9 | 114 | Task 1 Step 1 | `quarto run --dev tools/codemod-deno-ral.ts --rules fs,temp --dir src/execute ... --dir src/render --dry-run > /tmp/codemod-rest.txt; tail -1 /tmp/codemod-rest.txt` | (b) | quarto.cmd; /tmp |
| 10 | 115 | Task 1 Step 1 | `git status --short src` (expected empty) | (a) | git |
| 11 | 119 | Task 1 Step 2 | `grep -E 'skipped\|collision' /tmp/codemod-rest.txt` | (a) | Git Bash grep |
| 12 | 125 | Task 1 Step 2 | `grep '→' /tmp/codemod-rest.txt \| awk -F'→' '{print $2}' \| sort \| uniq -c \| sort -rn` | (u) | multibyte awk separator, UTF-8 redirected output |
| 13 | 130 | Task 1 Step 3 | `grep -c 'src/resources\|src/webui' /tmp/codemod-rest.txt` | (a) | Git Bash grep (expects 0) |
| 14 | 137 | Task 2 Step 1 | `quarto run --dev tools/codemod-deno-ral.ts --rules fs,temp --dir src/execute ... --dir src/render \| tail -1` | (b) | quarto.cmd |
| 15 | 142 | Task 2 Step 2 | `git diff --name-only \| xargs package/dist/bin/tools/x86_64/deno fmt` | (b) | deno.exe; xargs |
| 16 | 143 | Task 2 Step 2 | `git diff --stat \| tail -1` | (a) | git + tail |
| 17 | 145 | Task 2 Step 2 | `cd src && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --unstable-ffi --import-map=import_map.json quarto.ts` | (b) | deno.exe |
| 18 | 151-152 | Task 2 Step 3 | `git add src/execute src/publish src/tools src/extension src/preview src/inspect src/render` / `git commit -m "execute/publish/tools/extension/preview/inspect/render: codemod Deno fs/temp calls to deno_ral (mechanical)"` | (a) | git |
| 19 | 170 | Task 3 Step 2 | `rg -n 'Deno\.realPath\b' src/tools -g '*.ts'` | (a) | rg |
| 20 | 173 | Task 3 Step 2 | `cd src && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --unstable-ffi --import-map=import_map.json quarto.ts` | (b) | deno.exe |
| 21 | 177-178 | Task 3 Step 2 | `git add src/tools/impl/tinytex.ts` / `git commit -m "tools: resolve realPath collision in tinytex.ts"` | (a) | git |
| 22 | 185 | Task 4 Step 1 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent $(find unit/tools/ -name '*.test.ts') $(find unit/extension/ ...) ... unit/render-shared-output-dir.test.ts` | (b) | run-tests.ps1 / DENO_DIR; `$(find)` bash; `unit/tools/` has tinytex and chrome tests: Windows behavior (u) |
| 23 | 190 | Task 4 Step 2 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent $(find smoke/engine/ -name '*.test.ts') ... smoke/render/render-verapdf.test.ts` | (b) | as #22; Jupyter/R/veraPDF tests skip without prerequisites |
| 24 | 203 | Task 4 Step 4 | `quarto run --dev tools/check-runtime-boundary.ts --update-baseline && quarto run --dev tools/check-runtime-boundary.ts` | (b) | quarto.cmd (two invocations) |
| 25 | 204 | Task 4 Step 4 | `git diff tools/runtime-boundary-baseline.json` | (a) | git |
| 26 | 209-210 | Task 4 Step 5 | `git add tools/runtime-boundary-baseline.json .claude/rules/typescript/deno-ral.md` / `git commit -m "Lower runtime boundary baseline after remaining fs/temp codemod; document excluded scripts"` | (a) | git |
| 27 | 216 | Verification | `quarto run --dev tools/check-runtime-boundary.ts` | (b) | quarto.cmd |
| 28 | 218 | Verification | `cd src && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --unstable-ffi --import-map=import_map.json quarto.ts` | (b) | deno.exe |
| 29 | 219 | Verification (manual) | `package/dist/bin/quarto tools list` | (b) | quarto.cmd |
| 30 | 219 | Verification (manual) | `cd $(mktemp -d) && package/dist/bin/quarto add quarto-ext/lightbox --no-prompt && package/dist/bin/quarto list extensions` | (b) | quarto.cmd; `$(mktemp -d)` bash (PowerShell: New-TemporaryFile / New-Item temp dir); needs network |
| 31 | 219 | Verification (manual) | `package/dist/bin/quarto preview tests/docs/test.qmd --no-browser` | (b) | quarto.cmd; "serves and exits on Ctrl-C" on Windows (u) |
| 32 | 234 | Risks and rollback | `git revert` the three commits | (a) | git |
| 33 | 18 | Spec > Context (prose) | `grep -rhoE '\bDeno\.[A-Za-z_]+(\.[A-Za-z_]+)?' <dir> --include=*.ts --exclude-dir=node_modules --exclude-dir=extension-subtrees \| sort \| uniq -c \| sort -rn` | (a) | measurement documentation; Git Bash |
| 34 | 42 | Spec > exclusion table (prose) | `deno run --no-config -A build.ts` (webui quarto-preview build, `package/src/common/previewjs.ts:14`) | (u) | describes how an excluded script runs; not an instruction |
| 35 | 38 | Spec > exclusion table (prose) | `quarto dev-call pull-git-subtree` | (b) | descriptive; quarto.cmd |

### Windows mentions

none


## 14b-coverage-first.md

Extracted commands: 52 (a=13, b=13, c=11, d=11, u=4)

| # | line | section | command | class | note |
|---|---|---|---|---|---|
| 1 | 26 | Spec / Context (facts) | `find tests/docs -name _quarto.yml` (then counting inputs per directory) | b | Git Bash GNU find works; in cmd/PowerShell `find` is the Windows find.exe, wrong tool |
| 2 | 105 | Spec / Assumptions | `grep -n 'detached\|taskkill\|export function killProcess' src/deno_ral/process.ts` | a | Git Bash grep; plain read-only |
| 3 | 105 | Spec / Assumptions | `ls tests/asserts.ts src/deno_ral/temp.ts` | a | works in Git Bash and PowerShell |
| 4 | 121 | Spec / Acceptance criteria | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/process-group.test.ts smoke/preview/preview-reload.test.ts smoke/preview/preview-project-reload.test.ts smoke/jupyter/daemon.test.ts smoke/inspect/inspect-pipe.test.ts` | d | this is the Windows evidence run (expects `4 passed 4 ignored`); mechanically `run-tests.ps1` with `$env:QUARTO_TESTS_NO_CONFIG` |
| 5 | 123 | Spec / Acceptance criteria | `grep -n 'Deno\.' tests/process-helpers.ts tests/unit/process-group.test.ts tests/smoke/preview/preview-helpers.ts tests/smoke/preview/preview-reload.test.ts tests/smoke/preview/preview-project-reload.test.ts tests/smoke/jupyter/daemon.test.ts tests/smoke/inspect/inspect-pipe.test.ts` | a | Git Bash grep |
| 6 | 123 | Spec / Acceptance criteria | `quarto run --dev tools/check-runtime-boundary.ts` (without `--accept-tests-increase`) | b | quarto -> quarto.cmd |
| 7 | 124 | Spec / Acceptance criteria | CI: `test-smokes-parallel.yml` green on three OSes, Windows log shows four cases passed | d | CI evidence, not a local command |
| 8 | 181 | Task 1 / Step 1 (test-internal) | `exec("ps", { args: ["-o", "pgid=", "-p", String(pid)] })` (`processGroupOf`) | c | POSIX only, helper documented as POSIX only, never called on Windows |
| 9 | 190 | Task 1 / Step 1 (test-internal) | `exec("tasklist", { args: ["/FI", "PID eq <pid>", "/NH", "/FO", "CSV"] })` (`isProcessGone`, Windows branch) | a | tasklist.exe is a Windows built-in; CSV match string `","<pid>",` unverified but command exists |
| 10 | 196 | Task 1 / Step 1 (test-internal) | `exec("ps", { args: ["-o", "stat=", "-p", String(pid)] })` (`isProcessGone`, POSIX branch) | c | POSIX only; Windows takes the tasklist branch |
| 11 | 206 | Task 1 / Step 2 | `cd tests && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --import-map=../src/import_map.json process-helpers.ts` | b | `deno` -> `deno.exe`; arch dir `x86_64` is right for Windows x64 |
| 12 | 212-213 | Task 1 / Step 3 | `git add tests/process-helpers.ts` ; `git commit -m "tests: add process-helpers (waitFor, collectText, process group probes)"` | a | git is cross-platform; plan assumes bash quoting |
| 13 | 266 | Task 2 / Step 1 (test-internal) | `spawn("sh", { args: ["-c", "sleep 30 & echo $!; wait"], detached })` (`startTree`) | c | `sh`/`sleep` POSIX; the two POSIX tests are `ignore: isWindows` (line 331, 350) |
| 14 | 318 | Task 2 / Step 1 (test-internal) | `killProcess(-tree.child.pid, "SIGKILL")` | c | POSIX group kill; ignored on Windows |
| 15 | 358 | Task 2 / Step 1 (test-internal) | `Start-Process -PassThru -WindowStyle Hidden ping -ArgumentList '-n','31','127.0.0.1'` | u | Windows-only test; detached child has no console, behaviour of hidden `ping` under DETACHED_PROCESS unverified |
| 16 | 364 | Task 2 / Step 1 (test-internal) | `spawn("powershell", { args: ["-NoProfile","-NonInteractive","-Command", kWindowsScript], detached: true })` | u | `powershell` (5.1) exists on Windows but user rules say use `pwsh`; plan chose 5.1 on purpose? unstated |
| 17 | 402 | Task 2 / Step 1 (test-internal) | `killProcess(-tree.child.pid, "SIGTERM")` (runs `taskkill /PID <pid> /T /F` on Windows) | d | the Windows tree-kill case, README lists 14b Windows |
| 18 | 428 | Task 2 / Step 2 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/process-group.test.ts` | b | run-tests.sh -> run-tests.ps1; expects `1 passed 2 ignored` on Windows |
| 19 | 434-435 | Task 2 / Step 3 | `git add tests/unit/process-group.test.ts` ; `git commit -m "tests: cover process-group kill ..."` | a | git |
| 20 | 485 | Task 3 / Step 1 (test-internal) | `spawn(quartoDevCmd(), { args: ["preview", ...args, "--no-browser", "--port", "<p>"], detached: true })` | d | plan states `quartoDevCmd()` is `quarto.cmd` on Windows (line 650); preview test runs on Windows |
| 21 | 554 | Task 3 / Step 1 (test-internal) | `killProcess(-run.child.pid, "SIGTERM")` in `stopPreview` | d | taskkill /T on cmd.exe + deno.exe tree on Windows |
| 22 | 649 | Task 3 / Step 3 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/preview/preview-reload.test.ts` | d | expected to pass on Windows; run-tests.ps1 adaptation |
| 23 | 654 | Task 3 / Step 4 | `cd tests && QUARTO_TEST_BIN=/path/to/installed/quarto QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/preview/preview-reload.test.ts` | b | `VAR=x cmd` has no PowerShell form (set `$env:` first); path must point at installed `quarto.cmd` |
| 24 | 660-661 | Task 3 / Step 5 | `git add tests/smoke/preview/preview-helpers.ts tests/smoke/preview/preview-reload.test.ts` ; `git commit -m "tests: end-to-end quarto preview test ..."` | a | git |
| 25 | 772 | Task 4 / Step 2 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/preview/preview-project-reload.test.ts` | d | website preview, runs on Windows per plan |
| 26 | 778-779 | Task 4 / Step 3 | `git add tests/smoke/preview/preview-project-reload.test.ts` ; `git commit -m ...` | a | git |
| 27 | 839 | Task 5 / Step 2 (test-internal) | `exec(quartoDevCmd(), { args: ["render", input, "--to", "html", ...flags] })` incl. `--no-execute-daemon`, `--execute-daemon 120` | b | adapted by `quartoDevCmd()` per line 650 claim; Jupyter/python3 kernel needed on Windows |
| 28 | 886 | Task 5 / Step 3 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/jupyter/daemon.test.ts` | d | daemon test runs on every OS per plan |
| 29 | 887 | Task 5 / Step 3 | `git status --short tests/docs/jupyter/daemon` | a | git |
| 30 | 892-893 | Task 5 / Step 4 | `git add tests/docs/jupyter/daemon/daemon.qmd tests/smoke/jupyter/daemon.test.ts` ; `git commit -m "tests: cover Jupyter kernel daemon reuse ..."` | a | git |
| 31 | 939 | Task 6 / Step 1 (test-internal) | `exec("bash", { args: ["-c", "set -o pipefail; <script>", "inspect-pipe", ...] })` | c | POSIX; tests `ignore: isWindows` (982, 1007). Note: on Windows PowerShell `bash.exe` is WSL (memory), so ignore is wise |
| 32 | 953 | Task 6 / Step 1 (test-internal) | `exec(quartoDevCmd(), { args: ["inspect", project, outFile] })` | c | only reached from tests ignored on Windows |
| 33 | 962 | Task 6 / Step 1 (test-internal) | `"$1" inspect "$2" \| head -c 1` | c | needs bash/head; ignored on Windows by design |
| 34 | 967 | Task 6 / Step 1 (test-internal) | `"$1" inspect "$2" \| wc -c` | c | needs bash/wc; ignored on Windows by design |
| 35 | 1013 | Task 6 / Step 2 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/inspect/inspect-pipe.test.ts` | c | on Windows both cases are ignored (expect `0 passed 2 ignored`), so no verification value there |
| 36 | 1019-1020 | Task 6 / Step 3 | `git add tests/smoke/inspect/inspect-pipe.test.ts` ; `git commit -m "tests: quarto inspect through head -c 1 and wc -c ..."` | a | git |
| 37 | 1030 | Task 7 / Step 1 | `git checkout -- src` (after each break) | a | git; destructive-op rule: dry run / Chris approval applies per global rules |
| 38 | 1032 | Task 7 / Step 1 break 1 | `sed -i 's/await reloader.reloadClients(reloadTarget);/void 0;/' src/command/preview/preview.ts` | b | GNU sed from Git Bash only; no PowerShell/cmd sed |
| 39 | 1032 | Task 7 / Step 1 break 1 | `./run-tests.sh --agent smoke/preview/preview-reload.test.ts` (expects `timed out after 30000 ms`) | b | run-tests.ps1; implicit `cd tests` |
| 40 | 1033 | Task 7 / Step 1 break 2 | hand-edit `readKernelTransportFile` to return `null`; run `smoke/jupyter/daemon.test.ts` | b | edit is manual; test run via run-tests.ps1 |
| 41 | 1034 | Task 7 / Step 1 break 3 | hand-edit `src/command/inspect/cmd.ts:61` to two writes; run `smoke/inspect/inspect-pipe.test.ts` expects `Broken pipe` | c | test is ignored on Windows, so this break cannot be proven there |
| 42 | 1035 | Task 7 / Step 1 break 4 | hand-edit `src/deno_ral/process.ts` drop `detached`; run `unit/process-group.test.ts` expects `the grandchild should be in the group...` | c | that assertion is the POSIX test (ignored on Windows); on Windows a different failure would occur |
| 43 | 1036 | Task 7 / Step 1 break 5 | `sed -i 's/devServer.reloadClients(reloadTarget);/void 0;/' src/project/serve/watch.ts` | b | GNU sed from Git Bash only |
| 44 | 1036 | Task 7 / Step 1 break 5 | run `smoke/preview/preview-project-reload.test.ts` expects `timed out after 60000 ms` | b | run-tests.ps1 |
| 45 | 1037 | Task 7 / Step 1 break 6 | make `killProcess` call `Deno.kill(pid, signal)` for every pid; run `unit/process-group.test.ts`, `preview-reload.test.ts`, `preview-project-reload.test.ts` | d | explicitly "Windows only"; run on Windows machine or scratch CI |
| 46 | 1050-1053 | Task 7 / Step 3 | `git add .claude/rules/preview/overview.md` ; `git commit -m "preview rules: ..."` | a | git |
| 47 | 1046 | Task 7 / Step 2 (rule text) | manual verification via skill `/quarto-preview-test` | u | skill, not a shell command; behaviour on Windows unknown |
| 48 | 1058 | Verification | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/process-group.test.ts smoke/preview/preview-reload.test.ts smoke/preview/preview-project-reload.test.ts smoke/jupyter/daemon.test.ts smoke/inspect/inspect-pipe.test.ts` | d | duplicate of row 4; Windows expected `4 passed 4 ignored` |
| 49 | 1059 | Verification | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent $(find smoke/jupyter/ -name '*.test.ts') $(find smoke/inspect/ -name '*.test.ts')` | b | `$(...)`/GNU find needs Git Bash; PowerShell: `Get-ChildItem -Recurse -Filter *.test.ts` |
| 50 | 1060 | Verification | `quarto run --dev tools/check-runtime-boundary.ts` | b | quarto -> quarto.cmd |
| 51 | 1061 | Verification | the six local breaks of Task 7 (sixth on Windows) | d | sixth is the Windows-specific one |
| 52 | 1076 | Risks | follow `dev-docs/debugging-flaky-tests.md` (doc reference, not a command) | u | listed for completeness; not executable |

### Windows mentions
- L1 (title): "...process-group and Windows tree kill"
- L5 (Goal): "killing a process tree: through its group on POSIX, through `taskkill /T` on Windows"
- L8 (Suggested executor): "...(mtime granularity, bind races, zombies, Windows tree kills)..."
- L10 (Ships on): "every one passes on `main` once PRs 02, 08 and 09 are in, on Linux, macOS and Windows (the suite runs on `ubuntu-latest` and `windows-latest` per PR, `test-smokes.yml`)."
- L25 (Spec/Context): "Deno 2.7.14's `Deno.Command` option `detached: true` calls `setsid()` in the child on POSIX and sets `DETACHED_PROCESS`/new group on Windows"
- L28 (Spec/Context): "The Windows launcher `package/scripts/windows/quarto.cmd:168-171` runs `deno.exe` as a child of `cmd.exe` (there is no `exec` in batch)... `tests/quarto-cmd.ts:213-257` already ends test processes with `taskkill /PID <pid> /T /F`... `tasklist /FI \"PID eq <pid>\" /NH /FO CSV` prints one CSV row for a live process... `SIGTERM` listeners never fire on Windows (PR 08, `onSignal`), so Quarto's `abend` -> `exitWithCleanup(1)` path cannot be driven from a test there."
- L29 (Spec/Context): "PR 08's `killProcess(pid, signal)` runs `taskkill /PID <-pid> /T /F` for a negative pid on Windows... PR 28 keeps that contract on `node:child_process` (`nodeSpawnSync(\"taskkill\", ...)`), which is why the Windows case below is PR 28's Windows gate."
- L31-33 (Windows coverage): "#### Windows coverage (review R10, triage A5)"; "The first draft ignored five of the six tests on Windows ... This version runs the preview tests (document and website) and a Windows process-tree test on Windows, and states what has no Windows equivalent:"
- L35-41 (Windows coverage table): "no equivalent: Windows process groups are not observable from `tasklist`"; "`killProcess(-pid)` runs `taskkill /PID <pid> /T /F`; the grandchild is gone (`tasklist /FI \"PID eq\"`)"; "`killProcess(-pid)` ends the `cmd.exe` + `deno.exe` tree with `taskkill /F`; exit is non-zero, port released. The graceful `abend` path is POSIX-only coverage"; "no equivalent in this PR (needs `bash`, `head`, `wc`); Node writes Windows pipes synchronously"
- L43 (Windows coverage): "The Jupyter daemon test and both preview tests are the same code on every OS."
- L48 (Scope): "`isProcessGone` (`ps` on POSIX, `tasklist` on Windows)"
- L50 (Scope): "(3 tests: two POSIX group tests, one Windows tree-kill test)"
- L58 (Scope / Out): "Windows for the pipe tests and the two POSIX process-group tests (`ignore: isWindows` ...): no `bash`/`head`/`wc`, and no observable process groups. Everything else runs on Windows."
- L77-78 (Interfaces): "`ps -o stat=` on POSIX, `tasklist /FI \"PID eq <pid>\" /NH /FO CSV` on Windows."
- L99-100 (Interfaces): "killProcess(-pid, \"SIGTERM\") (POSIX: the group; Windows: taskkill /T on the cmd.exe + deno.exe tree)"
- L105 (Assumptions): "`killProcess(pid, signal)` with a negative pid addressing a process group on POSIX and running `taskkill /PID <-pid> /T /F` on Windows... If `detached` or the `taskkill` branch is missing, PR 08 is incomplete"
- L121-122 (Acceptance): "prints `ok | 7 passed | 0 failed | 1 ignored` on Linux and macOS (the Windows tree-kill case is ignored there), and `ok | 4 passed | 0 failed | 4 ignored` on Windows... Both preview tests, the daemon test and the Windows tree-kill test pass on Windows CI: this is the Windows evidence PRs 28 and 34 cite."; "the Windows break runs on a Windows machine or in a CI run from a scratch branch"
- L124 (Acceptance): "the Windows job's log shows the four Windows cases as passed, not ignored."
- L146, 244, 923, 331, 350, 422, 982, 1007, 187 (code): `isWindows` import / `ignore: isWindows` / `ignore: !isWindows` / `if (isWindows) {` guards
- L177 (code comment): "// POSIX only: Windows process groups are not observable from tasklist."
- L235-238 (test header): "Windows (one case): there are no observable process groups, so the case asserts the mechanism Quarto uses there, killProcess(-pid) running `taskkill /PID <pid> /T /F` on the tree, and checks the grandchild is gone through `tasklist`. The \"without detached\" case has no Windows equivalent."
- L353-358, 363, 365 (code): "// Windows: PowerShell starts `ping -n 31 127.0.0.1` (a 30 s sleep that needs no console)... `-WindowStyle Hidden` because the detached child has no console to inherit." `kWindowsScript`, `startWindowsTree`
- L394-408 (code): "process tree - killProcess(-pid) on Windows ends the detached child and its grandchild (taskkill /T)"; "taskkill /PID <pid> /T /F: the tree rooted at the child. It walks parent pids, so the same call also covers preview-server.ts, which does not spawn detached on Windows."; "taskkill /F should end the child"; "survived taskkill /T"
- L429 (Task 2 Step 2): "`ok | 1 passed | 0 failed | 2 ignored` on Windows... if the Windows case fails inside `killProcess` with a `Deno.kill` error, PR 08's `killProcess` has no `taskkill` branch"
- L435 (commit msg): "taskkill /T tree kill (Windows) through killProcess(-pid)"
- L455, 492, 546-548, 581, 681 (code comments): "on Windows it runs taskkill /T on the cmd.exe + deno.exe tree."; "stop the whole group (POSIX) or tree (Windows)"; "Windows: taskkill /F ends cmd.exe and deno.exe without a signal; the exit code is taskkill's TerminateProcess code (1), and the graceful path has no Windows equivalent."
- L650 (Task 3 Step 3): "on Linux, macOS and Windows. On Windows, `quartoDevCmd()` is `quarto.cmd`; `Deno.Command` runs it through `cmd.exe` (the existing smoke tests spawn it the same way) and `taskkill /T` ends both processes."
- L655 (Task 3 Step 4): "(the installed launcher is the same shell script or `quarto.cmd`...)"
- L768 (Task 4): "reached by SIGTERM on POSIX and not by `taskkill /F`, so it is not asserted"
- L773, 887 (run steps): "...on Linux, macOS and Windows."
- L915 (test header): "Ignored on Windows: needs bash, head and wc."
- L1037 (Task 7 break 6): "Windows only ... `Deno.kill` rejects a negative pid on Windows ... the `ping` grandchild is still listed by `tasklist`"
- L1046 (rule text): "...process tree (Windows, `taskkill /T`) ... They run on Linux, macOS and Windows."
- L1058 (Verification): "`ok | 4 passed | 0 failed | 4 ignored` (Windows), the Windows log showing the tree-kill case and both preview tests as passed."
- L1061 (Verification): "(the sixth on Windows)."
- L1066-1067, 1070, 1071 (Review checklist): "stop the process group (POSIX) or tree (Windows)... shell or `cmd.exe` launcher"; "The Windows tree-kill case runs on Windows CI (not ignored) and asserts through `tasklist`..."; "nothing downstream (PRs 28, 34) cites an ignored case as Windows evidence."; "if the website test nears the limit on Windows CI, lower its reload budget to 45 s."
- L1076-1077 (Risks): "If one flakes on macOS or Windows CI, adjust the budgets..."; "Windows tree kill: `taskkill /T` enumerates children when it runs, so a grandchild spawned after the enumeration survives... `taskkill /F` leaves no chance for cleanup, so the Windows preview tests do not assert anything `onCleanup` does (lockfile removal)."

### Windows mentions added by grep sweep at assembly
Lines matching `windows|win32|.cmd|.ps1|taskkill` (case-insensitive) that the extractor's list above did not cite. Quoted verbatim, trimmed to 300 characters; section is the nearest preceding heading.

- L1039 (Task 7: Prove each test can fail, then update the preview rule): "Expected: each of the six runs fails with the stated message; after `git checkout -- src` all pass again. Note the six failure messages (the Windows one from the Windows run) in the PR description."

## 14-ral-env.md

Extracted commands: 47 (a=10, b=24, c=4, d=0, u=9)

| # | line | section | command | class | note |
|---|---|---|---|---|---|
| 1 | 18 | Spec / Context | `grep -rhoE '\bDeno\.env\.[a-zA-Z]+' <dir> --include=*.ts \| sort \| uniq -c` | a | Git Bash grep/sort/uniq; in PowerShell `sort` is Sort-Object |
| 2 | 33 | Spec / Context | `rg -o` (by-method counts) | u | ripgrep must be installed; exact invocation not given |
| 3 | 60 | Spec / Scope | `quarto run --dev tools/codemod-deno-ral.ts --rules env --dir src` | b | quarto -> quarto.cmd |
| 4 | 67 | Spec / Landing order step 1 | `git rebase origin/main` ; `git checkout origin/main -- <file>` | a | git; destructive-op rule applies (checkout over conflicted files) |
| 5 | 68 | Spec / Landing order step 2 | `quarto run --dev tools/codemod-deno-ral.ts --rules <this PR's rules> --file <file> [--file <file>...]` | b | quarto -> quarto.cmd |
| 6 | 69 | Spec / Landing order step 3 | `package/dist/bin/tools/x86_64/deno fmt <file>...` | b | `deno` -> `deno.exe` |
| 7 | 70 | Spec / Landing order step 4 | `git add` ; `git rebase --continue` | a | git |
| 8 | 136 | Spec / Acceptance criteria | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/env.test.ts` | b | run-tests.ps1; `VAR=x cmd` prefix has no PowerShell form |
| 9 | 137 | Spec / Acceptance criteria | `quarto run --dev tools/codemod-deno-ral.ts --rules env --dir src --dry-run \| tail -1` | b | quarto -> quarto.cmd; `tail` needs Git Bash (PowerShell: `Select-Object -Last 1`) |
| 10 | 141-143 | Spec / Acceptance criteria | `rg -n '\bDeno\.env\b' src -g '*.ts' -g '!src/deno_ral/**' -g '!src/resources/**' -g '!src/core/performance/metrics.ts' \| rg -v '^[^:]+:[0-9]+:\s*(//\|/\*\|\*)'` | u | rg install; `!` globs and alternation quoting differ between bash and PowerShell; multi-line `\` continuation is bash |
| 11 | 145 | Spec / Acceptance criteria | `quarto run --dev tools/check-runtime-boundary.ts` | b | quarto -> quarto.cmd |
| 12 | 146 | Spec / Acceptance criteria | `cd src && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --unstable-ffi --import-map=import_map.json quarto.ts` | b | `deno` -> `deno.exe` |
| 13 | 226 | Task 1 / Step 2 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/env.test.ts` | b | run-tests.ps1 (expects RED: module not found) |
| 14 | 235 | Task 1 / Step 4 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/env.test.ts` | b | run-tests.ps1 (expects 5 passed) |
| 15 | 241-242 | Task 1 / Step 5 | `git add src/deno_ral/env.ts tests/unit/ral/env.test.ts` ; `git commit -m "deno_ral/env: process environment object with unit test"` | a | git |
| 16 | 249 | Task 2 / Step 1 | `quarto run --dev tools/codemod-deno-ral.ts --rules env --dir src --dry-run > /tmp/codemod-env.txt; tail -1 /tmp/codemod-env.txt` | b | quarto -> quarto.cmd; `/tmp` is %TEMP% in Git Bash only; `tail` Git Bash |
| 17 | 250 | Task 2 / Step 1 | `rg -c 'Deno\.env' <file>` (recount on six files) | u | rg install |
| 18 | 254 | Task 2 / Step 2 | `grep -E 'skipped\|collision' /tmp/codemod-env.txt` | a | Git Bash grep and /tmp |
| 19 | 266 | Task 2 / Step 2 | `grep '→' /tmp/codemod-env.txt \| awk -F'→' '{print $2}' \| sort \| uniq -c` | u | non-ASCII arrow through awk and the codemod's console encoding on Windows unverified |
| 20 | 271 | Task 2 / Step 3 | `quarto run --dev tools/codemod-deno-ral.ts --rules env --dir src \| tail -1` | b | quarto -> quarto.cmd; tail |
| 21 | 274 | Task 2 / Step 3 | `git diff --name-only \| xargs package/dist/bin/tools/x86_64/deno fmt` | b | `deno.exe`; xargs from Git Bash; PowerShell: `git diff --name-only \| ForEach-Object` |
| 22 | 277 | Task 2 / Step 3 | `cd src && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --unstable-ffi --import-map=import_map.json quarto.ts` | b | `deno.exe` |
| 23 | 283-284 | Task 2 / Step 4 | `git add src` ; `git commit -m "src: codemod Deno.env to deno_ral/env (mechanical)"` | a | git; `git add src` is broad, plan says stage explicit paths (global rule) but not a Windows issue |
| 24 | 295 | Task 3 / Step 1 | `sed -i 's/Deno\.env\./runtimeEnv./g' src/quarto.ts src/command/render/project.ts src/core/jupyter/kernels.ts src/publish/posit-connect-cloud/api/index.ts src/publish/posit-connect-cloud/posit-connect-cloud.ts src/command/call/axe/cmd.ts` | b | GNU sed via Git Bash only; `sed -i` on CRLF files unverified |
| 25 | 319 | Task 3 / Step 2 | re-run "the text check from Acceptance criteria" (the `rg` pipeline, row 10) | u | same as row 10 |
| 26 | 322 | Task 3 / Step 2 | `cd src && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --unstable-ffi --import-map=import_map.json quarto.ts` | b | `deno.exe` |
| 27 | 326-327 | Task 3 / Step 2 | `git add src/quarto.ts src/command/render/project.ts src/core/jupyter/kernels.ts src/publish/posit-connect-cloud/api/index.ts src/publish/posit-connect-cloud/posit-connect-cloud.ts src/command/call/axe/cmd.ts` ; `git commit -m "Alias deno_ral env import in files with a local env binding"` | a | git |
| 28 | 334 | Task 4 / Step 1 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/env.test.ts unit/environment.test.ts unit/dotenv-config.test.ts unit/binary-mode-strip-env.test.ts $(find unit/core/ -name '*.test.ts') $(find unit/tools/ -name '*.test.ts') $(find unit/jupyter/ -name '*.test.ts') $(find unit/project/ -name '*.test.ts') unit/github-actions-reporting.test.ts unit/chrome-launch.test.ts unit/preview-compatibility.test.ts` | b | run-tests.ps1; four `$(find ...)` need Git Bash GNU find; command line may be long |
| 29 | 339 | Task 4 / Step 2 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent $(find smoke/env/ -name '*.test.ts') smoke/website/drafts-env.test.ts smoke/project/project-prepost.test.ts smoke/project/project-simple.test.ts smoke/render/render-html.test.ts smoke/render/render-cli-metadata-file.test.ts $(find smoke/check/ -name '*.test.ts') $(find smoke/run/ -name '*.test.ts') smoke/jupyter/issue-10097.test.ts smoke/render/render-r.test.ts` | b | run-tests.ps1; `$(find ...)` Git Bash; R/Jupyter prerequisites |
| 30 | 345 | Task 4 / Step 3 (manual dotenv) | `d=$(mktemp -d) && cd "$d" && printf 'project:\n  type: default\n' > _quarto.yml && printf 'MY_DOTENV_VAR=hello\n' > _environment && printf -- '---\ntitle: t\n---\n\n`r Sys.getenv("MY_DOTENV_VAR")`\n' > index.qmd && package/dist/bin/quarto render index.qmd --to md 2>&1 \| tail -2; cat index.md \| tail -3` | c | bash-only (mktemp/printf/cat); `package/dist/bin/quarto` is relative and breaks after `cd "$d"` on any OS (plan bug); needs `quarto.cmd`; needs R |
| 31 | 347 | Task 4 / Step 3 (manual dotenv) | `QUARTO_LOG_LEVEL=DEBUG package/dist/bin/quarto render index.qmd --to html 2>&1 \| grep -c 'MY_DOTENV_VAR'` | c | `VAR=x cmd` bash-only; same relative path issue; quarto.cmd |
| 32 | 357 | Task 4 / Step 4 | `quarto run --dev tools/check-runtime-boundary.ts --update-baseline && quarto run --dev tools/check-runtime-boundary.ts` | b | quarto -> quarto.cmd |
| 33 | 358 | Task 4 / Step 4 | `git diff tools/runtime-boundary-baseline.json` | a | git |
| 34 | 363-364 | Task 4 / Step 5 | `git add tools/runtime-boundary-baseline.json .claude/rules/typescript/deno-ral.md` ; `git commit -m "Lower runtime boundary baseline after env codemod; document deno_ral/env"` | a | git |
| 35 | 369 | Verification | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/env.test.ts` | b | duplicate of row 13/14 |
| 36 | 370 | Verification | Task 4 steps 1-2 (rows 28-29) | b | see rows 28-29 |
| 37 | 371 | Verification | AST check and text check from Acceptance criteria (rows 9, 10) | u | text check uses rg |
| 38 | 372 | Verification | `quarto run --dev tools/check-runtime-boundary.ts` | b | quarto -> quarto.cmd |
| 39 | 373 | Verification | `cd src && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --unstable-ffi --import-map=import_map.json quarto.ts` | b | `deno.exe` |
| 40 | 374 | Verification (manual) | `QUARTO_PROFILE=x package/dist/bin/quarto render tests/docs/test.qmd` | c | `VAR=x cmd` bash-only; quarto.cmd |
| 41 | 374 | Verification (manual) | `package/dist/bin/quarto check` | b | quarto -> quarto.cmd |
| 42 | 374 | Verification (manual) | `QUARTO_CAPTURE_RENDER_COMMAND=$(mktemp -d) package/dist/bin/quarto render tests/docs/test.qmd` | c | `VAR=$(mktemp -d) cmd` bash-only; quarto.cmd; capture directory path conversion on Windows |
| 43 | 250 | Task 2 / Step 1 (expected output) | codemod dry-run expectation `Summary: 624 files scanned, 50 would be rewritten, 149 replacements, 6 with collisions, 2 skipped` | u | counts could differ on Windows (CRLF/paths) only if codemod path handling differs; unverified |
| 44 | 256-263 | Task 2 / Step 2 (expected output) | six `collision:` lines with `/` path separators (`src/quarto.ts:87: ...`) | u | codemod may print backslash paths on Windows; plan expects forward slashes |
| 45 | 131 | Spec / Files | `package/dist/bin/tools/x86_64/deno fmt` inside commit step (see row 6) | b | duplicate of row 6 |
| 46 | 1-396 | whole file | "Phase 1 ... Ships on: Deno; the existing test suite must stay green" (run full suite) | u | no explicit command |
| 47 | 349-358 | Task 4 / Step 4 | rule-doc edit table row (no command) | a | file edit only |

### Windows mentions
none


## 15-ral-net-async-ports.md

Extracted commands: 41 (a=17, b=17, c=0, d=3, u=4)

| # | line | section | command | class | note |
|---|---|---|---|---|---|
| 1 | 30 | Spec / Scope | `grep -rn 'isPortAvailableSync\|getAvailablePortSync' src tests package` | a | Git Bash grep |
| 2 | 118 | Spec / Acceptance criteria | `grep -rn 'Deno\.connect\|Deno\.listen\|Deno\.Conn\b' src --include=*.ts \| grep -v '^src/deno_ral/' \| grep -v extension-subtrees` | a | Git Bash grep pipeline |
| 3 | 119 | Spec / Acceptance criteria | `grep -rn 'isPortAvailableSync\|getAvailablePortSync' src tests package --include=*.ts` | a | Git Bash grep |
| 4 | 120 | Spec / Acceptance criteria | `grep -rn 'findOpenPort(' src tests --include=*.ts \| grep -v 'await findOpenPort\|async function findOpenPort\|export function findOpenPort\|import'` | a | Git Bash grep pipeline |
| 5 | 121 | Spec / Acceptance criteria | `grep -n 'Deno\.' tests/unit/ral/net.test.ts` | a | Git Bash grep |
| 6 | 122 | Spec / Acceptance criteria | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/net.test.ts` | b | run-tests.ps1 |
| 7 | 123 | Spec / Acceptance criteria | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/chrome-launch.test.ts unit/chrome-launch-flags.test.ts smoke/axe/axe-transport-failclosed.test.ts smoke/jupyter/daemon.test.ts smoke/preview/preview-reload.test.ts` | b | run-tests.ps1; Chrome-dependent cases; 14b tests run on Windows |
| 8 | 124 | Spec / Acceptance criteria | `quarto run --dev tools/check-runtime-boundary.ts` (and `--update-baseline`) | b | quarto -> quarto.cmd |
| 9 | 243 | Task 1 / Step 2 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/net.test.ts` | b | run-tests.ps1 (expects RED) |
| 10 | 344 | Task 1 / Step 4 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/net.test.ts` | b | run-tests.ps1 (expects 5 passed); `isPortAvailable` on Windows binds with `Deno.listen`, exclusive-address semantics unverified |
| 11 | 350-351 | Task 1 / Step 5 | `git add src/deno_ral/net.ts tests/unit/ral/net.test.ts` ; `git commit -m "deno_ral: add net.ts ..."` | a | git |
| 12 | 445 | Task 2 / Step 1 | `grep -n 'ld\.\|randomInt' src/core/port.ts` | a | Git Bash grep |
| 13 | 449 | Task 2 / Step 2 | `cd src && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --import-map=import_map.json quarto.ts 2>&1 \| grep -E '^error\|ERROR' \| head -20` | b | `deno.exe`; Git Bash grep/head; plan notes `aarch64` only for macOS arm64 |
| 14 | 456-457 | Task 2 / Step 3 | `git add src/core/port.ts` ; `git commit -m "core/port: findOpenPort and waitForPort are async on deno_ral/net"` | a | git |
| 15 | 486 | Task 3 / Step 1 | `sed -n 360,380p` (check enclosing function is async) | b | works in Git Bash; Read tool preferred per user rules |
| 16 | 549 | Task 3 / Step 3 | `grep -n kLocalhost src/command/preview/preview-shiny.ts` | a | Git Bash grep |
| 17 | 553 | Task 3 / Step 4 | `grep -n 'externalPreviewServer(' src/project/serve/serve.ts` | a | Git Bash grep |
| 18 | 592 | Task 3 / Step 6 | `cd src && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --import-map=import_map.json quarto.ts` | b | `deno.exe` |
| 19 | 595 | Task 3 / Step 6 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/chrome-launch.test.ts unit/chrome-launch-flags.test.ts smoke/axe/axe-transport-failclosed.test.ts smoke/preview/preview-reload.test.ts` | b | run-tests.ps1; line 596 claims `preview-reload` "is ignored on Windows", contradicting PR 14b (runs on Windows) |
| 20 | 598 | Task 3 / Step 6 (manual) | `package/dist/bin/quarto preview tests/docs/smoke-all/2023/05/24/5657-raw.qmd --no-browser --port 4321` (run twice, Ctrl-C the first) | b | quarto -> quarto.cmd; two terminals; Windows Ctrl-C on cmd.exe launcher may orphan deno.exe (see 14b L28) |
| 21 | 603-604 | Task 3 / Step 7 | `git add src/core/previewurl.ts src/command/preview/preview.ts src/command/preview/preview-shiny.ts src/project/serve/serve.ts src/command/call/axe/cmd.ts src/core/cri/cri.ts src/core/cri/launch.ts tests/unit/chrome-launch.test.ts tests/unit/chrome-launch-flags.test.ts tests/smoke/axe/axe-transport-failclosed.test.ts` ; `git commit -m "await the async findOpenPort at every caller; ..."` | a | git |
| 22 | 693 | Task 4 / Step 5 | `cd src && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --import-map=import_map.json quarto.ts` | b | `deno.exe` |
| 23 | 696 | Task 4 / Step 5 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent $(find smoke/jupyter/ -name '*.test.ts')` | b | run-tests.ps1; `$(find ...)` Git Bash |
| 24 | 702-703 | Task 4 / Step 6 | `git add src/execute/jupyter/jupyter-kernel.ts` ; `git commit -m "jupyter-kernel: connect to the kernel daemon through deno_ral/net TcpConnection"` | a | git |
| 25 | 714 | Task 5 / Step 1 | `quarto run --dev tools/check-runtime-boundary.ts --update-baseline` | b | quarto -> quarto.cmd |
| 26 | 728-729 | Task 5 / Step 3 | `git add tools/runtime-boundary-baseline.json .claude/rules/typescript/deno-ral.md` ; `git commit -m "ratchet baseline after net.ts; document net.ts in deno-ral rules"` | a | git |
| 27 | 734 | Verification | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/net.test.ts` | b | run-tests.ps1 (dup of row 9/10) |
| 28 | 735 | Verification | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/chrome-launch.test.ts unit/chrome-launch-flags.test.ts smoke/axe/axe-transport-failclosed.test.ts $(find smoke/jupyter/ -name '*.test.ts') smoke/preview/preview-reload.test.ts` | b | run-tests.ps1; `$(find)` Git Bash |
| 29 | 736 | Verification | `quarto run --dev tools/check-runtime-boundary.ts` | b | quarto -> quarto.cmd |
| 30 | 737 | Verification | `grep -rn 'Deno\.connect\|Deno\.listen\|Deno\.Conn\b' src --include=*.ts \| grep -v '^src/deno_ral/' \| grep -v extension-subtrees` | a | Git Bash grep (dup of row 2) |
| 31 | 738 | Verification (manual) | `package/dist/bin/quarto preview <qmd> --port 4321` twice; second fails with "already in use" | b | quarto -> quarto.cmd |
| 32 | 738 | Verification (manual) | `curl -s http://127.0.0.1:<port>/` (answers) | a | curl.exe present on Win 11 and Git Bash |
| 33 | 738 | Verification (manual) | `curl -s http://<lan-ip>:<port>/` (refused) | u | needs a LAN IP lookup (`ipconfig` on Windows); Windows firewall can alter refusal vs timeout |
| 34 | 738 | Verification (manual) | Shiny document preview with a render token prints `Preview service running (<port>)` | u | needs R Shiny setup; unclear on Windows |
| 35 | 20 | Spec / Context (test reference) | `tests/smoke/jupyter/daemon.test.ts` renders twice with `--execute-daemon` | d | 14b test, README lists Windows for 14b |
| 36 | 31 | Spec / Scope | await edits at 15 call sites (list) | a | file edits only |
| 37 | 614-617 | Task 4 / Step 1 | add `import { connectTcp, TcpConnection } from "../../deno_ral/net.ts";` (no command) | a | file edit |
| 38 | 646 | Task 4 / Step 2 (code) | `conn.write(messageBytes)` of kernel command with >1 KB temp file | u | Windows temp-file path and TCP truncation reports (#7737) not exercised on Windows |
| 39 | 698 | Task 4 / Step 5 | daemon test goes through `executeKernelKeepalive` -> `connectToKernel` -> `tcpConnectToKernel` | d | 14b daemon test covers Windows |
| 40 | 123 | Spec / Acceptance criteria | `smoke/preview/preview-reload.test.ts` (14b) in the combined run | d | 14b test, Windows listed |
| 41 | 596 | Task 3 / Step 6 | "Chrome-dependent cases are skipped with a warning when Chrome is absent" | u | Chrome availability on Windows dev box unknown |

### Windows mentions
- L596 (Task 3 Step 6): "Expected: `ok | N passed | 0 failed` (Chrome-dependent cases are skipped with a warning when Chrome is absent; `preview-reload` is ignored on Windows)." (conflicts with 14b, where `preview-reload.test.ts` runs on Windows)
- L614 (Task 4 Step 1): "Add after line 26 (`import { isWindows } ...`):" (source-code reference, not a Windows behaviour statement)


## 16-ral-http.md

Extracted commands: 38 (a=12, b=18, c=1, d=1, u=6)

| # | line | section | command | class | note |
|---|---|---|---|---|---|
| 1 | 151 | Spec / Acceptance criteria | `grep -rn 'Deno\.serve\|Deno\.upgradeWebSocket\|Deno\.HttpServer\|Deno\.ServeHandler' src --include=*.ts \| grep -v '^src/deno_ral/'` | a | Git Bash grep |
| 2 | 152 | Spec / Acceptance criteria | `grep -n 'Deno\.' tests/unit/ral/http.test.ts` | a | Git Bash grep |
| 3 | 153 | Spec / Acceptance criteria | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/http.test.ts` | b | run-tests.ps1 |
| 4 | 154 | Spec / Acceptance criteria | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/preview/preview-reload.test.ts unit/preview-compatibility.test.ts unit/preview-brand-cache.test.ts unit/axe-config.test.ts $(find smoke/axe/ -name '*.test.ts')` | b | run-tests.ps1; `$(find)` Git Bash |
| 5 | 155 | Spec / Acceptance criteria | `quarto preview <doc> --no-browser --port 4321 2>/dev/null` (and `2>&1 >/dev/null`) | b | quarto -> quarto.cmd; `2>/dev/null` and `2>&1 >/dev/null` redirection order are bash (PowerShell: `2>$null`, no equivalent of the swap) |
| 6 | 156 | Spec / Acceptance criteria | `grep -n 'server.listening' src/project/serve/serve.ts src/command/preview/preview-shiny.ts src/command/call/axe/cmd.ts` | a | Git Bash grep |
| 7 | 351 | Task 1 / Step 2 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/http.test.ts` | b | run-tests.ps1 (expects RED) |
| 8 | 505 | Task 1 / Step 4 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/http.test.ts` | b | run-tests.ps1 (expects 8 passed); the test pins `Listening on` Windows host mapping only in source, not asserted |
| 9 | 511-512 | Task 1 / Step 5 | `git add src/deno_ral/http.ts tests/unit/ral/http.test.ts` ; `git commit -m "deno_ral: add http.ts ..."` | a | git |
| 10 | 629 | Task 2 / Step 5 | `cd src && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --import-map=import_map.json quarto.ts` | b | `deno.exe` |
| 11 | 634 | Task 2 / Step 6 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/axe-config.test.ts $(find smoke/axe/ -name '*.test.ts') smoke/preview/preview-reload.test.ts` | b | run-tests.ps1; `$(find)` Git Bash |
| 12 | 640-641 | Task 2 / Step 7 | `git add src/core/http-server.ts src/project/serve/serve.ts src/command/preview/preview-shiny.ts src/command/call/axe/cmd.ts` ; `git commit -m "core/http-server on deno_ral/http; ..."` | a | git |
| 13 | 685 | Task 3 / Step 3 | `cd src && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --import-map=import_map.json quarto.ts` | b | `deno.exe` |
| 14 | 688 | Task 3 / Step 3 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/preview/preview-reload.test.ts unit/preview-compatibility.test.ts unit/preview-initial-path.test.ts` | b | run-tests.ps1 |
| 15 | 691 | Task 3 / Step 3 (manual) | `package/dist/bin/quarto preview tests/docs/smoke-all/2023/05/24/5657-raw.qmd --no-browser --port 4321 2>&1 >/dev/null \| grep Listening` | c | `2>&1 >/dev/null` stream swap is bash-only; on Windows launcher .cmd stderr handling through cmd.exe may differ; quarto.cmd |
| 16 | 691 | Task 3 / Step 3 (manual) | `package/dist/bin/quarto preview ... --no-browser --port 4321 2>/dev/null \| grep -c Listening` (expects `0`) | b | quarto -> quarto.cmd; `/dev/null` fine in Git Bash |
| 17 | 691 | Task 3 / Step 3 (manual) | "Ctrl-C exits with no stack trace" | u | Windows Ctrl-C through the cmd.exe launcher (batch "Terminate batch job (Y/N)?" prompt) unverified |
| 18 | 696-697 | Task 3 / Step 4 | `git add src/command/preview/preview.ts` ; `git commit -m "preview: serve through deno_ral/http serveHttp"` | a | git |
| 19 | 791 | Task 4 / Step 5 | `cd src && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --import-map=import_map.json quarto.ts` | b | `deno.exe` |
| 20 | 794 | Task 4 / Step 5 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/preview/preview-reload.test.ts unit/preview-compatibility.test.ts unit/preview-brand-cache.test.ts` | b | run-tests.ps1 |
| 21 | 797 | Task 4 / Step 5 (manual) | `package/dist/bin/quarto preview tests/docs/smoke-all/2023/05/24/5657-raw.qmd --timeout 5`, edit title, close tab, exits after 5 s | b | quarto -> quarto.cmd; browser interaction |
| 22 | 797 | Task 4 / Step 5 (manual) | skill `/quarto-preview-test` topics "live reload" and "timeout" | u | skill procedure; Windows applicability unknown |
| 23 | 802-803 | Task 4 / Step 6 | `git add src/core/http-devserver.ts` ; `git commit -m "core/http-devserver: ..."` | a | git |
| 24 | 813 | Task 5 / Step 1 | `quarto run --dev tools/check-runtime-boundary.ts --update-baseline` | b | quarto -> quarto.cmd |
| 25 | 825-826 | Task 5 / Step 3 | `git add tools/runtime-boundary-baseline.json .claude/rules/typescript/deno-ral.md` ; `git commit -m "ratchet baseline after http.ts; ..."` | a | git |
| 26 | 831 | Verification | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/http.test.ts` | b | run-tests.ps1 |
| 27 | 832 | Verification | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/preview/preview-reload.test.ts unit/preview-compatibility.test.ts unit/preview-brand-cache.test.ts $(find smoke/axe/ -name '*.test.ts') unit/axe-config.test.ts` | b | run-tests.ps1; `$(find)` Git Bash |
| 28 | 833 | Verification | `quarto run --dev tools/check-runtime-boundary.ts` | b | quarto -> quarto.cmd |
| 29 | 834 | Verification | `grep -rn 'Deno\.serve\|Deno\.upgradeWebSocket\|Deno\.listen' src --include=*.ts \| grep -v '^src/deno_ral/' \| grep -v extension-subtrees` | a | Git Bash grep |
| 30 | 835 | Verification (manual) | `package/dist/bin/quarto preview tests/docs/website-image-base --no-browser` serves the website, reloads on an edit | b | quarto -> quarto.cmd |
| 31 | 30 | Spec / Context (reference) | `tests/smoke/preview/preview-reload.test.ts` (14b) drives preview end to end | d | 14b test, README lists Windows |
| 32 | 28 | Spec / Context | Deno default `Listening on` line: `<host>` is `localhost` for `0.0.0.0`/`::` on Windows | u | expected-output claim; `writeStderrSync` reproduces it, not verified on Windows |
| 33 | 400 | Task 1 / Step 3 (code) | `writeStderrSync(...)` for `Listening on http://<host>:<port>/` | u | behaviour on Windows hosts unverified |
| 34 | 506 | Task 1 / Step 4 | resource-sanitizer note: read fetch body before abort | a | no command |
| 35 | 851 | Risks | stop/shutdown sequencing note (no command) | a | no command |
| 36 | 298 | Task 1 / Step 1 (test-internal) | raw `node:net` `connect(port, kHost)` and `socket.write("GET / HTTP/1.1\r\nHost: ...")` keep-alive test | u | keep-alive teardown/`closeIdleConnections` semantics on Windows unverified |
| 37 | 325 | Task 1 / Step 1 (test-internal) | `new WebSocket("ws://127.0.0.1:<port>/")` against `upgradeWebSocket` | a | cross-platform global WebSocket |
| 38 | 246-252 | Task 1 / Step 1 (test-internal) | abort then `fetch()` expects connection refused | u | Windows connection-refused timing (RST vs 1s retry) unverified |

### Windows mentions
- L28 (Spec / Context): "...logs `Listening on <scheme><host>:<port>/` through `import.meta.log(\"info\", …)`, i.e. on stderr, where `<host>` is `localhost` for `0.0.0.0`/`::` on Windows and bracketed for IPv6, and appends ` (http://localhost:<port>/)` when bound to `0.0.0.0`/`::` elsewhere."
- L77 (Interfaces, doc comment): "` (http://localhost:<port>/)` when bound to 0.0.0.0 or :: (not on Windows, where such a host is shown as localhost)."
- L367, L392 (code): `import { isWindows } from "./platform.ts";` and `const host = isWindows && wildcard`
- L839 (Review checklist): "`serveHttp`'s default `onListen` writes Deno's exact text to stderr (helper suffix for `0.0.0.0`/`::`, `localhost` on Windows, IPv6 brackets) and nothing to stdout."


## 17-ral-watch.md

Extracted commands: 26 (a=7, b=11, c=2, d=0, u=6)

| # | line | section | command | class | note |
|---|---|---|---|---|---|
| 1 | 89 | Spec / Acceptance criteria | `grep -rn 'Deno\.watchFs\|Deno\.FsEvent\|Deno\.FsWatcher' src tests package --include=*.ts \| grep -v '^src/deno_ral/' \| grep -v extension-subtrees` | a | Git Bash grep |
| 2 | 90 | Spec / Acceptance criteria | `grep -n 'Deno\.' tests/unit/ral/watch.test.ts` | a | Git Bash grep |
| 3 | 91 | Spec / Acceptance criteria | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/watch.test.ts` ("passes on Linux, macOS and Windows CI") | b | run-tests.ps1; Windows CI explicitly expected; unit test is not a 14b test so (d) does not apply |
| 4 | 92 | Spec / Acceptance criteria | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/preview/preview-reload.test.ts` ("ignored on Windows") | b | run-tests.ps1; stated "ignored on Windows" contradicts 14b (preview-reload runs on Windows) |
| 5 | 235 | Task 1 / Step 2 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/watch.test.ts` | b | run-tests.ps1 (expects RED) |
| 6 | 305 | Task 1 / Step 4 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/watch.test.ts` | b | run-tests.ps1 (expects 3 passed); Windows 8.3 short temp path handled by `canonicalPathSync` per L159 |
| 7 | 311-312 | Task 1 / Step 5 | `git add src/deno_ral/watch.ts tests/unit/ral/watch.test.ts` ; `git commit -m "deno_ral: add watch.ts ..."` | a | git |
| 8 | 350 | Task 2 / Step 2 | `grep -n '^import' src/core/watch.ts` (before and after) | a | Git Bash grep |
| 9 | 377 | Task 2 / Step 4 | `cd src && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --import-map=import_map.json quarto.ts` | b | `deno.exe` |
| 10 | 380 | Task 2 / Step 4 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/preview/preview-reload.test.ts unit/preview-compatibility.test.ts` | b | run-tests.ps1 |
| 11 | 383 | Task 2 / Step 4 (manual) | `package/dist/bin/quarto preview tests/docs/smoke-all/2023/05/24/5657-raw.qmd --no-browser` | b | quarto -> quarto.cmd |
| 12 | 383 | Task 2 / Step 4 (manual) | `touch src/core/watch.ts` (preview then prints `quarto src code changed: preview terminating`, exit code 1) | c | `touch` Git Bash only (PowerShell: `(Get-Item).LastWriteTime = Get-Date`); native `Deno.watchFs` on Windows and exit code via cmd.exe launcher unverified |
| 13 | 388-389 | Task 2 / Step 5 | `git add src/core/quarto.ts src/core/watch.ts src/project/serve/watch.ts` ; `git commit -m "watchers typed with deno_ral/watch FsEvent; ..."` | a | git |
| 14 | 394 | Task 3 / Step 1 | `quarto run --dev tools/check-runtime-boundary.ts --update-baseline` | b | quarto -> quarto.cmd |
| 15 | 404-405 | Task 3 / Step 3 | `git add tools/runtime-boundary-baseline.json .claude/rules/typescript/deno-ral.md` ; `git commit -m "ratchet baseline after watch.ts; document watch.ts"` | a | git |
| 16 | 410 | Verification | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/watch.test.ts` | b | dup of rows 5/6 |
| 17 | 411 | Verification | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/preview/preview-reload.test.ts unit/preview-compatibility.test.ts` | b | dup of row 10 |
| 18 | 412 | Verification | `quarto run --dev tools/check-runtime-boundary.ts` | b | quarto -> quarto.cmd |
| 19 | 413 | Verification (manual) | dev-mode src watcher check (Task 2 step 4) | c | see row 12 |
| 20 | 20 | Spec / Context | `Deno.watchFs([srcDir], { recursive: true })` in dev mode only (quartoConfig.isDebug()) | u | native watcher on Windows paths, not a command |
| 21 | 160 | Task 1 / Step 1 (test-internal) | `canonicalPathSync(makeTempDirSync({ prefix: "quarto-watch-test" }))` then `watchFs([dir], { recursive: true })` | u | Windows 8.3 short temp path / drive-letter case: comment says handled; path equality via `dir + SEP` unverified |
| 22 | 165 | Task 1 / Step 1 (test-internal) | 200 ms registration delay then `writeTextFileSync`, 5 s event timeout | u | Windows ReadDirectoryChangesW latency; plan itself flags flakiness risk (L426) |
| 23 | 222 | Task 1 / Step 1 (test-internal) | `watchFs([join(makeTempDirSync(...), "nope")])` expects throw | a | plan explicitly uses a path under a fresh temp dir so it is missing on every OS (L231) |
| 24 | 426 | Risks | follow `dev-docs/debugging-flaky-tests.md`; raise `kEventTimeoutMs` to 10000 | u | doc reference, not a command |
| 25 | 427 | Risks | Spike #2 / `denoland/deno#36937` | u | Phase 2 reference, not a command |
| 26 | 91 | Spec / Acceptance criteria | "passes on Linux, macOS and Windows CI" (CI evidence) | u | not README 14b-listed (PR 17 not in README Windows set); treat as CI claim, no local Windows manual step defined |

### Windows mentions
- L91 (Acceptance criteria): "`cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/watch.test.ts` passes on Linux, macOS and Windows CI."
- L92 (Acceptance criteria): "`...smoke/preview/preview-reload.test.ts` passes (polling watcher path; ignored on Windows)." (conflicts with 14b)
- L159 (test code comment): "Watch the canonical path: macOS FSEvents reports /private/var/... for a /var/... temp dir, and Windows may hand out an 8.3 short temp path."
- L231 (note below test): "It uses a path under a fresh temp dir so it is missing on every OS, including Windows where `/definitely/...` is drive-relative."


## 18-ral-kv.md

Extracted commands: 36 (a=13, b=15, c=2, d=0, u=6)

| # | line | section | command | class | note |
|---|---|---|---|---|---|
| 1 | 95 | Spec / Acceptance criteria | `grep -rn 'Deno\.openKv\|Deno\.Kv\b\|Deno\.KV' src tests package --include=*.ts \| grep -v '^src/deno_ral/'` | a | Git Bash grep |
| 2 | 96 | Spec / Acceptance criteria | `grep -n 'Deno\.' tests/unit/ral/kv.test.ts tests/unit/ral/kv-writer.ts` | a | Git Bash grep |
| 3 | 97 | Spec / Acceptance criteria | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/kv.test.ts unit/sass-cache.test.ts` | b | run-tests.ps1 |
| 4 | 98 | Spec / Acceptance criteria | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/check/check-project-config-only.test.ts smoke/render/render-html.test.ts $(find smoke/project/ -name '*.test.ts')` | b | run-tests.ps1; `$(find)` Git Bash |
| 5 | 99 | Spec / Acceptance criteria | after two renders of `tests/docs/website-image-base`, check `.quarto/project-cache/` has `index.kv` and the user Sass cache dir has `sass-index.kv` and `<32 hex>-<32 hex>.css` | b | cache dir on Windows is `%LOCALAPPDATA%\quarto\sass` per L770; listing via PowerShell `Get-ChildItem` |
| 6 | 164-174 | Task 1 / Step 2 (test-internal) | `exec(execPath(), { args: ["run","--no-lock","--unstable-kv","--allow-all","--import-map=<path>","<kv-writer.ts>", dir, name, prefix, "50"] })` x2 in parallel | a | spawns bundled Deno directly; cross-platform. Two-process SQLite write contention on Windows unverified though (see row 28) |
| 7 | 317 | Task 1 / Step 3 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/kv.test.ts` | b | run-tests.ps1 (expects RED) |
| 8 | 405 | Task 1 / Step 5 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/kv.test.ts` | b | run-tests.ps1 (expects 8 passed) |
| 9 | 411-412 | Task 1 / Step 6 | `git add src/deno_ral/kv.ts tests/unit/ral/kv.test.ts tests/unit/ral/kv-writer.ts` ; `git commit -m "deno_ral: add kv.ts ..."` | a | git |
| 10 | 546 | Task 2 / Step 6 | `cd src && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --import-map=import_map.json quarto.ts` | b | `deno.exe` |
| 11 | 549 | Task 2 / Step 6 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/check/check-project-config-only.test.ts smoke/render/render-html.test.ts` | b | run-tests.ps1 |
| 12 | 555-556 | Task 2 / Step 7 | `git add src/core/cache/cache.ts` ; `git commit -m "core/cache: project cache index on deno_ral/kv ..."` | a | git |
| 13 | 612 | Task 3 / Step 1 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/sass-cache.test.ts` | b | run-tests.ps1 (expects RED) |
| 14 | 764 | Task 3 / Step 6 | `cd src && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --import-map=import_map.json quarto.ts` | b | `deno.exe` |
| 15 | 767 | Task 3 / Step 6 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/sass-cache.test.ts smoke/render/render-html.test.ts` | b | run-tests.ps1 |
| 16 | 770 | Task 3 / Step 6 (manual) | `cd tests/docs/website-image-base && QUARTO_LOG_LEVEL=DEBUG ../../../package/dist/bin/quarto render 2>&1 \| grep -c 'cache hit'` (run twice) | c | `VAR=x cmd` bash-only; relative `package/dist/bin/quarto` -> `quarto.cmd`; `grep -c` Git Bash |
| 17 | 770 | Task 3 / Step 6 (manual) | list user Sass cache: `~/.cache/quarto/sass` (Linux), `~/Library/Caches/quarto/sass` (macOS), `%LOCALAPPDATA%\quarto\sass` (Windows) | b | use the Windows path with `dir`/`Get-ChildItem`; `quartoCacheDir` in `src/core/appdirs.ts` is authority |
| 18 | 770 | Task 3 / Step 6 (manual) | `ls tests/docs/website-image-base/.quarto/project-cache/` (shows `index.kv`) | a | ls in Git Bash/PowerShell |
| 19 | 770 | Task 3 / Step 6 (manual) | remove the website's `_site` and `.quarto` afterwards; `git status --short tests/docs/website-image-base` clean | u | removal command unspecified; destructive: dry run first per global rules; `git status` is (a) |
| 20 | 775-776 | Task 3 / Step 7 | `git add src/core/sass/cache.ts tests/unit/sass-cache.test.ts` ; `git commit -m "core/sass/cache: index on deno_ral/kv ..."` | a | git |
| 21 | 781 | Task 4 / Step 1 | `quarto run --dev tools/check-runtime-boundary.ts --update-baseline` | b | quarto -> quarto.cmd |
| 22 | 791-792 | Task 4 / Step 3 | `git add tools/runtime-boundary-baseline.json .claude/rules/typescript/deno-ral.md` ; `git commit -m "ratchet baseline after kv.ts; document kv.ts"` | a | git |
| 23 | 797 | Verification | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/kv.test.ts unit/sass-cache.test.ts` | b | dup of row 3 (expects `10 passed`) |
| 24 | 798 | Verification | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/check/check-project-config-only.test.ts smoke/render/render-html.test.ts $(find smoke/project/ -name '*.test.ts')` | b | dup of row 4 |
| 25 | 799 | Verification | `quarto run --dev tools/check-runtime-boundary.ts` | b | quarto -> quarto.cmd |
| 26 | 800 | Verification | `grep -rn 'Deno\.openKv\|Deno\.Kv\b\|Deno\.KV' src tests --include=*.ts \| grep -v '^src/deno_ral/'` | a | Git Bash grep |
| 27 | 801 | Verification (manual) | Manual Sass cache reuse and file layout (Task 3 step 6) | c | see row 16 |
| 28 | 817 | Risks | if two-process test fails with `database is locked`, add retry of `kv.set` (5 x 50 ms) in `kv.ts` | u | Windows SQLite locking behaviour with two writer processes is the unverified risk |
| 29 | 819 | Risks | `grep -rn 'clear()' tests` | a | Git Bash grep |
| 30 | 99 | Spec / Context | project cache at `.quarto/project-cache/index.kv`, `Deno.openKv(<path>.kv)` SQLite file | u | Deno KV on Windows with path under `%LOCALAPPDATA%`; long-path / OneDrive placeholder issues not considered |
| 31 | 357 | Task 1 / Step 4 (code) | `join(dir, `${name}.kv`)` then `Deno.openKv(path)` | a | cross-platform path join via `deno_ral/path.ts` |
| 32 | 155-158 | Task 1 / Step 2 (test-internal) | `fromFileUrl(new URL("./kv-writer.ts", import.meta.url))`, `--import-map=${kImportMap}` | a | `fromFileUrl` handles `file:///C:/...`; fine |
| 33 | 208-213 | Task 1 / Step 2 (test-internal) | `readDirSync(dir)` expects a file starting `index.` | a | cross-platform |
| 34 | 606 | Task 3 / Step 1 (test) | `safeRemoveIfExists(dir)` on temp dir containing an open-then-closed `.kv` | u | Windows file handle release (error 32 in cleanup) risk, see memory note on withTempDir |
| 35 | 98 | Spec / Acceptance criteria | `smoke/render/render-html.test.ts` Sass cache hits during HTML render | u | needs bundled dart-sass; Windows sass compile unverified here |
| 36 | 10 | Spec / Header | "`--unstable-kv` flag stays in every launcher" (launchers: `quarto.cmd` on Windows) | u | assertion about launchers; `quarto.cmd` contains the flag? unverified |

### Windows mentions
- L251 (Task 1 test code): `return exec(c.cmd, { args: c.args });` (grep hit for `.cmd` on `c.cmd` property, not Windows-specific)
- L770 (Task 3 Step 6): "Then list the user cache (`~/.cache/quarto/sass` on Linux, `~/Library/Caches/quarto/sass` on macOS, `%LOCALAPPDATA%\quarto\sass` on Windows; `quartoCacheDir` in `src/core/appdirs.ts`, honouring `XDG_CACHE_HOME` on Linux)..."


## 19-ral-platform-main-permissions.md

Extracted commands: 44 (a=24, b=19, c=1, d=0, u=0)

| # | line | section | command | class | note |
|---|---|---|---|---|---|
| 1 | 18 | Spec > Context | `grep -rn 'Deno\.\(version\|consoleSize\|inspect\|uid\|noColor\|build\|permissions\)' src tests package/src tools --include=*.ts` | (a) | [GREP] |
| 2 | 18 | Spec > Context | `grep -rn 'import\.meta\.main' ...` | (a) | [GREP]; arguments elided in the plan ("...") |
| 3 | 100 | Acceptance criteria | `grep -rn 'Deno\.\(version\|...\)' src tests package/src --include=*.ts \| grep -v '^src/deno_ral/platform.ts' \| grep -v extension-subtrees \| grep -v 'compile-quarto-latexmk.ts'` | (a) | [GREP] |
| 4 | 101 | Acceptance criteria | `grep -rn 'import\.meta\.main' src/quarto.ts src/command package/src --include=*.ts \| grep -v 'render/latexmk/quarto-latexmk.ts'` | (a) | [GREP] |
| 5 | 102 | Acceptance criteria | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/platform.test.ts unit/tools/tinytex-writable.test.ts` | (b) | [RT] |
| 6 | 103 | Acceptance criteria | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent $(find smoke/check/ -name '*.test.ts') unit/project/project-detect-denied-path.test.ts smoke/project/project-detect-denied-config.test.ts unit/chrome-launch.test.ts smoke/create/create.test.ts` | (b) | [RT]; `$(find)` bash-only; denied-path tests use icacls on Windows (makeUnreadableDir) so behaviour differs, phase 2 should check |
| 7 | 104 | Acceptance criteria | `package/dist/bin/quarto check` (still prints `Deno version 2.7.14: OK`) | (b) | [Q] |
| 8 | 104 | Acceptance criteria | `package/dist/bin/quarto --version` | (b) | [Q] |
| 9 | 104 | Acceptance criteria | `package/src/quarto-bld --help` | (b) | [QB] |
| 10 | 105 | Acceptance criteria | `quarto install tinytex` (behaviour unchanged) | (c) | [Q]; real install with side effects; the darwin-only /usr/local/bin prerequisite is not exercised on Windows |
| 11 | 106 | Acceptance criteria | `grep -n 'Deno\.' src/resources/editor/tools/vs-code.mjs src/resources/editor/tools/yaml/web-worker.js` | (a) | [GREP] |
| 12 | 266 | Task 1 Step 3 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/platform.test.ts` | (b) | [RT]; test runs fixtures as child processes via execPath(), unverified on Windows |
| 13 | 383 | Task 1 Step 5 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/platform.test.ts` | (b) | [RT] |
| 14 | 389 | Task 1 Step 6 | `git add src/deno_ral/platform.ts src/deno_ral/main.ts tests/unit/ral/platform.test.ts ...` | (a) | [GIT] |
| 15 | 390 | Task 1 Step 6 | `git commit -m "deno_ral: runtime() detection, ..."` | (a) | [GIT] |
| 16 | 453 | Task 2 Step 7 | `cd src && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --import-map=import_map.json quarto.ts` | (b) | [DENO] |
| 17 | 456 | Task 2 Step 7 | `package/dist/bin/quarto --version` (prints `99.9.9`) | (b) | [Q] |
| 18 | 456 | Task 2 Step 7 | `package/dist/bin/quarto check 2>&1 \| grep 'Deno version'` | (b) | [Q] + [GREP] |
| 19 | 461 | Task 2 Step 8 | `git add src/command/check/check.ts src/core/log.ts ...` | (a) | [GIT] |
| 20 | 462 | Task 2 Step 8 | `git commit -m "replace Deno.version/consoleSize/inspect/build and import.meta.main ..."` | (a) | [GIT] |
| 21 | 523 | Task 3 Step 1 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/tools/tinytex-writable.test.ts` | (b) | [RT] |
| 22 | 572 | Task 3 Step 4 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent $(find unit/tools/ -name '*.test.ts')` | (b) | [RT]; `$(find)` bash-only; read-only-dir case is ignored on Windows by design |
| 23 | 577 | Task 3 Step 5 | `git add src/tools/impl/tinytex.ts tests/unit/tools/tinytex-writable.test.ts` | (a) | [GIT] |
| 24 | 578 | Task 3 Step 5 | `git commit -m "tinytex: real write probe instead of Deno.permissions, ..."` | (a) | [GIT] |
| 25 | 634 | Task 4 Step 3 | `grep -n 'Deno\.' src/core/lib/external/colors.ts src/core/lib/errors.ts` | (a) | [GREP] |
| 26 | 635 | Task 4 Step 3 | `package/dist/bin/quarto dev-call build-artifacts` | (b) | [Q] |
| 27 | 636 | Task 4 Step 3 | `git diff --stat src/resources/editor` | (a) | [GIT]; CRLF phantom-diff risk on generated bundles (not verified) |
| 28 | 637 | Task 4 Step 3 | `git diff src/resources/editor \| grep '^[-+]' \| grep -v '^[-+][-+]'` | (a) | [GREP] |
| 29 | 637 | Task 4 Step 3 | `grep -n 'Deno\.' src/resources/editor/tools/vs-code.mjs src/resources/editor/tools/yaml/web-worker.js` | (a) | [GREP] |
| 30 | 642 | Task 4 Step 4 | `git add src/core/lib/external/colors.ts src/core/lib/errors.ts src/resources/editor` | (a) | [GIT] |
| 31 | 643 | Task 4 Step 4 | `git commit -m "core/lib: probe runtime globals for noColor and platform ..."` | (a) | [GIT] |
| 32 | 664 | Task 5 Step 3 | `package/src/quarto-bld --help \| head -5` | (b) | [QB] |
| 33 | 665 | Task 5 Step 3 | `package/dist/bin/quarto run --dev package/src/common/import-report/find-bad-imports.ts src/quarto.ts \| head -3` | (b) | [Q] |
| 34 | 666 | Task 5 Step 3 | `grep -rn 'import\.meta\.main\|Deno\.build' package/src --include=*.ts \| grep -v compile-quarto-latexmk.ts` | (a) | [GREP] |
| 35 | 671 | Task 5 Step 4 | `git add package/src/common/config.ts package/src/bld.ts package/src/common/import-report` | (a) | [GIT] |
| 36 | 672 | Task 5 Step 4 | `git commit -m "package/src: isMainModule and platform.ts instead of ..."` | (a) | [GIT] |
| 37 | 693 | Task 6 Step 3 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/project/project-detect-denied-path.test.ts smoke/project/project-detect-denied-config.test.ts unit/chrome-launch.test.ts smoke/issues/9133/9133.test.ts smoke/create/create.test.ts smoke/typst-gather/typst-gather.test.ts` | (b) | [RT]; same icacls caveat as row 6 |
| 38 | 699 | Task 6 Step 4 | `git add tests/utils.ts tests/unit/project/project-detect-denied-path.test.ts ...` | (a) | [GIT] |
| 39 | 700 | Task 6 Step 4 | `git commit -m "tests: isRootUser()/isWindows from platform.ts ..."` | (a) | [GIT] |
| 40 | 705 | Task 7 Step 1 | `quarto run --dev tools/check-runtime-boundary.ts --update-baseline` | (b) | [Q] (quarto -> quarto.cmd); assumes dev quarto on PATH |
| 41 | 716 | Task 7 Step 3 | `git add tools/runtime-boundary-baseline.json .claude/rules/typescript/deno-ral.md` | (a) | [GIT] |
| 42 | 717 | Task 7 Step 3 | `git commit -m "ratchet baseline after platform/main; ..."` | (a) | [GIT] |
| 43 | 722 | Verification | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/platform.test.ts $(find unit/tools/ -name '*.test.ts')` | (b) | [RT]; `$(find)` bash-only |
| 44 | 726 | Verification | `quarto run --dev tools/check-runtime-boundary.ts` | (b) | [Q] |

(Verification lines 723, 724, 725, 727 only point back to rows 6/37, 7, 9 and the acceptance greps; not counted again.)

### Windows mentions

- Spec > Interfaces, line 61: "/** True when the process runs as uid 0. Always false on Windows. */"
- Task 1 Step 2, line 230: `unitTest("platform - isRootUser is boolean and false on Windows", ...`
- Task 1 Step 4, line 326: "// Deno.uid() is null on Windows."
- Task 3 Step 1, line 511: "// chmod does not restrict root, and Windows ignores the mode bits."
- Task 3 Step 4, line 573: "(the read-only case is ignored on Windows and as root)"
- Risks and rollback, line 743: "`isRootUser()` on Windows returns false where `Deno.uid()` returned `null`; the three tests compared against `0`, so semantics are preserved."
- Task 4 Step 2, lines 622-626 (code): `return g.Deno.build.os !== "windows";` / `return g.process.platform !== "win32";`
- Code or table uses of `isWindows` / `"windows"` with no prose behaviour claim: lines 27, 51, 174, 209, 211, 233, 283, 432, 485, 512, 681, 683, 685, 687, 689, 700, 709.

### Windows mentions added by grep sweep at assembly
Lines matching `windows|win32|.cmd|.ps1|taskkill` (case-insensitive) that the extractor's list above did not cite. Quoted verbatim, trimmed to 300 characters; section is the nearest preceding heading.

- L27 (Context): "| `Deno.build.os` | `src/deno_ral/fs.ts:182,196`; `src/core/lib/errors.ts:25-41` (browser-shared); `tests/unit/chrome-launch-fixtures.ts:36`, `tests/smoke/typst-gather/typst-gather.test.ts:472`, `tests/smoke/issues/9133/9133.test.ts:3`, `tests/smoke/create/create.test.ts:74` | `isWindows` from `plat ..."
- L51 (Interfaces): "export const isWindows: boolean; export const isMac: boolean; export const isLinux: boolean; export const os: string; export const arch: string; // existing"
- L174 (Task 1: `platform.ts` extension and `main.ts`, with a unit test): "isWindows,"
- L209 (Task 1: `platform.ts` extension and `main.ts`, with a unit test): "assert(["windows", "darwin", "linux"].includes(os), os);"
- L211 (Task 1: `platform.ts` extension and `main.ts`, with a unit test): "assertEquals(isWindows, os === "windows");"
- L233 (Task 1: `platform.ts` extension and `main.ts`, with a unit test): "if (isWindows) assertEquals(root, false);"
- L283 (Task 1: `platform.ts` extension and `main.ts`, with a unit test): "export const isWindows = Deno.build.os === "windows";"
- L432 (Task 2: `src/` call sites that import the layer directly): "Add `import { isWindows } from "./platform.ts";` and replace both `if (Deno.build.os !== "windows") {` with `if (!isWindows) {`."
- L485 (Task 3: `tinytex.ts`: `Deno.build.arch` and a non-blocking write probe): "import { isRootUser, isWindows } from "../../../src/deno_ral/platform.ts";"
- L512 (Task 3: `tinytex.ts`: `Deno.build.arch` and a non-blocking write probe): "{ ignore: isWindows || isRootUser() },"
- L681 (Task 6: `tests/`): "`tests/utils.ts`: add `isRootUser` to the existing `../src/deno_ral/platform.ts` import (line 13); line 283: `export const canMakeUnreadableDir = isWindows || !isRootUser();`"
- L683 (Task 6: `tests/`): "`project-detect-denied-path.test.ts:51`: import `isRootUser` from `../../../src/deno_ral/platform.ts`; `const ignore = isWindows || isRootUser();`"
- L685 (Task 6: `tests/`): "`project-detect-denied-config.test.ts:24`: import `isRootUser` from `../../../src/deno_ral/platform.ts`; `if (!isWindows && !isRootUser()) {`"
- L687 (Task 6: `tests/`): "- [ ] **Step 2: `Deno.build.os === "windows"` → `isWindows`**"
- L689 (Task 6: `tests/`): "In each of `chrome-launch-fixtures.ts:36`, `typst-gather.test.ts:472`, `9133.test.ts:3` (`!== "windows"` → `!isWindows`), `create.test.ts:74`, add `import { isWindows } from "<rel>/src/deno_ral/platform.ts";` when absent (`grep -n isWindows <file>` first) and substitute."
- L700 (Task 6: `tests/`): "git commit -m "tests: isRootUser()/isWindows from platform.ts instead of Deno.uid/Deno.build""
- L709 (Task 7: Ratchet and docs): "| `platform.ts` | Platform and runtime facts | `isWindows`, `isMac`, `isLinux`, `os`, `arch`, `runtime`, `consoleColumns`, `inspect`, `isRootUser`, `noColor` |"

## 20b-hidden-deno-uses.md

Extracted commands: 65 (a=35, b=28, c=0, d=0, u=2)

| # | line | section | command | class | note |
|---|---|---|---|---|---|
| 1 | 104 | Acceptance criteria | `grep -rn 'Deno\.' src --include=*.js --include=*.mjs \| grep -v '^src/vendor/' \| grep -v '^src/resources/'` | (a) | [GREP] |
| 2 | 105 | Acceptance criteria | `grep -rln 'Deno\.' src/resources --include=*.js --include=*.mjs --include=*.ts \| grep -v extension-subtrees \| grep -v '^src/resources/types/' \| sort` | (a) | [GREP]; Git Bash sort (not Windows sort.exe) |
| 3 | 106 | Acceptance criteria | `grep -rn 'tree-sitter-deno\|from "dotenv"\|log/file-handler\|Deno\.readTextFileSync =' src package/src --include=*.ts` | (a) | [GREP] |
| 4 | 107 | Acceptance criteria | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/core/tree-sitter-init.test.ts unit/core/graphviz-wasm.test.ts unit/ral/fs-on-file-read.test.ts unit/core/performance-metrics.test.ts unit/ral/log-file-handler.test.ts unit/dotenv-parse.test.ts unit/dotenv-config.test.ts $(find unit/yaml-intelligence/ -name '*.test.ts')` | (b) | [RT]; `$(find)` bash-only; graphviz test imports a file URL built from resourcePath (check) |
| 5 | 108 | Acceptance criteria | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/logging/log-level-and-formats.test.ts smoke/render/render-html.test.ts` | (b) | [RT] |
| 6 | 108 | Acceptance criteria | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent docs/smoke-all/2023/02/13/dot-bug.qmd docs/smoke-all/2023/07/10/6153.qmd` | (b) | [RT] |
| 7 | 109 | Acceptance criteria | `quarto dev-call build-artifacts` | (b) | [Q] |
| 8 | 109 | Acceptance criteria | `git status --short src/resources/editor` | (a) | [GIT]; CRLF phantom-modified risk on regenerated bundles (not verified) |
| 9 | 174 | Task 1 Step 2 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/core/tree-sitter-init.test.ts` | (b) | [RT] |
| 10 | 188 | Task 1 Step 3 | `package/scripts/vendoring/update-lock.sh` | (u) | bash script from PR 00b whose content is not in this file; Git Bash probably fine |
| 11 | 189 | Task 1 Step 3 | `package/src/quarto-bld configure` | (b) | [QB] |
| 12 | 190 | Task 1 Step 3 | `git diff --stat deno.lock src/dev_import_map.json` | (a) | [GIT] |
| 13 | 198 | Task 1 Step 3 | `d=$(mktemp -d) && (cd "$d" && npm pack web-tree-sitter@0.20.2 >/dev/null && tar xzf web-tree-sitter-0.20.2.tgz package/tree-sitter.wasm)` | (b) | npm -> npm.cmd (Git Bash rule); tar xzf on a .tgz with GNU tar should work under Git Bash; subshell/`$(mktemp)` bash-only |
| 14 | 199 | Task 1 Step 3 | `cp "$d/package/tree-sitter.wasm" src/resources/editor/tools/yaml/web-tree-sitter.wasm` | (a) | Git Bash |
| 15 | 200 | Task 1 Step 3 | `sha256sum src/resources/editor/tools/yaml/web-tree-sitter.wasm` | (a) | sha256sum ships with Git Bash |
| 16 | 201 | Task 1 Step 3 | `rm -rf "$d"` | (a) | $d is a temp dir created by the plan (rm of one's own temp dir) |
| 17 | 251 | Task 1 Step 4 | `git rm src/core/lib/external/tree-sitter-deno.js` | (a) | [GIT] |
| 18 | 252 | Task 1 Step 4 | `sed -i 's#src/core/lib/external/tree-sitter-deno.js#src/core/lib/external/regexpp.mjs#g' package/src/common/import-report/explain-import-chain.ts` | (a) | GNU sed under Git Bash; `#` delimiter, not a leading `/` arg |
| 19 | 253 | Task 1 Step 4 | `grep -rn 'tree-sitter-deno' src package tools tests --include=* -I` | (a) | [GREP] |
| 20 | 280 | Task 1 Step 6 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/core/tree-sitter-init.test.ts $(find unit/yaml-intelligence/ -name '*.test.ts')` | (b) | [RT]; `$(find)` bash-only |
| 21 | 283 | Task 1 Step 6 | `package/dist/bin/quarto render tests/docs/minimal.qmd --to html` | (b) | [Q] |
| 22 | 283 | Task 1 Step 6 | `package/dist/bin/quarto dev-call build-artifacts` | (b) | [Q] |
| 23 | 283 | Task 1 Step 6 | `git status --short src/resources/editor` | (a) | [GIT] |
| 24 | 291 | Task 1 Step 7 | `cd package/src && ./quarto-bld prepare-dist --set-version 99.9.9 && cd ../..` | (b) | ./quarto-bld -> quarto-bld.cmd (prepare-dist run from package/src) |
| 25 | 292 | Task 1 Step 7 | `mv src/quarto.ts src/quarto1.ts` | (a) | Git Bash mv; plan restores it in row 27 |
| 26 | 293 | Task 1 Step 7 | `package/pkg-working/bin/quarto render tests/docs/minimal.qmd --to html --output-dir "$(mktemp -d)" ; status=$?` | (u) | quarto -> quarto.cmd; `$?` and `$(mktemp -d)` are bash-only and the /tmp path goes to a Windows exe (MSYS may or may not convert it) |
| 27 | 294 | Task 1 Step 7 | `mv src/quarto1.ts src/quarto.ts` | (a) | Git Bash mv |
| 28 | 295 | Task 1 Step 7 | `echo "bundle render exit: $status"` | (a) | bash only (no direct PowerShell equivalent of the `$status` flow) |
| 29 | 303 | Task 1 Step 8 | `git add src/import_map.json src/dev_import_map.json deno.lock src/resources/editor/tools/yaml/web-tree-sitter.wasm ...` | (a) | [GIT]; binary .wasm, check eol attrs not affected |
| 30 | 304 | Task 1 Step 8 | `git commit -m "tree-sitter: load npm web-tree-sitter 0.20.2 with bytes; ..."` | (a) | [GIT] |
| 31 | 359 | Task 2 Step 2 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/core/graphviz-wasm.test.ts` | (b) | [RT] |
| 32 | 385 | Task 2 Step 3 | `grep -n 'Deno\.' src/resources/js/graphviz-wasm.js` | (a) | [GREP] |
| 33 | 421 | Task 2 Step 5 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/core/graphviz-wasm.test.ts` | (b) | [RT] |
| 34 | 423 | Task 2 Step 5 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent docs/smoke-all/2023/02/13/dot-bug.qmd docs/smoke-all/2023/07/10/6153.qmd` | (b) | [RT] |
| 35 | 429 | Task 2 Step 6 | `git add src/resources/js/graphviz-wasm.js src/core/handlers/dot.ts tests/unit/core/graphviz-wasm.test.ts` | (a) | [GIT] |
| 36 | 430 | Task 2 Step 6 | `git commit -m "graphviz-wasm: caller injects the wasm bytes; ..."` | (a) | [GIT] |
| 37 | 462 | Task 3 Step 2 | `grep -n 'Deno\.' src/core/cri/deno-cri/*.js` | (a) | [GREP] |
| 38 | 463 | Task 3 Step 2 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/chrome-launch.test.ts unit/chrome-launch-flags.test.ts smoke/axe/axe-transport-failclosed.test.ts` | (b) | [RT]; Chrome-dependent cases skip when Chrome absent; fake executables are .cmd on Windows (see PR 23 row on chrome-launch-fixtures) |
| 39 | 467 | Task 3 Step 3 | `git add src/core/cri/deno-cri/chrome.js src/core/cri/deno-cri/external-request.js` | (a) | [GIT] |
| 40 | 469 | Task 3 Step 3 | `git commit -m "deno-cri: drop the dead Deno.inspect hook and commented Deno.resolveDns"` | (a) | [GIT] |
| 41 | 478 | Task 4 intro | `grep -n 'export function readTextFileSync\|export async function readTextFile\|export function readFileSync\|export async function readFile' src/deno_ral/fs.ts` | (a) | [GREP] |
| 42 | 573 | Task 4 Step 2 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/fs-on-file-read.test.ts unit/core/performance-metrics.test.ts` | (b) | [RT]; performance-metrics test asserts `record.stack[0]` contains the test file name, stack-frame format on Windows (file:/// URLs, drive letters) unverified |
| 43 | 659 | Task 4 Step 5 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/fs-on-file-read.test.ts unit/core/performance-metrics.test.ts` | (b) | [RT]; same stack-format caveat |
| 44 | 661 | Task 4 Step 5 | `QUARTO_REPORT_PERFORMANCE_METRICS=fileReads package/dist/bin/quarto render tests/docs/minimal.qmd --to html 2>/dev/null \| grep -c '"path"'` | (b) | [Q]; `VAR=x cmd` bash-only (PowerShell: $env:), `2>/dev/null` bash |
| 45 | 667 | Task 4 Step 6 | `git add src/deno_ral/fs.ts src/core/performance/metrics.ts tests/unit/ral/fs-on-file-read.test.ts ...` | (a) | [GIT] |
| 46 | 668 | Task 4 Step 6 | `git commit -m "deno_ral/fs: onFileRead hook; ..."` | (a) | [GIT] |
| 47 | 771 | Task 5 Step 2 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/log-file-handler.test.ts` | (b) | [RT] |
| 48 | 878 | Task 5 Step 3 | `quarto run --dev package/src/common/import-report/explain-all-cycles.ts src/quarto.ts 2>&1 \| grep -c 'deno_ral/log.ts'` | (b) | [Q] + [GREP]; script shells out to `deno info`; result path separators on Windows (backslash) could change the grep count, unverified |
| 49 | 901 | Task 5 Step 5 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/log-file-handler.test.ts smoke/logging/log-level-and-formats.test.ts` | (b) | [RT] |
| 50 | 907 | Task 5 Step 6 | `git add src/deno_ral/log.ts src/deno_ral/fs.ts src/core/log.ts tests/unit/ral/log-file-handler.test.ts` | (a) | [GIT] |
| 51 | 908 | Task 5 Step 6 | `git commit -m "deno_ral/log: own FileHandler on deno_ral/fs ..."` | (a) | [GIT] |
| 52 | 994 | Task 6 Step 2 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/dotenv-parse.test.ts` | (b) | [RT] |
| 53 | 1144 | Task 6 Step 5 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/dotenv-parse.test.ts unit/dotenv-config.test.ts` | (b) | [RT] |
| 54 | 1146 | Task 6 Step 5 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent docs/smoke-all/website/llms-txt-shortcode/index.qmd` | (b) | [RT] |
| 55 | 1146 | Task 6 Step 5 | `ls tests/docs/smoke-all/website/llms-txt-shortcode/` | (a) | conditional fallback; Git Bash ls |
| 56 | 1152 | Task 6 Step 6 | `git add src/quarto-core/dotenv.ts src/core/quarto.ts tests/unit/dotenv-parse.test.ts` | (a) | [GIT] |
| 57 | 1153 | Task 6 Step 6 | `git commit -m "dotenv: own parser and loader on deno_ral ..."` | (a) | [GIT] |
| 58 | 1163 | Task 7 Step 1 | `grep -n 'Deno\.stdin\|readLines' src/command/create/cmd.ts` | (a) | [GREP] |
| 59 | 1168 | Task 7 Step 2 | `quarto run --dev tools/check-runtime-boundary.ts --update-baseline` | (b) | [Q] |
| 60 | 1171 | Task 7 Step 2 | `grep -rln 'Deno\.' src/resources --include=*.js --include=*.mjs --include=*.ts \| grep -v extension-subtrees \| grep -v '^src/resources/types/' \| sort` | (a) | [GREP] |
| 61 | 1180 | Task 7 Step 4 | `git add tools/runtime-boundary-baseline.json .claude/rules/typescript/deno-ral.md` | (a) | [GIT] |
| 62 | 1181 | Task 7 Step 4 | `git commit -m "ratchet: src-js at zero, resources at the user-script allow-list"` | (a) | [GIT] |
| 63 | 1188 | Verification | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent $(find smoke/logging/ -name '*.test.ts') smoke/render/render-html.test.ts $(find unit/yaml-intelligence/ -name '*.test.ts')` | (b) | [RT]; `$(find)` bash-only |
| 64 | 1190 | Verification | `quarto dev-call build-artifacts && git status --short src/resources/editor` | (b) | [Q] then [GIT]; `&&` chain is valid in bash and PowerShell 7 |
| 65 | 1191 | Verification | `quarto run --dev tools/check-runtime-boundary.ts` | (b) | [Q] |

(Lines 1187 and 1189 only refer back to the acceptance test command and to Task 1 step 7; not counted again. Line 1201 names a jsr.io URL to diff against, not a command.)

### Windows mentions

none (regex windows|win32|.cmd|.ps1|taskkill|.bat found no match in this file).


## 20-remove-deno-dom-ffi.md

Extracted commands: 71 (a=47, b=18, c=0, d=0, u=6)

| # | line | section | command | class | note |
|---|---|---|---|---|---|
| 1 | 86 | Acceptance criteria | `grep -rn 'deno_dom/native\|denosaurs/plug\|DENO_DOM_PLUGIN\|unstable-ffi' src package configuration configure.sh configure.cmd tests .github .vscode llm-docs deno.lock -I \| grep -v runtime-migration` | (a) | [GREP] |
| 2 | 87 | Acceptance criteria | `grep -rn 'DENO_DOM\|deno_dom' configuration configure.sh package/src package/scripts package/launcher package/conda-recipe .github src/core/devconfig.ts llm-docs/code-signing-installers.md -I` | (a) | [GREP] |
| 3 | 87 | Acceptance criteria | `grep -n QUARTO_DENO_DOM tests/binary-mode-strip-env.txt` | (a) | [GREP] |
| 4 | 88 | Acceptance criteria | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/core/deno-dom.test.ts smoke/render/render-html.test.ts unit/harness-failure-reporting.test.ts unit/smoke-all-prerender-isolation.test.ts smoke/run/run-script.test.ts` | (b) | [RT]; the two unit tests spawn a child `deno test` (runHarness) unverified on Windows |
| 5 | 89 | Acceptance criteria | `./configure.sh` (on a clean checkout, creates no `tools/<arch>/deno_dom/`) | (b) | configure.sh -> configure.cmd (plan notes configure.cmd has no DENO_DOM, 20:28) |
| 6 | 90 | Acceptance criteria | `QUARTO_LOG_LEVEL=debug package/dist/bin/quarto render tests/docs/minimal.qmd --to html 2>&1 \| grep -c deno-dom-native` | (b) | [Q]; `VAR=x cmd` bash-only |
| 7 | 148 | Task 1 Step 2 | `d=$(mktemp -d)` | (a) | bash utility use only, /tmp stays inside Git Bash tools |
| 8 | 149 | Task 1 Step 2 | `printf 'native\twebsite\t1\t90\t1000\t5\n...' > "$d/n.tsv"` | (a) | Git Bash printf |
| 9 | 150 | Task 1 Step 2 | `printf 'wasm\twebsite\t1\t90\t1800\t5\n...' > "$d/w.tsv"` | (a) | Git Bash printf |
| 10 | 151 | Task 1 Step 2 | `tools/parsehtml-gate.sh "$d/n.tsv" "$d/w.tsv"` | (b) | bash script (awk, sort), run through Git Bash; no .ps1 equivalent; plan does not give one |
| 11 | 151 | Task 1 Step 2 | `echo "exit $?"` | (a) | bash only (`$?`) |
| 12 | 151 | Task 1 Step 2 | `rm -rf "$d"` | (a) | removes the plan's own mktemp dir |
| 13 | 172 | Task 1 Step 3 (workflow YAML) | `tools/parsehtml-gate.sh "$PARSEHTML_TIMING_OUT-native.tsv" "$PARSEHTML_TIMING_OUT-wasm.tsv" 2.0 \| tee "$PARSEHTML_TIMING_OUT-gate.tsv"` | (u) | CI step with `shell: bash` on windows-latest; runner.temp is a Windows path handed to bash; verified only by the CI run |
| 14 | 180 | Task 1 Step 4 | `git add tools/parsehtml-gate.sh .github/workflows/parsehtml-timing.yml` | (a) | [GIT]; script exec bit needs `git update-index --chmod=+x` on Windows (mode 755 requested at line 106) |
| 15 | 181 | Task 1 Step 4 | `git commit -m "parseHtml gate: WASM at most 2x the native plugin, per OS and target"` | (a) | [GIT] |
| 16 | 182 | Task 1 Step 4 | `git push -u origin rt/20-remove-deno-dom-ffi` | (a) | [GIT]; push to shared remote fires CI, needs Chris's approval |
| 17 | 183 | Task 1 Step 4 | `gh workflow run parsehtml-timing.yml --ref rt/20-remove-deno-dom-ffi -f runs=5` | (a) | [GIT]; dispatches a three-OS CI run (cost), needs Chris's approval |
| 18 | 184 | Task 1 Step 4 | `gh run watch "$(gh run list --workflow parsehtml-timing.yml --branch rt/20-remove-deno-dom-ffi --limit 1 --json databaseId -q '.[0].databaseId')"` | (a) | [GIT]; `$(...)` bash; PowerShell form `$(...)` also works |
| 19 | 187 | Task 1 Step 4 | `gh run download <id>` | (a) | [GIT] |
| 20 | 215 | Task 2 Step 2 | `package/scripts/vendoring/update-lock.sh --refresh` | (u) | bash script from PR 00b, content not in this file |
| 21 | 216 | Task 2 Step 2 | `git diff deno.lock \| grep -c 'denosaurs/plug'` | (a) | [GREP] |
| 22 | 217 | Task 2 Step 2 | `grep -c 'denosaurs/plug' deno.lock` | (a) | [GREP] |
| 23 | 217 | Task 2 Step 2 | `git diff --stat deno.lock` | (a) | [GIT] |
| 24 | 221 | Task 2 Step 3 | `cd src && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --import-map=import_map.json quarto.ts` | (b) | [DENO] |
| 25 | 222 | Task 2 Step 3 | `QUARTO_LOG_LEVEL=debug package/dist/bin/quarto render tests/docs/minimal.qmd --to html 2>&1 \| grep -c 'deno-dom-native'` | (b) | [Q]; `VAR=x cmd` bash-only |
| 26 | 223 | Task 2 Step 3 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/core/deno-dom.test.ts smoke/render/render-html.test.ts` | (b) | [RT] |
| 27 | 228 | Task 2 Step 4 | `git add src/core/deno-dom.ts deno.lock` | (a) | [GIT] |
| 28 | 229 | Task 2 Step 4 | `git commit -m "deno-dom: WASM parser only; drop deno_dom/native and @denosaurs/plug"` | (a) | [GIT] |
| 29 | 241 | Task 3 Step 1 | `git rm package/src/common/dependencies/deno_dom.ts` | (a) | [GIT] |
| 30 | 301 | Task 3 Step 6 | `grep -rn 'DENO_DOM\|deno_dom' configuration configure.sh configure.cmd package/src src/core/devconfig.ts .github -I` | (a) | [GREP] |
| 31 | 302 | Task 3 Step 6 | `package/src/quarto-bld configure` | (b) | [QB] |
| 32 | 302 | Task 3 Step 6 | `ls package/dist/bin/tools/x86_64/` | (a) | Git Bash ls |
| 33 | 302 | Task 3 Step 6 | `rm -rf package/dist/bin/tools/*/deno_dom` | (a) | recursive delete: do a dry run (`ls -d package/dist/bin/tools/*/deno_dom`) first per the destructive-op rule |
| 34 | 303 | Task 3 Step 6 | `package/dist/bin/quarto --version` | (b) | [Q] |
| 35 | 308 | Task 3 Step 7 | `git add -A package/src/common/dependencies package/src/common/configure.ts package/src/common/prepare-dist.ts ...` | (a) | [GIT]; `git add -A` on paths |
| 36 | 309 | Task 3 Step 7 | `git commit -m "packaging: drop the native deno_dom dependency, DENO_DOM configuration and dev-config field"` | (a) | [GIT] |
| 37 | 322 | Task 4 Step 1 | `sed -i 's/--unstable-ffi //' package/scripts/common/quarto` | (a) | GNU sed under Git Bash |
| 38 | 330 | Task 4 Step 2 | `sed -i 's/ --unstable-ffi//' package/scripts/windows/quarto.cmd` | (a) | GNU sed; plan claims `sed -i` keeps CRLF (line 333), to be confirmed by `file` row 39 |
| 39 | 333 | Task 4 Step 2 | `file package/scripts/windows/quarto.cmd` (expect `with CRLF line terminators`) | (u) | `file` availability under Git Bash not verified |
| 40 | 339 | Task 4 Step 3 | `cd package/launcher && cargo build 2>&1 \| tail -2` | (a) | [GIT]-like; needs Rust toolchain, plan says rely on CI Windows job if absent |
| 41 | 343 | Task 4 Step 4 | `package/src/quarto-bld configure` | (b) | [QB]; copies package/scripts/common/quarto into dist/bin (on Windows the .cmd launcher is copied) |
| 42 | 343 | Task 4 Step 4 | `package/dist/bin/quarto render tests/docs/minimal.qmd --to html` | (b) | [Q] |
| 43 | 344 | Task 4 Step 4 | `printf 'console.log(Deno.env.get("DENO_DOM_PLUGIN") ?? "unset")\n' > "$(mktemp -d)/p.ts"` | (a) | Git Bash printf |
| 44 | 344 | Task 4 Step 4 | `package/dist/bin/quarto run <that file>` (expect `unset`) | (u) | [Q]; file lives in the Git Bash /tmp dir (= %TEMP%), passing a /tmp path to a Windows exe may be mangled |
| 45 | 345 | Task 4 Step 4 | `QUARTO_DENO_DOM=/anything package/dist/bin/quarto render tests/docs/minimal.qmd --to html` | (b) | [Q]; `VAR=x cmd` bash-only; value `/anything` is a leading-slash arg that MSYS may rewrite (harmless here, it is ignored) |
| 46 | 350 | Task 4 Step 5 | `git add package/scripts/common/quarto package/scripts/windows/quarto.cmd package/launcher/src/main.rs` | (a) | [GIT] |
| 47 | 351 | Task 4 Step 5 | `git commit -m "launchers: drop DENO_DOM_PLUGIN, QUARTO_DENO_DOM and --unstable-ffi"` | (a) | [GIT] |
| 48 | 362 | Task 5 Step 1 | `sed -i '/denoBundleCmd.push("--unstable-ffi");/d' package/src/util/deno.ts` | (a) | GNU sed |
| 49 | 363 | Task 5 Step 1 | `sed -i '/^ *"--unstable-ffi",$/d' src/core/run/deno.ts tests/unit/harness-failure-reporting.test.ts tests/unit/smoke-all-prerender-isolation.test.ts .vscode/launch.json` | (a) | GNU sed; CRLF-ending files: `$` anchor before `\r` may not match, not verified |
| 50 | 365 | Task 5 Step 1 | `sed -i 's/ --unstable-ffi//' package/src/quarto-bld package/src/quarto-bld.cmd package/scripts/deno_std/download.sh package/scripts/deno_std/download.bat tests/run-tests.sh tests/run-tests.ps1 tests/README.md` | (a) | GNU sed; touches .cmd/.bat/.ps1 files, CRLF kept per plan line 333 claim |
| 51 | 366 | Task 5 Step 1 | `grep -rn 'unstable-ffi' src package tests tools .github .vscode -I \| grep -v runtime-migration` | (a) | [GREP] |
| 52 | 373 | Task 5 Step 2 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/harness-failure-reporting.test.ts unit/smoke-all-prerender-isolation.test.ts smoke/run/run-script.test.ts` | (b) | [RT] |
| 53 | 374 | Task 5 Step 2 | `package/src/quarto-bld --help \| head -3` | (b) | [QB] |
| 54 | 379 | Task 5 Step 3 | `git add package/src/util/deno.ts package/src/quarto-bld package/src/quarto-bld.cmd package/scripts/deno_std tests/run-tests.sh tests/run-tests.ps1 ...` | (a) | [GIT] |
| 55 | 380 | Task 5 Step 3 | `git commit -m "remove --unstable-ffi everywhere"` | (a) | [GIT] |
| 56 | 395 | Task 6 Step 1 | `grep -n -i 'deno.dom\|DENO_DOM' package/conda-recipe/*` | (a) | [GREP] |
| 57 | 409 | Task 6 Step 3 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/binary-mode-strip-env.test.ts` | (b) | [RT] |
| 58 | 414 | Task 6 Step 4 | `git add package/conda-recipe llm-docs/code-signing-installers.md tests/binary-mode-strip-env.txt` | (a) | [GIT] |
| 59 | 415 | Task 6 Step 4 | `git commit -m "conda recipe, signing docs, strip list: no native deno_dom plugin"` | (a) | [GIT] |
| 60 | 399 | Task 6 Step 2 | `git merge-base HEAD main \| cut -c1-9` | (a) | [GIT] + Git Bash cut; value for llm-docs frontmatter |
| 61 | 428 | Task 7 Step 1 (workflow bash) | `if grep -qi 'deno-dom-native' "$LOGS/html.log"; then ... exit 1; fi` | (u) | CI step in test-bundle.yml (bundle gate also runs on windows-latest, line 473); bash in CI |
| 62 | 442 | Task 7 Step 3 | `git add .github/workflows/test-bundle.yml .github/workflows/parsehtml-timing.yml` | (a) | [GIT] |
| 63 | 443 | Task 7 Step 3 | `git commit -m "bundle gate and timing workflow: WASM-only deno_dom"` | (a) | [GIT] |
| 64 | 444 | Task 7 Step 3 | `git push` | (a) | [GIT]; fires CI, needs Chris's approval |
| 65 | 445 | Task 7 Step 3 | `gh workflow run parsehtml-timing.yml --ref rt/20-remove-deno-dom-ffi -f runs=5` | (a) | [GIT]; dispatches a three-OS CI run, needs Chris's approval |
| 66 | 458 | Task 7 Step 4 | `quarto run --dev tools/check-runtime-boundary.ts --update-baseline` | (b) | [Q] |
| 67 | 463 | Task 7 Step 5 | `git add news tools/runtime-boundary-baseline.json` | (a) | [GIT] |
| 68 | 464 | Task 7 Step 5 | `git commit -m "changelog: native deno_dom plugin removed; ratchet baseline"` | (a) | [GIT] |
| 69 | 471 | Verification | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/core/deno-dom.test.ts smoke/render/render-html.test.ts $(find smoke/project/ -name '*.test.ts') smoke/run/run-script.test.ts unit/harness-failure-reporting.test.ts unit/smoke-all-prerender-isolation.test.ts` | (b) | [RT]; `$(find)` bash-only |
| 70 | 472 | Verification | `./configure.sh` (from a clean clone) | (b) | configure.sh -> configure.cmd |
| 71 | 483 | Review checklist | `conda build --render package/conda-recipe` | (u) | conda-build availability on this machine unknown; plan says use the grep otherwise |

(Not counted: line 187 `gh run download` artifact follow-up is covered by row 19; line 473 names CI jobs (`test-bundle.yml`, `create-release.yml` dispatch), not local commands.)

### Windows mentions

- Context, line 23: "`package/scripts/windows/quarto.cmd` points `DENO_DOM_PLUGIN` at `tools\x86_64\deno_dom\plugin.dll` (PR 05 Task 5)."
- Context, line 16: "...per OS including arm64 macOS and Windows, budget at most 2x the native plugin..."
- Context, line 28: "`configure.cmd` has no `DENO_DOM`."
- Context, line 32: "Launchers: `package/scripts/common/quarto:167-173` ... `package/scripts/windows/quarto.cmd:118-121,131`; `package/launcher/src/main.rs:...`"
- Context, line 33: "... `build.sh:6,28,39` and `bld.bat:25,35` (`QUARTO_DENO_DOM=$DENO_DOM_PLUGIN` in the build env and the activate/deactivate scripts)."
- Context, line 38: "`QUARTO_DENO_DOM` is the user-facing override (`package/scripts/common/quarto:167`, `quarto.cmd:119`, `main.rs:65`)"
- Acceptance criteria, line 85: "The `parsehtml-timing.yml` run of Task 1 is green on `ubuntu-latest`, `macos-latest` (arm64) and `windows-latest`, with every WASM/native ratio <= 2.0 ..."
- Task 1 Step 4, line 187: "Expected: three green jobs (`ubuntu-latest`, `macos-latest`, `windows-latest`)."
- Task 3 Step 3 code, line 263: `` const scriptPath = join(scriptDir, "quarto" + (isWindows ? ".cmd" : "")); ``
- Task 4 Step 2, line 325: "`package/scripts/windows/quarto.cmd`" ; line 327 text: "Delete lines 118-121 ... On the `QUARTO_DENO_OPTIONS` line (131) remove ` --unstable-ffi`"
- Task 4 Step 2, line 333: "(The file has CRLF line endings; `sed -i` keeps them. Check with `file package/scripts/windows/quarto.cmd` -> `with CRLF line terminators`.)"
- Task 4 Step 3, line 339: "(needs a Rust toolchain; if unavailable locally, rely on the release workflow's Windows job and say so in the PR)."
- Task 6 Step 1, line 393: "`bld.bat`: delete line 25 (`  echo SET "QUARTO_DENO_DOM=%DENO_DOM_PLUGIN%"`) and line 35 (`  echo SET QUARTO_DENO_DOM=`)."
- Task 6 Step 2, line 399: "Line 192: remove `` `deno_dom/plugin.dll`, `` from the Windows list."
- Verification, line 473: "... `create-release.yml` dispatched without publishing on a branch if the team's process allows, to exercise the Windows signing list and the Rust launcher."
- File-list mentions of .cmd/.bat/.ps1 names (no behaviour claim): lines 9, 34, 78-80, 86, 301, 315, 330, 350, 356, 365, 379, 385.

### Windows mentions added by grep sweep at assembly
Lines matching `windows|win32|.cmd|.ps1|taskkill` (case-insensitive) that the extractor's list above did not cite. Quoted verbatim, trimmed to 300 characters; section is the nearest preceding heading.

- L9 (PR 20: Drop the native deno_dom plugin (`deno_dom/native`, `@denosaurs/plug`) from code, packaging and launchers, gated on `parseHtml` time): "**Size:** M. 1 file deleted, 1 script created, about 25 files modified (`src/core/deno-dom.ts`, `src/core/devconfig.ts`, `src/core/run/deno.ts`, `configuration`, `configure.sh`, `package/src/common/{configure,prepare-dist}.ts`, `package/src/common/dependencies/dependencies.ts`, `package/src/util/den ..."
- L22 (Context): "- `.github/workflows/test-bundle.yml` asserts that the release bundle logs `Loaded deno-dom-native` (PR 05 Task 6); `.github/workflows/parsehtml-timing.yml` and `tools/parsehtml-timing.sh` time `parseHtml` on `tests/docs/smoke-all/typst/margin-layout` (`--to html`, label `website`) and `tests/docs/b ..."
- L34 (Context): "- `--unstable-ffi`: `package/src/util/deno.ts:56,88`; `package/src/quarto-bld:21`; `package/src/quarto-bld.cmd:13`; `package/scripts/deno_std/download.sh:13`, `download.bat:9`; `tests/run-tests.sh:72,268`; `tests/run-tests.ps1:130`; `src/core/run/deno.ts:64`; `tests/unit/harness-failure-reporting.te ..."
- L78 (Files): "- Modify: `package/scripts/common/quarto:167-173,186`; `package/scripts/windows/quarto.cmd:118-121,131`; `package/launcher/src/main.rs:50,65-68,74,84,189-198`."
- L79 (Files): "- Modify: `package/src/util/deno.ts:56,88`; `package/src/quarto-bld:21`; `package/src/quarto-bld.cmd:13`; `package/scripts/deno_std/download.sh:13`; `package/scripts/deno_std/download.bat:9`; `tests/run-tests.sh:72,268`; `tests/run-tests.ps1:130`; `src/core/run/deno.ts:64`; `tests/unit/harness-failu ..."
- L86 (Acceptance criteria): "- `grep -rn 'deno_dom/native\|denosaurs/plug\|DENO_DOM_PLUGIN\|unstable-ffi' src package configuration configure.sh configure.cmd tests .github .vscode llm-docs deno.lock -I | grep -v runtime-migration` prints nothing."
- L301 (Task 3: Dependency download, configuration, dev-config): "Run: `grep -rn 'DENO_DOM\|deno_dom' configuration configure.sh configure.cmd package/src src/core/devconfig.ts .github -I` → nothing."
- L315 (Task 4: Launchers, and `QUARTO_DENO_DOM` stops being read): "- Modify: `package/scripts/common/quarto`, `package/scripts/windows/quarto.cmd`, `package/launcher/src/main.rs`"
- L330 (Task 4: Launchers, and `QUARTO_DENO_DOM` stops being read): "sed -i 's/ --unstable-ffi//' package/scripts/windows/quarto.cmd"
- L350 (Task 4: Launchers, and `QUARTO_DENO_DOM` stops being read): "git add package/scripts/common/quarto package/scripts/windows/quarto.cmd package/launcher/src/main.rs"
- L356 (Task 5: Remaining `--unstable-ffi` flags): "**Files:** `package/src/util/deno.ts:56,88`, `package/src/quarto-bld:21`, `package/src/quarto-bld.cmd:13`, `package/scripts/deno_std/download.sh:13`, `package/scripts/deno_std/download.bat:9`, `tests/run-tests.sh:72,268`, `tests/run-tests.ps1:130`, `src/core/run/deno.ts:64`, `tests/unit/harness-fail ..."
- L365 (Task 5: Remaining `--unstable-ffi` flags): "sed -i 's/ --unstable-ffi//' package/src/quarto-bld package/src/quarto-bld.cmd package/scripts/deno_std/download.sh package/scripts/deno_std/download.bat tests/run-tests.sh tests/run-tests.ps1 tests/README.md"
- L379 (Task 5: Remaining `--unstable-ffi` flags): "git add package/src/util/deno.ts package/src/quarto-bld package/src/quarto-bld.cmd package/scripts/deno_std tests/run-tests.sh tests/run-tests.ps1 src/core/run/deno.ts tests/unit/harness-failure-reporting.test.ts tests/unit/smoke-all-prerender-isolation.test.ts .vscode/launch.json tests/README.md"

## 22-std-import-seams.md

Extracted commands: 37 (a=16, b=13, c=1, d=0, u=7)

| # | line | section | command | class | note |
|---|---|---|---|---|---|
| 1 | 79 | Acceptance criteria | `grep -rnE 'from "(fmt/colors\|flags\|encoding/base64\|encoding/hex\|semver[^"]*)"' src package/src --include=*.ts \| grep -v '^src/deno_ral/' \| grep -v extension-subtrees \| grep -v 'render/latexmk/quarto-latexmk.ts'` | (a) | [GREP] |
| 2 | 80 | Acceptance criteria | `grep -rn 'from "jsr:\|from "https://deno.land/std' package/src --include=*.ts` | (a) | [GREP] |
| 3 | 81 | Acceptance criteria | `cd src && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --import-map=import_map.json quarto.ts` | (b) | [DENO] |
| 4 | 81 | Acceptance criteria | `package/src/quarto-bld --help` | (b) | [QB] |
| 5 | 82 | Acceptance criteria | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent $(find unit/ -name '*.test.ts') smoke/render/render-html.test.ts` | (b) | [RT]; `$(find)` bash-only |
| 6 | 117 | Task 1 Step 1 (inside tools/rewrite-import-specifier.sh) | `python3 -c "import os,sys; print(os.path.relpath(sys.argv[1], os.path.dirname(sys.argv[2])))" "$new" "$f"` | (u) | python3 on Windows may be the Store stub; output uses backslashes on Windows (os.path.relpath) which would break the generated import specifier; phase 2 should check |
| 7 | 120 | Task 1 Step 1 (inside tools/rewrite-import-specifier.sh) | `sed -i "s#from \"${old}\"#from \"${rel}\"#g" "$f"` | (a) | GNU sed under Git Bash (script comment mentions macOS only) |
| 8 | 126 | Task 1 Step 1 | `chmod +x tools/rewrite-import-specifier.sh` | (c) | chmod is a no-op on NTFS; git mode bit needs `git update-index --chmod=+x`; Git Bash can still run it via `bash tools/...` |
| 9 | 133 | Task 1 Step 2 | `grep -rlF --include='*.ts' 'from "flags"' src package/src \| grep -v '^src/deno_ral/' \| sort` | (a) | [GREP] |
| 10 | 139 | Task 1 Step 3 | `git add tools/rewrite-import-specifier.sh` | (a) | [GIT] |
| 11 | 140 | Task 1 Step 3 | `git commit -m "tools: add rewrite-import-specifier.sh for routing std imports through deno_ral"` | (a) | [GIT] |
| 12 | 194 | Task 2 Step 3 | `cd src && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --import-map=import_map.json deno_ral/colors.ts deno_ral/flags.ts deno_ral/encoding.ts` | (b) | [DENO] |
| 13 | 200 | Task 2 Step 4 | `git add src/deno_ral/colors.ts src/deno_ral/flags.ts src/deno_ral/encoding.ts src/deno_ral/fs.ts src/deno_ral/io.ts` | (a) | [GIT] |
| 14 | 201 | Task 2 Step 4 | `git commit -m "deno_ral: colors and flags seams; hex in encoding"` | (a) | [GIT] |
| 15 | 209 | Task 3 Step 1 | `tools/rewrite-import-specifier.sh fmt/colors src/deno_ral/colors.ts src package/src` | (u) | bash script via Git Bash; python3 relpath concern (row 6); specifier `fmt/colors` has no leading `/` |
| 16 | 210 | Task 3 Step 1 | `tools/rewrite-import-specifier.sh 'jsr:/@std/fmt@^0.224.0/colors' src/deno_ral/colors.ts package/src` | (u) | MSYS may treat `jsr:/@std/...` (contains `:/`) as a path list and rewrite it; python3 concern (row 6) |
| 17 | 218 | Task 3 Step 2 | `tools/rewrite-import-specifier.sh flags src/deno_ral/flags.ts src` | (u) | as row 15 |
| 18 | 219 | Task 3 Step 2 | `git checkout -- src/command/render/latexmk/quarto-latexmk.ts` | (a) | [GIT]; discards the script's edit of that one file (destructive, restores the committed version) |
| 19 | 227 | Task 3 Step 3 | `tools/rewrite-import-specifier.sh encoding/base64 src/deno_ral/encoding.ts src` | (u) | as row 15 |
| 20 | 228 | Task 3 Step 3 | `tools/rewrite-import-specifier.sh encoding/hex src/deno_ral/encoding.ts src` | (u) | as row 15 |
| 21 | 239 | Task 3 Step 4 | `grep -rn 'from "semver' src package/src --include=*.ts \| grep -v '^src/deno_ral/semver.ts'` | (a) | [GREP] |
| 22 | 244 | Task 3 Step 5 | `cd src && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --import-map=import_map.json quarto.ts` | (b) | [DENO] |
| 23 | 245 | Task 3 Step 5 | `package/dist/bin/tools/x86_64/deno check --unstable-kv --import-map=src/import_map.json package/src/bld.ts package/src/common/import-report/find-bad-imports.ts package/src/common/import-report/find-bad-types-constants.ts` | (b) | [DENO] |
| 24 | 246 | Task 3 Step 5 | `package/src/quarto-bld --help \| head -3` | (b) | [QB] |
| 25 | 248 | Task 3 Step 5 | `package/dist/bin/quarto render tests/docs/minimal.qmd --to html` | (b) | [Q] |
| 26 | 253 | Task 3 Step 6 | `git add src package/src` | (a) | [GIT] |
| 27 | 254 | Task 3 Step 6 | `git commit -m "route fmt/colors, flags and encoding imports through src/deno_ral"` | (a) | [GIT] |
| 28 | 259 | Task 4 Step 1 | `quarto run --dev tools/check-runtime-boundary.ts --update-baseline` | (b) | [Q] |
| 29 | 263 | Task 4 Step 3 | `git add tools/runtime-boundary-baseline.json .claude/rules/typescript/deno-ral.md` | (a) | [GIT] |
| 30 | 265 | Task 4 Step 3 | `git commit -m "ratchet after the std seams; document which std modules have a seam"` | (a) | [GIT] |
| 31 | 271 | Verification | `deno check of src/quarto.ts and the package/src entries` (-> exit 0) | (b) | [DENO]; same as rows 3/22/23 |
| 32 | 271 | Verification | `quarto-bld --help` | (b) | [QB] |
| 33 | 272 | Verification | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent $(find unit/ -name '*.test.ts') smoke/render/render-html.test.ts` | (b) | [RT]; `$(find)` bash-only |
| 34 | 273 | Verification | `quarto run --dev tools/check-runtime-boundary.ts` | (b) | [Q] |
| 35 | 277 | Review checklist | `git diff -U0 -- src package/src \| grep '^[-+]' \| grep -v '^[-+][-+]' \| grep -v 'import\|from \|^[-+]$'` | (a) | [GREP] |
| 36 | 291 | Decisions needed | `grep -rn 'from "testing/asserts"' src --include=*.ts` | (a) | [GREP] |
| 37 | 291 | Decisions needed | `tools/rewrite-import-specifier.sh testing/asserts <helper> src` | (u) | as row 15; a recommendation, not yet a task |



### Windows mentions

none (regex windows|win32|.cmd|.ps1|taskkill|.bat found no match in this file).


## 23-codemod-tests.md

Extracted commands: 68 (a=32, b=24, c=1, d=0, u=11)

| # | line | section | command | class | note |
|---|---|---|---|---|---|
| 1 | 127 | Acceptance criteria | `grep -rn 'Deno\.test(' tests --include=*.ts` | (a) | [GREP] |
| 2 | 128 | Acceptance criteria | `grep -rnE '\bDeno\.' tests --include=*.ts \| grep -v '^tests/docs/' \| grep -v '^tests/harness.ts' \| grep -v '^tests/run-parallel-tests.ts' \| grep -v 'tests/unit/chrome-launch'` | (a) | [GREP] |
| 3 | 128 | Acceptance criteria | `grep -n 'Deno\.' tests/unit/chrome-launch*.test.ts` | (a) | [GREP] |
| 4 | 129 | Acceptance criteria | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent $(find unit/ -name '*.test.ts')` | (b) | [RT]; full unit suite on Windows, runs the new `taskkill` kill path in quarto-cmd.ts (see Windows mentions) |
| 5 | 129 | Acceptance criteria | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent $(find smoke/ -name '*.test.ts')` | (b) | [RT]; full smoke suite, "CI runs it anyway" per plan |
| 6 | 130 | Acceptance criteria | `cd tests && ./run-parallel-tests.sh --dry-run` | (u) | bash script that runs `quarto run run-parallel-tests.ts $*`; no .ps1 known; needs `quarto` on PATH (quarto.cmd) |
| 7 | 131 | Acceptance criteria | `grep -rnE 'from "(testing/asserts\|fmt/colors\|encoding/base64\|fs/eol\|path)"\|deno.land/std' tests --include=*.ts \| grep -v '^tests/asserts.ts' \| grep -v '^tests/docs/' \| grep -v '^tests/run-parallel-tests.ts' \| grep -v build-ts-extension` | (a) | [GREP] |
| 8 | 192 | Task 1 Step 2 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/harness.test.ts` | (b) | [RT] |
| 9 | 270 | Task 1 Step 4 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/harness.test.ts` | (b) | [RT] |
| 10 | 275 | Task 1 Step 5 | `git add tests/harness.ts tests/unit/harness.test.ts` | (a) | [GIT] |
| 11 | 277 | Task 1 Step 5 | `git commit -m "tests: add harness.ts registerTest adapter around Deno.test"` | (a) | [GIT] |
| 12 | 337 | Task 2 Step 4 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/harness.test.ts unit/path.test.ts smoke/render/render-html.test.ts unit/harness-failure-reporting.test.ts` | (b) | [RT]; harness-failure-reporting spawns a child `deno test` |
| 13 | 342 | Task 2 Step 5 | `git add tests/test.ts` | (a) | [GIT] |
| 14 | 344 | Task 2 Step 5 | `git commit -m "tests/test.ts: register through harness.ts instead of Deno.test"` | (a) | [GIT] |
| 15 | 387 | Task 3 Step 4 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/create/create.test.ts smoke/logging/log-level-and-formats.test.ts` | (b) | [RT]; create.test.ts step ignore on Windows is part of the change |
| 16 | 388 | Task 3 Step 4 | `cd tests && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --import-map=../src/import_map.json integration/playwright-tests.test.ts` | (b) | [DENO] |
| 17 | 393 | Task 3 Step 5 | `git add tests/integration/playwright-tests.test.ts tests/smoke/logging/log-level-and-formats.test.ts tests/smoke/create/create.test.ts` | (a) | [GIT] |
| 18 | 394 | Task 3 Step 5 | `git commit -m "tests: route the three direct Deno.test callers through registerTest"` | (a) | [GIT] |
| 19 | 739 | Task 4 Step 7 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/harness-failure-reporting.test.ts unit/smoke-all-prerender-isolation.test.ts unit/chrome-launch.test.ts unit/chrome-launch-flags.test.ts unit/dart-sass.test.ts unit/project/project-context-unreadable-dir.test.ts smoke/render/placeholder-typst-text.test.ts smoke/filters/editor-support.test.ts smoke/typst-gather/typst-gather.test.ts smoke/render/render-pdf.test.ts` | (b) | [RT]; chrome-launch fake executables are .cmd wrappers on Windows; unreadable-dir test uses icacls on Windows (makeUnreadableDir) |
| 20 | 742 | Task 4 Step 7 | `QUARTO_TEST_BIN=/path/to/an/installed/quarto cd tests && ./run-tests.sh --agent smoke/render/render-html.test.ts` | (u) | binary mode; as written `VAR=x cd tests && ...` applies the variable to `cd` only (bash semantics) and `/path/to/...` is a placeholder; on Windows the binary would be quarto.cmd or quarto.exe |
| 21 | 747 | Task 4 Step 8 | `git add tests/utils.ts tests/unit/harness-failure-reporting.test.ts tests/unit/smoke-all-prerender-isolation.test.ts tests/unit/chrome-launch-fixtures.ts tests/quarto-cmd.ts ...` | (a) | [GIT] |
| 22 | 748 | Task 4 Step 8 | `git commit -m "tests: runHarness/runtimeScriptCommand helpers; process sites on deno_ral/process and errors"` | (a) | [GIT] |
| 23 | 782 | Task 5 Step 2 | `tools/rewrite-import-specifier.sh testing/asserts tests/asserts.ts tests \| wc -l` | (u) | bash script (see PR 22 rows 6/15 for python3 and relpath concerns); expected `157` |
| 24 | 783 | Task 5 Step 2 | `tools/rewrite-import-specifier.sh https://deno.land/std@0.93.0/assert/assert_object_match.ts tests/asserts.ts tests` | (u) | as row 23; URL argument, MSYS conversion unlikely but unverified |
| 25 | 784 | Task 5 Step 2 | `tools/rewrite-import-specifier.sh fmt/colors src/deno_ral/colors.ts tests` | (u) | as row 23 |
| 26 | 785 | Task 5 Step 2 | `tools/rewrite-import-specifier.sh encoding/base64 src/deno_ral/encoding.ts tests` | (u) | as row 23 |
| 27 | 786 | Task 5 Step 2 | `tools/rewrite-import-specifier.sh fs/eol src/deno_ral/fs.ts tests` | (u) | as row 23 |
| 28 | 787 | Task 5 Step 2 | `tools/rewrite-import-specifier.sh path src/deno_ral/path.ts tests` | (u) | as row 23 |
| 29 | 788 | Task 5 Step 2 | `git checkout -- tests/docs tests/run-parallel-tests.ts` | (a) | [GIT]; destructive restore of those paths (plan calls it a guard) |
| 30 | 797 | Task 5 Step 3 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent $(find unit/ -name '*.test.ts')` | (b) | [RT]; `$(find)` bash-only |
| 31 | 799 | Task 5 Step 3 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent $(find smoke/inspect/ -name '*.test.ts') smoke/run/run-script.test.ts $(find smoke/lua-unit/ -name '*.test.ts') smoke/render/render-html.test.ts smoke/jupyter/cache.test.ts` | (b) | [RT]; `$(find)` bash-only; smoke/jupyter needs Python/Jupyter env |
| 32 | 804 | Task 5 Step 4 | `git add tests` | (a) | [GIT] |
| 33 | 806 | Task 5 Step 4 | `git commit -m "tests: assertions through tests/asserts.ts; std imports through src/deno_ral"` | (a) | [GIT] |
| 34 | 819 | Task 6 Step 1 | `for d in tests/unit tests/smoke tests/integration tests/tools; do printf "%s: " $d; grep -rhoE '\bDeno\.[A-Za-z_]+' $d --include=*.ts \| wc -l; done; printf "tests/*.ts: "; grep -hoE '\bDeno\.[A-Za-z_]+' tests/*.ts \| wc -l` | (a) | bash for-loop, valid only in Git Bash (PowerShell needs a rewrite) |
| 35 | 827 | Task 6 Step 2 | `quarto run --dev tools/codemod-deno-ral.ts --rules fs,temp,env,process,platform --dir tests/unit --dry-run \| head -50` | (b) | [Q] |
| 36 | 828 | Task 6 Step 2 | `quarto run --dev tools/codemod-deno-ral.ts --rules fs,temp,env,process,platform --dir tests/unit` | (b) | [Q]; rewrites files in place (README ground rule: fresh main, same-day merge) |
| 37 | 829 | Task 6 Step 2 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent $(find unit/ -name '*.test.ts') && cd ..` | (b) | [RT]; `$(find)` bash-only |
| 38 | 830 | Task 6 Step 2 | `grep -rnE '\bDeno\.' tests/unit --include=*.ts \| grep -v 'chrome-launch'` | (a) | [GREP] |
| 39 | 836 | Task 6 Step 2 | `git add tests/unit && git commit -m "tests/unit: codemod Deno.* to deno_ral"` | (a) | [GIT]; two commands joined by `&&` (counted as one row here) |
| 40 | 841 | Task 6 Step 3 | `quarto run --dev tools/codemod-deno-ral.ts --rules fs,temp,env,process,platform --dir tests/smoke --dry-run \| head -50` (and the non-dry run, "same three commands with --dir tests/smoke") | (b) | [Q] |
| 41 | 841 | Task 6 Step 3 | `./run-tests.sh --agent $(find smoke/ -name '*.test.ts')` (slow, 30-60 min) or the subset `$(find smoke/render/ ...) $(find smoke/project/ ...) $(find smoke/use/ ...) $(find smoke/check/ ...)` | (b) | [RT]; `$(find)` bash-only; plan says CI runs the rest |
| 42 | 841 | Task 6 Step 3 | `grep -rnE '\bDeno\.' tests/smoke --include=*.ts \| grep -v 'chrome-launch'` | (a) | [GREP] ("same three commands" implies the grep) |
| 43 | 844 | Task 6 Step 3 | `git add tests/smoke && git commit -m "tests/smoke: codemod Deno.* to deno_ral"` | (a) | [GIT]; two commands joined by `&&` |
| 44 | 850 | Task 6 Step 4 | `quarto run --dev tools/codemod-deno-ral.ts --rules fs,temp,env,process,platform --dir tests/integration` | (b) | [Q] |
| 45 | 851 | Task 6 Step 4 | `quarto run --dev tools/codemod-deno-ral.ts --rules fs,temp,env,process,platform --dir tests/tools` | (b) | [Q] |
| 46 | 852 | Task 6 Step 4 | `quarto run --dev tools/codemod-deno-ral.ts --rules fs,temp,env,process,platform --dir tests` | (b) | [Q]; rewrites tests/quarto-cmd.ts and tests/utils.ts too |
| 47 | 855 | Task 6 Step 4 | `git checkout -- tests/docs tests/run-parallel-tests.ts` (fallback when the tool has no `--exclude`) | (a) | [GIT]; destructive restore of those paths |
| 48 | 857 | Task 6 Step 4 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent $(find unit/ -name '*.test.ts') smoke/render/render-html.test.ts $(find smoke/check/ -name '*.test.ts')` | (b) | [RT]; `$(find)` bash-only |
| 49 | 858 | Task 6 Step 4 | `cd tests && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --import-map=../src/import_map.json integration/playwright-tests.test.ts tools/check-gha-log.ts` | (b) | [DENO] |
| 50 | 862 | Task 6 Step 4 | `git add tests/integration tests/tools tests/*.ts && git commit -m "tests: codemod top-level, integration and tools files to deno_ral"` | (a) | [GIT]; two commands joined by `&&`; `tests/*.ts` glob expanded by bash (PowerShell would not expand for git) |
| 51 | 867 | Task 6 Step 5 | (rerun the Step 1 measurement loop of row 34) | (a) | same command as row 34, expected counts differ |
| 52 | 878 | Task 7 Step 1 | `git diff main -- tests/run-parallel-tests.ts` | (a) | [GIT] |
| 53 | 903 | Task 7 Step 3 | `cd tests && ./run-parallel-tests.sh --dry-run \| head -3` | (u) | as row 6 |
| 54 | 904 | Task 7 Step 3 | `cd tests && ./run-parallel-tests.sh -n=4 --json-for-ci --timing-file=timing-for-ci.txt \| head -5` | (u) | as row 6 |
| 55 | 904 | Task 7 Step 3 | `grep -n run-parallel .github/workflows/*.yml` | (a) | [GREP] |
| 56 | 905 | Task 7 Step 3 | `PATH=/path/to/quarto-release/bin:$PATH` (then the row 54 command) | (c) | bash `VAR=x` form with POSIX path syntax and `:` separator; Windows PATH uses `;` and an installed release has quarto.cmd |
| 57 | 906 | Task 7 Step 3 | `grep -c 'Deno\.' tests/run-parallel-tests.ts` | (a) | [GREP] |
| 58 | 906 | Task 7 Step 3 | `grep -n 'Deno.run' tests/run-parallel-tests.ts` | (a) | [GREP] |
| 59 | 911 | Task 7 Step 4 | `git add tests/run-parallel-tests.ts` | (a) | [GIT] |
| 60 | 912 | Task 7 Step 4 | `git commit -m "tests/run-parallel-tests: Deno.Command instead of the removed Deno.run; stays a quarto run script"` | (a) | [GIT] |
| 61 | 917 | Task 8 Step 1 | `quarto run --dev tools/check-runtime-boundary.ts --update-baseline` | (b) | [Q] |
| 62 | 934 | Task 8 Step 3 | `git add tools/runtime-boundary-baseline.json tests/README.md` | (a) | [GIT] |
| 63 | 935 | Task 8 Step 3 | `git commit -m "ratchet baseline after the tests codemod; document the harness seam"` | (a) | [GIT] |
| 64 | 940 | Verification | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent $(find unit/ -name '*.test.ts')` | (b) | [RT] |
| 65 | 941 | Verification | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent $(find smoke/ -name '*.test.ts')` | (b) | [RT]; plan says CI |
| 66 | 942 | Verification | `cd tests && ./run-parallel-tests.sh --dry-run` (dev and installed quarto) | (u) | as row 6 |
| 67 | 944 | Verification | `quarto run --dev tools/check-runtime-boundary.ts` | (b) | [Q] |
| 68 | 952 | Review checklist | `git diff -U0 <commit> \| grep '^[-+]' \| grep -v 'import\|Deno\.' \| grep -v '^[-+][-+]'` | (a) | [GREP] |

Tool invocations embedded in code the executor writes (not commands the executor runs, not counted above): line 616 `exec("taskkill", { args: ["/PID", String(pid), "/T", "/F"] ...` (Windows kill path in tests/quarto-cmd.ts, class u); line 628 `execSync("pgrep", { args: ["-P", ...] })` (Unix-only branch, class c); line 483 `execSync("icacls", ...)` (makeUnreadableDir Windows branch, class u); line 697 `exec("pdftotext", ...)` (needs pdftotext on PATH, class u); line 889 `new Deno.Command("./run-tests.sh", ...)` in tests/run-parallel-tests.ts (class c: Windows cannot exec a .sh directly, needs run-tests.ps1 or a shell); line 585 generated `@echo off ... %*` .cmd wrapper in writeFakeExecutable (class a, existing Windows branch kept).


### Windows mentions

- Context, line 36: "Runtime re-invocation for fake executables: `tests/unit/chrome-launch-fixtures.ts:30-50` writes a `.cmd`/`.sh` wrapper that runs `"${Deno.execPath()}" run --allow-net <script.js>`"
- Task 3 Step 3, line 379: "(keep the step body as is; `isWindows` imported from `../../../src/deno_ral/platform.ts` replaces the `Deno.build.os === "windows"` that PR 19 already rewrote)."
- Task 4 Step 1, lines 480 and 583-584 (code): `if (isWindows) {` ... `` const cmdPath = join(dir, `${name}.cmd`); ``
- Task 4 Step 4, line 595: "`isWindows` from `../../src/deno_ral/platform.ts` (PR 19 already did this line)"
- Task 4 Step 5, line 616 (code): `` const result = await exec("taskkill", { ``
- Review checklist / Task 4 Step 5 context line 231 (verbatim from the "Hand-converted sites" list at line 37): "`tests/quarto-cmd.ts:164-170` (`outputSync`), `:218-222` (`output`)" (the taskkill site; the line itself does not say taskkill).


## 24-codemod-package-src.md

Extracted commands: 40 (a=17, b=17, c=3, d=0, u=3)

| # | line | section | command | class | note |
|---|---|---|---|---|---|
| 1 | 65 | Acceptance criteria | `grep -rnE '\bDeno\.' package/src --include=*.ts \| grep -v 'common/compile-quarto-latexmk.ts'` | (a) | [GREP] |
| 2 | 66 | Acceptance criteria | `grep -rn 'from "jsr:\|from "https:' package/src --include=*.ts` | (a) | [GREP] |
| 3 | 67 | Acceptance criteria | `grep -rln 'execPath()\|"QUARTO_DENO"' package/src --include=*.ts \| sort` | (a) | [GREP]; Git Bash sort |
| 4 | 68 | Acceptance criteria | `package/src/quarto-bld configure` | (b) | [QB] |
| 5 | 68 | Acceptance criteria | `package/src/quarto-bld prepare-dist` | (b) | [QB] |
| 6 | 68 | Acceptance criteria | `ls -l package/dist/bin/tools/pandoc` (symlink to `<arch>/pandoc`, stated "Linux/macOS") | (c) | the symlink branch is skipped on Windows (isWindows), so there is nothing to find; the plan labels this check Linux/macOS |
| 7 | 69 | Acceptance criteria | `package/src/quarto-bld cycle-dependencies -o "$(mktemp -d)/cycles.json"` | (u) | [QB]; `$(mktemp -d)` returns a Git Bash /tmp path handed to a Windows exe (-o value) |
| 8 | 70 | Acceptance criteria | `quarto run --dev package/src/common/import-report/find-bad-imports.ts src/quarto.ts` | (b) | [Q] |
| 9 | 81 | Task 1 Step 1 | `grep -rn 'Deno\.run(\|new Deno\.Command\|Deno\.CommandStatus' package/src --include=*.ts` | (a) | [GREP] |
| 10 | 84 | Task 1 Step 1 | ``grep -rn '@ts-expect-error `Deno.run()`' package/src/util/tar.ts`` | (a) | [GREP]; backticks inside single quotes are literal in bash |
| 11 | 89 | Task 1 Step 2 | `git add package/src` | (a) | [GIT]; conditional |
| 12 | 91 | Task 1 Step 2 | `git commit -m "package/src: process calls PR 08 missed, through deno_ral/process"` | (a) | [GIT]; conditional |
| 13 | 121 | Task 2 Step 2 | `grep -n 'execSync(' package/src/common/configure.ts` | (a) | [GREP] |
| 14 | 135 | Task 2 Step 3 | `package/src/quarto-bld configure 2>&1 \| tail -3` | (b) | [QB] |
| 15 | 136 | Task 2 Step 3 | `ls -l package/dist/bin/tools/pandoc` | (c) | as row 6: no symlink on Windows, the pandoc binary lives under tools/<arch>/pandoc.exe |
| 16 | 137 | Task 2 Step 3 | `package/dist/bin/tools/pandoc --version \| head -1` | (c) | depends on the symlink (row 15); on Windows invoke tools/<arch>/pandoc.exe |
| 17 | 138 | Task 2 Step 3 | `package/dist/bin/tools/x86_64/deno check --unstable-kv --import-map=src/import_map.json package/src/bld.ts` | (b) | [DENO] |
| 18 | 142 | Task 2 Step 4 | `git add package/src/util/utils.ts package/src/common/configure.ts` | (a) | [GIT] |
| 19 | 144 | Task 2 Step 4 | `git commit -m "package/src: writeFileSync and symlinkSync instead of Deno.create/writeAll and an ln process"` | (a) | [GIT] |
| 20 | 157 | Task 3 Step 1 | `grep -rhoE '\bDeno\.[A-Za-z_]+' package/src --include=*.ts \| sort \| uniq -c \| sort -rn` | (a) | [GREP]; Git Bash sort/uniq |
| 21 | 165 | Task 3 Step 2 | `quarto run --dev tools/codemod-deno-ral.ts --rules fs,temp,env,process,platform --dir package/src --dry-run \| head -80` | (b) | [Q] |
| 22 | 166 | Task 3 Step 2 | `quarto run --dev tools/codemod-deno-ral.ts --rules fs,temp,env,process,platform --dir package/src` | (b) | [Q]; rewrites files in place |
| 23 | 167 | Task 3 Step 2 | `grep -rnE '\bDeno\.' package/src --include=*.ts \| grep -v 'common/compile-quarto-latexmk.ts'` | (a) | [GREP] |
| 24 | 174 | Task 3 Step 3 | `package/src/quarto-bld --help \| head -3` | (b) | [QB] |
| 25 | 175 | Task 3 Step 3 | `package/src/quarto-bld configure` | (b) | [QB] |
| 26 | 176 | Task 3 Step 3 | `package/src/quarto-bld prepare-dist` | (b) | [QB]; `package/pkg-working/bin/quarto.js` expected |
| 27 | 176 | Task 3 Step 3 | `git status --short package/pkg-working` | (a) | [GIT] |
| 28 | 177 | Task 3 Step 3 | `package/src/quarto-bld cycle-dependencies -o "$(mktemp -d)/cycles.json"` | (u) | as row 7 |
| 29 | 178 | Task 3 Step 3 | `quarto run --dev package/src/common/import-report/find-bad-imports.ts src/quarto.ts` | (b) | [Q] |
| 30 | 179 | Task 3 Step 3 | `package/src/quarto-bld update-html-dependencies --help` | (b) | [QB] |
| 31 | 180 | Task 3 Step 3 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/tar-command.test.ts unit/macos-notarize-status.test.ts smoke/render/render-html.test.ts` | (b) | [RT]; macos-notarize test is macOS-oriented |
| 32 | 186 | Task 3 Step 4 | `git add package/src` | (a) | [GIT] |
| 33 | 187 | Task 3 Step 4 | `git commit -m "package/src: codemod remaining Deno.* calls to deno_ral"` | (a) | [GIT] |
| 34 | 192 | Task 4 Step 1 | `quarto run --dev tools/check-runtime-boundary.ts --update-baseline` | (b) | [Q] |
| 35 | 196 | Task 4 Step 2 | `git add tools/runtime-boundary-baseline.json` | (a) | [GIT] |
| 36 | 197 | Task 4 Step 2 | `git commit -m "ratchet baseline: package/src at zero"` | (a) | [GIT] |
| 37 | 203 | Verification | `package/src/quarto-bld configure && package/src/quarto-bld prepare-dist` | (b) | [QB] x2 |
| 38 | 204 | Verification | `package/src/quarto-bld cycle-dependencies -o <file>` | (u) | as row 7 |
| 39 | 205 | Verification | `quarto run --dev package/src/common/import-report/find-bad-imports.ts src/quarto.ts` | (b) | [Q] |
| 40 | 206 | Verification | `quarto run --dev tools/check-runtime-boundary.ts` | (b) | [Q] |

(Not counted: line 181 CI pointer to test-bundle.yml and create-release.yml.)


### Windows mentions

- Task 2 Step 2, line 121: "Replace the `if (!isWindows) { ... }` block of `copyPandocScript` (the `ln -s` process) with:"
- Task 2 Step 2, line 124 (code): `if (!isWindows) {`
- Risks and rollback, line 221: "`symlinkSync` with a relative target behaves like `ln -s` (the link resolves relative to its own directory); on Windows the branch is not taken, as before."


## 25-boundary-zero-and-monkey-patch-removal.md

Extracted commands: 62 (a=42, b=17, c=0, d=0, u=3)

| # | line | section | command | class | note |
|---|---|---|---|---|---|
| 1 | 96 | Context (type inventory) | `rg -n 'Deno\.(CommandOptions\|CommandOutput\|ChildProcess\|...)\b' src package/src tests tools -g '*.ts' \| rg -v '^src/deno_ral/\|extension-subtrees\|^tools/'` | (a) | [GREP]; rg is installed |
| 2 | 148 | Acceptance criteria | `rg -n '\bDeno\.' src package/src -g '*.ts' -g '!src/deno_ral/**' -g '!src/resources/extension-subtrees/**' -g '!src/resources/scripts/**' -g '!src/resources/create/**' -g '!src/resources/tools/ast-diagram/**' -g '!src/webui/quarto-preview/build.ts'` | (a) | [GREP]; globs are single-quoted, `!` safe in Git Bash non-interactive |
| 3 | 149 | Acceptance criteria | `quarto run --dev tools/check-runtime-boundary.ts` | (b) | [Q] |
| 4 | 150 | Acceptance criteria | `ls src/core/deno/monkey-patch.ts src/deno_ral/original-real-path.ts` (expects "No such file") | (a) | [GREP]; message text differs in PowerShell |
| 5 | 151 | Acceptance criteria | `rg -n 'originalRealPathSync\|monkey-patch\|original-real-path' src tests package/src .claude -g '!dev-docs/**'` | (a) | [GREP] |
| 6 | 151 | Acceptance criteria | `rg -n 'import \{[^}]*\bcall\b[^}]*\} from "[./]*deno_ral/process.ts"' src -g '*.ts'` | (a) | [GREP] |
| 7 | 154 | Acceptance criteria | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent $(find unit/ -name '*.test.ts')` | (b) | [RT]; `$(find)` bash-only |
| 8 | 154 | Acceptance criteria | `$(find smoke/ -name '*.test.ts')` in CI on Linux, macOS and Windows | (u) | CI-only on Windows per the plan; PR 25 is not in the README per-OS manual table, so not (d) |
| 9 | 166 | Task 1 Step 1 | `rg -n 'export function canonicalPathSync' -A 3 src/deno_ral/fs.ts` | (a) | [GREP] |
| 10 | 166 | Task 1 Step 1 | `rg -n 'canonicalPathSync resolves symlinks' tests/unit/ral/fs.test.ts` | (a) | [GREP] |
| 11 | 167 | Task 1 Step 1 | `rg -n 'export function realPathSync' src/deno_ral/fs.ts` | (a) | [GREP] |
| 12 | 171 | Task 1 Step 2 | `rg -n 'isAlreadyExists\|retryOnAlreadyExists' src/deno_ral/temp.ts tests/unit/ral/temp.test.ts` | (a) | [GREP] |
| 13 | 176 | Task 1 Step 3 | `rg -n 'errorWithPath' src/deno_ral/fs.ts src/deno_ral/errors.ts` | (a) | [GREP] |
| 14 | 176 | Task 1 Step 3 | `rg -n 'Path: ' tests/unit/ral/fs.test.ts tests/unit/ral/errors.test.ts` | (a) | [GREP] |
| 15 | 182 | Task 1 Step 4 | `cd src && ../package/dist/bin/tools/x86_64/deno info --json --unstable-kv --import-map=import_map.json quarto.ts \| python3 -c "import json,sys; [print(m['local']) for m in json.load(sys.stdin)['modules'] if m.get('local')]" \| xargs grep -ln 'Deno\.copy\b\|Deno\.writeAll\b' 2>/dev/null; cd ..` | (u) | [DENO]; python3 availability on Windows unverified; `local` paths from `deno info` on Windows are drive-letter/backslash paths passed through xargs |
| 16 | 191 | Task 1 Step 5 | `rg -n 'onFileRead' src/core/performance/metrics.ts src/deno_ral/fs.ts` | (a) | [GREP] |
| 17 | 191 | Task 1 Step 5 | `rg -n '\bDeno\.' src/core/performance/metrics.ts` | (a) | [GREP] |
| 18 | 212 | Task 2 Step 3 | `cd src && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --import-map=import_map.json quarto.ts` | (b) | [DENO] |
| 19 | 215 | Task 2 Step 3 | `git add -u src package/src` | (a) | [GIT] |
| 20 | 216 | Task 2 Step 3 | `git commit -m "types: replace remaining Deno.* type references with deno_ral types"` | (a) | [GIT] |
| 21 | 236 | Task 3 Step 3 | `cd src && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --import-map=import_map.json quarto.ts` | (b) | [DENO] |
| 22 | 237 | Task 3 Step 3 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/process.test.ts smoke/create/create.test.ts` | (b) | [RT] |
| 23 | 242 | Task 3 Step 4 | `git add src/deno_ral/process.ts src/command/render/pandoc.ts src/command/create/editor.ts` | (a) | [GIT] |
| 24 | 243 | Task 3 Step 4 | `git commit -m "deno_ral/process: remove the call alias; callers use exec"` | (a) | [GIT] |
| 25 | 289 | Task 4 Step 4 | `git rm src/core/deno/monkey-patch.ts src/deno_ral/original-real-path.ts` | (a) | [GIT] |
| 26 | 294 | Task 4 Step 5 | `cd src && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --import-map=import_map.json quarto.ts` | (b) | [DENO] |
| 27 | 295 | Task 4 Step 5 | `rg -n 'originalRealPathSync\|original-real-path\|monkey-patch' src tests package/src .claude` | (a) | [GREP] |
| 28 | 296 | Task 4 Step 5 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent $(find unit/ral/ -name '*.test.ts') unit/path.test.ts $(find unit/project/ -name '*.test.ts') smoke/project/project-detect-denied-config.test.ts smoke/check/check-info-project.test.ts smoke/project/project-prepost.test.ts smoke/render/render-html.test.ts` | (b) | [RT]; `$(find)` bash-only; the symlink test in unit/ral/fs.test.ts needs symlink privilege on Windows (Developer Mode/admin), unverified |
| 29 | 301 | Task 4 Step 6 | `git add -A src/quarto.ts src/deno_ral src/core/deno src/command/check/check.ts tests/utils.ts ...` | (a) | [GIT]; `git add -A` with explicit paths |
| 30 | 302 | Task 4 Step 6 | `git commit -m "remove core/deno/monkey-patch.ts and original-real-path.ts; canonicalPathSync on Deno.realPathSync"` | (a) | [GIT] |
| 31 | 312 | Task 5 Step 1 | `rg -n '\bDeno\.' src package/src -g '*.ts' -g '!src/deno_ral/**' -g '!src/resources/**' -g '!src/webui/quarto-preview/build.ts' \| rg '^[^:]+:[0-9]+:\s*(//\|/\*\|\*)\|//.*\bDeno\.'` | (a) | [GREP]; pattern `^[^:]+:` assumes no drive-letter colon, rg prints relative paths so fine |
| 32 | 345 | Task 5 Step 3 | (rerun the Step 1 command) | (a) | same as row 31 |
| 33 | 345 | Task 5 Step 3 | `cd src && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --import-map=import_map.json quarto.ts` | (b) | [DENO] |
| 34 | 348 | Task 5 Step 3 | `git add -u src package/src` | (a) | [GIT] |
| 35 | 349 | Task 5 Step 3 | `git commit -m "comments: no Deno.* mentions outside the runtime layer"` | (a) | [GIT] |
| 36 | 375 | Task 6 Step 1 | `ls src/command/render/latexmk/quarto-latexmk.ts package/src/common/compile-quarto-latexmk.ts` (must print "No such file") | (a) | [GREP] |
| 37 | 381 | Task 6 Step 2 | `quarto run --dev tools/codemod-deno-ral.ts --rules fs,temp,env,process,platform --file <file>` | (b) | [Q] |
| 38 | 386 | Task 6 Step 3 | `git add tools/check-runtime-boundary.ts tests/unit/tools/check-runtime-boundary.test.ts` | (a) | [GIT] |
| 39 | 387 | Task 6 Step 3 | `git add -u src` | (a) | [GIT] |
| 40 | 388 | Task 6 Step 3 | `git commit -m "runtime boundary: allow-list the standalone scripts; convert the last Deno.* sites"` | (a) | [GIT] |
| 41 | 398 | Task 7 Step 1 | `quarto run --dev tools/check-runtime-boundary.ts --update-baseline` | (b) | [Q] |
| 42 | 406 | Task 7 Step 2 | `quarto run --dev tools/check-runtime-boundary.ts` | (b) | [Q] |
| 43 | 407 | Task 7 Step 2 | `rg -n 'from "(log/file-handler\|dotenv)"' src -g '*.ts' -g '!src/deno_ral/**'` | (a) | [GREP] |
| 44 | 408 | Task 7 Step 2 | `rg -n 'FileHandler' src/deno_ral/log.ts` | (a) | [GREP] |
| 45 | 409 | Task 7 Step 2 | `rg -n 'readStdinLines\|readStdin\b' src/command/create/cmd.ts src/command/editor-support/crossref.ts` | (a) | [GREP] |
| 46 | 410 | Task 7 Step 2 | `rg -n 'execPath\(\)\|QUARTO_DENO\|architectureToolsPath\("deno"\)\|"deno"' package/src src -g '*.ts' -g '!src/deno_ral/**'` | (a) | [GREP] |
| 47 | 411 | Task 7 Step 2 | `rg -n -i '\bdeno\b' package/scripts package/src/quarto-bld package/src/quarto-bld.cmd package/launcher/src configure.sh configure.cmd .github/workflows -g '!*.ts'` | (a) | [GREP]; globs and `!` single-quoted |
| 48 | 419 | Task 7 Step 3 | `echo 'export const _probe = Deno.cwd();' >> src/core/path.ts` | (a) | bash `>>` redirect, no direct PowerShell form (Add-Content); modifies a tracked file temporarily |
| 49 | 420 | Task 7 Step 3 | `quarto run --dev tools/check-runtime-boundary.ts; echo "exit=$?"` | (b) | [Q]; `$?` bash-only (PowerShell: `$LASTEXITCODE`) |
| 50 | 421 | Task 7 Step 3 | `git checkout -- src/core/path.ts` | (a) | [GIT]; destructive restore of the probe edit |
| 51 | 428 | Task 7 Step 4 | `rg -n 'continue-on-error\|\|\| true' .github/workflows/runtime-boundary.yml` | (a) | [GREP] |
| 52 | 433 | Task 7 Step 5 | `git add tools/runtime-boundary-baseline.json` | (a) | [GIT] |
| 53 | 434 | Task 7 Step 5 | `git commit -m "runtime boundary: baseline at zero for src and package/src"` | (a) | [GIT] |
| 54 | 516 | Task 8 Step 4 | `git add .claude/rules/typescript/deno-essentials.md .claude/rules/typescript/deno-ral.md dev-docs/runtime-migration/README.md` | (a) | [GIT] |
| 55 | 517 | Task 8 Step 4 | `git commit -m "docs: deno_ral is the only runtime API; Phase 1 complete in the migration README"` | (a) | [GIT] |
| 56 | 523 | Verification | `quarto run --dev tools/check-runtime-boundary.ts` (exit 0 at zero; probe exit 1) | (b) | [Q] |
| 57 | 524 | Verification | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent $(find unit/ -name '*.test.ts')` | (b) | [RT] |
| 58 | 524 | Verification | `$(find smoke/ -name '*.test.ts')` (pass in CI on Linux, macOS and Windows) | (u) | CI-only on Windows per the plan; not in the README per-OS table, so not (d) |
| 59 | 525 | Verification | `package/src/quarto-bld prepare-dist` | (b) | [QB] |
| 60 | 525 | Verification | `grep -c 'Deno.realPathSync = ' package/pkg-working/bin/quarto.js` | (a) | [GREP] |
| 61 | 526 | Verification | `QUARTO_REPORT_PERFORMANCE_METRICS=fileReads package/dist/bin/quarto render tests/docs/test.qmd` | (b) | [Q]; `VAR=x cmd` bash-only |
| 62 | 527 | Verification | `package/dist/bin/quarto dev-call make-ast-diagram --help` | (b) | [Q] |

(Rows 32 and 58 are re-run pointers that still carry a command; rows 8 and 58 are CI-run pointers classed (u).)

### Windows mentions

- Context, line 25 (verbatim fragment): "Deno returns no `\\?\` prefix, so nothing is sliced: a 4-character slice would turn `\\?\UNC\srv\share` into `UNC\srv\share`"
- Runtime residue table row 18, line 61: "The launchers that run `bin/quarto.js` on the bundled Deno: `package/scripts/common/quarto` and `package/scripts/windows/quarto.cmd` (`QUARTO_DENO_OPTIONS`, `DENO_DIR`, the `config/deno-version` reconfigure check), `package/launcher/src/main.rs` (`QUARTO_DENO`, `bin/tools/<arch>/deno`) | the user's shell; `quarto.exe`"
- Runtime residue table row 19, line 62: "`package/src/quarto-bld` and `quarto-bld.cmd` (`"$QUARTO_DENO" run ... bld.ts`), `configure.sh` and `configure.cmd` ..., `package/scripts/windows/check-deno-in-use.cmd`, ..."
- Comment table, line 74: lists `src/core/windows.ts:128` among the comment sites.
- Context, line 116: "Two further `Deno.<Capitalised>` hits exist and are comments (`src/core/windows.ts:128` `Deno.Run`, `src/core/sass/cache.ts:4` `Deno.KV`; Task 5)."
- Interfaces, line 132: "/** Symlinks resolved; the runtime returns no Windows `\\?\` prefix; throws when `path` does not exist. Deno: Deno.realPathSync; PR 27: fs.realpathSync.native. */"
- Acceptance criteria, line 154: "`$(find smoke/ -name '*.test.ts')` in CI on Linux, macOS and Windows."
- Task 4 Step 2, line 268: " * The canonical absolute path: symlinks resolved, and no Windows `\\?\` prefix"
- Task 5 comment table, line 322: "`src/command/call/axe/cmd.ts:184` ... Win32's"
- Task 5 comment table, line 333: "`src/core/windows.ts:128` `// ... to avoid issue with Deno.Run()` | `// ... to avoid issues with process spawning`"
- Task 7 Step 2, line 411 (command text): `rg -n -i '\bdeno\b' package/scripts package/src/quarto-bld package/src/quarto-bld.cmd ... configure.cmd ...`
- Verification, line 524: "`$(find smoke/ -name '*.test.ts')` -> pass in CI on Linux, macOS and Windows."
- Risks and rollback, line 544: "Windows CI is the gate for the UNC case."

### Windows mentions added by grep sweep at assembly
Lines matching `windows|win32|.cmd|.ps1|taskkill` (case-insensitive) that the extractor's list above did not cite. Quoted verbatim, trimmed to 300 characters; section is the nearest preceding heading.

- L500 (Task 8: Rules and README): "| `platform.ts` | Platform and runtime facts | `isWindows`, `isMac`, `isLinux`, `os`, `arch`, `runtime`, `consoleColumns`, `inspect`, `isRootUser`, `noColor` |"

## 26-node-build-job.md

Extracted commands: 106 (a=47, b=24, c=19, d=0, u=16)

Shell assumed by the plan: bash (Git Bash on Windows; CI steps with `shell: bash`). No PowerShell, `.cmd` or `run-tests.ps1` form is given anywhere. `quarto-node` is an extensionless bash launcher with no `.cmd` twin. Rows marked (b) "run in Git Bash" mean the command is plain bash/GNU userland with no path or Windows-binary concern; PowerShell would need a rewrite.

| # | line | section | command | class | note |
|---|---|---|---|---|---|
| 1 | 86 | Interfaces (build.mjs CLI) | `node tools/node-bundle/build.mjs [--entry src/quarto.ts] [--out tools/node-bundle/dist/quarto.mjs] [--check-shim] [--write-meta] [--no-sourcemap]` | a | node script, relative forward-slash paths |
| 2 | 115 | Interfaces (check-shim) | `node tools/node-bundle/check-shim.mjs [--bundle tools/node-bundle/dist/quarto.mjs] [--resources src/resources]` | a | node script |
| 3 | 128 | Interfaces (build-test) | `node tools/node-bundle/build-test.mjs [--script] [--out-dir tools/node-bundle/dist/tests] <file.ts>...` | a | node script |
| 4 | 134 | Interfaces (layer-script.ts) | `deno run --allow-all --no-config --import-map=<repo>/src/import_map.json <fixture> ...args` | u | Deno branch of the helper; needs execPath() deno.exe and a Windows import-map path, untested |
| 5 | 136 | Interfaces (layer-script.ts) | `tools/node-bundle/build-test.mjs --script` then `node <bundle> ...args` | a | node script and node binary |
| 6 | 157 | Interfaces (junit.mjs) | `node tools/node-bundle/junit.mjs summary <file.xml>...` | a | node script |
| 7 | 159 | Interfaces (run-unit-on-node) | `node tools/node-bundle/run-unit-on-node.mjs --known-failures tools/node-bundle/known-failures.json [--base <git-ref>] [--allow-growth] [--write] <file-or-dir>...` | u | script has an OS key `windows`, but Windows behavior of bundled tests is exactly what the plan wants measured |
| 8 | 159 | Interfaces (run-unit-on-node) | internal: `node --test --test-force-exit --test-timeout=300000 --test-reporter=dot ... --test-reporter=junit --test-reporter-destination=<tmp>.xml <bundle>` (cwd = tests/, `quarto-node` environment) | u | spawned by the script (line 1889-1894); Windows tmp path and bundle-relative paths unverified |
| 9 | 164 | Interfaces (run-unit-on-node) | `git show <ref>:tools/node-bundle/known-failures.json` | a | git |
| 10 | 178 | Interfaces (normalize-html) | `node tools/node-bundle/normalize-html.mjs [--root <abs-dir>] <dir>...` | a | node script; handles `\\` and file:// spellings |
| 11 | 187 | Interfaces (normalize-html) | `diff -r -x .quarto` | b | GNU diff only in Git Bash; no PowerShell equivalent |
| 12 | 189 | Interfaces (quarto-node) | `node --enable-experimental-regexp-engine --max-old-space-size=8192 --stack-trace-limit=100 $ROOT/tools/node-bundle/dist/quarto.mjs "$@"` inside the bash launcher | c | launcher is extensionless bash; only runs via Git Bash, `$ROOT` is a /c/... style path |
| 13 | 208 | Acceptance criteria | `npm ci && node tools/node-bundle/build.mjs --check-shim` | b | `npm` -> `npm.cmd` under Git Bash |
| 14 | 208 | Acceptance criteria | `head -c 600 tools/node-bundle/dist/quarto.mjs` | b | GNU head in Git Bash; PowerShell has no byte-count head |
| 15 | 209 | Acceptance criteria | `node --test "tools/node-bundle/*.test.mjs"` | a | quoted glob, node expands it |
| 16 | 210 | Acceptance criteria | `tools/node-bundle/quarto-node --version` | c | bash launcher, no .cmd; not runnable from PowerShell/cmd |
| 17 | 210 | Acceptance criteria | `sleep 10 \| timeout 5 tools/node-bundle/quarto-node --version` | c | bash pipe + GNU timeout; Windows stdin pipe/exit semantics differ (exit 124 check) |
| 18 | 211 | Acceptance criteria | `node tools/node-bundle/run-unit-on-node.mjs --known-failures tools/node-bundle/known-failures.json tests/unit/ral/` ("exits 0 on Linux") | u | criterion is stated for Linux only; Windows result is the CI-filled `windows` section |
| 19 | 212 | Acceptance criteria | `tools/node-bundle/quarto-node render dev-docs/runtime-migration/spike/tests/simple.qmd` | c | bash launcher |
| 20 | 212 | Acceptance criteria | `normalize-html.mjs --root` | a | node script |
| 21 | 212 | Acceptance criteria | `diff -r -x .quarto` against "the Deno render of the same file" | b | GNU diff in Git Bash |
| 22 | 212 | Acceptance criteria | Deno render of the same file (implied `package/dist/bin/quarto render`, see 1503) | b | quarto -> quarto.cmd |
| 23 | 213 | Acceptance criteria | `node tools/node-bundle/check-deps.mjs` | a | node script |
| 24 | 215 | Acceptance criteria | `git diff --stat main -- src/` | a | git |
| 25 | 285 | Task 1 Step 2 | `node --test tools/node-bundle/check-deps.test.mjs` | a | node test runner |
| 26 | 372 | Task 1 Step 4 | `node --test tools/node-bundle/check-deps.test.mjs` | a | node test runner |
| 27 | 378-379 | Task 1 Step 5 | `git add tools/node-bundle/import-map.mjs tools/node-bundle/check-deps.test.mjs` / `git commit -m "..."` | a | git |
| 28 | 473 | Task 2 Step 3 | `node tools/node-bundle/check-deps.mjs --write` | a | node script |
| 29 | 474 | Task 2 Step 3 | `npm install` | b | `npm` -> `npm.cmd` under Git Bash |
| 30 | 475 | Task 2 Step 3 | `node tools/node-bundle/check-deps.mjs` | a | node script |
| 31 | 483 | Task 2 Step 4 | `sed -i.bak 's/"zod": "npm:\/zod@3.24.4"/"zod": "npm:\/zod@3.24.5"/' src/import_map.json` | b | GNU sed in Git Bash only; no PowerShell form |
| 32 | 484 | Task 2 Step 4 | `node tools/node-bundle/check-deps.mjs; echo "exit=$?"` | b | `$?` is bash; PowerShell uses `$LASTEXITCODE` |
| 33 | 485 | Task 2 Step 4 | `mv src/import_map.json.bak src/import_map.json` | b | bash mv (PowerShell: Move-Item) |
| 34 | 492-493 | Task 2 Step 5 | `git add package.json package-lock.json .npmrc .gitignore tools/node-bundle/check-deps.mjs` / `git commit -m "..."` | a | git |
| 35 | 529 | Task 3 Step 2 | `node --test tools/node-bundle/check-shim.test.mjs` | a | node test runner |
| 36 | 866 | Task 3 Step 6 | `node --test tools/node-bundle/check-shim.test.mjs tools/node-bundle/build.test.mjs` | a | the tests themselves build temp bundles and spawn `process.execPath` |
| 37 | 872-873 | Task 3 Step 7 | `git add tools/node-bundle/build.mjs ...` / `git commit -m "..."` | a | git |
| 38 | 1320 | Task 4 Step 2 | `node tools/node-bundle/build.mjs --check-shim` | a | node script |
| 39 | 1321 | Task 4 Step 2 | `QUARTO_BIN_PATH=$PWD/package/dist/bin QUARTO_SHARE_PATH=$PWD/src/resources node tools/node-bundle/dist/quarto.mjs --version` | c | `VAR=x cmd` bash-only; Git Bash `$PWD` is /c/... which node.exe may read as C:\c\...; bin dir has deno.exe not extensionless tools |
| 40 | 1329 | Task 4 Step 3 | `sleep 10 \| QUARTO_BIN_PATH=$PWD/package/dist/bin QUARTO_SHARE_PATH=$PWD/src/resources timeout 5 node tools/node-bundle/dist/quarto.mjs --version; echo "exit=$?"` | c | same env/`$PWD` concern plus GNU `timeout` + Windows pipe semantics, `$?` |
| 41 | 1330-1333 | Task 4 Step 3 | `node --input-type=module -e '... import("./tools/node-bundle/deno-shim.mjs") ... D.readDirSync("/definitely/missing") ...'` | u | multi-line single-quoted bash; likely fine in Git Bash, PowerShell quoting differs; `/definitely/missing` -> `C:\definitely\missing` still ENOENT |
| 42 | 1340-1341 | Task 4 Step 4 | `git add tools/node-bundle/deno-shim.mjs` / `git commit -m "..."` | a | git |
| 43 | 1381 | Task 5 Step 1 | `chmod +x tools/node-bundle/quarto-node` | c | no executable bit on NTFS; git mode must be set via `git update-index --chmod=+x` |
| 44 | 1381 | Task 5 Step 1 | `tools/node-bundle/quarto-node --version` | c | bash launcher (Git Bash shebang only) |
| 45 | 1421 | Task 5 Step 2 | `node --test tools/node-bundle/normalize-html.test.mjs` | a | node test runner |
| 46 | 1495 | Task 5 Step 4 | `node --test tools/node-bundle/normalize-html.test.mjs` | a | node test runner |
| 47 | 1502 | Task 5 Step 5 | `rm -rf /tmp/rt26 && mkdir -p /tmp/rt26 && cp -r dev-docs/runtime-migration/spike/tests /tmp/rt26/deno && cp -r ... /tmp/rt26/node` | u | Git Bash `/tmp` is %TEMP%, but native binaries given `/tmp/...` may read C:\tmp |
| 48 | 1503 | Task 5 Step 5 | `package/dist/bin/quarto render /tmp/rt26/deno/simple.qmd` | b | quarto -> quarto.cmd; /tmp path caveat as row 47 |
| 49 | 1504 | Task 5 Step 5 | `tools/node-bundle/quarto-node render /tmp/rt26/node/simple.qmd` | c | bash launcher, /tmp path |
| 50 | 1505-1506 | Task 5 Step 5 | `node tools/node-bundle/normalize-html.mjs --root /tmp/rt26/deno /tmp/rt26/deno` (and `.../node`) | u | `--root` spelling vs Windows-converted /tmp path; normalizer handles several spellings but unverified |
| 51 | 1507 | Task 5 Step 5 | `diff -r -x .quarto /tmp/rt26/deno /tmp/rt26/node && echo "IDENTICAL"` | u | GNU diff in Git Bash; whether the renders diff clean on Windows (paths, `\`) unknown |
| 52 | 1514-1515 | Task 5 Step 6 | `git add tools/node-bundle/quarto-node tools/node-bundle/normalize-html.mjs tools/node-bundle/normalize-html.test.mjs` / `git commit -m "..."` | a | git |
| 53 | 1586 | Task 6 Step 1 | `node --test tools/node-bundle/junit.test.mjs` | a | node test runner |
| 54 | 1687 | Task 6 Step 2 | `node --test tools/node-bundle/junit.test.mjs` | a | node test runner |
| 55 | 1827 | Task 6 Step 5 | `node --test tools/node-bundle/build-test.test.mjs` | a | spawns `process.execPath --test`; the test deletes NODE_TEST_CONTEXT |
| 56 | 1989-1992 | Task 6 Step 7 (layer-script.ts body) | `exec(execPath(), { args: [join(repo,"tools","node-bundle","build-test.mjs"), "--script", file], cwd: repo })` | u | helper code; no test uses it in this PR |
| 57 | 2007 | Task 6 Step 8 | `echo '{ "$comment": "...", "linux": {}, "macos": {}, "windows": {} }' > tools/node-bundle/known-failures.json` | u | bash echo with single quotes; in Git Bash probably fine, PowerShell would need other quoting |
| 58 | 2008 | Task 6 Step 8 | `node tools/node-bundle/run-unit-on-node.mjs --known-failures tools/node-bundle/known-failures.json --write tests/unit/ral/` | u | writes the OS section; on Windows behavior of every ral test unknown |
| 59 | 2009 | Task 6 Step 8 | `node tools/node-bundle/run-unit-on-node.mjs --known-failures tools/node-bundle/known-failures.json tests/unit/ral/` | u | same |
| 60 | 2018 | Task 6 Step 9 | `node -e 'const f=...; ... require("fs").writeFileSync("/tmp/kf.json", JSON.stringify(j))'` | c | node does not MSYS-convert a path inside the -e string: writes C:\tmp\kf.json |
| 61 | 2019 | Task 6 Step 9 | `node tools/node-bundle/run-unit-on-node.mjs --known-failures /tmp/kf.json tests/unit/ral/; echo "exit=$?"` | c | arg `/tmp/kf.json` is MSYS-converted to %TEMP%\kf.json, differs from row 60's file; `$?` bash |
| 62 | 2026-2027 | Task 6 Step 10 | `git add tools/node-bundle/junit.mjs ... tests/unit/ral/layer-script.ts` / `git commit -m "..."` | a | git |
| 63 | 2070, 2114 | Task 7 Step 1 (workflow) | `uses: actions/checkout@v6` | a | CI action, both OS |
| 64 | 2075, 2117 | Task 7 Step 1 (workflow) | `uses: actions/setup-node@v6` with `node-version: 26`, `cache: npm` | a | CI action |
| 65 | 2081, 2124 | Task 7 Step 1 (workflow) | `uses: ./.github/workflows/actions/quarto-dev` | u | local action; Windows variant (configure.cmd) not shown in this plan |
| 66 | 2084, 2138 | Task 7 Step 1 (workflow) | `npm ci` | a | CI shell on both OS |
| 67 | 2087 | Task 7 Step 1 (workflow) | `node --test "tools/node-bundle/*.test.mjs"` | a | quoted glob |
| 68 | 2090 | Task 7 Step 1 (workflow) | `node tools/node-bundle/check-deps.mjs` | a | node script |
| 69 | 2093, 2141 | Task 7 Step 1 (workflow) | `node tools/node-bundle/build.mjs --check-shim` | a | node script |
| 70 | 2095-2101 | Task 7 Step 1 (workflow, node-unit, `shell: bash`) | `base_args=(); ... node tools/node-bundle/run-unit-on-node.mjs --known-failures tools/node-bundle/known-failures.json "${base_args[@]}" tests/unit/ral/` | u | bash arrays on windows-latest run under Git Bash; the Windows run of the unit tests is the unknown |
| 71 | 2127 | Task 7 Step 1 (workflow, node-render) | `uses: astral-sh/setup-uv@... (v10.0.1)` | a | Linux-only job |
| 72 | 2135 | Task 7 Step 1 (workflow, node-render) | `uv sync --frozen` (working-directory: tests) | a | Linux-only job |
| 73 | 2145 | Task 7 Step 1 (workflow, node-render) | `tools/node-bundle/quarto-node --version` | c | bash launcher (job is Linux-only) |
| 74 | 2146 | Task 7 Step 1 (workflow, node-render) | `tools/node-bundle/quarto-node check 2>&1 \| tee check.log \|\| true` | c | bash launcher, tee |
| 75 | 2151 | Task 7 Step 1 (workflow, node-render) | `source tests/.venv/bin/activate` | b | Windows venv is `tests/.venv/Scripts/activate` |
| 76 | 2152 | Task 7 Step 1 (workflow, node-render) | `rm -rf "$RUNNER_TEMP/render" && mkdir -p "$RUNNER_TEMP/render"` | b | Git Bash |
| 77 | 2153-2154 | Task 7 Step 1 (workflow, node-render) | `cp -r "$SPIKE_TESTS" "$RUNNER_TEMP/render/deno"` / `.../node` | b | Git Bash |
| 78 | 2156 | Task 7 Step 1 (workflow, node-render) | `q="$PWD/package/dist/bin/quarto"` (deno branch) | b | quarto -> quarto.cmd |
| 79 | 2156 | Task 7 Step 1 (workflow, node-render) | `q="$PWD/tools/node-bundle/quarto-node"` (node branch) | c | bash launcher |
| 80 | 2159 | Task 7 Step 1 (workflow, node-render) | `"$q" render "$RUNNER_TEMP/render/$runtime/$doc"` for `simple.qmd website jupyter.qmd` (with `echo "::group::..."` / `echo "::endgroup::"`) | u | website project and Jupyter docs on Windows unverified |
| 81 | 2168 | Task 7 Step 1 (workflow, diff step) | `node tools/node-bundle/normalize-html.mjs --root "$RUNNER_TEMP/render/$runtime" "$RUNNER_TEMP/render/$runtime"` | a | node script |
| 82 | 2170 | Task 7 Step 1 (workflow, diff step) | `diff -r -x .quarto "$RUNNER_TEMP/render/deno" "$RUNNER_TEMP/render/node" > node-render.diff` | b | GNU diff in Git Bash |
| 83 | 2174 | Task 7 Step 1 (workflow, diff step) | `head -c 20000 node-render.diff` | b | GNU head |
| 84 | 2180 | Task 7 Step 1 (workflow) | `uses: actions/upload-artifact@v7` | a | CI action |
| 85 | 2193 | Task 7 Step 2 | `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/test-node-bundle.yml')); print('yaml ok')"` | b | `python3` -> `python` (or `uv run`); pyyaml may be absent |
| 86 | 2194 | Task 7 Step 2 | `npx -y yaml-lint .github/workflows/test-node-bundle.yml` | b | `npx` -> `npx.cmd` under Git Bash |
| 87 | 2198 | Task 7 Step 3 | `gh label create node-known-failures-grow --description "..." --color FBCA04` | a | gh.exe |
| 88 | 2199 | Task 7 Step 3 | `gh label list \| grep node-known-failures-grow` | b | grep in Git Bash; PowerShell: Select-String |
| 89 | 2204-2205 | Task 7 Step 4 | `git add .github/workflows/test-node-bundle.yml` / `git commit -m "..."` | a | git |
| 90 | 2228 | Task 8 Step 1 (node-bundle.md text) | `./configure.sh` | b | configure.sh -> configure.cmd |
| 91 | 2229 | Task 8 Step 1 (node-bundle.md text) | `npm ci` | b | `npm` -> `npm.cmd` under Git Bash |
| 92 | 2230 | Task 8 Step 1 (node-bundle.md text) | `node tools/node-bundle/build.mjs --check-shim` | a | node script |
| 93 | 2231 | Task 8 Step 1 (node-bundle.md text) | `tools/node-bundle/quarto-node render path/to/doc.qmd` | c | bash launcher |
| 94 | 2234 | Task 8 Step 1 (node-bundle.md text) | `QUARTO_NODE=/path/to/node` and `QUARTO_DEBUG=true` env settings | c | `VAR=x cmd` style env, honoured only by the bash launcher |
| 95 | 2257 | Task 8 Step 1 (node-bundle.md text) | `node tools/node-bundle/check-deps.mjs --write && npm install` | b | `npm` -> `npm.cmd` under Git Bash |
| 96 | 2303-2304 | Task 8 Step 4 | `git add dev-docs/runtime-migration/node-bundle.md dev-docs/runtime-migration/spike/README.md dev-docs/runtime-migration/README.md` / `git commit -m "..."` | a | git |
| 97 | 2311 | Verification | `node --test "tools/node-bundle/*.test.mjs"` | a | node test runner |
| 98 | 2312 | Verification | `node tools/node-bundle/check-deps.mjs` | a | node script |
| 99 | 2313 | Verification | `node tools/node-bundle/build.mjs --check-shim` | a | node script |
| 100 | 2314 | Verification | `tools/node-bundle/quarto-node --version` | c | bash launcher |
| 101 | 2314 | Verification | `sleep 10 \| timeout 5 tools/node-bundle/quarto-node --version; echo "exit=$?"` | c | as row 17 |
| 102 | 2315 | Verification | `node tools/node-bundle/run-unit-on-node.mjs --known-failures tools/node-bundle/known-failures.json tests/unit/ral/` | u | as row 18 |
| 103 | 2317 | Verification | `git diff --stat main -- src/` | a | git |
| 104 | 2318 | Verification | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/path.test.ts` | b | `VAR=x cmd` bash; run-tests.sh needs DENO_DIR=x86_64 under Git Bash, or run-tests.ps1 |
| 105 | 2319 | Verification | `quarto run --dev tools/check-runtime-boundary.ts` | b | quarto -> quarto.cmd |
| 106 | 2316 | Verification | "The local render diff from Task 5 step 5 prints `IDENTICAL`" (repeats rows 47-51) | c | bash launcher + /tmp paths; see rows 47-51 |

### Windows mentions

- L10: "Node: the new `node-unit` job (Linux and Windows) is **not** `continue-on-error` and is the per-PR real-Node signal" (section header block)
- L37 (Scope): "`.github/workflows/test-node-bundle.yml`: `node-unit` (Linux, Windows; not allowed to fail) and `node-render` (Linux; `continue-on-error: true`)."
- L159 (Interfaces, run-unit-on-node): "Then, for the current OS key (`linux`, `macos`, `windows`):"
- L174 (Interfaces, known-failures.json): `"windows": {}`
- L862 (Task 3 Step 5): "... the run comparison prints `{"sep":"/","inner":"inner@2 nested under dep"}` on both sides (`"\\"` on Windows)."
- L883 (Task 4 Step 1): "`.bat`/`.cmd` go through the BatBadBut-safe `cmd.exe` command line Deno's Rust `Command` builds (PR 28 moves this into `src/deno_ral/process.ts` and deletes it here)."
- L1059, L1098, L1100, L1125-1127, L1855: shim/runner code (`process.platform === "win32"`, `windowsHide: true`, "Deno's Rust Command escapes .bat/.cmd arguments for cmd.exe (CVE-2024-24576); Node refuses to spawn them without a shell (CVE-2024-27980)", `windowsCommand`, `ComSpec ?? "cmd.exe"`, `windowsVerbatimArguments`, osKey)
- L2007: known-failures seed JSON includes `"windows": {}`
- L2011 (Task 6 Step 8): "The Windows section is filled the same way from the first CI run's log (Task 7): copy the `--write` output of a `workflow_dispatch` run with an added `--write` step, or run the two commands on a Windows machine."
- L2068 (workflow): `os: [ubuntu-latest, windows-latest]`
- L2252 (node-bundle.md table): "`node-unit` (Linux, Windows; must pass) and `node-render` (allowed failure)."
- L2320 (Verification): "Push the branch: `node-unit` is green on Linux and Windows; ..."
- L2352 (Decisions): "... `node-unit` (Linux and Windows, not allowed to fail) ..."

### Windows mentions added by grep sweep at assembly
Lines matching `windows|win32|.cmd|.ps1|taskkill` (case-insensitive) that the extractor's list above did not cite. Quoted verbatim, trimmed to 300 characters; section is the nearest preceding heading.

- L1145 (Task 4: The temporary Deno shim): "constructor(cmd, opts = {}) { this.cmd = cmd; this.opts = opts; }"
- L1146 (Task 4: The temporary Deno shim): "spawn() { const [c, a, extra] = windowsCommand(p(this.cmd), this.opts.args ?? []); return new ChildProcess(spawn(c, a, { ...spawnOptions(this.opts, "spawn"), ...extra })); }"
- L1149 (Task 4: The temporary Deno shim): "const [c, a, extra] = windowsCommand(p(this.cmd), this.opts.args ?? []);"
- L1159 (Task 4: The temporary Deno shim): "const [c, a, extra] = windowsCommand(p(this.cmd), this.opts.args ?? []);"

## 27b-ral-platform-env-tar-log-on-node.md

Extracted commands: 43 (a=8, b=17, c=6, d=0, u=12)

Shell assumed: bash (Git Bash). All `run-tests.sh` invocations use `VAR=x cmd` and `$(find ...)`; no `run-tests.ps1` form. `node tools/node-bundle/run-unit-on-node.mjs ...` is the only Windows-aware flow (the plan says the PR 26 `node-unit` job runs on Windows).

| # | line | section | command | class | note |
|---|---|---|---|---|---|
| 1 | 106 | Acceptance criteria | `grep -n "Deno" src/deno_ral/platform.ts src/deno_ral/env.ts src/deno_ral/tar.ts src/deno_ral/log.ts \| grep -v "^\S*:\s*//\|^\S*:\s*\*"` | b | GNU grep pipeline in Git Bash; PowerShell needs Select-String |
| 2 | 107 | Acceptance criteria | `grep -n "core/" src/deno_ral/tar.ts` | b | GNU grep in Git Bash |
| 3 | 108 | Acceptance criteria | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent $(find unit/ral/ -name '*.test.ts') unit/dotenv-config.test.ts unit/environment.test.ts` | b | `VAR=x cmd` + `$(find)` bash; run-tests.sh needs DENO_DIR=x86_64 under Git Bash, or run-tests.ps1 (no `$(find)`) |
| 4 | 109 | Acceptance criteria | `node tools/node-bundle/run-unit-on-node.mjs --known-failures tools/node-bundle/known-failures.json tests/unit/ral/ tests/unit/dotenv-config.test.ts` | u | stated as "passes on Linux"; Windows outcome is the CI `windows` section |
| 5 | 110 | Acceptance criteria | `tools/node-bundle/quarto-node check 2>&1 \| grep -i "node"` | c | bash launcher with no .cmd |
| 6 | 111 | Acceptance criteria | `node tools/node-bundle/build.mjs --check-shim` | a | node script |
| 7 | 156 | Task 1 Step 2 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/platform.test.ts` | b | as row 3 |
| 8 | 157 | Task 1 Step 2 | `node tools/node-bundle/run-unit-on-node.mjs --known-failures tools/node-bundle/known-failures.json tests/unit/ral/platform.test.ts` | u | expected RED depends on shim runtime(); Windows unverified |
| 9 | 228 | Task 1 Step 4 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/platform.test.ts && cd ..` | b | as row 3 |
| 10 | 229 | Task 1 Step 4 | `node tools/node-bundle/run-unit-on-node.mjs --known-failures tools/node-bundle/known-failures.json tests/unit/ral/platform.test.ts` | u | as row 8 |
| 11 | 236-237 | Task 1 Step 5 | `git add src/deno_ral/platform.ts tests/unit/ral/platform.test.ts` / `git commit -m "..."` | a | git |
| 12 | 248 | Task 2 Step 1 | `grep -n "invalid characters\|empty string" tests/unit/ral/env.test.ts` | b | GNU grep in Git Bash |
| 13 | 266 | Task 2 Step 2 | `node tools/node-bundle/run-unit-on-node.mjs --known-failures tools/node-bundle/known-failures.json tests/unit/ral/env.test.ts` | u | Windows unverified |
| 14 | 322 | Task 2 Step 4 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/env.test.ts unit/environment.test.ts unit/dotenv-config.test.ts && cd ..` | b | as row 3 |
| 15 | 323 | Task 2 Step 4 | `node tools/node-bundle/run-unit-on-node.mjs --known-failures tools/node-bundle/known-failures.json tests/unit/ral/env.test.ts tests/unit/dotenv-config.test.ts` | u | Windows unverified |
| 16 | 330-331 | Task 2 Step 5 | `git add src/deno_ral/env.ts tests/unit/ral/env.test.ts` / `git commit -m "..."` | a | git |
| 17 | 409 | Task 3 Step 2 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/tar.test.ts` | b | as row 3 |
| 18 | 410 | Task 3 Step 2 | `ulimit -n` (check descriptor limit) | c | bash builtin; no Windows meaning (the 256 limit is macOS) |
| 19 | 495 | Task 3 Step 4 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/tar.test.ts && cd ..` | b | as row 3 |
| 20 | 496 | Task 3 Step 4 | `node tools/node-bundle/run-unit-on-node.mjs --known-failures tools/node-bundle/known-failures.json tests/unit/ral/tar.test.ts` | u | tar test makes 2000 files; Windows unverified |
| 21 | 497 | Task 3 Step 4 | `grep -rn "createTarFromFiles" src --include=*.ts` | b | GNU grep in Git Bash |
| 22 | 504-505 | Task 3 Step 5 | `git add src/deno_ral/tar.ts tests/unit/ral/tar.test.ts` / `git commit -m "..."` | a | git |
| 23 | 578 | Task 4 Step 2 | `node tools/node-bundle/run-unit-on-node.mjs --known-failures tools/node-bundle/known-failures.json tests/unit/ral/log-file-handler.test.ts` | u | Windows unverified |
| 24 | 668 | Task 4 Step 4 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/log-file-handler.test.ts $(find smoke/logging/ -name '*.test.ts') && cd ..` | b | as row 3 |
| 25 | 669 | Task 4 Step 4 | `node tools/node-bundle/run-unit-on-node.mjs --known-failures tools/node-bundle/known-failures.json tests/unit/ral/log-file-handler.test.ts` | u | Windows unverified |
| 26 | 670 | Task 4 Step 4 | `node tools/node-bundle/build.mjs && tools/node-bundle/quarto-node render dev-docs/runtime-migration/spike/tests/simple.qmd --log /tmp/rt27b.log --log-level info && grep -c "Output created" /tmp/rt27b.log` | c | bash launcher; `/tmp` path read by node vs grep may differ |
| 27 | 677-678 | Task 4 Step 5 | `git add src/deno_ral/log.ts tests/unit/ral/log-file-handler.test.ts` / `git commit -m "..."` | a | git |
| 28 | 687 | Task 4b Step 1 (prose) | test spawns `execPath()` with `NO_COLOR=1` running a one-line script that imports `src/deno_ral/colors.ts` | u | env passed by the test, cross-platform in principle; not exercised |
| 29 | 688 | Task 4b Step 2 | `node tools/node-bundle/run-unit-on-node.mjs tests/unit/ral/colors.test.ts` | u | no `--known-failures` flag given here (script defaults to repo json); Windows unverified |
| 30 | 690 | Task 4b Step 4 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/colors.test.ts` | b | as row 3 |
| 31 | 691 | Task 4b Step 5 | `git add src/deno_ral/colors.ts tests/unit/ral/colors.test.ts && git commit -m "..."` | a | git |
| 32 | 700 | Task 5 Step 1 | `npm ci && node tools/node-bundle/build.mjs --check-shim` | b | `npm` -> `npm.cmd` under Git Bash |
| 33 | 705 | Task 5 Step 2 | `node tools/node-bundle/run-unit-on-node.mjs --known-failures tools/node-bundle/known-failures.json tests/unit/ral/` | u | Windows section edited from CI run (line 706) |
| 34 | 711-712 | Task 5 Step 3 | `git add tools/node-bundle/deno-shim.mjs tools/node-bundle/known-failures.json` / `git commit -m "..."` | a | git |
| 35 | 717 | Verification | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent $(find unit/ral/ -name '*.test.ts') unit/environment.test.ts unit/dotenv-config.test.ts unit/binary-mode-strip-env.test.ts $(find smoke/logging/ -name '*.test.ts') $(find smoke/env/ -name '*.test.ts')` | b | `VAR=x cmd` + `$(find)`; run-tests.sh with DENO_DIR=x86_64 or run-tests.ps1 |
| 36 | 718 | Verification | `node tools/node-bundle/run-unit-on-node.mjs --known-failures tools/node-bundle/known-failures.json tests/unit/ral/ tests/unit/dotenv-config.test.ts` | u | "no change, exit 0"; Windows unverified |
| 37 | 719 | Verification | `grep -n "Deno" src/deno_ral/env.ts src/deno_ral/tar.ts src/deno_ral/log.ts src/deno_ral/platform.ts` | b | GNU grep in Git Bash |
| 38 | 720 | Verification | `quarto run --dev tools/check-runtime-boundary.ts` | b | quarto -> quarto.cmd (or package/dist/bin/quarto.cmd) |
| 39 | 721 | Verification | `node tools/node-bundle/build.mjs --check-shim` | a | node script |
| 40 | 722 | Verification (Manual) | `QUARTO_LOG_LEVEL=DEBUG tools/node-bundle/quarto-node check 2>&1 \| head -40` | c | `VAR=x cmd` bash + bash launcher |
| 41 | 722 | Verification (Manual) | `package/dist/bin/quarto check` | b | quarto -> quarto.cmd |
| 42 | 723 | Verification (Manual) | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/tar.test.ts` "on macOS (descriptor limit 256)" | c | macOS-specific manual step; same command on Windows does not reproduce the limit |
| 43 | 737 | Risks and rollback | `NO_COLOR= deno eval 'console.log(Deno.noColor)'` | c | `VAR= cmd` bash form; Windows cannot hold an empty-valued env var, setting it empty deletes it, so the "empty value" case cannot be tested the same way |

### Windows mentions

- L10: "Node: the PR 26 `node-unit` job runs `tests/unit/ral/` on real Node on Linux and Windows; the `platform`, `env`, `tar` and `log-file-handler` entries in `tools/node-bundle/known-failures.json` are removed by this PR and none is added."
- L52 (Interfaces): `export const isWindows: boolean;`
- L55 (Interfaces): "`/** Deno.build.os spelling: "windows" | "darwin" | "linux" | other process.platform values. */`"
- L126, L130, L131 (Task 1 test): `isWindows` import and `assertEquals(isWindows, os === "windows");`
- L169 (platform.ts header comment): "Deno 2 (node compat). Values keep Deno's spelling (os "windows", arch "x86_64"/"aarch64") because callers compare against those strings."
- L175-176 (platform.ts body): `process.platform === "win32" ? "windows" : process.platform`, `export const isWindows = os === "windows";`
- L211 (platform.ts body comment): "process.getuid is undefined on Windows (Deno.uid() returned null there)."
- L706 (Task 5 Step 2): "Delete them from the `linux` section (and from `windows` when this branch's Windows `node-unit` run reports them); rerun; `no change`, exit 0."


## 27-ral-fs-on-node-apis.md

Extracted commands: 42 (a=14, b=13, c=2, d=0, u=13)

| # | line | section | command quoted | class | note |
|---|------|---------|----------------|-------|------|
| 1 | 10 | header "Ships on" | `node tools/node-bundle/build.mjs --check-shim` (reports `0 missing`) | u | NB; assertion in header, repeated at row 10 |
| 2 | 128 | Acceptance criteria | `grep -n "Deno\." src/deno_ral/fs.ts src/deno_ral/temp.ts src/deno_ral/errors.ts` | a | Git Bash grep; not in PowerShell |
| 3 | 128 | Acceptance criteria | `test -e src/deno_ral/original-real-path.ts` (must fail) | a | Git Bash builtin |
| 4 | 128 | Acceptance criteria | `grep -c "export function realPathSync" src/deno_ral/fs.ts` | a | Git Bash |
| 5 | 129 | Acceptance criteria | `grep -n '"fs/' src/deno_ral/fs.ts` | a | Git Bash |
| 6 | 130 | Acceptance criteria | `grep -cE 'autoClose\|"(w\|a\|r\+\|w\+\|a\+\|wx)"' src/deno_ral/fs.ts` | a | Git Bash; single-quoted regex fine |
| 7 | 131 | Acceptance criteria | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent $(find unit/ral/ -name '*.test.ts') $(find unit/project/ ...) $(find unit/render/ ...) unit/path.test.ts unit/file-permissions.test.ts $(find smoke/render/ ...)` | b | RT |
| 8 | 132 | Acceptance criteria | `node tools/node-bundle/run-unit-on-node.mjs --known-failures tools/node-bundle/known-failures.json tests/unit/ral/` | u | NB; line says the `node-unit` CI job runs it on Windows, so likely works (script unread) |
| 9 | 133 | Acceptance criteria | `quarto run --dev tools/check-runtime-boundary.ts` | b | `quarto` -> `package/dist/bin/quarto.cmd` |
| 10 | 134 | Acceptance criteria | `node tools/node-bundle/build.mjs --check-shim` | u | NB |
| 11 | 147 | Task 1 Step 1 | `grep -rn "instanceof Deno.errors" src/ package/src tests/ --include=*.ts \| grep -v "src/deno_ral/" \| wc -l` | a | Git Bash pipeline (grep, wc) |
| 12 | 188 | Task 1 Step 3 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/errors.test.ts` | b | RT |
| 13 | 281 | Task 1 Step 4 (prose) | `grep -n "^export" src/deno_ral/errors.ts` | a | Git Bash |
| 14 | 285 | Task 1 Step 5 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/errors.test.ts` | b | RT |
| 15 | 291-292 | Task 1 Step 6 | `git add src/deno_ral/errors.ts tests/unit/ral/errors.test.ts` / `git commit -m "deno_ral/errors: code-first predicates for node: errors"` | a | git is cross-platform; one-line message |
| 16 | 549 | Task 2 Step 2 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/fs-node-semantics.test.ts` | b | RT |
| 17 | 555-556 | Task 2 Step 3 | `git add tests/unit/ral/fs-node-semantics.test.ts` / `git commit -m "tests: pin node-sensitive fs semantics for deno_ral/fs"` | a | git |
| 18 | 759 | Task 3 Step 3 (code comment) | `grep -n "notifyRead" src/deno_ral/fs.ts` ("check ... on main before rewriting") | a | Git Bash |
| 19 | 1118 | Task 3 Step 4 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent $(find unit/ral/ -name '*.test.ts') $(find unit/ral/ -name '*.test.ts')` | b | RT; the same `find` substitution is written twice on the line (exact duplicate) |
| 20 | 1124-1125 | Task 3 Step 5 | `git add src/deno_ral/fs.ts src/deno_ral/temp.ts tests/unit/ral/temp.test.ts` / `git commit -m "deno_ral: fs plain calls and temp files on node:fs"` | a | git |
| 21 | 1406 | Task 4 Step 2 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/fs-walk-glob.test.ts` | b | RT |
| 22 | 1876 | Task 4 Step 4 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent $(find unit/ral/ -name '*.test.ts') $(find unit/ral/ -name '*.test.ts')` | b | RT; same duplicated `find` as row 19 (different section) |
| 23 | 1881 | Task 4 Step 5 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent $(find unit/project/ ...) unit/path.test.ts unit/filter-paths.test.ts $(find unit/extension/ ...) $(find smoke/project/ ...) $(find smoke/extensions/ ...) $(find smoke/book/ ...)` | b | RT |
| 24 | 1887-1888 | Task 4 Step 6 | `git add src/deno_ral/fs.ts tests/unit/ral/fs-walk-glob.test.ts` / `git commit -m "deno_ral/fs: walk, expandGlob, copy and move on node:fs (no @std/fs)"` | a | git |
| 25 | 1899 | Task 5 Step 1 | `npm ci && node tools/node-bundle/build.mjs --check-shim` | u | NB; `npm` from Git Bash needs `npm.cmd` (user rule), PowerShell fine |
| 26 | 1904 | Task 5 Step 2 | `node tools/node-bundle/run-unit-on-node.mjs --known-failures tools/node-bundle/known-failures.json tests/unit/ral/` | u | NB |
| 27 | 1911 | Task 5 Step 3 | `tools/node-bundle/quarto-node render dev-docs/runtime-migration/spike/tests/simple.qmd` | u | NB; extensionless wrapper, Windows form unknown |
| 28 | 1912 | Task 5 Step 3 | `tools/node-bundle/quarto-node render dev-docs/runtime-migration/spike/tests/website` | u | NB |
| 29 | 1919-1920 | Task 5 Step 4 | `git add tools/node-bundle/deno-shim.mjs tools/node-bundle/known-failures.json` / `git commit -m "node-bundle: drop shim members and known failures made obsolete by deno_ral/fs on node:fs"` | a | git |
| 30 | 1925 | Verification | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent $(find unit/ral/ -name '*.test.ts')` | b | RT |
| 31 | 1926 | Verification | `node tools/node-bundle/run-unit-on-node.mjs --known-failures tools/node-bundle/known-failures.json tests/unit/ral/` | u | NB |
| 32 | 1927 | Verification | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent $(find unit/ -name '*.test.ts') $(find smoke/render/ ...) $(find smoke/project/ ...)` | b | RT; whole `unit/` tree |
| 33 | 1928 | Verification | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/file-permissions.test.ts unit/render-shared-output-dir.test.ts unit/sass-cache.test.ts` | b | RT |
| 34 | 1929 | Verification | `quarto run --dev tools/check-runtime-boundary.ts` | b | quarto.cmd |
| 35 | 1930 | Verification | `grep -c "Deno\." src/deno_ral/fs.ts src/deno_ral/temp.ts`; `grep -c '"fs/' src/deno_ral/fs.ts`; `ls src/deno_ral/original-real-path.ts` | a | three Git Bash commands in one bullet |
| 36 | 1931 | Verification | `node tools/node-bundle/build.mjs --check-shim` | u | NB |
| 37 | 1932 | Verification (Manual) | `cp -r tests/docs/smoke-all/book/simple /tmp/rt27-book && package/dist/bin/quarto render /tmp/rt27-book` | c | no extensionless `quarto` (use quarto.cmd) AND `/tmp/...` is Git Bash %TEMP% but a Windows binary reads it as `C:\tmp\...` |
| 38 | 1932 | Verification (Manual) | `tools/node-bundle/quarto-node render /tmp/rt27-book` | u | NB; same `/tmp` hazard |
| 39 | 1932 | Verification (Manual) | `normalize-html.mjs --root` and `diff -r -x .quarto` (normalised diff of the two `_book` trees) | u | normalize-html.mjs is PR 26's, unread; `diff -r` is Git Bash |
| 40 | 1932 | Verification (Manual) | `package/dist/bin/quarto create project website /tmp/rt27-site --no-prompt` | c | quarto.cmd needed and `/tmp` hazard as row 37 |
| 41 | 1933 | Verification (Windows) | `cd tests; $env:QUARTO_TESTS_NO_CONFIG="true"; .\run-tests.ps1 --agent unit/ral/` | u | already PowerShell syntax; `--agent` support in run-tests.ps1 unverified |
| 42 | 1959 | Risks and rollback | "measure with `QUARTO_PROFILE`" (env var, no full command given) | u | conditional, not a concrete command |

### Windows mentions

- L10 (header "Ships on"): "the PR 26 `node-unit` job runs `tests/unit/ral/` (including this PR's new files) on real Node 26 on Linux and Windows".
- L22 (Spec, Context): "`copySymlink` picked the Windows link type from `lstat`, which describes the link, so every directory link became a file link (R19, a bug `@std/fs` 1.0.16 `copy.ts` has today): the type now comes from `stat` of the source with a dangling-link fallback (Task 4)."
- L24 (Spec, Context): "`canonicalPathSync(path)` ... returns a path without the Windows `\\?\` prefix: libuv's `uv_fs_realpath` ... strips `\\?\` and turns `\\?\UNC\` into `\\`".
- L32 (Spec, Context, `copy` bullet): "symlinks are recreated as symlinks (on Windows with the type of the link's **target**, `statSync(src)`: a directory -> `"dir"`, anything else or a dangling link -> `"file"`; a junction, ... is recreated as a directory symlink of that target ...)".
- L37 (Spec, Context): "`EOL` is `"\r\n"` on Windows, `"\n"` elsewhere".
- L69 (Interfaces): "Symlinks resolved, Windows `\\?\` prefix removed (libuv) ...".
- L132 (Acceptance criteria): "(the `node-unit` job checks the same on Windows)".
- L1905 (Task 5 Step 2): "Delete those entries from the `linux` section (and the `windows` section if the Windows `node-unit` run of this branch reports them)".
- L1933 (Verification): "Windows: run `cd tests; $env:QUARTO_TESTS_NO_CONFIG="true"; .\run-tests.ps1 --agent unit/ral/` on a Windows machine or let the CI matrix run; the PR 26 `node-unit` job runs the same files on Node on Windows (`canonicalPathSync` drive-letter and no-prefix case; the R19 case needs a runner with symlink privilege, which GitHub's `windows-latest` has ...; the fixture's junction ... must come out as a `"dir"` link ...)".
- L1947 (Review checklist): "on Windows the link type comes from `statSync(src)` ... never from `lstat`."
- L1958 (Risks): "**`canonicalPathSync` on Windows** (`fs.realpathSync.native`): libuv strips `\\?\` and rewrites `\\?\UNC\` to `\\` ... shows as a path-comparison failure in `tests/unit/ral/safe-remove-dir.test.ts` on the Windows `node-unit` job".
- Code-level Windows branches in embedded test/impl code (no prose sentence): L315, 507 ("symlink creation needs privileges on Windows CI"), 523, 533, 538, 706, 779, 932, 1107, 1149, 1175 ("[not on Windows]"), 1197, 1226, 1229, 1277, 1314, 1340-1358 (junction case, "this runner has no symlink privilege; the node-unit job on Windows has"), 1389, 1549, 1704, 1715, 1792.

### Windows mentions added by grep sweep at assembly
Lines matching `windows|win32|.cmd|.ps1|taskkill` (case-insensitive) that the extractor's list above did not cite. Quoted verbatim, trimmed to 300 characters; section is the nearest preceding heading.

- L315 (Task 2: Node-semantics test for the plain fs calls): "import { isWindows } from "../../../src/deno_ral/platform.ts";"
- L507 (Task 2: Node-semantics test for the plain fs calls): "if (isWindows) return; // symlink creation needs privileges on Windows CI"
- L523 (Task 2: Node-semantics test for the plain fs calls): "unitTest("fs - canonicalPathSync throws NotFound for a missing path and has no Windows \\\\?\\ prefix", async () => {"
- L533 (Task 2: Node-semantics test for the plain fs calls): "if (isWindows) assert(/^[A-Za-z]:\\/.test(resolved), `expected a drive-letter path, got ${resolved}`);"
- L538 (Task 2: Node-semantics test for the plain fs calls): "if (isWindows) return;"
- L706 (Task 3: Rewrite the plain calls and `temp.ts`): "import { isWindows } from "./platform.ts";"
- L779 (Task 3: Rewrite the plain calls and `temp.ts`): "mode: isWindows ? null : st.mode,"
- L932 (Task 3: Rewrite the plain calls and `temp.ts`): "// Symlinks resolved, Windows "\\?\" prefix removed by libuv, throws when the"
- L1107 (Task 3: Rewrite the plain calls and `temp.ts`): "export const EOL: "\n" | "\r\n" = isWindows ? CRLF : LF;"
- L1149 (Task 4: `walk`, `expandGlob`, `copy`, `moveSync` without `@std/fs`): "import { isWindows } from "../../../src/deno_ral/platform.ts";"
- L1175 (Task 4: `walk`, `expandGlob`, `copy`, `moveSync` without `@std/fs`): "//   renv/library/loop -> ../../renv   (symlink loop)   [not on Windows]"
- L1197 (Task 4: `walk`, `expandGlob`, `copy`, `moveSync` without `@std/fs`): "if (!isWindows) {"
- L1226 (Task 4: `walk`, `expandGlob`, `copy`, `moveSync` without `@std/fs`): "isWindows ? ["node_modules", "posts"] : ["node_modules", "posts", "renv", "renv/library"],"
- L1229 (Task 4: `walk`, `expandGlob`, `copy`, `moveSync` without `@std/fs`): "if (!isWindows) {"
- L1277 (Task 4: `walk`, `expandGlob`, `copy`, `moveSync` without `@std/fs`): "assertEquals(dirsOnly, isWindows ? [".hidden", "_private", "node_modules", "posts"] : [".hidden", "_private", "node_modules", "posts", "renv"]);"
- L1314 (Task 4: `walk`, `expandGlob`, `copy`, `moveSync` without `@std/fs`): "if (!isWindows) {"
- L1340 (Task 4: `walk`, `expandGlob`, `copy`, `moveSync` without `@std/fs`): "// A junction, Windows only and through node:fs (the layer exposes no"
- L1344 (Task 4: `walk`, `expandGlob`, `copy`, `moveSync` without `@std/fs`): "if (isWindows) nodeSymlinkSync(join(dir, "src", "target"), join(dir, "src", "junction"), "junction");"
- L1346 (Task 4: `walk`, `expandGlob`, `copy`, `moveSync` without `@std/fs`): "if (isWindows && (e as { code?: string }).code === "EPERM") {"
- L1348 (Task 4: `walk`, `expandGlob`, `copy`, `moveSync` without `@std/fs`): "return; // this runner has no symlink privilege; the node-unit job on Windows has"
- L1355 (Task 4: `walk`, `expandGlob`, `copy`, `moveSync` without `@std/fs`): "for (const name of isWindows ? ["rel-dir", "abs-dir", "junction"] : ["rel-dir", "abs-dir"]) {"
- L1358 (Task 4: `walk`, `expandGlob`, `copy`, `moveSync` without `@std/fs`): "assert(statSync(copied).isDirectory, `${out}/${name} resolves to a directory (on Windows: a "dir" link, not a "file" link)`);"
- L1389 (Task 4: `walk`, `expandGlob`, `copy`, `moveSync` without `@std/fs`): "if (!isWindows) {"
- L1549 (Task 4: `walk`, `expandGlob`, `copy`, `moveSync` without `@std/fs`): "if (isWindows && abs) split.winRoot = segments.shift();"
- L1704 (Task 4: `walk`, `expandGlob`, `copy`, `moveSync` without `@std/fs`): "// Windows is the only platform where symlinkSync's type matters (R19). lstat"
- L1715 (Task 4: `walk`, `expandGlob`, `copy`, `moveSync` without `@std/fs`): "if (!isWindows) return undefined;"
- L1792 (Task 4: `walk`, `expandGlob`, `copy`, `moveSync` without `@std/fs`): "if (!isWindows) return undefined;"

## 28-ral-process-on-node-apis.md

Extracted commands: 49 (a=13, b=15, c=5, d=3, u=13)

| # | line | section | command quoted | class | note |
|---|------|---------|----------------|-------|------|
| 1 | 96 | Acceptance criteria | `grep -c "Deno\." src/deno_ral/process.ts src/core/process.ts src/deno_ral/batch-command-line.ts` | a | Git Bash |
| 2 | 97 | Acceptance criteria | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent $(find unit/ral/ -name '*.test.ts') unit/exec-process-stdin.test.ts unit/windows-exec.test.ts unit/process-group.test.ts` | b | RT; line says "passes on Deno (Linux, macOS, Windows CI)" |
| 3 | 98 | Acceptance criteria | `node tools/node-bundle/run-unit-on-node.mjs --known-failures ... tests/unit/ral/` | u | NB; "passes on Linux and Windows (the `node-unit` job)" |
| 4 | 101 | Acceptance criteria | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/render/render-html.test.ts smoke/render/render-r.test.ts smoke/render/render-stdout.test.ts $(find smoke/jupyter/ ...) smoke/inspect/inspect-pipe.test.ts smoke/preview/preview-reload.test.ts` | b | RT |
| 5 | 102 | Acceptance criteria | `quarto run --dev tools/check-runtime-boundary.ts` | b | quarto.cmd |
| 6 | 102 | Acceptance criteria | `node tools/node-bundle/build.mjs --check-shim` | u | NB |
| 7 | 143 | Task 1 Step 1 (test code) | `runtime().name === "deno" ? ["eval", code] : ["-e", code]` (`deno eval` / `node -e` one-liners spawned by tests via `exec(execPath(), ...)`) | a | cross-platform; absolute execPath |
| 8 | 243 | Task 1 Step 2 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/process-node-semantics.test.ts; cd ..` | b | RT |
| 9 | 244 | Task 1 Step 2 | `node tools/node-bundle/run-unit-on-node.mjs --known-failures ... tests/unit/ral/process-node-semantics.test.ts` | u | NB |
| 10 | 251-252 | Task 1 Step 3 | `git add tests/unit/ral/process-node-semantics.test.ts` / `git commit -m "tests: pin node:child_process semantics for deno_ral/process"` | a | git |
| 11 | 326 | Task 2 Step 1 (test code, Windows-only test) | `"${execPath()}" run --allow-all --no-config "${argvScript}"` (runner line inside forward.cmd on Deno) | a | test only runs when `isWindows`; quoted absolute path |
| 12 | 328-329 | Task 2 Step 1 (test code, Windows-only test) | writes `forward.cmd` containing `@echo off\r\n${runner} %*\r\n`, then `exec(cmd, { args: kVectors, cwd: dir })` | a | Windows-only batch end-to-end vectors; the thing under test |
| 13 | 343 | Task 2 Step 2 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/batch-command-line.test.ts` | b | RT |
| 14 | 411 | Task 2 Step 4 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/batch-command-line.test.ts` | b | RT; line 412: Windows end-to-end case passes "on Windows CI only after Task 3" |
| 15 | 417-418 | Task 2 Step 5 | `git add src/deno_ral/batch-command-line.ts tests/unit/ral/batch-command-line.test.ts` / `git commit -m "deno_ral: BatBadBut-safe cmd.exe command lines for .bat/.cmd (Rust std algorithm)"` | a | git |
| 16 | 763 | Task 3 Step 1 (prose) | `grep -n "^export" src/deno_ral/process.ts` | a | Git Bash |
| 17 | 769 | Task 3 Step 2 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/process.test.ts unit/ral/process-node-semantics.test.ts unit/ral/batch-command-line.test.ts unit/process-group.test.ts; cd ..` | b | RT |
| 18 | 770 | Task 3 Step 2 | `node tools/node-bundle/run-unit-on-node.mjs --known-failures ... tests/unit/ral/process.test.ts tests/unit/ral/process-node-semantics.test.ts tests/unit/ral/batch-command-line.test.ts` | u | NB |
| 19 | 777-778 | Task 3 Step 3 | `git add src/deno_ral/process.ts` / `git commit -m "deno_ral/process: node:child_process body; batch escaping, blocking stdio, group kill"` | a | git |
| 20 | 843 | Task 4 Step 2 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/process-stdin.test.ts` | b | RT |
| 21 | 844 | Task 4 Step 2 | `node tools/node-bundle/run-unit-on-node.mjs --known-failures ... tests/unit/ral/process-stdin.test.ts` ("interrupt it after 30 s") | u | NB; expected to hang; interrupt = Ctrl-C |
| 22 | 922 | Task 4 Step 4 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/process-stdin.test.ts unit/exec-process-stdin.test.ts unit/ral/process.test.ts` | b | RT |
| 23 | 927 | Task 4 Step 5 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/render/render-html.test.ts smoke/render/render-typst-package-staging.test.ts smoke/render/render-r.test.ts smoke/render/render-stdout.test.ts $(find smoke/jupyter/ ...) smoke/jupyter/daemon.test.ts unit/windows-exec.test.ts $(find unit/latexmk/ ...)` | b | RT; line 928 says latexmk tests exercise `safeWindowsExec` on Windows CI |
| 24 | 933-934 | Task 4 Step 6 | `git add src/core/process.ts tests/unit/ral/process-stdin.test.ts` / `git commit -m "execProcess: read child output while writing stdin; drop 4 KB chunking"` | a | git |
| 25 | 995 | Task 5 Step 2 (test code) | `exec("bash", { args: ["-c", script] })` | c | helper used only by cases that `if (isWindows) return`; needs bash on PATH |
| 26 | 1003 | Task 5 Step 2 (test code) | `${quote([cmd, ...args])} \| wc -c; echo "status=\${PIPESTATUS[0]}"` | c | bash-only syntax; test returns early on Windows (line 1001 comment) |
| 27 | 1012 | Task 5 Step 2 (test code) | `${quote([cmd, ...args])} \| head -c 1 > /dev/null; echo "status=\${PIPESTATUS[0]}"` | c | bash-only; returns early on Windows (L1010) |
| 28 | 1018 | Task 5 Step 2 (test code) | `${quote([c2, ...a2])} \| head -c 1 > /dev/null; echo "status=\${PIPESTATUS[0]}"` (Node only) | c | bash-only; same skip |
| 29 | 1029 | Task 5 Step 3 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/process-exit-pipe.test.ts; cd ..` | b | RT; the cases return early on Windows, so a green run proves nothing there |
| 30 | 1030 | Task 5 Step 3 | `node tools/node-bundle/run-unit-on-node.mjs --known-failures ... tests/unit/ral/process-exit-pipe.test.ts` | u | NB; same early return on Windows |
| 31 | 1032 | Task 5 Step 3 | "comment out `makeStdioBlocking()` in `src/deno_ral/process.ts` and rerun on Node" (edit + rerun of row 30) | c | the case is skipped on Windows, so the demonstration cannot show on Windows |
| 32 | 1036 | Task 5 Step 4 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/inspect/inspect-pipe.test.ts smoke/render/render-stdout.test.ts unit/process-group.test.ts` | u | RT form fine; inspect-pipe.test.ts (PR 14b) is unread and likely pipes through head/wc |
| 33 | 1042-1043 | Task 5 Step 5 | `git add tests/unit/ral/fixtures/exit-pipe-child.ts tests/unit/ral/process-exit-pipe.test.ts` / `git commit -m "tests: exit() drains piped stdout; broken pipe ends quietly"` | a | git |
| 34 | 1053 | Task 6 Step 1 | `grep -rn "requireQuoting" src/ --include=*.ts \| grep -v "windows.ts"` | a | Git Bash |
| 35 | 1060 | Task 6 Step 2 | `npm ci && node tools/node-bundle/build.mjs --check-shim` | u | NB; npm.cmd under Git Bash |
| 36 | 1061 | Task 6 Step 2 | `tools/node-bundle/quarto-node render dev-docs/runtime-migration/spike/tests/simple.qmd` | u | NB |
| 37 | 1062 | Task 6 Step 2 | `tools/node-bundle/quarto-node render dev-docs/runtime-migration/spike/tests/jupyter.qmd` | u | NB |
| 38 | 1068 | Task 6 Step 3 | `node tools/node-bundle/run-unit-on-node.mjs --known-failures tools/node-bundle/known-failures.json tests/unit/ral/` | u | NB |
| 39 | 1074-1075 | Task 6 Step 4 | `git add tools/node-bundle/deno-shim.mjs tools/node-bundle/known-failures.json` / `git commit -m "node-bundle: drop shim members and known failures made obsolete by deno_ral/process"` | a | git |
| 40 | 1080 | Verification | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent $(find unit/ral/ -name '*.test.ts')` | b | RT |
| 41 | 1081 | Verification | `node tools/node-bundle/run-unit-on-node.mjs --known-failures ... tests/unit/ral/` | u | NB |
| 42 | 1082 | Verification | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/exec-process-stdin.test.ts unit/windows-exec.test.ts unit/chrome-launch.test.ts unit/chrome-launch-flags.test.ts unit/process-group.test.ts` | b | RT |
| 43 | 1083 | Verification | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/render/render-html.test.ts smoke/render/render-r.test.ts smoke/render/render-stdout.test.ts $(find smoke/jupyter/ ...) smoke/inspect/inspect-pipe.test.ts smoke/preview/preview-reload.test.ts` | b | RT; same list as row 4 (different section) |
| 44 | 1084 | Verification | `grep -c "Deno\." src/deno_ral/process.ts src/core/process.ts src/deno_ral/batch-command-line.ts` | a | Git Bash |
| 45 | 1085 | Verification | `quarto run --dev tools/check-runtime-boundary.ts` | b | quarto.cmd |
| 46 | 1086 | Verification | `node tools/node-bundle/build.mjs --check-shim` | u | NB |
| 47 | 1087 | Verification (Manual) | `package/dist/bin/quarto render tests/docs/smoke-all/2023/02/08/4272.qmd` | d | README lists Windows for PR 28 (README not read by me; exact Windows procedure may differ). If run as written: quarto.cmd |
| 48 | 1087 | Verification (Manual) | `package/dist/bin/quarto check` | d | as row 47; quarto.cmd |
| 49 | 1087 | Verification (Manual) | `tools/node-bundle/quarto-node inspect tests/docs/smoke-all/book/simple \| head -c 1; echo " status=${PIPESTATUS[0]}"` | d | as row 47; bash-only `PIPESTATUS`, `head`; quarto-node wrapper unread, so the Windows form is unknown |

### Windows mentions

- L5 (Goal): "`.bat`/`.cmd` arguments escaped against `cmd.exe` injection (BatBadBut, CVE-2024-24576/CVE-2024-27980)".
- L8: "Spawn-failure semantics, Windows batch escaping, stdio draining and the stdin/stdout concurrency need judgement."
- L10: "the PR 26 `node-unit` job runs this PR's `tests/unit/ral/process*.test.ts` and `batch-command-line.test.ts` on real Node on Linux and Windows".
- L22 (Context): "**Batch-file quoting (S8).** The draft routed `.cmd`/`.bat` through `cmd.exe /d /s /c "<line>"` ... escaping `"` as `\"`, which `cmd.exe` does not understand ... the BatBadBut class".
- L24 (Context): "Windows has no `kill(-pid)`, so the layer kills the tree with `taskkill /T /F` (PR 08's Deno body already does; this PR keeps the contract on `spawnSync`)."
- L25: "`windowsVerbatimArguments` and `process.kill(-pid)` on Deno's `node:child_process` are Spike #2 (d)".
- L36 (Decision): batch escaping via `cmd.exe /e:ON /v:OFF /d /c "<line>"` with `windowsVerbatimArguments: true` instead of `safeWindowsExec` (`src/core/windows.ts`).
- L38 (Decision): "files and Windows pipes are synchronous in Node already".
- L46: "`batch-command-line.test.ts` (string vectors on every OS, end-to-end on Windows)".
- L51: "`src/core/windows.ts` `safeWindowsExec`/`requireQuoting` (unchanged; its unescaped `.bat` line is pre-existing ...)".
- L71: "Windows, `CREATE_NEW_PROCESS_GROUP` (Node `detached: true`, with `windowsHide: true` so no console window appears)."
- L72: "on Windows an override replaces an inherited variable whose name differs only in case (`Path` vs `PATH`)."
- L77: "`killProcess(pid, signal)`: ... Windows with a negative pid: `taskkill /PID <-pid> /T /F` ... throwing an Error with `code: "ESRCH"` when `taskkill` reports no such process (exit 128) ... PR 14b's `process-group.test.ts` pins it on Windows CI."
- L81: "On Windows `SIGTERM` listeners never fire (Node and Deno alike); `SIGINT` fires on Ctrl-C."
- L97: "passes on Deno (Linux, macOS, Windows CI)". L98: "passes on Linux and Windows (the `node-unit` job)".
- L100: "The CVE vectors in `batch-command-line.test.ts` round-trip unchanged through a forwarding `.cmd` on Windows, and no injected command runs."
- L246 (Task 1 Step 2): "the Windows env-case test fails on the Windows `node-unit` job (the shim spreads `process.env` first)."
- L263, 269-270 (Task 2): Rust std `windows/args.rs` algorithm; "String-level on every OS; end to end on Windows."
- L412 (Task 2 Step 4): "the Windows end-to-end case passes on Windows CI only after Task 3".
- L772 (Task 3 Step 2): PR 14b's `process-group.test.ts` Windows case "runs `taskkill /T` on a detached PowerShell child and its `ping` grandchild, checked through `tasklist`; a second call throws `ESRCH` ... so the Windows evidence for this PR's `killProcess` is the Windows case on the Windows `node-unit`/Deno jobs, not a green run of ignored tests."
- L928: "`latexmk` tests exercise `safeWindowsExec` paths on Windows CI".
- L1051 (Task 6 Step 1 heading): "Check the Windows quoting callers still go through `safeWindowsExec`"; L1054: `safeWindowsExec` "writes a `.bat` and runs `cmd /c <file>`; `cmd` is not a batch file, so the layer spawns it directly".
- L1069 (Task 6 Step 3): "Delete them (Linux; Windows from this branch's `node-unit` run)".
- L1088 (Verification): "Windows CI (the normal Deno matrix and the PR 26 `node-unit` Windows job) runs the batch end-to-end vectors and the env-case test; they are skipped elsewhere."
- L1094-1096 (Review checklist): `.bat`/`.cmd` route through `cmd.exe /e:ON /v:OFF /d /c ...`; `killProcess(-pid)` uses `taskkill /T /F` on Windows; env override case-insensitive on Windows.
- L1107 (Risks): "**Windows batch escaping.** ... Quarto's batch spawns (`quarto.cmd`, `npm.cmd`, `tlmgr.bat` via `safeWindowsExec`) pass paths and flags."
- L1108 (Risks): "If Deno 2.9 ignores `windowsVerbatimArguments`, `kDenoHonoursVerbatim = false` ...".
- L1109 (Risks): "**Pre-existing: `safeWindowsExec`** writes its command line into a `.bat` without escaping".
- L1115: "Batch escaping (Rust's algorithm in the layer, not `safeWindowsExec`)".
- Code-level Windows branches in embedded test/impl code: L125, 182-183, 192, 202-203, 212 ("Windows reports TerminateProcess as exit code 1, no signal name"), 222, 277, 283-296 (`C:\\t\\x.cmd` string vectors), 311, 320-321, 328, 465, 492, 495-497, 508, 539-540, 557, 563-573, 724-730 (`taskkill` spawnSync), 987, 1001 ("Node writes Windows pipes synchronously; the POSIX pipe is the case at risk"), 1010.

### Windows mentions added by grep sweep at assembly
Lines matching `windows|win32|.cmd|.ps1|taskkill` (case-insensitive) that the extractor's list above did not cite. Quoted verbatim, trimmed to 300 characters; section is the nearest preceding heading.

- L60 (Interfaces): "/** The command line cmd.exe must receive to run `script` (a .bat/.cmd path) with `args` so that the"
- L63 (Interfaces): "*  with windowsVerbatimArguments. Throws an Error with code "EINVAL" for a script path containing `"` or"
- L125 (Task 1: Semantics tests for the layer): "import { isWindows, runtime } from "../../../src/deno_ral/platform.ts";"
- L182 (Task 1: Semantics tests for the layer): "// HOME (POSIX) / USERPROFILE (Windows) is always inherited and never passed explicitly below."
- L183 (Task 1: Semantics tests for the layer): "const homeVar = isWindows ? "USERPROFILE" : "HOME";"
- L192 (Task 1: Semantics tests for the layer): "env: { RT28: "only", PATH: env.get("PATH") ?? "", ...(isWindows ? { SystemRoot: env.get("SystemRoot") ?? "" } : {}) },"
- L202 (Task 1: Semantics tests for the layer): "unitTest("process - on Windows an env override replaces the inherited variable regardless of case", async () => {"
- L203 (Task 1: Semantics tests for the layer): "if (!isWindows) return;"
- L212 (Task 1: Semantics tests for the layer): "if (isWindows) return; // Windows reports TerminateProcess as exit code 1, no signal name"
- L222 (Task 1: Semantics tests for the layer): "if (isWindows) return;"
- L277 (Task 2: Batch-file escaping (`batch-command-line.ts`)): "import { isWindows, runtime } from "../../../src/deno_ral/platform.ts";"
- L283 (Task 2: Batch-file escaping (`batch-command-line.ts`)): "const kScript = "C:\\t\\x.cmd";"
- L287 (Task 2: Batch-file escaping (`batch-command-line.ts`)): "assertEquals(line("plain"), `"C:\\t\\x.cmd" plain`);"
- L288 (Task 2: Batch-file escaping (`batch-command-line.ts`)): "assertEquals(line("two words"), `"C:\\t\\x.cmd" "two words"`);"
- L289 (Task 2: Batch-file escaping (`batch-command-line.ts`)): "assertEquals(line("a&b"), `"C:\\t\\x.cmd" "a&b"`);"
- L290 (Task 2: Batch-file escaping (`batch-command-line.ts`)): "assertEquals(line("a^b|c<d>e"), `"C:\\t\\x.cmd" "a^b|c<d>e"`);"
- L291 (Task 2: Batch-file escaping (`batch-command-line.ts`)): "assertEquals(line("%PATH%"), `"C:\\t\\x.cmd" "%%cd:~,%PATH%%cd:~,%"`);"
- L292 (Task 2: Batch-file escaping (`batch-command-line.ts`)): "assertEquals(line('he said "hi"'), `"C:\\t\\x.cmd" "he said ""hi"""`);"
- L293 (Task 2: Batch-file escaping (`batch-command-line.ts`)): "assertEquals(line('"&echo INJECTED'), `"C:\\t\\x.cmd" """&echo INJECTED"`);"
- L294 (Task 2: Batch-file escaping (`batch-command-line.ts`)): "assertEquals(line("trailing\\"), `"C:\\t\\x.cmd" "trailing\\\\"`);"
- L295 (Task 2: Batch-file escaping (`batch-command-line.ts`)): "assertEquals(line(""), `"C:\\t\\x.cmd" ""`);"
- L296 (Task 2: Batch-file escaping (`batch-command-line.ts`)): "assertEquals(line("C:\\dir\\file.qmd", "--to", "html"), `"C:\\t\\x.cmd" C:\\dir\\file.qmd --to html`);"
- L311 (Task 2: Batch-file escaping (`batch-command-line.ts`)): "assertEquals(code(() => batchCommandLine('C:\\bad"name.cmd', [])), "EINVAL");"
- L315 (Task 2: Batch-file escaping (`batch-command-line.ts`)): "// A forwarding .cmd hands its arguments (%*) to a script that prints them as JSON."
- L320 (Task 2: Batch-file escaping (`batch-command-line.ts`)): "unitTest("process - batch files receive their arguments verbatim and nothing is injected (Windows)", async () => {"
- L321 (Task 2: Batch-file escaping (`batch-command-line.ts`)): "if (!isWindows) return;"
- L328 (Task 2: Batch-file escaping (`batch-command-line.ts`)): "const cmd = join(dir, "forward.cmd");"
- L354 (Task 2: Batch-file escaping (`batch-command-line.ts`)): "* cmd.exe command line for running a .bat/.cmd file with arguments that the"
- L357 (Task 2: Batch-file escaping (`batch-command-line.ts`)): "* Command does on Windows; Node refuses to spawn batch files without a shell"
- L418 (Task 2: Batch-file escaping (`batch-command-line.ts`)): "git commit -m "deno_ral: BatBadBut-safe cmd.exe command lines for .bat/.cmd (Rust std algorithm)""
- L465 (Task 3: Rewrite `src/deno_ral/process.ts`): "/** POSIX: new process group (setsid); Windows: CREATE_NEW_PROCESS_GROUP. */"
- L492 (Task 3: Rewrite `src/deno_ral/process.ts`): "const kIsWindows = nodeProcess.platform === "win32";"
- L495 (Task 3: Rewrite `src/deno_ral/process.ts`): "// windowsVerbatimArguments. true = it does (the batch path below is used on"
- L497 (Task 3: Rewrite `src/deno_ral/process.ts`): "// on Deno the .bat/.cmd file is then spawned directly and Deno's Rust Command"
- L508 (Task 3: Rewrite `src/deno_ral/process.ts`): "// and Windows pipes are synchronous in Node."
- L539 (Task 3: Rewrite `src/deno_ral/process.ts`): "if (kIsWindows && options.env) {"
- L540 (Task 3: Rewrite `src/deno_ral/process.ts`): "// Windows variable names are case-insensitive: an override "PATH" must"
- L557 (Task 3: Rewrite `src/deno_ral/process.ts`): "windowsHide: true,"
- L563 (Task 3: Rewrite `src/deno_ral/process.ts`): "// Node refuses .bat/.cmd without a shell (CVE-2024-27980); run them through"
- L567 (Task 3: Rewrite `src/deno_ral/process.ts`): "if (!kIsWindows || !/\.(cmd|bat)$/i.test(cmd) || !kBatchThroughCmd) {"
- L573 (Task 3: Rewrite `src/deno_ral/process.ts`): "{ windowsVerbatimArguments: true },"
- L724 (Task 3: Rewrite `src/deno_ral/process.ts`): "* POSIX, and the process tree rooted at -pid on Windows (taskkill /T /F). */"
- L726 (Task 3: Rewrite `src/deno_ral/process.ts`): "if (kIsWindows && pid < 0) {"
- L727 (Task 3: Rewrite `src/deno_ral/process.ts`): "const r = nodeSpawnSync("taskkill", ["/PID", String(-pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" });"
- L730 (Task 3: Rewrite `src/deno_ral/process.ts`): "throw Object.assign(new Error(`taskkill: no process ${-pid}`), { code: "ESRCH" });"
- L848 (Task 4: `execProcess` reads output while writing stdin; no chunking): "In `src/core/process.ts`, inside `execProcess`, replace the block that starts at `if (stdin !== undefined) {` (the writer, the `kWindowSize` loop, `releaseLock` and the `stdin.close()` try/catch) and the following output-processing code up to `const status = await withTimeout(process.status)` with:"
- L918 (Task 4: `execProcess` reads output while writing stdin; no chunking): "Everything else in `execProcess` (the `spawn(options.cmd, { ...options, stdin: stdin !== undefined ? "piped" : options.stdin, stdout: "piped", stderr: "piped" })` call from PR 08, `registerForExitCleanup`, the result object, the error wrapping) stays. Delete the `kWindowSize` constant and the `// wr ..."
- L927 (Task 4: `execProcess` reads output while writing stdin; no chunking): "Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/render/render-html.test.ts smoke/render/render-typst-package-staging.test.ts smoke/render/render-r.test.ts smoke/render/render-stdout.test.ts $(find smoke/jupyter/ -name '*.test.ts') smoke/jupyter/daemon.test.ts unit/windows- ..."
- L987 (Task 5: `exit()` loses nothing on a pipe; a closed reader ends quietly): "import { isWindows, runtime } from "../../../src/deno_ral/platform.ts";"
- L1001 (Task 5: `exit()` loses nothing on a pipe; a closed reader ends quietly): "if (isWindows) return; // Node writes Windows pipes synchronously; the POSIX pipe is the case at risk"
- L1010 (Task 5: `exit()` loses nothing on a pipe; a closed reader ends quietly): "if (isWindows) return;"
- L1053 (Task 6: Node run, shim and known-failures shrink): "Run: `grep -rn "requireQuoting" src/ --include=*.ts | grep -v "windows.ts"`"
- L1054 (Task 6: Node run, shim and known-failures shrink): "Expected: only `src/command/render/latexmk/texlive.ts`, `src/core/shell.ts`, `src/core/zip.ts`, each passing the quoted array to `safeWindowsExec` (which writes a `.bat` and runs `cmd /c <file>`; `cmd` is not a batch file, so the layer spawns it directly). If any caller passes `requireQuoting(...).a ..."
- L1064 (Task 6: Node run, shim and known-failures shrink): "Expected: `0 missing` and an `unused` list (candidates: `Command`, `exit`, `execPath`, `pid`, `args`, `cwd`, `chdir`, `addSignalListener`, `removeSignalListener`, `kill`, `stdout`, `stderr`, `stdin`, `isatty`); members still referenced by `src/resources/**/*.js` (`julia-engine.js` uses `Deno.Command ..."
- L1082 (Verification): "- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/exec-process-stdin.test.ts unit/windows-exec.test.ts unit/chrome-launch.test.ts unit/chrome-launch-flags.test.ts unit/process-group.test.ts` → green (spawn, kill, stderr capture, fake executables, group kill)."
- L1093 (Review checklist): "- [ ] Output readers are started before the stdin write in `execProcess`; no `kWindowSize`, no chunk loop; the #14445 swallow is kept (write **and** close inside one try/catch, logged at debug level)."

## 29-ral-net-http-watch-on-node-apis.md

Extracted commands: 50 (a=13, b=19, c=4, d=0, u=14)

| # | line | section | command quoted | class | note |
|---|------|---------|----------------|-------|------|
| 1 | 77 | Acceptance criteria | `grep -c "Deno\." src/deno_ral/net.ts src/deno_ral/http.ts src/deno_ral/watch.ts` | a | Git Bash |
| 2 | 78 | Acceptance criteria | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent $(find unit/ral/ -name '*.test.ts')` | b | RT |
| 3 | 79 | Acceptance criteria | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/preview/preview-reload.test.ts smoke/preview/preview-project-reload.test.ts smoke/jupyter/daemon.test.ts unit/preview-initial-path.test.ts unit/preview-external-links.test.ts unit/preview-subdir-knitr-cwd.test.ts unit/axe-postrender.test.ts $(find smoke/jupyter/ ...)` | b | RT |
| 4 | 80 | Acceptance criteria | `node tools/node-bundle/run-unit-on-node.mjs --known-failures ... tests/unit/ral/` | u | NB; "Windows in the `node-unit` job" |
| 5 | 81 | Acceptance criteria | `node tools/node-bundle/check-deps.mjs` | u | NB |
| 6 | 83 | Acceptance criteria | `quarto run --dev tools/check-runtime-boundary.ts` | b | quarto.cmd |
| 7 | 83 | Acceptance criteria | `--check-shim` ("lists fewer members") | u | NB; bare flag, command is build.mjs |
| 8 | 105 | Task 1 Step 2 | `node tools/node-bundle/check-deps.mjs --write` | u | NB |
| 9 | 109 | Task 1 Step 2 | `npm install` | b | `npm.cmd` in Git Bash, or run from PowerShell |
| 10 | 110 | Task 1 Step 2 | `node tools/node-bundle/check-deps.mjs` | u | NB |
| 11 | 116 | Task 1 Step 3 | `package/dist/bin/tools/x86_64/deno eval --import-map=src/import_map.json 'import { WebSocketServer } from "ws"; console.log(typeof WebSocketServer)'` | b | `deno.exe`; single-quoted arg is Git Bash form (PowerShell quoting differs) |
| 12 | 122-123 | Task 1 Step 4 | `git add src/import_map.json package.json package-lock.json` / `git commit -m "deps: add ws and @types/ws for the http layer"` | a | git |
| 13 | 181 | Task 2 Step 2 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/net.test.ts` | b | RT |
| 14 | 302 | Task 2 Step 4 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/net.test.ts unit/chrome-launch.test.ts $(find smoke/jupyter/ -name '*.test.ts')` | b | RT |
| 15 | 308-309 | Task 2 Step 5 | `git add src/deno_ral/net.ts tests/unit/ral/net.test.ts` / `git commit -m "deno_ral/net: buffered TCP connection and async port probing on node:net"` | a | git |
| 16 | 554 | Task 3 Step 2 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/http.test.ts` | b | RT |
| 17 | 878 | Task 3 Step 4 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/http.test.ts smoke/preview/preview-reload.test.ts smoke/preview/preview-project-reload.test.ts unit/preview-initial-path.test.ts unit/preview-external-links.test.ts unit/axe-postrender.test.ts; cd ..` | b | RT |
| 18 | 879 | Task 3 Step 4 | `node tools/node-bundle/run-unit-on-node.mjs --known-failures ... tests/unit/ral/http.test.ts` | u | NB |
| 19 | 886-887 | Task 3 Step 5 | `git add src/deno_ral/http.ts tests/unit/ral/http.test.ts` / `git commit -m "deno_ral/http: server on node:http with ws-based upgrades"` | a | git |
| 20 | 963 | Task 4 Step 2 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/watch.test.ts; cd ..` | b | RT |
| 21 | 964 | Task 4 Step 2 | `node tools/node-bundle/run-unit-on-node.mjs --known-failures ... tests/unit/ral/watch.test.ts` | u | NB |
| 22 | 1150 | Task 4 Step 4 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/watch.test.ts; cd ..` | b | RT; same command as row 20 (different section) |
| 23 | 1151 | Task 4 Step 4 | `node tools/node-bundle/run-unit-on-node.mjs --known-failures ... tests/unit/ral/watch.test.ts` | u | NB; same as row 21 |
| 24 | 1157 | Task 4 Step 5 | `QUARTO_DEBUG=true package/dist/bin/quarto preview dev-docs/runtime-migration/spike/tests/simple.qmd --no-browser --port 4399` ("in one terminal") | b | `$env:QUARTO_DEBUG="true"` + quarto.cmd |
| 25 | 1157 | Task 4 Step 5 | `touch src/core/watch.ts` ("in another") | a | Git Bash; PowerShell has no `touch` (use `(Get-Item).LastWriteTime = Get-Date`) |
| 26 | 1158 | Task 4 Step 5 | "Repeat with `QUARTO_WATCH_POLLING=1`" (same preview command with env var) | b | `$env:QUARTO_WATCH_POLLING="1"` + quarto.cmd |
| 27 | 1179 | Task 5 Step 1 (yaml, `shell: bash`) | `cp -r "$SPIKE_TESTS" "$RUNNER_TEMP/preview"` | a | bash script; Git Bash on a Windows runner, Linux job per L1223 |
| 28 | 1180 | Task 5 Step 1 (yaml) | `tools/node-bundle/quarto-node preview "$RUNNER_TEMP/preview/simple.qmd" --no-browser --port 4321 > preview.log 2>&1 &` | u | NB; backgrounded job |
| 29 | 1181 | Task 5 Step 1 (yaml) | `PREVIEW_PID=$!` | a | Git Bash |
| 30 | 1182-1185 | Task 5 Step 1 (yaml) | `for i in $(seq 1 60); do if grep -q "Browse at" preview.log; then break; fi; sleep 1; done` | a | Git Bash (seq, grep, sleep present) |
| 31 | 1186 | Task 5 Step 1 (yaml) | `grep -q "Browse at" preview.log \|\| { echo "::error::preview did not start"; cat preview.log; kill $PREVIEW_PID; exit 1; }` | c | `kill $PREVIEW_PID` signals the MSYS job, not necessarily the Windows node process tree |
| 32 | 1187 | Task 5 Step 1 (yaml) | `node "$SPIKE_TESTS/ws-client.mjs" 4321 /` | c | trailing `/` argument is path-converted by Git Bash (MSYS rewrites a lone `/` to `C:/Program Files/Git/`); set `MSYS_NO_PATHCONV=1` |
| 33 | 1188 | Task 5 Step 1 (yaml) | `status=$?` | a | Git Bash |
| 34 | 1189 | Task 5 Step 1 (yaml) | `kill $PREVIEW_PID \|\| true` | c | as row 31; may leave node child running |
| 35 | 1190 | Task 5 Step 1 (yaml) | `cat preview.log` | a | Git Bash |
| 36 | 1198 | Task 5 Step 2 | `node tools/node-bundle/build.mjs --check-shim` | u | NB |
| 37 | 1199 | Task 5 Step 2 | `node tools/node-bundle/run-unit-on-node.mjs --known-failures tools/node-bundle/known-failures.json tests/unit/ral/` | u | NB |
| 38 | 1203 | Task 5 Step 3 | "Run the step's commands by hand with `SPIKE_TESTS=dev-docs/runtime-migration/spike/tests` and `RUNNER_TEMP=/tmp/rt29`" (rows 27-35) | c | bash env assignments; `/tmp/rt29` is Git Bash %TEMP% but read as `C:\tmp\rt29` by the Windows node/quarto-node; plus rows 31-34 hazards |
| 39 | 1209-1210 | Task 5 Step 4 | `git add .github/workflows/test-node-bundle.yml tools/node-bundle/deno-shim.mjs tools/node-bundle/known-failures.json` / `git commit -m "node-bundle: preview websocket smoke; drop net/http/watch shim members and known failures"` | a | git |
| 40 | 1215 | Verification | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent $(find unit/ral/ -name '*.test.ts')` | b | RT |
| 41 | 1216 | Verification | `node tools/node-bundle/run-unit-on-node.mjs --known-failures ... tests/unit/ral/` | u | NB |
| 42 | 1217 | Verification | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/preview/preview-reload.test.ts smoke/preview/preview-project-reload.test.ts smoke/jupyter/daemon.test.ts $(find smoke/jupyter/ ...) unit/preview-initial-path.test.ts unit/preview-external-links.test.ts unit/preview-subdir-knitr-cwd.test.ts unit/preview-brand-cache.test.ts unit/axe-postrender.test.ts unit/chrome-launch.test.ts` | b | RT |
| 43 | 1218 | Verification | `grep -c "Deno\." src/deno_ral/net.ts src/deno_ral/http.ts src/deno_ral/watch.ts` | a | Git Bash |
| 44 | 1219 | Verification | `node tools/node-bundle/check-deps.mjs` | u | NB |
| 45 | 1219 | Verification | `node tools/node-bundle/build.mjs --check-shim` | u | NB |
| 46 | 1220 | Verification | `quarto run --dev tools/check-runtime-boundary.ts` | b | quarto.cmd |
| 47 | 1221 | Verification (Manual) | `package/dist/bin/quarto preview dev-docs/runtime-migration/spike/tests/website --no-browser` (open URL, edit `about.qmd`) | b | quarto.cmd |
| 48 | 1222 | Verification (Manual) | `package/dist/bin/quarto call axe dev-docs/runtime-migration/spike/tests/website/_site` | b | quarto.cmd |
| 49 | 1224 | Verification (Manual, recreated output dir) | `QUARTO_DEBUG=true package/dist/bin/quarto preview dev-docs/runtime-migration/spike/tests/website --no-browser` | b | `$env:QUARTO_DEBUG` + quarto.cmd |
| 50 | 1224 | Verification (Manual, recreated output dir) | `rm -rf dev-docs/runtime-migration/spike/tests/website/_site` (then edit `about.qmd`) | a | Git Bash; PowerShell `Remove-Item -Recurse`. Destructive deletion of a spike output dir: needs dry-run first per Chris's rule |

### Windows mentions

- L10 (header "Ships on"): "the PR 26 `node-unit` job runs `tests/unit/ral/{net,http,watch}.test.ts` on real Node (Linux, Windows)".
- L80 (Acceptance criteria): "(Linux here, Windows in the `node-unit` job)".
- L881 (Task 3 Step 4): "PR 14b's `preview-reload.test.ts` and `preview-project-reload.test.ts` exercise `quarto preview` end to end ... on Deno through the new `node:http` body, on Linux and Windows in the Deno matrix; the Node run of the same flow is the workflow step in Task 5 (Linux), and PR 32's `node-suite` runs the two tests themselves on Node on Linux and Windows."
- L1153 (Task 4 Step 4): "all green on Deno and on Node (Linux here; the `node-unit` job adds Windows; macOS runs the Deno suite)."
- L1199 (Task 5 Step 2): "delete the `net`/`http`/`watch` entries it reports as passing (Linux; Windows from this branch's `node-unit` run)".
- L1223 (Verification): "Windows CI: the normal Deno matrix runs `smoke/preview/preview-reload.test.ts` and `smoke/preview/preview-project-reload.test.ts` on Windows (PR 14b runs both there, not ignored: reload and shutdown of a document and of a website preview, the preview tree ended with `taskkill /T`); the `node-unit` job runs `tests/unit/ral/{net,http,watch}.test.ts` on Node on Windows; `fs.watch` recursive and `ws` are native there. The Node preview smoke of Task 5 runs on Linux only (`node-render` is Linux until PR 32); the first Node run of the two preview tests on Windows is PR 32's `node-suite`".
- L1255 (Decisions needed, last paragraph): "R10 cites this PR as a consumer of PR 14b's Windows evidence: the preview reload and shutdown line is PR 14b's two preview tests, which run on Windows in the Deno matrix ... the child-tree termination and argument/path lines are PR 28's".


## 30-ral-kv-on-node.md

Extracted commands: 46 (a=21, b=15, c=2, d=0, u=8)

| # | line | section | command | class | note |
|---|---|---|---|---|---|
| 1 | 100 | Acceptance criteria | `grep -rn "unstable-kv" package/ tests/ src/ \| grep -v node_modules` | a | grep exists in Git Bash; PowerShell has no grep (use rg) |
| 2 | 101 | Acceptance criteria | `grep -c "Deno\." src/deno_ral/kv.ts` | a | Git Bash grep |
| 3 | 102 | Acceptance criteria | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/kv.test.ts unit/ral/kv-json.test.ts unit/sass-cache.test.ts` | b | run-tests.sh under Git Bash needs DENO_DIR=x86_64, or use run-tests.ps1 (env prefix is bash-only; PowerShell: `$env:QUARTO_TESTS_NO_CONFIG='true'`) |
| 4 | 102 | Acceptance criteria | `node tools/node-bundle/run-unit-on-node.mjs --known-failures tools/node-bundle/known-failures.json tests/unit/ral/` | u | script not read; node itself is cross-platform; plan says Linux and Windows legs |
| 5 | 104 | Acceptance criteria | `package/dist/bin/quarto render <doc>` and `package/dist/bin/quarto preview` | b | quarto -> package/dist/bin/quarto.cmd |
| 6 | 178 | Task 1 Step 2 (test code) | `process.kill(pid, 0)` loop from pid 4_000_000 down, expecting `ESRCH` (deadPid helper) | u | embedded in test; Windows process.kill(pid,0) error codes for a nonexistent pid not verified |
| 7 | 274 | Task 1 Step 2 (test code) | `utimeSync(lock, old, old)` on a lock directory (ownerless 60 s old lock) | u | setting mtime on a directory on Windows not verified |
| 8 | 346 | Task 1 Step 3 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/kv-json.test.ts` | b | as #3 |
| 9 | 352 | Task 1 Step 4 | `git add tests/unit/ral/kv-json.test.ts tests/unit/ral/fixtures/kv-writer.ts` | a | git is cross-platform |
| 10 | 353 | Task 1 Step 4 | `git commit -m "tests: pin the JSON key-value store contract ..."` | a | single-line message |
| 11 | 779 | Task 2 Step 2 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/kv.test.ts unit/ral/kv-json.test.ts unit/sass-cache.test.ts; cd ..` | b | as #3 |
| 12 | 780 | Task 2 Step 2 | `node tools/node-bundle/run-unit-on-node.mjs --known-failures tools/node-bundle/known-failures.json tests/unit/ral/kv.test.ts tests/unit/ral/kv-json.test.ts` | u | as #4 |
| 13 | 782 | Task 2 Step 2 (text) | check that Deno's `node:process` accepts `process.kill(pid, 0)` (fallback `Deno.kill(pid, 0)`) | u | liveness probe behavior on Windows Deno/Node not stated |
| 14 | 787 | Task 2 Step 3 | `git add src/deno_ral/kv.ts` | a | |
| 15 | 788 | Task 2 Step 3 | `git commit -m "deno_ral/kv: locked JSON index <name>.json instead of Deno.Kv"` | a | |
| 16 | 799 | Task 3 Step 1 | `rm -rf /tmp/rt30 && cp -r dev-docs/runtime-migration/spike/tests/website /tmp/rt30` | a | Git Bash only; /tmp is %TEMP%; PowerShell needs Remove-Item/Copy-Item |
| 17 | 801 | Task 3 Step 1 | `quarto --version && quarto render /tmp/rt30` (installed release) | b | quarto -> quarto.cmd/installed quarto.exe on PATH; /tmp path handed to a Windows binary (MSYS arg conversion in Git Bash, not in PowerShell) |
| 18 | 802 | Task 3 Step 1 | `ls /tmp/rt30/.quarto/project-cache/ \| tee /tmp/rt30-before.txt` | a | Git Bash |
| 19 | 803 | Task 3 Step 1 | `sha256sum /tmp/rt30/.quarto/project-cache/*.kv /tmp/rt30/.quarto/project-cache/deno-kv-file 2>/dev/null \| tee /tmp/rt30-before.sha` | a | Git Bash coreutils; PowerShell: Get-FileHash |
| 20 | 804 | Task 3 Step 1 | `package/dist/bin/quarto render /tmp/rt30` | b | quarto.cmd |
| 21 | 805 | Task 3 Step 1 | `ls /tmp/rt30/.quarto/project-cache/` | a | Git Bash |
| 22 | 806 | Task 3 Step 1 | `sha256sum -c /tmp/rt30-before.sha` | a | Git Bash; sums were written with /tmp paths under same shell |
| 23 | 807 | Task 3 Step 1 | `quarto render /tmp/rt30` (release renders again) | b | as #17 |
| 24 | 809 | Task 3 Step 1 | `QUARTO_LOG_LEVEL=DEBUG package/dist/bin/quarto render /tmp/rt30 2>&1 \| grep "Creating SassCache at"` | b | quarto.cmd; `VAR=x cmd` bash-only (PowerShell: `$env:QUARTO_LOG_LEVEL`); Git Bash ok. Also needs an installed Deno-based release to be meaningful |
| 25 | 817 | Task 4 Step 1 | `grep -rn "unstable-kv" package/ tests/ src/ \| grep -v node_modules` | a | Git Bash grep |
| 26 | 834 | Task 4 Step 2 | `grep -rn "unstable-kv" package/ tests/ src/ \| grep -v node_modules` | a | duplicate of #25 in a different section |
| 27 | 835 | Task 4 Step 2 | `package/dist/bin/quarto render dev-docs/runtime-migration/spike/tests/simple.qmd` | b | quarto.cmd |
| 28 | 836 | Task 4 Step 2 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/harness-failure-reporting.test.ts unit/smoke-all-prerender-isolation.test.ts unit/ral/kv.test.ts unit/ral/kv-json.test.ts unit/sass-cache.test.ts` | b | as #3 |
| 29 | 837 | Task 4 Step 2 | `cd .. && package/dist/bin/quarto run --dev tools/check-runtime-boundary.ts` | b | quarto.cmd |
| 30 | 841 | Task 4 Step 2 | `cargo check --manifest-path package/launcher/Cargo.toml` | a | cargo is cross-platform; only if installed |
| 31 | 846 | Task 4 Step 3 | `git add package/src/util/deno.ts package/src/quarto-bld ... tests/run-tests.ps1 tests/utils.ts ...` | a | |
| 32 | 847 | Task 4 Step 3 | `git commit -m "Drop --unstable-kv from Quarto's launchers and runners (Deno KV no longer used)"` | a | |
| 33 | 859 | Task 5 Step 1 | `node tools/node-bundle/build.mjs --check-shim` | u | PR 26 tooling not read |
| 34 | 864 | Task 5 Step 2 | `node tools/node-bundle/run-unit-on-node.mjs --known-failures tools/node-bundle/known-failures.json tests/unit/ral/` | u | as #4 |
| 35 | 871 | Task 5 Step 3 | `rm -rf /tmp/rt30n && cp -r dev-docs/runtime-migration/spike/tests/website /tmp/rt30n` | a | Git Bash |
| 36 | 872 | Task 5 Step 3 | `tools/node-bundle/quarto-node render /tmp/rt30n && tools/node-bundle/quarto-node render /tmp/rt30n` | c | extensionless script has no Windows launcher until PR 32 adds quarto-node.cmd (see 32-node-ci-required.md Task 4 Step 3) |
| 37 | 873 | Task 5 Step 3 | `ls /tmp/rt30n/.quarto/project-cache/` | a | Git Bash |
| 38 | 880 | Task 5 Step 4 | `git add tools/node-bundle/deno-shim.mjs tools/node-bundle/known-failures.json` | a | |
| 39 | 881 | Task 5 Step 4 | `git commit -m "node-bundle: drop the openKv shim and the kv known failures"` | a | |
| 40 | 886 | Verification | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent $(find unit/ral/ -name '*.test.ts') unit/sass-cache.test.ts` | b | as #3; `$(find ...)` bash-only (PowerShell: Get-ChildItem); Git Bash find is GNU find, fine there |
| 41 | 887 | Verification | `node tools/node-bundle/run-unit-on-node.mjs --known-failures tools/node-bundle/known-failures.json tests/unit/ral/` | u | as #4 |
| 42 | 888 | Verification | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent $(find smoke/render/ -name '*.test.ts') $(find smoke/project/ -name '*.test.ts')` | b | as #40 |
| 43 | 889 | Verification | `grep -rn "unstable-kv" package/ tests/ src/ \| grep -v node_modules`; `grep -c "Deno\." src/deno_ral/kv.ts` | a | Git Bash grep; duplicates of #1/#2 in another section |
| 44 | 890 | Verification | `quarto run --dev tools/check-runtime-boundary.ts` | b | quarto.cmd (bare `quarto` here; dev binary is package/dist/bin/quarto.cmd) |
| 45 | 892 | Verification | `cd tests && for i in 1 2 3; do QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/kv-json.test.ts \|\| break; done` | b | bash loop; Git Bash ok with DENO_DIR note; PowerShell needs `foreach` + run-tests.ps1 |
| 46 | 893 | Verification | `kill -STOP` a running `kv-writer.ts`, run a second writer, `kill -CONT` within 15 s | c | plan says "On Linux or macOS"; no SIGSTOP/SIGCONT on Windows, no direct equivalent (would need Suspend-Process/debugger) |


### Windows mentions
- L10 (Header, Ships on): "Node: the PR 26 `node-unit` job runs `tests/unit/ral/kv.test.ts` and `kv-json.test.ts` on real Node (Linux, Windows); their entries in `tools/node-bundle/known-failures.json` are removed and none is added."
- L22 (Spec, Context): "**Windows rename failures.** Antivirus and indexers hold files open briefly; `rename` over such a file fails with `EPERM`/`EACCES`/`EBUSY`. The write retries with backoff (about 1.6 s in total) before failing."
- L38 (Scope, In): "Remove `--unstable-kv` from: ... `package/src/quarto-bld.cmd`, ... `package/scripts/windows/quarto.cmd`, ... `tests/run-tests.ps1`, ..."
- L84 (Interfaces, Behaviour made precise, Writes): "`rename` the temporary file over the index (on Windows, retry `EPERM`/`EACCES`/`EBUSY` with backoff 10 ms doubling to 500 ms, eight retries)"
- L514 (Task 2 Step 1, code comment): "// Windows: antivirus and indexers briefly hold files open, and rename over a"
- L524 (Task 2 Step 1, code): `const transient = nodeProcess.platform === "win32" &&`
- L821 (Task 4 Step 1): "`package/src/quarto-bld` (line 21) and `package/src/quarto-bld.cmd` (line 13): remove ` --unstable-kv` from the `deno run` line."
- L823 (Task 4 Step 1): "`package/scripts/windows/quarto.cmd` line 131: `SET "QUARTO_DENO_OPTIONS=--unstable-ffi --no-config --no-lock --allow-all !QUARTO_DENO_OPTIONS!"`."
- L825 (Task 4 Step 1): "`tests/run-tests.sh` lines 72 and 268, `tests/run-tests.ps1` line 130: remove ` --unstable-kv`."
- L846 (Task 4 Step 3): `git add ... package/src/quarto-bld.cmd package/scripts/common/quarto package/scripts/windows/quarto.cmd ... tests/run-tests.ps1 ...`
- L865 (Task 5 Step 2): "delete them (Linux; Windows from this branch's `node-unit` run)"
- L900 (Review checklist): "Windows `EPERM`/`EACCES`/`EBUSY` on `rename` is retried with backoff; other errors are not."


## 31-test-harness-on-node.md

Extracted commands: 95 (a=36, b=40, c=13, d=0, u=6)

| # | line | section | command | class | note |
|---|---|---|---|---|---|
| 1 | 93 | Interfaces, runHarness on Node | `node --import <root>/tools/node-bundle/register-import-map.mjs --enable-experimental-regexp-engine [flags] --test --test-concurrency=1 --test-force-exit --test-timeout=600000 --test-reporter=spec ... <file>` | u | absolute Windows path passed to `--import` (not a file URL); whether Node accepts it on win32 not verified |
| 2 | 94 | Interfaces, runHarness on Node | `<root>/node_modules/.bin/vitest run --config <root>/tests/vitest.config.mjs --reporter=default ...` | c | `.bin/vitest` is a shell shim; spawning without a shell on Windows needs `vitest.cmd` (Task 4 Step 3's code actually uses `node node_modules/vitest/vitest.mjs`, which is fine) |
| 3 | 97 | Interfaces | `runtimeScriptCommand` on Node: `{ cmd: execPath(), args: [scriptPath] }` | a | spawns node.exe with an .mjs, no shell |
| 4 | 99 | Interfaces | `node run-parallel-tests.mjs [-n=<buckets>] [--timing-file=timing.txt] [--json-for-ci] [--dry-run] [--verbose] [--runner=deno\|node]` | a | plain node; but see #50 for `--runner` spawning |
| 5 | 115 | Acceptance criteria | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests-node.sh --agent unit/path.test.ts unit/text.test.ts unit/harness-node.test.ts unit/gha-grouping.test.ts` | b | run-tests-node.sh -> run-tests-node.ps1 (env var via `$env:`); under Git Bash see #62-#66 for script internals |
| 6 | 115 | Acceptance criteria | `./run-tests-node.sh --agent unit/ral/` | b | as #5 |
| 7 | 116 | Acceptance criteria | `cd tests && ./run-tests-node.sh docs/smoke-all/2023/02/08/4272.qmd` | b | as #5 |
| 8 | 117 | Acceptance criteria | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/harness-node.test.ts unit/harness-failure-reporting.test.ts unit/chrome-launch.test.ts unit/chrome-launch-flags.test.ts unit/smoke-all-prerender-isolation.test.ts` | b | run-tests.sh -> run-tests.ps1 (or DENO_DIR=x86_64 under Git Bash) |
| 9 | 118 | Acceptance criteria | `cd tests && ./run-tests-node.sh --agent unit/harness-failure-reporting.test.ts unit/chrome-launch.test.ts unit/chrome-launch-flags.test.ts` | b | as #5 |
| 10 | 119 | Acceptance criteria | `cd tests && node run-parallel-tests.mjs -n=20 --json-for-ci --timing-file=timing-for-ci.txt` | a | node, cross-platform |
| 11 | 119 | Acceptance criteria | `quarto run run-parallel-tests.ts -n=20 --json-for-ci --timing-file=timing-for-ci.txt` (on main) | b | quarto -> quarto.cmd |
| 12 | 120 | Acceptance criteria | `QUARTO_TEST_TIMEOUT=2000` example with `zz-hang` | b | env prefix bash-only; see #68 |
| 13 | 123 | Acceptance criteria | `quarto run --dev tools/check-runtime-boundary.ts` | b | quarto.cmd |
| 14 | 137 | Task 1 Step 1 | `node tools/node-bundle/check-deps.mjs --write && npm install && node tools/node-bundle/check-deps.mjs` | b | npm -> npm.cmd under Git Bash (extensionless nvm/scoop script fails); PowerShell `npm` ok |
| 15 | 143 | Task 1 Step 2 | `grep -n '^} from "@std/assert";' tests/asserts.ts` | a | Git Bash grep |
| 16 | 149 | Task 1 Step 3 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/asserts.test.ts unit/path.test.ts unit/text.test.ts $(find unit/ral/ -name '*.test.ts')` | b | run-tests.ps1 / DENO_DIR; `$(find ...)` bash-only |
| 17 | 155 | Task 1 Step 4 | `git add src/import_map.json package.json package-lock.json tests/asserts.ts` | a | |
| 18 | 156 | Task 1 Step 4 | `git commit -m "tests: assertions from @std/assert 1.x"` | a | |
| 19 | 283 | Task 2 Step 2 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/harness-node.test.ts` | b | as #8 |
| 20 | 415 | Task 2 Step 4 | `grep -rn "Deno\.args\|[^a-zA-Z]args()" tests --include=*.ts \| grep -v "tests/docs/"` | a | Git Bash grep |
| 21 | 419 | Task 2 Step 5 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/harness.test.ts unit/harness-failure-reporting.test.ts docs/smoke-all/2023/02/08/4272.qmd` | b | as #8 |
| 22 | 420 | Task 2 Step 5 | `./run-tests.sh --agent unit/harness-node.test.ts` | b | as #8 |
| 23 | 425 | Task 2 Step 6 | `git add tests/harness.ts tests/utils.ts tests/test.ts tests/smoke/smoke-all.test.ts tests/integration/playwright-tests.test.ts tests/unit/harness-node.test.ts` | a | |
| 24 | 426 | Task 2 Step 6 | `git commit -m "tests/harness: testArgs, onProcessExit, runtimeScriptCommand on Node"` | a | |
| 25 | 470 | Task 3 Step 1 | `node --test tools/node-bundle/import-map-hook.test.mjs` | a | node only; hook test spawns node with `--import <abs path>` (test code, same open point as #1) |
| 26 | 513 | Task 3 Step 2 | `node --test tools/node-bundle/import-map-hook.test.mjs` | a | duplicate of #25 in another step |
| 27 | 605 | Task 3 Step 5 | `cd tests && QUARTO_TESTS_NO_CONFIG=true node --no-warnings --import ../tools/node-bundle/register-import-map.mjs --test --test-concurrency=1 --test-force-exit unit/harness-node.test.ts unit/path.test.ts` | b | env prefix bash-only (PowerShell `$env:`); relative `--import` path is fine on Windows |
| 28 | 612 | Task 3 Step 6 | `git add tools/node-bundle/import-map-hook.mjs tools/node-bundle/register-import-map.mjs tools/node-bundle/import-map-hook.test.mjs tests/harness.ts tests/utils.ts` | a | |
| 29 | 613 | Task 3 Step 6 | `git commit -m "tests/harness: node:test registration and runHarness on Node (Spike V: node:test)"` | a | |
| 30 | 627 | Task 4 Step 1 | `npm install --save-dev --save-exact vitest@<version recorded in SPIKES.md>` | b | npm.cmd under Git Bash |
| 31 | 764 | Task 4 Step 4 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ../node_modules/.bin/vitest run --config vitest.config.mjs unit/harness-node.test.ts unit/path.test.ts` | b | `.bin/vitest` -> `..\node_modules\.bin\vitest.cmd` (or `node ../node_modules/vitest/vitest.mjs`); env prefix bash-only |
| 32 | 770 | Task 4 Step 5 | `git add tests/vitest.config.mjs package.json package-lock.json tests/harness.ts tests/utils.ts` | a | |
| 33 | 771 | Task 4 Step 5 | `git commit -m "tests/harness: Vitest registration and runHarness on Node (Spike V: Vitest)"` | a | |
| 34 | 837 | Task 5 Step 1 (run-tests-node.sh body) | `QUARTO_TEST_BIN_VERSION="$(env "${strip_args[@]}" "$QUARTO_TEST_BIN" --version 2>/dev/null)"` | u | `env -u` plus a Windows launcher (.cmd) under Git Bash; behavior of `env -u` on a .cmd not verified |
| 35 | 846 | Task 5 Step 1 (body) | `source configure-test-env.sh` | b | PowerShell script uses `. ./configure-test-env.ps1` (L1012); sh version assumes bash |
| 36 | 852 | Task 5 Step 1 (body) | `source "$QUARTO_VENV_ACTIVATE"` with `QUARTO_VENV_ACTIVATE="${QUARTO_ROOT}/tests/.venv/bin/activate"` | c | on Windows uv/venv puts it at `.venv/Scripts/activate`; the `-f` test is false so venv is silently skipped under Git Bash |
| 37 | 859 | Task 5 Step 1 (body) | `find . -name '*.test.ts' -not -path ... \| sort` | a | Git Bash GNU find/sort; PATH issue only if System32 `find`/`sort` shadow (user rule: Git Bash PATH puts usr/bin first) |
| 38 | 874 | Task 5 Step 1 (body) | `QUARTO_TEST_ARGS="$test_args" "$NODE" --no-warnings --import "$QUARTO_ROOT/tools/node-bundle/register-import-map.mjs" ... --test --test-concurrency=1 --test-force-exit "--test-timeout=..." ...` | u | `$QUARTO_ROOT` is an absolute (MSYS-converted) path given to `--import`; same open point as #1; `VAR=x cmd` bash-only |
| 39 | 893 | Task 5 Step 1 (body, timing mode) | `/usr/bin/time -f "        %e real %U user %S sys" -a -o "${QUARTO_TEST_TIMING}" bash -c 'run_test_files "$0" "$1"' "$j" "$SMOKE_ALL_TEST_FILE"` | c | GNU `time` at /usr/bin/time is likely absent from Git for Windows; PowerShell variant has no timing mode at all (run-tests-node.ps1 body shows none) |
| 40 | 895 | Task 5 Step 1 (body) | `find docs/smoke-all/ -type f -regextype "posix-extended" -regex ".*/[^_][^/]*[.](qmd\|md\|ipynb)"` | a | Git Bash GNU find; paths feed `bash -c` |
| 41 | 900 | Task 5 Step 1 (body) | `/usr/bin/time -f ... -o "$QUARTO_TEST_TIMING" bash -c 'run_test_files "" "$0"' "$i"` | c | as #39 |
| 42 | 960 | Task 5 Step 1 (Variant V body) | `QUARTO_TEST_ARGS="$test_args" "$NODE" "$QUARTO_ROOT/node_modules/vitest/vitest.mjs" run --config "$SCRIPT_PATH/vitest.config.mjs" "--testTimeout=..." ...` | a | node runs vitest.mjs directly, no shim; bash `VAR=x` needs Git Bash |
| 43 | 1005 | Task 5 Step 2 (run-tests-node.ps1) | `$v = & $Env:QUARTO_TEST_BIN --version` | b | needs `quarto.cmd`/`quarto-node.cmd` as QUARTO_TEST_BIN (extensionless script not runnable) |
| 44 | 1012 | Task 5 Step 2 (ps1) | `. ./configure-test-env.ps1` | a | native PowerShell; file existence not checked |
| 45 | 1014 | Task 5 Step 2 (ps1) | `$venv = Join-Path $Env:QUARTO_ROOT "tests" ".venv" "Scripts" "Activate.ps1"` then `. $venv` | a | Windows venv layout; Join-Path with multiple children needs PowerShell 7 (5.1 fails) |
| 46 | 1019 | Task 5 Step 2 (ps1) | `Get-ChildItem -Recurse -Filter "*.test.ts" \| Where-Object {...} \| ForEach-Object { Resolve-Path -Relative ... } \| Sort-Object` | a | native PowerShell; relative paths come back with backslashes (`.\unit\x.test.ts`), later handed to node --test (u for downstream path matching) |
| 47 | 1028 | Task 5 Step 2 (ps1) | `& $NODE --no-warnings --import (Join-Path $Env:QUARTO_ROOT "tools" "node-bundle" "register-import-map.mjs") --enable-experimental-regexp-engine ... --test --test-concurrency=1 --test-force-exit "--test-timeout=$timeout" @reporter @junit @files` | u | absolute Windows path to `--import` (same as #1); no timing mode in the ps1 body |
| 48 | 1068 | Task 5 Step 2 (ps1 Variant V) | `& $NODE (Join-Path $Env:QUARTO_ROOT "node_modules" "vitest" "vitest.mjs") run --config (Join-Path $SCRIPT_PATH "vitest.config.mjs") "--testTimeout=$timeout" @reporter @junit @files` | a | |
| 49 | 1077 | Task 5 Step 3 | `chmod +x tests/run-tests-node.sh` | c | NTFS: chmod is a no-op for git; exec bit must be set with `git update-index --chmod=+x` |
| 50 | 1078 | Task 5 Step 3 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests-node.sh --agent unit/path.test.ts unit/text.test.ts unit/harness-node.test.ts unit/gha-grouping.test.ts; echo "exit=$?"` | b | run-tests-node.ps1 (`$LASTEXITCODE`); Git Bash works with caveats #36 #39 |
| 51 | 1085 | Task 5 Step 3 | `cat > unit/zz-hang.test.ts <<'EOF' ... EOF` | b | heredoc is bash-only; PowerShell: here-string or Write tool |
| 52 | 1089 | Task 5 Step 3 | `QUARTO_TEST_TIMEOUT=2000 QUARTO_TESTS_NO_CONFIG=true timeout 120 ./run-tests-node.sh --agent unit/zz-hang.test.ts; echo "hang exit=$?"` | b | env prefix bash-only; `timeout` is GNU timeout in Git Bash (System32 `timeout.exe` would shadow it from PowerShell: different tool); use run-tests-node.ps1 + Start-Process/WaitForExit for the outer guard |
| 53 | 1091 | Task 5 Step 3 | `cat > unit/zz-child.test.ts <<'EOF' ... EOF` (spawns `execPath()` with `-e "setTimeout(() => {}, 5000)"`) | b | heredoc bash-only |
| 54 | 1097 | Task 5 Step 3 | `QUARTO_TESTS_NO_CONFIG=true timeout 120 ./run-tests-node.sh --agent unit/zz-child.test.ts; echo "child exit=$?"` | b | as #52 |
| 55 | 1099 | Task 5 Step 3 | `cat > unit/zz-timer.test.ts <<'EOF' ... EOF` | b | heredoc bash-only |
| 56 | 1103 | Task 5 Step 3 | `QUARTO_TESTS_NO_CONFIG=true timeout 120 ./run-tests-node.sh --agent unit/zz-timer.test.ts; echo "timer exit=$?"` | b | as #52 |
| 57 | 1105 | Task 5 Step 3 | `cat > unit/zz-opted-out.test.ts <<'EOF' ... EOF` | b | heredoc bash-only |
| 58 | 1109 | Task 5 Step 3 | `QUARTO_TESTS_NO_CONFIG=true timeout 120 ./run-tests-node.sh --agent unit/zz-opted-out.test.ts; echo "opted-out exit=$?"` | b | as #52 |
| 59 | 1110 | Task 5 Step 3 | `rm unit/zz-hang.test.ts unit/zz-child.test.ts unit/zz-timer.test.ts unit/zz-opted-out.test.ts` | a | Git Bash; PowerShell: Remove-Item (destructive-op dry-run rule applies if run by hand) |
| 60 | 1118 | Task 5 Step 3 (expected table) | `pgrep -f "setTimeout(() => {}, 5000)"` (should be empty after 5 s) | c | pgrep not in Git for Windows; PowerShell: Get-CimInstance Win32_Process filter on CommandLine |
| 61 | 1122 | Task 5 Step 3 (text) | `./run-tests.sh --agent unit/zz-*.test.ts` (Deno comparison) | b | run-tests.ps1 does not expand `zz-*` the same; Git Bash expands the glob |
| 62 | 1127 | Task 5 Step 4 | `git add tests/run-tests-node.sh tests/run-tests-node.ps1` | a | |
| 63 | 1128 | Task 5 Step 4 | `git commit -m "tests: run-tests-node entry points for Node 26"` | a | |
| 64 | 1140 | Task 6 Step 1 | `cd tests && quarto run run-parallel-tests.ts -n=20 --json-for-ci --timing-file=timing-for-ci.txt > /tmp/rt31-buckets-deno.json; node -e 'const j=require("/tmp/rt31-buckets-deno.json"); console.log(j.length, j.flat().length)'` | c | `quarto` -> quarto.cmd; the `/tmp/...` string inside `node -e` is not converted by MSYS, so Windows node reads `C:\tmp\...` while the redirect wrote to %TEMP% |
| 65 | 1313 | Task 6 Step 2 (run-parallel-tests.sh body) | `exec node "$(dirname "$0")/run-parallel-tests.mjs" "$@"` | a | Git Bash; PowerShell users call `node run-parallel-tests.mjs` directly |
| 66 | 1301 | Task 6 Step 2 (run-parallel-tests.mjs body) | `spawn(runner, bucket.map(...), { stdio: "inherit" })` with `runner = "./run-tests.sh"` or `"./run-tests-node.sh"` | c | `child_process.spawn` of a `.sh` file without a shell fails on Windows (EFTYPE/ENOENT); affects local `--runner=` parallel runs; CI only uses `--json-for-ci` |
| 67 | 1320 | Task 6 Step 3 | `cd tests && node run-parallel-tests.mjs -n=20 --json-for-ci --timing-file=timing-for-ci.txt > /tmp/rt31-buckets-node.json` | a | Git Bash redirect writes to %TEMP%; see #68 |
| 68 | 1321 | Task 6 Step 3 | `node -e 'const a=require("/tmp/rt31-buckets-deno.json"), b=require("/tmp/rt31-buckets-node.json"); ...'` | c | `/tmp` inside a node string resolves to `C:\tmp` on Windows, not %TEMP% |
| 69 | 1322 | Task 6 Step 3 | `git rm run-parallel-tests.ts` | a | |
| 70 | 1342 | Task 6 Step 5 | `git add tests/run-parallel-tests.mjs tests/run-parallel-tests.sh .github/workflows/test-smokes-parallel.yml` | a | |
| 71 | 1343 | Task 6 Step 5 | `git commit -m "tests: run-parallel-tests on Node (was Deno-only), same buckets"` | a | |
| 72 | 1402 | Task 7 Step 2 | `grep -n 'Deno\.' tests/unit/chrome-launch*.test.ts` | a | Git Bash grep and glob |
| 73 | 1402 | Task 7 Step 2 | `quarto run --dev tools/check-runtime-boundary.ts --update-baseline` | b | quarto.cmd |
| 74 | 1412 | Task 7 Step 4 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/chrome-launch.test.ts unit/chrome-launch-flags.test.ts unit/harness-failure-reporting.test.ts unit/smoke-all-prerender-isolation.test.ts` | b | as #8 |
| 75 | 1413 | Task 7 Step 4 | `QUARTO_TESTS_NO_CONFIG=true ./run-tests-node.sh --agent unit/chrome-launch.test.ts ...` | b | as #5 |
| 76 | 1420 | Task 7 Step 5 | `git add tests/unit/chrome-launch-fixtures.ts ... tools/runtime-boundary-baseline.json` | a | |
| 77 | 1421 | Task 7 Step 5 | `git commit -m "tests: runtime-neutral fake executables; guard Deno-reporter assertions"` | a | |
| 78 | 1437 | Task 8 Step 1 (CI yaml) | `./run-tests-node.sh --agent unit/path.test.ts unit/text.test.ts unit/harness-node.test.ts unit/gha-grouping.test.ts unit/harness-failure-reporting.test.ts unit/chrome-launch.test.ts unit/chrome-launch-flags.test.ts` (`shell: bash` on the Windows leg) | u | plan itself says Windows leg runs under Git Bash; relies on #36 #39 behavior |
| 79 | 1453 | Task 8 Step 2 (README text) | `npm ci` (repository root) | b | npm.cmd under Git Bash |
| 80 | 1455 | Task 8 Step 2 (README text) | `QUARTO_TESTS_NO_CONFIG=true ./run-tests-node.sh --agent unit/path.test.ts` | b | as #5 |
| 81 | 1456 | Task 8 Step 2 (README text) | `./run-tests-node.sh docs/smoke-all/2023/02/08/4272.qmd` | b | as #5 |
| 82 | 1457 | Task 8 Step 2 (README text) | `QUARTO_TEST_BIN=../tools/node-bundle/quarto-node ./run-tests-node.sh smoke/` | c | extensionless `quarto-node` has no Windows launcher until PR 32 adds quarto-node.cmd |
| 83 | 1458 | Task 8 Step 2 (README text) | `node run-parallel-tests.mjs -n=8 --runner=node` | c | spawns `./run-tests-node.sh` (see #66) |
| 84 | 1485 | Task 8 Step 3 | `git add .github/workflows/test-node-bundle.yml tests/README.md` | a | |
| 85 | 1486 | Task 8 Step 3 | `git commit -m "ci/docs: harness tests on Node through run-tests-node"` | a | |
| 86 | 1491 | Verification | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent $(find unit/ -name '*.test.ts') smoke/render/render-html.test.ts docs/smoke-all/2023/02/08/4272.qmd` | b | as #8; `$(find ...)` bash-only |
| 87 | 1492 | Verification | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests-node.sh --agent unit/path.test.ts unit/text.test.ts unit/harness-node.test.ts unit/gha-grouping.test.ts unit/harness-failure-reporting.test.ts unit/chrome-launch.test.ts unit/chrome-launch-flags.test.ts` | b | as #5 |
| 88 | 1493 | Verification | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests-node.sh --agent unit/ral/` | b | as #5 |
| 89 | 1494 | Verification | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests-node.sh docs/smoke-all/2023/02/08/4272.qmd` | b | as #5 |
| 90 | 1495 | Verification | `node tools/node-bundle/build.mjs && cd tests && QUARTO_TEST_BIN=$PWD/../tools/node-bundle/quarto-node QUARTO_TESTS_NO_CONFIG=true ./run-tests-node.sh --agent smoke/render/render-html.test.ts` | c | `quarto-node` needs a .cmd on Windows (PR 32); `$PWD` bash-only |
| 91 | 1496 | Verification | `node --test "tools/node-bundle/*.test.mjs"` | a | quoted glob expanded by node |
| 92 | 1497 | Verification | `quarto run --dev tools/check-runtime-boundary.ts` | b | quarto.cmd |
| 93 | 1498 | Verification | `cd tests && QUARTO_TEST_TIMING=/tmp/t.txt QUARTO_TESTS_NO_CONFIG=true ./run-tests-node.sh unit/path.test.ts && cat /tmp/t.txt` | c | timing mode needs GNU `/usr/bin/time` (#39); `QUARTO_TEST_TIMING=/tmp/t.txt` env value path |
| 94 | 1498 | Verification | `node run-parallel-tests.mjs --timing-file=/tmp/t.txt --dry-run -n=1` | u | `/tmp/t.txt` as an argument is converted by Git Bash, not by PowerShell |
| 95 | 1499 | Verification | `GITHUB_ACTIONS=true QUARTO_TESTS_NO_CONFIG=true ./run-tests-node.sh unit/gha-grouping.test.ts \| grep -c "::group::"` | b | env prefix bash-only; Git Bash ok |


### Windows mentions
- L5 (Goal): "with `tests/run-tests-node.sh`/`.ps1` mirroring `run-tests.sh`/`.ps1` (binary mode, `--agent`, timing, GitHub grouping)"
- L35 (What is fixed table): "`tests/run-tests-node.sh`/`.ps1`: argument contract, environment, binary mode, timing format, `--agent`"
- L44 (What is fixed): "...the Variant V bodies of `tests/run-tests-node.sh` and `.ps1` in Tasks 5-6..." (long line; `.ps1` mentioned)
- L52 (Scope): "`tests/run-tests-node.sh`, `tests/run-tests-node.ps1`."
- L70 (Interfaces): "(set by run-tests-node.sh, run-tests-node.ps1 and runHarness on Node)"
- L107 (Files): "Create: `tests/run-tests-node.sh`, `tests/run-tests-node.ps1`, `tests/run-parallel-tests.mjs`"
- L214 (Task 2 test code comment): "// file: URLs resolve identically on Deno and Node (and on Windows)."
- L774 (Task 5 heading): "### Task 5: `run-tests-node.sh` and `run-tests-node.ps1`"
- L777: "Create: `tests/run-tests-node.sh`, `tests/run-tests-node.ps1`"
- L976 (ps1 body): "# tests/run-tests-node.ps1"
- L979: "# contract as run-tests.ps1; see tests/README.md "Running on Node"."
- L1012: `. ./configure-test-env.ps1`
- L1014: `$venv = Join-Path $Env:QUARTO_ROOT "tests" ".venv" "Scripts" "Activate.ps1"`
- L1127: `git add tests/run-tests-node.sh tests/run-tests-node.ps1`
- L1440 (Task 8 Step 1): "(On the Windows leg `shell: bash` runs Git Bash; `run-tests-node.ps1` is exercised by PR 32's Windows matrix.)"
- L1449 (README text): "`run-tests-node.sh` / `run-tests-node.ps1` run the same files on Node 26..."
- L1506 (Review checklist): "`run-tests-node.sh`/`.ps1` mirror `run-tests.sh`/`.ps1`: `--agent`, `--keep-outputs`, document -> smoke-all, directory targets, binary-mode default, venv activation, timing format, `QUARTO_TEST_JUNIT`..."


## 32-node-ci-required.md

Extracted commands: 76 (a=63, b=4, c=2, d=0, u=7)

| # | line | section | command | class | note |
|---|---|---|---|---|---|
| 1 | 70 | Interfaces | `node tools/node-bundle/junit-finish.mjs <junit> --prereq <jsonl>` (run by every runner script after a JUnit run) | a | plain node |
| 2 | 89 | Interfaces | `node tools/node-bundle/junit-finish.mjs <junit.xml> [--prereq <skips.jsonl>] [--file <test file>]` | a | |
| 3 | 106 | Interfaces | `node tools/node-bundle/compare-junit.mjs --deno <xml\|dir> --node <xml\|dir> [--buckets <N>] [--allowlist ...] [--julia-engine ...]` | a | |
| 4 | 139 | Acceptance criteria | `node --test "tools/node-bundle/*.test.mjs"` | a | |
| 5 | 195 | Task 1 Step 1 | `node --test tools/node-bundle/junit.test.mjs` | a | |
| 6 | 371 | Task 1 Step 3 | `node --test tools/node-bundle/junit.test.mjs` | a | duplicate of #5 in another step |
| 7 | 396 | Task 1 Step 5 (run-tests.sh snippet) | `QUARTO_JUNIT_ARGS=("--junit-path=$QUARTO_TEST_JUNIT")`; `export QUARTO_TEST_PREREQ_SKIPS="${QUARTO_TEST_JUNIT%.xml}.prereq.jsonl"`; `rm -f "$QUARTO_TEST_PREREQ_SKIPS"` | a | bash snippet inside run-tests.sh; Git Bash only (ps1 snippet at #10) |
| 8 | 408 | Task 1 Step 5 | `node "$QUARTO_ROOT/tools/node-bundle/junit-finish.mjs" "$QUARTO_TEST_JUNIT" --prereq "$QUARTO_TEST_PREREQ_SKIPS"` (guarded by `command -v node`) | a | Git Bash converts the args; same note as #7 |
| 9 | 415 | Task 1 Step 5 | run-tests-node.sh: same three lines plus the post-run block | a | as #7/#8 |
| 10 | 420 | Task 1 Step 5 (ps1) | `$Env:QUARTO_TEST_PREREQ_SKIPS = [System.IO.Path]::ChangeExtension($Env:QUARTO_TEST_JUNIT, ".prereq.jsonl")`; `Remove-Item -ErrorAction SilentlyContinue $Env:QUARTO_TEST_PREREQ_SKIPS` | a | native PowerShell; note ChangeExtension on `x.xml` gives `x.prereq.jsonl` (same as the sh `%.xml` rule) |
| 11 | 426 | Task 1 Step 5 (ps1) | `--junit-path=$($Env:QUARTO_TEST_JUNIT)` added to run-tests.ps1's `deno test` line | a | |
| 12 | 430 | Task 1 Step 5 (ps1) | `& node (Join-Path $Env:QUARTO_ROOT "tools" "node-bundle" "junit-finish.mjs") $Env:QUARTO_TEST_JUNIT --prereq $Env:QUARTO_TEST_PREREQ_SKIPS` | a | PowerShell 7 required for multi-child Join-Path |
| 13 | 439 | Task 1 Step 6 | `T=$(grep -rln "prereq:" smoke \| head -1); echo "$T"` | a | Git Bash |
| 14 | 440 | Task 1 Step 6 | `QUARTO_TEST_JUNIT=/tmp/rt32-deno.xml QUARTO_TESTS_NO_CONFIG=true PATH=/usr/bin:/bin ./run-tests.sh --agent "$T"` | c | `PATH=/usr/bin:/bin` strips Windows tool dirs; `/tmp/...` as an env value passed to deno.exe; run-tests.sh needs DENO_DIR note |
| 15 | 441 | Task 1 Step 6 | `QUARTO_TEST_JUNIT=/tmp/rt32-node.xml QUARTO_TESTS_NO_CONFIG=true PATH=/usr/bin:/bin:$(dirname "$(command -v node)") ./run-tests-node.sh --agent "$T"` | c | same PATH trick; `$(...)` bash-only; env-value path conversion unverified |
| 16 | 442 | Task 1 Step 6 | `node ../tools/node-bundle/junit.mjs summary /tmp/rt32-deno.xml /tmp/rt32-node.xml` | u | /tmp args converted by Git Bash but not by PowerShell |
| 17 | 443 | Task 1 Step 6 | `grep -c 'message="prerequisite not met"' /tmp/rt32-deno.xml /tmp/rt32-node.xml` | a | Git Bash grep with bash /tmp |
| 18 | 450 | Task 1 Step 7 | `git add tests/test.ts tests/run-tests.sh tests/run-tests.ps1 tests/run-tests-node.sh tests/run-tests-node.ps1 tools/node-bundle/junit.mjs tools/node-bundle/junit.test.mjs tools/node-bundle/junit-finish.mjs` | a | |
| 19 | 451 | Task 1 Step 7 | `git commit -m "tests: JUnit from every runner with the test file; prerequisite skips reported as skipped"` | a | |
| 20 | 550 | Task 2 Step 1 | `node --test tools/node-bundle/compare-junit.test.mjs` | a | test code uses os.tmpdir/path.join, cross-platform |
| 21 | 695 | Task 2 Step 2 | `node --test tools/node-bundle/compare-junit.test.mjs` | a | duplicate of #20 in another step |
| 22 | 700 | Task 2 Step 3 | `node tools/node-bundle/compare-junit.mjs --deno /tmp/rt32-deno.xml --node /tmp/rt32-node.xml --allowlist tools/node-bundle/node-parity-allowlist.txt` | u | /tmp path under PowerShell vs Git Bash; depends on #14/#15 outputs existing |
| 23 | 705 | Task 2 Step 3 | `mkdir -p /tmp/rt32/deno/d01 /tmp/rt32/node/n01 && cp /tmp/rt32-deno.xml /tmp/rt32/deno/d01/0001.xml && cp /tmp/rt32-node.xml /tmp/rt32/node/n01/0001.xml` | a | Git Bash only |
| 24 | 706 | Task 2 Step 3 | `node tools/node-bundle/compare-junit.mjs --deno /tmp/rt32/deno --node /tmp/rt32/node --buckets 1; echo "exit $?"` | u | `$?` bash; /tmp as above |
| 25 | 707 | Task 2 Step 3 | same with `--buckets 2; echo "exit $?"` | u | |
| 26 | 708 | Task 2 Step 3 | same with `--node /tmp/rt32/missing --buckets 1; echo "exit $?"` | u | |
| 27 | 715 | Task 2 Step 4 | `git add tools/node-bundle/compare-junit.mjs tools/node-bundle/compare-junit.test.mjs tools/node-bundle/node-parity-allowlist.txt` | a | |
| 28 | 716 | Task 2 Step 4 | `git commit -m "ci: pass-set parity by file and name, failures and incomplete evidence fail it, Julia-only allowlist"` | a | |
| 29 | 744 | Task 3 Step 2 (CI yaml) | `npm ci` ; `node tools/node-bundle/build.mjs --check-shim` (if node runtime) | a | `shell: bash` step on CI runners incl. windows-latest |
| 30 | 749 | Task 3 Step 2 (CI yaml) | `mkdir -p "$RUNNER_TEMP/junit"`; `echo "JUNIT_DIR=$RUNNER_TEMP/junit" >> "$GITHUB_ENV"` | a | CI bash step |
| 31 | 759 | Task 3 Step 3 (CI yaml, Linux) | `runner=./run-tests.sh; if [ "${{ inputs.test-runtime }}" = "node" ]; then runner=./run-tests-node.sh; fi; QUARTO_TEST_JUNIT="$JUNIT_DIR/0000.xml" "$runner"` | a | Linux CI step |
| 32 | 768 | Task 3 Step 3 (CI yaml, Windows) | `$runner = if ("${{ inputs.test-runtime }}" -eq "node") { "./run-tests-node.ps1" } else { "./run-tests.ps1" }; $env:QUARTO_TEST_JUNIT = Join-Path $env:JUNIT_DIR "0000.xml"; & $runner; Exit $LASTEXITCODE` | a | PowerShell, already Windows-adapted |
| 33 | 777 | Task 3 Step 3 (CI yaml, Linux bucket) | `n=$((n + 1)); echo ">>> ${runner} ${file}"; QUARTO_TEST_JUNIT="$JUNIT_DIR/$(printf '%04d' "$n").xml" "$runner" "$file"` | a | Linux CI bash |
| 34 | 787 | Task 3 Step 3 (CI yaml, Windows bucket) | `$n++; Write-Host ">>> $runner ${file}"; $env:QUARTO_TEST_JUNIT = Join-Path $env:JUNIT_DIR ("{0:D4}.xml" -f $n); & $runner $file` | a | PowerShell |
| 35 | 810 | Task 3 Step 5 | `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/test-smokes.yml')); print('yaml ok')"` | b | `python3` is typically absent on Windows (Store stub); use `uv run --with pyyaml python -c ...` or `python`; needs PyYAML |
| 36 | 814 | Task 3 Step 5 | `git add .github/workflows/test-smokes.yml` | a | |
| 37 | 815 | Task 3 Step 5 | `git commit -m "ci: test-runtime input and one JUnit report per runner invocation"` | a | |
| 38 | 827 | Task 4 Step 1 | `node -e 'const k=require("./tools/node-bundle/known-failures.json"); for (const os of ["linux","macos","windows"]) console.log(os, JSON.stringify(k[os]))'` | a | Git Bash single quotes; PowerShell mangles the inner double quotes for native commands |
| 39 | 831 | Task 4 Step 1 | `git rm tools/node-bundle/run-unit-on-node.mjs tools/node-bundle/known-failures.json` | a | |
| 40 | 856 | Task 4 Step 2 (CI yaml) | `BUCKETS=$(./run-parallel-tests.sh -n=20 --json-for-ci --timing-file=timing-for-ci.txt \| jq -rc '...')` | a | ubuntu-latest CI job |
| 41 | 860 | Task 4 Step 2 (CI yaml) | `echo "N_BUCKETS=$(echo "$BUCKETS" \| jq '.buckets \| length')" >> "$GITHUB_OUTPUT"` | a | ubuntu CI |
| 42 | 938 | Task 4 Step 2 (CI yaml) | `bad=$(echo "$NEEDS" \| jq -r '...')`; `if [ -n "$bad" ]; then echo ...; exit 1; fi` | a | ubuntu CI |
| 43 | 959 | Task 4 Step 2 (CI yaml) | `node tools/node-bundle/compare-junit.mjs --deno junit/deno --node junit/node --buckets "${{ needs.node-buckets.outputs.N_BUCKETS }}" --allowlist tools/node-bundle/node-parity-allowlist.txt` | a | ubuntu CI |
| 44 | 983 | Task 4 Step 2 (CI yaml, render-parity) | `uv sync --frozen` (working-directory tests) | a | cross-platform; runs on windows-latest in matrix |
| 45 | 993 | Task 4 Step 2 (CI yaml) | `if (!requireNamespace('renv', quietly = TRUE)) install.packages('renv'); renv::restore()` (`shell: Rscript {0}`) | a | |
| 46 | 997 | Task 4 Step 2 (CI yaml) | `npm ci && node tools/node-bundle/build.mjs --check-shim` | a | bash step on all three OS |
| 47 | 1001 | Task 4 Step 2 (CI yaml) | `source tests/.venv/bin/activate 2>/dev/null \|\| source tests/.venv/Scripts/activate` | a | already handles the Windows venv layout |
| 48 | 1005 | Task 4 Step 2 (CI yaml) | `if [ "$runtime" = deno ]; then q="$PWD/package/dist/bin/quarto"; else q="$PWD/tools/node-bundle/quarto-node"; fi` | a | |
| 49 | 1006 | Task 4 Step 2 (CI yaml) | `if [ "$RUNNER_OS" = Windows ]; then q="$q.cmd"; fi` | a | already applies the quarto -> quarto.cmd adaptation; requires quarto-node.cmd (Task 4 Step 3) |
| 50 | 1009 | Task 4 Step 2 (CI yaml) | `"$q" render "$f" --to html \|\| echo "::warning::$runtime failed on $f"` | a | |
| 51 | 1017 | Task 4 Step 2 (CI yaml) | `node tools/node-bundle/normalize-html.mjs --root "$RUNNER_TEMP/ff-$runtime" "$RUNNER_TEMP/ff-$runtime"` | a | |
| 52 | 1019 | Task 4 Step 2 (CI yaml) | `diff -r -x .quarto "$RUNNER_TEMP/ff-deno" "$RUNNER_TEMP/ff-node" > ff-render.diff` | a | Git Bash diff on windows-latest runner |
| 53 | 1022 | Task 4 Step 2 (CI yaml) | `head -c 20000 ff-render.diff` | a | |
| 54 | 1056 | Task 4 Step 3 (quarto-node.cmd) | `if not exist "%HERE%dist\quarto.mjs" ( echo ... & exit /b 1 )`; `"%QUARTO_NODE%" --enable-experimental-regexp-engine --max-old-space-size=8192 --stack-trace-limit=100 "%HERE%dist\quarto.mjs" %*` | u | the artifact being created; not run by the plan; `echo ... 1>&2 & exit /b 1` on one line with parentheses never tested |
| 55 | 1067 | Task 4 Step 4 | `gh workflow run "Node Tests" --ref rt/32-node-ci-required`; `gh run watch` | a | gh is cross-platform; requires pushing the branch (needs Chris's approval per AGENTS rules) |
| 56 | 1069 | Task 4 Step 4 | scratch commit editing `if: always() && inputs.label-tag != 'n07'`, dispatch, then `exit 1` bucket | a | git/gh only; same push approval note |
| 57 | 1074 | Task 4 Step 5 | `git add .github/workflows/test-node-bundle.yml .github/workflows/test-smokes.yml tools/node-bundle/quarto-node.cmd` | a | |
| 58 | 1075 | Task 4 Step 5 | `git commit -m "ci: bucketed Node matrix per PR; nightly Deno, macOS, render parity, binary mode and pass-set parity"` | a | |
| 59 | 1085 | Task 5 Step 1 | `grep -n -A3 "### Spike #2" dev-docs/runtime-migration/SPIKES.md` | a | Git Bash grep |
| 60 | 1106 | Task 5 Step 2 (CI yaml) | `npm ci && node tools/node-bundle/build.mjs --check-shim` | a | |
| 61 | 1112 | Task 5 Step 2 (CI yaml) | `DENO="$(ls package/dist/bin/tools/*/deno* \| head -1)"` | u | on Windows the bundled deno is `deno.exe` under `tools/x86_64/`; glob `deno*` matches but `head -1` could pick another file |
| 62 | 1116 | Task 5 Step 2 (CI yaml) | `"$DENO" run --allow-all --no-config --v8-flags=--enable-experimental-regexp-engine tools/node-bundle/dist/quarto.mjs render "$RUNNER_TEMP/deno/$doc"` | a | bundled deno.exe, bash on runner |
| 63 | 1117 | Task 5 Step 2 (CI yaml) | `node --enable-experimental-regexp-engine tools/node-bundle/dist/quarto.mjs render "$RUNNER_TEMP/node/$doc"` | a | |
| 64 | 1120 | Task 5 Step 2 (CI yaml) | `diff -r -x .quarto "$RUNNER_TEMP/deno" "$RUNNER_TEMP/node" && echo "BUNDLE ON DENO IDENTICAL"` | a | |
| 65 | 1128 | Task 5 Step 3 | `git add .github/workflows/test-node-bundle.yml` | a | |
| 66 | 1129 | Task 5 Step 3 | `git commit -m "ci: nightly Node bundle on Deno (dual-runtime window, Spike #2)"` | a | |
| 67 | 1141 | Task 6 Step 1 | `grep -n "continue-on-error" .github/workflows/test-node-bundle.yml` | a | Git Bash grep |
| 68 | 1142 | Task 6 Step 1 | `grep -v '^#' tools/node-bundle/node-parity-allowlist.txt \| grep -c . ; grep -v '^#' tools/node-bundle/node-parity-allowlist.txt \| grep -vic julia` | a | Git Bash grep |
| 69 | 1163 | Task 6 Step 3 (doc text) | `gh api repos/quarto-dev/quarto-cli/branches/main/protection/required_status_checks --jq .contexts` | a | maintainer-only, admin rights |
| 70 | 1170 | Task 6 Step 3 (doc text) | `gh api -X PATCH repos/quarto-dev/quarto-cli/branches/main/protection/required_status_checks \` newline `--input required-checks.json` | b | bash line continuation `\`; PowerShell uses backtick; maintainer-only |
| 71 | 1217 | Task 6 Step 4 | `git add .github/workflows/test-smokes-parallel.yml dev-docs/runtime-migration/node-bundle.md dev-docs/runtime-migration/README.md` | a | |
| 72 | 1218 | Task 6 Step 4 | `git commit -m "ci: Node matrix required; full Deno matrix nightly; parity documented"` | a | |
| 73 | 1224 | Verification | `python3 -c "import yaml; [yaml.safe_load(open(f)) for f in [...]]; print('ok')"` | b | python3 -> python or `uv run --with pyyaml python -c`; needs PyYAML |
| 74 | 1229 | Verification | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/path.test.ts` | b | run-tests.ps1 / DENO_DIR=x86_64 |
| 75 | 1223 | Verification | `node --test "tools/node-bundle/*.test.mjs"` | a | duplicate of #4 in another section |
| 76 | 1225 | Verification | `workflow_dispatch` of `Smoke Tests` with default inputs (uploads `junit-deno-<os>-full`) | a | gh workflow run; no local command given (explicit-input rule: pass every input via -f) |


### Windows mentions
- L5 (Goal): "Run the full unit and smoke suites on Node in the same 20 timing-based buckets the Deno matrix uses (Linux and Windows on every pull request, macOS nightly)"
- L6 (Depends on): "PR 31 (`run-tests-node.sh`/`.ps1`, `tests/run-parallel-tests.mjs`, the runner Spike V chose)"
- L16: "PR 31 created `tests/run-tests-node.sh`/`.ps1` and `tests/run-parallel-tests.mjs`."
- L24 (Context): "**macOS had no Deno baseline** (`test-smokes.yml`'s default runners are Linux and Windows; macOS is "reserved for scheduled built-version runs")"
- L29-31 (Parity criteria): "all must hold for Linux and Windows before the Node jobs are required" / "Every Node bucket passes (per pull request: Linux and Windows)."
- L52 (Scope): "`tests/run-tests.sh`, `tests/run-tests.ps1`: `QUARTO_TEST_JUNIT` support (Deno `--junit-path`); all four runner scripts: the prerequisite sidecar and its JUnit rewrite."
- L56 (Scope): "`node-suite` (per PR, Linux and Windows)"
- L58 (Scope): "`tools/node-bundle/quarto-node.cmd` (Windows launcher for the bundle)."
- L68 (Interfaces): "Environment for every runner script (`run-tests.sh`, `run-tests.ps1`, `run-tests-node.sh`, `run-tests-node.ps1`)"
- L130, L132, L154: file lists naming `run-tests.ps1`, `run-tests-node.ps1`, `quarto-node.cmd`
- L141 (Acceptance): "A pull request runs `node-suite` in 20 buckets on Linux and Windows and uploads one `junit-node-<os>-n<NN>` artifact per job"
- L142 (Acceptance): "`parity: OK` for Linux, macOS and Windows"
- L417 (Task 1 Step 5): "`tests/run-tests.ps1` and `tests/run-tests-node.ps1`: the PowerShell equivalents:"
- L426: "(`run-tests.ps1` also adds `--junit-path=$($Env:QUARTO_TEST_JUNIT)` to its `deno test` invocation)"
- L450: `git add ... tests/run-tests.ps1 ... tests/run-tests-node.ps1 ...`
- L765 (Task 3 Step 3): ""Run all Smoke Tests Windows":" with `$runner = ... "./run-tests-node.ps1" ... "./run-tests.ps1"`
- L784: ""Run Smoke Tests as a bucket on Windows": `$runner` as above..."
- L822, L1048, L1052, L1074: `tools/node-bundle/quarto-node.cmd` (create, heading, header comment, git add)
- L827: `for (const os of ["linux","macos","windows"]) console.log(os, JSON.stringify(k[os]))`
- L872, L900, L968, L1098: `runners: '["ubuntu-latest", "windows-latest"]'` / `["ubuntu-latest", "macos-latest", "windows-latest"]` / `os: [ubuntu-latest, macos-latest, windows-latest]` / `os: [ubuntu-latest, windows-latest]`
- L932: `os: [Linux, macOS, Windows]`
- L988: `windows-path-include-rtools: false`
- L1006: `if [ "$RUNNER_OS" = Windows ]; then q="$q.cmd"; fi`
- L1067 (Task 4 Step 4): "...`node-suite` green in all 20 buckets on Linux and Windows; ... `parity: OK` for Linux, macOS and Windows" (long line)
- L1069: "...`parity-compare`: ... `parity: NO EVIDENCE` on Linux and Windows (macOS is unaffected: `node-macos` uploads its own)..." (long line)
- L1165: "`Node bucket NN / Run smoke (ubuntu-latest)` and `Node bucket NN / Run smoke (windows-latest)`"
- L1179 (node-bundle.md text): "1. Every Node bucket green per PR (Linux, Windows)."
- L1180: "2. Nightly, per OS (Linux, macOS, Windows): pass set and ignored-skip set equal to Deno's..." (long line)
- L1250 (Risks): "**Windows Node suite** first runs per PR here; failures in `.cmd` spawning or path handling belong to PR 28/27 and are fixed there before Task 6."
- L1255 (Decisions): "per-PR Node on Linux and Windows with macOS nightly" (long line)

### Windows mentions added by grep sweep at assembly
Lines matching `windows|win32|.cmd|.ps1|taskkill` (case-insensitive) that the extractor's list above did not cite. Quoted verbatim, trimmed to 300 characters; section is the nearest preceding heading.

- L768 (Task 3: `test-runtime` input and per-invocation JUnit in `test-smokes.yml`): "$runner = if ("${{ inputs.test-runtime }}" -eq "node") { "./run-tests-node.ps1" } else { "./run-tests.ps1" }"

## 33-build-tooling-node.md

Extracted commands: 167 (a=79, b=52, c=24, d=0, u=12)

Shell assumption: the plan writes every command for Bash (`./run-tests.sh`, `VAR=x cmd`, `>/dev/null`, `$(mktemp -d)`, `time`, `touch`, `kill`) except `configure.cmd`/`quarto.cmd` bodies, which are batch. Line numbers are from Read of the file as it is on disk. Code blocks that are file contents to be written (test sources, `node.ts`, `ensure.mjs`, `build.mjs`, `configure.sh` body) are not commands; they are listed only as one row where the file itself is something an executor runs, plus rows for the process-control calls inside them. `\|` in a cell is a literal pipe.

| # | line | section | command | class | note |
|---|------|---------|---------|-------|------|
| 1 | 217 | Acceptance criteria | `./configure.sh` (Linux x64/arm64, macOS) / `./configure.cmd` (Windows x64) | (b) | Windows row of the criterion is `./configure.cmd` (batch file; run as `.\configure.cmd` from PowerShell or `configure.cmd` from cmd). `configure.sh` is not a Windows path. |
| 2 | 218 | Acceptance criteria | `package/dist/bin/quarto --version` | (b) | `package/dist/bin/quarto.cmd --version` |
| 3 | 218 | Acceptance criteria | `package/dist/bin/quarto render tests/docs/smoke-all/2023/01/04/issue-3847.qmd` | (b) | `quarto.cmd` |
| 4 | 218 | Acceptance criteria | `ps` during a render shows `node`, not `deno` | (c) | `ps` is not a PowerShell/cmd process lister (alias `ps` = Get-Process in PowerShell prints names `node`/`deno`; in Git Bash `ps` shows MSYS procs only); needs `Get-Process node,deno` or `tasklist` |
| 5 | 219 | Acceptance criteria | whole suite with `QUARTO_TEST_RUNTIME` unset (Node) on three OSes | (b) | `tests/run-tests.ps1` or `run-tests.sh` with `DENO_DIR=x86_64` under Git Bash |
| 6 | 220 | Acceptance criteria | `quarto run --dev tools/check-runtime-boundary.ts` | (b) | `quarto.cmd` |
| 7 | 221 | Acceptance criteria | `npm run typecheck` | (b) | `npm.cmd` under Git Bash; plain `npm` in PowerShell |
| 8 | 222 | Acceptance criteria | one green `deno-nightly` run of `Node Tests` dispatched on the branch (workflow dispatch) | (a) | `gh workflow run` is cross-platform; CI-side, no local command is quoted |
| 9 | 223 | Acceptance criteria | `NODE_OPTIONS=--bogus quarto --help` exits 0 | (c) | `VAR=x cmd` is bash-only; the check is `tests/smoke/env/launcher-env.test.ts`, which must set env programmatically; would run `quarto.cmd` |
| 10 | 223 | Acceptance criteria | `quarto run env.lua` (child sees `NODE_OPTIONS` unchanged) | (b) | `quarto.cmd`; `quarto.cmd` env pass-through behavior is the point of the test (u whether `NODE_OPTIONS=--bogus` survives `.cmd` save/restore) |
| 11 | 223 | Acceptance criteria | `QUARTO_DENO_V8_OPTIONS=--stack-trace-limit=200` reaches `node` | (c) | bash env prefix; Windows launchers are `quarto.cmd` and `quarto.exe` (Rust), both must translate it |
| 12 | 223 | Acceptance criteria | `QUARTO_DENO_OPTIONS=--allow-all quarto --help` exits 0 and warns once | (c) | bash env prefix; `quarto.cmd` |
| 13 | 224 | Acceptance criteria | `cd package/src && ./quarto-bld prepare-dist --set-version 99.9.9` | (b) | `package\src\quarto-bld.cmd`; `cd ... &&` fine in PowerShell 7 |
| 14 | 224 | Acceptance criteria | `cd package/pkg-working/bin && ./quarto check` | (b) | `quarto.cmd` |
| 15 | 224 | Acceptance criteria | `./quarto-bld validate-bundle` | (b) | `quarto-bld.cmd` |
| 16 | 225 | Acceptance criteria | `cargo build --release --manifest-path package/launcher/Cargo.toml` | (a) | cargo is cross-platform; this builds the Windows `quarto.exe` launcher |
| 17 | 225 | Acceptance criteria | `create-release.yml` dispatched with `publish-release=false` (incl. MSI and `test-smokes-built.yml` on the Windows zip) | (a) | CI-side via `gh workflow run`; no local command quoted |
| 18 | 226 | Acceptance criteria | `quarto install deno` | (b) | `quarto.cmd`; `test-install.yml` job covers it |
| 19 | 227 | Acceptance criteria | `grep -n "deno-shim" tools/node-bundle/*.mjs` | (b) | works in Git Bash (glob expanded by bash); PowerShell does not expand `*.mjs` for native `grep`; use `rg -n "deno-shim" tools/node-bundle -g "*.mjs"` |
| 20 | 228 | Acceptance criteria | `rg -n '"(info\|fmt\|check\|bundle)"' package/src src -g '*.ts' -g '!src/deno_ral/**'` | (a) | rg is cross-platform; single quotes OK in Git Bash and PowerShell |
| 21 | 228 | Acceptance criteria | `rg -ln 'requireDenoToolBinary\|denoToolBinary' src -g '*.ts'` | (a) | same |
| 22 | 228 | Acceptance criteria | `cd package/src && ./quarto-bld cycle-dependencies -o "$(mktemp -d)/cycles.json"` | (c) | `$(mktemp -d)` is bash command substitution and yields a `/tmp/...` path that Windows binaries (the Node bundle via `quarto-bld.cmd`) read as `C:\tmp\...`; use `$env:TEMP`/a Windows temp path in PowerShell; `./quarto-bld` -> `quarto-bld.cmd` |
| 23 | 229 | Acceptance criteria | the two `rg` commands of PR 25 Task 7 step 2 (residue inspection) | (u) | commands are in another plan, not quoted here |
| 24 | 280, 406 | Task 1 Steps 2 and 6 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/node-dependency.test.ts` | (b) | env prefix is bash-only; `tests/run-tests.ps1` with `$env:QUARTO_TESTS_NO_CONFIG='true'`, or Git Bash with `DENO_DIR=x86_64` (the `--agent` flag support in `run-tests.ps1` is u) |
| 25 | 389 | Task 1 Step 4 | `grep -n "export async function unTar" package/src/util/tar.ts` | (a) | grep in Git Bash (or `rg`) |
| 26 | 389 | Task 1 Step 4 | grep `tar.gz` in `package/src/common/dependencies/` (no exact command given) | (a) | grep/rg |
| 27 | 411-412 | Task 1 Step 7 | `git add configuration package/src/common/dependencies/node.ts package/src/common/archive-binary-dependencies.ts tests/unit/node-dependency.test.ts` ; `git commit -m "build: pin Node 26 in configuration and add the node dependency"` | (a) | git |
| 28 | 429 | Task 2 Step 1 | `quarto run --dev tools/check-runtime-boundary.ts` | (b) | `quarto.cmd` |
| 29 | 430 | Task 2 Step 1 | `node -e 'const b=require("./tools/runtime-boundary-baseline.json"); for (const s of ["src","src-js","resources"]) console.log(s, JSON.stringify(b[s] ?? b.scopes?.[s]))'` | (a) | Git Bash fine; in PowerShell embedded double quotes inside a single-quoted arg to a native exe are quote-mangled before 7.3 / depend on `$PSNativeCommandArgumentPassing` (u there) |
| 30 | 431 | Task 2 Step 1 | `node tools/node-bundle/build.mjs --check-shim` | (a) | Node |
| 31 | 646 | Task 2 Step 3 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/node-bundle-ensure.test.ts` | (b) | as row 24 |
| 32 | 785-786 | Task 2 Step 4 | `git rm tools/node-bundle/deno-shim.mjs` ; `grep -rn "deno-shim" tools package .github \| grep -v runtime-migration` | (a) | git and grep in Git Bash |
| 33 | 598-604, 624-627 (test body) | Task 2 Step 2 (test code) | `child.kill("SIGTERM")` then `await child.status` (cancellation test, line 625) | (c) | on Windows `kill("SIGTERM")` terminates the process abruptly (TerminateProcess), no handlers; lock stays behind as the test expects, but the Deno-harness `spawn().kill` semantics are u |
| 34 | 904 (ensure.mjs body) | Task 2 Step 5 (code) | `process.kill(owner.pid, 0)` liveness probe | (u) | signal 0 is supported by Node on Windows; the plan itself says only the Deno harness run verifies Deno's `node:process` accepts it |
| 35 | 1013 | Task 2 Step 6 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/node-bundle-ensure.test.ts && node --test "tools/node-bundle/*.test.mjs"` | (b) | first half as row 24; `node --test "glob"` is expanded by Node itself (a) |
| 36 | 1020 | Task 2 Step 7 | `package/dist/bin/quarto --version >/dev/null` | (c) | `/dev/null` bash-only (use `$null` / `NUL`); `quarto.cmd` |
| 37 | 1021 | Task 2 Step 7 | `time (package/dist/bin/quarto --help >/dev/null)` | (c) | `time ( )` bash keyword; use `Measure-Command { quarto.cmd --help }` |
| 38 | 1022 | Task 2 Step 7 | `time (node tools/node-bundle/ensure.mjs --entry src/quarto.ts --outfile package/dist/bin/quarto-dev.mjs)` | (c) | `time` bash-only; `Measure-Command` |
| 39 | 1023 | Task 2 Step 7 | `touch src/core/path.ts && time (node tools/node-bundle/ensure.mjs --entry src/quarto.ts --outfile package/dist/bin/quarto-dev.mjs)` | (c) | `touch` exists in Git Bash only (PowerShell: `(Get-Item ...).LastWriteTime = Get-Date`); `time` bash-only; mtime resolution on NTFS is fine |
| 40 | 1029-1031 | Task 2 Step 8 | `git add tools/node-bundle tests/unit/node-bundle-ensure.test.ts .gitignore` ; `git commit -m "build: bundle() with atomic writes and input list; ensure.mjs with lock; drop the Deno shim"` | (a) | git |
| 41 | 1065-1189 | Task 3 Step 2 | `configure.sh` body (`set -ex`, `source configuration`, `curl --fail -L -o`, `sha256sum -c -`, `tar -xzf`, `chmod 755`, `ln -sf`, `rm -rf`, `npm ci --no-audit --no-fund`, `QUARTO_DENO="$DENO_BIN" "${QUARTO_PACKAGE_PATH}/scripts/deno_std/download.sh"`, `./quarto-bld configure --log-level info`) | (b) | whole script is bash; Windows equivalent is `configure.cmd` (rows 42-52). Not a Windows path as written; `ln -sf` symlink to deno has no cmd equivalent here (`quarto-cli.code-workspace` `deno.path` would need a copy/junction on Windows - u) |
| 42 | 1198-1201 | Task 3 Step 3 | `configure.cmd`: `SET "NODE_ARCHIVE_DIR=node-!NODE!-win-x64"` ... `IF DEFINED QUARTO_NODE_VERSION SET "NODE=!QUARTO_NODE_VERSION!"` | (a) | batch, delayed expansion assumed already enabled in the unchanged head of the file (u) |
| 43 | 1207 | Task 3 Step 3 | `call package\scripts\windows\check-node-in-use.cmd "!QUARTO_DIST_PATH!"` | (a) | Windows batch; the script itself is the renamed `check-deno-in-use.cmd` |
| 44 | 1211 | Task 3 Step 3 | `RMDIR /S /Q "!QUARTO_DIST_PATH!" 2>NUL` | (a) | cmd |
| 45 | 1223 | Task 3 Step 3 | `CURL --fail -L "https://nodejs.org/dist/!NODE!/!NODE_ARCHIVE!" -o "!NODE_ARCHIVE!"` | (a) | curl.exe ships with Windows 10 1803+; NO SHA256 verification in the batch path (contrast with `verify_sha256` in `configure.sh`) |
| 46 | 1226 | Task 3 Step 3 | `%WINDIR%\System32\tar -xf "!NODE_ARCHIVE!"` | (a) | absolute System32 bsdtar so Git's GNU tar is not picked up (matches the GNU tar .zip trap) |
| 47 | 1229 | Task 3 Step 3 | `unzip -o "!NODE_ARCHIVE!"` (fallback if tar fails) | (u) | `unzip` is not a stock Windows binary; present only if Git Bash/other unzip is on PATH |
| 48 | 1235-1238 | Task 3 Step 3 | `DEL "!NODE_ARCHIVE!"` ; `RMDIR /S /Q "!DENO_ARCH_DIR!\node-dist"` ; `MOVE "!NODE_ARCHIVE_DIR!" "!DENO_ARCH_DIR!\node-dist" > NUL` ; `COPY /Y "!DENO_ARCH_DIR!\node-dist\node.exe" "!DENO_ARCH_DIR!\node.exe" > NUL` | (a) | cmd builtins |
| 49 | 1239 | Task 3 Step 3 | `ECHO !NODE!> "!QUARTO_BIN_PATH!\..\config\node-version"` | (a) | no space before `>` (correct per Windows idiom) |
| 50 | 1244 | Task 3 Step 3 | `CURL --fail -L "https://github.com/denoland/deno/releases/download/!DENO!/!DENO_FILE!" -o "!DENO_FILE!"` | (a) | curl.exe |
| 51 | 1245 | Task 3 Step 3 | `%WINDIR%\System32\tar -xf "!DENO_FILE!"` | (a) | as row 46 |
| 52 | 1252 | Task 3 Step 3 | `ECHO !DENO!> "!QUARTO_BIN_PATH!\..\config\deno-version"` | (a) | cmd |
| 53 | 1254-1256 | Task 3 Step 3 | `SET "QUARTO_NODE=!QUARTO_BIN_PATH!\tools\!DENO_ARCH_DIR!\node.exe"` ; `SET "DENO_TOOL=...\deno.exe"` ; `SET "PATH=!QUARTO_BIN_PATH!\tools\!DENO_ARCH_DIR!\node-dist;!PATH!"` | (a) | cmd |
| 54 | 1266-1267 | Task 3 Step 3 | `SET "NODE_OPTIONS="` ; `SET "NODE_PATH="` | (a) | cmd |
| 55 | 1270 | Task 3 Step 3 | `CALL npm ci --no-audit --no-fund` | (a) | `CALL` needed because npm is `npm.cmd`; present |
| 56 | 1276 | Task 3 Step 3 | `CALL !QUARTO_PACKAGE_PATH!\scripts\deno_std\download.bat` | (u) | existence of `download.bat` is not shown in this plan |
| 57 | 1281 | Task 3 Step 3 | `CALL .\quarto-bld.cmd configure --log-level info` | (a) | cmd |
| 58 | 1286 | Task 3 Step 3 | `CALL "!QUARTO_BIN_PATH!\quarto" --version` | (a) | extensionless `CALL` resolves `quarto.cmd` via PATHEXT; guarded by `IF EXIST !QUARTO_BIN_PATH!\quarto.cmd` |
| 59 | 1302 | Task 3 Step 4 | `git mv package/scripts/windows/check-deno-in-use.cmd package/scripts/windows/check-node-in-use.cmd` | (a) | git |
| 60 | 1303, 1307 | Task 3 Step 4 | `grep -n -i "deno" package/scripts/windows/check-node-in-use.cmd` | (a) | grep in Git Bash (or rg) |
| 61 | 1306 | Task 3 Step 4 | edit `Get-Process -Name deno` -> `Get-Process -Name node,deno` inside the `.cmd` | (a) | PowerShell cmdlet inside a Windows-only script |
| 62 | 1312 | Task 3 Step 5 | `./configure.sh 2>&1 \| tail -15; ls package/dist/bin/tools/x86_64/; cat package/dist/config/node-version package/dist/config/deno-version; ls package/dist/bin/deno_cache` | (c) | bash script and `tail`; Windows runs `configure.cmd`; expected tools dir lists `node`, `deno`, `esbuild`, `typst` but Windows has `node.exe`, `deno.exe`, and the `deno` symlink is not created by `configure.cmd`; `ls ... deno_cache` expected to fail: PowerShell error text differs |
| 63 | 1314 | Task 3 Step 5 | `QUARTO_NODE_VERSION=v26.12.0 NODE_VERSION=26.12.0 ./configure.sh 2>&1 \| grep -c "Bootstrapping Node.js v26.12.0"` | (c) | bash env prefix; `configure.cmd` honours `QUARTO_NODE_VERSION` (line 1201) but does not check `NODE_VERSION`; set with `$env:`/`SET` then `configure.cmd \| findstr /C:...` |
| 64 | 1319-1320 | Task 3 Step 6 | `git add configure.sh configure.cmd package/scripts/common/utils.sh package/scripts/windows/check-node-in-use.cmd` ; `git commit -m "build: configure downloads Node and keeps Deno as a tool; npm ci replaces vendoring"` | (a) | git |
| 65 | 1330-1359 | Task 4 Step 1 | `quarto-bld` body: `"$QUARTO_NODE" "$QUARTO_ROOT/tools/node-bundle/ensure.mjs" --entry "$SCRIPT_PATH/bld.ts" --outfile "$BLD_BUNDLE" > /dev/null` then `exec "$QUARTO_NODE" --enable-experimental-regexp-engine ... "$BLD_BUNDLE" "$@"` | (b) | bash script; Windows uses `quarto-bld.cmd` (row 66) |
| 66 | 1365-1387 | Task 4 Step 2 | `quarto-bld.cmd` body: `"%QUARTO_NODE%" "%QUARTO_ROOT%tools\node-bundle\ensure.mjs" --entry "%~dp0\bld.ts" --outfile "%BLD_BUNDLE%" > NUL` ; `"%QUARTO_NODE%" --enable-experimental-regexp-engine ... "%BLD_BUNDLE%" %*` | (a) | batch; the `.cmd` is the Windows counterpart |
| 67 | 1361 | Task 4 Step 1 | `grep -n QUARTO_ROOT package/src/set_package_paths.sh` | (a) | grep in Git Bash |
| 68 | 1393 | Task 4 Step 3 | `cd package/src && ./quarto-bld --help \| head -20 && ls ../dist/bin/quarto-bld.mjs ../dist/bin/quarto-bld.mjs.map ../dist/bin/quarto-bld.mjs.inputs.json` | (b) | `quarto-bld.cmd`; `head` needs Git Bash (or `Select-Object -First 20`) |
| 69 | 1398-1400 | Task 4 Step 4 | `git add package/src/quarto-bld package/src/quarto-bld.cmd` ; `git commit -m "build: quarto-bld bundles bld.ts and runs it on Node"` | (a) | git |
| 70 | 1443 | Task 5 Step 2 | `git rm package/src/util/deno.ts` (conditional on PR 39) | (a) | git |
| 71 | 1446-1447 | Task 5 Step 2 | `git rm tools/deno-esbuild-bundle.ts` ; `grep -rn "deno-esbuild-bundle\|util/deno.ts\"" package .github tools \| grep -v runtime-migration` | (a) | git and grep in Git Bash |
| 72 | 1504 | Task 5 Step 4 | `validate-bundle.ts`: `args: ["install"]` -> `args: ["install", "--no-audit", "--no-fund"]` (npm spawned by `exec`, "npm is on PATH from `configure`") | (u) | a spawn of bare `npm` without a shell fails on Windows (needs `npm.cmd`); whether the existing code handles that is not stated |
| 73 | 1506 | Task 5 Step 4 | `cd package/src && ./quarto-bld prepare-dist --set-version 99.9.9 --log-level info 2>&1 \| tail -8 && ./quarto-bld validate-bundle` | (b) | `quarto-bld.cmd`; `tail` in Git Bash; validate-bundle runs eslint (u on Windows) |
| 74 | 1511 | Task 5 Step 5 | `ls package/pkg-working/bin package/pkg-working/bin/tools/x86_64` | (b) | command works; expected listing (`quarto`, `node`, `deno`, ...) is POSIX: Windows shows `quarto.cmd`/`quarto.exe`, `node.exe`, `deno.exe` |
| 75 | 1516-1518 | Task 5 Step 6 | `git add package/src/util package/src/common/prepare-dist.ts package/src/common/validate-bundle.ts tools/bundle-bug-finder/_prelude.js` ; `git commit -m "build: prepare-dist bundles for Node, ships node and the deno tool; validate-bundle knows Node globals"` | (a) | git |
| 76 | 1555 (build.mjs body) | Task 6 Step 1 (code) | `execFileSync("git", ["ls-files"], { encoding: "utf8" })` | (a) | git.exe on PATH |
| 77 | 1573-1576 (build.mjs body) | Task 6 Step 1 (code) | `const npm = process.platform === "win32" ? "npm.cmd" : "npm"` ; `spawnSync(npm, args, { stdio: "inherit", shell: process.platform === "win32" })` ; `run(["ci", "--no-audit", "--no-fund"])` ; `run(["run", "build"])` | (a) | already Windows-aware |
| 78 | 1623 (configure.ts body) | Task 6 Step 2 (code) | `(await which("npm")) === undefined` | (u) | `which` helper on Windows must resolve `npm.cmd` via PATHEXT |
| 79 | 1633-1637 | Task 6 Step 3 | `git rm src/webui/quarto-preview/build.ts src/webui/quarto-preview/deno.jsonc` ; `rm -f src/resources/preview/quarto-preview.js && (cd package/src && ./quarto-bld configure --log-level info 2>&1 \| grep -E "Running: npm\|skipping")` ; `ls src/resources/preview/quarto-preview.js` ; `git add src/webui/quarto-preview/build.mjs package/src/common/previewjs.ts package/src/common/configure.ts package/src/common/prepare-dist.ts` ; `git commit -m "build: quarto-preview.js builds on Node"` | (b) | `rm -f`, `( )` subshell, `grep -E` need Git Bash; `./quarto-bld` -> `quarto-bld.cmd`; `ls` of a single file works in PowerShell |
| 80 | 1709 | Task 7 Step 3 | `cd package/src && ./quarto-bld configure --log-level info > /dev/null && node -e 'console.log(Object.keys(JSON.parse(require("fs").readFileSync("../dist/config/dev-config","utf8"))).join(","))'` | (c) | `/dev/null` bash-only (`> NUL`/`$null`); `quarto-bld.cmd`; single-quoted `node -e` with embedded double quotes is quote-sensitive in PowerShell |
| 81 | 1713-1714 | Task 7 Step 3 | `git add src/core/devconfig.ts package/src/common/configure.ts` ; `git commit -m "build: dev config records Node, the Deno tool and package-lock.json"` | (a) | git |
| 82 | 1782, 1895 | Task 8 Steps 2 and 5 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/runtime-env.test.ts` | (b) | as row 24 |
| 83 | 1898-1900 | Task 8 Step 5 | `git add src/core/runtime-env.ts src/quarto.ts tests/unit/runtime-env.test.ts` ; `git commit -m "runtime: restore NODE_OPTIONS/NODE_PATH for children; warn once about Deno-era variables"` | (a) | git |
| 84 | 1973 | Task 9 Step 2 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/env/launcher-env.test.ts` | (b) | as row 24 (`run-tests.ps1`) |
| 85 | 1978-2105 | Task 9 Step 3 | `package/scripts/common/quarto` body (bash: `exec "${QUARTO_NODE}" ${QUARTO_NODE_FLAGS} ${QUARTO_NODE_OPTIONS} "${QUARTO_TARGET}" "$@"`, `ensure.mjs` call, `(cd "$QUARTO_ROOT" && ./configure.sh)`, `uname`/`sysctl` ARCH_DIR detection) | (b) | POSIX launcher; Windows does not run it, uses `quarto.cmd` (row 87). Only reachable on Windows through Git Bash if someone runs the extensionless script, which the README says to avoid |
| 86 | 2107 | Task 9 Step 3 | `grep -rn "QUARTO_ACTION\|QUARTO_NO_TYPECHECK" . --include=*.sh --include=*.ps1 --include=*.yml --include=*.md \| grep -v runtime-migration` | (a) | grep in Git Bash (slow on a whole Windows tree incl. `node_modules`; `rg` is the alternative) |
| 87 | 2111-2207 | Task 9 Step 4 | `quarto.cmd` body: `call !QUARTO_ROOT!\win_configuration.bat` ; `set /p NODE_INSTALLED_VERSION=<"!NODE_VERSION_FILE!"` ; `"!QUARTO_NODE!" "!QUARTO_ROOT!\tools\node-bundle\ensure.mjs" --entry "!QUARTO_TS_PATH!" --outfile "!QUARTO_TARGET!" > NUL` ; `"!QUARTO_NODE!" !QUARTO_NODE_FLAGS! !QUARTO_NODE_OPTIONS! "!QUARTO_TARGET!" %*` | (a) | batch, Windows-native. Note: `quarto.cmd` no longer auto-reconfigures, prints "Please run configure.cmd" instead (line 2209) |
| 88 | 2213 | Task 9 Step 5 | `HTTPS_PROXY=http://127.0.0.1:9 package/dist/bin/quarto --help 2>&1 >/dev/null \| head -3` | (c) | bash env prefix, `2>&1 >/dev/null` redirection order, `head`; `quarto.cmd`; the expectation (no `[UNDICI-EHPA]` warning) was measured on a Linux sandbox, not Windows |
| 89 | 2220 | Task 9 Step 6 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/env/launcher-env.test.ts unit/runtime-env.test.ts` | (b) | as row 24; multiple test paths after `--agent` (u on `run-tests.ps1`) |
| 90 | 2221 | Task 9 Step 6 | `cd .. && package/dist/bin/quarto --version && package/dist/bin/quarto --paths && package/dist/bin/quarto render tests/docs/smoke-all/2023/01/04/issue-3847.qmd` | (b) | `quarto.cmd` for all three |
| 91 | 2228-2229 | Task 9 Step 7 | `git add package/scripts/common/quarto package/scripts/windows/quarto.cmd tests/smoke/env/launcher-env.test.ts` ; `git commit -m "build: dev and installed launchers run Node; NODE_* moved aside; Deno flag variables not passed"` | (a) | git |
| 92 | 2369 | Task 10 Step 2 | `cargo build --release --manifest-path package/launcher/Cargo.toml` | (a) | cargo |
| 93 | 2370 | Task 10 Step 2 | `cp package/launcher/target/release/quarto package/pkg-working/bin/quarto-launcher` | (b) | on Windows the built binary is `quarto.exe` (`target/release/quarto.exe` -> `quarto-launcher.exe`) |
| 94 | 2371 | Task 10 Step 2 | `package/pkg-working/bin/quarto-launcher --paths` | (b) | `quarto-launcher.exe` |
| 95 | 2372 | Task 10 Step 2 | `NODE_OPTIONS=--bogus QUARTO_DENO_V8_OPTIONS=--stack-trace-limit=50 package/pkg-working/bin/quarto-launcher check versions 2>&1 \| head -5` | (c) | bash env prefix and `head`; `.exe`; set env with `$env:` in PowerShell |
| 96 | 2373 | Task 10 Step 2 | `rm package/pkg-working/bin/quarto-launcher` | (b) | `quarto-launcher.exe` (Git Bash `rm`, or `Remove-Item`) |
| 97 | 2379-2381 | Task 10 Step 3 | `git add package/launcher/src/main.rs` ; `git commit -m "launcher: quarto.exe spawns node with Quarto's flags; NODE_* moved aside"` | (a) | git |
| 98 | 2420 | Task 11 Step 2 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/tools/deno-tool.test.ts` | (b) | as row 24 |
| 99 | 2644 | Task 11 Step 6 (test-install.yml, `shell: bash`, matrix incl. windows-latest) | `rm -f package/dist/bin/tools/*/deno package/dist/bin/tools/*/deno.exe package/dist/bin/tools/deno` | (a) | CI step runs under Git Bash on Windows runners; line already names `deno.exe` |
| 100 | 2645 | Task 11 Step 6 | `quarto install deno --no-prompt` | (u) | bare `quarto` from Git Bash on Windows resolves only if PATH holds an extensionless `quarto` or Git Bash finds `quarto.cmd`; not shown here |
| 101 | 2646 | Task 11 Step 6 | `printf 'console.log("deno-tool-ok", typeof Deno.version.deno);\n' > s.ts` | (a) | bash builtin |
| 102 | 2647 | Task 11 Step 6 | `out=$(quarto run s.ts); echo "$out"; echo "$out" \| grep -q "deno-tool-ok string"` | (u) | same `quarto` resolution question; CRLF in captured output possible on Windows (`grep -q` on a substring is tolerant) |
| 103 | 2648 | Task 11 Step 6 | `quarto uninstall deno --no-prompt` | (u) | same |
| 104 | 2649 | Task 11 Step 6 | `if quarto run s.ts; then echo "expected failure without Deno"; exit 1; fi` | (u) | same |
| 105 | 2654 | Task 11 Step 7 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/tools/deno-tool.test.ts $(find smoke/run/ -name '*.test.ts') smoke/build-ts-extension/build-ts-extension.test.ts smoke/project/project-prepost.test.ts` | (b) | `run-tests.ps1`/Git Bash with `DENO_DIR=x86_64`; `$(find ...)` needs GNU find (Git Bash); PowerShell's `find` is the Windows FIND tool |
| 106 | 2658-2659 | Task 11 Step 7 | `git add src/tools src/core/run/deno.ts src/command/call/build-ts-extension/cmd.ts src/command/install/cmd.ts .github/workflows/test-install.yml tests/unit/tools/deno-tool.test.ts` ; `git commit -m "tools: quarto install deno; ..."` | (a) | git |
| 107 | 2671 | Task 12 Step 1 | `npm install --save-dev --save-exact typescript@5.9.3 @types/node@26.6.5 @types/deno@2.7.0` | (b) | `npm.cmd` under Git Bash |
| 108 | 2674 | Task 12 Step 1 | package.json script `"typecheck": "node tools/typecheck/gen-tsconfig-paths.mjs --check && tsc -p tsconfig.json"` | (a) | npm scripts run through cmd.exe on Windows; `&&` is supported |
| 109 | 2765 | Task 12 Step 4 | `node tools/typecheck/gen-tsconfig-paths.mjs` | (a) | Node |
| 110 | 2766 | Task 12 Step 4 | `npx tsc -p tsconfig.json > /tmp/tsc.txt 2>&1; grep -c "error TS" /tmp/tsc.txt` | (b) | `npx.cmd` under Git Bash; `/tmp` is fine because only MSYS tools (redirect, grep) touch it; not for PowerShell |
| 111 | 2767 | Task 12 Step 4 | `grep -oE "error TS[0-9]+" /tmp/tsc.txt \| sort \| uniq -c \| sort -rn \| head` | (a) | Git Bash only (GNU sort/uniq/head); `sort` in PowerShell is Sort-Object |
| 112 | 2772 | Task 12 Step 4 | `grep -rhoE "Deno\.[a-zA-Z.]+" src/deno_ral \| sort -u` | (a) | Git Bash |
| 113 | 2777 | Task 12 Step 4 | `npx tsc -p tsconfig.json` (stop condition: prints nothing) | (b) | `npx.cmd` under Git Bash |
| 114 | 2781 | Task 12 Step 5 | document `npm run typecheck` (from repository root) in `tests/README.md` | (b) | `npm.cmd` under Git Bash |
| 115 | 2815-2816 | Task 12 Step 6 (lint.yml, ubuntu-latest) | `source ./configuration` ; `echo "version=${NODE#v}" >> "$GITHUB_OUTPUT"` | (a) | CI step on ubuntu only; the typecheck job has no Windows runner |
| 116 | 2821 | Task 12 Step 6 | `npm ci --no-audit --no-fund` | (a) | CI |
| 117 | 2823 | Task 12 Step 6 | `npm run typecheck` | (a) | CI |
| 118 | 2830-2833 | Task 12 Step 7 | `git add package.json package-lock.json tsconfig.json tsconfig.paths.json tools/typecheck .github/workflows/lint.yml tests/README.md` ; `git commit -m "tooling: tsc --noEmit with @types/node replaces deno check"` ; `git add -A src tests package tools && git commit -m "types: fix errors surfaced by tsc" \|\| true` | (a) | git; `\|\| true` is bash-only (works in Git Bash, not PowerShell) |
| 119 | 2875 | Task 13 Step 1 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/env/launcher-env.test.ts` (three new tests fail) | (b) | as row 24 |
| 120 | 2885-2904 | Task 13 Step 2 | shell launcher branch: `"${QUARTO_NODE:-...}" "${QUARTO_ROOT}/tools/node-bundle/ensure.mjs" ... > /dev/null \|\| exit 1`, `exec "${QUARTO_DENO_TOOL}" ${QUARTO_DENO_RUN} "${QUARTO_TARGET}" "$@"` | (b) | POSIX launcher; Windows equivalent is the `quarto.cmd` branch (row 122) |
| 121 | 2907 | Task 13 Step 2 | `grep -c openKv tools/node-bundle/dist/quarto.mjs` (prints `0`) | (a) | grep in Git Bash |
| 122 | 2913-2931 | Task 13 Step 3 | `quarto.cmd` branch: `"!SCRIPT_PATH!\tools\x86_64\deno.exe" !QUARTO_DENO_RUN! "!QUARTO_TARGET!" %*` and `IF NOT "!QUARTO_RUNTIME!"=="node" ( ECHO QUARTO_RUNTIME must be node or deno ... exit /b 1 )` | (a) | batch |
| 123 | 2937-2973 | Task 13 Step 4 | `main.rs` branch: `Command::new(&deno_file).args(["run","--allow-all","--no-config","--no-lock","--v8-flags=..."])...` and `DENO_BINARY` consts (`deno.exe` under `cfg(target_os = "windows")`) | (a) | Rust; Windows-aware |
| 124 | 2978 | Task 13 Step 5 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/env/launcher-env.test.ts && cargo build --release --manifest-path package/launcher/Cargo.toml` | (b) | `run-tests.ps1` or Git Bash + `DENO_DIR=x86_64`; cargo (a) |
| 125 | 2979 | Task 13 Step 5 | `QUARTO_RUNTIME=deno package/dist/bin/quarto render tests/docs/smoke-all/2023/01/04/issue-3847.qmd` | (c) | bash env prefix; `$env:QUARTO_RUNTIME='deno'` then `quarto.cmd` |
| 126 | 2979 | Task 13 Step 5 | `QUARTO_RUNTIME=deno package/dist/bin/quarto render tests/docs/project/prepost/mutate-render-list` | (c) | same |
| 127 | 2982-2983 | Task 13 Step 5 | `git add package/scripts/common/quarto package/scripts/windows/quarto.cmd package/launcher/src/main.rs tests/smoke/env/launcher-env.test.ts` ; `git commit -m "launcher: QUARTO_RUNTIME=deno runs the bundle on the Deno tool (dual-runtime window)"` | (a) | git |
| 128 | 3016 | Dual-runtime combinations / Acceptance | `rg -n 'execPath\(\)' src -g '*.ts' -g '!src/deno_ral/**'` | (a) | rg |
| 129 | 3059 | Task 14 Step 3 | on the first Windows run check the npm cache step reports non-zero size; else set `path` to `${{ runner.os == 'Windows' && '~\AppData\Local\npm-cache' \|\| '~/.npm' }}` | (u) | CI-side check; no local command; path claim not verified |
| 130 | 3106-3115 | Task 14 Step 5 (`.vscode/tasks.json`) | `"type": "shell"`, `"command": "node"`, `"args": ["${workspaceFolder}/tools/node-bundle/ensure.mjs", "--entry", ..., "--outfile", ...]` | (a) | VS Code task; `node` on PATH required (u whether PATH has Node on a fresh Windows checkout: the dist Node is not on PATH) |
| 131 | 3125-3126 | Task 14 Step 6 | `git add package/src/macos/installer.ts .github/workflows/create-release.yml .github/workflows/actions/quarto-dev/action.yml tests/run-tests.sh tests/run-tests.ps1 .vscode/launch.json .vscode/tasks.json` ; `git commit -m "build: sign node; npm cache in CI; tests default to Node; VS Code launches the Node bundle"` | (a) | git |
| 132 | 3155 | Task 15 Step 2 (text for `dev-docs/upgrade-dependencies.md`) | `QUARTO_NODE_VERSION=v26.x.y ./configure.sh` | (c) | bash env prefix in a doc; Windows: set the variable then `configure.cmd` |
| 133 | 3157 | Task 15 Step 2 | `Run ./configure.sh / ./configure.cmd` | (a) | both platforms named |
| 134 | 3166-3167 | Task 15 Step 3 | `git add news/changelog-1.12.md dev-docs/upgrade-dependencies.md` ; `git commit -m "docs: changelog and upgrade notes for the Node runtime"` | (a) | git |
| 135 | 3184 | Task 16 Step 2 | `npm install --save-dev --save-exact acorn@8.14.0 acorn-walk@8.3.4 javascript-lp-solver@<current>` | (b) | `npm.cmd` under Git Bash |
| 136 | 3188 | Task 16 Step 3 | `package/dist/bin/quarto dev-call build-artifacts` | (b) | `quarto.cmd` |
| 137 | 3188 | Task 16 Step 3 | `git diff --stat src/resources/types` ; `git diff -w --stat` | (a) | git |
| 138 | 3192 | Task 16 Step 4 | `rg -n 'deno-ts-compile\|jsx-import-map' src package` | (a) | rg |
| 139 | 3198 | Task 16 Step 5 | `cd package/src && ./quarto-bld cycle-dependencies -o "$(mktemp -d)/cycles.json" && cd ../..` | (c) | as row 22 (`$(mktemp -d)` bash substitution, `/tmp` path read by a Windows binary) |
| 140 | 3199 | Task 16 Step 5 | `package/dist/bin/quarto run --dev package/src/common/import-report/find-bad-imports.ts src/quarto.ts` | (b) | `quarto.cmd` |
| 141 | 3200 | Task 16 Step 5 | `package/dist/bin/quarto run --dev package/src/common/import-report/report-bundle-async-cycles.ts` | (b) | `quarto.cmd` |
| 142 | 3201 | Task 16 Step 5 | `rg -n '"(info\|fmt\|check\|bundle)"' package/src src -g '*.ts' -g '!src/deno_ral/**'` | (a) | rg |
| 143 | 3202 | Task 16 Step 5 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent $(find smoke/ojs/ -name '*.test.ts')` | (b) | as row 105 |
| 144 | 3204 | Task 16 Step 5 | `ps` during the run shows no `deno` child | (c) | as row 4 |
| 145 | 3204 | Task 16 Step 5 | `rg -l '\.tsx?"' tests/docs/ojs tests/docs/smoke-all/ojs` | (a) | rg |
| 146 | 3209-3210 | Task 16 Step 6 | `git add package/src package.json package-lock.json src/core/schema/types-from-schema.ts src/command/dev-call/build-artifacts/cmd.ts src/execute/ojs/extract-resources.ts src/resources/types src/resources/conf news/changelog-1.12.md` ; `git commit -m "build: dev utilities off the Deno CLI (esbuild metafile graph; no deno fmt/check)"` | (a) | git |
| 147 | 3217 | Verification | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/node-dependency.test.ts unit/node-bundle-ensure.test.ts unit/runtime-env.test.ts unit/tools/deno-tool.test.ts smoke/env/launcher-env.test.ts` | (b) | as row 24; the Verification section says "Linux or macOS; the three-OS run is CI" |
| 148 | 3218 | Verification | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent $(find smoke/run/ -name '*.test.ts') smoke/project/project-prepost.test.ts smoke/build-ts-extension/build-ts-extension.test.ts smoke/create/create.test.ts $(find smoke/check/ -name '*.test.ts')` | (b) | as row 105 |
| 149 | 3219 | Verification | `quarto run --dev tools/check-runtime-boundary.ts` | (b) | `quarto.cmd` |
| 150 | 3220 | Verification | `npm run typecheck` | (b) | `npm.cmd` under Git Bash |
| 151 | 3221 | Verification | `rg -n 'execPath\(\)' src -g '*.ts' -g '!src/deno_ral/**'` | (a) | rg |
| 152 | 3222 | Verification | `rg -n 'execPath\(\)\|QUARTO_DENO\|architectureToolsPath\("deno"\)\|"deno"' package/src src -g '*.ts' -g '!src/deno_ral/**'` | (a) | rg; the double quotes inside a single-quoted pattern are sensitive in PowerShell |
| 153 | 3222 | Verification | `rg -n -i '\bdeno\b' package/scripts package/src/quarto-bld package/src/quarto-bld.cmd package/launcher/src configure.sh configure.cmd .github/workflows -g '!*.ts'` | (a) | rg |
| 154 | 3223 | Verification | `node --test "tools/node-bundle/*.test.mjs"` | (a) | Node expands the glob itself |
| 155 | 3224 | Verification | `cd package/src && ./quarto-bld prepare-dist --set-version 99.9.9 && ./quarto-bld validate-bundle && (cd ../pkg-working/bin && ./quarto check)` | (b) | `quarto-bld.cmd`, `quarto.cmd`; `( )` subshell is bash (use `Push-Location`/`&&` in PowerShell) |
| 156 | 3225 | Verification | `git clone … && ./configure.sh && package/dist/bin/quarto render tests/docs/smoke-all/2023/01/04/issue-3847.qmd` | (b) | `configure.cmd`, `quarto.cmd` |
| 157 | 3226 | Verification | `cd tests && rm -f ../package/dist/bin/quarto-dev.mjs && for i in 1 2 3 4; do QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/env/launcher-env.test.ts & done; wait` | (c) | bash `for`, background `&`, `wait` and env prefix; Git Bash may run it, but `run-tests.sh` needs `DENO_DIR=x86_64`; no PowerShell equivalent without `Start-Job`; plan limits Verification to Linux/macOS |
| 158 | 3226 | Verification | `ls ../package/dist/bin/*.tmp ../package/dist/bin/*.lock*` (finds nothing) | (b) | Git Bash glob; PowerShell `ls` with wildcard errors on no match; expected-empty check differs |
| 159 | 3227 | Verification (lock by hand) | `L=package/dist/bin/quarto-dev.mjs.lock; mkdir $L && echo "{\"pid\":$$,\"host\":\"$(hostname)\",\"nonce\":\"x\"}" > $L/owner && touch -d '10 minutes ago' $L` | (c) | plan restricts it to Linux/macOS; `$$` is the MSYS pid, not the Windows pid that `process.kill(pid, 0)` in Windows Node checks, so the "live owner" would read as dead |
| 160 | 3227 | Verification (lock by hand) | `touch src/core/path.ts && package/dist/bin/quarto --help` (in a second shell) | (c) | `touch` is Git Bash only; `quarto.cmd`; same liveness caveat as row 159 |
| 161 | 3227 | Verification (lock by hand) | `rm -r $L` | (b) | Git Bash `rm` |
| 162 | 3227 | Verification (lock by hand) | `mkdir $L && echo '{"pid":999999,"host":"'$(hostname)'","nonce":"x"}' > $L/owner && package/dist/bin/quarto --help` | (c) | bash quoting/substitution; `quarto.cmd`; Windows hostname via `os.hostname()` equals `hostname` output (u) |
| 163 | 3228 | Verification | push and let every workflow run; `workflow_dispatch` the nightly Deno matrix once; dispatch `create-release.yml` with `publish-release=false` | (a) | CI via `gh`; no local command quoted |
| 164 | 3233 | Review checklist | `grep -n QUARTO_DENO package/scripts package/launcher package/src/quarto-bld*` | (u) | directories without `-r` print "Is a directory"; `quarto-bld*` glob needs Git Bash; probably meant `grep -rn` |
| 165 | 3236 | Review checklist | `node tools/node-bundle/build-test.mjs --script tests/unit/ral/fixtures/exit-pipe-child.ts` | (a) | Node |
| 166 | 3236 | Review checklist | `node --test "tools/node-bundle/*.test.mjs"` | (a) | Node expands the glob |
| 167 | 3250 | Risks and rollback | a developer can delete `package/dist/bin/quarto-dev.mjs.lock` (manual lock removal) | (a) | file/dir deletion on any OS |

### Windows mentions
Prose, comments and instructions (quoted from the file; `section` is the nearest heading):

- L5 (header Goal): "the Windows `quarto.exe` launcher"
- L16 (Spec, Context): "the Rust `quarto.exe` built from `package/launcher/src/main.rs`"; "(the Windows MSI keeps working: the Rust launcher change is here, not in PR 34)"; launchers named `package/scripts/windows/quarto.cmd`
- L23 (Context): "So `configure.sh`, `configure.cmd`, `quarto-bld configure` and `prepare-dist` keep downloading the Deno version pinned in `configuration`"
- L53 (Assumptions): "PR 31: `tests/run-tests.sh`/`.ps1` honour `QUARTO_TEST_RUNTIME` (`deno` default, `node` opt-in)"
- L63 (Scope, In): "`configure.sh`, `configure.cmd`, `package/scripts/common/utils.sh`: download Node (and keep downloading Deno), `npm ci`, stop running `vendor.sh`/`vendor.cmd`"
- L65, L71, L75 (Scope, In): `quarto-bld.cmd`; "Launchers: `package/scripts/common/quarto`, `package/scripts/windows/quarto.cmd`, `package/launcher/src/main.rs`; `check-deno-in-use.cmd` becomes `check-node-in-use.cmd`"; "`tests/run-tests.sh`/`.ps1` default runtime"
- L91 (Interfaces): "Official Node.js release for Quarto's five platform/arch pairs (no Windows arm64, as with Deno)."
- L187 (Interfaces): "Launcher contract (dev shell launcher, installed shell launcher, `quarto.cmd`, `quarto.exe`):"
- L209, L212, L213 (Files): `package/scripts/windows/check-node-in-use.cmd` (renamed); modify list includes `configure.cmd`, `package/src/quarto-bld.cmd`, `package/scripts/windows/quarto.cmd`, `tests/run-tests.ps1`; delete `package/scripts/windows/check-deno-in-use.cmd`
- L217 (Acceptance criteria): "`./configure.sh` (Linux x64/arm64, macOS x64/arm64) and `./configure.cmd` (Windows x64) produce `package/dist/bin/tools/<arch>/node[.exe]` reporting the `configuration` version, `package/dist/bin/tools/<arch>/deno[.exe]` reporting `DENO`"
- L222 (Acceptance criteria): "`parity: OK` for Linux, macOS and Windows from the same run"
- L225 (Acceptance criteria): "`create-release.yml` dispatched with `publish-release=false` is green on all platforms, including the MSI and `test-smokes-built.yml` on the Windows zip."
- L263-264, L272, L274, L319, L323-324, L346, L360-361, L364, L376 (Task 1 test and `node.ts` code): `"windows"` as `NodeOs` value, `node-v26.12.0-win-x64.zip`, `node.exe`, `if (os === "windows") { await unzip(path, toolsDir); }`, `architectureDependencies["aarch64"]["windows"]` expected `undefined`
- L294 (Task 1 Step 3): "`store_win_configuration.bat` only reads `export ` lines, so `NODE` reaches `configure.cmd` as `!NODE!`."
- L658 (Task 2 Step 4, `build.mjs` comment): "Windows can refuse a rename while another process holds the target briefly: retry."
- L1034, L1037, L1038 (Task 3): heading "`configure.sh`, `configure.cmd`, `utils.sh`"; "Rename: `package/scripts/windows/check-deno-in-use.cmd` -> `check-node-in-use.cmd`"
- L1072 (Task 3 Step 2, `configure.sh` comment): "We can't put these overrides in the configuration file because it is parsed very naively on windows."
- L1193 (Task 3 Step 3): "**Step 3: `configure.cmd`**"
- L1206 (`configure.cmd` REM): "Windows: refuse to delete package/dist while node.exe or deno.exe runs from it"
- L1207: `call package\scripts\windows\check-node-in-use.cmd "!QUARTO_DIST_PATH!"`
- L1213: "Error: Could not delete package/dist/ directory. Close applications using it and run configure.cmd again."
- L1224-1225 (`configure.cmd` REM): "Windows 10 1803+ ships bsdtar as System32\tar; it extracts .zip. Absolute path in case Git for Windows' GNU tar is first on PATH."
- L1243: `SET "DENO_FILE=deno-x86_64-pc-windows-msvc.zip"`
- L1281, L1285, L1289: `CALL .\quarto-bld.cmd configure --log-level info`; `IF EXIST !QUARTO_BIN_PATH!\quarto.cmd (`; "ECHO NOTE: To use quarto please use quarto.cmd (located in this folder) or add the following path to your PATH"
- L1297: "the `vendor.cmd` call and `SET QUARTO_DENO_EXTRA_OPTIONS=--reload` are gone"
- L1299, L1302, L1303, L1307, L1319 (Task 3 Step 4 and 6): `check-node-in-use.cmd` rename, `git mv package/scripts/windows/check-deno-in-use.cmd ...`, `grep -n -i "deno" package/scripts/windows/check-node-in-use.cmd`
- L1326, L1363, L1399 (Task 4): `quarto-bld.cmd` (Modify, "Step 2: `quarto-bld.cmd`", `git add`)
- L1573, L1576 (Task 6, `build.mjs`): `const npm = process.platform === "win32" ? "npm.cmd" : "npm";` and `shell: process.platform === "win32"`
- L1621, L1625 (Task 6, `configure.ts`): "configure.sh/configure.cmd put the bundled Node's npm on PATH"; "Run ./configure.sh (or configure.cmd), which adds the bundled Node's npm to PATH."
- L1672 (Task 7, `devconfig.ts`): `const scriptPath = join(scriptDir, "quarto" + (isWindows ? ".cmd" : ""));`
- L1689 (Task 7 Step 1): "The Windows comment "because deno.exe is running" becomes "because node.exe is running"."
- L1906, L2109, L2228 (Task 9): Modify `package/scripts/windows/quarto.cmd` (whole file); "**Step 4: Rewrite `package/scripts/windows/quarto.cmd`**"; `git add ... package/scripts/windows/quarto.cmd ...`
- L2107: `grep -rn "QUARTO_ACTION\|QUARTO_NO_TYPECHECK" . --include=*.sh --include=*.ps1 --include=*.yml --include=*.md`
- L2136, L2144 (`quarto.cmd` body): "Quarto requires reconfiguration to install Node.js !NODE! ^(installed: !NODE_INSTALLED_VERSION!^). Please run configure.cmd." (and the Deno variant)
- L2209 (Task 9 Step 4): "The old `quarto.cmd` re-ran `configure.cmd` itself on a version change; running configure while `node.exe` from `package/dist` is executing this script is exactly what `check-node-in-use.cmd` refuses, so the new script prints the instruction instead (the same message `devconfig.ts` prints on Windows)."
- L2214 (Task 9 Step 5): "add `--disable-warning=UNDICI-EHPA` after `--use-env-proxy` in both launchers here, in `quarto-bld`/`quarto-bld.cmd` (Task 4) and in `main.rs` (Task 10)"
- L2326, L2343, L2345, L2356, L2359 (Task 10, `main.rs`): `#[cfg(target_os = "windows")] cmd.env("NO_COLOR", "TRUE");` ; "// tools/<arch> directory holding the runtimes. Windows builds are x64 only." ; `if cfg!(target_os = "windows") { return "x86_64"; }` ; `const NODE_BINARY: &str = "node.exe";`
- L2438, L2447, L2458, L2502, L2512, L2566, L2577 (Task 11, `deno-paths.ts` and `deno.ts`): `isWindows ? "deno.exe" : "deno"`, `isWindows ? "x86_64" : arch`, `if (platformOs === "windows") return "x86_64-pc-windows-msvc";`, `if (!isWindows) { chmodSync(installedDenoPath(), 0o755); }`, `return isWindows;`
- L2635 (Task 11 Step 6): `os: [ubuntu-latest, macos-latest, windows-latest]`
- L2841, L2909, L2969, L2972, L2982 (Task 13): Modify list with `package/scripts/windows/quarto.cmd`; "**Step 3: `quarto.cmd` branch**"; `#[cfg(target_os = "windows")] const DENO_BINARY: &str = "deno.exe";` and the `not(...)` variant; `git add ... package/scripts/windows/quarto.cmd ...`
- L3021, L3125 (Task 14 Files, Step 6): `tests/run-tests.ps1`
- L3041-3043 (Task 14 Step 2, "Windows signing"): "In `.github/workflows/create-release.yml` `sign-files` `paths` (line 398 area), add `./package/pkg-working/bin/tools/x86_64/node.exe` above the `deno.exe` line and keep `deno.exe`"
- L3059 (Task 14 Step 3): "On the first Windows run, check that the cache step reports a non-zero size; if not, change `path` to `${{ runner.os == 'Windows' && '~\AppData\Local\npm-cache' || '~/.npm' }}`."
- L3063 (Task 14 Step 4): "In `tests/run-tests.sh` and `tests/run-tests.ps1`, change PR 31's default of `QUARTO_TEST_RUNTIME` from `deno` to `node`."
- L3095 (Task 14 Step 5, `launch.json`): `"windows": { "runtimeExecutable": "${workspaceFolder}\\package\\dist\\bin\\tools\\x86_64\\node.exe" }`
- L3157 (Task 15 Step 2): "Run `./configure.sh` / `./configure.cmd`; the dev launcher also notices `package/dist/config/node-version` differs from `configuration`."
- L3222 (Verification): the second residue `rg` names `package/src/quarto-bld.cmd` and `configure.cmd`
- L3228 (Verification): "Dispatch `create-release.yml` with `publish-release=false`: all jobs green, including the Windows MSI and zip, and `test-smokes-built.yml` on the artifacts."
- L3235 (Review checklist): "Quarto's flags are identical in the shell launcher, `quarto.cmd`, `main.rs` and `quarto-bld*`"
- L3251 (Risks and rollback): "**Windows rename of the bundle while another `quarto` reads it.** libuv opens files with `FILE_SHARE_DELETE`, so the rename succeeds; `writeAtomic` retries 10 times on `EPERM`/`EBUSY` otherwise."

No match for `taskkill`.

### Windows mentions added by grep sweep at assembly
Lines matching `windows|win32|.cmd|.ps1|taskkill` (case-insensitive) that the extractor's list above did not cite. Quoted verbatim, trimmed to 300 characters; section is the nearest preceding heading.

- L89 (Interfaces): "type NodeOs = "windows" | "linux" | "darwin";"
- L376 (Task 1: Pin Node and add the dependency module): ""windows": release("windows", "x86_64"),"

## 34-installers-and-check.md

Extracted commands: 39 (a=13, b=14, c=10, d=0, u=2)

Shell assumed by the plan: bash throughout (`VAR=x cmd`, `$(...)`, `./run-tests.sh`, `&&`, `|`). Line numbers are the file's own (from Read).

| # | line | section | command | class | note |
|---|---|---|---|---|---|
| 1 | 26 | Spec / Context (macOS entitlements) | `curl -sS https://raw.githubusercontent.com/nodejs/node/<version>/tools/osx-entitlements.plist` | (a) | curl is available on Windows (System32 curl.exe / Git Bash) |
| 2 | 69 | Runtime environment contract, row 9 (manual) | `quarto add quarto-ext/fontawesome --no-prompt` (behind corporate TLS proxy) | (b) | quarto -> quarto.cmd; needs a machine with corporate root CA; not automatable |
| 3 | 70 | Runtime environment contract, row 10 (manual) | `quarto create project` then Ctrl-C at first prompt; `stty -a` shows `icanon` | (c) | `stty -a` has no PowerShell/cmd equivalent (Git Bash/mintty only); Windows Ctrl-C/raw-mode behaviour differs (exit code 130 is POSIX) |
| 4 | 72 | Runtime environment contract, row 12 (manual) | `installer -pkg ... -target /` on macOS 12 | (c) | macOS-only |
| 5 | 74 | Runtime environment contract, row 14 (manual) | `NODE_VERSION=26.12.0 ./configure.sh` | (b) | configure.sh -> configure.cmd, `set`/`$env:` for the var. Note: row text says the override is `QUARTO_NODE_VERSION` but the command uses `NODE_VERSION` (inconsistent in the plan) |
| 6 | 75 | Runtime environment contract, row 15 (manual) | `QUARTO_TS_PROFILE=1 quarto --help` | (b) | quarto -> quarto.cmd; env var via `$env:`/`set`; waits on debugger port 9229 |
| 7 | 123 | Acceptance criteria | dispatch `create-release.yml` with `publish-release=false`, `os=all` (+ `test-smokes-built.yml` on artifacts) | (u) | CI dispatch (gh workflow run); includes a Windows MSI job but nothing local to run; no exact command given |
| 8 | 124 | Acceptance criteria | `codesign -d --entitlements - <bin>/tools/aarch64/node` | (c) | macOS-only tool |
| 9 | 125 | Acceptance criteria | `dpkg-deb -f <deb> Depends`, `rpm -qpR <rpm>` | (c) | Linux-only tools |
| 10 | 126 | Acceptance criteria | `quarto check versions`; `quarto check --strict versions`; `tests/smoke/check/check-versions-no-mismatch.test.ts`; `quarto check --output out.json` | (b) | quarto -> quarto.cmd; test via run-tests.ps1 |
| 11 | 127 | Acceptance criteria | `tests/smoke/env/proxy.test.ts` passes on the three OSes | (b) | run-tests.ps1 or run-tests.sh with DENO_DIR; plan says the test runs on Windows |
| 12 | 128 | Acceptance criteria | `grep -n -i "rhel\|deno" .github/workflows/create-release.yml` | (a) | grep in Git Bash (or the Grep tool); POSIX BRE `\|` is fine |
| 13 | 140 | Task 1 Step 1 | `curl -sS "https://raw.githubusercontent.com/nodejs/node/$(. ./configuration && echo $NODE)/tools/osx-entitlements.plist"` | (a) | needs Git Bash (`$(. ./configuration ...)` sources a bash file); would fail in PowerShell |
| 14 | 206 | Task 1 Step 4 (yaml, `test-zip-mac` job) | `ents=$(codesign -d --entitlements - --xml "bin/tools/$arch/node" 2>/dev/null)` | (c) | macOS runner step only |
| 15 | 208 | Task 1 Step 4 (yaml) | `echo "$ents" \| grep -q "com.apple.security.cs.$key" \|\| { echo "::error::..."; exit 1; }` (loop at 205-211; also line 210 get-task-allow check) | (c) | part of macOS-only step; bash |
| 16 | 212 | Task 1 Step 4 (yaml) | `bin/tools/aarch64/node -e 'console.log("node runs under hardened runtime")'` | (c) | macOS arm64 only |
| 17 | 220 | Task 1 Step 5 | `git add package/scripts/macos/node-entitlements.plist package/src/macos/installer.ts .github/workflows/create-release.yml` + `git commit -m "macos: sign node ..."` (220-221) | (a) | git |
| 18 | 258 | Task 2 Step 2 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/linux-installer-config.test.ts` | (b) | bash `VAR=x cmd`; use run-tests.ps1 with `$env:QUARTO_TESTS_NO_CONFIG='true'`, or Git Bash with DENO_DIR=x86_64 |
| 19 | 285 | Task 2 Step 4 | same run-tests command as #18 (expects `2 passed`) | (b) | as #18 |
| 20 | 289 | Task 2 Step 4 | `git add package/src/linux/installer.ts package/scripts/macos/distribution.xml tests/unit/linux-installer-config.test.ts` + `git commit` (289-290) | (a) | git |
| 21 | 303 | Task 3 Step 1 | `grep -n "fail_on_unmatched" .github/workflows/create-release.yml` | (a) | Git Bash grep |
| 22 | 307 | Task 3 Step 1 | `grep -n -i "rhel" .github/workflows/create-release.yml` (expects no output) | (a) | Git Bash grep |
| 23 | 312 | Task 3 Step 2 | `git add .github/workflows/create-release.yml` + `git commit -m "ci: drop ..."` (312-313) | (a) | git |
| 24 | 355 | Task 4 Step 2 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/check-pinned-versions.test.ts` | (b) | as #18 |
| 25 | 389 | Task 4 Step 4 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/check-pinned-versions.test.ts smoke/check/check-versions-no-mismatch.test.ts smoke/check/check.test.ts` | (b) | as #18 |
| 26 | 390 | Task 4 Step 4 | `package/dist/bin/quarto check versions --output /tmp/c.json && node -e 'const d=require("/tmp/c.json").dependencies; ...'` | (c) | no extensionless quarto (-> quarto.cmd); `/tmp/c.json` is Git Bash %TEMP% but node.exe reads `/tmp/c.json` as `C:\tmp\c.json` (path mismatch); fix by using a scratch path |
| 27 | 394 | Task 4 Step 5 | `git add src/command/check/check.ts tests/unit/check-pinned-versions.test.ts` + `git commit` (394-395) | (a) | git |
| 28 | 466 | Task 5 Step 2 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/env/proxy.test.ts` | (b) | as #18 |
| 29 | 467 | Task 5 Step 2 | run once with `QUARTO_NODE_OPTIONS=--no-use-env-proxy` exported | (b) | `export` -> `$env:QUARTO_NODE_OPTIONS=...` |
| 30 | 471 | Task 5 Step 3 | `git add tests/smoke/env/proxy.test.ts` + `git commit` (471-472) | (a) | git |
| 31 | 491 | Task 6 Step 2 | `conda create -n t nodejs && dir %CONDA_PREFIX%\node.exe` | (b) | cmd.exe syntax (`%VAR%`), fails as-written in PowerShell/Git Bash; use `$env:CONDA_PREFIX`; assumes conda installed |
| 32 | 515 | Task 6 Step 4 | `git add package/conda-recipe` + `git commit` (515-516) | (a) | git |
| 33 | 530 | Task 7 Step 1 | `grep -n -i "deno\|entitlements" llm-docs/code-signing-installers.md` | (a) | Git Bash grep |
| 34 | 577 | Task 7 Step 4 | `git add llm-docs/code-signing-installers.md news/changelog-1.12.md dev-docs/runtime-migration/docs-updates.md` + `git commit` (577-578) | (a) | git |
| 35 | 584 | Verification | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/check-pinned-versions.test.ts unit/linux-installer-config.test.ts unit/runtime-env.test.ts $(find smoke/env/ -name '*.test.ts') $(find smoke/check/ -name '*.test.ts')` | (b) | `$(find ...)` bash; in PowerShell `find` is Windows find.exe, use Get-ChildItem; run-tests.ps1 |
| 36 | 585 | Verification | `quarto run --dev tools/check-runtime-boundary.ts` | (b) | quarto -> package/dist/bin/quarto.cmd |
| 37 | 586 | Verification | `cd package/src && ./quarto-bld prepare-dist --set-version 99.9.9 && ./quarto-bld make-installer-deb --set-version 99.9.9 && dpkg-deb -f ../out/quarto-99.9.9-linux-amd64.deb Depends` | (c) | deb build and dpkg-deb are Linux-only (prepare-dist part would be (b), ./quarto-bld -> quarto-bld.cmd, unverified) |
| 38 | 587 | Verification | dispatch `create-release.yml` with `publish-release=false`, `pre-release=true`, `os=all`; `test-smokes-built.yml` on artifacts | (u) | CI dispatch, no exact command; all-platform run includes Windows jobs |
| 39 | 588 | Verification | `codesign -d --entitlements - /Applications/quarto/bin/tools/aarch64/node` | (c) | macOS Apple Silicon only |

### Windows mentions

- L27 (Spec/Context, Platform minimums): "...Windows 10 / Server 2016 or newer. macOS x64 is Tier 2 ..." (full sentence: "Node 26 official binaries need macOS ≥ 13.5 ..., Linux glibc ≥ 2.28 and kernel ≥ 4.18 ..., and Windows 10 / Server 2016 or newer.")
- L72 (contract table row 12): "macOS 13.5, glibc 2.28, Windows 10"
- L76 (contract table row 16): "`NO_COLOR=TRUE` on Windows | set by launchers | unchanged | PR 33 | existing Windows smoke tests (colourless log assertions)"
- L77 (contract table row 17): "`Deno.kill`; `taskkill /T` on Windows | layer `killProcess` (negative pid: group on POSIX, `taskkill /T` tree on Windows) | PR 28 | `tests/unit/process-group.test.ts` (PR 14b: POSIX group cases on Linux/macOS, the `taskkill /T` case on Windows; see its "Windows coverage" table ...)"
- L123 (Acceptance criteria): "every job green, including notarization (`make-installer-mac`), the new "Verify node entitlements" step and the Windows MSI"
- L530 (Task 7 Step 1): "the Windows `sign-files` list has `node.exe` and `deno.exe`"
- L545 (Task 7 Step 2 changelog text): "...and Windows 10 or newer, the minimums of its bundled Node.js 26."
- L566 (Task 7 Step 3, docs-updates table): "Minimum macOS 13.5, glibc 2.28, Windows 10; no RHEL 7 tarball"
- L612 (Decisions needed 4): "...peak RSS, Windows included, with thresholds set in this PR before anything is measured."
- Also: L16 mentions `quarto.exe` ("the Rust launcher moved into PR 33 so the MSI never broke") and L491 (Task 6 Step 2) names `bld.bat`/`node.exe` conda Windows layout ("conda-forge's `nodejs` installs `node.exe` at the environment root, not in `Library\bin`"); these did not match the grep by keyword except as noted (L491 matched `.cmd`? no; listed for context only, not a grep hit).


## 35-user-scripts-compat.md

Extracted commands: 69 (a=32, b=34, c=1, d=0, u=2)

Shell assumed by the plan: bash (`VAR=x cmd`, `$(...)`, `./run-tests.sh`, `| wc -l`, `mkdir -p`, `(cd ... && ...)`). Several test-code snippets (Task 3 `.cmd` case) are Windows-aware, but the Run: lines are not. Commands embedded in TypeScript test fixtures (e.g. `Deno.Command(Deno.execPath(), ...)`) are test code, not executor commands, and are not listed.

| # | line | section | command | class | note |
|---|---|---|---|---|---|
| 1 | 18 | Spec / Context | `python3 -c "import json;print(len(json.load(open('src/resources/deno_std/run_import_map.json'))['imports']))"` | (b) | `python3` is not reliably on Windows PATH (Store alias); use `jq '.imports\|length'` or `uv run`; (the file is renamed to run-compat/deno/ later in the plan) |
| 2 | 35 | Spec / Assumptions (PR 00c) | `grep -rn QUARTO_RUN_DENO_NOTICE src` | (a) | Git Bash grep |
| 3 | 139 | Spec / Interfaces, Node command line | `<architectureToolsPath("node")> --require <share>/run-compat/register.cjs --enable-source-maps --enable-experimental-regexp-engine --stack-trace-limit=100 --use-system-ca --use-env-proxy --disable-warning=MODULE_TYPELESS_PACKAGE_JSON <script> <args...>` | (a) | spawned by `execProcess` with array args; node.exe resolved by architectureToolsPath |
| 4 | 143 | Spec / Interfaces | `--import <root>/tools/node-bundle/register-import-map.mjs` (added for `--dev`) | (u) | `--import` with an absolute Windows path (`C:\...`) may need a `file://` URL; same code at line 1902; untested on Windows |
| 5 | 185 | Acceptance criteria | `node tools/run-stdlib/build.mjs --outdir src/resources/run-stdlib --force` | (a) | cross-platform node script |
| 6 | 185 | Acceptance criteria | `rg -c '\bDeno\.' src/resources/run-stdlib` | (a) | rg available; single quotes fine in Git Bash/PowerShell |
| 7 | 185 | Acceptance criteria | `rg -n 'globalThis\s*\??\.\s*Deno\|\{\s*Deno\s*\}\s*=\s*globalThis' src/resources/run-stdlib` | (a) | rg; single quotes with `\|`/`\{` OK in both shells |
| 8 | 186 | Acceptance criteria (also 189) | `tests/unit/run-compat-hooks.test.ts` (R09 case, "script that imports `stdlib/fs`...", type-only-import/enum/commonjs cases) | (b) | run-tests.ps1 / run-tests.sh; R09 case skips symlink on Windows (`link = !isWindows`) |
| 9 | 187 | Acceptance criteria | `tests/smoke/run/run-script.test.ts`, `stdlib-run-version.test.ts`, `command-passthrough.test.ts` pass on Node | (b) | run-tests wrapper; `stdlib-run-version` is `ignore` on Windows (see line 2207) |
| 10 | 188 | Acceptance criteria | `tests/smoke/project/project-prepost.test.ts` passes with fixtures unchanged | (b) | run-tests wrapper |
| 11 | 191 | Acceptance criteria | `grep -cE '"(w\|a\|r\+\|w\+\|a\+\|wx)"' src/resources/run-compat/deno-members.cjs` → `0` | (a) | Git Bash grep; PowerShell would need Select-String |
| 12 | 191-192 | Acceptance criteria | `run-compat-shim.test.ts` (R05, R15 cases) | (b) | run-tests wrapper; `.cmd` case runs only on Windows; mode 0o600 check skipped on win32 |
| 13 | 193 | Acceptance criteria | `QUARTO_RUN_RUNTIME=deno quarto run x.ts` | (b) | quarto -> quarto.cmd; `$env:` for var; Deno tool at tools/x86_64/deno.exe |
| 14 | 194 | Acceptance criteria | `quarto run --dev tools/check-runtime-boundary.ts` | (b) | quarto -> quarto.cmd |
| 15 | 194 | Acceptance criteria | `rg -n '\bDeno\.' src/resources/scripts src/resources/tools` | (a) | rg |
| 16 | 195 | Acceptance criteria | `package/dist/bin/quarto dev-call make-ast-diagram <qmd>` | (b) | -> quarto.cmd; also `astpipeline.lua` runs `quarto run juice.ts` for the Typst render |
| 17 | 258 | Task 1 Step 2 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/run-stdlib-manifest.test.ts` | (b) | bash `VAR=x cmd`; run-tests.ps1 or Git Bash with DENO_DIR |
| 18 | 263 | Task 1 Step 3 | `mkdir -p src/resources/run-compat/deno tools/run-stdlib/stdlib` | (a) | Git Bash only (`mkdir -p` is not valid PowerShell; PowerShell `mkdir` creates parents anyway) |
| 19 | 264 | Task 1 Step 3 | `git mv src/resources/deno_std/run_import_map.json src/resources/run-compat/deno/run_import_map.json` | (a) | git |
| 20 | 354 | Task 1 Step 3 | `(cd tools/run-stdlib && npm install --no-audit --no-fund)` | (b) | subshell syntax is bash; use `npm.cmd` in Git Bash or Push-Location in PowerShell; also needs network to npm.jsr.io |
| 21 | 866 | Task 1 Step 4 (build.mjs code) | `execFileSync(npm, ["ci", "--no-audit", "--no-fund"], { cwd: here, stdio: "inherit", shell: process.platform === "win32" })` with `npm = "npm.cmd"` on win32 | (a) | plan code already handles Windows (`npm.cmd`, shell:true) |
| 22 | 1035 | Task 1 Step 5 (previewjs.ts code) | `execSync(execPath(), { args: [join(rootDir,"tools","run-stdlib","build.mjs"), "--outdir", outDir, ...extraArgs], ... })` | (u) | invokes whatever `execPath()` is (after PR 33 is Node or the Deno tool in build env); Windows behaviour of the packaging toolchain not stated |
| 23 | 1066 | Task 1 Step 6 | `node tools/run-stdlib/build.mjs --outdir src/resources/run-stdlib` | (a) | cross-platform |
| 24 | 1067 | Task 1 Step 6 | `ls src/resources/run-stdlib/*.js \| wc -l` | (a) | Git Bash only (PowerShell has no `wc`) |
| 25 | 1068 | Task 1 Step 6 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/run-stdlib-manifest.test.ts` | (b) | as #17 |
| 26 | 1073 | Task 1 Step 6 | `git add tools/run-stdlib src/resources/run-compat/deno-members.cjs ... tests/unit/run-stdlib-manifest.test.ts` + `git commit -m "run: build the 34 stdlib/* modules ..."` (1073-1074) | (a) | git |
| 27 | 1286 | Task 2 Step 2 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/run-compat-hooks.test.ts` | (b) | as #17 |
| 28 | 1432 | Task 2 Step 3 (register.cjs code) | `spawnSync(esbuild, ["--loader=ts","--format=esm","--target=node26","--sourcemap=inline", "--sourcefile=<file>","--tsconfig-raw={}","--log-level=error"], { input: source, ... windowsHide: true })` | (a) | args array, no shell quoting; esbuild.exe via QUARTO_RUN_ESBUILD |
| 29 | 1474 | Task 2 Step 4 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/run-compat-hooks.test.ts` (expects `9 passed`) | (b) | as #17 |
| 30 | 1479 | Task 2 Step 5 | `git add src/resources/run-compat/register.cjs tests/unit/run-compat-hooks.test.ts tools/check-runtime-boundary.ts` + `git commit` (1479-1481) | (a) | git |
| 31 | 1689 | Task 3 Step 2 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/run-compat-shim.test.ts` | (b) | as #17 |
| 32 | 1760 | Task 3 Step 4 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/run-compat-hooks.test.ts unit/run-compat-shim.test.ts` (expects `18 passed`) | (b) | as #17; `.cmd` case actually runs on Windows |
| 33 | 1763 | Task 3 Step 4 | `git add src/resources/run-compat/deno-shim.cjs tests/unit/run-compat-shim.test.ts tools/check-runtime-boundary.ts` + `git commit` (1763-1765) | (a) | git |
| 34 | 1843 | Task 4 Step 2 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/run-runtime-select.test.ts smoke/run/run-script-node.test.ts` | (b) | as #17 |
| 35 | 1949 | Task 4 Step 5 | `grep -n "QUARTO_RUN_DENO_NOTICE" src/core/run/*.ts` | (a) | Git Bash grep with glob |
| 36 | 1967 | Task 4 Step 6b | `grep -n QUARTO_RUNTIME package/scripts/common/quarto` | (a) | greps the bash launcher in the repo; works on Windows, but it only shows the POSIX launcher's branch (Windows launcher is a different file) |
| 37 | 1990 | Task 4 Step 6b (yaml, `dual-runtime-smoke` job) | `for rt in node deno; do cp -r tests/docs/project/prepost/script-runtime-deno "$RUNNER_TEMP/hook-$rt"; QUARTO_RUNTIME=deno QUARTO_RUN_RUNTIME=$rt package/dist/bin/quarto render "$RUNNER_TEMP/hook-$rt"; done` | (b) | CI bash step; on a Windows runner `package/dist/bin/quarto` -> quarto.cmd; matrix OS not stated |
| 38 | 1994 | Task 4 Step 6b (yaml) | `grep -qx 'Node.js' "$RUNNER_TEMP/hook-node/runtime.txt" && grep -qx 'Deno' "$RUNNER_TEMP/hook-deno/runtime.txt"` | (a) | Git Bash grep on a CI bash step |
| 39 | 1997 | Task 4 Step 6b | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/env/launcher-env.test.ts` | (b) | as #17 |
| 40 | 2002 | Task 4 Step 7 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/run-runtime-select.test.ts $(find smoke/run/ -name '*.test.ts')` (plus `smoke/env/launcher-env.test.ts`) | (b) | `$(find ...)` bash; PowerShell `find` is find.exe |
| 41 | 2003 | Task 4 Step 7 | `quarto run --dev tools/check-runtime-boundary.ts` | (b) | -> quarto.cmd |
| 42 | 2003 | Task 4 Step 7 | `rg -n 'execPath\(\)' src/core/run` (expects nothing) | (a) | rg |
| 43 | 2005 | Task 4 Step 7 | `git add src/core/run src/command/run/run.ts tests/unit/run-runtime-select.test.ts ... .github/workflows/test-node-bundle.yml` + `git commit` (2005-2007) | (a) | git |
| 44 | 2081 | Task 5 Step 1 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/project/project-script-runtime.test.ts` | (b) | as #17 |
| 45 | 2100 | Task 5 Step 2 | `package/dist/bin/quarto dev-call build-artifacts` | (b) | -> quarto.cmd |
| 46 | 2111 | Task 5 Step 4 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/project/project-script-runtime.test.ts smoke/project/project-prepost.test.ts` | (b) | as #17 |
| 47 | 2114 | Task 5 Step 4 | `git add src/project/types.ts src/resources/schema src/resources/types src/command/render/project.ts tests/docs/project/prepost/script-runtime-deno tests/smoke/project/project-script-runtime.test.ts` + `git commit` (2114-2116) | (a) | git |
| 48 | 2142 | Task 6 Step 2 | `execFileSync("quarto", ["pandoc", "-t", "json", markdownFile], { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 })` (new ast-diagram main.ts code) | (c) | on Windows `quarto` resolves to quarto.cmd; Node `execFileSync` without a shell refuses `.cmd` (CVE-2024-27980, EINVAL, the same issue the plan itself cites at line 20) |
| 49 | 2160 | Task 6 Step 3 | `git rm src/resources/scripts/check-usage.ts src/resources/scripts/check-usage.sh` | (a) | git |
| 50 | 2161 | Task 6 Step 3 | `rg -n 'check-usage' src package tests tools` (expects nothing) | (a) | rg |
| 51 | 2169 | Task 6 Step 4 | `rg -n '\bDeno\.' src/resources/scripts src/resources/tools` | (a) | rg |
| 52 | 2170 | Task 6 Step 4 | `package/dist/bin/quarto run --dev tools/check-runtime-boundary.ts --update-baseline` | (b) | -> quarto.cmd |
| 53 | 2171 | Task 6 Step 4 | `package/dist/bin/quarto dev-call make-ast-diagram tests/docs/minimal.qmd` | (b) | -> quarto.cmd |
| 54 | 2172 | Task 6 Step 4 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent $(rg -l 'typst' smoke/render \| tr '\n' ' ')` | (b) | `$(...)` and `tr` are bash; run-tests.ps1 + PowerShell join otherwise |
| 55 | 2174 | Task 6 Step 4 | `rg -l '<table' tests/docs/smoke-all/typst` | (a) | rg |
| 56 | 2178 | Task 6 Step 5 | `git add src/resources/scripts src/resources/tools/ast-diagram src/command/dev-call/make-ast-diagram/cmd.ts tools/runtime-boundary-baseline.json` + `git commit` (2178-2180) | (a) | git |
| 57 | 2201 | Task 7 Step 3 | `git add news/changelog-1.12.md dev-docs/runtime-migration/docs-updates.md` + `git commit` (2201-2202) | (a) | git |
| 58 | 2207 | Verification | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/run-stdlib-manifest.test.ts unit/run-compat-hooks.test.ts unit/run-compat-shim.test.ts unit/run-runtime-select.test.ts $(find smoke/run/ -name '*.test.ts') smoke/project/project-prepost.test.ts smoke/project/project-script-runtime.test.ts` | (b) | bash; plan states "all pass on Linux and macOS; on Windows `stdlib-run-version` stays `ignore`" |
| 59 | 2208 | Verification | `quarto run --dev tools/check-runtime-boundary.ts` (ratchet workflow green) | (b) | -> quarto.cmd |
| 60 | 2209 | Verification | `cd package/src && ./quarto-bld prepare-dist --set-version 99.9.9 && ls ../pkg-working/share/run-stdlib/*.js \| wc -l` (expects 34) | (b) | `./quarto-bld` -> quarto-bld.cmd (assumed, unverified); `ls \| wc -l` Git Bash only |
| 61 | 2209 | Verification | `ls ../pkg-working/share/run-compat` (lists deno, deno-members.cjs, deno-shim.cjs, register.cjs); `ls ../pkg-working/share/run-stdlib/deno-members.cjs` | (a) | Git Bash ls |
| 62 | 2210 | Verification | `cd package/pkg-working/bin && ./quarto run ../../../tests/docs/run/test-stdlib.ts` | (b) | ./quarto -> quarto.cmd in installed layout |
| 63 | 2212 | Verification | `rg -n 'execPath\(\)' src -g '*.ts' -g '!src/deno_ral/**'` | (a) | rg; single-quoted globs fine |
| 64 | 2213 | Verification | `grep -n QUARTO_RUNTIME package/scripts/common/quarto` | (a) | as #36 |
| 65 | 2213 | Verification | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/env/launcher-env.test.ts` | (b) | as #17 |
| 66 | 2213 | Verification | `QUARTO_RUNTIME=deno QUARTO_RUN_RUNTIME=node package/dist/bin/quarto render tests/docs/project/prepost/script-runtime-deno` (writes `Node.js` to `runtime.txt`), and same with `QUARTO_RUN_RUNTIME=deno` (writes `Deno`) | (b) | -> quarto.cmd, `$env:` for vars (two vars) |
| 67 | 2220 | Review checklist | `diff` the copies of `openFlagBits()` and `appendArg()`/`batchCommandLine()` against `src/deno_ral/fs.ts` and `src/deno_ral/batch-command-line.ts` | (a) | Git Bash diff; no exact command given |
| 68 | 2239 | Risks and rollback | measure `quarto run` on `tests/docs/run/test-stdlib.ts` before/after | (b) | -> quarto.cmd; no exact command given |
| 69 | 1475/1761 | Task 2 Step 4 / Task 3 Step 4 (expected output) | `.cmd` case "returns early off Windows and runs on the Windows CI matrix" (inside run-compat-shim.test.ts, `isWindows` guard) | (b) | not a README-listed PR; counted here as (b): the Windows `.cmd` shim test is the only Windows-specific executor-visible check in this plan (covered by row 32) |

### Windows mentions

(Test-fixture and shim implementation lines are grouped; prose sentences quoted.)

- L20 (Context): "...and spawned `.bat`/`.cmd` files directly, which Node refuses (CVE-2024-27980); it now copies PR 28's rules..." and "The corrected table and the Task 3 R05/R15 cases other than the Windows one were run on Node 26.12.0 and 22.22 while correcting the plan..."
- L27 (Context): "`@std/path@0.224` is plain JavaScript (`parse`, `format`, `common`, `SEPARATOR`, `win32`, `posix` complete)" (keyword hit is the `win32` export, not an OS statement)
- L169 (Interfaces, Child processes): "`env` merges over the inherited environment unless `clearEnv`, with the Windows case-insensitive override. On Windows a `.bat`/`.cmd` command runs through `cmd.exe /e:ON /v:OFF /d /c "<line>"` with `windowsVerbatimArguments`, the line from a copy of PR 28's `batchCommandLine()` ... an argument with CR, LF or NUL is an `EINVAL` error thrown by the method." Also "`windowsRawArguments` maps to Node's `windowsVerbatimArguments`".
- L192 (Acceptance criteria): "...a killed child reports `code: 143, signal: "SIGTERM"`, ... and on Windows a `.cmd` receives PR 28's BatBadBut vectors verbatim with nothing injected (`run-compat-shim.test.ts`, R15)."
- L506, L568, L575, L602, L606, L613, L623, L683-684, L778 (deno-members.cjs code, Task 1 Step 3): `process.platform === "win32"` / `kIsWindows` handling for file mode, `.bat/.cmd` via `cmd.exe`, `windowsVerbatimArguments`, case-insensitive env override, `windowsHide`, `os: ... "windows"`.
- L865-866 (build.mjs): `const npm = process.platform === "win32" ? "npm.cmd" : "npm";` and `shell: process.platform === "win32"`.
- L1098, L1248 (run-compat-hooks test): `import { isWindows }`; "`const link = !isWindows; // a symlink needs a privilege on Windows CI`".
- L1435 (register.cjs): `windowsHide: true` in `spawnSync(esbuild, ...)`.
- L1504 (shim test import), L1564 (`process.platform === "win32" || (statSync("e.bin").mode & 0o777) === 0o600`), L1622 (`process.platform === "win32" ? "143 SIGTERM" : st.code + " " + st.signal`), L1632 ("the Windows value of kill() is not measured; the guard above keeps the case to what Node documents (SIGTERM reported, forced exit)").
- L1638-1650 (batchCommandLine vector test): uses `C:\\t\\x.cmd` paths.
- L1653, L1656-1664 (shim test): "PR 28's forwarding .cmd and its BatBadBut vectors..." / `unitTest("shim - Deno.Command runs a .cmd through cmd.exe with the batch escaping (Windows)", ...)` with `if (!isWindows) return;`, writes `forward.cmd`.
- L1761 (Task 3 Step 4): "Expected: `18 passed` (the `.cmd` case returns early off Windows and runs on the Windows CI matrix, as PR 28's does)."
- L2142 (Task 6 Step 2): "`new URL(".", import.meta.url).pathname` -> `dirname(fileURLToPath(import.meta.url))` (`node:url`; the `pathname` form breaks on Windows drive letters)." (line also has the `execFileSync("quarto", ...)` instruction, see command #48.)
- L2207 (Verification): "all pass on Linux and macOS; on Windows `stdlib-run-version` stays `ignore` as today."
- L2220 (Review checklist): "...`.bat`/`.cmd` through `cmd.exe`; the R05 and R15 cases of `run-compat-shim.test.ts` pass, the `.cmd` one on Windows CI."
- L2237 (Risks): "A script passing `windowsRawArguments`, `uid` or `gid` gets Node's equivalents..."
- L2251 (Decisions, last paragraph): "R15 (piped Web Streams, inherited output from `spawn()`, a Windows `.cmd` through the shim): the three Task 3 R15 cases, the `.cmd` one on Windows CI."

### Windows mentions added by grep sweep at assembly
Lines matching `windows|win32|.cmd|.ps1|taskkill` (case-insensitive) that the extractor's list above did not cite. Quoted verbatim, trimmed to 300 characters; section is the nearest preceding heading.

- L566 (Task 1: The stdlib manifest, the member table and the builder (`tools/run-stdlib/`)): "// stdio defaults, .bat/.cmd through cmd.exe with batchCommandLine(), Web"
- L1622 (Task 3: The Deno shim): "console.log(st.success, process.platform === "win32" ? "143 SIGTERM" : st.code + " " + st.signal);"
- L1632 (Task 3: The Deno shim): "// the Windows value of kill() is not measured; the guard above keeps the case to what Node documents (SIGTERM reported, forced exit)"

## 36-build-ts-extension-node.md

Extracted commands: 40 (a=15, b=21, c=0, d=0, u=4)

Shell assumed by the plan: bash throughout (`VAR=x cmd`, `$(find ...)`, `> /dev/null`, `/tmp`, `printf`, `cp -r`). No PowerShell variants given. Line numbers are those of the Read listing of the file.

| # | line | section | command | class | note |
|---|---|---|---|---|---|
| 1 | 302, 779 | Task 1 Step 2 / Step 5 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/build-ts-extension-args.test.ts` | b | run-tests.ps1 equivalent with `$env:QUARTO_TESTS_NO_CONFIG='true'`, or Git Bash (DENO_DIR note applies if the runner still reads it) |
| 2 | 784 | Task 1 Step 6 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/build-ts-extension/build-ts-extension.test.ts && git diff --stat main -- smoke/build-ts-extension` | b | same adaptation; git part is fine |
| 3 | 785 | Task 1 Step 6 | `node tools/run-stdlib/build.mjs --outdir src/resources/extension-build/node_modules --manifest src/resources/extension-build/node-packages.json --modules-from node_modules --packages` | u | node is cross-platform, but the builder (PR 35) bundles with esbuild and writes packages; Windows behaviour of `--packages` untested |
| 4 | 785 | Task 1 Step 6 | `ls src/resources/extension-build/node_modules/@quarto` | a | plain ls (Git Bash or PowerShell alias) |
| 5 | 785 | Task 1 Step 6 | "print `NODE_PATH` in `bundle()` under `--log-level debug`" (no concrete command) | u | prose instruction, not a runnable command |
| 6 | 611-616 | Task 1 Step 4 (code in cmd.ts) | `esbuildCommand(esbuildArgs(...), "", cwd(), { NODE_PATH: packageDirs.join(delimiter) })` runs `bin/tools/<arch>/esbuild` with `--alias:path=@quarto/std-path ...` | u | `delimiter` gives `;` on Windows (good); esbuild NODE_PATH resolution and `esbuild.exe` lookup via `architectureToolsPath("esbuild")` on Windows not shown |
| 7 | 663 | Task 1 Step 4 (code in cmd.ts) | `execProcess({ cmd: architectureToolsPath("node"), args: [tsc, "--noEmit", "-p", tsconfig], cwd: cwd() })` | a | spawns node.exe with the tsc JS entry directly, no shell shim |
| 8 | 790-791 | Task 1 Step 7 | `git add src/command/call/build-ts-extension/cmd.ts src/core/esbuild.ts tests/unit/build-ts-extension-args.test.ts` / `git commit -m "..."` | a | git |
| 9 | 805 | Task 2 Step 1 | `git rm src/resources/extension-build/deno.json` | a | git |
| 10 | 936 | Task 2 Step 2 | `cd package/src && ./quarto-bld prepare-dist --set-version 99.9.9 > /dev/null && ls ../pkg-working/share/extension-build ../pkg-working/share/extension-build/node_modules/@jsr ../pkg-working/share/extension-build/node_modules/@quarto/*` | b | `./quarto-bld` -> `quarto-bld.cmd`; `> /dev/null` -> `> $null`; `@quarto/*` glob only expands in bash |
| 11 | 937 | Task 2 Step 2 | `rg -c '\bDeno\.' ../pkg-working/share/extension-build/node_modules/@quarto` | a | rg is cross-platform; prints nothing and exits 1 on no match (expected) |
| 12 | 939 | Task 2 Step 2 | `cp -r tests/smoke/build-ts-extension /tmp/btx && cd /tmp/btx && ../path/to/package/pkg-working/bin/quarto call build-ts-extension && grep -c "function extname" _extensions/test-engine/test-engine.js` | b | `pkg-working/bin/quarto` -> `quarto.cmd`; `/tmp` is Git-Bash-only (use a temp dir); placeholder path `../path/to/` |
| 13 | 987 | Task 2 Step 2b | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/build-ts-extension-std/build-ts-extension-std.test.ts` | b | same as #1 |
| 14 | 984-985 | Task 2 Step 2b (test body) | test runs `quarto call build-ts-extension` in each fixture dir, then `rg -c '\bDeno\.' <bundle>` | b | quarto -> quarto.cmd inside the test harness (harness-owned); rg is fine |
| 15 | 993-994 | Task 2 Step 3 | `git add src/resources/extension-build package/src/common/prepare-dist.ts package/src/common/configure.ts .gitignore tests/smoke/build-ts-extension-std` / `git commit -m "..."` | a | git |
| 16 | 1029 | Task 3 Step 1 | `grep -n "tests/docs" tools/check-runtime-boundary.ts` | a | grep in Git Bash (or rg) |
| 17 | 1093 | Task 3 Step 1 | `grep -n "export function testRender" tests/smoke/render/render.ts` | a | grep |
| 18 | 1097 | Task 3 Step 2 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/engine-deno-detection.test.ts smoke/engine/engine-deno-warning.test.ts` | b | same as #1 |
| 19 | 1161 | Task 3 Step 4 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/engine-deno-detection.test.ts $(find smoke/engine/ -name '*.test.ts') smoke/check/check-in-project.test.ts` | b | `$(find ...)` is bash; in PowerShell use Get-ChildItem; Git Bash PATH finds GNU find |
| 20 | 1165-1166 | Task 3 Step 4 | `git add src/execute/engine.ts tests/unit/engine-deno-detection.test.ts tests/smoke/engine/engine-deno-warning.test.ts tests/docs/engine/deno-api-engine` / `git commit` | a | git |
| 21 | 1177 | Task 4 Step 1 | `grep -n "Deno\." src/resources/create/extensions/engine/src/qstart-filesafename-qend.ejs.ts` | a | grep |
| 22 | 1177 | Task 4 Step 1 | `quarto run --dev tools/check-runtime-boundary.ts --update-baseline` | b | quarto -> quarto.cmd (dev launcher `package/dist/bin/quarto.cmd`) |
| 23 | 1185 | Task 4 Step 2 (README text) | `quarto call build-ts-extension` | b | user-facing README text; quarto.cmd if not on PATH |
| 24 | 1201-1203 | Task 4 Step 2 (README text) | `quarto call build-ts-extension --init-config` / `npm install` / `quarto call build-ts-extension --check` | b | quarto.cmd; `npm` -> `npm.cmd` under Git Bash |
| 25 | 1209 | Task 4 Step 3 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/create/create.test.ts` | b | same as #1 |
| 26 | 1213-1214 | Task 4 Step 3 | `git add src/resources/create/extensions/engine` / `git commit` | a | git |
| 27 | 1252 | Task 5 Step 1 | `cd packages/quarto-types && npm run build` | b | `npm.cmd` under Git Bash |
| 28 | 1267-1268 | Task 5 Step 5 | `git add packages/quarto-types llm-docs/quarto-api.md news/changelog-1.12.md dev-docs/runtime-migration/docs-updates.md` / `git commit` | a | git |
| 29 | 1273 | Verification | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/build-ts-extension-args.test.ts unit/engine-deno-detection.test.ts $(find smoke/build-ts-extension/ -name '*.test.ts') smoke/create/create.test.ts $(find smoke/engine/ -name '*.test.ts') smoke/inspect/inspect-extensions.test.ts unit/extension/filter-bundled-engines.test.ts smoke/check/check-in-project.test.ts` | b | `$(find ...)` bash; run-tests.ps1 + Get-ChildItem in PowerShell |
| 30 | 1274 | Verification | `git diff main -- tests/smoke/build-ts-extension` | a | git |
| 31 | 1275 | Verification | `grep -rn "deno bundle\|deno check\|requireDenoToolBinary\|architectureToolsPath(\"deno\")" src/command/call/build-ts-extension` | a | grep |
| 32 | 1276 | Verification (Manual) | `quarto create extension engine` (name `demo`), `quarto call build-ts-extension`, render the example | b | quarto.cmd; `create` is interactive (may need a non-interactive form) |
| 33 | 1276 | Verification (Manual) | `--init-config && npm install && quarto call build-ts-extension --check` | b | quarto.cmd, npm.cmd |
| 34 | 1276 | Verification (Manual) | `rm package.json tsconfig.json && printf '{"bundle":{"entryPoint":"src/demo.ts"}}' > deno.json && quarto call build-ts-extension` | b | bash-only `rm`/`printf` with quotes; Git Bash works, PowerShell needs Set-Content and different quoting |
| 35 | 1276 | Verification (Manual) | `printf '{"name":"demo","private":true}' > package.json && quarto call build-ts-extension` then `quarto call build-ts-extension --init-config && quarto call build-ts-extension` | b | same bash-only printf/quoting |
| 36 | 1277 | Verification | `quarto run --dev tools/check-runtime-boundary.ts` | b | quarto.cmd |
| 37 | 1278 | Verification | PR 25 Task 7 step 2's last two `rg` commands (not quoted in this file) | u | commands live in another plan |
| 38 | 154 | Acceptance criteria | `cd tests/smoke/build-ts-extension && quarto call build-ts-extension` | b | quarto.cmd; asserts bundle contains `function extname` |
| 39 | 154, 160 | Acceptance criteria | `git diff main -- tests/smoke/build-ts-extension` (empty); `rg -n 'execPath\(\)' src/command/call/build-ts-extension` (nothing) | a | git, rg |
| 40 | 155, 160, 163 | Acceptance criteria | `package/pkg-working/bin/quarto call build-ts-extension`; `quarto call build-ts-extension --init-config`, `npm install`, `--check`; `rg -c '\bDeno\.' share/extension-build/node_modules/@quarto` | b | quarto.cmd, npm.cmd; rg fine |

### Windows mentions

Keyword hits (case-insensitive) in this file are not about the OS:
- L214 (Task 1 Step 1 test): `assertThrows(() => importMapAliases({ "p": "jsr:@std/path@1/posix", "p/win32": "jsr:@std/path@1/win32" }), ...)` - `win32` is a `@std/path` subpath.
- L239 (Task 1 Step 1 test): `{ "path/posix": "jsr:@std/path@1.0.8/posix", "win": "jsr:/@std/path@^2/windows" }` - `windows` is a `@std/path` subpath.

Windows-relevant text without the keywords (for phase 2):
- L33 (Decisions, Import map on esbuild): "followed by the repository's `node_modules` (the `@jsr/` packages), joined with the platform's path delimiter."
- L592 (Task 1 Step 4 `bundle()`): `!specified.includes("/") && !specified.includes("\\")` - handles both separators.
- L675 (Task 1 Step 4 `tsconfigPaths()`): `const fwd = (p: string) => p.replaceAll("\\", "/");` - forward-slashes paths written into tsconfig.

---


## 37-ci-switch-and-deno-removal.md

Extracted commands: 66 (a=29, b=16, c=4, d=0, u=17)

Shell assumed: bash (CI `ubuntu-latest` style); Git Bash needed locally. The plan writes `deno` where Windows has `deno.exe` in several checks.

| # | line | section | command | class | note |
|---|---|---|---|---|---|
| 1 | 31 | Context (Dual-runtime window) | `rg -n 'execPath\(\)' src -g '*.ts' -g '!src/deno_ral/**'` (keeps printing nothing) | a | rg cross-platform |
| 2 | 57 | Context (deno_ral directory) | `rg -c deno_ral -g '*.ts' src tests package tools` | a | rg |
| 3 | 65 | Context (CI graph) | `tests/run-parallel-tests.sh -n=20 --json-for-ci --timing-file=timing-for-ci.txt` | u | run on `windows-latest` as well per the table; no .ps1 equivalent named; CI runner shell is Git Bash |
| 4 | 68 | Context (CI graph) | `diff -r -x .quarto` (render-parity), `quarto-bld prepare-dist --set-version 99.9.9`, `package/pkg-working/bin/quarto` | u | CI step on windows-latest; `diff` and bin/quarto vs quarto.cmd behaviour on Windows runner unverified |
| 5 | 77 | Context (Assumptions) | `grep -n QUARTO_RUNTIME package/scripts/common/quarto` | a | grep |
| 6 | 105 | Acceptance criteria | `./configure.sh` on a clean clone; `ls package/dist/bin/tools/*/deno package/dist/bin/tools/deno` fails | c | `configure.sh` -> `configure.cmd`; the check names `deno`, Windows binary is `deno.exe`, so the `ls` fails vacuously on Windows (and the Windows tools dir may differ) |
| 7 | 106 | Acceptance criteria | `QUARTO_RUN_RUNTIME=deno quarto run x.ts` (expects "Running a TypeScript script needs Deno, which is not installed. Run 'quarto install deno'.") | b | bash `VAR=x cmd` -> `$env:QUARTO_RUN_RUNTIME='deno'; quarto.cmd run x.ts` |
| 8 | 106 | Acceptance criteria | `quarto install deno` | b | quarto.cmd |
| 9 | 107 | Acceptance criteria | `grep -rn "QUARTO_RUNTIME" package src tests .github` | a | grep |
| 10 | 108 | Acceptance criteria | `grep -rn -i "deno" .github` | a | grep |
| 11 | 109 | Acceptance criteria | `workflow_dispatch` run green on three OSes (`node-macos`, `render-parity`) | u | CI dispatch; needs Chris's approval to fire |
| 12 | 110 | Acceptance criteria | `quarto run --dev tools/check-runtime-boundary.ts` ; `rg -n '\bDeno\.' tools -g '*.ts'` | b | quarto.cmd; rg fine |
| 13 | 111 | Acceptance criteria | "residue inspection of PR 25 Task 7 step 2 (its last two `rg` commands ...)" | u | commands are in another plan |
| 14 | 112 | Acceptance criteria | `ls src/resources/deno_std package/scripts/deno_std package/scripts/vendoring deno.jsonc deno.lock src/dev_import_map.json` all fail | a | plain ls on non-existent paths (Git Bash) |
| 15 | 113 | Acceptance criteria | `grep -rn "Deno" .claude dev-docs llm-docs tests/README.md \| grep -v "dev-docs/runtime-migration\|QUARTO_DENO\|quarto install deno\|QUARTO_RUN_RUNTIME\|script-runtime\|ran on Deno\|Deno years\|historical name"` | a | grep pipeline in Git Bash |
| 16 | 114 | Acceptance criteria | `create-release.yml` dispatched with `publish-release=false` | u | CI dispatch (`gh workflow run`); needs Chris's approval; also memory: pass every input explicitly |
| 17 | 124 | Task 1 Step 1 | `grep -rln DENO_ARCH_DIR . --include=*.sh --include=*.cmd --include=*.bat --include=quarto-bld \| xargs sed -i 's/DENO_ARCH_DIR/ARCH_DIR/g'` | b | bash-only (grep/xargs/sed) works in Git Bash; searches `.` incl. node_modules; sed -i on .cmd/.bat files may touch line endings |
| 18 | 132-139 | Task 1 Step 3 (test code) | `quarto(["--help"], { QUARTO_RUNTIME: "deno", QUARTO_LAUNCHER_DEBUG: "1" })` and regex `/deno(\.exe)?"? run /` | u | test helper; regex does allow `.exe`; whether `quarto.cmd` honours QUARTO_LAUNCHER_DEBUG is not shown |
| 19 | 153 | Task 1 Step 5 | `rm -rf package/dist && ./configure.sh > /dev/null && ls package/dist/bin/tools/*/ && ! ls package/dist/bin/tools/*/deno 2>/dev/null` | c | `./configure.sh` -> `configure.cmd`; `! ls .../deno` checks `deno` not `deno.exe` (vacuous pass on Windows); `rm -rf package/dist` is destructive (dry run first per user rules); bash `!`/`2>/dev/null` |
| 20 | 154 | Task 1 Step 5 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent $(find smoke/env/ -name '*.test.ts') $(find smoke/run/ -name '*.test.ts') unit/tools/deno-tool.test.ts` | b | run-tests.ps1 + Get-ChildItem for `$(find)`; env var via `$env:` |
| 21 | 156 | Task 1 Step 5 | `package/dist/bin/quarto install deno --no-prompt` | b | `package/dist/bin/quarto.cmd` |
| 22 | 159-160 | Task 1 Step 5 | `git add -A configure.sh configure.cmd package src/core/devconfig.ts src/tools/impl/deno-paths.ts configuration tests/smoke/env/launcher-env.test.ts .github/workflows/create-release.yml` / `git commit -m "build: stop downloading ..."` | a | git (`git add -A` with paths) |
| 23 | 169 | Task 2 Step 1 | `grep -rn "\bDeno\b\|runtime().name === \"deno\"" src/deno_ral` | a | grep |
| 24 | 183 | Task 2 Step 1 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent $(find unit/ral/ -name '*.test.ts')` | b | as #20 |
| 25 | 192 | Task 2 Step 2 | `quarto run --dev tools/check-runtime-boundary.ts --update-baseline` | b | quarto.cmd |
| 26 | 193 | Task 2 Step 2 | `cat tools/runtime-boundary-baseline.json` | a | cat in Git Bash / `Get-Content` alias in PowerShell |
| 27 | 200-201 | Task 2 Step 3 | `git add -A src/deno_ral src/core/deno/debug.ts tools/check-runtime-boundary.ts tools/runtime-boundary-baseline.json` / `git commit -m "runtime: remove ..."` | a | git |
| 28 | 210 | Task 3 Step 1 | CI: `quarto-bld prepare-dist --set-version 99.9.9`, render with `package/dist/bin/quarto` and `package/pkg-working/bin/quarto` (render-parity job on 3 OSes) | u | workflow step content, run on windows-latest |
| 29 | 211 | Task 3 Step 1 | `git rm` `test-smokes-parallel.yml` (prose) | a | git |
| 30 | 216 | Task 3 Step 1 | `grep -rn -i "deno\|QUARTO_TEST_RUNTIME" .github \| grep -v "install-deno-tool\|quarto install deno\|quarto uninstall deno\|Deno.version"` | a | grep pipeline |
| 31 | 217 | Task 3 Step 1 | `python3 -c "import yaml; w=yaml.safe_load(open('.github/workflows/test-node-bundle.yml')); print(sorted(w['on']), sorted(w['jobs']))"` | b | `python3` may be absent or the Store stub on Windows and needs PyYAML: `uv run --with pyyaml python -c "..."` (user's rule: uv for Python one-offs) |
| 32 | 217 | Task 3 Step 1 | `grep -c "if: github.event_name == 'schedule' \|\| github.event_name == 'workflow_dispatch'" .github/workflows/test-node-bundle.yml` | a | grep |
| 33 | 223 | Task 3 Step 2 | `grep -n -i "deno\|test-conf" tests/run-tests.sh tests/run-tests.ps1` (no output) | a | grep |
| 34 | 223 | Task 3 Step 2 | `bash tests/run-tests-agent-flag.test.sh` and sibling `tests/run-tests-*.test.sh` | u | bash scripts; fine in Git Bash only; PowerShell's `bash.exe` is WSL (memory note) |
| 35 | 228-229 | Task 3 Step 3 | `git add -A .github tests/run-tests.sh tests/run-tests.ps1 tests/binary-mode-strip-env.txt configure.sh configure.cmd` / `git commit -m "ci: remove ..."` | a | git |
| 36 | 239 | Task 4 Step 1 | `git rm -r package/scripts/vendoring package/scripts/deno_std src/resources/deno_std` | a | git |
| 37 | 240 | Task 4 Step 1 | `git rm src/vendor_deps.ts tests/test-deps.ts deno.jsonc deno.lock package/src/common/create-deno-config.ts package/src/common/deno-meta.json package/src/common/create-dev-import-map.ts src/dev_import_map.json src/core/deno/import-maps.ts src/tools/impl/deno-jupyter.ts tests/test-conf.json dev-docs/update-deno_jsonc.md` | a | git |
| 38 | 241 | Task 4 Step 1 | `grep -rn "import-maps.ts\|create-dev-import-map\|create-deno-config\|deno-meta\|vendor_deps\|test-deps.ts\|deno_std\|vendoring/\|deno.jsonc\|deno.lock" . --include=*.ts --include=*.mjs --include=*.sh --include=*.cmd --include=*.bat --include=*.yml --include=*.json \| grep -v "node_modules\|dev-docs/runtime-migration"` | a | grep pipeline over `.` (slow but fine) |
| 39 | 255 | Task 4 Step 4 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent $(find smoke/run/ -name '*.test.ts') $(find unit/ -name '*.test.ts')` | b | as #20 |
| 40 | 255 | Task 4 Step 4 | `cd package/src && ./quarto-bld prepare-dist --set-version 99.9.9 && ls ../pkg-working/share \| grep -c deno_std` (prints `0`) | b | `quarto-bld.cmd`; `grep -c` is Git Bash |
| 41 | 258-259 | Task 4 Step 4 | `git add -A .gitignore quarto-cli.code-workspace .vscode/settings.json src/core/run/deno.ts package/src/bld.ts` / `git commit -m "chore: remove ..."` | a | git |
| 42 | 269 | Task 5 Step 1 | `git mv dev-docs/ci-deno-caching.md dev-docs/ci-npm-caching.md` | a | git |
| 43 | 302, 305, 309-310 | Task 5 Step 2 (text of the new doc) | `npm install --save-exact <package>@<version>`; `node tools/node-bundle/check-deps.mjs`; `node tools/typecheck/gen-tsconfig-paths.mjs`; `npm run typecheck`; `package/dist/bin/quarto --help` | b | doc content for future devs; npm.cmd under Git Bash; quarto -> quarto.cmd; node scripts cross-platform |
| 44 | 319 | Task 5 Step 3 | `git mv .claude/rules/typescript/deno-essentials.md .claude/rules/typescript/essentials.md` and `git mv .claude/rules/typescript/deno-ral.md .claude/rules/typescript/runtime-layer.md`; `grep -rn "deno-essentials\|deno-ral.md" .claude dev-docs llm-docs` | a | git, grep |
| 45 | 344, 350 | Task 5 Step 3 / Step 4 | `grep -n -i deno` over `.claude/skills/quarto-preview-test/SKILL.md`, `references/embedded-viewer.md`, and the five `llm-docs` files | a | grep |
| 46 | 351 | Task 5 Step 4 | run `tests/unit/tools/deno-tool.test.ts` and the `test-install.yml` job (Deno tool upgrade procedure) | u | test runner invocation unspecified; test-install is a CI job |
| 47 | 353 | Task 5 Step 4 | `grep -rn "Deno" .claude dev-docs llm-docs tests/README.md \| grep -v "dev-docs/runtime-migration\|QUARTO_DENO\|quarto install deno\|QUARTO_RUN_RUNTIME\|script-runtime\|ran on Deno\|Deno years\|historical name\|Deno tool"` | a | grep pipeline |
| 48 | 359-360 | Task 5 Step 5 | `git add -A .claude dev-docs llm-docs tests/README.md` / `git commit -m "docs: describe the Node toolchain; Deno is an optional tool"` | a | git |
| 49 | 379-380 | Task 6 Step 1 (checklist block) | `C=<commit>` ; `FILES=$(git diff --name-only "$C^" "$C" -- '*.ts')` | c | bash-only variable/command-substitution; no PowerShell equivalent as written (Git Bash works) |
| 50 | 381-382 | Task 6 Step 1 | `git worktree add --detach /tmp/bp-old "$C^"` ; `git worktree add --detach /tmp/bp-new "$C"` | u | `/tmp` under Git Bash vs Windows path (`%TEMP%` vs `C:\tmp`); git itself is MSYS-aware |
| 51 | 383-388 | Task 6 Step 1 | `for wt in /tmp/bp-old /tmp/bp-new; do package/dist/bin/quarto run --dev tools/codemod-deno-ral.ts --reverse --rules fs,temp,env,process,platform --ral-dir "$wt/src/deno_ral" $(for f in $FILES; do printf -- '--file %s ' "$wt/$f"; done); git -C "$wt" commit -qam "reverse codemod"; done` | c | bash loop/printf; quarto -> quarto.cmd; `/tmp/...` paths passed to a Windows Node process (MSYS arg conversion may or may not apply to values inside `$(...)`); runs on a v1.10 worktree which may predate the Windows launcher |
| 52 | 389 | Task 6 Step 1 | `git diff "$(git -C /tmp/bp-old rev-parse HEAD)" "$(git -C /tmp/bp-new rev-parse HEAD)" -- $FILES > /tmp/bp.patch` | u | /tmp redirect in Git Bash; `$FILES` word-splitting is bash |
| 53 | 390 | Task 6 Step 1 | `git worktree remove --force /tmp/bp-old && git worktree remove --force /tmp/bp-new` | u | destructive `--force` (needs dry-run/approval); /tmp path |
| 54 | 391 | Task 6 Step 1 | `git apply -3 /tmp/bp.patch` | u | /tmp path; line endings of the patch under autocrlf |
| 55 | 405 | Task 6 Step 2 | `git log --oneline main -- src/core/path.ts \| head` | a | git, head available in Git Bash |
| 56 | 405 | Task 6 Step 2 | `./configure.sh && package/dist/bin/quarto --help` on a `v1.10` scratch branch | b | configure.cmd and quarto.cmd; the v1.10 launcher runs `deno run --check` |
| 57 | 410-411 | Task 6 Step 3 | `git add dev-docs/checklist-backport-a-pr.md` / `git commit -m "docs: backport protocol ..."` | a | git |
| 58 | 422 | Task 7 Step 1 | `git add news && git commit -m "docs: changelog for Deno no longer bundled"` | a | git |
| 59 | 427 | Verification | `./configure.sh` from a clean clone, `package/dist/bin/quarto check`, a render, `cd package/src && ./quarto-bld prepare-dist --set-version 99.9.9 && ./quarto-bld validate-bundle` | b | configure.cmd, quarto.cmd, quarto-bld.cmd |
| 60 | 428 | Verification | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent $(find unit/ -name '*.test.ts') $(find smoke/run/ -name '*.test.ts') $(find smoke/check/ -name '*.test.ts') $(find smoke/env/ -name '*.test.ts') $(find smoke/build-ts-extension/ -name '*.test.ts')` | b | as #20 |
| 61 | 429 | Verification | `quarto run --dev tools/check-runtime-boundary.ts` | b | quarto.cmd |
| 62 | 430 | Verification | `create-release.yml` dispatched once (`publish-release=false`) | u | CI dispatch, needs approval |
| 63 | 435 | Review checklist | `rg -n 'execPath\(\)' src -g '*.ts' -g '!src/deno_ral/**'` prints nothing | a | rg |
| 64 | 111 | Acceptance criteria | `test-install.yml` `install-deno-tool` job and `configure.cmd`'s `check-node-in-use` line as allowed residue | u | statement of expected output, not a command; ties to Windows `check-node-in-use.cmd` |
| 65 | 124 | Task 1 Step 1 | edit `configure.sh`/`configure.cmd` (delete bootstrap blocks, `deno-version` write, `deno_std` download call) | u | file edits to .cmd; verify via configure.cmd run (see #19) |
| 66 | 132 | Task 1 Step 3 | edit `package/scripts/common/quarto` and `quarto.cmd` (`for RT in NODE DENO` loop, `deno-version` block) | u | launcher edits; Windows launcher behaviour only exercised by running quarto.cmd |

### Windows mentions

- L23 (Context, Deno download and use): "`configure.sh`, `configure.cmd` (PR 33's "Bootstrapping Deno (tool)" blocks, the `tools/deno` symlink, `deno_std/download.sh`/`.bat` calls), `package/src/quarto-bld`/`.cmd` (`QUARTO_DENO` export)"
- L26 (Context): "`package/scripts/common/quarto`/`quarto.cmd` (`deno-version` check)"
- L31 (Context, Dual-runtime window): "the `QUARTO_RUNTIME` blocks in `package/scripts/common/quarto`, `package/scripts/windows/quarto.cmd`, `package/launcher/src/main.rs` (and `DENO_BINARY`)"
- L47 (Context, Files to delete): "`package/scripts/vendoring/` (`vendor.sh`, `vendor.cmd`), `package/scripts/deno_std/` (`deno_std.ts`, `download.sh`, `download.bat`, `lock.sh`)"
- L51 (Context, Code): "`tests/run-tests.sh`/`.ps1` Deno branch"
- L65 (CI graph table): "`ubuntu-latest`, `windows-latest`" (node-buckets/node-suite)
- L68 (CI graph table): "`ubuntu-latest`, `macos-latest`, `windows-latest`" (render-parity)
- L71 (CI graph): required checks include "`Node bucket NN / Run smoke (windows-latest)` for NN = 01...20"
- L75 (Assumptions): "PR 31: `QUARTO_TEST_RUNTIME` switch in `tests/run-tests.sh`/`.ps1`"
- L101 (Files): lists `configure.cmd`, `package/src/quarto-bld.cmd`, `package/scripts/windows/quarto.cmd`, `tests/run-tests.ps1`
- L111 (Acceptance): "the second prints only what the bullets above already allow (`test-install.yml`'s `install-deno-tool` job, `configure.cmd`'s `check-node-in-use` line)"
- L124 (Task 1 Step 1): "In `configure.cmd`, `check-node-in-use.cmd` keeps checking `deno.exe` too (a running dev Deno from an older checkout still locks files)."
- L132 (Task 1 Step 3): "`package/scripts/common/quarto` and `quarto.cmd`: the version check loops over `NODE` only (delete `DENO` from the `for RT in NODE DENO` loop and the `deno-version` block in `quarto.cmd`)."
- L206 (Task 3): files `tests/run-tests.sh`, `tests/run-tests.ps1`
- L212 (Task 3 Step 1): "line 424 comment -> `# Convert the executable to a native Windows path for the harness's process spawn.`"
- L213 (Task 3 Step 1): "rename `QUARTO_SKIP_DENO_CACHE_WIPE` to `QUARTO_SKIP_DIST_WIPE` here and in `configure.sh`/`configure.cmd`"
- L221 (Task 3 Step 2): "`tests/run-tests.sh`/`.ps1`: delete the `QUARTO_TEST_RUNTIME` selection and the Deno branch ..."
- L223 (Task 3 Step 2): "`grep -n -i "deno\|test-conf" tests/run-tests.sh tests/run-tests.ps1` -> no output"
- L228 (Task 3 Step 3): `git add -A ... tests/run-tests.ps1 ... configure.cmd`
- L241 (Task 4 Step 1): grep `--include=*.cmd --include=*.bat`
- L279 (Task 5 Step 1, new doc text): "root (run by `configure.sh`/`configure.cmd`)"
- L349 (Task 5 Step 4): "line 369 (Windows `deno.exe test ...` excerpt): replace with the command line `run-tests.ps1` prints now"

---

### Windows mentions added by grep sweep at assembly
Lines matching `windows|win32|.cmd|.ps1|taskkill` (case-insensitive) that the extractor's list above did not cite. Quoted verbatim, trimmed to 300 characters; section is the nearest preceding heading.

- L120 (Task 1: Stop downloading and shipping Deno; close the dual-runtime window): "**Files:** `configure.sh`, `configure.cmd`, `package/scripts/common/utils.sh`, `package/src/quarto-bld`, `package/src/quarto-bld.cmd`, `package/src/common/{prepare-dist,archive-binary-dependencies,configure}.ts`, `package/src/common/dependencies/deno.ts` (delete), `src/core/devconfig.ts`, launchers, ..."
- L122 (Task 1: Stop downloading and shipping Deno; close the dual-runtime window): "- [ ] **Step 1: `configure.sh` / `configure.cmd`**"
- L128 (Task 1: Stop downloading and shipping Deno; close the dual-runtime window): "Delete the `QUARTO_DENO` export blocks from `quarto-bld`/`quarto-bld.cmd`; delete the `denoVersion`/`deno()` block in `prepare-dist.ts` and its import; `git rm package/src/common/dependencies/deno.ts`; `archiveUrl`'s special case becomes `dependency.bucket === "node"`; `configure.ts` drops `env.get( ..."
- L159 (Task 1: Stop downloading and shipping Deno; close the dual-runtime window): "git add -A configure.sh configure.cmd package src/core/devconfig.ts src/tools/impl/deno-paths.ts configuration tests/smoke/env/launcher-env.test.ts .github/workflows/create-release.yml"

## 38-lint-format-typecheck-tooling.md

Extracted commands: 52 (a=19, b=18, c=7, d=0, u=8)

Shell assumed: bash (Git Bash on Windows). Task 1 Step 3 is a long bash script with MSYS-style paths; its Linux/macOS Deno path is given but no Windows path.

| # | line | section | command | class | note |
|---|---|---|---|---|---|
| 1 | 16 | Context | `git show <PR 37 parent>:deno.jsonc` | a | git (placeholder SHA) |
| 2 | 30 | Context | `rg -o --no-filename "deno-lint-ignore(-file)?( [a-z-]+)*" src tests package tools` | a | rg |
| 3 | 54-57 | Interfaces (package.json scripts) | `oxlint -c .oxlintrc.json --report-unused-disable-directives src`; `dprint fmt`; `dprint check`; `node tools/typecheck/gen-tsconfig-paths.mjs --check && tsc -p tsconfig.json` | a | run through npm scripts (cmd.exe handles `&&`); npm packages ship Windows binaries |
| 4 | 95 | Acceptance criteria | `dprint fmt` vs `deno fmt` produce identical trees (`diff -r` empty) | c | parity procedure is Task 1 Step 3 (see rows 11-21); Windows Deno install path not given |
| 5 | 96-98 | Acceptance criteria | `npm run lint`; `grep -rn "deno-lint-ignore" src`; `npm run fmt:check`; `npm run typecheck` | b | npm.cmd under Git Bash; grep fine |
| 6 | 99 | Acceptance criteria | `lint.yml` fails on a deliberate `const x: any = 1;` in `src/` | u | needs a push that fires CI (approval required) |
| 7 | 113 | Task 1 Step 1 | `npm install --save-dev --save-exact dprint@0.63.0 @dprint/typescript@0.96.1 @dprint/json@0.21.3 @dprint/markdown@0.20.0 oxlint@1.88.0` | b | `npm.cmd` under Git Bash |
| 8 | 114 | Task 1 Step 1 | `ls node_modules/@dprint/typescript/plugin.wasm node_modules/@dprint/json/plugin.wasm node_modules/@dprint/markdown/plugin.wasm` | a | ls |
| 9 | 116 | Task 1 Step 1 | read `https://raw.githubusercontent.com/denoland/deno/<DENO>/Cargo.toml` | a | URL fetch (curl or WebFetch) |
| 10 | 119-156 | Task 1 Step 2 | `dprint.json` plugin paths `node_modules/@dprint/*/plugin.wasm` (config, not a command) | u | relative plugin paths; dprint.exe on Windows should accept them, not verified |
| 11 | 165 | Task 1 Step 3 | `ROOT=$PWD` | b | bash; in Git Bash `$PWD` is MSYS style `/c/Users/...` (see #19) |
| 12 | 166 | Task 1 Step 3 | `DENOJSONC_COMMIT=$(git log --diff-filter=D -1 --format=%h -- deno.jsonc)` | a | git in Git Bash |
| 13 | 167-168 | Task 1 Step 3 | `PARITY=$(mktemp -d)` ; `mkdir -p "$PARITY/deno" "$PARITY/dprint"` | b | Git Bash (mktemp gives `/tmp/...`); PowerShell needs New-Item |
| 14 | 169-170 | Task 1 Step 3 | `git archive HEAD src \| tar -x -C "$PARITY/deno"` (and `.../dprint`) | b | works only in Git Bash with GNU tar on a stream; PowerShell pipeline would corrupt the binary stream |
| 15 | 171 | Task 1 Step 3 | `git show "$DENOJSONC_COMMIT^:deno.jsonc" > "$PARITY/deno/deno.jsonc"` | b | bash redirect; PowerShell redirect/encoding differs |
| 16 | 172 | Task 1 Step 3 | `package/dist/bin/quarto install deno --no-prompt` | b | quarto.cmd |
| 17 | 173 | Task 1 Step 3 | `DENO="$HOME/.local/share/quarto/deno/deno"` (macOS alternative given) | c | Windows install location and `deno.exe` name not given; path will differ |
| 18 | 174 | Task 1 Step 3 | `(cd "$PARITY/deno" && "$DENO" fmt --config deno.jsonc src/ 2>&1 \| tail -1)` | c | depends on #17 (needs `deno.exe` path) |
| 19 | 175 | Task 1 Step 3 | `sed "s#node_modules/@dprint#$ROOT/node_modules/@dprint#g" dprint.json > "$PARITY/dprint/dprint.json"` | c | `$ROOT` is `/c/Users/...` (MSYS) and gets written into dprint.json for a native Windows dprint.exe, which will not resolve it |
| 20 | 176 | Task 1 Step 3 | `(cd "$PARITY/dprint" && "$ROOT/node_modules/.bin/dprint" fmt 2>&1 \| tail -1)` | u | `.bin/dprint` extensionless sh shim runs under Git Bash; the wasm plugin path issue in #19 applies |
| 21 | 177-179 | Task 1 Step 3 | `EXT='\.(ts\|tsx\|js\|jsx\|mjs\|cjs\|json\|jsonc\|md) '` ; `diff -r -q "$PARITY/deno/src" "$PARITY/dprint/src" \| grep -E "$EXT" \| head -20` ; `... \| grep -E -c "$EXT"` | a | diff/grep/head in Git Bash; expects `0` |
| 22 | 184 | Task 1 Step 3 | `diff "$PARITY/deno/src/<f>" "$PARITY/dprint/src/<f>"` | a | diff |
| 23 | 189 | Task 1 Step 4 | `npx dprint fmt` | b | npx.cmd under Git Bash |
| 24 | 190-192 | Task 1 Step 4 | `git add package.json package-lock.json dprint.json` ; `git commit -m "tooling: dprint with deno fmt 2.9's plugins replaces deno fmt"` ; `git add -A src && git commit -m "style: format src/ (identical to deno fmt 2.9)" \|\| true` | a | git; `\|\| true` is Git Bash |
| 25 | 193 | Task 1 Step 4 | `rm -r -- "$PARITY"` | a | removes own temp dir in Git Bash (destructive; scratch only) |
| 26 | 251, 467 | Task 2 Step 2 / Step 7 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/lint-directives-codemod.test.ts` | b | run-tests.ps1 + `$env:` form |
| 27 | 262, 444 | Task 2 Step 3 / Step 5 | `node tools/lint/migrate-directives.mjs <dir>...` ; `node tools/lint/migrate-directives.mjs src` | u | node cross-platform; script splits on `\n` and its `\s*$` strips a trailing `\r`, so CRLF working copies would lose CR on migrated lines (autocrlf) |
| 28 | 445 | Task 2 Step 5 | `grep -rn "deno-lint-ignore" src \| head` | a | grep |
| 29 | 446 | Task 2 Step 5 | `npx oxlint -c .oxlintrc.json --report-unused-disable-directives src 2>&1 \| tail -3` | b | npx.cmd under Git Bash |
| 30 | 449 | Task 2 Step 5 | `npx oxlint ... --format=json \| node -e '...'` (elided histogram script) | u | single-quoted node -e body not specified |
| 31 | 457 | Task 2 Step 6 (script body) | `npx oxlint -c .oxlintrc.json --format=unix src 2>/dev/null \| sed 's/:.*$//' \| sort -u` | u | bash script; `sed 's/:.*$//'` would truncate at a `C:` drive colon if oxlint emitted absolute Windows paths; `sort` shadowing outside Git Bash |
| 32 | 461 | Task 2 Step 6 | `chmod +x tools/lint/files-with-findings.sh` | c | no effect on NTFS; the executable bit in git needs `git update-index --chmod=+x` |
| 33 | 462 | Task 2 Step 6 | `git rm package/src/common/project-lint.sh` | a | git |
| 34 | 471-473 | Task 2 Step 7 | `git add .oxlintrc.json tools/lint tests/unit/lint-directives-codemod.test.ts` ; `git commit -m ...` ; `git add -A src && git commit -m "lint: migrate deno-lint-ignore directives in src/ to oxlint"` | a | git |
| 35 | 483 | Task 3 Step 1 | `npm uninstall @types/deno` | b | npm.cmd under Git Bash |
| 36 | 484 | Task 3 Step 1 | `git rm -q src/deno_ral/deno-types.d.ts 2>/dev/null \|\| true` | a | Git Bash |
| 37 | 485 | Task 3 Step 1 | `sed -i 's/"types": \["node", "deno"\]/"types": ["node"]/' tsconfig.json` | b | GNU sed in Git Bash; PowerShell needs `-replace` or the Edit tool |
| 38 | 486 | Task 3 Step 1 | `grep -n '"types"' tsconfig.json` | a | grep |
| 39 | 487 | Task 3 Step 1 | `npm run typecheck` | b | npm.cmd under Git Bash |
| 40 | 494-495 | Task 3 Step 2 | `git add package.json package-lock.json tsconfig.json src/deno_ral` ; `git commit -m "types: ..."` | a | git |
| 41 | 505-508 | Task 4 Step 1 (yaml) | `run: npm run lint` ; `run: npm run fmt:check` (appended to the `lint.yml` job) | u | CI job; OS of the job not stated here |
| 42 | 513 | Task 4 Step 2 | push a scratch commit adding `export const x: any = 1;` to `src/core/path.ts` and watch `lint.yml` fail, then drop it | c | push to a shared remote that fires CI needs Chris's approval first |
| 43 | 518-519 | Task 4 Step 3 | `git add .github/workflows/lint.yml package.json` ; `git commit -m "ci: lint and format checks next to typecheck"` | a | git |
| 44 | 546 | Task 5 Step 2 (new doc text) | `npm run lint`, `npm run fmt`, `npm run typecheck`, `node tools/typecheck/gen-tsconfig-paths.mjs` | b | doc content; npm.cmd under Git Bash |
| 45 | 561-562 | Task 5 Step 3 | `git add .vscode quarto-cli.code-workspace .claude/rules` ; `git commit -m "editor/docs: ..."` | a | git |
| 46 | 570 | Task 6 Step 2 | `node tools/lint/migrate-directives.mjs tests package/src tools && npx dprint fmt && npx oxlint -c .oxlintrc.json --report-unused-disable-directives tests package/src tools 2>&1 \| tail -1` | b | npx.cmd under Git Bash; CRLF note as #27 |
| 47 | 571 | Task 6 Step 3 | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent $(find unit/ -name '*.test.ts')` | b | run-tests.ps1 + Get-ChildItem for `$(find)` |
| 48 | 571 | Task 6 Step 3 | `git reset --hard HEAD~N` (revert the task's commits on stop condition) | c | destructive; needs explicit approval from Chris per rules |
| 49 | 576 | Verification | `npm run lint && npm run fmt:check && npm run typecheck` | b | npm.cmd under Git Bash |
| 50 | 577 | Verification | `grep -rn "deno-lint-ignore\|denoland.vscode-deno\|\"deno\.\|@types/deno" src .vscode .claude quarto-cli.code-workspace package.json tsconfig.json` | a | grep |
| 51 | 578 | Verification | `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/lint-directives-codemod.test.ts $(find unit/ -name '*.test.ts')` | b | as #47 |
| 52 | 579 | Verification | `lint.yml` green; scratch `any` commit makes it fail | u | CI dependent (push approval) |

### Windows mentions

none (no case-insensitive hit for windows, win32, .cmd, .ps1 or taskkill in this file).

Windows-relevant text without the keywords (for phase 2): L173 `DENO="$HOME/.local/share/quarto/deno/deno"          # macOS: "$HOME/Library/Application Support/quarto/deno/deno"` (Linux and macOS only); L175-176 MSYS `$ROOT` paths handed to dprint.

---


## 39-remove-quarto-latexmk-compile.md

Extracted commands: 20 (a=12, b=6, c=0, d=0, u=2)

Shell assumed: bash. Note: this PR deletes the `deno compile` path (`compile-quarto-latexmk.ts`, `test-quarto-latexmk.yml` which built on three OSes).

| # | line | section | command | class | note |
|---|---|---|---|---|---|
| 1 | 18 | Context | `rg -n -i --hidden "tinitex\|quarto-latexmk\|compile-quarto-latexmk\|compileQuartoLatexmk\|kExeName\|kExeVersion\|kExeDescription" --glob '!.git/**'` | a | rg; `!` inside single quotes fine in bash, in PowerShell quote as shown |
| 2 | 33 | Context | `rg -n "quarto-latexmk" src/command/render/latexmk` | a | rg |
| 3 | 64 | Acceptance criteria | `rg -n -i --hidden "tinitex\|quarto-latexmk\|compileQuartoLatexmk\|kExeName" --glob '!.git/**' --glob '!news/**' --glob '!dev-docs/runtime-migration/**' .` (prints nothing) | a | rg |
| 4 | 65 | Acceptance criteria | `cd package/src && ./quarto-bld --help` (no longer lists `compile-quarto-latexmk`) | b | `quarto-bld.cmd` |
| 5 | 65 | Acceptance criteria | `./quarto-bld prepare-dist --set-version 99.9.9` succeeds | b | `quarto-bld.cmd` |
| 6 | 66 | Acceptance criteria | `tests/unit/latexmk/` and `tests/smoke/render/render-pdf.test.ts` pass; `test-bundle.yml` passes | b | run via run-tests.ps1; test-bundle is CI; PDF test needs TinyTeX |
| 7 | 67 | Acceptance criteria | `grep -rn "deno compile\|\"compile\"" package/src` (prints nothing) | a | grep |
| 8 | 77 | Task 1 Step 1 | `rg -n -i --hidden "tinitex\|quarto-latexmk\|compile-quarto-latexmk\|compileQuartoLatexmk\|kExeName\|kExeVersion\|kExeDescription" --glob '!.git/**' --glob '!news/**' --glob '!dev-docs/runtime-migration/**' .` | a | rg |
| 9 | 83 | Task 1 Step 2 | `git rm package/src/common/compile-quarto-latexmk.ts src/command/render/latexmk/quarto-latexmk.ts src/command/render/latexmk/quarto-latexmk-metadata.ts .github/workflows/test-quarto-latexmk.yml` | a | git |
| 10 | 88 | Task 1 Step 2 | `rg -n "\.importmap\b" package/src` | a | rg |
| 11 | 86-89 | Task 1 Step 2 | hand edits to `package/src/bld.ts`, `package/src/util/deno.ts`, `package/src/common/config.ts`, the two workflow files (delete lines) | a | file edits, no shell |
| 12 | 95 | Task 1 Step 3 | `rg -n -i --hidden "tinitex\|quarto-latexmk\|compileQuartoLatexmk\|kExeName" --glob '!.git/**' --glob '!news/**' --glob '!dev-docs/runtime-migration/**' .` | a | rg |
| 13 | 96 | Task 1 Step 3 | `cd package/src && ./quarto-bld --help \| grep -c compile-quarto-latexmk` (expects `0`) | b | `quarto-bld.cmd`; `grep -c` exits 1 on 0 matches |
| 14 | 97 | Task 1 Step 3 | `cd ../../tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent $(find unit/latexmk/ -name '*.test.ts') smoke/render/render-pdf.test.ts` | b | run-tests.ps1 + `$env:`/Get-ChildItem; PDF test needs TinyTeX |
| 15 | 104-105 | Task 1 Step 4 | `git add -A package/src src/command/render/latexmk .github/workflows` ; `git commit -m "build: remove the deno compile build of tinitex (rewritten in Rust separately)"` | a | git |
| 16 | 116 | Verification | "The three commands of Task 1 step 3" | b | same as #12-#14 |
| 17 | 117 | Verification | push: `test-bundle.yml`, `test-smokes.yml` green; the `Test quarto-latexmk` check no longer appears | u | needs a push (approval) |
| 18 | 127 | Risks and rollback | `git revert` | a | git |
| 19 | 28 | Context table | `.github/workflows/test-quarto-latexmk.yml` (deleted: built `tinitex` on three OSes via `deno compile`) | u | removal is not a command; included for the Windows CI job it deletes |
| 20 | 87 | Task 1 Step 2 | `git rm package/src/util/deno.ts` (conditional on PR 33 having removed `bundle()`) | a | git |

### Windows mentions

- L87 (Task 1 Step 2): "`package/src/util/deno.ts`: delete `compile`, `install` and `updateDenoPath`, and the imports only they used (`isWindows`). If `bundle()` is also gone (PR 33 landed first), `git rm package/src/util/deno.ts`."

---


# Appendix: extractor conventions and slice notes

Each of 13 extractors wrote its own shorthand and a closing slice summary. They are kept verbatim for context; the per-plan tables above are authoritative.

## Conventions, part-03

# Part 03 (PRs 03, 04, 05, 06)

Shell assumption in all four plans: Bash (Linux/macOS-style). Line numbers are those of the cited file. Abbreviations in the notes column:
- RT = `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh ...` -> `run-tests.ps1` with `$env:QUARTO_TESTS_NO_CONFIG='true'` (the VAR=x prefix is bash-only), or run-tests.sh under Git Bash with `DENO_DIR=x86_64`.
- Q = `package/dist/bin/quarto` -> `package/dist/bin/quarto.cmd` (same for `package/pkg-working/bin/quarto`).
- D = `package/dist/bin/tools/x86_64/deno` -> `deno.exe` (works as written in Git Bash).
- UL = `package/scripts/vendoring/update-lock.sh`: .sh script, no Windows (.cmd/.ps1) counterpart known to this extraction.
- GB = needs Git Bash (grep, git, mv, rm, head, sort, etc. are not PowerShell commands).

## Conventions, part-04

Conventions for this slice: both plans assume a bash-like shell (Git Bash / POSIX): inline `VAR=x cmd`, `$(...)`, `&&`, `\` continuations, `$?`, heredoc-free. Line numbers are the line of the command in the file (a multi-line block is cited by its first line, or a range). A `git add` + `git commit` pair in one code block is one row. "run-tests" = `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent ...`; its (b) adaptation is run-tests.ps1 with `$env:QUARTO_TESTS_NO_CONFIG='true'` (bash-only inline env prefix) and `$(find ...)` replaced (or run under Git Bash with DENO_DIR=x86_64). "deno" = `package/dist/bin/tools/x86_64/deno` -> `deno.exe`. "quarto" = `package/dist/bin/quarto` -> `quarto.cmd`. Descriptive "verified with `rg ...`" sentences (07 L18; 08 L18, L20) are not instructions and are not tabulated.

## Conventions, part-05

# Part 05: Windows-executability extraction, files 09-13

Conventions: every plan assumes a bash shell (Git Bash on Windows): `VAR=x cmd` prefixes, `$(find ...)`, `$$`, `$(mktemp -d)`, `\` line continuation, `> /tmp/x`, `| tail/head`, `xargs`. Bundled deno is written without `.exe`; under Git Bash that resolves, under cmd/PowerShell it needs `deno.exe`. `quarto` (no `.cmd`) is the dev binary or `quarto run --dev` form. Pipes inside table cells are escaped as `\|`.

## Conventions, part-06

# Part 06: Windows-executability extraction (14b, 14, 15, 16, 17, 18)

Shell assumption: every plan below writes commands for bash (`&&`, `VAR=x cmd`, `$(...)`, `2>&1 >/dev/null`, `/tmp`, `sed -i`, `grep`, `find`, `xargs`). Rows say "Git Bash" when the command works there. `quarto` means `package/dist/bin/quarto` (extensionless, absent on Windows) or the bare `quarto run --dev ...` form; both map to `quarto.cmd`. `./run-tests.sh` -> `run-tests.ps1` (or Git Bash with `DENO_DIR=x86_64`); whether `run-tests.ps1` accepts `--agent` and `QUARTO_TESTS_NO_CONFIG` as env is unverified. `deno` path `package/dist/bin/tools/x86_64/deno` -> `deno.exe`. `rg` is not a bundled tool (needs install). Row class (d) is used where the command is the per-OS verification of PR 14b (README lists Windows for 14b); commands inside test source that the plan has the test execute are listed too, flagged "test-internal".

## Conventions, part-07

# Part 07: Windows-executability extraction (read-only)

Files: 19, 20b, 20, 22, 23, 24, 25 under dev-docs/runtime-migration/. Line numbers are 1-based line numbers of the file, taken from the Read output. A `git add` and the `git commit` that follows are two separate rows. Pipelines are one row unless they chain separately runnable commands; `\|` is a literal pipe inside a quoted command.

Shorthand used in the notes (shell assumed by every plan: bash, i.e. Git Bash on Windows):
- [RT] = `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent <files>`. Adaptation: run-tests.sh -> run-tests.ps1 (or Git Bash with DENO_DIR=x86_64); the `VAR=x cmd` prefix is bash-only (PowerShell: `$env:QUARTO_TESTS_NO_CONFIG='true'`); `--agent` support in run-tests.ps1 not verified; `$(find ...)` is bash-only (PowerShell: Get-ChildItem).
- [Q] = `package/dist/bin/quarto ...` or `quarto ...`: adaptation quarto -> quarto.cmd (package/dist/bin/quarto.cmd).
- [QB] = `package/src/quarto-bld ...`: adaptation quarto-bld -> quarto-bld.cmd (named in 20-remove-deno-dom-ffi.md:13/79).
- [DENO] = `package/dist/bin/tools/x86_64/deno ...`: adaptation deno -> deno.exe (Git Bash resolves the extension on its own).
- [GREP] = grep/rg/sed/sort/wc/ls/head/tail pipelines: run as written under Git Bash (GNU tools on PATH); not valid in PowerShell.
- [GIT] = plain git/gh/cargo commands: shell independent.

## Conventions, part-09

# Part 09: PRs 27, 28, 29 (dev-docs/runtime-migration/)

Counting rule: a `git add ...` + `git commit -m ...` block is one row. Several shared abbreviations in notes:
- RT = `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent ...` (bash `VAR=x cmd` prefix, `./run-tests.sh`, `$(find ...)` substitutions; plan assumes bash). Windows adaptation: `run-tests.ps1` with `$env:QUARTO_TESTS_NO_CONFIG="true"`, and the `$(find ...)` lists expanded with Get-ChildItem; or Git Bash with `DENO_DIR=x86_64`. I did not read run-tests.ps1, so `--agent` flag support there is unverified.
- NB = a `tools/node-bundle/*.mjs` or `tools/node-bundle/quarto-node` tool. I did not read those scripts; `quarto-node` is extensionless (no .cmd known), so those rows are (u).
- "Git Bash" in a note means the command is POSIX shell syntax that works in Git Bash, not in PowerShell.

## Conventions, part-10

Shell assumption note: unless stated, every plan command below is written for bash (the plans use `VAR=x cmd`, heredocs, `$(...)`, `/tmp`, `find`, `grep`); under Git Bash on Windows most of these run, under PowerShell they do not. "Git Bash" in a note means class applies only if the executor uses Git Bash.

## Slice summary, part-01

Totals for the slice (8 files): 272 extracted commands. Class counts: a=77, b=133, c=28, d=14, u=20.

Per file (total: a / b / c / d / u):
- README.md: 13: 6 / 4 / 0 / 0 / 3
- _TEMPLATE.md: 16: 5 / 9 / 1 / 0 / 1
- SPIKES.md: 68: 15 / 31 / 18 / 0 / 4
- 00-assessment.md: 8: 2 / 4 / 0 / 0 / 2
- 00a-deno-bump.md: 25: 10 / 15 / 0 / 0 / 0
- 00b-lockfile-and-bundle-gate.md: 99: 27 / 41 / 8 / 14 / 9
- 00c-quarto-run-deprecation-notice.md: 22: 6 / 14 / 1 / 0 / 1
- 01-quick-fixes-from-spike.md: 21: 6 / 15 / 0 / 0 / 0

Least sure about:
1. The `/tmp/...` rows (SPIKES, 00b rows 37/49-ish, 01 row 12): whether Git Bash path conversion makes plain `/tmp/x` arguments, `--opt=/tmp/x` forms and env values consistent for node.exe/deno.exe/quarto.cmd. Marked b or u, not verified.
2. `package/scripts/vendoring/update-lock.sh`, `package/scripts/deno_std/lock.sh`, `tools/node-bundle/quarto-node`, `tools/parsehtml-gate.sh`, `run-tests-node.sh`: bash scripts that do not exist yet (created by PRs 00b/26/20/31) or have no Windows twin named; classed c or u by inference from the plan text only (`quarto-bld.cmd`, `run-tests.ps1`, `vendor.cmd` do exist).
3. The CI workflow bodies in 00b (quarto resolved on PATH under `shell: pwsh` on windows-latest; quarto.cmd invoked from Git Bash, `$PWD` as `/d/a/...`): classed d on the strength of the README's Windows manual-verification entry for PR 00b, not because the commands were checked.

## Slice summary, part-02

- 02-runtime-boundary-check.md: a=29, b=24, c=1, d=0, u=1 (total 55)
- 02b-node-compatible-ts-syntax.md: a=24, b=36, c=0, d=0, u=2 (total 62)
- Slice: a=53, b=60, c=1, d=0, u=3 (total 117)

Least sure about:
1. 02 row 24 (L988, class c): the cached-only failure is taken from the execution log (lines 1246-1253), and session 5 later ran it after warming the cache; whether it is "blocked" or just "needs a prerequisite" is for phase 2.
2. 02b rows 18-19 (L430, L433, class u): CRLF in a Windows checkout would break the `$`-anchored rg/perl patterns; unverified.
3. 02b rows 44 and 59 (quarto-bld -> quarto-bld.cmd): assumed adaptation, existence of quarto-bld.cmd not checked.

## Slice summary, part-03

Totals: 218 commands extracted (03: 54, 04: 51, 05: 60, 06: 53). Per-class counts (a/b/c/d/u): 03 = 16/26/1/0/11; 04 = 19/24/0/0/8; 05 = 21/18/0/5/16; 06 = 12/21/0/18/2. Slice: a = 68, b = 89, c = 1, d = 23, u = 37.

Least sure:
1. Every `package/scripts/vendoring/update-lock.sh` row (class u): no Windows counterpart is mentioned in the four plans, and it is the gating step for each import-map edit; it may run under Git Bash but that is unverified.
2. `QUARTO_DENO_DOM` rows in 05 (class u, plus rows 3/15/58 as d): unknown whether `quarto.cmd` forwards that variable to `DENO_DOM_PLUGIN`; also the whole 05 CI workflow (rows 41-46) depends on a bash `quarto` shim for quarto.cmd that is unverified.
3. The (b) classification of every `run-tests.sh` row assumes `run-tests.ps1` is a drop-in with equivalent `--agent` and glob handling and that `QUARTO_TESTS_NO_CONFIG` is honored from `$env:`; also `unzip` (04 row 29) and `./quarto-bld` (03 row 34, 05 row 25, 06 row 43) are not known to exist on Windows.

## Slice summary, part-04

Counts (07: 64 commands; 08: 96 commands; slice total 160):

| class | 07 | 08 | total |
|---|---|---|---|
| (a) | 19 | 33 | 52 |
| (b) | 36 | 29 | 65 |
| (c) | 1 | 5 | 6 |
| (d) | 0 | 3 | 3 |
| (u) | 8 | 26 | 34 |

Least sure about:
1. 07 rows 37-41 (Task 6 Step 3 `deno info` sweep): whether `file://$PWD/$f` with Git Bash `/c/...` paths and `/tmp` args work with a Windows deno.exe; I classed the URL loop (c) and the rest (u).
2. 08 rows 8-24 (the contract test's `cmd /c` / `ping` / `more` Windows branches and the child-script broken-pipe/stdin cases): (u) because behavior of Deno on Windows is unverified, and the plan only says the POSIX-only cases return early.
3. (d) on 08 rows 93-95: I did not read the README per-OS table; I applied (d) because the slice brief says Windows is listed for PR 08, but which of these manual steps it covers is unconfirmed. Also `update-lock.sh` / `run-parallel-tests.sh` / `quarto-bld` (u): whether Windows twins exist was not checked.

## Slice summary, part-05

Total extracted commands: 196. Class counts: (a) 79, (b) 101, (c) 2, (d) 0, (u) 14.

Least sure about:
1. 09 rows 29-39 (Task 5 Step 3 backport shell block, lines 2411-2428): bash-only (variables, functions, `$(mktemp -d)`, `$"w.patch"`) and passes MSYS `/tmp/...` paths to `quarto.cmd` via `--ral-dir`/`--file`; whether path conversion and the codemod's path resolution work on Windows is unverified.
2. 12 row 20 (line 183, unreadable-dir / denied-path tests): classified (c) as a guess because they rely on chmod-style unreadable dirs and `canMakeUnreadableDir`; Windows ACL behavior not checked.
3. The `grep '→' ... | awk -F'→'` pipelines (10 row 12-13, 11 row 12, 12 row 12, 13 row 12): marked (u) because of the multibyte separator and UTF-8 redirected Deno output under Git Bash.

## Slice summary, part-06

Total extracted commands: 240 (52 + 47 + 41 + 38 + 26 + 36).

Per-file class counts (a / b / c / d / u):
- 14b-coverage-first.md: 13 / 13 / 11 / 11 / 4
- 14-ral-env.md: 10 / 24 / 4 / 0 / 9
- 15-ral-net-async-ports.md: 17 / 17 / 0 / 3 / 4
- 16-ral-http.md: 12 / 18 / 1 / 1 / 6
- 17-ral-watch.md: 7 / 11 / 2 / 1 / 5
- 18-ral-kv.md: 13 / 15 / 2 / 0 / 6

Slice totals: (a) 72, (b) 98, (c) 20, (d) 16, (u) 34 (sum 240).

Method notes: rows include test-source invocations the plan makes the test execute (flagged "test-internal") and file-edit-only steps (class a, "no command") where the plan lists them as steps. Several rows are exact duplicates across sections (Verification repeats Acceptance/Task runs); they are listed separately and noted. Class (a) for `grep`/`ls`/`git`/`curl` means "works in Git Bash"; in plain PowerShell `grep`, `find`, `xargs`, `tail`, `sed`, `touch`, `mktemp` do not exist. The dominant mechanical adaptation is `./run-tests.sh` -> `run-tests.ps1` (or Git Bash with `DENO_DIR=x86_64`), `quarto` -> `quarto.cmd`, `deno` -> `deno.exe`, and `VAR=x cmd` -> set `$env:VAR` first.

Cross-file inconsistency worth Phase 2 attention: 14b says `preview-reload.test.ts` and `preview-project-reload.test.ts` run on Windows (`4 passed 4 ignored`), but 15 L596 and 17 L92 state `preview-reload` "is ignored on Windows". If 14b is right, 15/17 text is stale.

Least sure about:
1. 14b rows 15-16 (L358, L364): the Windows tree-kill test spawns `powershell` (5.1, not `pwsh`) with `Start-Process -WindowStyle Hidden ping` from a `detached: true` (DETACHED_PROCESS, no console) child; whether this prints the grandchild pid and survives until killed is unproven, and it is the single Windows evidence PRs 28/34 will cite.
2. 14b `quartoDevCmd()` resolution on Windows (rows 20, 27): the plan only asserts `quarto.cmd` (L650); I did not read `tests/utils.ts`/`tests/quarto-cmd.ts`, and the `taskkill /T` kill of a detached `cmd.exe` + `deno.exe` tree (rows 17, 21, 45) was not verified.
3. 14 rows 19, 43-44: the codemod's expected summary and `src/quarto.ts:87: collision` lines assume forward-slash paths and UTF-8 `→` output; whether `quarto run --dev tools/codemod-deno-ral.ts` prints identical text on Windows is unverified (class u). Also 14 row 30/31 (`cd "$d"` then relative `package/dist/bin/quarto`) is broken on every OS, not just Windows.

## Slice summary, part-07

Total extracted commands: 387 (19: 44, 20b: 65, 20: 71, 22: 37, 23: 68, 24: 40, 25: 62).
Class counts for the slice: (a) 213, (b) 136, (c) 6, (d) 0, (u) 32.
Per file (a/b/c/d/u): 19: 24/19/1/0/0; 20b: 35/28/0/0/2; 20: 47/18/0/0/6; 22: 16/13/1/0/7; 23: 32/24/1/0/11; 24: 17/17/3/0/3; 25: 42/17/0/0/3.
No row is class (d): none of PRs 19, 20b, 20, 22, 23, 24, 25 is in the README per-OS manual-verification table.
Dominant adaptations: quarto -> quarto.cmd, quarto-bld -> quarto-bld.cmd, deno -> deno.exe, run-tests.sh -> run-tests.ps1 (or Git Bash with DENO_DIR=x86_64), `VAR=x cmd` prefixes and `$(find ...)` are bash-only. Most (a) rows are grep/rg/git/sed/gh commands that run unchanged under Git Bash (not valid in PowerShell).

Least sure about:
1. The tools/rewrite-import-specifier.sh invocations (PR 22 rows 15-20, 37, PR 23 rows 23-28): classed (u) because the script depends on python3 os.path.relpath (backslash output on Windows, Store python3 stub) and on MSYS argument conversion for `jsr:/@std/...`; phase 2 should run it once on Windows. (Observation: a bare `python3 - <<EOF` call in this Git Bash session hung, so python3 availability is a real risk.)
2. `ls -l package/dist/bin/tools/pandoc` / `pandoc --version` (PR 24 rows 6, 15, 16): classed (c) because the symlink branch is skipped on Windows, but whether the dist layout has tools/pandoc.exe vs tools/x86_64/pandoc.exe is a guess.
3. The CI-embedded bash steps (PR 20 rows 13, 61) and `tests/run-parallel-tests.sh` (PR 23, class (u)): shell on windows-latest and whether a .ps1 equivalent exists were not verified.

## Slice summary, part-08

Total commands: 149 (part 26: 106, part 27b: 43).

| class | 26 | 27b | total |
|---|---|---|---|
| (a) | 47 | 8 | 55 |
| (b) | 24 | 17 | 41 |
| (c) | 19 | 6 | 25 |
| (d) | 0 | 0 | 0 |
| (u) | 16 | 12 | 28 |

Neither plan mentions a per-OS manual-verification step from the README table; none of PR 26 / 27b is in the (d) list.

Least sure about:
1. Rows 39, 40 (26) and 26 (27b), plus 47-51, 60-61 (26): Git Bash MSYS path conversion of `$PWD`, `/tmp/...` in env vars and args versus inside a `node -e` string. I classified them (c)/(u) on the assumption that conversion is inconsistent; phase 2 should run them.
2. All `run-unit-on-node.mjs` rows (u): the script has a `windows` OS key and CI runs it on windows-latest, but whether bundled tests (tar with 2000 files, log file handler, shim `Deno.Command`) pass on Windows is only discoverable by running.
3. Rows classed (b) "run in Git Bash" (grep/find/sed/diff/head/mv pipelines): assumed Git for Windows ships GNU versions of these and that they behave the same; not checked.

## Slice summary, part-09

Per-class counts for the slice (141 extracted commands; git add+commit pairs counted as one row):
- (a) 40: file 27 = 14, file 28 = 13, file 29 = 13
- (b) 47: file 27 = 13, file 28 = 15, file 29 = 19
- (c) 11: file 27 = 2, file 28 = 5, file 29 = 4
- (d) 3: file 28 only (the three L1087 manual commands; PR 28 is Windows-listed in the README table)
- (u) 40: file 27 = 13, file 28 = 13, file 29 = 14

Least sure about:
1. All `node tools/node-bundle/*.mjs` and `tools/node-bundle/quarto-node` rows (u, about 34 rows): I did not read those scripts, and the plans themselves say the `node-unit` job runs `run-unit-on-node.mjs` on Windows CI, so several are probably (a) or (b). `quarto-node` is extensionless with no known .cmd form.
2. The (d) rows (28 rows 47-49): I did not read the README table, and I applied (d) only because the task statement says Windows is listed for PR 28. Row 49 (`| head -c 1; echo ... ${PIPESTATUS[0]}`) is bash-only, so a Windows procedure would differ.
3. The `run-tests.sh` to `run-tests.ps1` mapping (b): I did not read run-tests.ps1, so `--agent` support and the `$(find ...)` expansion in PowerShell are unverified. Also, many of the PR 28 pipe tests return early on Windows, so a green Windows run proves nothing for them.

## Slice summary, part-10

Per-class counts (computed from the tables; class d is unused because none of these three plans' commands is covered by the README per-OS table):
- 30-ral-kv-on-node.md: 46 rows: a=21, b=15, c=2, d=0, u=8
- 31-test-harness-on-node.md: 95 rows: a=36, b=40, c=13, d=0, u=6
- 32-node-ci-required.md: 76 rows: a=63, b=4, c=2, d=0, u=7
- Slice total: 217 rows: a=120, b=59, c=17, d=0, u=21

Note: "(Row count above is ...)" lines under each table are leftovers; the header "Extracted commands" values are correct. Rows 31:#4 and 31:#10 are the same command shown in two sections; exact duplicates inside one section were grouped only where noted.

Least sure about:
1. Whether `node --import <absolute Windows path>` (used in runHarness Node variant N, run-tests-node.sh/.ps1 bodies; rows 31:#1, #38, #47) is accepted on win32 or needs a file URL; marked (u).
2. `/tmp` handling: whether Git Bash MSYS conversion applies to env-var values (`QUARTO_TEST_JUNIT=/tmp/...`) and to paths inside `node -e` strings; the latter marked (c), the env-value cases (u)/(c).
3. Whether Git for Windows ships GNU `time` at `/usr/bin/time` (used by run-tests-node.sh timing mode, rows 31:#39, #41, #93); marked (c) as likely absent.

## Slice summary, part-11

Total extracted commands: 167 (rows 1-167; some rows group exact duplicates or consecutive git add/commit pairs, with the line range given).

Per-class counts: (a) 79, (b) 52, (c) 24, (d) 0, (u) 12. No row is class (d): the README Windows-manual-verification table lists PRs 00b, 05, 06, 08, 14b, 28, not 33.

Shell assumption: the plan is written for Bash throughout (including `VAR=x ./run-tests.sh`, `time`, `touch`, `$(find ...)`, `$(mktemp -d)`, `>/dev/null`, `&`/`wait`); only the `configure.cmd`, `quarto-bld.cmd`, `quarto.cmd` and `check-node-in-use.cmd` bodies are batch. Test sources, `node.ts`, `ensure.mjs`, `build.mjs`, `runtime-env.ts`, `deno-paths.ts`, `deno.ts`, `main.rs` and `configure.sh` bodies are file contents to write, so they are listed as commands only where the executor runs them or where they spawn or signal a process (rows 33, 34, 41, 65, 66, 76-78, 85, 87, 120-123).

Items least sure about:
1. Rows 100-104 (`test-install.yml` `quarto install deno` / `quarto run` from `shell: bash` on `windows-latest`): whether bare `quarto` resolves to `quarto.cmd` from Git Bash there. Also row 130 (VS Code task `"command": "node"` needs Node on PATH, which the dist Node is not).
2. Rows 72 and 78 (`validate-bundle.ts` `args: ["install", ...]` and `which("npm")` outside `build.mjs`): whether those spawns resolve `npm.cmd` on Windows. `build.mjs` handles it (row 77); the others are not shown.
3. Rows 159-162 (manual lock-ownership check): `$$` is the MSYS pid, so the liveness probe by Windows Node would see a different pid; the plan restricts it to Linux/macOS. Also rows 33-34 (`kill("SIGTERM")` and `process.kill(pid, 0)` semantics on Windows, which the plan verifies only on Linux).
<!--END-->

## Slice summary, part-12

Per-class counts for the slice (rows as numbered above):

- 34-installers-and-check.md (39 rows): (a) 13, (b) 14, (c) 10, (d) 0, (u) 2
- 35-user-scripts-compat.md (69 rows): (a) 32, (b) 34, (c) 1, (d) 0, (u) 2 (row 69 is a pointer row classed (b); it duplicates the Windows `.cmd` shim test already in row 32, so a stricter count would be 68 distinct commands with (b) 33)
- Slice total (108 rows): (a) 45, (b) 48, (c) 11, (d) 0, (u) 4

Note: neither plan (PR 34, PR 35) is in the README per-OS manual table's Windows list (00b, 05, 06, 08, 14b, 28), so no (d) rows. Plan 35 says its own Windows-specific test (`.cmd` through the shim) runs on the Windows CI matrix.

Least sure about:
1. Row 35/4 (`--import <absolute Windows path>/register-import-map.mjs`, lines 143 and 1902): unsure whether Node accepts a bare `C:\...` path for `--import`; classed (u).
2. Row 35/48 (`execFileSync("quarto", ...)` in ast-diagram main.ts, line 2142): classed (c) from the CVE-2024-27980 .cmd-spawn rule the plan itself cites; not run here.
3. Row 35/22 (`execSync(execPath(), { args: [build.mjs...] })`, line 1035) and 35/60 (`./quarto-bld` -> `quarto-bld.cmd` assumed to exist): not verified in the repo.

## Slice summary, part-13

Totals across the slice: 178 rows (36: 40, 37: 66, 38: 52, 39: 20). Per-class counts: see the lines below.

- Slice total: a = 75, b = 61, c = 11, d = 0, u = 31 (sum 178).
- 36: a 15, b 21, c 0, d 0, u 4 (40)
- 37: a 29, b 16, c 4, d 0, u 17 (66)
- 38: a 19, b 18, c 7, d 0, u 8 (52)
- 39: a 12, b 6, c 0, d 0, u 2 (20)
- Class (d) is not used: none of these four plans names Windows-per-OS manual verification (PRs 00b, 05, 06, 08, 14b, 28 are not in this slice).
- Shell caveat for every (a) and (b) row that uses `grep`, `rg`, `find`, `sed`, `$(...)`, `/dev/null`, `/tmp`: assumes Git Bash. "b" rows list the PowerShell adaptation; under Git Bash most of them work as written once `quarto` resolves to `quarto.cmd`.

Least sure about:
1. 37 #6/#19 and 38 #17: the plan's `ls .../deno` checks name `deno` while Windows has `deno.exe`; I classed them (c) because they pass vacuously, but the actual Windows tools layout (and the Deno-tool install directory) was not verified.
2. 38 #19/#20 (MSYS `$ROOT` written into `dprint.json` for a native dprint.exe) and 37 #51 (`/tmp` worktree paths handed to a Windows Node process): path-conversion behaviour guessed from known MSYS rules, not tested.
3. 36 #3 and #6 (esbuild `NODE_PATH` aliases and PR 35's `--packages` builder): left (u); correct on paper, but nothing in the plan exercises them on Windows.
