# PR 27b: `platform.ts`, `env.ts`, `tar.ts` and the `log.ts` file handler on `node:` APIs

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reimplement the four `deno_ral` modules no other Phase 2 plan ports (`src/deno_ral/platform.ts`, `env.ts`, `tar.ts`, and the `FileHandler` PR 20b added to `log.ts`) on `node:process`, `node:os`, `node:util` and `node:fs`, so that importing the layer on Node no longer throws `ReferenceError: Deno is not defined` and `runtime()` reports the runtime that is actually running, including inside the Node bundle.
**Phase:** 2, before PR 31. **Depends on:** PR 14 (`env.ts` and its contract test), PR 19 (`platform.ts` exports and real `runtime()` detection), PR 20b (`FileHandler` in `log.ts`, `quarto-core/dotenv.ts` on the layer), PR 25 (boundary at zero), PR 26 (shim, `node-unit` job), PR 27 (`fs.ts` on `node:fs`, used by the tests). **Unblocks:** PR 28, PR 29, PR 30 (they depend on `platform.ts` and `env.ts` on `node:`), PR 31, PR 32.
**Branch:** `rt/27b-ral-platform-env-tar-log-on-node`.
**Suggested executor:** Sonnet. Four small modules with fixed interfaces and contract tests; the only judgement is the `runtime()` shim marker and the lazy tar input streams, both specified here.
**Size:** S (4 source files rewritten, 3 test files added or extended, shim shrink).
**Ships on:** Deno; the whole existing suite must stay green. Node: the PR 26 `node-unit` job runs `tests/unit/ral/` on real Node on Linux and Windows; the `platform`, `env`, `tar` and `log-file-handler` entries in `tools/node-bundle/known-failures.json` are removed by this PR and none is added.

## Spec

### Context

Review finding B2 (`REVIEW-2026-10-15.md`, S1 and the Phase 2 report): PRs 27–30 port `fs`, `temp`, `errors`, `process`, `net`, `http`, `watch` and `kv`, but nothing ports four modules the layer itself owns:

| Module | On `main` after Phase 1 | Consequence on Node |
|---|---|---|
| `src/deno_ral/platform.ts` | `Deno.build.os`/`arch` at module scope; PR 19's `runtime()` detects the runtime, `consoleColumns`/`inspect`/`isRootUser`/`noColor` call `Deno.*` | unbundled: `ReferenceError` on import, so every test that imports the layer fails (PR 31's `run-tests-node.sh --agent unit/ral/` cannot pass); bundled: the shim's `Deno.version` makes `runtime()` answer `deno`, so every "`runtime().name === "node"`" branch in PR 28, 29 and 31 is dead |
| `src/deno_ral/env.ts` | `Deno.env.*` (PR 14) | `ReferenceError` on first use; `tests/harness.ts` (PR 31) imports it |
| `src/deno_ral/tar.ts` | `@std/tar` `TarStream` fed by `stat`/`open`/`create` (layer calls after PR 13; `Deno.stat`/`Deno.open`/`Deno.create` before) and `import { pathWithForwardSlashes } from "../core/path.ts"` | works once PR 27 lands, but opens every input file before the archive is written (`Promise.all` over `open`): EMFILE on large `quarto publish` bundles (macOS's default limit is 256) |
| `src/deno_ral/log.ts` `FileHandler` (PR 20b) | file I/O through the layer, flush on `globalThis.addEventListener("unload")` | Node has no global `addEventListener("unload")`: `--log <file>` throws at `setup()` |

`@std/tar` 0.1.6 (`tar/tar-stream`) itself is pure web streams: its `tar_stream.js` mentions `Deno.*` only in doc comments (checked in the published `@jsr/std__tar@0.1.6` package), so it stays. `@std/log`'s `BaseHandler`, `ConsoleHandler`, `setup` and `getLogger` are runtime-neutral and stay; only the file handler needed replacing, which PR 20b did. The `.env` loader is PR 20b's own parser in `src/quarto-core/dotenv.ts` on the layer's `env`/`fs`, so it runs on Node once this PR and PR 27 land; it is verified here, not rewritten.

**Decision: `runtime()` recognises the Node shim.** The bundle's temporary shim (`tools/node-bundle/deno-shim.mjs`, PR 26) defines `globalThis.Deno` with a `version` member, so PR 19's detection (`typeof Deno !== "undefined" && "version" in Deno`) answers `deno` inside the bundle. The shim carries the marker `Symbol.for("quarto.deno-shim")` (PR 26); `runtime()` treats a `Deno` global carrying it as absent. This is the only place outside `tools/` that knows about the shim, and it disappears with the shim (PR 33).

**Decision: `env` keeps Deno's validation.** `process.env` silently accepts keys Deno rejects. The Node body validates like `Deno.env`: an empty key, or a key containing `=` or NUL, throws `TypeError` from `get`, `set` and `delete`; a value containing NUL throws `TypeError` from `set`. This is the contract PR 14's test pins.

### Scope

In:
- `src/deno_ral/platform.ts`: every export on `node:process`/`node:util`; `runtime()` as PR 19 wrote it plus the shim marker.
- `src/deno_ral/env.ts`: on `process.env` with Deno's key and value validation.
- `src/deno_ral/tar.ts`: input files opened lazily, one at a time, on `node:fs/promises`; output on `node:fs` `createWriteStream`; the `../core/path.ts` import replaced by a local one-liner (a layer module must not import `src/core`).
- `src/deno_ral/log.ts`: PR 20b's `FileHandler` on `node:fs` with a `process.on("exit")` flush.
- Tests under `tests/unit/ral/`; shim shrink; `known-failures.json` shrink.

Out:
- `process.ts` (PR 28), `net.ts`/`http.ts`/`watch.ts` (PR 29), `kv.ts` (PR 30).
- `@std/log`'s console handler and level machinery (runtime-neutral, kept).
- The `.env` parser (PR 20b; only verified here).
- Changing any caller (signatures unchanged).

### Interfaces

Unchanged from the shared vocabulary (`_TEMPLATE.md`, "`platform.ts`", "`env.ts`") and from PR 20b. Spelled out for this PR:

```ts
// src/deno_ral/platform.ts
export const isWindows: boolean;
export const isMac: boolean;
export const isLinux: boolean;
/** Deno.build.os spelling: "windows" | "darwin" | "linux" | other process.platform values. */
export const os: string;
/** Deno.build.arch spelling: "x86_64" | "aarch64" | other process.arch values. */
export const arch: string;
/** deno when a real Deno global exists (not the Node shim), bun when process.versions.bun, else node. */
export function runtime(): { name: "deno" | "node" | "bun"; version: string };
/** Terminal width of stdout, else stderr; undefined when neither is a terminal. */
export function consoleColumns(): number | undefined;
export function inspect(value: unknown, options?: { depth?: number; colors?: boolean }): string;
export function isRootUser(): boolean;
/** NO_COLOR present and non-empty at program start (https://no-color.org). */
export function noColor(): boolean;

// src/deno_ral/env.ts
export const env: {
  /** TypeError for "", or a key containing "=" or NUL (Deno.env.get semantics). */
  get(name: string): string | undefined;
  /** TypeError for an invalid key, or a value containing NUL. */
  set(name: string, value: string): void;
  delete(name: string): void;
  /** Snapshot copy; mutating it does not change the environment. */
  toObject(): Record<string, string>;
};

// src/deno_ral/tar.ts (unchanged signature)
export function createTarFromFiles(outputPath: string, filePaths: string[], options?: { baseDir?: string }): Promise<void>;

// src/deno_ral/log.ts (PR 20b's class; same constructor and methods as @std/log 0.224's FileHandler,
// which src/core/log.ts LogFileHandler extends and calls flush() on)
export interface FileHandlerOptions extends BaseHandlerOptions { filename: string; mode?: "a" | "w" | "x"; bufferSize?: number; }
export class FileHandler extends BaseHandler {
  constructor(levelName: LevelName, options: FileHandlerOptions);
  setup(): void;     // opens the file ("a" append, "w" truncate, "x" fail if it exists); registers the exit flush
  handle(logRecord: LogRecord): void; // flushes immediately for levels above ERROR
  log(msg: string): void;            // buffers msg + "\n" (bufferSize, default 4096 bytes)
  flush(): void;
  destroy(): void;   // flush, close, unregister the exit flush
}
```

### Files

- Modify: `src/deno_ral/platform.ts` (entire body)
- Modify: `src/deno_ral/env.ts` (entire body)
- Modify: `src/deno_ral/tar.ts` (entire body)
- Modify: `src/deno_ral/log.ts` (the `FileHandler` class PR 20b added; the `@std/log` re-exports stay)
- Test: `tests/unit/ral/platform.test.ts` (PR 19; one case appended), `tests/unit/ral/env.test.ts` (PR 14; validation cases appended if absent), `tests/unit/ral/tar.test.ts` (new), `tests/unit/ral/log-file-handler.test.ts` (new, or extended if PR 20b created it). Assumes PR 14 and PR 19 put their contract tests at these paths (vocabulary rule: layer tests live in `tests/unit/ral/`); if not, extend the files `ls tests/unit/ral/` shows.
- Modify: `tools/node-bundle/deno-shim.mjs` (delete members reported unused), `tools/node-bundle/known-failures.json` (remove fixed entries)

### Acceptance criteria

- `grep -n "Deno" src/deno_ral/platform.ts src/deno_ral/env.ts src/deno_ral/tar.ts src/deno_ral/log.ts | grep -v "^\S*:\s*//\|^\S*:\s*\*"` prints only the `globalThis.Deno` read inside `runtime()` (comments excepted).
- `grep -n "core/" src/deno_ral/tar.ts` prints nothing.
- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent $(find unit/ral/ -name '*.test.ts') unit/dotenv-config.test.ts unit/environment.test.ts` passes on Deno.
- `node tools/node-bundle/run-unit-on-node.mjs --known-failures tools/node-bundle/known-failures.json tests/unit/ral/ tests/unit/dotenv-config.test.ts` passes on Linux with no `platform`/`env`/`tar`/`log-file-handler` entry left.
- In the Node bundle, `runtime().name` is `node`: `tools/node-bundle/quarto-node check 2>&1 | grep -i "node"` shows the Node version on the runtime row (PR 19 prints `runtime().version` there).
- `node tools/node-bundle/build.mjs --check-shim` → `0 missing`, no `unused` list.

## Plan

### Task 1: `platform.ts`

**Files:**
- Modify: `tests/unit/ral/platform.test.ts`
- Modify: `src/deno_ral/platform.ts`

- [ ] **Step 1: Write the failing test**

Append to `tests/unit/ral/platform.test.ts` (add the imports the file lacks):

```ts
import { arch, consoleColumns, isLinux, isMac, isRootUser, isWindows, noColor, os, runtime } from "../../../src/deno_ral/platform.ts";
import { env } from "../../../src/deno_ral/env.ts";

unitTest("platform - values use Deno's spelling on every runtime", async () => {
  assert(["windows", "darwin", "linux"].includes(os), `os=${os}`);
  assertEquals(isWindows, os === "windows");
  assertEquals(isMac, os === "darwin");
  assertEquals(isLinux, os === "linux");
  assert(["x86_64", "aarch64"].includes(arch), `arch=${arch}`);
  const c = consoleColumns();
  assert(c === undefined || (Number.isInteger(c) && c > 0), `columns=${c}`);
  assertEquals(typeof isRootUser(), "boolean");
  assertEquals(noColor(), (env.get("NO_COLOR") ?? "") !== "");
});

unitTest("platform - runtime() names the runtime that runs this test, not the bundle shim", async () => {
  const r = runtime();
  // deno test runs this file on Deno; PR 26's node-unit job runs the bundled file on Node with the shim installed.
  // deno-lint-ignore no-explicit-any
  const g = globalThis as any;
  const realDeno = typeof g.Deno !== "undefined" && !g.Deno[Symbol.for("quarto.deno-shim")];
  assertEquals(r.name, realDeno ? "deno" : (g.process?.versions?.bun ? "bun" : "node"));
  assert(/^\d+\.\d+\.\d+/.test(r.version), `version=${r.version}`);
});
```

(`unitTest` from `../../test.ts`; `assert`, `assertEquals` from `../../asserts.ts`.)

- [ ] **Step 2: Run it and see it fail**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/platform.test.ts`
Expected on Deno: both pass (the PR 19 body reads `Deno.*`). Then run it on Node through the bundle: `node tools/node-bundle/run-unit-on-node.mjs --known-failures tools/node-bundle/known-failures.json tests/unit/ral/platform.test.ts`
Expected: `new Node failure: tests/unit/ral/platform.test.ts > [unit] > platform - runtime() names the runtime …` (the shim's `Deno.version` makes PR 19's `runtime()` answer `deno`), exit 1.

- [ ] **Step 3: Implement**

```ts
/*
 * platform.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 *
 * Platform and runtime facts on node:process / node:util. Runs on Node and on
 * Deno 2 (node compat). Values keep Deno's spelling (os "windows", arch
 * "x86_64"/"aarch64") because callers compare against those strings.
 */
import process from "node:process";
import { inspect as utilInspect } from "node:util";

export const os: string = process.platform === "win32" ? "windows" : process.platform;
export const isWindows = os === "windows";
export const isMac = os === "darwin";
export const isLinux = os === "linux";
export const arch: string = process.arch === "x64"
  ? "x86_64"
  : process.arch === "arm64"
  ? "aarch64"
  : process.arch;

// The Node bundle's temporary Deno shim (tools/node-bundle/deno-shim.mjs)
// carries this marker; a Deno global with it is not Deno (PR 26, PR 33).
const kShimMarker = Symbol.for("quarto.deno-shim");

export function runtime(): { name: "deno" | "node" | "bun"; version: string } {
  // deno-lint-ignore no-explicit-any
  const d = (globalThis as any).Deno;
  if (typeof d !== "undefined" && d !== null && "version" in d && !d[kShimMarker]) {
    return { name: "deno", version: String(d.version.deno) };
  }
  const bun = (process.versions as Record<string, string | undefined>).bun;
  if (bun) return { name: "bun", version: bun };
  return { name: "node", version: process.versions.node };
}

export function consoleColumns(): number | undefined {
  // Deno.consoleSize() tries stdout, then stderr. stdin is not touched: on
  // Node, reading process.stdin creates a stream that keeps the process alive.
  return process.stdout.columns ?? process.stderr.columns ?? undefined;
}

export function inspect(value: unknown, options?: { depth?: number; colors?: boolean }): string {
  return utilInspect(value, { depth: options?.depth ?? 4, colors: options?.colors ?? false });
}

export function isRootUser(): boolean {
  // process.getuid is undefined on Windows (Deno.uid() returned null there).
  return typeof process.getuid === "function" && process.getuid() === 0;
}

// Read once, like Deno.noColor ("at program start").
const kNoColor = (process.env.NO_COLOR ?? "") !== "";
export function noColor(): boolean {
  return kNoColor;
}
```

If PR 19 left other exports in the file (`grep -n "^export" src/deno_ral/platform.ts` before overwriting), keep them with bodies on `node:process`.

- [ ] **Step 4: Run on both runtimes**

Run:
```bash
cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/platform.test.ts && cd ..
node tools/node-bundle/run-unit-on-node.mjs --known-failures tools/node-bundle/known-failures.json tests/unit/ral/platform.test.ts
```
Expected: green on Deno; on Node either `no change` or `now passes on Node, remove it …` for platform entries (remove them in Task 5).

- [ ] **Step 5: Commit**

```bash
git add src/deno_ral/platform.ts tests/unit/ral/platform.test.ts
git commit -m "deno_ral/platform: node:process body; runtime() ignores the Node shim"
```

### Task 2: `env.ts`

**Files:**
- Modify: `tests/unit/ral/env.test.ts`
- Modify: `src/deno_ral/env.ts`

- [ ] **Step 1: Make sure the validation cases exist**

Run: `grep -n "invalid characters\|empty string" tests/unit/ral/env.test.ts`
If it prints nothing, PR 14's test predates the vocabulary's validation rule: append (adding `assertThrows` to the `../../asserts.ts` import):

```ts
unitTest("env - invalid keys and values throw TypeError like Deno.env", async () => {
  assertThrows(() => env.get(""), TypeError);
  assertThrows(() => env.set("", "x"), TypeError);
  assertThrows(() => env.set("QUARTO_A=B", "x"), TypeError);
  assertThrows(() => env.set("QUARTO_A\0B", "x"), TypeError);
  assertThrows(() => env.get("QUARTO_A=B"), TypeError);
  assertThrows(() => env.delete("QUARTO_A=B"), TypeError);
  assertThrows(() => env.set("QUARTO_RAL_ENV_VALID_KEY", "a\0b"), TypeError);
  assertEquals(env.get("QUARTO_RAL_ENV_VALID_KEY"), undefined, "a rejected set leaves nothing behind");
});
```

- [ ] **Step 2: Run on Node and see it fail**

Run: `node tools/node-bundle/run-unit-on-node.mjs --known-failures tools/node-bundle/known-failures.json tests/unit/ral/env.test.ts`
Expected: the validation case fails on Node with the shim's `Deno.env` (it does not validate); the other PR 14 cases pass.

- [ ] **Step 3: Implement**

```ts
/*
 * env.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 *
 * Process environment on process.env, with Deno.env's validation (an empty
 * key, or a key containing "=" or NUL, and a value containing NUL, throw
 * TypeError). Methods do not use `this`, so they can be passed as callbacks.
 */
import process from "node:process";

function checkKey(name: string): void {
  if (name === "") {
    throw new TypeError("Key is an empty string.");
  }
  if (name.includes("=") || name.includes("\0")) {
    throw new TypeError(`Key contains invalid characters: ${JSON.stringify(name)}`);
  }
}

export const env = {
  get(name: string): string | undefined {
    checkKey(name);
    return process.env[name];
  },
  set(name: string, value: string): void {
    checkKey(name);
    if (value.includes("\0")) {
      throw new TypeError(`Value contains invalid characters: ${JSON.stringify(value)}`);
    }
    process.env[name] = value;
  },
  delete(name: string): void {
    checkKey(name);
    delete process.env[name];
  },
  toObject(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(process.env)) {
      if (v !== undefined) out[k] = v;
    }
    return out;
  },
};
```

- [ ] **Step 4: Run on both runtimes**

Run:
```bash
cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/env.test.ts unit/environment.test.ts unit/dotenv-config.test.ts && cd ..
node tools/node-bundle/run-unit-on-node.mjs --known-failures tools/node-bundle/known-failures.json tests/unit/ral/env.test.ts tests/unit/dotenv-config.test.ts
```
Expected: green on Deno; on Node no new failure (the `.env` parser of PR 20b now reads and sets variables through this module on Node).

- [ ] **Step 5: Commit**

```bash
git add src/deno_ral/env.ts tests/unit/ral/env.test.ts
git commit -m "deno_ral/env: process.env body with Deno.env validation"
```

### Task 3: `tar.ts`

**Files:**
- Create: `tests/unit/ral/tar.test.ts`
- Modify: `src/deno_ral/tar.ts`

- [ ] **Step 1: Write the failing test**

```ts
/*
 * tar.test.ts
 *
 * createTarFromFiles: archive paths relative to baseDir with forward
 * slashes, directories with a trailing "/", file contents byte-exact, and
 * many inputs without opening every file at once.
 *
 * Copyright (C) 2026 Posit Software, PBC
 */
import { unitTest } from "../../test.ts";
import { assert, assertEquals } from "../../asserts.ts";
import { join } from "../../../src/deno_ral/path.ts";
import { makeTempDirSync } from "../../../src/deno_ral/temp.ts";
import { mkdirSync, readFile, removeSync, writeTextFileSync } from "../../../src/deno_ral/fs.ts";
import { createTarFromFiles } from "../../../src/deno_ral/tar.ts";
import { UntarStream } from "tar/untar-stream";

async function listTar(file: string): Promise<Map<string, string | null>> {
  const bytes = await readFile(file);
  const entries = new Map<string, string | null>();
  const stream = ReadableStream.from([bytes]).pipeThrough(new UntarStream());
  for await (const entry of stream) {
    entries.set(entry.path, entry.readable ? await new Response(entry.readable).text() : null);
  }
  return entries;
}

unitTest("tar - paths are relative to baseDir with forward slashes; contents round-trip", async () => {
  const dir = makeTempDirSync({ prefix: "rt27b-tar-" });
  const stage = join(dir, "stage");
  mkdirSync(join(stage, "site", "sub"), { recursive: true });
  writeTextFileSync(join(stage, "site", "index.html"), "<h1>hi</h1>");
  writeTextFileSync(join(stage, "site", "sub", "a.css"), "body{}");
  const out = join(dir, "bundle.tar");
  await createTarFromFiles(out, ["site", join("site", "sub"), join("site", "index.html"), join("site", "sub", "a.css")], { baseDir: stage });
  const entries = await listTar(out);
  assertEquals([...entries.keys()], ["site/", "site/sub/", "site/index.html", "site/sub/a.css"]);
  assertEquals(entries.get("site/index.html"), "<h1>hi</h1>");
  assertEquals(entries.get("site/sub/a.css"), "body{}");
  removeSync(dir, { recursive: true });
});

unitTest("tar - 2000 inputs are archived without exhausting file descriptors", async () => {
  const dir = makeTempDirSync({ prefix: "rt27b-tar-many-" });
  const stage = join(dir, "stage");
  mkdirSync(stage);
  const names: string[] = [];
  for (let i = 0; i < 2000; i++) {
    const name = `f${String(i).padStart(4, "0")}.txt`;
    writeTextFileSync(join(stage, name), name);
    names.push(name);
  }
  const out = join(dir, "many.tar");
  await createTarFromFiles(out, names, { baseDir: stage });
  const entries = await listTar(out);
  assertEquals(entries.size, 2000);
  assertEquals(entries.get("f1999.txt"), "f1999.txt");
  assert(entries.get("f0000.txt") === "f0000.txt");
  removeSync(dir, { recursive: true });
});
```

(`tar/untar-stream` resolves through the import map's `"tar/"` entry, like `tar/tar-stream` in `src/deno_ral/tar.ts`.)

- [ ] **Step 2: Run it and see it fail**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/tar.test.ts`
Expected on Deno: the first case passes; the second fails with `EMFILE`/`Too many open files` where the descriptor limit is below 2000 (macOS default 256; check with `ulimit -n`; on a Linux runner with a high limit it may pass, and the Node run below is the contract).

- [ ] **Step 3: Implement**

```ts
/*
 * tar.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 *
 * Creates tar archives with @std/tar's TarStream (pure web streams) fed by
 * node:fs. Input files are opened one at a time, when TarStream pulls them,
 * so a large publish bundle never holds more than one input descriptor.
 */
import { createWriteStream } from "node:fs";
import { type FileHandle, open, stat } from "node:fs/promises";
import { Writable } from "node:stream";
import { TarStream, type TarStreamInput } from "tar/tar-stream";
import { join } from "./path.ts";

const kChunk = 64 * 1024;

// A layer module must not import src/core: the one helper tar needed from
// core/path.ts is this.
function forwardSlashes(path: string): string {
  return path.replace(/\\/g, "/");
}

function lazyFileStream(path: string): ReadableStream<Uint8Array> {
  let handle: FileHandle | undefined;
  let position = 0;
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      handle ??= await open(path, "r");
      const buffer = new Uint8Array(kChunk);
      const { bytesRead } = await handle.read(buffer, 0, kChunk, position);
      if (bytesRead === 0) {
        await handle.close();
        handle = undefined;
        controller.close();
        return;
      }
      position += bytesRead;
      controller.enqueue(buffer.subarray(0, bytesRead));
    },
    async cancel() {
      await handle?.close();
      handle = undefined;
    },
  });
}

/**
 * Creates a tar archive from the specified files and directories.
 * @param outputPath The path where the tar archive will be created.
 * @param filePaths File and directory paths to include, relative to baseDir when given.
 * @param options.baseDir Base directory for resolving relative paths in the archive.
 */
export async function createTarFromFiles(
  outputPath: string,
  filePaths: string[],
  options?: { baseDir?: string },
): Promise<void> {
  const baseDir = options?.baseDir;
  const inputs: TarStreamInput[] = [];
  for (const path of filePaths) {
    const fullPath = baseDir ? join(baseDir, path) : path;
    const info = await stat(fullPath);
    const archivePath = forwardSlashes(path);
    if (info.isDirectory()) {
      inputs.push({ type: "directory", path: archivePath + (archivePath.endsWith("/") ? "" : "/") });
    } else {
      inputs.push({ type: "file", path: archivePath, size: info.size, readable: lazyFileStream(fullPath) });
    }
  }
  await ReadableStream.from(inputs)
    .pipeThrough(new TarStream())
    .pipeTo(Writable.toWeb(createWriteStream(outputPath)) as WritableStream<Uint8Array>);
}
```

- [ ] **Step 4: Run on both runtimes, and the publish path**

Run:
```bash
cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/tar.test.ts && cd ..
node tools/node-bundle/run-unit-on-node.mjs --known-failures tools/node-bundle/known-failures.json tests/unit/ral/tar.test.ts
grep -rn "createTarFromFiles" src --include=*.ts
```
Expected: green on Deno and on Node; the grep shows the single caller `src/publish/common/bundle.ts:110` (Posit Connect bundles), whose arguments (`tarFile`, `tarFiles`, `{ baseDir: stageDir }`) match the unchanged signature.

- [ ] **Step 5: Commit**

```bash
git add src/deno_ral/tar.ts tests/unit/ral/tar.test.ts
git commit -m "deno_ral/tar: node:fs streams, inputs opened lazily one at a time"
```

### Task 4: `log.ts` `FileHandler`

**Files:**
- Create or extend: `tests/unit/ral/log-file-handler.test.ts`
- Modify: `src/deno_ral/log.ts`

- [ ] **Step 1: Write the failing test**

If PR 20b created `tests/unit/ral/log-file-handler.test.ts`, append the last case only; otherwise create the file:

```ts
/*
 * log-file-handler.test.ts
 *
 * deno_ral/log.ts FileHandler: modes, buffering, flush, destroy, and that
 * setup() works where there is no global "unload" event (Node).
 *
 * Copyright (C) 2026 Posit Software, PBC
 */
import { unitTest } from "../../test.ts";
import { assert, assertEquals } from "../../asserts.ts";
import { join } from "../../../src/deno_ral/path.ts";
import { makeTempDirSync } from "../../../src/deno_ral/temp.ts";
import { readTextFileSync, removeSync, writeTextFileSync } from "../../../src/deno_ral/fs.ts";
import { isAlreadyExists } from "../../../src/deno_ral/errors.ts";
import { FileHandler } from "../../../src/deno_ral/log.ts";

unitTest("log FileHandler - w truncates, a appends, x refuses an existing file", async () => {
  const dir = makeTempDirSync({ prefix: "rt27b-log-" });
  const file = join(dir, "q.log");
  writeTextFileSync(file, "old\n");
  const w = new FileHandler("INFO", { filename: file, mode: "w" });
  w.setup();
  w.log("one");
  w.flush();
  assertEquals(readTextFileSync(file), "one\n");
  w.destroy();
  const a = new FileHandler("INFO", { filename: file, mode: "a" });
  a.setup();
  a.log("two");
  a.destroy();
  assertEquals(readTextFileSync(file), "one\ntwo\n", "destroy flushes");
  const x = new FileHandler("INFO", { filename: file, mode: "x" });
  try {
    x.setup();
    assert(false, "expected EEXIST");
  } catch (e) {
    assert(isAlreadyExists(e), `expected AlreadyExists, got ${e}`);
  }
  removeSync(dir, { recursive: true });
});

unitTest("log FileHandler - buffers until bufferSize, then writes", async () => {
  const dir = makeTempDirSync({ prefix: "rt27b-log-buf-" });
  const file = join(dir, "q.log");
  const h = new FileHandler("INFO", { filename: file, mode: "w", bufferSize: 16 });
  h.setup();
  h.log("12345");
  assertEquals(readTextFileSync(file), "", "buffered");
  h.log("abcdefghijklmnop"); // does not fit: flushes the buffer, then writes through
  assertEquals(readTextFileSync(file), "12345\nabcdefghijklmnop\n");
  h.destroy();
  h.flush(); // a no-op after destroy: reaching the next line is the assertion
  assertEquals(readTextFileSync(file), "12345\nabcdefghijklmnop\n");
  removeSync(dir, { recursive: true });
});
```

- [ ] **Step 2: Run on Node and see it fail**

Run: `node tools/node-bundle/run-unit-on-node.mjs --known-failures tools/node-bundle/known-failures.json tests/unit/ral/log-file-handler.test.ts`
Expected: `setup()` throws `TypeError: globalThis.addEventListener is not a function` (PR 20b's unload hook) or the cases pass if PR 20b already used `process.on`; either way Step 3 makes the body `node:fs` only.

- [ ] **Step 3: Implement**

Replace the `FileHandler` class (and its options interface) in `src/deno_ral/log.ts` with the block below; keep every `@std/log` re-export the file has (`debug`, `error`, `getLogger`, `info`, `LogLevels`, `setup`, `warning`, `LevelName`, `LogRecord`, `BaseHandler` …). If `BaseHandler`, `BaseHandlerOptions`, `LevelName`, `LogLevels` or `LogRecord` are not imported yet, import them from `"log"` (the import-map name the file already uses).

```ts
import { closeSync, openSync, writeSync } from "node:fs";
import process from "node:process";

export interface FileHandlerOptions extends BaseHandlerOptions {
  filename: string;
  mode?: "a" | "w" | "x";
  bufferSize?: number;
}

/**
 * File log handler on node:fs with @std/log 0.224 FileHandler semantics:
 * log(msg) buffers msg + "\n"; a record above ERROR flushes at once; the
 * buffer is flushed when full, on flush(), on destroy() and at process exit.
 */
export class FileHandler extends BaseHandler {
  protected _filename: string;
  protected _mode: "a" | "w" | "x";
  #fd: number | undefined;
  #buffer: Uint8Array;
  #pointer = 0;
  #encoder = new TextEncoder();
  #onExit = () => this.destroy();

  constructor(levelName: LevelName, options: FileHandlerOptions) {
    super(levelName, options);
    this._filename = options.filename;
    this._mode = options.mode ?? "a";
    this.#buffer = new Uint8Array(options.bufferSize ?? 4096);
  }

  override setup(): void {
    const flag = this._mode === "a" ? "a" : this._mode === "w" ? "w" : "wx";
    this.#fd = openSync(this._filename, flag);
    process.on("exit", this.#onExit);
  }

  override handle(logRecord: LogRecord): void {
    super.handle(logRecord);
    if (logRecord.level > LogLevels.ERROR) this.flush();
  }

  override log(msg: string): void {
    const bytes = this.#encoder.encode(msg + "\n");
    if (bytes.byteLength > this.#buffer.byteLength - this.#pointer) this.flush();
    if (bytes.byteLength > this.#buffer.byteLength) {
      this.#writeAll(bytes);
      return;
    }
    this.#buffer.set(bytes, this.#pointer);
    this.#pointer += bytes.byteLength;
  }

  flush(): void {
    if (this.#pointer > 0 && this.#fd !== undefined) {
      this.#writeAll(this.#buffer.subarray(0, this.#pointer));
    }
    this.#pointer = 0;
  }

  override destroy(): void {
    this.flush();
    if (this.#fd !== undefined) {
      closeSync(this.#fd);
      this.#fd = undefined;
    }
    process.off("exit", this.#onExit);
  }

  #writeAll(bytes: Uint8Array): void {
    if (this.#fd === undefined) return;
    let offset = 0;
    while (offset < bytes.byteLength) {
      offset += writeSync(this.#fd, bytes, offset, bytes.byteLength - offset);
    }
  }
}
```

- [ ] **Step 4: Run on both runtimes, and `--log`**

Run:
```bash
cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/log-file-handler.test.ts $(find smoke/logging/ -name '*.test.ts') && cd ..
node tools/node-bundle/run-unit-on-node.mjs --known-failures tools/node-bundle/known-failures.json tests/unit/ral/log-file-handler.test.ts
node tools/node-bundle/build.mjs && tools/node-bundle/quarto-node render dev-docs/runtime-migration/spike/tests/simple.qmd --log /tmp/rt27b.log --log-level info && grep -c "Output created" /tmp/rt27b.log
```
Expected: green on Deno (`tests/smoke/logging/` exercises `--log`); on Node no new failure; the bundle writes the log file and the grep prints `1`.

- [ ] **Step 5: Commit**

```bash
git add src/deno_ral/log.ts tests/unit/ral/log-file-handler.test.ts
git commit -m "deno_ral/log: FileHandler on node:fs with an exit-time flush"
```

### Task 4b: `colors.ts` honours `NO_COLOR` on Node (promised by PR 22)

**Files:** `src/deno_ral/colors.ts`, `tests/unit/ral/colors.test.ts` (new, 2 cases)

PR 22 wrote in `src/deno_ral/colors.ts`: "PR 27b makes this file call `setColorEnabled(!noColor())` so `NO_COLOR` is honoured on Node too". `@std/fmt/colors` decides from `globalThis.Deno?.noColor`, which the Node runtime does not have.

- [ ] **Step 1: Write the failing test**: a `unitTest` that spawns `execPath()` with `NO_COLOR=1` running a one-line script importing `src/deno_ral/colors.ts` and printing `red("x")`, and asserts the output has no escape code; a second case without `NO_COLOR` on a non-TTY asserts the same function's result equals what `getColorEnabled()` says.
- [ ] **Step 2: Run it and see it fail** on the Node job: `node tools/node-bundle/run-unit-on-node.mjs tests/unit/ral/colors.test.ts`. Expected: the `NO_COLOR` case fails on Node (colour emitted), passes on Deno.
- [ ] **Step 3: Implement**: after the re-export line in `colors.ts`, `import { noColor } from "./platform.ts"; setColorEnabled(!noColor());` (Task 1's `noColor()` reads `NO_COLOR` on both runtimes).
- [ ] **Step 4: Run the tests** on Deno (`cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/colors.test.ts`) and on Node (step 2 command). Expected: both cases pass on both runtimes.
- [ ] **Step 5: Commit**: `git add src/deno_ral/colors.ts tests/unit/ral/colors.test.ts && git commit -m "deno_ral/colors: honour NO_COLOR on Node (PR 22's promise)"`

### Task 5: Shim and known-failures shrink

**Files:**
- Modify: `tools/node-bundle/deno-shim.mjs`, `tools/node-bundle/known-failures.json`

- [ ] **Step 1: Delete the unused shim members**

Run: `npm ci && node tools/node-bundle/build.mjs --check-shim`
Expected: `0 missing` and an `unused` list; the candidates are `env`, `build`, `version`, `consoleSize`, `inspect`, `uid`, `noColor`, `hostname`. A member still referenced by `src/resources/**/*.js` (for example `Deno.build` and `Deno.env` in `julia-engine.js` until the subtree pull, decision 7) is not listed and stays. Delete exactly the listed lines; rebuild; `0 missing`, no `unused` list.

- [ ] **Step 2: Remove the fixed known failures**

Run: `node tools/node-bundle/run-unit-on-node.mjs --known-failures tools/node-bundle/known-failures.json tests/unit/ral/`
Expected: `now passes on Node, remove it …` lines for `platform`, `env`, `tar` and `log-file-handler` cases (exit 1). Delete them from the `linux` section (and from `windows` when this branch's Windows `node-unit` run reports them); rerun; `no change`, exit 0.

- [ ] **Step 3: Commit**

```bash
git add tools/node-bundle/deno-shim.mjs tools/node-bundle/known-failures.json
git commit -m "node-bundle: drop shim members and known failures fixed by deno_ral platform/env/tar/log"
```

## Verification

- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent $(find unit/ral/ -name '*.test.ts') unit/environment.test.ts unit/dotenv-config.test.ts unit/binary-mode-strip-env.test.ts $(find smoke/logging/ -name '*.test.ts') $(find smoke/env/ -name '*.test.ts')` → green on Deno.
- `node tools/node-bundle/run-unit-on-node.mjs --known-failures tools/node-bundle/known-failures.json tests/unit/ral/ tests/unit/dotenv-config.test.ts` → `no change`, exit 0.
- `grep -n "Deno" src/deno_ral/env.ts src/deno_ral/tar.ts src/deno_ral/log.ts src/deno_ral/platform.ts` → comments, plus the `globalThis.Deno` read inside `runtime()`.
- `quarto run --dev tools/check-runtime-boundary.ts` → zero.
- `node tools/node-bundle/build.mjs --check-shim` → `0 missing`, no `unused` list.
- Manual: `QUARTO_LOG_LEVEL=DEBUG tools/node-bundle/quarto-node check 2>&1 | head -40` shows the Node version on the runtime row; `package/dist/bin/quarto check` shows the Deno version there (unchanged).
- Manual (Posit Connect bundle path without a server): `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/tar.test.ts` on macOS (descriptor limit 256) passes.

## Review checklist

- [ ] `runtime()` keeps PR 19's order (Deno, Bun, Node) and ignores a `Deno` global carrying `Symbol.for("quarto.deno-shim")`.
- [ ] `os`/`arch` keep Deno's spellings; `consoleColumns()` never touches `process.stdin`; `noColor()` is read once.
- [ ] `env` validates keys in `get`/`set`/`delete` and values in `set`, with `TypeError`; `toObject()` returns a copy; no method uses `this`.
- [ ] `tar.ts` opens one input at a time, imports nothing from `src/core`, keeps `@std/tar`'s `TarStream`.
- [ ] `FileHandler` has the `@std/log` 0.224 surface `src/core/log.ts` uses (`setup`, `log`, `flush`, `destroy`, `formatter`, `handle`), flushes above ERROR and at exit, and does not use `addEventListener`.
- [ ] The shim lost members, none were added; `known-failures.json` lost entries, gained none.

## Risks and rollback

- **`inspect()` output differs between runtimes** (`util.inspect` quotes strings with `'`, `Deno.inspect` with `"`). The only caller is debug logging in `src/publish/confluence/confluence-logger.ts`; no test asserts the format. Accepted.
- **`noColor()` with `NO_COLOR=""`**: no-color.org says an empty value does not disable colour; this body follows it. If Deno 2.9 treats an empty value as set (check `NO_COLOR= deno eval 'console.log(Deno.noColor)'` while executing), match Deno and say so in the PR.
- **Lazy tar inputs change when a missing file is reported**: a file deleted between `stat` and archiving now fails during `pipeTo` instead of before; the error is the same `ENOENT` and aborts the publish as before.
- **Whole-PR rollback:** revert the five commits; no caller changed.

## Decisions needed

None. The shim marker in `runtime()` and the `env` validation are decided above.
