# PR 20b: Hidden `Deno.*` uses: tree-sitter, graphviz, deno-cri, file-read metrics, log file handler, dotenv

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove every runtime `Deno.*` use that the `src` ratchet scope cannot see (hand-patched JavaScript, runtime-loaded resources, a monkey-patch, and std modules that call `Deno.*` internally) by replacing each with the standard package or a small Quarto implementation on `src/deno_ral/`, so the `src-js` scope reaches 0 and the `resources` scope reaches an explicit allow-list.
**Phase:** 1. **Depends on:** PR 09 (`src/deno_ral/fs.ts` read functions, `openSync`, `FsFile`; `errors.ts` `isNotFound`), PR 14 (`src/deno_ral/env.ts`), PR 02 (`src-js` and `resources` scopes; `tests/asserts.ts`). **Unblocks:** PR 25 (hidden-dependency inventory), PR 26 (`--check-shim` over `src/resources/**/*.js`), PR 27b (log file handler on `node:fs`), PR 33.
**Branch:** `rt/20b-hidden-deno-uses`.
**Suggested executor:** Opus. Six independent replacements, two of them (tree-sitter, graphviz) inside emscripten glue where a wrong module option fails only at runtime; each needs a careful look at what the vendored file did.
**Size:** M. 1 file deleted, 1 binary added, 2 source files created, 11 modified, 6 test files created; about 20 files.
**Ships on:** Deno; the existing test suite must stay green.

## Spec

### Context

`REVIEW-2026-10-15.md` S1 lists `Deno.*` uses outside the `.ts` files the first ratchet counted, with no owning plan, while PR 33 drops the Node shim on the claim that the boundary is clean. This PR owns the ones that run inside the CLI (the Julia subtree is decision 7's; `quarto run` fixtures under `src/resources/scripts/` and `src/resources/create/` are PR 35's and PR 36's). Verified on `main` at `b86f98d`:

| Use | Where | When it runs | Replacement in this PR |
|---|---|---|---|
| `tree-sitter-deno.js`: hand-edited emscripten build (`ENVIRONMENT_IS_DENO`, `Deno.realPathSync`/`readFileSync`/`readTextFileSync` at 105–109, `Deno.exit` at 125, `Deno.readFileSync` at 4161) | `src/core/lib/external/tree-sitter-deno.js`, imported only by `src/core/schema/deno-init-tree-sitter.ts:12-16` | every render (`render-shared.ts:44-45` → `initState` → `initYamlIntelligenceResourcesFromFilesystem` → `initTreeSitter`), `quarto-bld prepare-dist`, `dev-call build-artifacts` | npm `web-tree-sitter@0.20.2` (Task 1) |
| `Deno.env.get("QUARTO_SHARE_PATH")` (31), `Deno.readFileSync` (35, and 41 in a comment) | `src/resources/js/graphviz-wasm.js`, loaded with a runtime `import()` of a file URL by `src/core/handlers/dot.ts:61-63` | every `{dot}` cell | bytes injected by `dot.ts` (Task 2) |
| `Deno.inspect(this, options)` (109) | `src/core/cri/deno-cri/chrome.js` | never: the method is named `inspect`, the pre-Node-11 custom-inspect hook that neither Deno nor current Node calls | delete the method (Task 3) |
| `Deno.resolveDns` (15) | `src/core/cri/deno-cri/external-request.js` | never: inside a commented-out block | delete the comment block (Task 3) |
| `Deno.readTextFileSync = function ...` monkey-patch | `src/core/performance/metrics.ts:18-32` | `QUARTO_REPORT_PERFORMANCE_METRICS=fileReads` (`src/core/main.ts:39-42`) | `onFileRead` hook in `src/deno_ral/fs.ts` (Task 4) |
| `@std/log` 0.224 `FileHandler.setup()` → `Deno.openSync` (`file_handler.ts:60`) | `src/core/log.ts:13,221-276` (`LogFileHandler extends FileHandler`) | `--log <file>` | own `FileHandler` in `src/deno_ral/log.ts` (Task 5) |
| `@std/dotenv` 0.225.3 `load()` → `Deno.readTextFile`, `Deno.errors.NotFound` (`mod.ts:233-246`); its `parse()` → `Deno.env.get` for `${VAR}` expansion (`parse.ts:48`) | `src/quarto-core/dotenv.ts:7,23-29,60,87`, `src/core/quarto.ts:10,60-76` | every project render (`_environment*` files), `quartoConfig.dotenv()` | own `loadDotenv`/`parseDotenv` in `src/quarto-core/dotenv.ts` (Task 6) |
| `readLines(Deno.stdin)` + `Deno.stdin.close()` | `src/command/create/cmd.ts:259-260` | `quarto create --json` | already `readStdinLines()` by PR 08 (Task 5 step 4 of `08-ral-process.md`); Task 7 verifies |

Std modules that are imported directly but have no runtime `Deno.*` (`fmt/colors` reads a guarded `globalThis.Deno?.noColor`; `io/*` only mention `Deno` in JSDoc; `datetime`, `crypto`, `async`, `streams`, `encoding`, `log` other than `FileHandler`, `dotenv/stringify`) stay behind the import map, which is their seam (PR 22). `fmt/printf` calls `Deno.inspect` only for `%i`/`%I` and in its bad-argument error text; Quarto's one use is `sprintf("%<n>d: ", …)` (`src/core/text.ts:79`), so it is listed in the PR 25 inventory, not replaced.

Version choice for tree-sitter: the vendored glue and `src/resources/editor/tools/yaml/tree-sitter.js` (the browser copy) match `web-tree-sitter` 0.20.2's export set exactly (0.20.3 adds `_realloc`, 0.19.x lacks a libc++ export the grammar uses; compared against the npm tarballs). `src/resources/editor/tools/yaml/tree-sitter-yaml.wasm` is a 2022 build (legacy `dylink` section, C++ external scanner importing `_ZNKSt3__220__vector_base_commonILb1EE20__throw_length_errorEv`); `web-tree-sitter` 0.20.7 and later no longer export that symbol, and 0.22+ changed the grammar ABI and module format. 0.20.2 is therefore the version that loads the shipped grammar with no rebuild; checked on Node 22: `Parser.init({ wasmBinary })` with 0.20.2's own `tree-sitter.wasm`, then `Language.load(bytes)` of the shipped grammar, parses `title: hello\nformat:\n  html:\n    toc: true\n` to `(stream (document (block_node (block_mapping ...`. The npm glue must be paired with its own `tree-sitter.wasm` (the shipped 394 KB `tree-sitter.wasm` is a different emscripten build: imports and exports differ; it stays, for the browser bundles).

The npm glue is a UMD/CommonJS script. When `process.versions.node` exists (Node, and Deno 2, which exposes `process` globally) its init evaluates `__dirname` and lazily `require("fs")`/`require("path")`. Running from source on Deno, Deno's CommonJS loader provides both. In an ESM bundle neither exists, so the bundle needs a banner defining `require`, `__filename` and `__dirname` (Task 1 adds it to `tools/deno-esbuild-bundle.ts`; PR 26's `tools/node-bundle/build.mjs` banner already defines `require` and must add `__filename`/`__dirname`, recorded under Decisions).

### Scope

In: the seven rows above; deleting `tree-sitter-deno.js`; the bundle banner; tests for each replacement; ratchet baselines for `src`, `src-js`, `resources`; `.claude/rules/typescript/deno-ral.md` rows.
Out: the browser/IDE tree-sitter path (`src/resources/editor/tools/yaml/tree-sitter.js` + `tree-sitter.wasm`, concatenated into `web-worker.js` and `vs-code.mjs` by `dev-call build-artifacts`, `src/command/dev-call/build-artifacts/cmd.ts:116-131`; `src/core/lib/yaml-intelligence/parsing.ts:38-66` loads the grammar from `tree-sitter-yaml.json` bytes in the browser): untouched, and must stay byte-identical. `src/resources/scripts/*.ts`, `src/resources/create/**` (PR 35/36). The Julia subtree (decision 7). `fmt/printf` (see Context). `src/resources/editor/tools/{vs-code.mjs,yaml/web-worker.js}`'s `Deno.build.os` (PR 19 rewrites `src/core/lib/errors.ts` and regenerates them).

### Interfaces

`src/deno_ral/fs.ts` (addition; vocabulary):

```ts
/** Registers `listener`, called with the path (string, or URL.href) before
 * every readTextFileSync / readTextFile / readFileSync / readFile through
 * this module. Returns a function that unregisters it. Listeners must not
 * throw; nothing else in the layer observes reads. */
export function onFileRead(listener: (path: string) => void): () => void;
```

`src/deno_ral/log.ts` (additions; vocabulary):

```ts
export { BaseHandler } from "log/base-handler";
export type { BaseHandlerOptions } from "log/base-handler";
export type LogMode = "a" | "w" | "x";
export interface FileHandlerOptions extends BaseHandlerOptions { filename: string; mode?: LogMode; }
/** Same contract as @std/log 0.224's FileHandler (4096-byte buffer, flush on
 * level > ERROR, modes a/w/x) with file access through ./fs.ts. No "unload"
 * listener: Quarto destroys handlers in cleanupLogger(). */
export class FileHandler extends BaseHandler {
  constructor(levelName: LevelName, options: FileHandlerOptions);
  setup(): void;
  handle(logRecord: LogRecord): void;
  log(msg: string): void;
  flush(): void;
  destroy(): void;
}
```

`src/quarto-core/dotenv.ts` (additions):

```ts
/** Parses dotenv text exactly like @std/dotenv 0.225.3's parse(): KEY=value,
 * `export KEY=`, single quotes (literal), double quotes (\n \r \t escapes),
 * `#` comments, and ${VAR} / ${VAR:-default} / $VAR expansion of unquoted
 * values from the file itself, then the process environment. */
export function parseDotenv(text: string): Record<string, string>;
/** Reads and parses a dotenv file; resolves {} when `envPath` is null or the
 * file does not exist. Never writes to the process environment. */
export function loadDotenv(envPath: string | null): Promise<Record<string, string>>;
```

`src/resources/js/graphviz-wasm.js` (changed exports): `wasmPath()` and `graphvizWasm()` removed; added `setGraphvizWasmBinary(bytes: Uint8Array): void`; `graphvizWasmModule()` throws `Error("graphviz-wasm: setGraphvizWasmBinary() must be called before layout()")` when no bytes were set.

`src/core/schema/deno-init-tree-sitter.ts`: `initTreeSitter(): Promise<void>` unchanged; new exports `kWebTreeSitterWasm = "editor/tools/yaml/web-tree-sitter.wasm"` and `kTreeSitterYamlWasm = "editor/tools/yaml/tree-sitter-yaml.wasm"` (resource paths, for the test).

### Files

- Delete: `src/core/lib/external/tree-sitter-deno.js`.
- Create: `src/resources/editor/tools/yaml/web-tree-sitter.wasm` (174,332 bytes, `package/tree-sitter.wasm` from the `web-tree-sitter-0.20.2.tgz` npm tarball, sha256 `7317c29818bdc35ea8496a725d67ba2226102a26e05d96823f74967a890cc8f1`).
- Modify: `src/import_map.json` (+ `src/dev_import_map.json` through its generator), `deno.lock`; `src/core/schema/deno-init-tree-sitter.ts` (whole file); `tools/deno-esbuild-bundle.ts:12-38` (banner); `package/src/common/import-report/explain-import-chain.ts:172-174` (help example names the deleted file).
- Modify: `src/resources/js/graphviz-wasm.js:30-43`; `src/core/handlers/dot.ts:7-10,56-63`.
- Modify: `src/core/cri/deno-cri/chrome.js:106-110`; `src/core/cri/deno-cri/external-request.js:10-18`.
- Modify: `src/deno_ral/fs.ts` (hook + four read functions); `src/core/performance/metrics.ts:11-38`.
- Modify: `src/deno_ral/log.ts`; `src/core/log.ts:11-13`.
- Modify: `src/quarto-core/dotenv.ts:7,21-30,60,87-89`; `src/core/quarto.ts:10,60-76`.
- Test: `tests/unit/core/tree-sitter-init.test.ts`, `tests/unit/core/graphviz-wasm.test.ts`, `tests/unit/ral/fs-on-file-read.test.ts`, `tests/unit/core/performance-metrics.test.ts`, `tests/unit/ral/log-file-handler.test.ts`, `tests/unit/dotenv-parse.test.ts`.
- Modify: `tools/runtime-boundary-baseline.json`, `.claude/rules/typescript/deno-ral.md`.

### Acceptance criteria

- `grep -rn 'Deno\.' src --include=*.js --include=*.mjs | grep -v '^src/vendor/' | grep -v '^src/resources/'` prints nothing (`src-js` = 0).
- `grep -rln 'Deno\.' src/resources --include=*.js --include=*.mjs --include=*.ts | grep -v extension-subtrees | grep -v '^src/resources/types/' | sort` prints exactly the allow-list `src/resources/create/extensions/engine/src/qstart-filesafename-qend.ejs.ts`, `src/resources/scripts/check-usage.ts`, `src/resources/scripts/juice.ts`, `src/resources/tools/ast-diagram/main.ts` (plus `src/resources/editor/tools/vs-code.mjs` and `yaml/web-worker.js` only if PR 19 has not landed). `resources` baseline = 5 (`check-usage.ts` 2, `juice.ts` 2, the engine template 1).
- `grep -rn 'tree-sitter-deno\|from "dotenv"\|log/file-handler\|Deno\.readTextFileSync =' src package/src --include=*.ts` prints nothing.
- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/core/tree-sitter-init.test.ts unit/core/graphviz-wasm.test.ts unit/ral/fs-on-file-read.test.ts unit/core/performance-metrics.test.ts unit/ral/log-file-handler.test.ts unit/dotenv-parse.test.ts unit/dotenv-config.test.ts $(find unit/yaml-intelligence/ -name '*.test.ts')` passes.
- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/logging/log-level-and-formats.test.ts smoke/render/render-html.test.ts` and `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent docs/smoke-all/2023/02/13/dot-bug.qmd docs/smoke-all/2023/07/10/6153.qmd` pass.
- After `quarto dev-call build-artifacts`, `git status --short src/resources/editor` is empty (browser bundles unchanged).
- The bundled CLI renders: the Task 1 step 7 bundle check prints the rendered file.

## Plan

### Task 1: tree-sitter from npm `web-tree-sitter@0.20.2`

**Files:**
- Create: `tests/unit/core/tree-sitter-init.test.ts`, `src/resources/editor/tools/yaml/web-tree-sitter.wasm`
- Modify: `src/import_map.json`, `deno.lock`, `src/core/schema/deno-init-tree-sitter.ts`, `tools/deno-esbuild-bundle.ts`, `package/src/common/import-report/explain-import-chain.ts`
- Delete: `src/core/lib/external/tree-sitter-deno.js`

- [ ] **Step 1: Write the failing test**

```ts
/*
 * tree-sitter-init.test.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 *
 * The CLI loads tree-sitter from npm web-tree-sitter 0.20.2 with its own
 * wasm shipped as a resource, and the YAML grammar from bytes.
 */

import { assert, assertEquals } from "../../asserts.ts";
import { unitTest } from "../../test.ts";
import { readFileSync } from "../../../src/deno_ral/fs.ts";
import { resourcePath } from "../../../src/core/resources.ts";
import {
  initTreeSitter,
  kWebTreeSitterWasm,
} from "../../../src/core/schema/deno-init-tree-sitter.ts";
import { getTreeSitterSync } from "../../../src/core/lib/yaml-intelligence/parsing.ts";

// sha256 of package/tree-sitter.wasm in web-tree-sitter-0.20.2.tgz.
const kWasmSha256 =
  "7317c29818bdc35ea8496a725d67ba2226102a26e05d96823f74967a890cc8f1";

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

unitTest("tree-sitter - shipped wasm is web-tree-sitter 0.20.2's", async () => {
  const bytes = readFileSync(resourcePath(kWebTreeSitterWasm));
  assertEquals(await sha256Hex(bytes), kWasmSha256);
});

unitTest("tree-sitter - initTreeSitter parses YAML through the npm glue", async () => {
  await initTreeSitter();
  await initTreeSitter(); // idempotent
  const parser = getTreeSitterSync();
  const ok = parser.parse("title: hello\nformat:\n  html:\n    toc: true\n");
  const tree = ok.rootNode.toString();
  assert(tree.startsWith("(stream (document (block_node (block_mapping"), tree);
  assert(!tree.includes("ERROR"), tree);
  const broken = parser.parse("a: [1, 2\nb: c\n").rootNode.toString();
  assert(broken.includes("ERROR") || broken.includes("MISSING"), broken);
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/core/tree-sitter-init.test.ts`
Expected: type-check error `Module '"../../../src/core/schema/deno-init-tree-sitter.ts"' has no exported member 'kWebTreeSitterWasm'`.

- [ ] **Step 3: Add the dependency and the wasm resource**

In `src/import_map.json`, add to `imports` (alphabetical position):

```json
    "web-tree-sitter": "npm:web-tree-sitter@0.20.2",
```

Update the lockfile with PR 00b's script (adds the new specifier, keeps every other pin), then regenerate the dev import map:

```bash
package/scripts/vendoring/update-lock.sh
package/src/quarto-bld configure
git diff --stat deno.lock src/dev_import_map.json
```

Expected: `deno.lock` gains `npm:web-tree-sitter@0.20.2`; `src/dev_import_map.json` gains the same key (if `configure` does not regenerate it, apply the same line by hand: it mirrors `src/import_map.json`).

Copy the wasm from the npm tarball (outside the repo):

```bash
d=$(mktemp -d) && (cd "$d" && npm pack web-tree-sitter@0.20.2 >/dev/null && tar xzf web-tree-sitter-0.20.2.tgz package/tree-sitter.wasm)
cp "$d/package/tree-sitter.wasm" src/resources/editor/tools/yaml/web-tree-sitter.wasm
sha256sum src/resources/editor/tools/yaml/web-tree-sitter.wasm
rm -rf "$d"
```

Expected: `7317c29818bdc35ea8496a725d67ba2226102a26e05d96823f74967a890cc8f1  src/resources/editor/tools/yaml/web-tree-sitter.wasm`.

- [ ] **Step 4: Rewrite `src/core/schema/deno-init-tree-sitter.ts`**

```ts
/*
 * deno-init-tree-sitter.ts
 *
 * Initializes tree-sitter for the CLI (the browser bundles load their own
 * copy, see src/core/lib/yaml-intelligence/parsing.ts).
 *
 * Copyright (C) 2022 Posit Software, PBC
 */

import Parser from "web-tree-sitter";
import { readFileSync } from "../../deno_ral/fs.ts";
import { resourcePath } from "../resources.ts";
import { setMainPath } from "../lib/yaml-intelligence/paths.ts";
import { setTreeSitter } from "../lib/yaml-intelligence/parsing.ts";

// web-tree-sitter's glue must run with the wasm from the same npm release
// (0.20.2, the newest that loads the shipped grammar: see
// dev-docs/runtime-migration/20b-hidden-deno-uses.md). Both files are read
// here and handed over as bytes, so the glue never touches the file system.
export const kWebTreeSitterWasm = "editor/tools/yaml/web-tree-sitter.wasm";
export const kTreeSitterYamlWasm = "editor/tools/yaml/tree-sitter-yaml.wasm";

export async function initTreeSitter() {
  // Parser.init returns the same promise on later calls.
  await Parser.init({
    wasmBinary: readFileSync(resourcePath(kWebTreeSitterWasm)),
  });
  const parser = new Parser();
  const language = await Parser.Language.load(
    readFileSync(resourcePath(kTreeSitterYamlWasm)),
  );
  parser.setLanguage(language);

  setMainPath("https://example.com");

  setTreeSitter(parser);
}
```

Then delete the vendored glue and fix the help example that named it:

```bash
git rm src/core/lib/external/tree-sitter-deno.js
sed -i 's#src/core/lib/external/tree-sitter-deno.js#src/core/lib/external/regexpp.mjs#g' package/src/common/import-report/explain-import-chain.ts
grep -rn 'tree-sitter-deno' src package tools tests --include=* -I
```

Expected: the final grep prints nothing.

- [ ] **Step 5: Bundle banner in `tools/deno-esbuild-bundle.ts`**

Add to the `esbuild.build({ ... })` options, after `format: "esm",`:

```ts
  // CommonJS dependencies bundled into this ES module (web-tree-sitter's
  // emscripten glue) reference require and __dirname when `process` exists,
  // which it does on Deno 2. Define them at the top of the bundle.
  banner: {
    js: [
      'import { createRequire as __quartoCreateRequire } from "node:module";',
      'import { fileURLToPath as __quartoFileURLToPath } from "node:url";',
      'import { dirname as __quartoDirname } from "node:path";',
      "const require = __quartoCreateRequire(import.meta.url);",
      "const __filename = __quartoFileURLToPath(import.meta.url);",
      "const __dirname = __quartoDirname(__filename);",
    ].join("\n"),
  },
```

- [ ] **Step 6: Run the tests**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/core/tree-sitter-init.test.ts $(find unit/yaml-intelligence/ -name '*.test.ts')`
Expected: `ok | N passed | 0 failed` (`yaml-intelligence.test.ts` and `annotated-yaml.test.ts` drive the parser through `initYamlIntelligenceResourcesFromFilesystem`).

Run: `package/dist/bin/quarto render tests/docs/minimal.qmd --to html && package/dist/bin/quarto dev-call build-artifacts && git status --short src/resources/editor`
Expected: the render succeeds; `build-artifacts` completes (it calls `initTreeSitter`, `cmd.ts:170`); the status prints nothing (browser bundles unchanged).

- [ ] **Step 7: Prove the bundled CLI loads it**

Same sequence as `.github/workflows/test-bundle.yml:36-43`:

```bash
cd package/src && ./quarto-bld prepare-dist --set-version 99.9.9 && cd ../..
mv src/quarto.ts src/quarto1.ts
package/pkg-working/bin/quarto render tests/docs/minimal.qmd --to html --output-dir "$(mktemp -d)" ; status=$?
mv src/quarto1.ts src/quarto.ts
echo "bundle render exit: $status"
```

Expected: `Output created: ...minimal.html` and `bundle render exit: 0`. A `ReferenceError: __dirname is not defined` means the Step 5 banner is missing. The PR 00b bundle gate re-checks this on three OSes.

- [ ] **Step 8: Commit**

```bash
git add src/import_map.json src/dev_import_map.json deno.lock src/resources/editor/tools/yaml/web-tree-sitter.wasm src/core/schema/deno-init-tree-sitter.ts tools/deno-esbuild-bundle.ts package/src/common/import-report/explain-import-chain.ts tests/unit/core/tree-sitter-init.test.ts
git commit -m "tree-sitter: load npm web-tree-sitter 0.20.2 with bytes; drop the hand-patched tree-sitter-deno.js"
```

### Task 2: graphviz wasm bytes injected by the caller

**Files:**
- Create: `tests/unit/core/graphviz-wasm.test.ts`
- Modify: `src/resources/js/graphviz-wasm.js:30-43`, `src/core/handlers/dot.ts`

- [ ] **Step 1: Write the failing test**

```ts
/*
 * graphviz-wasm.test.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 *
 * src/resources/js/graphviz-wasm.js does no file or environment access:
 * the caller hands it the wasm bytes.
 */

import { assert, assertThrows } from "../../asserts.ts";
import { unitTest } from "../../test.ts";
import { join, toFileUrl } from "../../../src/deno_ral/path.ts";
import { readFileSync } from "../../../src/deno_ral/fs.ts";
import { resourcePath } from "../../../src/core/resources.ts";

// deno-lint-ignore no-explicit-any
const graphvizModule: any = await import(
  toFileUrl(resourcePath(join("js", "graphviz-wasm.js"))).href
);

unitTest("graphviz-wasm - refuses to instantiate before bytes are set", async () => {
  assertThrows(() => graphvizModule.graphvizWasmModule(), Error, "setGraphvizWasmBinary");
  await Promise.resolve();
});

unitTest("graphviz-wasm - lays out a graph from injected bytes", async () => {
  graphvizModule.setGraphvizWasmBinary(
    readFileSync(resourcePath(join("wasm", "graphvizlib.wasm"))),
  );
  const svg: string = await graphvizModule.graphviz().layout(
    "digraph { a -> b }",
    "svg",
    "dot",
  );
  assert(svg.includes("<svg"), svg.slice(0, 200));
  assert(svg.includes(">a<") && svg.includes(">b<"), svg.slice(0, 400));
});
```

(The two tests run in file order; the first must not trigger the emscripten instantiation, which is why it calls `graphvizWasmModule()` directly rather than `layout()`.)

- [ ] **Step 2: Run it and see it fail**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/core/graphviz-wasm.test.ts`
Expected: the first test fails (`graphvizWasmModule` reads `QUARTO_SHARE_PATH` and succeeds instead of throwing), the second with `graphvizModule.setGraphvizWasmBinary is not a function`.

- [ ] **Step 3: `src/resources/js/graphviz-wasm.js` lines 30–43**

Replace `wasmPath()`, `graphvizWasmModule()` and `graphvizWasm()` (and the commented body inside `graphvizWasm`) with:

```js
let wasmBinary;

// The CLI passes the bytes of graphvizlib.wasm before the first layout
// (src/core/handlers/dot.ts); this module does no file or environment access.
export function setGraphvizWasmBinary(bytes) {
  wasmBinary = bytes;
}

export function graphvizWasmModule() {
  if (wasmBinary === undefined) {
    throw new Error(
      "graphviz-wasm: setGraphvizWasmBinary() must be called before layout()",
    );
  }
  return new WebAssembly.Module(wasmBinary);
}
```

Leave the comment `// C = graphvizWasm();` at line ~3202 as it is (a comment in the emscripten code, no `Deno.`). Run `grep -n 'Deno\.' src/resources/js/graphviz-wasm.js` → nothing.

- [ ] **Step 4: `src/core/handlers/dot.ts`**

Add `import { readFileSync } from "../../deno_ral/fs.ts";` next to the `path.ts` import, add above `const dotHandler`:

```ts
// graphviz-wasm.js is a runtime-loaded resource; load it once per process
// and give it the wasm bytes (it does no file access itself).
// deno-lint-ignore no-explicit-any
let graphvizModule: Promise<any> | undefined;
// deno-lint-ignore no-explicit-any
function loadGraphviz(): Promise<any> {
  graphvizModule ??= (async () => {
    const module = await import(
      toFileUrl(resourcePath(join("js", "graphviz-wasm.js"))).href
    );
    module.setGraphvizWasmBinary(
      readFileSync(resourcePath(join("wasm", "graphvizlib.wasm"))),
    );
    return module;
  })();
  return graphvizModule;
}
```

and replace lines 61–63 (`const graphvizModule = await import(...);`) with:

```ts
    const graphviz = await loadGraphviz();
```

renaming the two uses of `graphvizModule.graphviz()` in `cell()` to `graphviz.graphviz()`.

- [ ] **Step 5: Run the tests and a dot render**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/core/graphviz-wasm.test.ts`
Expected: `ok | 2 passed | 0 failed`.
Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent docs/smoke-all/2023/02/13/dot-bug.qmd docs/smoke-all/2023/07/10/6153.qmd`
Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add src/resources/js/graphviz-wasm.js src/core/handlers/dot.ts tests/unit/core/graphviz-wasm.test.ts
git commit -m "graphviz-wasm: caller injects the wasm bytes; no Deno.env/readFileSync in the resource"
```

### Task 3: deno-cri dead `Deno.` references

**Files:**
- Modify: `src/core/cri/deno-cri/chrome.js:106-110`, `src/core/cri/deno-cri/external-request.js:10-18`

- [ ] **Step 1: Delete the dead code**

In `chrome.js` delete the method and its comment:

```js
  // avoid misinterpreting protocol's members as custom util.inspect functions
  inspect(_depth, options) {
    options.customInspect = false;
    return Deno.inspect(this, options);
  }
```

(A method named `inspect` was Node's custom-inspect hook before Node 11 (DEP0079); neither Deno's console nor current Node calls it, so nothing changes.)

In `external-request.js` replace lines 10–18 (the comment explaining the DNS lookup and the commented-out `Deno.resolveDns` block) with:

```js
  // chrome-remote-interface resolved the host to an IP so the Host header
  // carried an address (Chrome 66+ rejects other host names). Quarto always
  // connects to 127.0.0.1, so no lookup is needed.
```

- [ ] **Step 2: Verify**

Run: `grep -n 'Deno\.' src/core/cri/deno-cri/*.js` → nothing.
Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/chrome-launch.test.ts unit/chrome-launch-flags.test.ts smoke/axe/axe-transport-failclosed.test.ts` → pass (these drive `deno-cri` through `withCriClient`/`launchChrome`; Chrome-dependent cases skip with a warning when Chrome is absent).

- [ ] **Step 3: Commit**

```bash
git add src/core/cri/deno-cri/chrome.js src/core/cri/deno-cri/external-request.js
git commit -m "deno-cri: drop the dead Deno.inspect hook and commented Deno.resolveDns"
```

### Task 4: `onFileRead` in `deno_ral/fs.ts`; `metrics.ts` on it

**Files:**
- Create: `tests/unit/ral/fs-on-file-read.test.ts`, `tests/unit/core/performance-metrics.test.ts`
- Modify: `src/deno_ral/fs.ts`, `src/core/performance/metrics.ts`

Assumes PR 09 defines `readTextFileSync`, `readTextFile`, `readFileSync` and `readFile` as functions in `src/deno_ral/fs.ts` (`grep -n 'export function readTextFileSync\|export async function readTextFile\|export function readFileSync\|export async function readFile' src/deno_ral/fs.ts` prints four lines). If PR 09 made them re-exports (`export const readFileSync = Deno.readFileSync`), turn each into a function with the same signature first.

- [ ] **Step 1: Write the failing tests**

`tests/unit/ral/fs-on-file-read.test.ts`:

```ts
/*
 * fs-on-file-read.test.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 *
 * Contract for onFileRead (PR 27 keeps it on node:fs).
 */

import { assertEquals } from "../../asserts.ts";
import { unitTest } from "../../test.ts";
import {
  onFileRead,
  readFile,
  readFileSync,
  readTextFile,
  readTextFileSync,
  removeSync,
  writeTextFileSync,
} from "../../../src/deno_ral/fs.ts";
import { makeTempDirSync } from "../../../src/deno_ral/temp.ts";
import { join } from "../../../src/deno_ral/path.ts";

unitTest("fs - onFileRead sees the four read functions until unregistered", async () => {
  const dir = makeTempDirSync({ prefix: "quarto-on-file-read" });
  const file = join(dir, "a.txt");
  writeTextFileSync(file, "x");
  const seen: string[] = [];
  const off = onFileRead((path) => seen.push(path));
  try {
    readTextFileSync(file);
    await readTextFile(file);
    readFileSync(file);
    await readFile(file);
    assertEquals(seen, [file, file, file, file]);
  } finally {
    off();
  }
  readTextFileSync(file);
  assertEquals(seen.length, 4);
  removeSync(dir, { recursive: true });
});
```

`tests/unit/core/performance-metrics.test.ts`:

```ts
/*
 * performance-metrics.test.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { assert } from "../../asserts.ts";
import { unitTest } from "../../test.ts";
import {
  captureFileReads,
  quartoPerformanceMetrics,
} from "../../../src/core/performance/metrics.ts";
import {
  readTextFileSync,
  removeSync,
  writeTextFileSync,
} from "../../../src/deno_ral/fs.ts";
import { makeTempDirSync } from "../../../src/deno_ral/temp.ts";
import { join } from "../../../src/deno_ral/path.ts";

unitTest("metrics - fileReads records reads with the caller's stack", async () => {
  const dir = makeTempDirSync({ prefix: "quarto-metrics" });
  const file = join(dir, "read-me.txt");
  writeTextFileSync(file, "x");
  captureFileReads();
  readTextFileSync(file);
  const metrics = quartoPerformanceMetrics(["fileReads"]) as {
    fileReads?: { path: string; stack: string[] }[];
  };
  const record = metrics.fileReads?.find((r) => r.path === file);
  assert(record, `no record for ${file} in ${JSON.stringify(metrics)}`);
  assert(
    record.stack[0]?.includes("performance-metrics.test.ts"),
    `first frame should be the caller: ${record.stack[0]}`,
  );
  removeSync(dir, { recursive: true });
  await Promise.resolve();
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/fs-on-file-read.test.ts unit/core/performance-metrics.test.ts`
Expected: type-check error `Module '"../../../src/deno_ral/fs.ts"' has no exported member 'onFileRead'`. (The metrics test would also fail today: `metricsObject.fileReads` is captured as `undefined` when the module loads, so the report never contains reads; this PR fixes that with a getter.)

- [ ] **Step 3: `src/deno_ral/fs.ts`**

Add near the top of the file (after the imports):

```ts
type FileReadListener = (path: string) => void;
const fileReadListeners = new Set<FileReadListener>();

export function onFileRead(listener: FileReadListener): () => void {
  fileReadListeners.add(listener);
  return () => {
    fileReadListeners.delete(listener);
  };
}

function notifyFileRead(path: string | URL): void {
  if (fileReadListeners.size === 0) {
    return;
  }
  const p = typeof path === "string" ? path : path.href;
  for (const listener of fileReadListeners) {
    listener(p);
  }
}
```

and make `notifyFileRead(path);` the first statement of `readTextFileSync`, `readTextFile`, `readFileSync` and `readFile`. For example, if PR 09 wrote

```ts
export function readTextFileSync(path: string | URL): string {
  return Deno.readTextFileSync(path);
}
```

it becomes

```ts
export function readTextFileSync(path: string | URL): string {
  notifyFileRead(path);
  return Deno.readTextFileSync(path);
}
```

Keep whatever error wrapping PR 09 added after that line.

- [ ] **Step 4: `src/core/performance/metrics.ts` lines 11–38**

```ts
import { onFileRead } from "../../deno_ral/fs.ts";

type FileReadRecord = {
  path: string;
  stack: string[];
};

let fileReads: FileReadRecord[] | undefined = undefined;

export function captureFileReads() {
  if (fileReads) {
    return;
  }
  fileReads = [];
  onFileRead((path) => {
    // Frames: Error, this listener, notifyFileRead, the read function, caller.
    const stack = (new Error("File read").stack ?? "").split("\n").slice(4);
    fileReads!.push({ path, stack });
  });
}

const metricsObject = {
  inputTargetIndexCache: inputTargetIndexCacheMetrics,
  // A getter: captureFileReads() runs after this module is loaded.
  get fileReads() {
    return fileReads;
  },
  functionTimes,
};
```

(Previously only `Deno.readTextFileSync` was observed, through a monkey-patch, and the report always printed `fileReads: undefined`; now the four layer read functions are observed and reported. Reads that bypass the layer are invisible, which after PRs 10–13 means none in `src/`.)

- [ ] **Step 5: Run the tests and the real metric**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/fs-on-file-read.test.ts unit/core/performance-metrics.test.ts`
Expected: `ok | 2 passed | 0 failed`.
Run: `QUARTO_REPORT_PERFORMANCE_METRICS=fileReads package/dist/bin/quarto render tests/docs/minimal.qmd --to html 2>/dev/null | grep -c '"path"'`
Expected: a number greater than 0 (today it prints 0).

- [ ] **Step 6: Commit**

```bash
git add src/deno_ral/fs.ts src/core/performance/metrics.ts tests/unit/ral/fs-on-file-read.test.ts tests/unit/core/performance-metrics.test.ts
git commit -m "deno_ral/fs: onFileRead hook; file-read metrics on it instead of patching Deno.readTextFileSync"
```

### Task 5: `FileHandler` in `deno_ral/log.ts`

**Files:**
- Create: `tests/unit/ral/log-file-handler.test.ts`
- Modify: `src/deno_ral/log.ts`, `src/deno_ral/fs.ts:12` (cycle), `src/core/log.ts:11-13`

- [ ] **Step 1: Write the failing test**

```ts
/*
 * log-file-handler.test.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 *
 * Contract for deno_ral/log.ts FileHandler (PR 27b keeps it on node:fs).
 */

import { assertEquals, assertThrows } from "../../asserts.ts";
import { unitTest } from "../../test.ts";
import { FileHandler, LogLevels } from "../../../src/deno_ral/log.ts";
import {
  readTextFileSync,
  removeSync,
  writeTextFileSync,
} from "../../../src/deno_ral/fs.ts";
import { makeTempDirSync } from "../../../src/deno_ral/temp.ts";
import { join } from "../../../src/deno_ral/path.ts";

function record(level: number, msg: string) {
  return {
    msg,
    args: [],
    datetime: new Date(),
    level,
    levelName: level >= LogLevels.ERROR ? "ERROR" : "INFO",
    loggerName: "default",
  // deno-lint-ignore no-explicit-any
  } as any;
}

function withDir(fn: (dir: string) => void) {
  const dir = makeTempDirSync({ prefix: "quarto-log-file-handler" });
  try {
    fn(dir);
  } finally {
    removeSync(dir, { recursive: true });
  }
}

unitTest("log FileHandler - mode w truncates, buffers, and flushes on destroy", async () => {
  withDir((dir) => {
    const file = join(dir, "log.txt");
    writeTextFileSync(file, "old\n");
    const handler = new FileHandler("INFO", {
      filename: file,
      mode: "w",
      formatter: ({ msg }) => msg,
    });
    handler.setup();
    handler.handle(record(LogLevels.INFO, "one"));
    assertEquals(readTextFileSync(file), ""); // buffered
    handler.destroy();
    assertEquals(readTextFileSync(file), "one\n");
  });
  await Promise.resolve();
});

unitTest("log FileHandler - mode a appends; above ERROR flushes at once; big messages bypass the buffer", async () => {
  withDir((dir) => {
    const file = join(dir, "log.txt");
    writeTextFileSync(file, "old\n");
    const handler = new FileHandler("INFO", {
      filename: file,
      mode: "a",
      formatter: ({ msg }) => msg,
    });
    handler.setup();
    handler.handle(record(LogLevels.CRITICAL, "fatal"));
    assertEquals(readTextFileSync(file), "old\nfatal\n");
    const big = "x".repeat(5000);
    handler.log(big);
    assertEquals(readTextFileSync(file), `old\nfatal\n${big}\n`);
    handler.destroy();
  });
  await Promise.resolve();
});

unitTest("log FileHandler - mode x refuses an existing file", async () => {
  withDir((dir) => {
    const file = join(dir, "log.txt");
    writeTextFileSync(file, "");
    const handler = new FileHandler("INFO", { filename: file, mode: "x" });
    assertThrows(() => handler.setup());
  });
  await Promise.resolve();
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/log-file-handler.test.ts`
Expected: type-check error `Module '"../../../src/deno_ral/log.ts"' has no exported member 'FileHandler'`.

- [ ] **Step 3: `src/deno_ral/log.ts`**

Append to the file (keep the existing re-exports):

```ts
import { BaseHandler } from "log/base-handler";
import type { BaseHandlerOptions } from "log/base-handler";
import { LogLevels } from "log";
import type { LevelName, LogRecord } from "log";
import { existsSync, FsFile, openSync } from "./fs.ts";

export { BaseHandler };
export type { BaseHandlerOptions };

export type LogMode = "a" | "w" | "x";

export interface FileHandlerOptions extends BaseHandlerOptions {
  filename: string;
  mode?: LogMode;
}

const kPageSize = 4096;

// Same behaviour as @std/log 0.224's FileHandler, whose setup() calls
// Deno.openSync; file access goes through ./fs.ts instead. There is no
// "unload" listener (Node has no such global event): Quarto destroys its
// handlers in cleanupLogger() (src/core/log.ts).
export class FileHandler extends BaseHandler {
  protected _file: FsFile | undefined;
  protected _buf: Uint8Array = new Uint8Array(kPageSize);
  protected _pointer = 0;
  protected _filename: string;
  protected _mode: LogMode;
  protected _encoder: TextEncoder = new TextEncoder();

  constructor(levelName: LevelName, options: FileHandlerOptions) {
    super(levelName, options);
    this._filename = options.filename;
    this._mode = options.mode ?? "a";
  }

  override setup() {
    if (this._mode === "x" && existsSync(this._filename)) {
      throw new Error(`Log file already exists: ${this._filename}`);
    }
    this._file = openSync(this._filename, {
      write: true,
      create: true,
      append: this._mode === "a",
      truncate: this._mode !== "a",
    });
    this._pointer = 0;
  }

  override handle(logRecord: LogRecord) {
    super.handle(logRecord);
    if (logRecord.level > LogLevels.ERROR) {
      this.flush();
    }
  }

  override log(msg: string) {
    const bytes = this._encoder.encode(msg + "\n");
    if (bytes.byteLength > this._buf.byteLength - this._pointer) {
      this.flush();
    }
    if (bytes.byteLength > this._buf.byteLength) {
      this.writeAll(bytes);
    } else {
      this._buf.set(bytes, this._pointer);
      this._pointer += bytes.byteLength;
    }
  }

  flush() {
    if (this._pointer > 0 && this._file) {
      this.writeAll(this._buf.subarray(0, this._pointer));
      this._pointer = 0;
    }
  }

  override destroy() {
    this.flush();
    this._file?.close();
    this._file = undefined;
  }

  private writeAll(bytes: Uint8Array) {
    let written = 0;
    while (written < bytes.byteLength) {
      written += this._file!.writeSync(bytes.subarray(written));
    }
  }
}
```

(Move the new `import` lines to the top of the file, after the header; they are shown here together for readability.)

`src/deno_ral/fs.ts` imports `debug` from `./log.ts` (line 12 at `b86f98d`), so `log.ts` importing `./fs.ts` would create a module cycle. Break it at the fs side: change that line to

```ts
import { debug } from "log";
```

(the same function `log.ts` re-exports). Check: `quarto run --dev package/src/common/import-report/explain-all-cycles.ts src/quarto.ts 2>&1 | grep -c 'deno_ral/log.ts'` prints `0`.

- [ ] **Step 4: `src/core/log.ts` lines 11–13**

Replace

```ts
import { LogRecord } from "log/logger";
import { BaseHandler } from "log/base-handler";
import { FileHandler } from "log/file-handler";
```

with

```ts
import type { LogRecord } from "../deno_ral/log.ts";
import { BaseHandler, FileHandler } from "../deno_ral/log.ts";
```

`LogFileHandler` (lines 221–276) compiles unchanged: it uses the constructor, `setup()`, `formatter`, `format`, `flush` and `log`, all present with the same signatures.

- [ ] **Step 5: Run the tests**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/log-file-handler.test.ts smoke/logging/log-level-and-formats.test.ts`
Expected: `ok | N passed | 0 failed` (the smoke test renders with `--log` in plain and JSON formats and reads the files back).

- [ ] **Step 6: Commit**

```bash
git add src/deno_ral/log.ts src/deno_ral/fs.ts src/core/log.ts tests/unit/ral/log-file-handler.test.ts
git commit -m "deno_ral/log: own FileHandler on deno_ral/fs (replaces @std/log FileHandler's Deno.openSync)"
```

### Task 6: dotenv parser in `quarto-core/dotenv.ts`

**Files:**
- Create: `tests/unit/dotenv-parse.test.ts`
- Modify: `src/quarto-core/dotenv.ts`, `src/core/quarto.ts:10,60-76`

- [ ] **Step 1: Write the failing test**

```ts
/*
 * dotenv-parse.test.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 *
 * parseDotenv matches @std/dotenv 0.225.3's parse() on the forms Quarto's
 * _environment files use; loadDotenv reads through deno_ral/fs.
 */

import { assertEquals } from "../asserts.ts";
import { unitTest } from "../test.ts";
import { loadDotenv, parseDotenv } from "../../src/quarto-core/dotenv.ts";
import { removeSync, writeTextFileSync } from "../../src/deno_ral/fs.ts";
import { makeTempDirSync } from "../../src/deno_ral/temp.ts";
import { join } from "../../src/deno_ral/path.ts";

unitTest("dotenv - parse basic, quoted, commented and exported lines", async () => {
  const text = [
    "# a comment",
    "PLAIN=value",
    "SPACED = spaced value  ",
    "EMPTY=",
    "SINGLE='literal $PLAIN \\n'",
    'DOUBLE="line1\\nline2"',
    "export EXPORTED=yes",
    "INLINE=before # trailing comment",
    "1INVALID=ignored",
  ].join("\n");
  assertEquals(parseDotenv(text), {
    PLAIN: "value",
    SPACED: "spaced value",
    EMPTY: "",
    SINGLE: "literal $PLAIN \\n",
    DOUBLE: "line1\nline2",
    EXPORTED: "yes",
    INLINE: "before",
  });
  await Promise.resolve();
});

unitTest("dotenv - unquoted values expand from the file, then defaults", async () => {
  const text = [
    "BASE=/opt/app",
    "BIN=${BASE}/bin",
    "BARE=$BASE/lib",
    "WITH_DEFAULT=${QUARTO_DOTENV_TEST_UNSET_9F3A:-fallback}",
    'QUOTED="${BASE}"',
  ].join("\n");
  assertEquals(parseDotenv(text), {
    BASE: "/opt/app",
    BIN: "/opt/app/bin",
    BARE: "/opt/app/lib",
    WITH_DEFAULT: "fallback",
    QUOTED: "${BASE}",
  });
  await Promise.resolve();
});

unitTest("dotenv - loadDotenv reads a file; missing file or null path is empty", async () => {
  const dir = makeTempDirSync({ prefix: "quarto-dotenv" });
  try {
    const file = join(dir, "_environment");
    writeTextFileSync(file, "A=1\nB='two'\n");
    assertEquals(await loadDotenv(file), { A: "1", B: "two" });
    assertEquals(await loadDotenv(join(dir, "missing")), {});
    assertEquals(await loadDotenv(null), {});
  } finally {
    removeSync(dir, { recursive: true });
  }
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/dotenv-parse.test.ts`
Expected: type-check error `Module '"../../src/quarto-core/dotenv.ts"' has no exported member 'loadDotenv'`.

- [ ] **Step 3: Parser and loader in `src/quarto-core/dotenv.ts`**

Replace line 7 (`import { load as config } from "dotenv";`) with these imports (merge with the file's existing `deno_ral` imports):

```ts
import { readTextFile } from "../deno_ral/fs.ts";
import { env } from "../deno_ral/env.ts";
import { isNotFound } from "../deno_ral/errors.ts";
```

and add, after the constants at lines 16–18:

```ts
// parseDotenv is a port of @std/dotenv 0.225.3 parse.ts
// (Copyright 2018-2024 the Deno authors, MIT license) with the runtime's
// environment lookup replaced by deno_ral's env.get; behaviour, including its regular
// expressions, is unchanged so existing _environment files parse the same.
type LineParseResult = {
  key: string;
  unquoted: string;
  interpolated: string;
  notInterpolated: string;
};

const RE_KEY_VALUE =
  /^\s*(?:export\s+)?(?<key>[^\s=#]+?)\s*=[\ \t]*('\r?\n?(?<notInterpolated>(.|\r\n|\n)*?)\r?\n?'|"\r?\n?(?<interpolated>(.|\r\n|\n)*?)\r?\n?"|(?<unquoted>[^\r\n#]*)) *#*.*$/gm;

const RE_VALID_KEY = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

const RE_EXPAND_VALUE =
  /(\${(?<inBrackets>.+?)(\:-(?<inBracketsDefault>.+))?}|(?<!\\)\$(?<notInBrackets>\w+)(\:-(?<notInBracketsDefault>.+))?)/g;

function expandCharacters(str: string): string {
  const charactersMap: Record<string, string> = {
    "\\n": "\n",
    "\\r": "\r",
    "\\t": "\t",
  };
  return str.replace(/\\([nrt])/g, ($1) => charactersMap[$1] ?? "");
}

function expand(str: string, variablesMap: Record<string, string>): string {
  if (RE_EXPAND_VALUE.test(str)) {
    return expand(
      str.replace(RE_EXPAND_VALUE, function (...params) {
        const {
          inBrackets,
          inBracketsDefault,
          notInBrackets,
          notInBracketsDefault,
        } = params[params.length - 1];
        const expandValue = inBrackets || notInBrackets;
        const defaultValue = inBracketsDefault || notInBracketsDefault;
        let value: string | undefined = variablesMap[expandValue];
        if (value === undefined) {
          value = env.get(expandValue);
        }
        return value === undefined ? expand(defaultValue, variablesMap) : value;
      }),
      variablesMap,
    );
  } else {
    return str;
  }
}

export function parseDotenv(text: string): Record<string, string> {
  const result: Record<string, string> = {};
  let match;
  const keysForExpandCheck = [];
  while ((match = RE_KEY_VALUE.exec(text)) !== null) {
    const { key, interpolated, notInterpolated, unquoted } = match
      ?.groups as LineParseResult;
    if (!RE_VALID_KEY.test(key)) {
      console.warn(
        `Ignored the key "${key}" as it is not a valid identifier: The key need to match the pattern /^[a-zA-Z_][a-zA-Z0-9_]*$/.`,
      );
      continue;
    }
    if (unquoted) {
      keysForExpandCheck.push(key);
    }
    result[key] = typeof notInterpolated === "string"
      ? notInterpolated
      : typeof interpolated === "string"
      ? expandCharacters(interpolated)
      : unquoted.trim();
  }
  const variablesMap = { ...result };
  keysForExpandCheck.forEach((key) => {
    result[key] = expand(result[key]!, variablesMap);
  });
  return result;
}

export async function loadDotenv(
  envPath: string | null,
): Promise<Record<string, string>> {
  if (!envPath) {
    return {};
  }
  try {
    return parseDotenv(await readTextFile(envPath));
  } catch (e) {
    if (isNotFound(e)) {
      return {};
    }
    throw e;
  }
}
```

Then replace the four `config(...)` calls:

- lines 23–28: `const conf1 = await loadDotenv(join(projectDir, kQuartoEnv));` and `const conf2 = await loadDotenv(join(projectDir, kQuartoEnvLocal));`
- line 60: `const conf = await loadDotenv(dotenvFile);`
- lines 87–89: `await loadDotenv(definedEnvTempPath);`

`stringify` keeps coming from `dotenv/stringify` (pure; its seam is the import map).

- [ ] **Step 4: `src/core/quarto.ts`**

Delete line 10 (`import { load as config, LoadOptions as ConfigOptions } from "dotenv";`), change line 15 to `import { loadDotenv, onDotenvChanged } from "../quarto-core/dotenv.ts";`, and replace the body of `dotenv` (lines 60–76) with:

```ts
  dotenv: async (forceReload?: boolean): Promise<Record<string, string>> => {
    if (forceReload || !dotenvConfig) {
      dotenvConfig = await loadDotenv(
        join(quartoConfig.sharePath(), "env", "env.defaults"),
      );
      const otherConfig = await loadDotenv(
        quartoConfig.isDebug()
          ? join(quartoConfig.sharePath(), "..", "..", ".env")
          : null,
      );
      for (const key of Object.keys(otherConfig)) {
        dotenvConfig[key] = otherConfig[key];
      }
    }
    return dotenvConfig;
  },
```

(`core/quarto.ts` already imports `quarto-core/dotenv.ts`, so no new module edge.)

- [ ] **Step 5: Run the tests**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/dotenv-parse.test.ts unit/dotenv-config.test.ts`
Expected: `ok | 4 passed | 0 failed`.
Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent docs/smoke-all/website/llms-txt-shortcode/index.qmd` (a project with an `_environment` file; if `index.qmd` is not the entry, `ls tests/docs/smoke-all/website/llms-txt-shortcode/` and pass the `.qmd` with `_quarto: tests:` front matter)
Expected: pass (`LLMS_TEST_VAR="Resolved"` reaches the render).

- [ ] **Step 6: Commit**

```bash
git add src/quarto-core/dotenv.ts src/core/quarto.ts tests/unit/dotenv-parse.test.ts
git commit -m "dotenv: own parser and loader on deno_ral (replaces @std/dotenv load's Deno.readTextFile/Deno.env)"
```

### Task 7: stdin check, ratchet, docs

**Files:**
- Modify: `tools/runtime-boundary-baseline.json`, `.claude/rules/typescript/deno-ral.md`

- [ ] **Step 1: Verify the `create --json` stdin conversion (PR 08)**

Run: `grep -n 'Deno\.stdin\|readLines' src/command/create/cmd.ts`
Expected: nothing (PR 08 Task 5 step 4 replaced `readLines(Deno.stdin)` with `readStdinLines()`). If a line prints, apply PR 08's replacement exactly as written there (`for await (const line of readStdinLines()) { input = line; break; }` with `readStdinLines` imported from `../../deno_ral/process.ts`) in this PR.

- [ ] **Step 2: Baselines**

Run: `quarto run --dev tools/check-runtime-boundary.ts --update-baseline`
Expected: `src-js` 0 (from 7: `tree-sitter-deno.js` 5, `chrome.js` 1, `external-request.js` 1); `resources` 5 (from 10, or from 8 if PR 19 already regenerated the editor bundles: `graphviz-wasm.js` 3 removed); `src` lower by the `metrics.ts` monkey-patch (2) plus `deno-init-tree-sitter.ts:25` if PR 10 had not already rewritten it. Commit the file.

Run: `grep -rln 'Deno\.' src/resources --include=*.js --include=*.mjs --include=*.ts | grep -v extension-subtrees | grep -v '^src/resources/types/' | sort`
Expected: exactly the allow-list in Acceptance criteria.

- [ ] **Step 3: Rules**

In `.claude/rules/typescript/deno-ral.md`, extend the `fs.ts` row's key exports with `onFileRead`, and the `log.ts` row with `FileHandler`, `BaseHandler`.

- [ ] **Step 4: Commit**

```bash
git add tools/runtime-boundary-baseline.json .claude/rules/typescript/deno-ral.md
git commit -m "ratchet: src-js at zero, resources at the user-script allow-list"
```

## Verification

- The test command in Acceptance criteria → pass.
- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent $(find smoke/logging/ -name '*.test.ts') smoke/render/render-html.test.ts $(find unit/yaml-intelligence/ -name '*.test.ts')` → pass.
- Bundle check (Task 1 step 7) → `bundle render exit: 0`.
- `quarto dev-call build-artifacts && git status --short src/resources/editor` → empty.
- `quarto run --dev tools/check-runtime-boundary.ts` → passes at the new baselines.

## Review checklist

- [ ] `web-tree-sitter` pinned to exactly `0.20.2` in the import map and the lockfile; the shipped wasm's sha256 matches the npm tarball's (the unit test pins it).
- [ ] No file under `src/core/lib/` imports `deno_ral/fs.ts` (the browser bundles compile `src/core/lib/yaml-intelligence/`).
- [ ] The bundle banner defines `require`, `__filename`, `__dirname` and nothing else.
- [ ] `graphviz-wasm.js` has no `Deno`, `process` or file-system reference; `dot.ts` loads it once.
- [ ] `metrics.ts` reports `fileReads` (getter) and no longer assigns to `Deno.*`.
- [ ] `FileHandler` keeps @std/log's buffer size, flush rule and modes; `LogFileHandler` unchanged.
- [ ] `parseDotenv` is a line-for-line port (diff it against `https://jsr.io/@std/dotenv/0.225.3/parse.ts`: only `Deno.env.get` → `env.get`, type annotations, names).
- [ ] `resources` allow-list matches the acceptance grep exactly.

## Risks and rollback

- tree-sitter in the bundle: a missing banner shows as `ReferenceError: __dirname is not defined` at the first render of the bundled CLI (Task 1 step 7 and the PR 00b gate catch it). PR 26's Node bundle needs the same two definitions (recorded under Decisions).
- `web-tree-sitter` 0.20.2 is from 2021 and unmaintained on that line. Moving to a current release means rebuilding `tree-sitter-yaml.wasm` with a current `tree-sitter-cli` (ABI 14/15, `dylink.0`) and updating the browser copy too; that is a separate change, not needed for the runtime migration.
- `FileHandler` without an `unload` listener: a process that exits without running cleanup (a crash) loses at most 4 KB of buffered log lines; `LogFileHandler.log` flushes after every message, so Quarto's `--log` loses nothing.
- dotenv: the port keeps @std/dotenv's quirks (a `g`-flagged `RE_EXPAND_VALUE.test` carries `lastIndex` between calls; an undefined default expands to `"undefined"`), deliberately, so no `_environment` file changes meaning in this PR.
- Rollback: revert the seven commits; restoring `tree-sitter-deno.js` also restores its import.

## Decisions needed

- Not changed because: the brief placed the tree-sitter loader in `src/core/lib/yaml-intelligence/`; that directory is compiled into the browser bundles (`build-artifacts`, `cmd.ts:91-114`) and must not import `src/deno_ral/fs.ts`. The CLI loader already lives in `src/core/schema/deno-init-tree-sitter.ts`, so the byte loading goes there and the browser path (global `TreeSitter` from `tree-sitter.js`, grammar from `tree-sitter-yaml.json`) is untouched.
- Not changed because: `readLines(Deno.stdin)` in `create/cmd.ts` is PR 08's conversion (Task 5 step 4 there); this PR only verifies it, to avoid two PRs editing the same lines.
- For PR 26 (recorded here, applied there): the Node bundle banner in `tools/node-bundle/build.mjs` must define `__filename` and `__dirname` next to `require`, for the same CommonJS glue.
