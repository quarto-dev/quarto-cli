# Runtime migration plan review: Windows executability, 2026-10-21

## Recommendation

**A Windows executor cannot run the plan set as written.** Almost every plan fails at its first launcher or test-runner command. These failures are mechanical: one README "Windows conventions" block (C1–C8 below) fixes about 900 of the 2550 extracted commands without touching individual plans. Apply that block first.

Applying the conventions is not enough. Fifteen findings (P1) are real defects that a Windows run hits even with correct launchers:

- the Windows evidence that PRs 28, 29 and 34 cite cannot be produced;
- one step would delete live import-map keys;
- one tool would write corrupt import specifiers;
- two lock implementations flake under contention;
- one PowerShell runner hides test failures (it exits 0 when tests fail);
- no plan step runs the rewritten Windows launchers on Windows.

The review also found defects in plan text that fail on every OS. They are listed separately (E01–E10). One of them (E01) affects the pending step of this branch (PR 02 Task 3 Step 5).

Counts: **W findings: 15 P1, 21 P2, plus a P3 table. E findings (every OS): 3 P1, 6 P2, 1 P3.** Priorities have the same meaning as in [REVIEW-2026-10-16](REVIEW-2026-10-16.md): P1 = correct before executing or landing the affected PR; P2 = resolve before the affected acceptance gate.

## Scope and limits

- **What was reviewed:** the README, `_TEMPLATE.md`, `SPIKES.md`, `00-assessment.md` and plans 00a–39 (49 files). The input was the phase-1 extraction ([REVIEW-2026-10-21-windows-extraction.md](REVIEW-2026-10-21-windows-extraction.md)): 2550 commands, each classified (a) works / (b) mechanical adaptation / (c) blocked / (d) README manual-verification / (u) uncertain.
- **What phase 2 ruled:**
  - every (c), (u) and non-bulk (b) row (703 rows);
  - the 761 bulk (b) rows (launcher, test runner, Deno path, env prefix, configure), ruled centrally by bucket;
  - a spot-check of 125 (a) rows, plus 69 (a) rows that carry POSIX markers.
- **Machine:** Windows 11, French locale. Shells: Git Bash (MSYS) and PowerShell 7. Bundled Deno 2.7.14. **Node 24.21, not the Node 26 the plans require**; every Node verdict assumes Node 26 behaves the same, which is PLAUSIBLE, not measured. Git: `core.autocrlf=true`, `core.filemode=false`, `core.symlinks=false`.
- **Evidence labels:** MEASURED (run on this machine), SOURCE (read from code or plan text), PLAUSIBLE (reasoned, not run).
- **Who did what:** nine review agents (four Opus, five Sonnet) ruled slices of the rows. About 10% of the Sonnet rulings were spot-checked against the plan source. The repository was not modified; the only artifacts are this file and the extraction file.
- **Line numbers** refer to the plan files at `fac6b460a`.

## Windows findings, P1

### W01 — Bare `quarto` and extensionless launchers run the wrong build or nothing

**P1 · README rule 8, `_TEMPLATE.md` tooling table, every plan's ratchet and render steps.**

POSIX-only text, in about 147 bare and 91 extensionless commands: `quarto run --dev tools/check-runtime-boundary.ts`, `package/dist/bin/quarto render ...`, `package/pkg-working/bin/quarto render` (03:486, 20b:293), `./quarto --version` (00a:202), and `./quarto-bld`, `package/src/quarto-bld` (18 rows).

Windows consequence, MEASURED:
- `package/dist/bin/` has only `quarto.cmd`. Git Bash gives `No such file or directory` (exit 127); PowerShell works through PATHEXT.
- A bare `quarto` is whatever is on PATH. Here that is the Scoop 1.11.6, then the *main* checkout's `quarto.cmd`, never the worktree build. `quarto run --dev tools/check-runtime-boundary.ts` fails with ``Unable to load '.../scoop/apps/quarto-prerelease/src/import_map.json'`` (exit 1). Worse, `quarto render` silently exercises another version.

Phase 1 proposed `quarto` → `quarto.cmd` for these rows. That is wrong: a bare `quarto.cmd` still resolves through PATH.

**Amendment:** convention C1 in the README, plus README rule 8 and the `_TEMPLATE.md` tooling table rewritten to name `package/dist/bin/quarto.cmd`. After a `cd`, use an absolute path (`"$ROOT/package/dist/bin/quarto.cmd"`). The one correct bare `quarto` is PR 30 Task 3, which runs the *installed* release on purpose.

### W02 — `run-tests.sh` fails in Git Bash without `DENO_DIR=x86_64`; `$(find)` is not PowerShell

**P1 · 321 rows across nearly every plan; `_TEMPLATE.md:93`; README "How to execute a plan".**

POSIX-only text: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent $(find unit/ral -name '*.test.ts')`.

Windows consequence, MEASURED: `run-tests.sh:53` reads `DENO_DIR` as the arch directory, so Git Bash prints `package/dist/bin/tools//deno: No such file or directory`. Only plan 02 knows this, in its execution log (02:1172). In PowerShell, `find` is FIND.EXE, a text search. PR 27:1933 `.\run-tests.ps1 --agent unit/ral/` exits 1, because the ps1 runner rejects directory arguments (`run-tests.ps1:189-215`).

**Amendment:** convention C2. In 27:1933, write `.\run-tests.ps1 --agent (Get-ChildItem unit/ral -Recurse -Filter *.test.ts).FullName`.

### W03 — Scripts created on Windows lose their executable bit

**P1 · 00b:268 `update-lock.sh`, 05 Task 7 `parsehtml-timing.sh`, 20:106 `parsehtml-gate.sh`, 22:126 `rewrite-import-specifier.sh`, 26:197/1381 `quarto-node`, 31:1077 `run-tests-node.sh`, 38:461.**

POSIX-only text: `chmod +x <script>`, or "Create `<script>` (mode 755)".

Windows consequence, MEASURED in a scratch repo: with `core.filemode=false`, `chmod +x` does not reach the index, so the file commits as `100644`. Linux and macOS CI then fail with `Permission denied`. Examples: the ubuntu `node-unit` step runs `./run-tests-node.sh` (31:1437); `node-render` runs `tools/node-bundle/quarto-node --version` (26:2145), where `continue-on-error` hides the failure; PR 29:1180 runs `quarto-node preview` directly.

**Amendment:** convention C4. In each plan's commit step, add `git update-index --chmod=+x <file>` (or `git add --chmod=+x <file>`), and check that `git ls-files -s <file>` shows `100755`. Add the same check to the review checklists of PRs 26 and 31.

### W04 — `node --import` with an absolute Windows path cannot load

**P1 · 31:93 (interface), 31:875 (`run-tests-node.sh`), 31:1028 (`run-tests-node.ps1`), 31:580-581 (`tests/utils.ts` `runHarness`), 31:462 (hook test), 35:1902 and 35:143.**

POSIX-only text: `--import "$QUARTO_ROOT/tools/node-bundle/register-import-map.mjs"`, `--import (Join-Path $Env:QUARTO_ROOT ...)`, `["--import", join(srcDir, "..", "tools", "node-bundle", "register-import-map.mjs")]`.

Windows consequence, MEASURED in `C:/...`, `/c/...` and `C:\...` forms: Node reads `C:` as a URL scheme and fails with `ERR_UNSUPPORTED_ESM_URL_SCHEME`.
- Every `run-tests-node.*` run fails before the first test.
- The windows-latest `node-unit` leg goes red.
- After PR 35, `quarto run --dev` cannot start on Windows, and the boundary ratchet with it.

**Amendment:** pass a `file:` URL.
- `.sh`: `REGISTER_IMPORT_MAP="file:///$(cygpath -m "$REGISTER_IMPORT_MAP")"` under `msys*`/`cygwin*`, exported next to `NODE QUARTO_ROOT` (31:892, 31:899).
- `.ps1`: `([System.Uri](Join-Path ...)).AbsoluteUri`.
- TS: `toFileUrl(join(...)).href` (`src/deno_ral/path.ts` exports `toFileUrl`).
- `.mjs`: `pathToFileURL(...).href`.
- Add to the 31 Spec: "`--import` takes a URL or a `./`-relative specifier, never an absolute path." See also convention C7. The forms above were MEASURED to load. `--require <absolute path>` is fine.

### W05 — `run-tests-node.ps1` exits 0 when tests fail and hides their output

**P1 · 31:1023-1057 (both variant bodies).**

POSIX-only habit: the script runs `& $NODE ... @files` inside `Run-TestFiles`, ends the function with `return $LASTEXITCODE`, then does `$code = Run-TestFiles ...` and `Exit $code`.

Windows consequence, MEASURED: PowerShell captures node's whole stdout into the function's return value, so `$code` is an `Object[]`. The user sees no test output, and node's exit 3 becomes script exit 0. No CI job runs the ps1 in this PR (31:1440).

**Amendment:** end both node calls with `| Out-Host` (MEASURED: output is shown and exit 3 is kept). Add a Windows Verification line: `./run-tests-node.ps1 --agent unit/path.test.ts; "exit=$LASTEXITCODE"` (expect 0), then the same on Task 5's failing `unit/zz-timer.test.ts` (expect 1).

### W06 — PR 14b's preview helper starts `quarto.cmd` detached, so no output ever arrives

**P1 · 14b:485-494 (`startPreview`); blocks the Windows evidence cited by 14b:121/650, 28, 29:1223 and 34:77.**

POSIX-only text: `detached: true, // Neither launcher execs the runtime: stop the whole group (POSIX) or tree (Windows)`.

Windows consequence, MEASURED on Deno 2.7.14 and Node 24: a detached child has no console, so console programs it starts write nowhere. Detached `quarto.cmd --version` gives stdout `""`; non-detached gives `quarto 99.9.9`. `Browse at` never arrives, `waitFor` times out after 60 s, and both preview tests fail on Windows.

**Amendment:** write `detached: !isWindows` (import `isWindows` from `src/deno_ral/platform.ts`), with this comment:

```
// POSIX: lead a group so killProcess(-pid) reaches the runtime behind the launcher.
// Windows: taskkill /T walks parent pids and needs no detached; a detached cmd.exe
// has no console, so deno.exe's output would not reach these pipes.
```

Reword 14b:93-94 and 14b:452-455. In PR 28:71 and PR 08:103-106, say that Node's `detached` sets `DETACHED_PROCESS`, and that Quarto never passes `detached` on Windows.

### W07 — PR 14b's Windows tree-kill case gets no grandchild pid, and its PowerShell child can kill the test runner

**P1 · 14b:353-391; 14b:236-239; 14b:28; 28:772.**

POSIX-only design: `spawn("powershell", [..., "-Command", kWindowsScript], { detached: true })`, with `Start-Process -PassThru -WindowStyle Hidden ping ...`.

Windows consequence, MEASURED:
- A detached powershell or pwsh child prints nothing, so the case fails with `no grandchild pid in ""`, on Deno and Node alike.
- On the maintainer's machine, Deno spawning `powershell.exe` with the literal text `-WindowStyle Hidden` in its arguments terminates the Deno test process itself (exit 127 in Git Bash, 0xE0000027 in PowerShell). Node is not affected. This is probably endpoint security; CI behaviour is unknown.

**Amendment:** a non-detached runtime child that starts the grandchild itself. This was MEASURED green on `Deno.Command`, on Deno's node compat layer and on Node:

```ts
const kWindowsChild = 'import("node:child_process").then(({ spawn }) => { const c = spawn("ping", ["-n", "31", "127.0.0.1"], { stdio: "ignore", windowsHide: true }); console.log(c.pid); });';
const child = spawn(execPath(), {
  args: "Deno" in globalThis ? ["eval", kWindowsChild] : ["-e", kWindowsChild],
  stdin: "null", stdout: "piped", stderr: "null",
});
```

Edit 14b:28, 14b:236-239 and table row 38 to match. In 28:772, change "on a detached PowerShell child" to "on a runtime child".

### W08 — `file://$PWD` URLs in Git Bash point nowhere, and the check reads the empty result as success

**P1 for 07:652-658 (Task 6 Step 3); P2 for 00b:679-680 (Task 6 Step 1).**

POSIX-only text: `echo "import \"file://$PWD/$f\";"`.

Windows consequence, MEASURED: Git Bash's `$PWD` is `/c/Users/...`, so Deno gets `file:///c/Users/...`. `deno info --json` exits 0 and records `Module not found` inside the JSON. In PR 07, the next step then prints every `https://deno.land/std...` redirect key as `UNUSED`, and **Step 4 deletes live import-map keys**. In 00b, the comparison lists nothing, which reads as "already clean".

**Amendment** (both plans):
1. Build the root URL portably: `ROOT_URL=$(node -e 'console.log(require("url").pathToFileURL(process.cwd()).href)')`, then `echo "import \"$ROOT_URL/$f\";"`. MEASURED; this works on every OS.
2. Add a guard that must print `0`: `jq '[.modules[]|select(.error)]|length' "$T/info.json"`.

Convention C3 forbids `file://` URLs built from `$PWD`.

### W09 — `rewrite-import-specifier.sh` writes corrupt import specifiers on Windows

**P1 · 22:117-120, the tool run by 22 and 23:782-787.**

POSIX-only text: `rel=$(python3 -c "import os,sys; print(os.path.relpath(...))" "$new" "$f")`, then `case "$rel" in ../*)`, then `sed -i "s#from \"${old}\"#from \"${rel}\"#g"`.

Windows consequence, MEASURED on a reconstruction of the script:
- `python3` may be the Microsoft Store stub.
- Real Python returns `..\src\deno_ral\colors.ts`, so the `case` misses and `./` is prepended.
- sed turns `\s`, `\d`, `\c` into letters plus a 0x0F byte, so every rewritten import is corrupt.
- `sed -i` also converts a CRLF file to LF (W20).

**Amendment** (MEASURED end to end at three directory depths):

```bash
rel=$(node -p "const p=require('node:path').posix; p.relative(p.dirname(process.argv[2]), process.argv[1])" "$new" "$f")
```

Also use `sed -b -i`. This removes Python from the tool.

### W10 — The PR 25 consumer check passes vacuously on Windows

**P1 · 25:182-184.**

POSIX-only text: `deno info ... | python3 ... | xargs grep -ln 'Deno\.copy\b\|Deno\.writeAll\b' 2>/dev/null`.

Windows consequence, MEASURED: the paths are `C:\...` with CRLF. `xargs` strips the backslashes, so every `grep` fails with "No such file". `2>/dev/null` hides the errors, and the step prints nothing, which the plan reads as "no consumer found".

**Amendment:** `... | jq -r '.modules[] | select(.local) | .local' | tr -d '\r' | xargs -d '\n' grep -ln 'Deno\.copy\b\|Deno\.writeAll\b'`, without `2>/dev/null`. MEASURED: 5 hits on the current tree, which is pre-PR 03/04 (see 25:187's stated assumption).

### W11 — Both cross-process lock loops die on transient Windows `EPERM`

**P1 · 30:577/611/633/639 (`readOwner`, `breakLock`, `lockIndex`); 33:881-964 (`ensure.mjs` lock).**

POSIX-only text: `if (isNotFound(e)) return undefined;`, `if (!isAlreadyExists(e)) throw e;`, `if (e.code !== "EEXIST") throw e;`, `if (e.code === "ENOENT") return undefined;`.

Windows consequence, MEASURED with the plans' code extracted verbatim: while one process removes the lock directory, it stays "delete pending", so another process's `open`, `stat`, `mkdir` or `rename` fails with `EPERM`.
- PR 30 kv, 3 processes × 60 writes: 4 of 11 runs failed on Node 24 and 2 of 5 on Deno (`entries: 179 expected 180`).
- PR 33 ensure lock, 8 processes × 40 acquisitions: 3 of 24 runs crashed.

PR 30's own 180-entry test and its "must not flake" Verification would fail on the Windows legs. A flaky test must not be parked in the `windows` known-failures list.

**Amendment:** treat `EPERM`/`EACCES`/`EBUSY` on win32 as transient (retry, or "not there yet") at each listed site.
- PR 30: `const isTransient = (e) => process.platform === "win32" && ["EPERM","EACCES","EBUSY"].includes(e.code ?? "")`, OR-ed into the four conditions. MEASURED: 8/8 and 3/3 clean runs on Node, 5/5 on Deno.
- PR 33: the same codes in `readOwner`, the `mkdir` catch and `breakLock`, plus `rmSync(lockDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 20 })`. MEASURED: 0 of 24 failed.
- Record the rule once in PR 30's lock-ownership contract, since both PRs follow it.

### W12 — `gen-tsconfig-paths --check` fails on every Windows checkout

**P1 · 33:2718-2722 (Task 12).**

POSIX-only text: `const current = fs.readFileSync(out, "utf8"); if (current !== json) { ...; process.exit(1); }` for the root file `tsconfig.paths.json`.

Windows consequence, MEASURED with `git ls-files --eol`: root files are `w/crlf` on disk, and the generator emits LF. So `npm run typecheck` reports "out of date" on every fresh Windows clone. The executor who just generated the file will not see it. CI will not either: the typecheck job is ubuntu-only (33:2808).

**Amendment:** add `tsconfig.paths.json text eol=lf` to `.gitattributes` in Task 12, or compare `current.replace(/\r\n/g, "\n")`. See convention C6.

### W13 — No plan step runs the rewritten Windows files on Windows

**P1 · README Roles (README:191-193); 33 Verification (33:3215 "Linux or macOS"); 33:1310-1312 (only `./configure.sh`); 33:2370 (Rust launcher run on Linux/macOS); 37:153; 00b (Windows-listed, no Windows step).**

PRs 00b, 32, 33 and 37 rewrite `configure.cmd`, `check-deno-in-use.cmd`, `quarto-bld.cmd`, `quarto.cmd`, `run-tests.ps1`, `download.bat` and the Rust launcher `main.rs`, which ships *only* on Windows. CI partly covers them: the quarto-dev action and test-smokes on Windows. But CI sets `QUARTO_SKIP_DENO_CACHE_WIPE=1`, so the wipe-and-check path never runs, and `main.rs` runs only in a dispatched create-release. W18, W19 and the check-node-in-use defect in the P3 table are Windows-only defects that none of the prescribed steps can surface.

**Amendment:**
- Add PRs 32, 33 and 37 to the README Windows manual-verification row. (00b is already listed; give it the steps it lacks.)
- Add a "Windows (Git Bash or PowerShell)" block to the Verification of 00b, 33 and 37:
  - `./configure.cmd` (expect `99.9.9` and the tools listing);
  - `package/src/quarto-bld.cmd --help`;
  - the plan's unit files through `run-tests.ps1`;
  - one `package/dist/bin/quarto.cmd render`;
  - for 33, Task 10 Step 2 from Git Bash after `quarto-bld.cmd prepare-dist` (it runs as written there, MEASURED), and the check-node-in-use case of the P3 table;
  - for 00b, the frozen-lock failure must make `./configure.cmd` exit non-zero (after W17).

### W14 — The test-install `install-deno-tool` job calls a bare `quarto` from bash on windows-latest

**P1 · 33:2641-2649 (kept by 37:214).**

POSIX-only text: `shell: bash` ... `quarto install deno --no-prompt` ... `out=$(quarto run s.ts)`.

Windows consequence, MEASURED: Git Bash does not resolve a bare name to `.cmd`, so the step fails with `quarto: command not found` and Acceptance 33:226 cannot go green.

**Amendment:** reuse the wrapper step that `test-install.yml:89-96` already uses. It writes `printf '#!/bin/bash\nexec "%s" "$@"\n' "$(command -v quarto.cmd)"` to a `quarto` file next to `quarto.cmd`, under `if: runner.os == 'Windows'`.

### W15 — `run-tests.sh` binary mode and the bash Node runner reject or miss Windows paths

**P1 for 31:828 (blocks binary mode on Windows); P2 for 31:849 and 31:893.**

POSIX-only text:
- `if [[ ! -x "$QUARTO_TEST_BIN" ]]` (31:828; the same guard as today's `run-tests.sh:77`);
- `QUARTO_VENV_ACTIVATE=".../tests/.venv/bin/activate"` (31:849);
- `/usr/bin/time -f ... -a -o` (31:893, 31:900).

Windows consequence, MEASURED:
- In Git Bash, `-x` is false for `quarto.cmd`, so binary mode against a Windows build stops with "not executable".
- uv creates `.venv/Scripts/activate` on Windows, so the venv is skipped silently, and smoke documents that execute Python run without the test environment.
- GNU `time` is absent from Git Bash.

**Amendment:**
- 31:828: `if [[ ! -x "$QUARTO_TEST_BIN" ]] && ! [[ "$OSTYPE" == msys* && "$QUARTO_TEST_BIN" == *.cmd && -f "$QUARTO_TEST_BIN" ]]`. The same guard in `run-tests.sh:77` is a pre-existing bug, tracked separately.
- After 31:849: fall back to `Scripts/activate`.
- Mark the timing Verification (31:1498) "(Linux/macOS)", or switch to bash `time` with `TIMEFORMAT`.

## Windows findings, P2

### W16 — Contradictory claims about preview tests on Windows

**15:596, 17:92 vs 14b:51/121/650/773/1046, 29:1223, 34:77.** PR 15 says "`preview-reload` is ignored on Windows"; PR 17 says "(polling watcher path; ignored on Windows)". PR 14b says both preview tests run on Windows, and PRs 29 and 34 cite them as Windows evidence. Three review agents confirmed this independently. **Amendment:** in 15:596, write "`preview-reload` runs on Windows too (PR 14b)"; in 17:92, write "(polling watcher path; runs on every OS)". Both pass on Windows only once W06 is applied.

### W17 — PR 00b's Windows lock path fails silently

**00b:132, 256-260, 282, 316-322, 487-512, 1190, 1227.**

- `configure.cmd:98` calls `vendor.cmd` with no ERRORLEVEL check (SOURCE). So 00b's frozen-lock failure prints an error and configure still exits 0, and CI's sanity checks (`quarto --version`, `--paths`) never start Deno. **Amendment:** in Task 2 Step 3, follow the call with `IF ERRORLEVEL 1 EXIT /B 1`.
- "Windows: set QUARTO_DENO_LOCK_MODE=update, then run configure.cmd" is cmd.exe syntax. In PowerShell and Git Bash it sets no env var (MEASURED). There is also no `--refresh` form, and without `QUARTO_SKIP_DENO_CACHE_WIPE=1` the run wipes all of `package/dist`. **Amendment:** write `$env:QUARTO_DENO_LOCK_MODE='update'; $env:QUARTO_SKIP_DENO_CACHE_WIPE='1'; ./configure.cmd` (PowerShell), or run `update-lock.sh` from Git Bash (its preamble and argument conversion work there, MEASURED). For `--refresh`, delete `deno.lock` first. Run refreshes on Linux or CI: npm optional dependencies make the lockfile differ per platform (20:215 and 20b:188 too).
- After Task 2 Step 6's restore, the next `quarto.cmd` says "Quarto requires reconfiguration". **Amendment:** "Windows: run `./configure.cmd` again after the restore".
- `download.bat:5` defaults to `...\dist\bin\tools\deno`, which does not exist on Windows (MEASURED). **Amendment:** in Task 4 Step 1, use `tools\x86_64\deno.exe`, and add the Windows form of Step 2. `lock.sh` has no Windows twin; say that it runs from Git Bash.
- 00b:1161 `RUNNER_OS=$(uname)` sends Windows to the missing extensionless launcher. Run the body as a child `bash` script, with an unconditional `mv` back afterwards (every OS: `set -e` otherwise leaves the tree without `src/quarto.ts`).

### W18 — `exit /B 1` inside a parenthesised block returns 0 to the caller

**33:1208-1262 (`configure.cmd`), 33:2133-2147 (`quarto.cmd` version checks).** MEASURED on scratch replicas: the batch file stops, but bash, pwsh and `Deno.Command` all receive exit code 0. A failed Node download therefore passes the CI configure step, and a stale dev install makes every `quarto` call "succeed". **Amendment:** replace each `exit /B 1` with `GOTO :fail`, and add a top-level `:fail` / `exit /B 1` (MEASURED to propagate). Whether today's `quarto.cmd` has the same shape is tracked separately as a pre-existing question.

### W19 — `configure.cmd`'s Node download ignores the version override and skips the checksum

**33:1199-1201, 33:1222-1226, 33:27.** `NODE_ARCHIVE_DIR` is built before `QUARTO_NODE_VERSION` is applied, so an override downloads `.../v26.13.0/node-v26.12.0-win-x64.zip`, a 404 (MEASURED replica). The configure.cmd path also never verifies `SHASUMS256.txt`, although 33:27 promises a "checksum-verified" download. **Amendment:**
- Move the override above line 1199.
- Add the batch checksum block from the O4 review output. It is a `powershell -NoProfile` SHA-256 over `[IO.File]` APIs; `Get-FileHash` is unavailable when 5.1 is launched from a pwsh-started `.cmd`, and `findstr /E` misses LF-only lines. MEASURED: match → exit 0, altered archive → exit 1, from both shells.

### W20 — Git Bash `sed -i` strips every CR

**20:330-333 and 354-359 (the plan claims "`sed -i` keeps them"), 22 (W09), 37:124, 30 Task 4, 38:485.** MEASURED: GNU sed 4.9 under MSYS removed all 174 CRs from `quarto.cmd`, even on lines that did not match. The working-tree `.cmd` is LF-only until the next checkout; batch labels with LF-only endings are a known hazard (PLAUSIBLE). **Amendment:**
- Use `sed -b -i` (`--binary`) on `.cmd`, `.bat` and `.ps1` files. With `--binary`, `$`-anchored deletes need `\r\?$`.
- Replace 20's `file ... with CRLF line terminators` check with `git diff --stat <file>`.

See convention C6.

### W21 — Remote-import probes and import-map edits need the launcher's cache and a reconfigure

**02:988, 02:1252 (Task 3 Step 4 URL probe); 03, 04, 20 Task 3, 20b Task 1, 00b Task 2.**

- After any `src/import_map.json` edit, the Windows launcher stops with "Quarto requires reconfiguration". POSIX reconfigures by itself.
- The launcher runs `--cached-only`, so a probe that adds an uncached URL fails before the script runs. The 02 log's `deno cache <url>` warms the global cache, which the launcher never reads (MEASURED).

The POSIX launcher is also `--cached-only` (`package/scripts/common/quarto:71`), so the probe part probably fails on every OS when the URL is not cached.

**Amendment:** convention C5. In 02 Task 3 Step 4, add `DENO_DIR="$PWD/package/dist/bin/deno_cache" package/dist/bin/tools/x86_64/deno cache https://deno.land/std/path/mod.ts` (needs network) before the probes.

### W22 — Node spawns do not resolve `.cmd` or run `.sh`

- 28:566-575 `command()`: Deno resolves a bare name to `.cmd` on PATH (MEASURED `Deno.Command("quarto")` → `99.9.9`); Node returns `ENOENT`. Callers that pass bare `quarto` or `npm` break at the flip. **Amendment:** on Windows, when the name has no extension and no separator, search `PATH` × `PATHEXT` first, then route `.cmd`/`.bat` through `batchCommandLine`. Add a test that runs a `.cmd` by bare name.
- 35:2142 `execFileSync("quarto", ...)` resolves only `.com`/`.exe`, so it silently runs some other `quarto.exe` (MEASURED); `quarto.cmd` gives EINVAL. **Amendment:** spawn through the layer's exec, which handles batch files.
- 33:1504 `validate-bundle` spawns bare `npm`/`npx`, and node-dist ships `npm.cmd` (Node: ENOENT, MEASURED). **Amendment:** go through the layer's batch path, or label validate-bundle "Linux only (test-bundle.yml)".
- 31:1297-1301 `run-parallel-tests.mjs` spawns `./run-tests*.sh` with no shell (`EFTYPE`, MEASURED); 23:889's `Deno.Command("./run-tests.sh")` gives `os error 193`. **Amendment:** spawn `pwsh -NoProfile -File run-tests*.ps1` on win32, or label local-cores mode POSIX-only.

### W23 — PR 28's Windows evidence and the PR 08 contract do not line up

- 28:772: `node-unit` runs only `tests/unit/ral/`, but `process-group.test.ts` lives in `tests/unit/`. So PR 28's Node `taskkill` branch never runs on Node on Windows before PR 32. **Amendment:** add the file to Task 3 Step 2 and Task 6, or move it under `unit/ral/` in 14b.
- Every OS: PR 08:497-498 asserts exit 3 after a broken pipe, while PR 28 exits `process.exitCode ?? 0` on EPIPE. EPIPE does occur on Windows Node (MEASURED). PR 08:354 asserts `err.cause`, and PR 28's errors carry none. **Amendment:** in PR 28, set `brokenPipe` and let `exit()` set the code; wrap spawn errors as `new Error(..., { cause: e })` with `code`.

### W24 — Ports in Windows excluded ranges throw instead of reading as "in use"

**15:299-340 (`findOpenPort`), 29:267-282 (`isPortAvailable`).** MEASURED: binding 5357 (inside `[3000, 8000)`, excluded on this machine by Hyper-V/WinNAT) gives `PermissionDenied`/`EACCES`, not `AddrInUse`, and `findOpenPort` rethrows. `src/core/port.ts` has the same flaw today; it is tracked separately as a pre-existing bug. **Amendment** (both rewrites): in the random-probe loop, treat a win32 `EACCES` as unavailable and continue; keep throwing for an explicitly requested port.

### W25 — Node's recursive watcher floods events after the watched root is deleted

**29:1064-1075 (`watchNative`).** MEASURED on Node 24: 17k–40k `rename` events per 250 ms whose filename is the root in `\\?\C:\...` form. The consumer receives about 600 bogus `remove` events before the presence timer closes the watcher; the tests pass only by accident. Deno is clean. **Amendment:** `if (isAbsolute(filename.toString())) return;`, and a unit assertion that no event path contains `?`.

### W26 — `/tmp` means three different directories

**26:2018-2019, 31:1140, 31:1321; any PowerShell `/tmp`.** Git Bash converts `/tmp/x` *arguments* to `%TEMP%`, but not text inside `node -e '...'` strings, where node reads `C:\tmp\x` (MEASURED). PowerShell also reads `/tmp` as `C:\tmp`. Writer and reader therefore use different files. **Amendment:** use a gitignored repo-relative path (`tools/node-bundle/dist/kf.json`), or pass paths as argv. Convention C3.

### W27 — The known-failures steps assume Linux

**26:211, 26:2011, 26:2315; 31:115, 31:1493.** On Windows, `run-unit-on-node.mjs` uses the `windows` key, which is `{}` until written. So the documented check exits 1 and the expected output names the wrong OS. **Amendment:** "the executor's OS section (`linux`, `macos` or `windows`)"; commit only that section. 26:2018 also mutates `j.linux`; use the current-OS key.

### W28 — PR 14b's and PR 08's Windows manual checks are unsound

- 08:1731-1733: Git Bash `ps` sees only MSYS processes, `tasklist | findstr python` matches unrelated processes, and `| head -c 1; echo $?` reports `head`'s status. **Amendment:** take a `tasklist /FO CSV /NH /FI "IMAGENAME eq <x>.exe"` listing before and after, and use `${PIPESTATUS[0]}`.
- 08:886 expects 3 passes on Windows; MEASURED 4 (an early `return` counts as passed).
- 08:414-423: killing `cmd /c "ping ..."` orphans `ping` for 30 s on every run. Spawn `ping` directly.
- 14b:1037 (break 6): the expected outcome is wrong. The `TypeError` is thrown in the body, and `stopPreview` swallows errors, so the test hangs. **Amendment:** in `stopPreview`, rethrow anything that is not ESRCH after a `SIGKILL`.
- Tests: `quartoDevCmd()` returns a bare `quarto.cmd`, which resolves to the main checkout's build when run from a worktree (MEASURED with `where`). 14b Assumptions: "put this checkout's `package/dist/bin` first on PATH". This is tracked separately as test infrastructure.

### W29 — Steps that cannot run, or check nothing, on Windows

| Plan:line | Text | Windows consequence | Amendment |
|---|---|---|---|
| 03:485 | `export ... XDG_CACHE_HOME=$(mktemp -d)` | Ignored: the Sass cache is `%LOCALAPPDATA%\quarto\sass` (`src/core/appdirs.ts:155`) | also set `LOCALAPPDATA` to a temp dir |
| 04:735-737 | install `meca` "so the validation actually runs" | `tests/verify.ts:1328` skips validation on Windows | Windows: `meca validate <zip>` by hand, record in PR |
| 07:558-565 | `quarto uninstall chromium` | deletes the real `%LOCALAPPDATA%\quarto\chromium` (MEASURED present) | override `LOCALAPPDATA` to a temp dir |
| 19:105 | `quarto install tinytex` "(behaviour unchanged)" | nothing changed is exercised (darwin-only prerequisite); overwrites the real TinyTeX | skip on Windows; rely on the unit test |
| 24:68, 136-137 | `ls -l .../tools/pandoc` → symlink | regular file `pandoc.exe` (`configure.ts:169` skips the link on Windows) | label "Linux/macOS"; Windows expects `pandoc.exe` |
| 27b:410, 723 | RED: `EMFILE` | 2000 handles accepted on Windows (MEASURED) | "Windows: both cases pass before the change" |
| 30:893 | `kill -STOP` / `-CONT` | already scoped "Linux or macOS" by the plan | none (phase 2 rated this (c); it is not) |
| 37:105, 153 | `ls package/dist/bin/tools/*/deno` | passes vacuously: the binary is `deno.exe` | check `*/deno.exe` on Windows |
| 05 Task 3 Step 5 | criteria before Task 5 | `Error loading deno-dom-native` on Windows: `quarto.cmd:118` points at `tools\deno_dom\plugin.dll`, the file is in `tools\x86_64\` (MEASURED) | say so in Step 5, or set `QUARTO_DENO_DOM` to the real path; Task 5 fixes the launcher |
| 11:217, 27:1932 | `quarto create project ... <absolute dir>` | os error 123: `project.ts:130` joins the dir onto the cwd (also in 1.11.6; tracked separately) | create in a temp cwd with a relative name |

### W30 — Pids from Git Bash and interactive preview stops

- 33:3227 `"pid":$$`: an MSYS pid, so Node sees ESRCH and breaks the "live owner" lock at once (MEASURED). **Amendment:** `$(cat /proc/$$/winpid)`. In `quarto.cmd`, show the ensure line when `QUARTO_LAUNCHER_DEBUG=1`; the contract at 33:200 promises it.
- 15:598 and 16:691 rely on `... | grep Listening` and an interactive Ctrl-C. In Git Bash, `kill $!` reaches only the `cmd.exe` wrapper. **Amendment:** the Windows recipe MEASURED by S3:
  1. start the preview in the background;
  2. find the listener with `netstat -ano | grep :4321`;
  3. resolve the parent `cmd.exe` with `Get-CimInstance Win32_Process`;
  4. stop it with `taskkill /PID <pid> /T /F` from PowerShell.

  A second instance prints `Requested port 4321 is already in use`, exit 1.

Convention C8.

### W31 — Node 26 is a precondition the Windows machine does not meet

**SPIKES:29-30, 67; 26 Task 2.** The spikes and PR 26 onward require Node 26 (`engines >=26`); this machine has 24.21. `npm` only warns on EBADENGINE, so Node 24 results would be recorded as Node 26 evidence. **Amendment:** add a stop rule, "if `node --version` is not `v26.`, stop", next to SPIKES' Deno stop rule and in PR 26 Task 2. Installing Node 26 on the maintainer machine needs the maintainer's approval.

### W32 — PR 09's codemod fixtures will not compare on a Windows checkout

**09:2149-2150, 09:1549-1580.** The codemod inserts imports with a literal `"\n"`, and the test compares against `tools/codemod/fixtures/*.expected.ts`, which are CRLF on disk on Windows. CI runs only on Linux, so it would stay green (PLAUSIBLE; the directory does not exist yet). **Amendment:** add `tools/codemod/fixtures/** text eol=lf` with the fixtures. PR 23 Task 6: run a `--reverse` round trip, then `git diff --exit-code tests/unit`.

### W33 — PR 38's parity recipe is POSIX-only

**38:165-176.** `ROOT=$PWD` writes `/c/...` into `dprint.json` for a native `dprint.exe`; `DENO="$HOME/.local/share/quarto/deno/deno"` is wrong on Windows (`%LOCALAPPDATA%\quarto\deno\deno.exe`); the launcher is extensionless. **Amendment:** `ROOT=$(pwd -W 2>/dev/null || pwd)` and `DENO="$ROOT/package/dist/bin/tools/x86_64/deno"`. MEASURED: it formats `src/core/lib`.

Also:
- 38 Task 6: dprint's Deno preset forces LF, so `fmt:check` on a Windows working copy flags 486 CRLF files (PLAUSIBLE). Run it on Linux or CI, or set `newLineKind`.
- 38:330: the `argv[1]` main guard is false through a junction (MEASURED). Use `import.meta.main`.

### W34 — Docs written by PRs 26 and 31 give no Windows form

**26:2227-2235 (`node-bundle.md`), 31:1452-1459 and 1495 (`tests/README.md`), 31:1457 (binary mode against `quarto-node`).** An extensionless bash launcher cannot be spawned as `QUARTO_TEST_BIN` on Windows (ENOENT, MEASURED). **Amendment:**
- Add the PowerShell forms (`./configure.cmd`, `./run-tests-node.ps1 ...`).
- State that `quarto-node` runs from Git Bash until PR 32 adds `quarto-node.cmd`.
- Mark 31:1457 and 31:1495 "(Linux/macOS until PR 32)".

### W35 — CRLF on disk outside `src/`

`core.autocrlf=true`, and `.gitattributes` covers only `src/**`. So `tests/`, `tools/`, `package/` and the root are CRLF in Windows working copies (MEASURED). Specific cases already covered: W12, W20, W32, W33, and the new root `deno.lock` (00b:112; PLAUSIBLE, `--frozen` behaviour on CRLF not measured). New bash scripts check out CRLF on other Windows machines. Git Bash runs them (MEASURED), but WSL bash, which is what PowerShell's `bash` resolves to, rejects `\r` (PLAUSIBLE). **Amendment:** convention C6.

### W36 — PR 05's timing script receives the extensionless launcher

**05 Task 7 Step 2:** `tools/parsehtml-timing.sh package/dist/bin/quarto native 3`. Exit 127 in Git Bash (MEASURED). **Amendment:** pass `package/dist/bin/quarto.cmd`; MEASURED to write the metrics JSON. The script also needs W03's exec-bit step.

## Windows findings, P3

| Plan:line | Issue | Amendment |
|---|---|---|
| 14b:28, 188-189 | quotes the English `INFO: No tasks...`; tasklist output is localized (the code is locale-safe) | "prints a localized line, no CSV row" |
| 08:151, 743, 1254 | "Deno rejects SIGTERM on Windows": it registers and never fires | reword the comment |
| 28:212 | Node reports `close(null,"SIGTERM")` on Windows, Deno `{code:1}` | normalize, or state the difference |
| 08:770, 28:729 | only taskkill exit 128 is treated as failure | throw on any non-zero exit |
| 14b:296-306 | `stopTree` kills by pid after the test confirmed it gone (pid reuse) | skip pids already gone |
| SPIKES:529-537 | bash `time` prints a decimal comma under fr_FR | `LC_ALL=C` |
| 00b:368-370, 396 | lock paths split on a space in the batch lines | quote the whole `--lock=` argument |
| 00b:683, 05:506, 06:598 | Scoop `jq` prints CRLF | `| tr -d '\r'` |
| 20b:198-201 | `sha256sum` prints `<hash> *<path>` | compare the hash only |
| 25:151, 410; 33:3016, 3221; 37:31 | `rg` prints backslash paths | `rg --path-separator /` |
| 33:3049-3059, 37:284 | npm cache is `%LOCALAPPDATA%\npm-cache`, not `~/.npm` | OS-conditional cache path |
| 33:1576 | `spawnSync(npm, args, { shell })` prints DEP0190 | join the constant args into one string |
| 33:1306-1308 | check-node-in-use: two `Get-Process` lines, not one; blocking path never exercised | edit both lines; add the manual PowerShell case (O4 review output) |
| 33:2218, 2978 | tests run a stale `package/dist/bin/quarto.cmd` copy after a launcher edit (every OS) | re-run configure first |
| 15:738, 16:246 | refused loopback connect takes about 2 s on Windows | no step timeouts below 3 s |
| 17:383 | `touch` exists only in Git Bash | PowerShell `(Get-Item f).LastWriteTime = Get-Date` |
| 19:104 | `quarto check` progress lines carry CR | compare lines, not bytes |
| 20 Task 3 step 6 | `rm -rf .../deno_dom` while a Quarto process holds the DLL | stop Quarto first; list before deleting |
| 20:344 | `QUARTO_DENO_DOM=/anything` is rewritten by MSYS (harmless) | none needed |
| 20:100-190 | the parseHtml gate is bash-only | "Windows: Git Bash, or the CI job dispatched by the maintainer" |
| 29:1187, 1203 | trailing ` /` becomes `C:/Program Files/Git/`; a `VAR=x` prefix does not persist | rows 32 and 38 of the S5 review output |
| 14:390 | Deno `env.get` is case-insensitive on Windows; the Node copy is not | a Windows assertion in `env.test.ts` |
| 27 (info) | measured Node fs semantics on Windows (rename over open file, chmod, realpath casing) | for PR 27's reviewer; S4 review output Finding 16 |
| 30:279, 297 | test timers remove the lock with no retry (PLAUSIBLE race) | wrap in the W11 retry |
| SPIKES:346, 379 | Cliffy prompts never checked on Windows | manual Windows Terminal step |
| 06:157, 599 | `quarto` with no args or a bad flag prints differently on Windows | compare against the captured baseline, not the prose |
| SPIKES:112 | expected `src/quarto.ts -> ...` printed with backslashes | cosmetic |

## Defects on every OS (found along the way)

### E01 — PR 02 Task 3 Step 5 runs against an untracked baseline (this branch)

**P1 · 02:993-1006.** Step 5 runs before Step 6 commits `tools/runtime-boundary-baseline.json`, which is untracked on this branch (`git status`: `?? tools/runtime-boundary-baseline.json`).
- `git diff tools/runtime-boundary-baseline.json` prints nothing, so the step passes vacuously.
- `git checkout -- src/command/utils.ts tests/utils.ts tools/runtime-boundary-baseline.json` aborts on the untracked pathspec and leaves the probe lines in both files (MEASURED in a scratch repo).
- The `--accept-tests-increase` run has already raised the uncommitted baseline, which Step 6 would then commit.

**Amendment:** commit the baseline (current Step 6) before Step 5, or start Step 5 with `git add tools/runtime-boundary-baseline.json` and restore from the index. Update the expected numbers: L1006 says 814/992; this tree measures `994/49 7/0 10/1 240/3 828/177`.

### E02 — `cycle-dependencies -o <file>` cannot write a file

**P1 · 24:69, 177, 204.** `package/src/common/cyclic-dependencies.ts:21-24` declares `-o, --output` without a value (SOURCE, re-read for this review), so cliffy rejects the path: `No arguments allowed for command "quarto-bld [command] cycle-dependencies"` (MEASURED). This is pre-existing and tracked separately. **Amendment:** in PR 24 or earlier, declare `-o, --output <path:string>`, or verify with `--help` only.

### E03 — `deno check` gates expect exit 0, which the current tree cannot give

**P1 for the gates; 01, 02b, 03 (before PR 03 lands) and 04:983, 06:155/735/877, 07:743/777, 08:1674, 22:245/271, 24:138.**

- Without `--allow-import`, checking the CLI graph fails before type checking: `Requires import access to "cdn.skypack.dev:443"` (MEASURED). Skypack is in `src/import_map.json` until PR 03.
- With `--allow-import`, MEASURED for this review: `deno check --allow-import --unstable-kv --import-map=src/import_map.json package/src/bld.ts` exits 1 with 8 errors:
  - `Deno.run` TS2339 ×4 at `configure.ts:171` and `util/git.ts:49/67/113` (PR 08 removes these);
  - TS18046 at `dependencies/dependencies.ts:100`;
  - TS7053 ×3 at `update-html-dependencies.ts:1368-1369`.

**Amendment:** add `--allow-import` to every pre-PR 03 `deno check`. Then either fix the four non-`Deno.run` errors in an early PR (they are small), or reword the gates to "no new errors".

### E04 — `node --import tools/...` is a bare specifier

**P2 · `_TEMPLATE.md:126` and `:366`; 31:478 (a comment).** `ERR_MODULE_NOT_FOUND` on every OS (MEASURED). **Amendment:** `./tools/node-bundle/register-import-map.mjs`.

### E05 — Repo-relative paths used after `cd`

**P2.**
- 13:219 `cd $(mktemp -d) && package/dist/bin/quarto add ...`.
- 14:345-347: the same pattern. Also, a qmd with only inline `` `r` `` code is not claimed by knitr (MEASURED; add `engine: knitr`).
- 00b:149-152: a relative `D` inside `(cd src && "$D" ...)` prints `exit=127` for every entrypoint (MEASURED), so Task 1 halts on a phantom failure.
- 20:344: `mktemp -d` used inline loses the directory.

**Amendment:** capture an absolute path before the `cd` (`Q="$PWD/package/dist/bin/quarto.cmd"`, `D="$PWD/..."`).

### E06 — PR 02b's cast rewrite covers 4 of 7 sites

**P2 · 02b:599-607.** Lines 159, 195 and 217 are `const x = <T> await ...`, not `return <T> await ...`. The follow-up `rg -n '<\w+> '` is never empty, because it matches `Promise<Ticket> =>`. The `types.ts` casts moved to lines 369 and 378. **Amendment** (MEASURED on scratch copies):
- `perl -pi -e 's/<(\w+)> await response\.json\(\)/(await response.json()) as $1/'`;
- `perl -pi -e 's/\(<(\w+)> filter\)/(filter as $1)/' src/config/types.ts`;
- check with `rg -n '(return |= |\()<\w+> '`.

### E07 — `delimiter` is not exported by `deno_ral/path.ts`

**P2 · 36:353, 615.** The module exports `DELIMITER` (`src/deno_ral/path.ts:14-22`, SOURCE), so the plan's import is a type error. **Amendment:** `import { DELIMITER }` and `packageDirs.join(DELIMITER)`. On Windows the value must be `;` (MEASURED).

### E08 — PR 08's `create --json` input is rejected

**P2 · 08:1374.** MEASURED: `must include a directive with a name, directory, and template`, rc 1. **Amendment:** `{"type":"project","directive":{"name":"p","template":"default","directory":"<dir>/p"}}`. MEASURED: prints `{"path":...,"openfiles":["_quarto.yml"]}`.

### E09 — Checks that pass vacuously

**P2.**
- 20b:878 `explain-all-cycles ... | grep -c` prints `0` whatever happens: the script writes nothing to stdout and spawns a nested `quarto preview`. Use `--toon cycles.toon` with a positive control.
- 23:742 `QUARTO_TEST_BIN=... cd tests && ./run-tests.sh` scopes the variable to `cd` only.
- 24:176: `git status` on the gitignored `package/pkg-working`; use `--ignored`.
- 33:3233: `grep` has no `-r`, so it never searches the two directories.
- 00b:705 imports `../../../../package/...`, one level above the root, so Step 3's pass count is unreachable.

### E10 — Wrong expected output

**P3.**
- SPIKES:150-154: the dev `--version` launchers only `echo`, so the startup ratio compares a Deno start with an `echo`.
- SPIKES:344: Node and Deno print `"\"a b\" & echo two\r\n"`.
- 32:372, 696: Node ≥23 prints `ℹ pass N`, not TAP.
- 19:104, 20:374, 22:81/246/271: `quarto-bld --help | head -3` shows no commands; use `grep -c prepare-dist`.
- 15:596: Chrome-dependent cases are not skipped (`launchScanBrowser` throws).
- 18:770: "cache hit > 0" cannot show cross-run reuse.
- 26:2199: `gh label list` shows 30 of 139 labels; use `--search`.
- 31:94: the vitest invocation contradicts the code at 31:739.
- 28:1054: the `requireQuoting` callers list is stale.
- 36:1252: `npm install` is missing.
- 38:571 uses `git reset --hard HEAD~N` as a stop-condition revert; use `git revert`.

## Coverage and readiness by plan

Verdicts for a Windows executor:
- **Unchanged:** runs as written.
- **Conventions:** runs once the README conventions are applied.
- **Amend:** needs a plan amendment (W findings).
- **Blocked:** its Windows evidence depends on another plan's amendment.

"Every-OS" lists the E findings, which every executor needs regardless of OS. Rows are the phase-2 Part A rulings per file: a/b/c/d/n = works / adaptation / blocked / manual / not a command. Bulk rows are not included.

| File | Part A rows (a/b/c/d/n) | Windows verdict | Windows findings | Every-OS |
|---|---|---|---|---|
| README.md | 2/0/0/0/2 | Amend | W01 (rule 8), W02, W13 (Roles), C1–C8 | — |
| _TEMPLATE.md | 1/1/0/0/0 | Amend | W01, W02 | E04 |
| SPIKES.md | 24/12/5/0/1 | Amend | W31, P3 rows | E10 |
| 00-assessment.md | 0/0/0/0/3 | Unchanged | — | — |
| 00a-deno-bump.md | 1/0/0/0/0 | Conventions | W01 | — |
| 00b-lockfile-and-bundle-gate.md | 10/7/1/0/6 | Amend | W03, W08, W13, W17, W35 | E05, E09 |
| 00c-quarto-run-deprecation-notice.md | 0/1/0/0/2 | Conventions | W01, W02 | — |
| 01-quick-fixes-from-spike.md | 1/0/0/0/0 | Conventions | W01, W02 | E03 |
| 02-runtime-boundary-check.md | 0/0/1/0/1 | Amend | W21 | **E01** |
| 02b-node-compatible-ts-syntax.md | 5/1/0/0/1 | Conventions | W01, W02 | E03, E06 |
| 03-deps-skypack-to-npm.md | 8/11/1/0/1 | Amend | W21, W29 | E03 |
| 04-deps-deno-land-x-small.md | 2/13/1/0/0 | Amend | W21, W29 | E03 |
| 05-deps-deno-dom-jsr.md | 0/10/0/0/10 | Amend | W03, W29, W36 | E03 |
| 06-deps-cliffy-jsr.md | 1/8/0/0/0 | Conventions | P3 only | E03 |
| 07-remove-puppeteer-and-chromium-tool.md | 6/4/1/0/0 | Amend | **W08**, W29 | E03 |
| 08-ral-process.md | 7/2/0/0/22 | Amend | W28, P3 rows | E03, E08 |
| 09-ral-fs-and-temp-layer.md | 3/2/0/0/0 | Amend | W32 | — |
| 10-codemod-fs-core.md | 2/0/0/0/0 | Conventions | — | — |
| 11-codemod-fs-command.md | 1/3/1/0/0 | Amend | W29 (create project) | — |
| 12-codemod-fs-project-format.md | 1/1/0/0/0 | Conventions | — | — |
| 13-codemod-fs-rest.md | 1/0/0/0/1 | Conventions | — | E05 |
| 14-ral-env.md | 8/5/1/0/1 | Conventions | P3 row | E05 |
| 14b-coverage-first.md | 0/3/4/0/12 | Amend | **W06, W07**, W28, P3 rows | — |
| 15-ral-net-async-ports.md | 1/1/0/2/1 | Amend | W16, W24, W30 | E10 |
| 16-ral-http.md | 0/1/1/1/4 | Amend | W30 | — |
| 17-ral-watch.md | 0/3/0/0/5 | Amend | W16 | — |
| 18-ral-kv.md | 0/6/0/0/4 | Conventions | — | E10 |
| 19-ral-platform-main-permissions.md | 2/7/1/0/0 | Amend | W29 | E10 |
| 20-remove-deno-dom-ffi.md | 2/7/2/0/2 | Amend | W03, W17, W20 | E05 |
| 20b-hidden-deno-uses.md | 1/9/1/0/0 | Amend | W17, P3 rows | E09 |
| 22-std-import-seams.md | 4/9/1/0/1 | Amend | **W09**, W03, W20 | E03 |
| 23-codemod-tests.md | 2/12/6/0/0 | Amend | W09 (via 22), W22, W32 | E09 |
| 24-codemod-package-src.md | 1/15/4/0/1 | Amend | W29 | **E02**, E03, E09 |
| 25-boundary-zero-and-monkey-patch-removal.md | 0/9/0/0/2 | Amend | **W10** | — |
| 26-node-build-job.md | 19/11/2/0/21 | Amend | W03, W26, W27, W31, W34 | E10 |
| 27-ral-fs-on-node-apis.md | 11/1/2/0/1 | Amend | W02 (ps1 dir), W29 | — |
| 27b-ral-platform-env-tar-log-on-node.md | 21/0/1/0/2 | Amend | W29 | — |
| 28-ral-process-on-node-apis.md | 10/3/1/0/4 | Blocked (on 14b W06/W07) | W22, W23 | — |
| 29-ral-net-http-watch-on-node-apis.md | 17/1/1/0/0 | Blocked (on 14b W06) | W24, W25 | — |
| 30-ral-kv-on-node.md | 7/0/1/0/3 | Amend | **W11** | — |
| 31-test-harness-on-node.md | 5/4/25/0/6 | Amend | **W04, W05**, W15, W22, W26, W27, W34 | E04 |
| 32-node-ci-required.md | 4/4/2/0/2 | Amend | W13 | E10 |
| 33-build-tooling-node.md | 11/17/5/0/16 | Amend | **W11, W12, W13, W14**, W18, W19, W22, W30 | E09 |
| 34-installers-and-check.md | 0/2/3/3/5 | Blocked (on 14b W06) | W16 | — |
| 35-user-scripts-compat.md | 2/4/2/0/1 | Amend | **W04**, W22 | — |
| 36-build-ts-extension-node.md | 3/2/0/0/2 | Conventions | — | E07, E10 |
| 37-ci-switch-and-deno-removal.md | 7/3/2/0/11 | Amend | W13, W20, W29 | — |
| 38-lint-format-typecheck-tooling.md | 15/3/4/0/7 | Amend | W03, W20, W33 | E10 |
| 39-remove-quarto-latexmk-compile.md | 0/1/0/0/2 | Conventions | — | — |

Plans a Windows executor can run once the README conventions exist, with no plan edit: 00a, 00c, 06, 10, 12, 18, 39. Plans 01, 02b, 13, 14 and 36 also need only the conventions on Windows, but carry every-OS defects. Only 00-assessment runs entirely unchanged; it has no executor steps.

## Extraction quality (phase 1)

- **Completeness is good.** Three plans were re-extracted independently: 39 and 17 by full reading, and 33 by a scripted superset diff of every shell-block line and inline command span, with triage of the 364 unmatched lines. **1 command was missed out of about 213 (≈0.5%)**: 33:1009 `grep -n "package/dist" .gitignore`. No category was systematically missed. Two agent reports of further misses were checked and refuted: 26:1503 and 33:1506 are both in the extraction, as bulk rows.
- **Classification is the weak part.**
  - Of the 703 rows ruled in phase 2, 166 (24%) are not executor commands at all (code the PR writes, prose, CI-only text). Most come from the (u) class: 109 of 311 (u) rows.
  - Of the 392 definite (b)/(c) rows, 223 (57%) were reclassified. (c) rows went 31 to (a), 45 to (b), 39 to (n); 44 of 163 stayed (c).
  - Of the 125 (a) rows spot-checked, 6 (5%) were not (a). They are expected-output text with forward slashes, the exec bit at `git add`, and two every-OS defects. 16 more were not commands.
- **Two buckets were wrong as a whole.**
  - The Deno-path bucket (122 rows): the extensionless `tools/x86_64/deno` works in both shells, so about 112 rows are (a).
  - The bare-`quarto` amendment: phase 1 wrote "quarto → quarto.cmd", which still resolves through PATH to another build (W01). Only about 12 of 267 launcher notes named the full path.
- **Sonnet versus Opus slices.** About 10% of the Sonnet rulings were spot-checked against plan source (7 (c) verdicts, the claims marked VERIFY, 5 random reclassifications). Two disagreements were found:
  - 30:893 was rated (c), but the plan already scopes it to Linux and macOS;
  - 22:271 rated `quarto-bld --help` (a), where the `.cmd` convention makes it (b).

  Every agent quoted a clean `git status` at the end of its run.

## Conventions to record once in the README

A plan then says "Windows: see README conventions" instead of repeating them.

- **C1 Launchers.** On Windows, use the `.cmd` form whenever one exists: `package/dist/bin/quarto.cmd`, `package/src/quarto-bld.cmd`, `./configure.cmd`. Never use a bare `quarto` or `deno` from PATH; it is another build. After a `cd`, use an absolute path. A per-worktree bash shim like `test-install.yml:94-96` is an alternative for Git Bash only.
- **C2 Test runner.**
  - Git Bash: `cd tests && DENO_DIR=x86_64 QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent <files>`. The `DENO_DIR` prefix goes on `run-tests.sh` only; under `quarto-bld` it makes Deno write a cache into `package/src/x86_64/`.
  - PowerShell: `$env:QUARTO_TESTS_NO_CONFIG='true'; ./run-tests.ps1 --agent <files>`, with `(Get-ChildItem <dir> -Recurse -Filter *.test.ts).FullName` in place of `$(find ...)`. `run-tests.ps1` takes files, not directories.
- **C3 Shells.** Bash snippets run in Git Bash unchanged, with these exceptions:
  - not available: `/usr/bin/time`, `pgrep`, `pkill`, `lsof`, procps `ps` flags;
  - use `py -3` or `uv run` instead of `python3` (it may be the Microsoft Store stub);
  - never build `file://` URLs from `$PWD` (use `pathToFileURL` or `pwd -W`);
  - `/tmp` is converted for arguments but not inside `node -e` strings;
  - under PowerShell, `/tmp` means `C:\tmp`.

  Use `npm`, not `npm.cmd`: under nvm, `npm.cmd` is absent from Git Bash.
- **C4 Executable bit.** After creating any script: `git update-index --chmod=+x <file>` (or `git add --chmod=+x`), then check that `git ls-files -s <file>` shows `100755`. `chmod +x` does nothing for git here.
- **C5 Reconfigure and cache.** After any `src/import_map.json` change, run `./configure.cmd` once before the next `quarto.cmd` call. The launcher is `--cached-only`, so warm `package/dist/bin/deno_cache` (with `DENO_DIR` set to it) before a probe adds a remote import.
- **C6 Line endings.** Files outside `src/` are CRLF in Windows working copies. Compare text, not bytes. Edit `.cmd`, `.bat` and `.ps1` files with `sed -b -i` or an editor, never plain `sed -i`. For new generated or checked-against files (`tsconfig.paths.json`, `deno.lock`, codemod fixtures, `*.sh`, `quarto-node`), add `text eol=lf` lines to `.gitattributes`. Which lines to add is a decision for the maintainer.
- **C7 Node.** `--import` takes `./relative` or a `file:` URL, never an absolute Windows path. Node does not resolve `.cmd` for bare names and cannot spawn `.sh`: route batch files through the layer's batch path, and never call `execFileSync("quarto")`.
- **C8 Pids.** Never hand Git Bash `$!` or `$$` to Windows tools; use `/proc/<pid>/winpid`. Stop process trees with `taskkill /PID <pid> /T /F` from PowerShell. Never stop processes by name.
- **Node 26.** Check `node --version` before PR 26 and the spikes (W31).

## Proposed order of amendments

1. **README conventions C1–C8**, with README rule 8 and the `_TEMPLATE.md` tooling table corrected. This alone makes about 900 rows runnable.
2. **E01 and W21 in PR 02**, before this branch's Task 3 Step 5 runs.
3. **14b's W06 and W07.** PRs 28, 29 and 34 take their Windows evidence from 14b.
4. Then the remaining P1 findings, each before its PR: W08 (07), W09 (22), W10 (25), W04 and W05 (31), W11 (30, 33), W12–W14 (33), W15 (31), and E02 and E03 (before 24 and the `deno check` gates).
