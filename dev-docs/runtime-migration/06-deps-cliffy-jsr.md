# PR 06: Cliffy 1.0.0-rc.3 to `@cliffy/*` 1.3.1 on JSR

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve every `cliffy/...` import from the JSR packages `@cliffy/command`, `@cliffy/prompt`, `@cliffy/table` and `@cliffy/ansi` at 1.3.1, fixing the three source files whose imports no longer exist, with the other 65 importers untouched.
**Phase:** 0. **Depends on:** none. **Unblocks:** PR 26 (JSR Cliffy declares Node support; rc.3 pins pre-1.0 `deno.land/std` URLs the Node bundle had to remap).
**Branch:** `rt/06-deps-cliffy-jsr`.
**Suggested executor:** Opus. The edit is small but the CLI parser changed behaviour in several releases between rc.3 and 1.3.1 (help output, argument validation, error classes); deciding whether a smoke-test difference is a regression or an acceptable change needs judgement.
**Size:** L by blast radius (68 importers: 62 in `src/`, 5 in `package/src`, 1 in `tests/`; every command goes through Cliffy), S by edit count (import map, 3 source files, 1 test).
**Ships on:** Deno; the existing test suite must stay green.

## Spec

### Context

`00-assessment.md` section 3.4 (Cliffy row) and section 10, finding 4: rc.3 (July 2023) imports `https://deno.land/std@0.196.0/...` modules with export names that no longer exist in `@std`, which is why `src/import_map.json:63` carries a redirect for `std@0.196.0/console/unicode_width.ts`. `@cliffy/*` 1.x is published on JSR, declares Deno, Node and Bun support (rc.5 added Node, rc.6 Deno 2, 1.0.0 shipped Feb 2026), and depends only on `jsr:@std/*` 1.x and sibling `@cliffy/*` packages (verified from `https://jsr.io/@cliffy/command/1.3.1_meta.json`: `@std/fmt`, `@std/text`, `@cliffy/flags`, `@cliffy/internal`, `@cliffy/table`, `@cliffy/upgrade`).

Versions on JSR (verified 2026-10-14): `@cliffy/command`, `@cliffy/prompt`, `@cliffy/table`, `@cliffy/ansi`, `@cliffy/flags` are all at **1.3.1** (Sep 18, 2026). Pin all four to the same version; they share `@cliffy/internal`.

What Quarto imports today (grep over `src`, `package/src`, `tests`, `tools`; 68 files):

| Specifier | Files | Names | JSR 1.3.1 equivalent |
|---|---|---|---|
| `cliffy/command/mod.ts` | 47 in `src` (every `src/command/**/cmd.ts`, `src/core/log.ts`, `src/execute/types.ts`, `src/quarto-core/profile.ts`, `src/command/command.ts` as `import type`), 5 in `package/src` (`bld.ts`, `cmd/pkg-cmd.ts`, `common/compile-quarto-latexmk.ts`, `common/update-pandoc.ts`, `common/cyclic-dependencies.ts`), 1 test (`tests/unit/core/append-log-options.test.ts`) | `Command` (all), `ValidationError` (`src/command/use/cmd.ts:6`), `CompletionsCommand`, `HelpCommand` (`src/quarto.ts:11-15`, `src/command/render/latexmk/quarto-latexmk.ts:2-6`) | `jsr:@cliffy/command@1.3.1` exports `Command`, `ValidationError` and the `*Type` classes. **`HelpCommand` moved to the `./help` export and `CompletionsCommand` to `./completions`** (verified: `mod.ts` of 1.3.1 does not export them; `help/mod.ts` exports `HelpCommand`; `completions/mod.ts` exports `CompletionsCommand`, `BashCompletionsCommand`, `FishCompletionsCommand`, `ZshCompletionsCommand`). |
| `cliffy/command/command.ts` | `src/command/pandoc/cmd.ts:8`, `src/command/run/run.ts:7`, `src/command/typst/cmd.ts:7` | `Command` | same package root (`command.ts` is not an export; `Command` is on the root) |
| `cliffy/command/_errors.ts` | `src/quarto.ts:28` | `CommandError` | **not importable**: `_errors.ts` is internal and not in the JSR export map, and `mod.ts` exports only `ValidationError` (which `extends CommandError`). Every user-facing parse error in 1.3.1 is a `ValidationError` (`UnknownCommandError`, `TooManyArgumentsError`, `MissingRequiredEnvVarError`, `NoArgumentsAllowedError` and the flags errors all extend it; verified: `parse(["render", "--to"])` throws `ValidationError` "Missing value for option", `parse(["nosuch"])` throws `UnknownCommandError` which is `instanceof ValidationError`). The remaining `CommandError` subclasses (`DuplicateOptionNameError`, `CommandNotFoundError`, …) are programming errors that should surface as crashes. |
| `cliffy/prompt/mod.ts` | 18 files | `prompt`, `Select`, `Checkbox`, `Confirm`, `Input`, `Secret`, `SelectOption` (`src/command/publish/account.ts:8`), `SelectValueOptions` (`src/command/create/cmd.ts:19`) | `jsr:@cliffy/prompt@1.3.1` exports all of these except **`SelectValueOptions`**, removed by "remove deprecated types" in 1.0.0; the options array type is now `SelectOptions<TValue>["options"]` (`Array<string \| SelectOption<TValue> \| SelectOptionGroup<TValue>>`). Verified by `deno check`. |
| `cliffy/prompt/select.ts`, `input.ts`, `secret.ts`, `confirm.ts` | 3, 3, 2, 2 files under `src/publish/` and `src/command/publish/cmd.ts` | `Select`, `Input`, `Secret`, `Confirm` | `jsr:@cliffy/prompt@1.3.1/select`, `/input`, `/secret`, `/confirm` (all in the export map) |
| `cliffy/table/mod.ts` | `src/command/list/cmd.ts:7`, `src/command/use/commands/binder/binder.ts:36`, `src/extension/install.ts:9`, `src/tools/tools-console.ts:8` | `Table` (`.header()`, `.body()`, `.padding()`, `.toString()`) | `jsr:@cliffy/table@1.3.1` (single export) |
| `cliffy/ansi/mod.ts` | `src/core/console.ts:7` | `ansi.eraseLine.cursorLeft()` (line 181) | `jsr:@cliffy/ansi@1.3.1` (verified: the chain returns `"\x1b[2K\x1b[G"`) |

`Command` API used by Quarto, all present in 1.3.1 (`command.ts` of the package): `.name`, `.version`, `.description`, `.help({ colors: false })`, `.throwErrors`, `.command(name, cmd)` (two-argument form only; the 1.0.0 breaking change moved the *third* argument into an options object, which Quarto never passed), `.option(flags, desc, { global, hidden, ... })`, `.arguments`, `.action`, `.example`, `.hidden`, `.stopEarly`, `.parse(args)` (Quarto always passes the args explicitly: `src/quarto.ts:195`, `quarto-latexmk.ts:125`, `package/src/bld.ts:52`; nothing relies on Cliffy reading `Deno.args`), `.getName`, `.getDescription`, `.getUsage`, `.getOptions`, `.getExamples`, `.getCommands(true)`, `.hasOption` (test). `Command<any>` (`src/core/log.ts:49`, `src/quarto-core/profile.ts:35`, `src/command/command.ts:35`, `src/command/publish/cmd.ts:46`, `package/src/bld.ts:62`) still type-checks.

Changelog review, rc.3 → 1.3.1 (`https://raw.githubusercontent.com/c4spar/deno-cliffy/main/CHANGELOG.md`, lines 1-481; the rc.3 copy in `.spike-node/vendor/cliffy/CHANGELOG.md` ends at rc.3). Entries that touch Quarto's usage:

| Release | Change | Effect on Quarto |
|---|---|---|
| rc.4 | **BREAKING** ansi, prompt: remove `Deno.isatty()` and `rid` | Required for Deno 2 anyway; prompts use `Deno.stdin.setRaw`/`isTerminal`. No code change. |
| rc.4 | **BREAKING** remove executable sub-commands | Not used. |
| rc.4 | command: use `ValidationError` from the command module, not flags | `src/command/use/cmd.ts` already imports it from `cliffy/command/mod.ts`. |
| rc.5 / rc.6 | Node support; Deno 2 support; publish to JSR | The reason for this PR. |
| 1.0.0 | **BREAKING** `.command()` third argument becomes an options object | Not used (`grep -rnE '\.command\([^)]*,[^)]*,[^)]*\)' src package/src` is empty). |
| 1.0.0 | **BREAKING** remove deprecated types (command, flags, prompt, table) | `SelectValueOptions` gone: fix in `src/command/create/cmd.ts`. |
| 1.0.0 | `.parse()` on a child command throws (#833) | Quarto parses only root commands. |
| 1.0.0 | print help by default for container commands when no arguments are given (1.1.0 #870 family) | `quarto` with no arguments prints the root help and exits 0 (verified: `parse([])` prints help and the process exits inside Cliffy, so the `finally` block in `src/quarto.ts:206-214` does not run; `--help` behaves the same today). Confirm in Verification that `quarto` alone prints help. |
| 1.1.0 | flags: throw `TooManyArgumentsError` when non-flag arguments are passed to a command without arguments | Eight `cmd.ts` files declare no `.arguments()` (`capabilities`, `editor-support`, `call`, `call/typst-gather`, `dev-call`, `dev-call/typst-gather`, `dev-call/build-artifacts`, `tools`). They are either containers with subcommands or take none; `quarto tools list` still resolves the subcommand (verified: an unknown subcommand throws `UnknownCommandError`, a `ValidationError`). |
| 1.1.0 | allow leading dashes in positional arguments (#864); flags: positional argument support | Quarto's implicit-cwd hack (`src/quarto.ts:154-160`, `kCliffyImplicitCwd`) still works: `parse(["render", "<uuid>", "--to", "html"])` gives `input = "<uuid>"`, `args = ["--to", "html"]` with `.stopEarly()` (verified). Without the hack `render --to html` now parses `--to` as the declared option; the hack stays. |
| 1.1.0 | help output fully responsive, `width`/`maxWidth` options (#870) | `quarto --help` wraps to the terminal width; no test snapshots help text. Check by eye. |
| 1.1.0, 1.3.0 | skip optional options/arguments with an empty-string value; throw for empty values in *required* options | Quarto declares no required options (`<x>` without `[`) at the root; `.stopEarly()` commands receive raw args (verified: `render doc.qmd --to ""` gives `args: ["--to"]`). |
| 1.3.0 | automatic help colour detection; respect `setColorEnabled` | Quarto forces `.help({ colors: false })` on every command (`src/quarto.ts:177,183`); unchanged. |
| 1.3.0 | name short-only options after their first short flag | Quarto has no short-only options (`grep -rnE '\.option\(\s*"-[a-zA-Z](,| )'` filtered for lines without `--` is empty). |
| 1.2.0 | prompt: fuzzy search, `ctrl+n`/`ctrl+p`, word navigation | Additive; `quarto create` prompts gain keys. |
| 1.3.0 | `@cliffy/upgrade` extracted; providers deprecated | Not used (Quarto has no self-upgrade command). |

Not verified here (interactive): prompt rendering under `Deno.stdin.setRaw` on Deno 2.7 for `Select`/`Checkbox`/`Confirm`/`Input`/`Secret`. rc.6 declares Deno 2 support and the prompts are exercised by `quarto create` in Verification.

### Scope

In:
- import-map entries for the eleven `cliffy/...` specifiers in use (exact-match keys, so 65 files keep their import lines);
- `src/quarto.ts`, `src/command/render/latexmk/quarto-latexmk.ts`, `src/command/create/cmd.ts` edits;
- the `std@0.196.0/console/unicode_width.ts` redirect removal (and any other redirect `deno info` proves unused, as in PR 04 Task 7).

Out:
- renaming the specifiers to `@cliffy/command` etc. in all 68 files (a mechanical follow-up if wanted; see Decisions);
- adopting new Cliffy features (`.argument()` descriptions, `env` options, lazy subcommands);
- `quarto-latexmk`'s `flags` import (`parse` from `jsr:@std/flags@0.224.0`, PR 22).

### Interfaces

No Quarto interface changes. Import-map entries that replace `"cliffy/": "https://deno.land/x/cliffy@v1.0.0-rc.3/"`:

```json
    "cliffy/command/mod.ts": "jsr:@cliffy/command@1.3.1",
    "cliffy/command/command.ts": "jsr:@cliffy/command@1.3.1",
    "cliffy/command/help/mod.ts": "jsr:@cliffy/command@1.3.1/help",
    "cliffy/command/completions/mod.ts": "jsr:@cliffy/command@1.3.1/completions",
    "cliffy/prompt/mod.ts": "jsr:@cliffy/prompt@1.3.1",
    "cliffy/prompt/select.ts": "jsr:@cliffy/prompt@1.3.1/select",
    "cliffy/prompt/input.ts": "jsr:@cliffy/prompt@1.3.1/input",
    "cliffy/prompt/secret.ts": "jsr:@cliffy/prompt@1.3.1/secret",
    "cliffy/prompt/confirm.ts": "jsr:@cliffy/prompt@1.3.1/confirm",
    "cliffy/table/mod.ts": "jsr:@cliffy/table@1.3.1",
    "cliffy/ansi/mod.ts": "jsr:@cliffy/ansi@1.3.1",
```

Exact-match keys deliberately: an unmapped `cliffy/...` specifier (for example a new import of `cliffy/flags/mod.ts`) fails to resolve instead of silently reaching `deno.land`. The three per-file fixes:

```ts
// src/quarto.ts and src/command/render/latexmk/quarto-latexmk.ts
import { Command } from "cliffy/command/mod.ts";
import { HelpCommand } from "cliffy/command/help/mod.ts";
import { CompletionsCommand } from "cliffy/command/completions/mod.ts";

// src/quarto.ts: catch user errors
import { ValidationError } from "cliffy/command/mod.ts";   // replaces CommandError from _errors.ts

// src/command/create/cmd.ts
import { prompt, Select, type SelectOptions } from "cliffy/prompt/mod.ts";
type SelectValueOptions = SelectOptions<string>["options"];
```

### Files

- Modify: `src/import_map.json:35` (`cliffy/`), `:63` (`std@0.196.0/console/unicode_width.ts` redirect)
- Modify: `src/quarto.ts:11-15,28,203`
- Modify: `src/command/render/latexmk/quarto-latexmk.ts:2-6`
- Modify: `src/command/create/cmd.ts:19,180-183`
- Test: `tests/unit/core/append-log-options.test.ts` (unchanged; it is the unit test that exercises `Command` directly)
- Test: `tests/unit/core/quarto-command-errors.test.ts` (new: user errors are `ValidationError`)
- Modify: `dev-docs/runtime-migration/README.md` (PR 06 row status)

### Acceptance criteria

- `grep -n 'deno.land/x/cliffy' src/import_map.json` prints nothing; `grep -rhoE 'from "cliffy/[^"]+"' src package/src tests tools --include=*.ts | sort -u` prints exactly the eleven keys above (and nothing else).
- `package/dist/bin/tools/x86_64/deno check --import-map src/import_map.json src/quarto.ts package/src/bld.ts src/command/render/latexmk/quarto-latexmk.ts` exits 0.
- `package/dist/bin/quarto --help`, `package/dist/bin/quarto render --help`, `package/dist/bin/quarto` (no args) print help and exit 0; `package/dist/bin/quarto render --nosuch x` prints `ERROR: Unknown option "--nosuch"` (or the 1.3.1 wording) and exits 1 without a stack trace; `package/dist/bin/quarto nosuch` prints `ERROR: Unknown command "nosuch"...` and exits 1.
- `quarto create project default /tmp/x` interactive prompts render and accept arrow keys and Enter; `--no-prompt` variants in `tests/smoke/create/` pass.
- The tests in Verification pass; `Bundle Test` and `Smoke Tests` green.

## Plan

### Task 1: Pin the error contract with a unit test

**Files:**
- Test: `tests/unit/core/quarto-command-errors.test.ts`

- [ ] **Step 1: Write the test**

Create `tests/unit/core/quarto-command-errors.test.ts`. It encodes what `src/quarto.ts` relies on: the errors Cliffy throws for user mistakes are `ValidationError` from `cliffy/command/mod.ts`, and the implicit-cwd argument hack keeps working.

```ts
/*
 * quarto-command-errors.test.ts
 *
 * src/quarto.ts catches Cliffy's ValidationError to turn user mistakes
 * (unknown command, unknown option, missing option value) into a logged
 * error and exit code 1. This pins that every such mistake is a
 * ValidationError, and that the implicit-cwd workaround for
 * `quarto render --to html` (src/quarto.ts, kCliffyImplicitCwd) still yields
 * the raw args under .stopEarly().
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { unitTest } from "../../test.ts";
import { assert, assertEquals, assertRejects } from "testing/asserts";
import { Command, ValidationError } from "cliffy/command/mod.ts";
import { kCliffyImplicitCwd } from "../../../src/config/constants.ts";

function makeCli(onRender: (input: string | undefined, args: string[]) => void) {
  const render = new Command()
    .name("render")
    .description("Render")
    .stopEarly()
    .arguments("[input:string] [...args]")
    .option("-t, --to <to:string>", "Format")
    .action((_options, input, ...args) => onRender(input, args as string[]));
  return new Command()
    .name("quarto")
    .help({ colors: false })
    .version("99.9.9\n")
    .throwErrors()
    .command("render", render);
}

unitTest("cliffy - unknown command is a ValidationError", async () => {
  const cli = makeCli(() => {});
  const err = await assertRejects(() => cli.parse(["nosuch"]));
  assert(err instanceof ValidationError, `expected ValidationError, got ${err?.constructor.name}`);
});

unitTest("cliffy - missing option value is a ValidationError", async () => {
  const cli = makeCli(() => {});
  const err = await assertRejects(() => cli.parse(["render", "--to"]));
  assert(err instanceof ValidationError, `expected ValidationError, got ${err?.constructor.name}`);
});

unitTest("cliffy - implicit cwd argument keeps raw args after stopEarly", async () => {
  let seen: { input: string | undefined; args: string[] } | undefined;
  const cli = makeCli((input, args) => {
    seen = { input, args };
  });
  await cli.parse(["render", kCliffyImplicitCwd, "--to", "html", "-M", "a:b"]);
  assertEquals(seen, {
    input: kCliffyImplicitCwd,
    args: ["--to", "html", "-M", "a:b"],
  });
});
```

- [ ] **Step 2: Run it against rc.3**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/core/quarto-command-errors.test.ts`
Expected: `3 passed` (rc.3 already satisfies the contract; if the first two fail under rc.3 because rc.3 throws a different class, note it in the PR and continue: the contract is defined for 1.3.1, where all three were verified).

- [ ] **Step 3: Commit**

```bash
git add tests/unit/core/quarto-command-errors.test.ts
git commit -m "Pin the Cliffy error and argument contract quarto.ts relies on"
```

### Task 2: Import map

**Files:**
- Modify: `src/import_map.json:35`

- [ ] **Step 1: Replace the prefix entry with the eleven exact entries**

Replace
```json
    "cliffy/": "https://deno.land/x/cliffy@v1.0.0-rc.3/",
```
with
```json
    "cliffy/command/mod.ts": "jsr:@cliffy/command@1.3.1",
    "cliffy/command/command.ts": "jsr:@cliffy/command@1.3.1",
    "cliffy/command/help/mod.ts": "jsr:@cliffy/command@1.3.1/help",
    "cliffy/command/completions/mod.ts": "jsr:@cliffy/command@1.3.1/completions",
    "cliffy/prompt/mod.ts": "jsr:@cliffy/prompt@1.3.1",
    "cliffy/prompt/select.ts": "jsr:@cliffy/prompt@1.3.1/select",
    "cliffy/prompt/input.ts": "jsr:@cliffy/prompt@1.3.1/input",
    "cliffy/prompt/secret.ts": "jsr:@cliffy/prompt@1.3.1/secret",
    "cliffy/prompt/confirm.ts": "jsr:@cliffy/prompt@1.3.1/confirm",
    "cliffy/table/mod.ts": "jsr:@cliffy/table@1.3.1",
    "cliffy/ansi/mod.ts": "jsr:@cliffy/ansi@1.3.1",
```

- [ ] **Step 2: See exactly three files fail to type-check**

Run: `package/dist/bin/tools/x86_64/deno check --import-map src/import_map.json src/quarto.ts src/command/render/latexmk/quarto-latexmk.ts 2>&1 | grep -E 'TS[0-9]+|error:' | sort -u`
Expected (wording from 1.3.1):
```
TS2305 [ERROR]: Module '"https://jsr.io/@cliffy/command/1.3.1/mod.ts"' has no exported member 'CompletionsCommand'.
TS2305 [ERROR]: Module '"https://jsr.io/@cliffy/command/1.3.1/mod.ts"' has no exported member 'HelpCommand'.
TS2724 [ERROR]: '"https://jsr.io/@cliffy/prompt/1.3.1/mod.ts"' has no exported member named 'SelectValueOptions'. Did you mean 'SelectOptions'?
```
plus a module-not-found error for `cliffy/command/_errors.ts` (there is no map entry for it on purpose).

- [ ] **Step 3: Commit (the build is red until Task 3; keep the commits separate for review, squash if the project prefers green commits)**

```bash
git add src/import_map.json
git commit -m "Resolve cliffy from jsr:@cliffy/* 1.3.1"
```

### Task 3: Per-file fixes

**Files:**
- Modify: `src/quarto.ts:11-15,28,203`
- Modify: `src/command/render/latexmk/quarto-latexmk.ts:2-6`
- Modify: `src/command/create/cmd.ts:19,180-183`

- [ ] **Step 1: `src/quarto.ts`**

Replace lines 11-15
```ts
import {
  Command,
  CompletionsCommand,
  HelpCommand,
} from "cliffy/command/mod.ts";
```
with
```ts
import { Command, ValidationError } from "cliffy/command/mod.ts";
import { HelpCommand } from "cliffy/command/help/mod.ts";
import { CompletionsCommand } from "cliffy/command/completions/mod.ts";
```

Delete line 28:
```ts
import { CommandError } from "cliffy/command/_errors.ts";
```

Replace line 203 (inside the `catch` after `await promise;`)
```ts
    if (e instanceof CommandError) {
```
with
```ts
    if (e instanceof ValidationError) {
```

- [ ] **Step 2: `src/command/render/latexmk/quarto-latexmk.ts`**

Replace lines 2-6
```ts
import {
  Command,
  CompletionsCommand,
  HelpCommand,
} from "cliffy/command/mod.ts";
```
with
```ts
import { Command } from "cliffy/command/mod.ts";
import { HelpCommand } from "cliffy/command/help/mod.ts";
import { CompletionsCommand } from "cliffy/command/completions/mod.ts";
```

- [ ] **Step 3: `src/command/create/cmd.ts`**

Replace line 19
```ts
import { prompt, Select, SelectValueOptions } from "cliffy/prompt/mod.ts";
```
with
```ts
import { prompt, Select, type SelectOptions } from "cliffy/prompt/mod.ts";

// The options array accepted by Select.prompt (Cliffy 1.x dropped the
// SelectValueOptions alias).
type SelectValueOptions = SelectOptions<string>["options"];
```

Lines 180-183 (`promptSelect(message: string, options: SelectValueOptions)`) stay as they are.

- [ ] **Step 4: Type-check the three entry points and lint**

Run: `package/dist/bin/tools/x86_64/deno check --import-map src/import_map.json src/quarto.ts src/command/render/latexmk/quarto-latexmk.ts package/src/bld.ts && package/dist/bin/tools/x86_64/deno lint src/quarto.ts src/command/render/latexmk/quarto-latexmk.ts src/command/create/cmd.ts`
Expected: three `Check` lines, exit 0; lint clean. If `deno check` reports type errors inside `src/command/**/cmd.ts` action callbacks (1.x infers option types more strictly), fix them at the call site with the inferred type; do not add `// @ts-ignore`.

- [ ] **Step 5: Run the command unit tests**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/core/append-log-options.test.ts unit/core/quarto-command-errors.test.ts`
Expected: `4 passed`.

- [ ] **Step 6: Exercise the CLI by hand (help, errors, exit codes)**

Run each and compare:

```bash
package/dist/bin/quarto; echo "exit=$?"                         # root help, exit=0
package/dist/bin/quarto --help | head -20; echo "exit=$?"       # same help, exit=0
package/dist/bin/quarto render --help | head -40                # render options listed; no ANSI colour codes
package/dist/bin/quarto help render | head -5                   # HelpCommand (global) works
package/dist/bin/quarto completions bash | head -3              # CompletionsCommand works (prints a bash script)
package/dist/bin/quarto nosuch; echo "exit=$?"                  # ERROR: Unknown command "nosuch". ... exit=1, no stack trace
package/dist/bin/quarto render --nosuch; echo "exit=$?"         # implicit-cwd hack + stopEarly: render receives the raw arg and handles it as before (behaviour unchanged from rc.3)
package/dist/bin/quarto check --nosuch; echo "exit=$?"          # ERROR: Unknown option "--nosuch". exit=1
package/dist/bin/quarto render tests/docs/minimal.qmd --to html --log-level debug 2>&1 | head -3   # global log options forwarded to subcommands
package/dist/bin/quarto tools list                              # Table output
package/dist/bin/quarto --version                                # 99.9.9 (launcher short-circuit, unchanged)
```

Expected: as annotated. Differences in help wording or wrapping are acceptable; a stack trace on a user error, a non-zero exit on help, or a missing option are not.

- [ ] **Step 7: Exercise the prompts**

Run: `cd /tmp && rm -rf rt06 && /home/user/quarto-cli/package/dist/bin/quarto create project` (interactive: pick `default` with the arrow keys, type `rt06`, confirm; answer `n` to opening an editor)
Expected: the `Select` list renders, arrow keys move the cursor, Enter accepts, the `Input` prompt echoes typed text, the project is created in `/tmp/rt06`. Then the non-interactive paths:

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/create/ smoke/use/ smoke/extensions/`
Expected: all passed (`create` with `--no-prompt`/`--json`, `use template` with confirmations, extension install prompts).

- [ ] **Step 8: Commit**

```bash
git add src/quarto.ts src/command/render/latexmk/quarto-latexmk.ts src/command/create/cmd.ts
git commit -m "Adapt to @cliffy 1.x exports

HelpCommand and CompletionsCommand moved to the help and completions
entry points; CommandError is internal (user errors are ValidationError);
SelectValueOptions is SelectOptions<T>[\"options\"]."
```

### Task 4: Drop the std redirect that served rc.3

**Files:**
- Modify: `src/import_map.json:63` (and any other redirect the script reports `UNUSED`)

- [ ] **Step 1: Run the redirect-usage script from PR 04 Task 7**

Run the `deno info` script from `04-deps-deno-land-x-small.md`, Task 7, Step 1.
Expected: `UNUSED https://deno.land/std@0.196.0/console/unicode_width.ts` (rc.3 was its only importer). If PR 04 has not landed yet, the `0.105.0` and `0.91.0` entries also show as `USED`/`UNUSED` according to their own packages; remove only what is `UNUSED` now.

- [ ] **Step 2: Delete the unused keys and re-check**

Delete
```json
    "https://deno.land/std@0.196.0/console/unicode_width.ts": "https://deno.land/std@0.224.0/console/unicode_width.ts",
```
then run the script again and `package/dist/bin/tools/x86_64/deno check --import-map src/import_map.json src/quarto.ts`.
Expected: no `UNUSED` lines for keys this PR is responsible for; `deno check` exits 0.

- [ ] **Step 3: Commit**

```bash
git add src/import_map.json
git commit -m "Drop the deno.land/std redirect that served cliffy rc.3"
```

### Task 5: Build tooling and status

**Files:**
- Modify: `dev-docs/runtime-migration/README.md`

- [ ] **Step 1: Check `quarto-bld` (5 Cliffy importers under `package/src`)**

Run: `cd package/src && ./quarto-bld --help | head -20 && ./quarto-bld prepare-dist --help | head -5`
Expected: help for the build tool and for `prepare-dist`, exit 0.

- [ ] **Step 2: Build the release bundle and run the bundled CLI**

Run: `cd package/src && ./quarto-bld prepare-dist --set-version $(cat ../../version.txt) && ../pkg-working/bin/quarto --help | head -5 && ../pkg-working/bin/quarto check`
Expected: the bundle builds (`@cliffy/*` and its `@std` 1.x dependencies resolve through `@luca/esbuild-deno-loader`), the bundled CLI prints help and `quarto check` passes. This is what `.github/workflows/test-bundle.yml` runs.

- [ ] **Step 3: Set the PR 06 row to `in progress` and commit**

```bash
git add dev-docs/runtime-migration/README.md
git commit -m "runtime-migration: PR 06 in progress"
```

## Verification

```bash
rm -rf package/dist/bin/deno_cache && ./configure.sh
package/dist/bin/tools/x86_64/deno check --import-map src/import_map.json src/quarto.ts package/src/bld.ts src/command/render/latexmk/quarto-latexmk.ts
package/dist/bin/quarto check
cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent \
  unit/core/append-log-options.test.ts unit/core/quarto-command-errors.test.ts \
  smoke/create/ smoke/use/ smoke/extensions/ smoke/check/ smoke/inspect/ smoke/convert/ smoke/run/ \
  smoke/logging/ smoke/env/ smoke/render/render-minimal.test.ts smoke/render/render-cli-metadata-file.test.ts
cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/typst-gather/ smoke/axe/   # `quarto call` subcommands (hidden commands + forwarded log options)
quarto run --dev tools/check-runtime-boundary.ts                 # after PR 02: unchanged counts
```

Plus Task 3 steps 6-7 by hand (help, errors, exit codes, interactive prompts) on at least one Unix platform and on Windows (`quarto.cmd`; prompts use raw stdin differently there).

On the PR: `Smoke Tests` (Linux and Windows), `Bundle Test`, `Test quarto-latexmk` (`.github/workflows/test-quarto-latexmk.yml`, the other Cliffy root command).

## Review checklist

- [ ] All four `@cliffy/*` packages are pinned to the same version (`1.3.1`), as exact-match keys; no `cliffy/` prefix entry remains.
- [ ] The eleven keys match the sorted output of `grep -rhoE 'from "cliffy/[^"]+"' src package/src tests tools --include=*.ts | sort -u` exactly.
- [ ] `src/quarto.ts` catches `ValidationError` (from `cliffy/command/mod.ts`), nothing from a `_`-prefixed path.
- [ ] `HelpCommand().global()` and `CompletionsCommand()` registrations are unchanged in both root commands.
- [ ] `SelectValueOptions` in `src/command/create/cmd.ts` is a local alias of `SelectOptions<string>["options"]`.
- [ ] No other source file changed, unless `deno check` required a type narrowing (each such change is called out in the PR description).
- [ ] The `std@0.196.0` redirect is gone and the `deno info` script output is in the PR description.
- [ ] Manual help/error/prompt checks were done on Unix and Windows and the exit codes match the annotations in Task 3 step 6.

## Risks and rollback

- Argument validation got stricter between rc.3 and 1.3.1 (`TooManyArgumentsError`, empty required values). A user command line that worked by accident (extra positional ignored) now fails with a `ValidationError` message and exit 1. The smoke suites cover the documented command lines; if a reported regression is a real use case, the fix is a `.arguments("[...args]")` declaration on that command, not a Cliffy downgrade.
- Help output formatting changed (responsive width, argument default values shown). No test depends on it; documentation screenshots may differ.
- Prompt key handling changed (fuzzy search, vim keys): a user pressing `j`/`k` or typing in a `Select` now filters/moves instead of being ignored. Additive.
- `quarto` with no arguments: 1.x prints help and exits inside Cliffy (`Deno.exit(0)`), bypassing the `finally` env restore in `src/quarto.ts`; the process is exiting anyway. If rc.3 returned normally here and something (a wrapper, an IDE) depended on `quarto` without arguments returning through `mainRunner`'s cleanup, `initSessionTempDir()` leaves an empty temp dir behind; mitigate by moving the no-argument check before `initSessionTempDir()` (`if (args.length === 0) { quartoCommand.showHelp(); exitWithCleanup(0); }`).
- Rollback: revert the four commits; the `cliffy/` prefix entry and the `std@0.196.0` redirect return.

## Decisions needed

1. **Exact-match keys vs. rewriting 68 import lines to `@cliffy/command` style.** Exact keys keep the diff reviewable and the Node bundle's resolver (PR 26) consumes the same map. Rewriting the specifiers would also drop the misleading `.ts` suffixes but touches 68 files for no functional gain. Recommendation: exact keys now; if the team wants the canonical names, do it as a one-commit mechanical PR after PR 26 proves the map works on Node (so there is one less variable in that PR).
2. **`CommandError` vs `ValidationError` in `src/quarto.ts`.** Catching only `ValidationError` lets Cliffy's own programming errors (duplicate option names, missing default command) propagate as crashes with a stack trace instead of a one-line log. Recommendation: `ValidationError` (this plan); those errors are bugs in Quarto's command definitions and should be loud.
