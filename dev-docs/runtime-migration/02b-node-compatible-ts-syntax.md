# PR 02b: Node-compatible TypeScript syntax (`import type`, no enums, no parameter properties, no `<T>` casts)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every `.ts` file under `src/`, `tests/` and `package/src` loadable by a type-stripping runtime (Node's built-in TypeScript support): mark type-only imports with `type`, enable `verbatimModuleSyntax` so the type checker keeps them marked, replace `enum`s and the one runtime `namespace` with `as const` objects, constructor parameter properties with explicit fields, and `<T>x` assertions with `x as T`, and add a CI check that parses every file with Node's type stripper.
**Phase:** 1 (after PR 02). **Depends on:** PR 02 (lands after it so the ratchet exists; no code dependency). **Unblocks:** PR 26 (bundle sources are strip-clean), PR 31 (unbundled `node --test` on sources), PR 33 (dev loop on sources), PR 35 (user scripts on Node).
**Branch:** `rt/02b-node-compatible-ts-syntax`.
**Suggested executor:** Opus. The edits are mechanical, but the import-type rule must preserve the module graph Deno evaluates today, and a wrong `type` on a value import breaks Node at link time; the enum and constructor rewrites need care with initialisation order.
**Size:** L. 358 files under `src/`, 117 under `tests/`, 29 under `package/src` gain `type` markers (2,067 specifiers, 871 declarations become `import type`); 5 enum files + 1 namespace file + its re-export; 42 constructors in 42 files (40 in `src/`, 2 in `tests/`); 9 casts in 2 files; 2 new tools with tests; 1 workflow; 3 config files.
**Ships on:** Deno; the existing test suite must stay green (no runtime behaviour changes; the emitted JavaScript Deno runs is identical apart from enum objects, which keep their member names and values).

## Spec

### Context

Review finding S2 (2026-10-15) and assessment section 3.5. Node's type stripping (stable since 24.12/25.2, on by default in Node 26) removes type annotations but does not elide imports: it has `verbatimModuleSyntax` semantics, so `import { Format } from "../config/types.ts"`, where `Format` is an interface, fails at link time with `does not provide an export named 'Format'` (reproduced on Node 22.22). It also rejects `enum`, runtime `namespace`, parameter properties, `<T>expr` assertions and `import x = …`, and Node 26 removed `--experimental-transform-types`, so there is no flag to accept them. Deno, esbuild and `tsc` (without `verbatimModuleSyntax`) elide imports whose bindings are only used as types, which is why the code base never needed `import type`.

Measured on `main` at `b86f98d` (2026-10-15) with the scripts behind Tasks 1 and 5, run on Node 22.22 with `ts-morph@28.0.0`'s TypeScript:

- `stripTypeScriptTypes` rejects 48 of 1,105 `.ts` files under `src/`, `tests/`, `package/src` (first error per file): 40 parameter-property constructors in `src/` and 2 in `tests/` (`tests/gha-grouping.ts` `GroupEmitter`, `tests/quarto-cmd.ts` `QuartoTimeoutError`), 4 enum files, 1 namespace file, 1 `<T>` cast file (`src/config/types.ts`; `src/publish/quarto-pub/api/index.ts` also has 7 casts but reports its parameter property first).
- Full inventory on the AST: 12 `enum` declarations (`src/core/giscus.ts:53` `GiscusThemeDefault`; `src/project/types/website/listing/website-listing-shared.ts:185` `ListingType`, `:202` `ListingItemSource`; `src/publish/confluence/api/types.ts:10` `LogLevel`, `:17` `LogPrefix`, `:56` `ContentStatusEnum`, `:67` `PublishTypeEnum`, `:76` `ContentBodyRepresentation`, `:98` `ContentChangeType`, `:154` `ContentPropertyKey`; `src/publish/netlify/api/models/accountSetup.ts:15` `period` inside `namespace accountSetup`; `src/publish/provider-types.ts:11` `AccountTokenType`, the only numeric one). No reverse lookup (`X[value]`), no `Object.keys/values` over an enum, and one enum member used as a type (`accountSetup.period`, in its own file). `namespace JSX` in `src/resources/conf/jsx-runtime.ts` is types-only and strips fine.
- 9 `<T>x` assertions: `src/config/types.ts:368,377`, `src/publish/quarto-pub/api/index.ts:70,90,110,159,195,217,263`.
- Import bindings that today's emit drops (TypeScript elision with `verbatimModuleSyntax` off, which is what Deno's and esbuild's transpilers do): `src/` 1,789 specifiers in 358 files (764 declarations become `import type`, including 3 that only had inline `type` specifiers and 1 empty `import {}`), `tests/` 222 in 117 files (78), `package/src` 56 in 29 files (29). 119 declarations in `src/` already use `import type`.

Why "dropped by today's emit" and not only "declared as an interface or type alias": the second rule (the review's wording) would leave `import { Brand } from "./brand.ts"` unmarked when `Brand` is a class used only in type annotations. That is legal under `verbatimModuleSyntax`, but Node (and Deno once the option is on) would then load `brand.ts` where today it is elided, adding module edges and with them possible import-cycle and evaluation-order changes. Marking every binding the current emit drops reproduces today's module graph exactly; symbols declared only as types are a subset of it. The prototype of Task 5's tool was checked on all 1,104 files: for every file, the imports TypeScript emits from the new source with `verbatimModuleSyntax: true` equal the imports it emits from the old source with it off, and the imports `stripTypeScriptTypes` leaves equal them too (whitespace aside).

`deno.jsonc` is generated: `package/src/common/create-deno-config.ts` prints `package/src/common/deno-meta.json` with its globs expanded (`dev-docs/update-deno_jsonc.md`). The current `deno.jsonc` has `"compilerOptions": { "noErrorTruncation": true }` but `deno-meta.json` has no `compilerOptions` at all (the two drifted). The option therefore goes into `deno-meta.json` (source of truth, which also restores `noErrorTruncation` there) and, by hand, into `deno.jsonc`: regenerating it would rewrite the expanded exclude list with paths of the local checkout (`tests/.venv/...`, `package/pkg-working/...`), unrelated churn. Where the options apply: `deno check` run from inside the repository discovers `deno.jsonc` (the plans' `cd src && deno check … quarto.ts`, editors through the LSP); the test runner passes `--config test-conf.json` (`tests/run-tests.sh:72`), so `tests/test-conf.json` needs the option too; the dev launcher runs with `--no-config` and keeps today's elision at runtime, which is harmless once the markers are in place.

The syntax scan (`tools/node-bundle/check-ts-syntax.mjs`) was designed in PR 31; it moves here so that the syntax is fixed and kept fixed from Phase 1 on. It is dependency-free (`node:module`), so it runs before PR 26 creates the root `package.json`. It does not see type-only imports (stripping succeeds; the failure is at link time); the type checker with `verbatimModuleSyntax` (error TS1484) and the import-type tool's `--check` mode cover those.

### Scope

In:
- `tools/node-bundle/check-ts-syntax.mjs` and `tools/node-bundle/check-ts-syntax.test.mjs` (`node:test`), and `.github/workflows/check-ts-syntax.yml` running both on Node 26.
- The 12 enums and `namespace accountSetup` → `as const` objects plus a type of the same name; `src/publish/netlify/api/index.ts:14` re-export → `export type`.
- The 42 parameter-property constructors → explicit fields and assignments.
- The 9 `<T>x` assertions → `x as T`.
- `tools/codemod-import-type.ts` and `tools/codemod/codemod-import-type.test.ts`; running it on `src`, `tests`, `package/src`.
- `verbatimModuleSyntax: true` in `package/src/common/deno-meta.json`, `deno.jsonc`, `tests/test-conf.json`; a `--check` run of the import-type tool in `.github/workflows/runtime-boundary.yml` (PR 02's job, which already runs `configure.sh`).
- `.claude/rules/typescript/deno-essentials.md`: the new conventions.

Out:
- `src/resources/extension-subtrees/` (upstream, decision 7), `node_modules`, `*.d.ts`, `*.ejs.ts` templates.
- Running anything on Node beyond the parse check (PR 26, 31).
- Decorators, `import x = require()`: none in the tree (AST inventory).

### Interfaces

`tools/codemod-import-type.ts`:

```ts
export interface ImportTypeResult {
  text: string;          // the new file text (=== input when nothing changes)
  specifiers: number;    // bindings marked type-only
  declarations: number;  // declarations made `import type` (or removed: empty `import {}`)
}
/** Marks the import bindings that today's emit drops (ts.transpileModule with
 *  verbatimModuleSyntax off). Idempotent. fileName must not equal an imported module. */
export function importTypeFile(text: string, fileName: string): ImportTypeResult;
export function collectTsFiles(dir: string): string[]; // skips node_modules, .venv, extension-subtrees, *.d.ts, *.ejs.ts
// CLI: quarto run --dev tools/codemod-import-type.ts [--check] [--dry-run] <dir>...
//      --check: print what would change and exit 1 if anything would.
```

Rewrite rules, per import declaration that has bindings and is not already `import type`:
1. Every binding dropped (named, default and namespace alike), or only inline-`type` named bindings: `import` → `import type`, inline `type` modifiers removed.
2. Some named bindings dropped, default/namespace kept or absent: `type ` before each dropped named binding.
3. A dropped default or namespace binding next to kept bindings: split into `import type Def from "m";` (or `import type * as ns from "m";`) and an `import { … } from "m";` with the rest.
4. `import {} from "m"` (no bindings): removed (today's emit drops it).

Conversion shapes (normative for this PR):

```ts
// enum → const object + type of the same name
export const ListingType = { Default: "default", Grid: "grid", Table: "table", Custom: "custom" } as const;
export type ListingType = (typeof ListingType)[keyof typeof ListingType];

// parameter property → field + assignment (assignments first in the body, after super())
private readonly token_?: string;
constructor(environment: string, token_?: string) {
  this.token_ = token_;
  …
}

// <T>x → x as T
return (await response.json()) as Ticket;
```

### Files

- Create: `tools/node-bundle/check-ts-syntax.mjs`, `tools/node-bundle/check-ts-syntax.test.mjs`, `.github/workflows/check-ts-syntax.yml`, `tools/codemod-import-type.ts`, `tools/codemod/codemod-import-type.test.ts`
- Modify (enums): `src/core/giscus.ts:53-56`, `src/project/types/website/listing/website-listing-shared.ts:185-190,202-207`, `src/publish/confluence/api/types.ts:10-21,56-61,67-70,76-78,98-102,154-157`, `src/publish/provider-types.ts:11-15`, `src/publish/netlify/api/models/accountSetup.ts:6-19`, `src/publish/netlify/api/index.ts:14`
- Modify (parameter properties): the 31 files `src/publish/netlify/api/services/*Service.ts`, `src/publish/netlify/api/core/BaseHttpRequest.ts`, `src/publish/types.ts`, `src/publish/rsconnect/api/index.ts`, `src/publish/confluence/api/index.ts`, `src/publish/quarto-pub/api/index.ts`, `src/core/brand/brand.ts`, `src/core/knitr.ts`, `src/tools/github.ts`, `src/command/call/axe/scan.ts`, `tests/gha-grouping.ts`, `tests/quarto-cmd.ts`
- Modify (casts): `src/config/types.ts:368,377`, `src/publish/quarto-pub/api/index.ts:70,90,110,159,195,217,263`
- Modify (import type, by the tool): 358 files under `src/`, 117 under `tests/`, 29 under `package/src`
- Modify: `package/src/common/deno-meta.json`, `deno.jsonc`, `tests/test-conf.json`, `.github/workflows/runtime-boundary.yml`, `deno.lock` (if PR 00b landed), `.claude/rules/typescript/deno-essentials.md`

### Acceptance criteria

- `node --no-warnings tools/node-bundle/check-ts-syntax.mjs` → `ok: 1105 files, no syntax Node's type stripping rejects` (or the current count), exit 0, on Node 22.13+ and in CI on Node 26.
- `node --test tools/node-bundle/check-ts-syntax.test.mjs` → `pass 2`, `fail 0`.
- `package/dist/bin/tools/x86_64/deno test --allow-all --import-map=src/import_map.json tools/codemod/codemod-import-type.test.ts` → `ok | 8 passed | 0 failed`.
- `quarto run --dev tools/codemod-import-type.ts --check src tests package/src` → `Summary: 0 files would change, …`, exit 0.
- `cd src && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --unstable-ffi --import-map=import_map.json quarto.ts` passes with `verbatimModuleSyntax` on (and fails with TS1484 when a type-only `type` marker is removed, Task 6 step 4).
- The Deno suite stays green: `unit/` locally, `smoke/` in CI on three OSes.
- `quarto run --dev tools/check-runtime-boundary.ts` passes; the baseline is unchanged (no `Deno.*` added or removed).

## Plan

Assumes PR 02 landed and `./configure.sh` has been run (`package/dist/bin/tools/x86_64/deno`; substitute the architecture directory present). Node 22.13 or newer must be on `PATH` locally for Tasks 1 and 7 (`node --version`); CI uses Node 26. Line numbers are from `b86f98d`; re-check each with `rg -n`.

Landing note: this PR touches the import blocks of about 500 files. Land it right after PR 02 and before PR 08 if possible; if another PR lands first and conflicts, apply the reset-and-re-run protocol of PRs 10–13 (reset the file to `main`, re-run `tools/codemod-import-type.ts` on it, `deno fmt`), never a hand merge of import lines.

### Task 1: the syntax check

**Files:**
- Create: `tools/node-bundle/check-ts-syntax.mjs`, `tools/node-bundle/check-ts-syntax.test.mjs`

- [ ] **Step 1: Write the failing test**

`tools/node-bundle/check-ts-syntax.test.mjs`:

```js
// check-ts-syntax.test.mjs
//
// Copyright (C) 2026 Posit Software, PBC
//
// node --test tools/node-bundle/check-ts-syntax.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const script = path.join(path.dirname(fileURLToPath(import.meta.url)), "check-ts-syntax.mjs");

function check(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ts-syntax-"));
  try {
    for (const [rel, text] of Object.entries(files)) {
      fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
      fs.writeFileSync(path.join(root, rel), text);
    }
    return spawnSync(process.execPath, ["--no-warnings", script, "--root", root, "src"], { encoding: "utf8" });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test("accepts erasable TypeScript, including import type", () => {
  const r = check({
    "src/a.ts": 'import type { A } from "./b.ts";\nimport { type B, c } from "./c.ts";\nexport const x = c as unknown as A;\nexport type T = B;\n',
    "src/types.d.ts": "export enum Ignored { A }\n",
  });
  assert.equal(r.status, 0, r.stdout);
  assert.match(r.stdout, /^ok: 1 files/m);
});

test("rejects enum, parameter properties, namespaces and <T> casts, one line per file", () => {
  const r = check({
    "src/enum.ts": "export enum E { A = 'a' }\n",
    "src/param.ts": "export class C { constructor(private x: number) {} }\n",
    "src/ns.ts": "export namespace N { export const a = 1; }\n",
    "src/cast.ts": "export const y = <string>(globalThis as any).x;\n",
    "src/node_modules/pkg/index.ts": "export enum Skipped { A }\n",
    "src/resources/extension-subtrees/x/y.ts": "export enum Skipped { A }\n",
  });
  assert.equal(r.status, 1);
  const lines = r.stdout.trim().split("\n");
  assert.deepEqual(lines.slice(0, -1).map((l) => l.split(":")[0]).sort(), [
    "src/cast.ts",
    "src/enum.ts",
    "src/ns.ts",
    "src/param.ts",
  ]);
  assert.match(lines.at(-1), /^4 of 4 file\(s\)/);
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --test tools/node-bundle/check-ts-syntax.test.mjs`
Expected: both tests fail (`Cannot find module '…/check-ts-syntax.mjs'` in the child's stderr, status 1 instead of 0).

- [ ] **Step 3: Implement**

`tools/node-bundle/check-ts-syntax.mjs`:

```js
// check-ts-syntax.mjs
//
// Copyright (C) 2026 Posit Software, PBC
//
// Lists TypeScript syntax that Node's type stripping rejects (enum, parameter
// properties, namespaces with values, `<T>expr` assertions, `import x =`),
// using node:module stripTypeScriptTypes on every .ts file under the given
// directories (default: src tests package/src). Parse only: nothing is
// executed. Exit 1 when any file is rejected.
//
// Usage: node --no-warnings tools/node-bundle/check-ts-syntax.mjs [--root <dir>] [dir...]
import fs from "node:fs";
import path from "node:path";
import { stripTypeScriptTypes } from "node:module";
import { fileURLToPath } from "node:url";

const argv = process.argv.slice(2);
let root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const rootAt = argv.indexOf("--root");
if (rootAt >= 0) {
  root = path.resolve(argv[rootAt + 1]);
  argv.splice(rootAt, 2);
}
const dirs = argv.length > 0 ? argv : ["src", "tests", "package/src"];
// extension-subtrees: upstream code (decision 7); node_modules/.venv: third party.
const kSkip = new Set(["node_modules", ".venv", "extension-subtrees"]);

function* tsFiles(dir) {
  for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
    if (kSkip.has(d.name)) continue;
    const full = path.join(dir, d.name);
    if (d.isDirectory()) yield* tsFiles(full);
    else if (d.name.endsWith(".ts") && !d.name.endsWith(".d.ts")) yield full;
  }
}

let files = 0;
let failures = 0;
for (const dir of dirs) {
  for (const file of tsFiles(path.resolve(root, dir))) {
    files++;
    try {
      stripTypeScriptTypes(fs.readFileSync(file, "utf8"), { sourceUrl: file });
    } catch (e) {
      failures++;
      const rel = path.relative(root, file).replaceAll("\\", "/");
      console.log(`${rel}: ${String(e.message).split("\n")[0]}`);
    }
  }
}
console.log(
  failures === 0
    ? `ok: ${files} files, no syntax Node's type stripping rejects`
    : `${failures} of ${files} file(s) use syntax Node's type stripping rejects`,
);
process.exit(failures === 0 ? 0 : 1);
```

`stripTypeScriptTypes` is called without `mode` (strip is the default; Node 26 removed transform mode).

- [ ] **Step 4: Run the test and the scan**

Run: `node --test tools/node-bundle/check-ts-syntax.test.mjs`
Expected: `# pass 2`, `# fail 0`.

Run: `node --no-warnings tools/node-bundle/check-ts-syntax.mjs | tail -1`
Expected: `48 of 1105 file(s) use syntax Node's type stripping rejects` (exit 1; the 48 files are the ones Tasks 2–4 fix; `tools/` is not scanned).

- [ ] **Step 5: Commit**

```bash
git add tools/node-bundle/check-ts-syntax.mjs tools/node-bundle/check-ts-syntax.test.mjs
git commit -m "tools: check-ts-syntax.mjs lists syntax Node's type stripping rejects"
```

### Task 2: enums and the runtime namespace

**Files:**
- Modify: `src/core/giscus.ts`, `src/project/types/website/listing/website-listing-shared.ts`, `src/publish/confluence/api/types.ts`, `src/publish/provider-types.ts`, `src/publish/netlify/api/models/accountSetup.ts`, `src/publish/netlify/api/index.ts`

Every replacement keeps member names and values, so `X.A` value uses and `: X` type annotations keep compiling; the type `X` is the union of the member values.

- [ ] **Step 1: `src/core/giscus.ts:53-56`**

```ts
const GiscusThemeDefault = {
  light: "light",
  dark: "dark",
} as const;
```

(Module-private and used only as values; no type alias needed. If `deno check` reports `GiscusThemeDefault` used as a type, add `type GiscusThemeDefault = (typeof GiscusThemeDefault)[keyof typeof GiscusThemeDefault];`.)

- [ ] **Step 2: `src/project/types/website/listing/website-listing-shared.ts:185-190,202-207`**

```ts
export const ListingType = {
  Default: "default",
  Grid: "grid",
  Table: "table",
  Custom: "custom",
} as const;
export type ListingType = (typeof ListingType)[keyof typeof ListingType];
```

```ts
export const ListingItemSource = {
  document: "document", // qmd input files
  metadata: "metadata", // yaml metadata files
  metadataDocument: "metadata-document", // yaml containing a list of input files
  rawfile: "rawfile", // some other kind of file that we can't introspect much
} as const;
export type ListingItemSource =
  (typeof ListingItemSource)[keyof typeof ListingItemSource];
```

- [ ] **Step 3: `src/publish/confluence/api/types.ts` (seven enums)**

```ts
export const LogLevel = {
  DEBUG: "DEBUG",
  INFO: "INFO",
  WARN: "WARN",
  ERROR: "ERROR",
} as const;
export type LogLevel = (typeof LogLevel)[keyof typeof LogLevel];

export const LogPrefix = {
  GENERAL: "[General]",
  ATTACHMENT: "[Attach]",
  RENDER: "[Render]",
} as const;
export type LogPrefix = (typeof LogPrefix)[keyof typeof LogPrefix];
```

```ts
export const ContentStatusEnum = {
  current: "current",
  deleted: "deleted",
  historical: "historical",
  draft: "draft",
} as const;
export type ContentStatusEnum =
  (typeof ContentStatusEnum)[keyof typeof ContentStatusEnum];
```

```ts
export const PublishTypeEnum = {
  document: "document",
  site: "site",
} as const;
export type PublishTypeEnum = (typeof PublishTypeEnum)[keyof typeof PublishTypeEnum];
```

```ts
export const ContentBodyRepresentation = {
  storage: "storage",
} as const;
export type ContentBodyRepresentation =
  (typeof ContentBodyRepresentation)[keyof typeof ContentBodyRepresentation];
```

```ts
export const ContentChangeType = {
  create: "create",
  update: "update",
  delete: "delete",
} as const;
export type ContentChangeType =
  (typeof ContentChangeType)[keyof typeof ContentChangeType];
```

```ts
export const ContentPropertyKey = {
  fileName: "fileName",
  isQuartoSiteParent: "isQuartoSiteParent",
} as const;
export type ContentPropertyKey =
  (typeof ContentPropertyKey)[keyof typeof ContentPropertyKey];
```

- [ ] **Step 4: `src/publish/provider-types.ts:11-15` (numeric)**

```ts
export const AccountTokenType = {
  Environment: 0,
  Authorized: 1,
  Anonymous: 2,
} as const;
export type AccountTokenType = (typeof AccountTokenType)[keyof typeof AccountTokenType];
```

(The implicit values of the old numeric enum, made explicit. `rg -n 'AccountTokenType\[' src` prints nothing: no reverse lookup.)

- [ ] **Step 5: `src/publish/netlify/api/models/accountSetup.ts` and its re-export**

Replace lines 6-19 (the type and the namespace) with:

```ts
export const accountSetupPeriod = {
  MONTHLY: "monthly",
  YEARLY: "yearly",
} as const;
export type accountSetupPeriod =
  (typeof accountSetupPeriod)[keyof typeof accountSetupPeriod];

export type accountSetup = {
  name: string;
  type_id: string;
  payment_method_id?: string;
  period?: accountSetupPeriod;
  extra_seats_block?: number;
};
```

`src/publish/netlify/api/index.ts:14`: `export { accountSetup as AccountSetup } from "./models/accountSetup.ts";` → `export type { accountSetup as AccountSetup } from "./models/accountSetup.ts";` (`accountSetup` is now a type only; nothing in the tree uses `AccountSetup.period`, `rg -n 'AccountSetup' src`).

- [ ] **Step 6: Verify and commit**

Run: `cd src && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --unstable-ffi --import-map=import_map.json quarto.ts`
Expected: no errors.

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent $(find unit/confluence/ -name '*.test.ts') unit/giscus.test.ts $(find unit/project/ -name '*.test.ts')`
Expected: `0 failed`.

```bash
git add src/core/giscus.ts src/project/types/website/listing/website-listing-shared.ts src/publish/confluence/api/types.ts src/publish/provider-types.ts src/publish/netlify/api/models/accountSetup.ts src/publish/netlify/api/index.ts
git commit -m "Replace enums and a runtime namespace with as-const objects"
```

### Task 3: parameter properties

**Files:** the 42 constructors listed under Files.

Rule: declare each parameter property as a field with the same modifiers and type (without the default value), drop the modifiers from the parameter, and assign it first in the constructor body (after `super(...)` in a derived class). Field initialisers that read such a field (the arrow-function members of `QuartoPubClient`, `ConfluenceClient`, `RSConnectClient`) read it lazily, so the order is unchanged.

- [ ] **Step 1: the 31 Netlify services (identical one-liners)**

Each file `src/publish/netlify/api/services/*Service.ts` has exactly `  constructor(public readonly httpRequest: BaseHttpRequest) {}` (verify: `rg -c '^  constructor\(public readonly httpRequest: BaseHttpRequest\) \{\}$' src/publish/netlify/api/services | wc -l` → `31`).

```bash
perl -0pi -e 's/^  constructor\(public readonly httpRequest: BaseHttpRequest\) \{\}$/  public readonly httpRequest: BaseHttpRequest;\n\n  constructor(httpRequest: BaseHttpRequest) {\n    this.httpRequest = httpRequest;\n  }/m' src/publish/netlify/api/services/*Service.ts
```

`src/publish/netlify/api/core/BaseHttpRequest.ts:10`:

```ts
  public readonly config: OpenAPIConfig;

  constructor(config: OpenAPIConfig) {
    this.config = config;
  }
```

- [ ] **Step 2: the other nine in `src/`**

`src/publish/types.ts` (`ApiError`):

```ts
export class ApiError extends Error {
  public readonly status: number;
  public readonly statusText: string;
  public readonly description: string | undefined;

  public constructor(
    status: number,
    statusText: string,
    description: string | undefined = undefined,
  ) {
    let message = `API Error: ${status} - ${statusText}`;
    if (description) {
      message = `${message} (${description})`;
    }
    super(message);
    this.status = status;
    this.statusText = statusText;
    this.description = description;
  }
}
```

`src/publish/rsconnect/api/index.ts` (`RSConnectClient`):

```ts
export class RSConnectClient {
  private readonly server_: string;
  private readonly key_?: string;

  public constructor(server_: string, key_?: string) {
    this.server_ = ensureProtocolAndTrailingSlash(server_);
    this.key_ = key_;
  }
```

`src/publish/confluence/api/index.ts` (`ConfluenceClient`):

```ts
export class ConfluenceClient {
  private readonly token_: AccountToken;

  public constructor(token_: AccountToken) {
    this.token_ = token_;
  }
```

`src/publish/quarto-pub/api/index.ts` (`QuartoPubClient`):

```ts
export class QuartoPubClient {
  private readonly baseURL_: string;
  private readonly token_?: string;
  constructor(environment: string, token_?: string) {
    this.token_ = token_;
    switch (environment) {
```

(the rest of the constructor unchanged).

`src/core/brand/brand.ts` (`Brand`): add `readonly brand: unknown;` after `processedData: ProcessedBrandData;`, change the first parameter to `brand: unknown,` and make `this.brand = brand;` the first statement of the body.

`src/core/knitr.ts` (`WindowsArmX64RError`): add `readonly exitCode: number;` after `readonly diagnosticLines: readonly string[];`, change the parameter to `constructor(exitCode: number) {`, and add `this.exitCode = exitCode;` right after `super(diagnosticLines.join("\n"));`.

`src/tools/github.ts` (`AnnotationBudget`): add `private readonly max: number;` after `private readonly counterPath: string | null;`, change the parameter to `max = 9,` and make `this.max = max;` the first statement of the body.

`src/command/call/axe/scan.ts` (`CdpClient`):

```ts
  private readonly connection: DenoCriConnection;

  private constructor(connection: DenoCriConnection) {
    this.connection = connection;
    // deno-cri notices the socket going away, but leaves the commands that
    // were in flight when it went unsettled forever.
    connection.on("disconnect", () => this.abandonPending());
  }
```

- [ ] **Step 3: the two in `tests/`**

`tests/gha-grouping.ts` (`GroupEmitter`):

```ts
export class GroupEmitter {
  private openFile: string | undefined = undefined;
  private readonly gate: () => boolean;
  private readonly onStart: (title: string) => void;
  private readonly onEnd: () => void;

  constructor(
    gate: () => boolean,
    onStart: (title: string) => void,
    onEnd: () => void,
  ) {
    this.gate = gate;
    this.onStart = onStart;
    this.onEnd = onEnd;
  }
```

`tests/quarto-cmd.ts` (`QuartoTimeoutError`):

```ts
export class QuartoTimeoutError extends Error {
  readonly timeoutMs: number;
  // True only when the render is known to have been stopped. Dev mode
  // races a timer against an in-process render it cannot cancel, so it is
  // always false there; binary mode sets it from the process-tree kill
  // outcome.
  readonly renderCancelled: boolean;
  // Platform detail of the kill attempt, including the child pid.
  // Undefined in dev mode, which attempts no kill.
  readonly killDetail?: string;

  constructor(
    message: string,
    timeoutMs: number,
    renderCancelled: boolean,
    killDetail?: string,
  ) {
    super(message);
    this.timeoutMs = timeoutMs;
    this.renderCancelled = renderCancelled;
    this.killDetail = killDetail;
    this.name = "QuartoTimeoutError";
  }
}
```

- [ ] **Step 4: Verify and commit**

Run: `cd src && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --unstable-ffi --import-map=import_map.json quarto.ts`
Expected: no errors.

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/gha-grouping.test.ts unit/github-actions-reporting.test.ts unit/check-gha-log.test.ts $(find unit/confluence/ -name '*.test.ts') unit/axe-config.test.ts unit/axe-scan-cell.test.ts unit/preview-brand-cache.test.ts unit/windows-arm-r-error.test.ts unit/print-call-r-diagnostics.test.ts $(find smoke/use-brand/ -name '*.test.ts')`
Expected: `0 failed`.

```bash
git add src tests
git commit -m "Replace constructor parameter properties with explicit fields"
```

### Task 4: `<T>x` assertions

**Files:**
- Modify: `src/config/types.ts`, `src/publish/quarto-pub/api/index.ts`

- [ ] **Step 1: Rewrite**

`src/config/types.ts:368`: `return (filter as PandocFilter).path !== undefined;`; line 377: `return (filter as QuartoFilterEntryPoint).at !== undefined;`.

`src/publish/quarto-pub/api/index.ts` lines 70, 90, 110, 159, 195, 217, 263: each `return <T> await response.json();` becomes `return (await response.json()) as T;` with the same `T` (`Ticket`, `Ticket`, `AccessToken`, `Site`, `PublishDeploy`, `PublishDeploy`, `AccountSite`):

```bash
perl -pi -e 's/return <(\w+)> await response\.json\(\);/return (await response.json()) as $1;/' src/publish/quarto-pub/api/index.ts
rg -n '<\w+> ' src/publish/quarto-pub/api/index.ts src/config/types.ts
```

Expected: the second command prints nothing.

- [ ] **Step 2: Verify the scan is clean and commit**

Run: `node --no-warnings tools/node-bundle/check-ts-syntax.mjs | tail -1`
Expected: `ok: 1105 files, no syntax Node's type stripping rejects` (exit 0).

Run: `cd src && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --unstable-ffi --import-map=import_map.json quarto.ts`
Expected: no errors.

```bash
git add src/config/types.ts src/publish/quarto-pub/api/index.ts
git commit -m "Use as-casts instead of angle-bracket assertions"
```

### Task 5: the import-type tool

**Files:**
- Create: `tools/codemod-import-type.ts`, `tools/codemod/codemod-import-type.test.ts`

The test lives under `tools/`, not `tests/`, for the same reason as PR 09's codemod test: `run-tests.sh` never loads `npm:ts-morph`. If PR 09 has landed, `tools/codemod/` already exists and its CI step runs every test in it; otherwise Task 6 step 5 adds that step.

- [ ] **Step 1: Write the failing test**

`tools/codemod/codemod-import-type.test.ts`:

```ts
/*
 * codemod-import-type.test.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 *
 * Run: package/dist/bin/tools/x86_64/deno test --allow-all --import-map=src/import_map.json tools/codemod/
 * (outside tests/ so that run-tests.sh never loads npm:ts-morph).
 */

import { assertEquals } from "testing/asserts";
import { importTypeFile } from "../codemod-import-type.ts";

// The file name must differ from every imported module: TypeScript resolves a
// self-import and fails while reporting the missing member.
const kFile = "/x/src/main.ts";

const cases: [string, string, string][] = [
  [
    "interface only → import type",
    'import { Format } from "./types.ts";\nexport const f = (x: Format) => x;\n',
    'import type { Format } from "./types.ts";\nexport const f = (x: Format) => x;\n',
  ],
  [
    "mixed → inline type",
    'import { Format, kTitle } from "./types.ts";\nexport const f = (x: Format) => x[kTitle];\n',
    'import { type Format, kTitle } from "./types.ts";\nexport const f = (x: Format) => x[kTitle];\n',
  ],
  [
    "a class used only as a type is type-only too (module graph unchanged)",
    'import { Brand } from "./brand.ts";\nexport let b: Brand | undefined;\n',
    'import type { Brand } from "./brand.ts";\nexport let b: Brand | undefined;\n',
  ],
  [
    "only inline type specifiers → import type",
    'import { type A, type B } from "./t.ts";\nexport let a: A | B;\n',
    'import type { A, B } from "./t.ts";\nexport let a: A | B;\n',
  ],
  [
    "type-only default next to a value → split",
    'import Def, { value } from "./m.ts";\nexport const v: Def = value;\n',
    'import type Def from "./m.ts";\nimport { value } from "./m.ts";\nexport const v: Def = value;\n',
  ],
  [
    "empty import {} is removed (today's emit drops it)",
    'import {} from "./schema.ts";\nimport { a } from "./a.ts";\nexport const x = a;\n',
    'import { a } from "./a.ts";\nexport const x = a;\n',
  ],
  [
    "namespace import used only in types",
    'import * as T from "./t.ts";\nexport let t: T.X;\n',
    'import type * as T from "./t.ts";\nexport let t: T.X;\n',
  ],
  [
    "value imports are untouched",
    'import { join } from "./path.ts";\nexport const p = join("a");\n',
    'import { join } from "./path.ts";\nexport const p = join("a");\n',
  ],
];

for (const [name, input, expected] of cases) {
  Deno.test(`codemod-import-type - ${name}`, () => {
    const once = importTypeFile(input, kFile);
    assertEquals(once.text, expected);
    assertEquals(importTypeFile(once.text, kFile).text, once.text, "idempotent");
  });
}
```

- [ ] **Step 2: Run it and see it fail**

Run: `package/dist/bin/tools/x86_64/deno test --allow-all --import-map=src/import_map.json tools/codemod/codemod-import-type.test.ts`
Expected: fails with `Module not found "file:///.../tools/codemod-import-type.ts"`.

- [ ] **Step 3: Implement**

`tools/codemod-import-type.ts`:

```ts
/*
 * codemod-import-type.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 *
 * Marks import bindings that are only used as types with `type`, so that the
 * import set a type-stripping runtime (Node, `verbatimModuleSyntax`) loads is
 * exactly the set TypeScript's elision keeps today. A binding is type-only
 * when today's emit (ts.transpileModule, verbatimModuleSyntax off) drops it:
 * that covers symbols declared only as interfaces/type aliases and values
 * used only in type positions. Usage:
 *
 *   quarto run --dev tools/codemod-import-type.ts [--check] [--dry-run] <dir>...
 *
 * --check exits 1 when any file would change (CI). This script lives outside
 * the runtime boundary and may use Deno.* itself.
 */

import { ts } from "npm:ts-morph@28.0.0";
import { join, relative } from "../src/deno_ral/path.ts";
import { walkSync } from "../src/deno_ral/fs.ts";

export interface ImportTypeResult {
  text: string;            // new file text
  specifiers: number;      // specifiers marked type-only
  declarations: number;    // declarations turned into `import type`
}

const kTranspile: ts.TranspileOptions = {
  compilerOptions: {
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext,
    isolatedModules: true,
    verbatimModuleSyntax: false,
  },
};

// Keys of the import bindings that today's emit (TypeScript elision, which is
// what Deno's and esbuild's transpilers do) keeps.
function keptBindings(text: string, fileName: string): Set<string> {
  const js = ts.transpileModule(text, { ...kTranspile, fileName }).outputText;
  const sf = ts.createSourceFile("out.js", js, ts.ScriptTarget.ESNext, false);
  const kept = new Set<string>();
  for (const st of sf.statements) {
    if (!ts.isImportDeclaration(st) || !st.importClause) continue;
    const m = (st.moduleSpecifier as ts.StringLiteral).text;
    const c = st.importClause;
    if (c.name) kept.add(`${m}#default`);
    const nb = c.namedBindings;
    if (nb && ts.isNamespaceImport(nb)) kept.add(`${m}#*`);
    if (nb && ts.isNamedImports(nb)) {
      for (const e of nb.elements) kept.add(`${m}#${(e.propertyName ?? e.name).text}@${e.name.text}`);
    }
  }
  return kept;
}

interface Edit { start: number; end: number; text: string }

export function importTypeFile(text: string, fileName: string): ImportTypeResult {
  if (!/\bimport\b/.test(text)) return { text, specifiers: 0, declarations: 0 };
  const kept = keptBindings(text, fileName);
  const sf = ts.createSourceFile(fileName, text, ts.ScriptTarget.ESNext, true);
  const edits: Edit[] = [];
  let specifiers = 0, declarations = 0;
  for (const st of sf.statements) {
    if (!ts.isImportDeclaration(st) || !st.importClause || st.importClause.isTypeOnly) continue;
    const m = (st.moduleSpecifier as ts.StringLiteral).text;
    const c = st.importClause;
    const nb = c.namedBindings;
    const named = nb && ts.isNamedImports(nb) ? [...nb.elements] : [];
    const ns = nb && ts.isNamespaceImport(nb) ? nb : undefined;
    const defDropped = c.name !== undefined && !kept.has(`${m}#default`);
    const nsDropped = ns !== undefined && !kept.has(`${m}#*`);
    const dropped = named.filter((e) => !e.isTypeOnly &&
      !kept.has(`${m}#${(e.propertyName ?? e.name).text}@${e.name.text}`));
    const valueNamed = named.filter((e) => !e.isTypeOnly);
    const allNamedTypes = dropped.length === valueNamed.length;
    const defOk = c.name === undefined || defDropped;
    const nsOk = ns === undefined || nsDropped;
    if (nb && ts.isNamedImports(nb) && named.length === 0 && !c.name) {
      // `import {} from "x"`: today's emit drops it; Node would load the module.
      let end = st.getEnd();
      if (text.startsWith("\n", end)) end += 1;
      edits.push({ start: st.getStart(sf), end, text: "" });
      declarations++;
      continue;
    }
    const onlyInlineTypes = named.length > 0 && valueNamed.length === 0 && !c.name && !ns;
    if (dropped.length === 0 && !defDropped && !nsDropped && !onlyInlineTypes) continue;
    const quote = st.moduleSpecifier.getText(sf);
    const attrs = st.attributes ? " " + st.attributes.getText(sf) : "";
    if (allNamedTypes && defOk && nsOk && !(c.name && (named.length > 0 || ns))) {
      // Whole declaration is type-only: `import type …`, dropping inline `type`.
      const importKw = st.getStart(sf);
      edits.push({ start: importKw + "import".length, end: importKw + "import".length, text: " type" });
      for (const e of named) {
        if (e.isTypeOnly) {
          const s = e.getStart(sf);
          edits.push({ start: s, end: s + "type ".length, text: "" });
        }
      }
      declarations++;
      specifiers += dropped.length + (defDropped ? 1 : 0) + (nsDropped ? 1 : 0);
      continue;
    }
    if (!defDropped && !nsDropped) {
      // Mixed named imports: inline `type` on the dropped ones.
      for (const e of dropped) {
        const s = e.getStart(sf);
        edits.push({ start: s, end: s, text: "type " });
      }
      specifiers += dropped.length;
      continue;
    }
    // A dropped default or namespace binding next to other bindings: split.
    const parts: string[] = [];
    if (c.name && defDropped) parts.push(`import type ${c.name.text} from ${quote}${attrs};`);
    if (ns && nsDropped) parts.push(`import type * as ${ns.name.text} from ${quote}${attrs};`);
    const keepDefault = c.name && !defDropped ? c.name.text : undefined;
    const keepNs = ns && !nsDropped ? `* as ${ns.name.text}` : undefined;
    const keptNamed = named.map((e) => {
      const t = e.getText(sf);
      return dropped.includes(e) ? `type ${t}` : t;
    });
    const typeOnlyNamed = keptNamed.every((t) => t.startsWith("type "));
    const head = [keepDefault, keepNs].filter(Boolean) as string[];
    if (head.length > 0 || keptNamed.length > 0) {
      if (head.length === 0 && typeOnlyNamed) {
        parts.push(`import type { ${keptNamed.map((t) => t.replace(/^type /, "")).join(", ")} } from ${quote}${attrs};`);
      } else {
        const clause = [...head, keptNamed.length ? `{ ${keptNamed.join(", ")} }` : ""].filter(Boolean).join(", ");
        parts.push(`import ${clause} from ${quote}${attrs};`);
      }
    }
    edits.push({ start: st.getStart(sf), end: st.getEnd(), text: parts.join("\n") });
    specifiers += dropped.length + (defDropped ? 1 : 0) + (nsDropped ? 1 : 0);
    declarations += parts.filter((p) => p.startsWith("import type")).length;
  }
  edits.sort((a, b) => b.start - a.start);
  let out = text;
  for (const e of edits) out = out.slice(0, e.start) + e.text + out.slice(e.end);
  return { text: out, specifiers, declarations };
}

const kSkip = [/node_modules/, /\.venv/, /extension-subtrees/];

export function collectTsFiles(dir: string): string[] {
  const files: string[] = [];
  for (const e of walkSync(dir, { includeDirs: false, exts: [".ts"], skip: kSkip })) {
    if (e.name.endsWith(".d.ts") || e.name.endsWith(".ejs.ts")) continue;
    files.push(e.path);
  }
  return files.sort();
}

if (import.meta.main) {
  const args = [...Deno.args];
  const check = args.includes("--check");
  const dryRun = check || args.includes("--dry-run");
  const dirs = args.filter((a) => !a.startsWith("--"));
  if (dirs.length === 0) throw new Error("usage: codemod-import-type.ts [--check] [--dry-run] <dir>...");
  let changed = 0, specifiers = 0, declarations = 0;
  for (const dir of dirs) {
    for (const file of collectTsFiles(join(Deno.cwd(), dir))) {
      const text = Deno.readTextFileSync(file);
      const r = importTypeFile(text, file);
      if (r.text === text) continue;
      changed++;
      specifiers += r.specifiers;
      declarations += r.declarations;
      console.log(`${relative(Deno.cwd(), file).replaceAll("\\", "/")}: ${r.specifiers} specifier(s), ${r.declarations} declaration(s)`);
      if (!dryRun) Deno.writeTextFileSync(file, r.text);
    }
  }
  console.log(`Summary: ${changed} files ${dryRun ? "would change" : "changed"}, ${specifiers} specifiers marked type, ${declarations} declarations made type-only or removed`);
  if (check && changed > 0) Deno.exit(1);
}
```

- [ ] **Step 4: Run the test**

Run: `package/dist/bin/tools/x86_64/deno test --allow-all --import-map=src/import_map.json tools/codemod/codemod-import-type.test.ts`
Expected: `ok | 8 passed | 0 failed`. (The same eight cases passed against a Node port of this file with `ts-morph@28.0.0` while this plan was written.)

- [ ] **Step 5: Lockfile and commit**

If PR 00b's `deno.lock` exists: `package/dist/bin/tools/x86_64/deno cache --lock=deno.lock --frozen=false --import-map=src/import_map.json tools/codemod-import-type.ts` (adds `npm:ts-morph@28.0.0` unless PR 09 already did).

```bash
git add tools/codemod-import-type.ts tools/codemod/codemod-import-type.test.ts deno.lock
git commit -m "tools: codemod-import-type marks type-only import bindings"
```

### Task 6: `verbatimModuleSyntax` on, then the markers

**Files:**
- Modify: `package/src/common/deno-meta.json`, `deno.jsonc`, `tests/test-conf.json`, then the files the tool rewrites

- [ ] **Step 1: Turn the option on (the failing check)**

`package/src/common/deno-meta.json`: add, as the first key after `"meta"`:

```json
  "compilerOptions": {
    "noErrorTruncation": true,
    "verbatimModuleSyntax": true
  },
```

`deno.jsonc` (by hand, same two keys; do not regenerate it, see Context):

```jsonc
  "compilerOptions": {
    "noErrorTruncation": true,
    "verbatimModuleSyntax": true
  },
```

`tests/test-conf.json`:

```json
{
  "compilerOptions": {
    "verbatimModuleSyntax": true
  },
  "test": {
    "exclude": ["integration/playwright/", ".venv/"]
  }
}
```

Check the two generated-config sources agree: `node -e 'const j=require("./package/src/common/deno-meta.json"); console.log(JSON.stringify(j.compilerOptions))'` → `{"noErrorTruncation":true,"verbatimModuleSyntax":true}`.

- [ ] **Step 2: See it fail**

Run: `cd src && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --unstable-ffi --import-map=import_map.json quarto.ts 2>&1 | grep -c 'TS1484'`
Expected: a large number (hundreds): `TS1484 [ERROR]: 'Format' is a type and must be imported using a type-only import when 'verbatimModuleSyntax' is enabled.` and the like. If it prints `0`, this Deno does not apply `verbatimModuleSyntax` to type checking: continue anyway; Task 7 step 2's `--check` CI step is then the only guard against new unmarked type imports (record it in the PR description).

- [ ] **Step 3: Run the tool**

Run: `quarto run --dev tools/codemod-import-type.ts --dry-run src tests package/src | tail -1`
Expected: `Summary: 504 files would change, 2067 specifiers marked type, 871 declarations made type-only or removed` (measured on `b86f98d`; PRs merged since move the numbers slightly).

Run: `quarto run --dev tools/codemod-import-type.ts src tests package/src | tail -1`, then `git diff --name-only | grep '\.ts$' | xargs package/dist/bin/tools/x86_64/deno fmt`.
Expected: the same summary with "changed"; `deno fmt` only reflows the touched import lines.

- [ ] **Step 4: Type-check, probe, test**

Run: `cd src && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --unstable-ffi --import-map=import_map.json quarto.ts`
Expected: no errors.

Probe that the option bites: in `src/core/text.ts` change one `import type` added by the tool back to `import`, rerun the check → one `TS1484` error; `git checkout -- src/core/text.ts`. (Skip if Step 2 printed 0.)

Run: `quarto run --dev tools/codemod-import-type.ts --check src tests package/src | tail -1`
Expected: `Summary: 0 files would change, …`, exit 0 (idempotent).

Run: `node --no-warnings tools/node-bundle/check-ts-syntax.mjs | tail -1` → `ok: …` (the markers are erasable syntax).

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent $(find unit/ -name '*.test.ts')`
Expected: `0 failed` (the runner type-checks every test file with `test-conf.json`, so this also checks `tests/` under `verbatimModuleSyntax`).

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/render/render-html.test.ts smoke/site/render-site.test.ts smoke/inspect/inspect-project.test.ts smoke/check/check.test.ts`
Expected: `0 failed`.

Run: `package/src/quarto-bld prepare-dist` (bundles with esbuild; checks that `import type` and the split declarations bundle) → succeeds.

- [ ] **Step 5: Commit**

```bash
git add package/src/common/deno-meta.json deno.jsonc tests/test-conf.json
git add -u src tests package/src
git commit -m "verbatimModuleSyntax: mark type-only imports (codemod-import-type)"
```

### Task 7: CI and docs

**Files:**
- Create: `.github/workflows/check-ts-syntax.yml`
- Modify: `.github/workflows/runtime-boundary.yml`, `.claude/rules/typescript/deno-essentials.md`

- [ ] **Step 1: The syntax workflow (Node only, no `configure.sh`)**

`.github/workflows/check-ts-syntax.yml`:

```yaml
# Every .ts file under src/, tests/ and package/src must parse with Node's
# type stripping (no enum, parameter properties, runtime namespaces, <T> casts).
name: TS syntax for Node
on:
  workflow_dispatch:
  pull_request:
    branches: [main]
    paths:
      - "**.ts"
      - "tools/node-bundle/check-ts-syntax*.mjs"
      - ".github/workflows/check-ts-syntax.yml"
  push:
    branches: [main]
    paths:
      - "**.ts"
      - "tools/node-bundle/check-ts-syntax*.mjs"
      - ".github/workflows/check-ts-syntax.yml"

jobs:
  check-ts-syntax:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Repo
        uses: actions/checkout@v6
      - uses: actions/setup-node@v6
        with:
          node-version: "26"
      - name: Unit test of the check
        run: node --test tools/node-bundle/check-ts-syntax.test.mjs
      - name: Parse every .ts file with Node's type stripping
        run: node --no-warnings tools/node-bundle/check-ts-syntax.mjs
```

- [ ] **Step 2: The import-type guard in the boundary job**

In `.github/workflows/runtime-boundary.yml` (PR 02's job; it already runs `configure.sh`), add after the ratchet step:

```yaml
      - name: Type-only imports are marked (verbatimModuleSyntax)
        run: package/dist/bin/quarto run --dev tools/codemod-import-type.ts --check src tests package/src
      - name: Codemod contract tests (tools/codemod)
        run: package/dist/bin/tools/x86_64/deno test --allow-all --import-map=src/import_map.json tools/codemod/
```

(The second step is the one PR 09 also describes; add it only if it is not there yet.)

- [ ] **Step 3: Contributor rules**

In `.claude/rules/typescript/deno-essentials.md`, after "### Always Include `.ts` Extensions", add:

````markdown
### Node-compatible TypeScript

The sources must load under Node's type stripping (CI: `check-ts-syntax.yml`):

- Import types with `type`: `import type { Format } from "../config/types.ts";` or `import { type Format, kTitle } from ...`. `verbatimModuleSyntax` is on, so `deno check` reports TS1484 for an unmarked type import; `quarto run --dev tools/codemod-import-type.ts <dir>` fixes them.
- No `enum`: use `export const X = { A: "a" } as const; export type X = (typeof X)[keyof typeof X];`.
- No constructor parameter properties (`constructor(private x: T)`): declare the field and assign it.
- No `<T>value` assertions: `value as T`. No runtime `namespace`.
````

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/check-ts-syntax.yml .github/workflows/runtime-boundary.yml .claude/rules/typescript/deno-essentials.md
git commit -m "CI: Node type-stripping syntax check and type-only import guard"
```

## Verification

- `node --test tools/node-bundle/check-ts-syntax.test.mjs` → `pass 2`; `node --no-warnings tools/node-bundle/check-ts-syntax.mjs` → `ok: …`, exit 0.
- `package/dist/bin/tools/x86_64/deno test --allow-all --import-map=src/import_map.json tools/codemod/codemod-import-type.test.ts` → `ok | 8 passed | 0 failed`.
- `quarto run --dev tools/codemod-import-type.ts --check src tests package/src` → exit 0.
- `cd src && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --unstable-ffi --import-map=import_map.json quarto.ts` → exit 0.
- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent $(find unit/ -name '*.test.ts')` → `0 failed`; `$(find smoke/ -name '*.test.ts')` in CI on three OSes → green.
- `package/src/quarto-bld prepare-dist` → succeeds; `package/dist/bin/quarto render tests/docs/test.qmd` works.
- `quarto run --dev tools/check-runtime-boundary.ts` → passes, baseline unchanged.
- `node --no-warnings tools/node-bundle/check-ts-syntax.mjs` stays green after a rebase on `main` (the CI workflow runs it on every `.ts` change).

## Review checklist

- [ ] Every enum replacement keeps member names and values; `AccountTokenType` values are 0, 1, 2; `accountSetup` re-export is `export type`.
- [ ] Every converted constructor assigns its former parameter properties first (after `super`), with the same modifiers on the new fields; `RSConnectClient` still normalises `server_`.
- [ ] The import-type tool marks exactly what today's emit drops; the declarations with a dropped default/namespace binding were split, not merged; `import {}` was removed (one site, `src/project/types/website/website-shared.ts:27`).
- [ ] `verbatimModuleSyntax` is in `deno-meta.json`, `deno.jsonc` and `tests/test-conf.json`; `deno.jsonc` was edited by hand, not regenerated.
- [ ] `check-ts-syntax.yml` uses Node 26, needs no `configure.sh`; the `--check` guard runs in the boundary job.
- [ ] No runtime behaviour change: `git diff` outside the enum/constructor files contains only `type` markers, `import type`, the split declarations and `deno fmt` reflow.

## Risks and rollback

- A binding wrongly marked `type` would be erased while still used as a value. Not possible by construction (the tool only marks what today's emit already drops, and the type checker rejects a value use of a type-only import), but if a smoke test fails with `X is not defined`, remove the marker in that file and report the case on the PR.
- Import-cycle or evaluation-order changes: none, because the set of modules Deno evaluates is unchanged (Deno still elides at runtime under `--no-config`, and the markers only make that elision explicit). Under Node this is what makes the graph identical to Deno's.
- `verbatimModuleSyntax` not honoured by the Deno in use (Task 6 step 2 prints 0): the `--check` CI step still blocks regressions; PR 00a's Deno bump is expected to honour it.
- Conflicts: this PR touches ~500 import blocks; land it early (right after PR 02) and resolve later conflicts by re-running the tool on the conflicted file.
- Rollback: revert the commits; nothing persistent changes.

## Decisions needed

None. Decided in this plan:
- The marking rule is "bindings today's emit drops", a superset of the review's "symbols declared only as interfaces/type aliases" that also keeps the module graph unchanged (class-as-type imports).
- The syntax check lives at `tools/node-bundle/check-ts-syntax.mjs` (the path PR 31 already uses), runs in its own Node-only workflow, and covers `src`, `tests` and `package/src` (`package/src` has no offending syntax; including it keeps PR 33's build tooling strip-clean).
- `deno.jsonc` is hand-edited in sync with `deno-meta.json` rather than regenerated.
