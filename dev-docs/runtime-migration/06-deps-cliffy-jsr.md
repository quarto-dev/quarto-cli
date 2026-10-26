# PR 06: Cliffy 1.0.0-rc.3 to `@cliffy/*` 1.3.1 on JSR

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve every `cliffy/...` import from the JSR packages `@cliffy/command`, `@cliffy/prompt`, `@cliffy/table` and `@cliffy/ansi` at 1.3.1 (transitive ranges pinned by `deno.lock`), fixing the three source files whose imports no longer exist, with the other 65 importers untouched, and with every command's option parsing characterised before and after the upgrade.
**Phase:** 0. **Depends on:** 02 (ratchet, `tests/asserts.ts`), 00b (frozen `deno.lock`, `update-lock.sh`, the bundle gate). **Unblocks:** PR 26 (JSR Cliffy declares Node support; rc.3 pins pre-1.0 `deno.land/std` URLs the Node bundle had to remap), PR 07's last task (the `std@0.196.0` redirect and `vendor_deps.ts` base64 import become removable).
**Branch:** `rt/06-deps-cliffy-jsr`.
**Suggested executor:** Opus. The edit is small but the CLI parser was rewritten between rc.3 and 1.3.1 (positional arguments, empty values, required-option errors, too-many-arguments errors, help output); classifying each characterisation difference as acceptable or a regression needs judgement.
**Size:** L by blast radius (68 importers: 62 in `src/`, 5 in `package/src`, 1 in `tests/`; every command goes through Cliffy; 120 `.option(` calls in `src` and `package/src`), M by edit count (import map, `deno.lock`, 3 source files, a characterisation harness with its snapshot, 2 unit tests, a snapshot tool, the changelog).
**Ships on:** Deno; the existing test suite must stay green.

## Spec

### Context

`00-assessment.md` section 3.4 (Cliffy row) and section 10, finding 4; `REVIEW-2026-10-15.md` Phase 0 "06". rc.3 (July 2023) imports `https://deno.land/std@0.196.0/...` modules with export names that no longer exist in `@std`, which is why `src/import_map.json:63` carries a redirect for `std@0.196.0/console/unicode_width.ts`. `@cliffy/*` 1.x is published on JSR, declares Deno, Node and Bun support, and depends on `jsr:@std/*` 1.x and sibling `@cliffy/*` packages. Its own dependencies are ranges (`@cliffy/command` 1.3.1 imports `jsr:@cliffy/internal@^1.3.1/...` and `jsr:/@std/fmt@^1.0.10/colors`), so exact import-map pins do not pin the transitive versions; PR 00b's committed `deno.lock` does. Cliffy uses its own `@std/fmt` instance: Quarto's `setColorEnabled` (`src/core/lib/external/colors.ts:56`, Quarto's own copy) never reached Cliffy and still does not; Quarto turns Cliffy's help colours off with `.help({ colors: false })` and prints parse errors itself (`throwErrors()` and `logError` in `src/quarto.ts`).

Versions on JSR (verified 2026-10-14): `@cliffy/command`, `@cliffy/prompt`, `@cliffy/table`, `@cliffy/ansi`, `@cliffy/flags` are all at **1.3.1**. Pin the four Quarto imports to the same version; they share `@cliffy/internal`.

What Quarto imports today (`rg -l 'from "cliffy/'` over `src`, `package/src`, `tests`, `tools`: 68 files):

| Specifier | Files | Names | JSR 1.3.1 equivalent |
|---|---|---|---|
| `cliffy/command/mod.ts` | 41 in `src` (every `src/command/**/cmd.ts`, `src/core/log.ts`, `src/execute/types.ts`, `src/quarto-core/profile.ts`, `src/command/command.ts` as `import type`), 5 in `package/src` (`bld.ts`, `cmd/pkg-cmd.ts`, `common/compile-quarto-latexmk.ts`, `common/update-pandoc.ts`, `common/cyclic-dependencies.ts`), 1 test (`tests/unit/core/append-log-options.test.ts`) | `Command` (all), `ValidationError` (`src/command/use/cmd.ts:6`), `CompletionsCommand`, `HelpCommand` (`src/quarto.ts:11-15`, `src/command/render/latexmk/quarto-latexmk.ts:2-6`) | `jsr:@cliffy/command@1.3.1` exports `Command`, `ValidationError` and the `*Type` classes. **`HelpCommand` moved to the `./help` export and `CompletionsCommand` to `./completions`**. |
| `cliffy/command/command.ts` | `src/command/pandoc/cmd.ts:8`, `src/command/run/run.ts:7`, `src/command/typst/cmd.ts:7` | `Command` | same package root |
| `cliffy/command/_errors.ts` | `src/quarto.ts:28` | `CommandError` | **not importable** (`_errors.ts` is not in the export map). Every user-facing parse error in 1.3.1 is a `ValidationError` (`UnknownCommandError`, `TooManyArgumentsError`, `MissingRequiredEnvVarError`, `NoArgumentsAllowedError` and the flags errors extend it). The remaining `CommandError` subclasses (`DuplicateOptionNameError`, `CommandNotFoundError`, …) are programming errors that should surface as crashes. |
| `cliffy/prompt/mod.ts` | 18 files | `prompt`, `Select`, `Checkbox`, `Confirm`, `Input`, `Secret`, `SelectOption`, `SelectValueOptions` (`src/command/create/cmd.ts:19`) | `jsr:@cliffy/prompt@1.3.1` exports all of these except **`SelectValueOptions`** (removed in 1.0.0); the options array type is `SelectOptions<TValue>["options"]`. |
| `cliffy/prompt/select.ts`, `input.ts`, `secret.ts`, `confirm.ts` | 3, 3, 2, 2 files under `src/publish/` and `src/command/publish/cmd.ts` | `Select`, `Input`, `Secret`, `Confirm` | `jsr:@cliffy/prompt@1.3.1/select`, `/input`, `/secret`, `/confirm` |
| `cliffy/table/mod.ts` | `src/command/list/cmd.ts:7`, `src/command/use/commands/binder/binder.ts:36`, `src/extension/install.ts:9`, `src/tools/tools-console.ts:8` | `Table` | `jsr:@cliffy/table@1.3.1` |
| `cliffy/ansi/mod.ts` | `src/core/console.ts:7` | `ansi.eraseLine.cursorLeft()` (line 181) | `jsr:@cliffy/ansi@1.3.1` (the chain returns `"\x1b[2K\x1b[G"`) |

Where Quarto calls `parse()` (every one is in scope of the characterisation): `src/quarto.ts:195` (the CLI), `src/command/render/latexmk/quarto-latexmk.ts:125` (the standalone `quarto-latexmk`, removed by PR 39), `package/src/bld.ts:52` (`quarto-bld`), and `src/command/call/engine-cmd.ts:49`, which builds a fresh `new Command()` without `throwErrors()`, hands it to the engine's `populateCommand` and parses the remaining arguments. `populateCommand?: (command: Command) => void` (`src/execute/types.ts:70`) is a public engine-extension API: the Julia engine (`src/resources/extension-subtrees/julia-engine/src/julia-engine.ts:115`) registers `status`, `kill`, `log`, … with `.command(name, description)`, `.arguments`, `.option`, `.action`, which is the surface `packages/quarto-types/src/cli.ts:5-10` declares. After this PR, extensions receive a Cliffy 1.3.1 `Command`; the declared methods behave the same (the 1.0.0 breaking change to `.command()` concerns the third argument only).

`quarto dev-call cli-info` (`src/command/dev-call/cmd.ts:34-62`) serialises Cliffy's own `getOptions()`, `getUsage()` and `getExamples()` objects as JSON: the shape of those objects is Cliffy-internal and changes with 1.x (new fields such as `envVar`, `groupName`, `defaultText`). Anything that consumes that JSON sees the change; Task 5 diffs it.

The launchers short-circuit `--version` and `-v` (`package/scripts/common/quarto:40-47,112-119`, `quarto.cmd`, `package/launcher/src/main.rs:36-41`), but `-V` reaches Cliffy, and in 1.3.1 a long `--version` calls `showLongVersion()`. Task 2 records `-V` before and after.

`Command` API used by Quarto, all present in 1.3.1: `.name`, `.version`, `.description`, `.help({ colors: false })`, `.throwErrors`, `.noExit`, `.command(name, cmd)`, `.option(flags, desc, { global, hidden, collect, value, default, equalsSign, ... })`, `.arguments`, `.action`, `.example`, `.hidden`, `.stopEarly`, `.parse(args)`, `.reset`, `.getName`, `.getPath`, `.getDescription`, `.getUsage`, `.getOptions`, `.getBaseOptions`, `.getExamples`, `.getCommands(true)`, `.hasOption`.

Changelog review, rc.3 → 1.3.1 (`https://raw.githubusercontent.com/c4spar/deno-cliffy/main/CHANGELOG.md`). Entries that touch Quarto's usage:

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

Two prompt-runtime differences matter only on Node and are Spike #2 items in `SPIKES.md` (not this PR): on Node, Cliffy 1.3.1's `setRaw` calls `process.stdin.setRawMode` and ignores the `cbreak` option, so Ctrl-C inside a prompt behaves differently; and `@cliffy/prompt`'s path suggestions call `Deno.permissions` without a guard. On Deno (this PR) both behave as today.

### Scope

In:
- import-map entries for the eleven `cliffy/...` specifiers in use (exact-match keys, so 65 files keep their import lines) and `deno.lock`;
- `src/quarto.ts`, `src/command/render/latexmk/quarto-latexmk.ts`, `src/command/create/cmd.ts` edits;
- the argv characterisation harness (`tests/unit/cli/cli-argv.ts`), its snapshot (`tests/unit/cli/argv-snapshot.json`), its test, and the tool that writes the snapshot (`tools/cli-argv-snapshot.ts`);
- the `cli-info` JSON diff, `-V`, the engine `populateCommand` path, in the PR description;
- a changelog entry (CLI parser behaviour and the engine-extension API).

Out:
- the `std@0.196.0/console/unicode_width.ts` redirect and the `std@0.196.0/encoding/base64.ts` import in `src/vendor_deps.ts` (PR 07's last task removes every unused redirect once 03–07 have landed);
- renaming the specifiers to `@cliffy/command` etc. in all 68 files (see Decisions);
- adopting new Cliffy features;
- `quarto-latexmk`'s `flags` import (PR 22) and the standalone `quarto-latexmk` itself (PR 39 removes it);
- the Node-only prompt differences (Spike #2).

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

Exact-match keys deliberately: an unmapped `cliffy/...` specifier fails to resolve instead of silently reaching `deno.land`. The three per-file fixes:

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

Characterisation harness, `tests/unit/cli/cli-argv.ts` (test helper, imported by the test and by the snapshot tool):

```ts
export interface ArgvResult {
  argv: string[];
  outcome: "ok" | "error";
  /** Command path whose action ran ("render", "publish connect", "" for the root). */
  command?: string;
  /** Parsed options, keys sorted, undefined and functions dropped, the implicit-cwd UUID replaced. */
  options?: Record<string, unknown>;
  args?: unknown[];
  /** For errors: whether src/quarto.ts treats it as a user error (instanceof ValidationError). */
  validation?: boolean;
  message?: string;
}
export interface ArgvSnapshot { cliffy: string; results: ArgvResult[]; }
export function normalize(value: unknown): unknown;
export function withImplicitCwd(argv: string[]): string[];        // src/quarto.ts's render/preview rewrite
export function quartoCli(): Command<any>;                         // root as src/quarto.ts builds it, actions replaced by a recorder; built once
export function allCommands(cmd?: Command<any>): Command<any>[];  // every sub-command, depth first
export function generateCases(): string[][];                       // argv per option of every command, plus kHandWrittenCases
export const kHandWrittenCases: string[][];
export function parseArgv(argv: string[]): Promise<ArgvResult>;
```

`tools/cli-argv-snapshot.ts <label>` writes `{ cliffy: <label>, results: generateCases().map(parseArgv) }` to `tests/unit/cli/argv-snapshot.json`.

### Files

- Modify: `src/import_map.json:35` (`cliffy/`); `deno.lock` (via `update-lock.sh`)
- Modify: `src/quarto.ts:11-15,28,203`
- Modify: `src/command/render/latexmk/quarto-latexmk.ts:2-6`
- Modify: `src/command/create/cmd.ts:19`
- Create: `tests/unit/cli/cli-argv.ts`, `tests/unit/cli/argv-snapshot.json` (generated)
- Test: `tests/unit/cli/cli-argv.test.ts` (new), `tests/unit/core/quarto-command-errors.test.ts` (new), `tests/unit/core/append-log-options.test.ts` (unchanged)
- Create: `tools/cli-argv-snapshot.ts`
- Modify: `news/changelog-1.11.md`
- Modify: `dev-docs/runtime-migration/README.md` (PR 06 row status)

### Acceptance criteria

- `grep -n 'deno.land/x/cliffy' src/import_map.json` prints nothing; `grep -rhoE 'from "cliffy/[^"]+"' src package/src tests tools --include=*.ts | sort -u` prints exactly the eleven keys above.
- `package/dist/bin/tools/x86_64/deno check --import-map src/import_map.json src/quarto.ts package/src/bld.ts src/command/render/latexmk/quarto-latexmk.ts` exits 0.
- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/cli/cli-argv.test.ts unit/core/quarto-command-errors.test.ts unit/core/append-log-options.test.ts` passes against the snapshot written under 1.3.1 at the end of Task 5, and the PR description contains the rc.3 → 1.3.1 difference table with every difference classified.
- `package/dist/bin/quarto --help`, `render --help`, `quarto` (no args) print help and exit 0; `quarto nosuch` and `quarto check --nosuch` print one `ERROR:` line and exit 1 without a stack trace; `quarto -V` prints the version.
- The `cli-info` JSON diff (rc.3 → 1.3.1) is attached to the PR.
- `quarto create project` prompts work interactively on Unix and Windows; the `--no-prompt` tests pass.
- `Bundle Test` (three OSes), `Smoke Tests`, `Test quarto-latexmk` and `Runtime Boundary` (counts unchanged) green.

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
import { assert, assertEquals, assertRejects } from "../../asserts.ts";
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

### Task 2: Characterise argv parsing under rc.3 (before the upgrade)

**Files:**
- Create: `tests/unit/cli/cli-argv.ts`
- Create: `tools/cli-argv-snapshot.ts`
- Create: `tests/unit/cli/argv-snapshot.json` (generated)
- Test: `tests/unit/cli/cli-argv.test.ts`

- [ ] **Step 1: Write the harness**

Create `tests/unit/cli/cli-argv.ts`:

```ts
/*
 * cli-argv.ts
 *
 * Characterisation harness for Quarto's command line (PR 06 of
 * dev-docs/runtime-migration): builds the root command the way src/quarto.ts
 * does, replaces every action with a recorder, parses argv lists and returns
 * what Cliffy produced. tools/cli-argv-snapshot.ts writes the snapshot under
 * one Cliffy version; cli-argv.test.ts compares the current version with it.
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { Command, ValidationError } from "cliffy/command/mod.ts";
import { commands } from "../../../src/command/command.ts";
import { appendLogOptions } from "../../../src/core/log.ts";
import { appendProfileArg } from "../../../src/quarto-core/profile.ts";
import { kCliffyImplicitCwd } from "../../../src/config/constants.ts";

// deno-lint-ignore no-explicit-any
type AnyCommand = Command<any>;

export interface ArgvResult {
  argv: string[];
  outcome: "ok" | "error";
  command?: string;
  options?: Record<string, unknown>;
  args?: unknown[];
  validation?: boolean;
  message?: string;
}

export interface ArgvSnapshot {
  cliffy: string;
  results: ArgvResult[];
}

const kImplicitCwdPlaceholder = "<implicit-cwd>";

export function normalize(value: unknown): unknown {
  if (value === kCliffyImplicitCwd) {
    return kImplicitCwdPlaceholder;
  }
  if (Array.isArray(value)) {
    return value.map(normalize);
  }
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    const record = value as Record<string, unknown>;
    for (const key of Object.keys(record).sort()) {
      const v = record[key];
      if (v !== undefined && typeof v !== "function") {
        out[key] = normalize(v);
      }
    }
    return out;
  }
  return value;
}

export function withImplicitCwd(argv: string[]): string[] {
  if (
    argv.length > 1 && (argv[0] === "render" || argv[0] === "preview") &&
    argv[1].startsWith("-")
  ) {
    return [argv[0], kCliffyImplicitCwd, ...argv.slice(1)];
  }
  return argv;
}

let recorded:
  | { command: string; options: Record<string, unknown>; args: unknown[] }
  | undefined;

function commandPath(cmd: AnyCommand): string {
  return cmd.getPath().split(" ").slice(1).join(" ");
}

function recordActions(cmd: AnyCommand) {
  // reset(): a Cliffy builder keeps a cursor on its last added sub-command
  // deno-lint-ignore no-explicit-any
  cmd.reset().action((options: any, ...args: unknown[]) => {
    recorded = {
      command: commandPath(cmd),
      options: normalize(options) as Record<string, unknown>,
      args: normalize(args) as unknown[],
    };
  });
  for (const sub of cmd.getCommands(true)) {
    recordActions(sub);
  }
}

let root: AnyCommand | undefined;

export function quartoCli(): AnyCommand {
  if (root) {
    return root;
  }
  const cli: AnyCommand = new Command()
    .name("quarto")
    .version("99.9.9")
    .description("Quarto CLI")
    .throwErrors()
    .noExit();
  for (const command of commands()) {
    cli.command(command.getName(), appendProfileArg(appendLogOptions(command)));
  }
  recordActions(cli);
  root = cli;
  return cli;
}

export function allCommands(cmd: AnyCommand = quartoCli()): AnyCommand[] {
  const result: AnyCommand[] = [];
  for (const sub of cmd.getCommands(true)) {
    result.push(sub, ...allCommands(sub));
  }
  return result;
}

const kSampleValue: Record<string, string> = {
  string: "x",
  number: "2",
  integer: "2",
  boolean: "true",
  file: "x.txt",
};

export const kHandWrittenCases: string[][] = [
  [],
  ["nosuch"],
  ["render", "doc.qmd", "--to", "html", "-M", "a:b", "-P", "p:1"],
  ["render", "--to", "html"],
  ["render", "doc.qmd", "--", "--foo"],
  ["render", "doc.qmd", "--to", ""],
  ["preview", "--port", "4000", "--no-browser"],
  ["preview", "doc.qmd", "--render", "all", "--no-watch-inputs"],
  ["check", "--nosuch"],
  ["publish", "gh-pages", "--no-prompt", "--no-render"],
  ["create", "project", "website", "mysite", "--no-open", "--no-prompt"],
  ["create", "project", "--open", "vscode"],
  ["install", "tinytex", "--no-prompt", "--update-path"],
  ["call", "engine", "julia", "status"],
  ["inspect", "doc.qmd", "out.json"],
  ["convert", "doc.ipynb", "-o", "doc.qmd"],
  ["check", "--log-level", "debug", "--quiet"],
  ["render", "doc.qmd", "--profile", "a,b"],
];

export function generateCases(): string[][] {
  const cases: string[][] = [];
  for (const cmd of allCommands()) {
    const path = commandPath(cmd).split(" ");
    cases.push([...path]);
    cases.push([...path, "--no-such-option"]);
    cases.push([...path, "a", "b", "c", "d"]);
    for (const option of cmd.getBaseOptions(true)) {
      if (option.name === "help" || option.name === "version") {
        continue;
      }
      const long = option.flags.find((f: string) => f.startsWith("--")) ??
        option.flags[0];
      const short = option.flags.find((f: string) => /^-[^-]/.test(f));
      const arg = option.args[0];
      if (!arg) {
        cases.push([...path, long]);
        if (short) {
          cases.push([...path, short]);
        }
        continue;
      }
      const value = kSampleValue[arg.type] ?? "x";
      cases.push([...path, long, value]);
      cases.push([...path, `${long}=${value}`]);
      cases.push([...path, long]); // no value: valid only when the value is optional
      cases.push([...path, long, ""]); // empty value
      if (short) {
        cases.push([...path, short, value]);
      }
      if (option.collect) {
        cases.push([...path, long, value, long, value + "2"]);
      }
    }
  }
  return [...cases, ...kHandWrittenCases];
}

export async function parseArgv(argv: string[]): Promise<ArgvResult> {
  const cli = quartoCli();
  recorded = undefined;
  try {
    await cli.parse(withImplicitCwd(argv));
    return recorded ? { argv, outcome: "ok", ...recorded } : { argv, outcome: "ok" };
  } catch (e) {
    return {
      argv,
      outcome: "error",
      validation: e instanceof ValidationError,
      message: e instanceof Error ? e.message : String(e),
    };
  }
}
```

- [ ] **Step 2: Write the snapshot tool**

Create `tools/cli-argv-snapshot.ts`:

```ts
/*
 * cli-argv-snapshot.ts
 *
 * Writes tests/unit/cli/argv-snapshot.json: every argv of generateCases()
 * parsed with the Cliffy version src/import_map.json currently maps.
 * Run it on main before a Cliffy upgrade, and again after the differences
 * were reviewed (dev-docs/runtime-migration/06-deps-cliffy-jsr.md).
 *
 * Usage: quarto run --dev tools/cli-argv-snapshot.ts <cliffy-version-label>
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import {
  type ArgvResult,
  type ArgvSnapshot,
  generateCases,
  parseArgv,
} from "../tests/unit/cli/cli-argv.ts";

const label = Deno.args[0];
if (!label) {
  console.error(
    "usage: quarto run --dev tools/cli-argv-snapshot.ts <cliffy-version-label>",
  );
  Deno.exit(2);
}
const results: ArgvResult[] = [];
for (const argv of generateCases()) {
  results.push(await parseArgv(argv));
}
const snapshot: ArgvSnapshot = { cliffy: label, results };
Deno.writeTextFileSync(
  "tests/unit/cli/argv-snapshot.json",
  JSON.stringify(snapshot, null, 2) + "\n",
);
console.log(
  `wrote ${results.length} argv results (${label}) to tests/unit/cli/argv-snapshot.json`,
);
```

- [ ] **Step 3: Write the test**

Create `tests/unit/cli/cli-argv.test.ts`:

```ts
/*
 * cli-argv.test.ts
 *
 * Every argv in tests/unit/cli/argv-snapshot.json must parse to the same
 * command, options, arguments and error kind as when the snapshot was
 * written. Error message wording may change (printed, not a failure).
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { unitTest } from "../../test.ts";
import { fail } from "../../asserts.ts";
import snapshotJson from "./argv-snapshot.json" with { type: "json" };
import {
  allCommands,
  type ArgvResult,
  type ArgvSnapshot,
  parseArgv,
} from "./cli-argv.ts";

const snapshot = snapshotJson as unknown as ArgvSnapshot;

const shape = (r: ArgvResult) =>
  JSON.stringify({
    outcome: r.outcome,
    command: r.command,
    options: r.options,
    args: r.args,
    validation: r.validation,
  });

unitTest("cli-argv - every snapshot argv parses as recorded", async () => {
  const mismatches: string[] = [];
  const messageChanges: string[] = [];
  for (const expected of snapshot.results) {
    const actual = await parseArgv(expected.argv);
    if (shape(actual) !== shape(expected)) {
      mismatches.push(
        `quarto ${expected.argv.join(" ")}\n  ${snapshot.cliffy}: ${shape(expected)}\n  now: ${shape(actual)}`,
      );
    } else if (actual.message !== expected.message) {
      messageChanges.push(
        `quarto ${expected.argv.join(" ")}: "${expected.message}" -> "${actual.message}"`,
      );
    }
  }
  if (messageChanges.length > 0) {
    console.log(`error message changes (not failures):\n${messageChanges.join("\n")}`);
  }
  if (mismatches.length > 0) {
    fail(
      `${mismatches.length} argv parse differently than the ${snapshot.cliffy} snapshot:\n${mismatches.join("\n")}`,
    );
  }
});

// deno-lint-ignore require-await
unitTest("cli-argv - the snapshot covers every command", async () => {
  const recorded = new Set(snapshot.results.map((r) => r.argv.join(" ")));
  const missing = allCommands()
    .map((c) => c.getPath().split(" ").slice(1).join(" "))
    .filter((path) => !recorded.has(path));
  if (missing.length > 0) {
    fail(
      `commands not in the snapshot (run 'quarto run --dev tools/cli-argv-snapshot.ts <label>' on main): ${missing.join(", ")}`,
    );
  }
});
```

- [ ] **Step 4: Write the rc.3 snapshot and run the test against it**

Run:
```bash
package/dist/bin/quarto run --dev tools/cli-argv-snapshot.ts 1.0.0-rc.3
grep -c '"argv"' tests/unit/cli/argv-snapshot.json
cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/cli/cli-argv.test.ts
```
Expected: `wrote N argv results (1.0.0-rc.3) ...` with N in the hundreds (about five per option with a value, two per flag, three per command, plus 18 hand-written); the same N from `grep -c`; `2 passed` (rc.3 against its own snapshot). If any parse wrote to stdout or tried to exit, the harness is missing a recorder for that command (`recordActions` must reach it through `getCommands(true)`); fix the harness, not the command.

- [ ] **Step 5: Record the outputs the unit test cannot see**

Run (rc.3, before the upgrade):
```bash
mkdir -p /tmp/rt06
package/dist/bin/quarto dev-call cli-info | jq -S . > /tmp/rt06/cli-info-rc3.json
for a in "" "-V" "tools" "call" "dev-call" "check --nosuch" "nosuch"; do
  echo "== quarto $a"; package/dist/bin/quarto $a > "/tmp/rt06/out-$(echo "$a" | tr ' ' '_').txt" 2>&1; echo "exit=$?"
done | tee /tmp/rt06/exits-rc3.txt
```
Expected: `cli-info-rc3.json` is valid JSON; the exit codes are recorded (they are the baseline for Task 5 Step 4).

- [ ] **Step 6: Commit**

```bash
git add tests/unit/cli/cli-argv.ts tests/unit/cli/cli-argv.test.ts tests/unit/cli/argv-snapshot.json tools/cli-argv-snapshot.ts
git commit -m "Characterise argv parsing of every command (Cliffy rc.3 snapshot)"
```

### Task 3: Import map and lockfile

**Files:**
- Modify: `src/import_map.json:35`, `deno.lock`

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

- [ ] **Step 2: Re-vendor**

Run: `package/scripts/vendoring/update-lock.sh; git diff --stat deno.lock`
Expected: the vendoring of `src/quarto.ts` fails on the three files Task 4 fixes (Step 3 below shows the errors), but `deno.lock` gains `jsr:@cliffy/command@1.3.1`, `@cliffy/prompt`, `@cliffy/table`, `@cliffy/ansi`, `@cliffy/flags`, `@cliffy/internal` and `@std/fmt`/`@std/text` 1.x entries, with the `^` ranges resolved to exact versions. (If `update-lock.sh` stops before writing the lockfile because of the type errors, run it again after Task 4 Step 4; `deno install` does not type-check, so this is not expected.)

- [ ] **Step 3: See exactly three files fail to type-check**

Run: `package/dist/bin/tools/x86_64/deno check --import-map src/import_map.json src/quarto.ts src/command/render/latexmk/quarto-latexmk.ts 2>&1 | grep -E 'TS[0-9]+|error:' | sort -u`
Expected (wording from 1.3.1):
```
TS2305 [ERROR]: Module '"https://jsr.io/@cliffy/command/1.3.1/mod.ts"' has no exported member 'CompletionsCommand'.
TS2305 [ERROR]: Module '"https://jsr.io/@cliffy/command/1.3.1/mod.ts"' has no exported member 'HelpCommand'.
TS2724 [ERROR]: '"https://jsr.io/@cliffy/prompt/1.3.1/mod.ts"' has no exported member named 'SelectValueOptions'. Did you mean 'SelectOptions'?
```
plus a module-not-found error for `cliffy/command/_errors.ts` (there is no map entry for it on purpose).

- [ ] **Step 4: Commit (red until Task 4; squash if the project prefers green commits)**

```bash
git add src/import_map.json deno.lock
git commit -m "Resolve cliffy from jsr:@cliffy/* 1.3.1"
```

### Task 4: Per-file fixes

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

- [ ] **Step 7: Commit**

```bash
git add src/quarto.ts src/command/render/latexmk/quarto-latexmk.ts src/command/create/cmd.ts
git commit -m "Adapt to @cliffy 1.x exports

HelpCommand and CompletionsCommand moved to the help and completions
entry points; CommandError is internal (user errors are ValidationError);
SelectValueOptions is SelectOptions<T>[\"options\"]."
```

### Task 5: Compare with the rc.3 characterisation and classify every difference

**Files:**
- Modify: `tests/unit/cli/argv-snapshot.json` (rewritten under 1.3.1 after review)

- [ ] **Step 1: Run the characterisation against 1.3.1**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/cli/cli-argv.test.ts 2>&1 | tee /tmp/rt06/argv-diff.txt`
Expected: the coverage test passes; the first test either passes or FAILS with `N argv parse differently than the 1.0.0-rc.3 snapshot:` followed by one block per argv. Expected kinds of differences, from the changelog table: extra positional arguments to a command without `.arguments()` now raise `TooManyArgumentsError` (`validation: true`); an empty value for a required option raises; an empty value for an optional option is skipped.

- [ ] **Step 2: Classify every difference in the PR description**

Put a table in the PR description with one row per differing argv: the argv, the rc.3 result, the 1.3.1 result, and a class:
- **accepted**: a user error rc.3 ignored and 1.3.1 reports as a `ValidationError` (exit 1 with one `ERROR:` line), for a command whose documentation (`quarto <cmd> --help`, quarto.org) does not promise the old behaviour;
- **fix**: anything else (an option value changed, a valid documented command line now fails, a `validation: false` error, a different command path). Fix each at the command definition (for example `.arguments("[...args]")` for a command that must keep accepting extra arguments), never by pinning Cliffy, and re-run Step 1 until only accepted rows remain.

- [ ] **Step 3: The engine `populateCommand` path**

`src/command/call/engine-cmd.ts:42-49` hands a fresh `new Command()` to the engine and parses the rest of the arguments. Run:
```bash
package/dist/bin/quarto call engine julia --help | head -20; echo "exit=$?"
```
Expected: the Julia engine's subcommands (`status`, `kill`, `log`, …) with their descriptions, as `populateJuliaEngineCommand` registers them through `.command(name, description)`, `.arguments`, `.option`, `.action` (the `packages/quarto-types/src/cli.ts` surface), exit 0. Compare with the same command on `main` (rc.3) and paste both in the PR.

- [ ] **Step 4: `cli-info`, `-V`, containers and errors**

Run (1.3.1):
```bash
package/dist/bin/quarto dev-call cli-info | jq -S . > /tmp/rt06/cli-info-131.json
diff -u /tmp/rt06/cli-info-rc3.json /tmp/rt06/cli-info-131.json > /tmp/rt06/cli-info.diff; wc -l /tmp/rt06/cli-info.diff
for a in "" "-V" "tools" "call" "dev-call" "check --nosuch" "nosuch"; do
  echo "== quarto $a"; package/dist/bin/quarto $a > "/tmp/rt06/out131-$(echo "$a" | tr ' ' '_').txt" 2>&1; echo "exit=$?"
done | tee /tmp/rt06/exits-131.txt
diff /tmp/rt06/exits-rc3.txt /tmp/rt06/exits-131.txt
```
Expected: the `cli-info` diff is attached to the PR (the option objects gain fields such as `envVar`/`defaultText` and usage strings may change; anything that consumes `quarto dev-call cli-info` sees it, so mention it in the changelog entry of Task 6); `-V` prints `99.9.9`; the exit codes are identical to rc.3 (`quarto` alone and the containers print help; `check --nosuch` and `nosuch` exit 1 with one `ERROR:` line and no stack trace). A changed exit code is a **fix** row in Step 2's table.

- [ ] **Step 5: Re-baseline the snapshot under 1.3.1 and commit**

Run:
```bash
package/dist/bin/quarto run --dev tools/cli-argv-snapshot.ts 1.3.1
cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/cli/cli-argv.test.ts
```
Expected: `2 passed`. The committed snapshot now guards the next Cliffy upgrade; the rc.3 → 1.3.1 differences live in the PR description.
```bash
git add tests/unit/cli/argv-snapshot.json
git commit -m "Re-baseline the argv characterisation under Cliffy 1.3.1

Differences from rc.3 were reviewed and classified in the PR description."
```

### Task 6: Build tooling, prompts, changelog and status

**Files:**
- Modify: `news/changelog-1.11.md`
- Modify: `dev-docs/runtime-migration/README.md`

- [ ] **Step 1: Exercise the prompts**

Run: `cd /tmp && rm -rf rt06p && /home/user/quarto-cli/package/dist/bin/quarto create project` (interactive: pick `default` with the arrow keys, type `rt06p`, confirm; answer `n` to opening an editor)
Expected: the `Select` list renders, arrow keys move the cursor, Enter accepts, the `Input` prompt echoes typed text, the project is created in `/tmp/rt06p`. Repeat on Windows (`quarto.cmd`; raw stdin differs there). Then:

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent $(find smoke/create smoke/use smoke/extensions -name '*.test.ts')`
Expected: all passed.

- [ ] **Step 2: `quarto-bld` and the bundle**

Run: `cd package/src && ./quarto-bld --help | head -20 && ./quarto-bld prepare-dist --set-version $(cat ../../version.txt) && cd ../.. && package/dist/bin/quarto run --dev tools/check-bundle-externals.ts package/pkg-working/bin/quarto.js`
Expected: help for the build tool (5 Cliffy importers under `package/src`), the bundle builds (`@cliffy/*` and its `@std` 1.x dependencies resolve through `@luca/esbuild-deno-loader` with the frozen lockfile), `OK: no external module specifiers ...`.

- [ ] **Step 3: Open the PR as a draft and get its number**

Run: `git push -u origin rt/06-deps-cliffy-jsr && gh pr create --draft --fill && gh pr view --json number -q .number`
Expected: the PR number (for example `15104`).

- [ ] **Step 4: Changelog**

In `news/changelog-1.11.md`, under `## Extensions`, add (with the PR number from Step 3):
```markdown
- ([#15104](https://github.com/quarto-dev/quarto-cli/pull/15104)): Quarto's command-line parser (Cliffy) is updated to 1.3.1. Engine extensions that add subcommands with `populateCommand` now receive a Cliffy 1.3.1 `Command`; the methods `@quarto/types` declares (`command`, `description`, `arguments`, `option`, `action`) behave as before. The JSON printed by `quarto dev-call cli-info` follows Cliffy 1.3.1's option and usage objects.
```
and under `## Commands`, in a new `### All commands` subsection placed first, one entry for the accepted rows of Task 5 Step 2, for example (adapt the list to the accepted classes in the table):
```markdown
### All commands

- ([#15104](https://github.com/quarto-dev/quarto-cli/pull/15104)): Commands that take no arguments now report unexpected extra arguments as an error instead of ignoring them.
```
If Task 5 accepted no user-visible difference, add only the `## Extensions` entry.

- [ ] **Step 5: Set the PR 06 row to `in progress` and commit**

```bash
git add news/changelog-1.11.md dev-docs/runtime-migration/README.md
git commit -m "Changelog: Cliffy 1.3.1"
git push
```

## Verification

```bash
rm -rf package/dist/bin/deno_cache && ./configure.sh        # frozen deno.lock
git status --short                                            # empty
package/dist/bin/tools/x86_64/deno check --import-map src/import_map.json src/quarto.ts package/src/bld.ts src/command/render/latexmk/quarto-latexmk.ts
package/dist/bin/quarto check
cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent \
  unit/cli/cli-argv.test.ts unit/core/append-log-options.test.ts unit/core/quarto-command-errors.test.ts \
  $(find smoke/create smoke/use smoke/extensions smoke/check smoke/inspect smoke/convert smoke/run smoke/logging smoke/env -name '*.test.ts') \
  smoke/render/render-minimal.test.ts smoke/render/render-cli-metadata-file.test.ts
cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent $(find smoke/typst-gather smoke/axe -name '*.test.ts')   # `quarto call` subcommands (hidden commands + forwarded log options)
package/dist/bin/quarto run --dev tools/check-runtime-boundary.ts   # OK, counts unchanged
```

Plus Task 4 Step 6, Task 5 and Task 6 Step 1 by hand on at least one Unix platform and on Windows.

On the PR: `Smoke Tests` (Linux and Windows), `Bundle Test` (three OSes), `Test quarto-latexmk` (`.github/workflows/test-quarto-latexmk.yml`, the other Cliffy root command), `Runtime Boundary`.

## Review checklist

- [ ] All four `@cliffy/*` packages are pinned to the same version (`1.3.1`), as exact-match keys; no `cliffy/` prefix entry remains; `deno.lock` pins `@cliffy/internal` and `@std/fmt`.
- [ ] The eleven keys match the sorted output of `grep -rhoE 'from "cliffy/[^"]+"' src package/src tests tools --include=*.ts | sort -u` exactly.
- [ ] `src/quarto.ts` catches `ValidationError` (from `cliffy/command/mod.ts`), nothing from a `_`-prefixed path.
- [ ] `HelpCommand().global()` and `CompletionsCommand()` registrations are unchanged in both root commands.
- [ ] `SelectValueOptions` in `src/command/create/cmd.ts` is a local alias of `SelectOptions<string>["options"]`.
- [ ] The argv snapshot was written under rc.3 before the upgrade (Task 2 commit), every difference is classified in the PR description, and the committed snapshot is the 1.3.1 re-baseline.
- [ ] The `cli-info` diff, the `-V`/container/error exit codes and the `quarto call engine julia --help` output are in the PR description.
- [ ] No other source file changed, unless a **fix** row required it (each such change is called out).
- [ ] No `https://deno.land/std@...` redirect was touched (PR 07's last task).

## Risks and rollback

- Argument validation got stricter between rc.3 and 1.3.1. The characterisation shows every such change before merge; accepted ones are in the changelog; a later user report of a real use case is fixed with `.arguments("[...args]")` on that command, not a Cliffy downgrade.
- Help output formatting changed (responsive width, argument default values shown). No test depends on it; documentation screenshots may differ.
- Prompt key handling changed (fuzzy search, vim keys): additive.
- `quarto` with no arguments: 1.x prints help and exits inside Cliffy (`Deno.exit(0)`), bypassing the `finally` env restore in `src/quarto.ts`; the process is exiting anyway. If something depended on `quarto` without arguments returning through `mainRunner`'s cleanup, `initSessionTempDir()` leaves an empty temp dir behind; mitigate by moving the no-argument check before `initSessionTempDir()` (`if (args.length === 0) { quartoCommand.showHelp(); exitWithCleanup(0); }`).
- Third-party engine extensions that call Cliffy methods beyond the `@quarto/types` `Command` surface may break. The changelog entry says so; the Julia engine (the only in-tree user) is checked in Task 5 Step 3.
- On Node (Phase 2), prompts ignore `cbreak` and path suggestions call `Deno.permissions`: Spike #2 in `SPIKES.md`, not this PR.
- Rollback: revert the commits; the `cliffy/` prefix entry returns and `deno.lock` reverts with it.

## Decisions needed

1. **Exact-match keys vs. rewriting 68 import lines to `@cliffy/command` style.** Exact keys keep the diff reviewable and the Node bundle's resolver (PR 26) consumes the same map. Recommendation: exact keys now; a one-commit mechanical rename after PR 26, if wanted.
2. **`CommandError` vs `ValidationError` in `src/quarto.ts`.** Catching only `ValidationError` lets Cliffy's programming errors (duplicate option names, missing default command) crash with a stack trace. Recommendation: `ValidationError` (this plan); those errors are bugs in Quarto's command definitions and should be loud.

Review items closed here: option-parsing characterisation over every command's options (Tasks 2 and 5), `cli-info` JSON diff, `engine-cmd.ts:49` parse site and the `populateCommand` public API (Context, Task 5 Step 3, changelog), `-V` (Task 2 Step 5, Task 5 Step 4), transitive ranges (`deno.lock`, PR 00b), the importer count (41 files import `cliffy/command/mod.ts` in `src`), the missing re-vendor step (Task 3 Step 2), the `vendor_deps.ts` base64 import and `std@0.196.0` redirect (PR 07's last task), `cbreak` and `Deno.permissions` on Node (Spike #2).
