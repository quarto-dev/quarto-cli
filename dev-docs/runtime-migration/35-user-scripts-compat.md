# PR 35: `quarto run` and project scripts run on Node by default (`stdlib/*`, TypeScript transform, Deno shim)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `quarto run script.ts` and project `pre-render`/`post-render` `.ts`/`.js` scripts run on the bundled Node by default, with the 34 `stdlib/*` imports served from bundles in `share/run-stdlib/` (what is supported, for how long and with which fallback is the supported migration surface matrix in the Spec; `stdlib/log`'s `FileHandler` and `stdlib/http`'s file server are not available on Node), TypeScript compiled per file by Quarto's esbuild (so type-only imports, enums and parameter properties work as on Deno), and a deprecated `Deno` global shim installed only for scripts that use it; `QUARTO_RUN_RUNTIME=deno` or the project key `project: script-runtime: deno` runs them on the Deno tool (bundled until PR 37, `quarto install deno` afterwards).
**Phase:** 3. **Depends on:** PR 33 (Node CLI; `denoToolBinary()`/`requireDenoToolBinary()`, `quarto install deno`; `tools/node-bundle/build.mjs`), PR 31 (`tools/node-bundle/register-import-map.mjs`), PR 00c (the `quarto run` deprecation notice this PR replaces). **Unblocks:** PR 37.
**Branch:** `rt/35-user-scripts-compat`.
**Suggested executor:** Opus. The module hooks, the shim and its messages, and the runtime-selection policy are user-facing contracts.
**Size:** L (about 30 files: run handlers, project plumbing and schema, `register.cjs`, `deno-shim.cjs`, the `tools/run-stdlib/` builder with its own `package.json`, `prepare-dist`/`configure` wiring, five test files and fixtures, changelog, docs).
**Ships on:** Node. Gates: PR 32 matrix, `tests/smoke/run/`, `tests/smoke/project/project-prepost.test.ts` (fixtures unchanged), the new tests below, the boundary-ratchet workflow (`quarto run --dev` now on Node).

## Spec

### Context

Assessment section 6 ("Users who write TypeScript scripts for Quarto: the main compatibility break"), review S2 and the PR 35 findings, decisions 1 and 2. Since PR 33 the CLI runs on Node, but `src/core/run/deno.ts` still runs every `.ts`/`.js` script on the Deno tool (`requireDenoToolBinary()`), with `--allow-all`, the `stdlib/*` import map `src/resources/deno_std/run_import_map.json` and a `DENO_DIR` seeded from `share/deno_std/cache`. PR 00c (1.11) prints a one-time notice there that scripts will move to Node. This PR makes Node the default (1.12) and keeps Deno one setting away.

`src/resources/deno_std/run_import_map.json` has **34** entries (counted with `python3 -c "import json;print(len(json.load(open('src/resources/deno_std/run_import_map.json'))['imports']))"`): 26 `jsr:/@std/<pkg>@0.224.x` targets, 7 `https://deno.land/std@0.224.0/{encoding,fmt}/*.ts` targets and `stdlib/juice` -> `https://cdn.skypack.dev/juice@10.0.0`.

Verified facts this plan relies on:

- Node 26's `module.registerHooks({ resolve, load })` (synchronous, in-thread) is Stability 1.2; `module.register` is deprecated (DEP0205). A `--require`d CommonJS file can call it before the entry module loads.
- Node's type stripping does **not** elide type-only imports. Reproduced on Node 22.22: `import { Foo, x } from "./types.ts"` where `Foo` is an interface fails with `SyntaxError: The requested module './types.ts' does not provide an export named 'Foo'`. Deno scripts write this form constantly (Deno's transpiler elides it). Type stripping also rejects `enum`, parameter properties and runtime `namespace` (`ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX`). This plan therefore does not use type stripping for scripts: the `load` hook compiles each local `.ts` file with the esbuild binary Quarto ships (`esbuild --loader=ts`, which elides imports only used as types and supports `enum` and parameter properties), with an inline source map so stack traces point at the user's file. Residual: `export { T } from "./x.ts"` re-exporting a type cannot be elided by a per-file compiler (Deno has the same limitation); scripts write `export type { T }`.
- A `.ts`/`.js` script whose nearest `package.json` says `"type": "commonjs"` fails with `Warning: Failed to load the ES module: <file>. Make sure to set "type": "module" in the nearest package.json file or use the .mjs extension.` followed by `SyntaxError: Cannot use import statement outside a module` (reproduced). Deno ignored `package.json`. The `load` hook returns `format: "module"` for local files that contain `import`/`export` statements, whatever `package.json` says.
- `@std/fs@0.224.0` and `@std/path@0.224.0` exist on `npm.jsr.io` as `@jsr/std__fs` and `@jsr/std__path`, as do all other pinned 0.224 versions of `run_import_map.json`, plus `@jsr/std__encoding@0.224.0`, `@jsr/std__fmt@0.224.0`, and `juice@10.0.0` on npm (checked 2026-10-15). `@std/fs@0.224` calls `Deno.*` for everything (`Deno.stat`, `lstat`, `readDir`, `mkdir`, `remove`, `copyFile`, `rename`, `realPath`, `readLink`, `symlink`, `errors.NotFound`); the member table (`deno-members.cjs`, Interfaces) implements exactly those, so `stdlib/fs` keeps its full API (`exists`, `ensureFile`, `ensureSymlink`, `move`, `emptyDir`, `walk`, `expandGlob`, `copy`) instead of the subset `src/deno_ral/fs.ts` would offer. `@std/path@0.224` is plain JavaScript (`parse`, `format`, `common`, `SEPARATOR`, `win32`, `posix` complete).
- Libraries feature-detect Deno (`@std/fmt/colors@0.224`: `typeof Deno?.noColor === "boolean" ? Deno.noColor : false` at module level; Cliffy's runtime branches). A shim that throws on unknown members breaks their import, and a `Deno` global at all makes some npm packages take their Deno code path. Hence: the shim is installed only when a local module contains `Deno.` (the `stdlib/*` bundles carry a module-local `Deno` binding, Decision 3, and never install the global), and unknown members return `undefined`.
- The in-repo fixtures `tests/docs/project/prepost/extension/_extensions/author/prerender/pre-render.ts`, `tests/docs/project/prepost/invalid-mutate/pre.ts` and `tests/docs/project/prepost/script-env-vars/check-env.ts` use `Deno.statSync`, `Deno.errors.NotFound`, `Deno.writeTextFileSync`, `Deno.removeSync`, `Deno.env.get`, `Deno.cwd`, `stdlib/path`, `stdlib/fs`. They stay unchanged: they are the shim's regression tests.

Assumptions about earlier PRs:

- PR 33: `src/tools/impl/deno-paths.ts` (`requireDenoToolBinary`), `quarto install deno`, the bundled Deno tool in `bin/tools/<arch>/` (until PR 37); `src/core/run/deno.ts` calls `requireDenoToolBinary("Running a TypeScript script")`; launchers restore the user's `NODE_OPTIONS` for children (so scripts see it).
- PR 31: `tools/node-bundle/register-import-map.mjs` registers a resolve hook that maps `src/import_map.json` names to `node_modules` (used here for `quarto run --dev`).
- PR 00c: the Deno handler prints a one-time notice silenced by `QUARTO_RUN_DENO_NOTICE=0` (`grep -rn QUARTO_RUN_DENO_NOTICE src` finds it).
- PR 14/08: `env` in `src/deno_ral/`; `architectureToolsPath("esbuild")` honours `QUARTO_ESBUILD` and `architectureToolsPath("node")` honours `QUARTO_NODE` (PR 33 launcher contract). The Node that runs a script is `architectureToolsPath("node")`, never `execPath()`: under PR 33's `QUARTO_RUNTIME=deno` the CLI's own executable is the Deno tool (review R08). The supported CLI × script runtime combinations are PR 33's table "Dual-runtime combinations until PR 37".

### Supported migration surface (review decision 1; triage A1 and A2)

**Owned by this plan; PRs 00c, 34, 36 and 37 refer here** (00c for the notice and the migration page it names, 34 for `docs-updates.md`, 36 for the engine rows and the default import map, 37 for what it retires). Release timeline behind the columns: 1.11 ships on Deno with PR 00c's notice; 1.12 ships on Node (PRs 33–36) with Deno still bundled as a tool; 1.13 stops bundling Deno (PR 37; `quarto install deno`). Rows 4–6 and the two tables after the matrix are published on `https://quarto.org/docs/projects/scripts-deno-to-node.html` (created by PR 00c for 1.11; Task 7 fills in the 1.12 content); rows 2–3 on `https://quarto.org/docs/extensions/engine.html#migrating-from-deno` (PR 36); both pages are rows of PR 34's `docs-updates.md`.

| # | Surface | 1.11 (Deno) | 1.12 and later (Node) | Author action | Fallback | Retirement |
|---|---|---|---|---|---|---|
| 1 | **Internal API**: anything imported from Quarto's own tree (`src/`, `src/deno_ral/`, `tools/`, the CLI bundle) | never supported; reachable only through `quarto run --dev` (repository tooling) | unchanged: the Node bundle exports nothing and `quarto run --dev` stays internal | none; engines use `QuartoAPI` (row 3), scripts use the `quarto` CLI | none | n/a |
| 2 | **Prebuilt engines**: `.js` bundles built with `quarto call build-ts-extension` on Quarto 1.9–1.11 and loaded in-process (`src/execute/engine.ts`) | supported | loaded on Node; one warning per bundle naming its `Deno.<member>` references (PR 36 Task 3); a `Deno.*` call fails when executed (`ReferenceError`); a bundle that references no `Deno.` member keeps loading and running | rebuild with 1.12's `build-ts-extension` (row 3) | stay on 1.11 until rebuilt; `QUARTO_RUNTIME=deno` during the 1.12 prerelease dual-runtime window, only if Spike #2 passed (PR 33 Task 13; triage A4) | the warning has no removal date; `QUARTO_RUNTIME` goes with PR 37 (1.13) |
| 3 | **Rebuilt engines**: sources bundled with 1.12's `build-ts-extension` (esbuild) | n/a | `QuartoAPI` plus web-standard globals (PR 36, "Runtime contract"); the default import map resolves on Node: `path`, `path/posix` → `@jsr/std__path` and `encoding/` → `@jsr/std__encoding` (both plain JavaScript), `log`, `log/` → `@quarto/std-log` and `fs/` → `@quarto/std-fs`, Node-compatible packages built by this plan's builder (A1(b); PR 36 Decisions 3 and 4); `Deno.*` unavailable; `log`'s `FileHandler` unsupported: the build fails naming it (A1(a)) | replace `Deno.*` with `QuartoAPI` or web standards, `FileHandler` with `node:fs` or a console handler, `deno.json` with `package.json` `quarto.build` | as row 2 | `deno.json` read with a warning in 1.12, ignored from 1.13 (PR 37) |
| 4 | **Plain scripts**: `.ts`/`.js`/`.mjs`/`.mts` run by `quarto run`, `pre-render`/`post-render` or `ipynb-filters`, using web-standard globals, `node:` built-ins and relative imports | Deno, with PR 00c's notice | Node by default; TypeScript compiled per file by esbuild (type-only imports, `enum`, parameter properties as on Deno); a `"type": "commonjs"` `package.json` next to the script is ignored | none for such code; `export type { T }` for re-exported types; `npm:`/`jsr:` imports need `npm install` in the project (version rule below); `https:` imports: copy the module or install the package | `QUARTO_RUN_RUNTIME=deno` or `project: script-runtime: deno` (Deno bundled in 1.12; `quarto install deno` from 1.13) | the Deno path stays as long as `quarto install deno` exists (no date; Decision 1) |
| 5 | **`stdlib/*` scripts**: scripts importing any of the 34 `stdlib/<name>` modules of `run_import_map.json` | Deno std 0.224 through the import map | the same 34 names, served from `share/run-stdlib/` bundles at the same 0.224 pins; each bundle carries its own `Deno` binding (Decision 3) and never installs the global shim; every member works except those in the table below | none for supported members; for the unsupported ones `node:fs`/`node:http`, or the Deno fallback | as row 4 | kept beyond 1.13 (Decision 2); the 0.224 pins are frozen |
| 6 | **Deno-native scripts**: scripts calling `Deno.*`, importing `https://` URLs, or relying on Deno's module cache | Deno, with the notice | the `Deno.*` members of the member table (`deno-members.cjs`, Interfaces) run through the deprecated global shim, one notice per process; other members are `undefined` and named in the exit hint; `https:` imports fail with a message; `npm:`/`jsr:` resolve from `node_modules` | migrate to `node:` APIs (the migration table of Task 7's docs row), or opt into the Deno runtime | `QUARTO_RUN_RUNTIME=deno` or `script-runtime: deno` | shim kept through 1.13, removal decided then from issue reports (Decision 1); Deno not bundled from 1.13 (`quarto install deno`) |

**`stdlib/*` members not available on Node** (A1(a)). Every other member of the 34 modules is served. The builder's member gate (Task 1 step 4) fails the build when a bundle reaches a `Deno` member that `deno-members.cjs` does not provide, so this table is complete by construction and grows only with a plan change.

| Module | Member | Needs | On Node |
|---|---|---|---|
| `stdlib/log`; the engine map's `log`, `log/` | `FileHandler`, `RotatingFileHandler` | `Deno.openSync` and an `FsFile` | replaced in the bundle by a stub that throws `FileHandler is not available when Quarto runs on Node.js` at construction (`tools/run-stdlib/stdlib/unsupported.ts`); an engine build whose output contains the stub's marker fails (PR 36 `bundle()`) |
| `stdlib/http` | `serveDir`, `serveFile` (the file server) | `Deno.open`, `Deno.serve` | the same stub; `node:http` instead |
| `stdlib/permissions` | `grant`, `grantOrThrow` | `Deno.permissions`, which has no Node meaning | the local stub grants every request |
| `stdlib/io` and `stdlib/streams` readers | `Deno.stdin` passed in by the script | `Deno.stdin` is not in the member table | `process.stdin`; the script's `Deno.stdin` access is `undefined` and named in the exit hint |

**Version rule for `npm:` and `jsr:` specifiers (A2 (a)).** A version in a specifier (`npm:left-pad@1.3.0`, `jsr:@std/path@^1`) pins nothing on Node: the specifier resolves as its package name plus subpath, and the governing lockfile below decides what is installed. When the installed version does not satisfy the requested one, Quarto prints one warning per package and requested version, naming the importing file, the requested version and the installed one, and continues. The forms checked are `1`, `1.2`, `1.2.3`, `^1.2.3` and `~1.2.3` (with an optional leading `v`); any other range form is not checked. Implemented in `register.cjs` for scripts (Task 2, `checkVersion`) and in PR 36's `bundle()` for the engine import map (`versionMismatches` plus one warning per entry, same forms; PR 36 Decision 4), documented on both pages above.

| What resolves | Governing lockfile | Changed by |
|---|---|---|
| `stdlib/<name>` in scripts | `tools/run-stdlib/package-lock.json` (the 0.224 pins of `run_import_map.json`; frozen) | Quarto only |
| `npm:`/`jsr:` and bare specifiers in scripts | the nearest `package.json`/`package-lock.json` above the importing file (its `node_modules`) | the script author (`npm install`) |
| the default engine map: `log`, `log/`, `fs/` | the repository's root `package-lock.json` (the versions of `src/import_map.json`, which is what 1.11's map resolved to; PR 36 Decision 4), bundled into `share/extension-build/node_modules/@quarto/` | Quarto only |
| the default engine map: `path`, `path/posix`, `encoding/` | the root `package-lock.json`; packages copied to `share/extension-build/node_modules/@jsr/` (PR 36 Task 2) | Quarto only |
| an engine's own `imports` (`deno.json`) and bare imports | the extension's `package.json`/lockfile (`node_modules` next to the entry point) | the engine author |

### Scope

In:
- `src/core/run/typescript.ts` (new) handles `.ts`, `.js`, `.mjs`, `.mts`; `src/core/run/deno.ts` becomes the explicit Deno-tool path; `src/core/run/register.ts`; `RunHandlerOptions.runtime`.
- Runtime selection: `QUARTO_RUN_RUNTIME` env var, project key `project.script-runtime` (schema), default `node`.
- `src/resources/run-compat/register.cjs` (resolve + load hooks, the version rule), `src/resources/run-compat/deno-members.cjs` (the member table), `src/resources/run-compat/deno-shim.cjs` (the global shim over it); `run_import_map.json` moves to `src/resources/run-compat/deno/`.
- `tools/run-stdlib/` (own `package.json`, lockfile, `.npmrc`, `manifest.json` with 34 entries, `build.mjs` with the `Deno` binding injection, the unsupported-member stubs and the member gate, `stdlib/permissions.ts`, `stdlib/deno-binding.js`, `stdlib/unsupported.ts`); output `src/resources/run-stdlib/` (dev, gitignored) and `share/run-stdlib/` (dist). `build.mjs` also takes `--manifest`, `--modules-from` and `--packages`, which PR 36 uses for the `@quarto/std-<name>` packages of the engine import map (PR 36 Task 2; no engine package is built by this PR). Contract of `--packages` (PR 36 relies on it): one package per manifest entry at `<outdir>/@quarto/std-<name>/` with `package.json` (`exports` `.` and `./*` to the one bundle, `types`), `<name>.js` and `index.d.ts`; the bundle is self-contained (the member table is bundled in through `stdlib/deno-binding-inline.js`, `node:*` stays external) so the esbuild CLI can bundle it again into an engine file; its text contains no `Deno.`; the member gate and the unsupported-member stubs apply as for `share/run-stdlib`.
- `quarto run --dev` on Node (import-map hook + this PR's hooks).
- Removal of PR 00c's Deno-side notice; the shim's notice replaces it.
- The `resources` rows of PR 25's runtime residue table that this PR owns (Task 6): `src/resources/scripts/juice.ts` and `src/resources/tools/ast-diagram/main.ts` on Node APIs, `check-usage.ts`/`.sh` deleted, `make-ast-diagram` through the script run handler; `tools/*.ts` that break under `quarto run --dev` on Node (row 16).
- Changelog, `src/command/run/run.ts` help text, `dev-docs/runtime-migration/docs-updates.md` row.

Out:
- `quarto install deno` and `denoToolBinary()` (PR 33). Deleting `src/resources/deno_std/`, `share/deno_std`, `initDenoCache` (PR 37; the Deno path keeps its offline cache until then). `build-ts-extension` (PR 36).
- Rewriting the in-repo fixtures. Publishing the stdlib bundles to a registry.

### Interfaces

```ts
// src/core/run/types.ts (extended)
export interface RunHandlerOptions {
  cwd?: string;
  env?: { [key: string]: string };
  stdout?: "inherit" | "piped" | "null";
  dev?: boolean;
  /** Runtime for .ts/.js scripts; QUARTO_RUN_RUNTIME overrides it. */
  runtime?: ScriptRuntime;
}
export type ScriptRuntime = "node" | "deno";
```

```ts
// src/core/run/typescript.ts
import { RunHandler, ScriptRuntime } from "./types.ts";
/** QUARTO_RUN_RUNTIME (if set) > `requested` (project key) > "node". Throws on any other value. */
export function selectScriptRuntime(requested: ScriptRuntime | undefined, environment: Record<string, string | undefined>): ScriptRuntime;
/** .ts/.js/.mjs/.mts on Node, or on the Deno tool when selectScriptRuntime() says deno. */
export const typescriptRunHandler: RunHandler;
```

```ts
// src/project/types.ts
export const kProjectScriptRuntime = "script-runtime";
```

`_quarto.yml`:

```yaml
project:
  pre-render: prepare.ts
  script-runtime: deno   # node (default) | deno; needs Deno: bundled until 1.13, else `quarto install deno`
```

Environment read by `quarto run` / project scripts:

| Variable | Meaning |
|---|---|
| `QUARTO_RUN_RUNTIME` | `node` or `deno`; overrides `project.script-runtime`; any other value is an error. Independent of PR 33's `QUARTO_RUNTIME` (the CLI's runtime): see PR 33, "Dual-runtime combinations until PR 37" |
| `QUARTO_NODE` | the Node binary scripts run on (`architectureToolsPath("node")`; PR 33 launcher contract); default the bundled `tools/<arch>/node[.exe]` |
| `QUARTO_RUN_DENO_NOTICE` | `0` silences the shim's one-time notice (same variable PR 00c introduced for the Deno-side notice) |
| `QUARTO_RUN_NO_NETWORK` | Deno path: `--cached-only` (unchanged). Node path: no effect (Node never downloads modules) |
| `QUARTO_DENO` | locates the Deno tool (PR 33) |

Set by Quarto for a Node script process: `QUARTO_RUN_STDLIB_DIR` (absolute path of `run-stdlib/`), `QUARTO_RUN_ESBUILD` (esbuild binary), plus what `execProcess` already passes.

Node command line:

```
<architectureToolsPath("node")> --require <share>/run-compat/register.cjs --enable-source-maps --enable-experimental-regexp-engine
  --stack-trace-limit=100 --use-system-ca --use-env-proxy --disable-warning=MODULE_TYPELESS_PACKAGE_JSON <script> <args...>
```

`--dev` adds `--import <root>/tools/node-bundle/register-import-map.mjs` before `--require` (repository tooling imports `src/` through `src/import_map.json`).

`register.cjs` resolve hook:

| Specifier | Resolution |
|---|---|
| `stdlib/<name>` (34 names) | `file://$QUARTO_RUN_STDLIB_DIR/<name>.js`; unknown name: error listing the names |
| `npm:<pkg>[@ver][/sub]` | `nextResolve("<pkg>[/sub]")` from the importer (project `node_modules`); failure: "run `npm install <pkg>` in <dir>"; with `@ver`, one warning when the installed version does not satisfy it (the version rule) |
| `jsr:[/]@<scope>/<name>[@ver][/sub]` | `nextResolve("@jsr/<scope>__<name>[/sub]")`; failure adds the `.npmrc` line; `@ver` checked the same way |
| `https://deno.land/std@…/<mod>/…` | error naming `stdlib/<mod>` when it exists |
| other `http(s):` | error: remote imports are not supported on Node |
| anything else | `nextResolve` unchanged |

`register.cjs` load hook, for `file:` URLs outside `node_modules` and outside `$QUARTO_RUN_STDLIB_DIR` (the bundles are Quarto's and are loaded as they are):
- `.ts`/`.mts`: esbuild-compiled (`--loader=ts --format=esm --target=node26 --sourcemap=inline --sourcefile=<path> --tsconfig-raw={}`), returned as `format: "module"`.
- `.js`/`.mjs` that Node classifies as CommonJS but that contain top-level `import`/`export`: returned as `format: "module"`.
- Any module whose source contains `Deno.` installs the shim (once), before evaluation.

`deno-members.cjs` exports `members`, the table below, implemented on `node:fs`, `node:child_process` and `process` with Deno's error classes and no notice; it serves two consumers: `deno-shim.cjs` installs `globalThis.Deno` as a Proxy over it that prints the notice once per process on the first access of any member unless `QUARTO_RUN_DENO_NOTICE=0`, and every `stdlib/*` bundle references it as a module-local `Deno` binding (Task 1; Decision 3). The members:

`readTextFile(Sync)`, `readFile(Sync)`, `writeTextFile(Sync)`, `writeFile(Sync)`, `stat(Sync)`, `lstat(Sync)`, `mkdir(Sync)`, `remove(Sync)`, `readDir(Sync)`, `copyFile(Sync)`, `rename(Sync)`, `realPath(Sync)`, `readLink(Sync)`, `symlink(Sync)`, `link(Sync)`, `utime(Sync)`, `makeTempDir(Sync)`, `cwd`, `chdir`, `uid`, `gid`, `permissions` (`query`, `querySync`: always `granted`), `env` (`get`, `set`, `delete`, `has`, `toObject`), `args`, `exit`, `execPath`, `pid`, `noColor`, `inspect` (`node:util`; `stdlib/fmt_printf` uses it for `%i`/`%I`), `Command` (`output()`, `outputSync()`, `spawn()`), `errors` (`NotFound`, `AlreadyExists`, `PermissionDenied`, `NotSupported`), `build` (`os`, `arch`), `version` (`deno: "compat"`, `node`, `v8`).

`readLink(Sync)` and `symlink(Sync)` go beyond the review's list because `@std/fs@0.224`'s `copy`, `walk` and `ensureSymlink` call them; `link(Sync)`, `utime(Sync)`, `uid`, `gid`, `permissions.query(Sync)` and `errors.NotSupported` are there because `@std/fs@1.0.16`, the version the default engine import map resolves to (PR 36 Decision 4), reaches them from `ensureLink`, `copy` (`preserveTimestamps`), `exists` (`isReadable`) and `move` (listed from the package on `npm.jsr.io`, 2026-10-16; the member gate of Task 1 step 4 re-checks it on every build). Through the shim, every other member returns `undefined` (so `typeof Deno.x` feature detection works); the notice is printed on that first access too, and if the process exits with a non-zero code after touching unsupported members, one line names them with their Node equivalent.

Deprecation timeline (changelog and docs): 1.11 scripts run on Deno with a notice (PR 00c); 1.12 scripts run on Node, `stdlib/*` kept, the `Deno` shim prints a notice, `QUARTO_RUN_RUNTIME=deno`/`script-runtime: deno` keep the Deno behaviour; 1.13 Deno is no longer bundled (`quarto install deno`), shim removal is decided then (Decisions needed).

### Files

- Create: `src/core/run/typescript.ts`, `src/resources/run-compat/register.cjs`, `src/resources/run-compat/deno-members.cjs`, `src/resources/run-compat/deno-shim.cjs`, `tools/run-stdlib/package.json`, `tools/run-stdlib/package-lock.json`, `tools/run-stdlib/.npmrc`, `tools/run-stdlib/manifest.json`, `tools/run-stdlib/build.mjs`, `tools/run-stdlib/stdlib/permissions.ts`, `tools/run-stdlib/stdlib/deno-binding.js`, `tools/run-stdlib/stdlib/deno-binding-inline.js`, `tools/run-stdlib/stdlib/unsupported.ts`
- Move: `src/resources/deno_std/run_import_map.json` -> `src/resources/run-compat/deno/run_import_map.json`
- Modify (Task 6): `src/resources/scripts/juice.ts`, `src/resources/tools/ast-diagram/main.ts`, `src/command/dev-call/make-ast-diagram/cmd.ts`, `tools/runtime-boundary-baseline.json`; Delete: `src/resources/scripts/check-usage.ts`, `src/resources/scripts/check-usage.sh`
- Modify: `src/core/run/deno.ts` (import map path; 00c notice removed), `src/core/run/types.ts`, `src/core/run/register.ts`, `src/command/run/run.ts:52-56`, `src/command/render/project.ts` (lines 333, 855, 914-933, 935-1000), `src/project/types.ts:47-48`, `src/resources/schema/project.yml:44-51`, `package/src/common/configure.ts`, `package/src/common/prepare-dist.ts`, `package/src/common/previewjs.ts` (`buildRunStdlib`), `.gitignore`, `news/changelog-1.12.md`, `dev-docs/runtime-migration/docs-updates.md`
- Regenerate: `src/resources/schema/json-schemas.json`, `src/resources/types/` (via `quarto dev-call build-artifacts`)
- Test: `tests/unit/run-stdlib-manifest.test.ts`, `tests/unit/run-compat-hooks.test.ts`, `tests/unit/run-compat-shim.test.ts`, `tests/unit/run-runtime-select.test.ts`, `tests/smoke/run/run-script-node.test.ts`, `tests/smoke/project/project-script-runtime.test.ts` with fixture `tests/docs/project/prepost/script-runtime-deno/` (`_quarto.yml`, `index.qmd`, `which.ts`)

### Acceptance criteria

- `share/run-stdlib/` in a `prepare-dist` output holds 34 `.js` files, a `package.json` (`{ "type": "module" }`) and a copy of `deno-members.cjs`, no `.map`; `share/run-compat/` holds `register.cjs`, `deno-members.cjs`, `deno-shim.cjs`, `deno/run_import_map.json`.
- `node tools/run-stdlib/build.mjs --outdir src/resources/run-stdlib --force` prints, per bundle, the `Deno` members it reaches, every one of them in `deno-members.cjs` (the member gate; the PR description pastes the report), and no bundle's text contains `Deno.` (`rg -c '\bDeno\.' src/resources/run-stdlib` prints nothing: the binding is module-local).
- A script that imports `stdlib/fs` or `stdlib/fmt_colors` and never mentions `Deno` sees `typeof Deno === "undefined"`; `new FileHandler(...)` from `stdlib/log` throws `FileHandler is not available when Quarto runs on Node.js`; `import "npm:left-pad@^1.3.0"` with `left-pad` 1.2.0 installed prints one warning naming the file, `npm:left-pad@^1.3.0` and `1.2.0`, and runs (`tests/unit/run-compat-hooks.test.ts`).
- `tests/smoke/run/run-script.test.ts`, `stdlib-run-version.test.ts` (`stdlib/io` `readLines`), `command-passthrough.test.ts` pass with the scripts running on Node.
- `tests/smoke/project/project-prepost.test.ts` passes with its fixtures unchanged; the render log contains the shim notice at most once per script process.
- A script that imports a type without `import type` (`import { Foo, x } from "./types.ts"`), one with an `enum`, and one next to a `"type": "commonjs"` `package.json` all run (`tests/unit/run-compat-hooks.test.ts`).
- `typeof Deno.noColor` and `typeof Deno.openKv` do not throw in a script that also uses `Deno.cwd()`; a script that never mentions `Deno` sees `typeof Deno === "undefined"`.
- `QUARTO_RUN_RUNTIME=deno quarto run x.ts` and `project: script-runtime: deno` run on the Deno tool (`navigator.userAgent` starts with `Deno/`); with no Deno available they fail with `Running a TypeScript script needs Deno, which is not installed. Run 'quarto install deno'.`
- `quarto run --dev tools/check-runtime-boundary.ts` runs on Node; the `resources` scope falls from PR 25's 11 `Deno.` / 1 std file to 1 / 0 (the engine template, PR 36's row of the residue table), every other count unchanged; `rg -n '\bDeno\.' src/resources/scripts src/resources/tools` prints nothing.
- A Typst render with a raw HTML table (`astpipeline.lua` runs `quarto run juice.ts`) succeeds with no shim notice in its log; `package/dist/bin/quarto dev-call make-ast-diagram <qmd>` produces the same HTML diagram as on `main`.

## Plan

### Task 1: The stdlib manifest, the member table and the builder (`tools/run-stdlib/`)

**Files:**
- Create: `tools/run-stdlib/package.json`, `tools/run-stdlib/.npmrc`, `tools/run-stdlib/manifest.json`, `tools/run-stdlib/stdlib/permissions.ts`, `tools/run-stdlib/stdlib/unsupported.ts`, `tools/run-stdlib/stdlib/deno-binding.js`, `tools/run-stdlib/stdlib/deno-binding-inline.js`, `src/resources/run-compat/deno-members.cjs`, `tools/run-stdlib/build.mjs`
- Move: `src/resources/deno_std/run_import_map.json` -> `src/resources/run-compat/deno/run_import_map.json`
- Modify: `.gitignore`
- Test: `tests/unit/run-stdlib-manifest.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
/*
 * run-stdlib-manifest.test.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 */
import { unitTest } from "../test.ts";
import { assert, assertEquals } from "../asserts.ts";
import { join } from "../../src/deno_ral/path.ts";
import { existsSync, readTextFileSync } from "../../src/deno_ral/fs.ts";
import { env } from "../../src/deno_ral/env.ts";

const root = env.get("QUARTO_ROOT")!;

unitTest("run-stdlib manifest covers exactly the 34 names of the Deno import map", () => {
  const manifest = JSON.parse(readTextFileSync(join(root, "tools", "run-stdlib", "manifest.json"))) as Record<string, string>;
  const denoMap = JSON.parse(
    readTextFileSync(join(root, "src", "resources", "run-compat", "deno", "run_import_map.json")),
  ).imports as Record<string, string>;
  const names = Object.keys(denoMap).map((k) => k.replace(/^stdlib\//, "")).sort();
  assertEquals(names.length, 34);
  assertEquals(Object.keys(manifest).sort(), names);
  const pkg = JSON.parse(readTextFileSync(join(root, "tools", "run-stdlib", "package.json")));
  for (const [name, entry] of Object.entries(manifest)) {
    if (entry.startsWith("./")) {
      assert(existsSync(join(root, "tools", "run-stdlib", entry)), `${name}: ${entry} missing`);
    } else {
      const p = entry.startsWith("@") ? entry.split("/").slice(0, 2).join("/") : entry.split("/")[0];
      assert(pkg.dependencies[p], `${name}: ${p} missing from tools/run-stdlib/package.json`);
    }
  }
});

unitTest("run-stdlib bundles exist after quarto-bld configure", () => {
  const dir = join(root, "src", "resources", "run-stdlib");
  for (const name of ["path", "fs", "fmt_colors", "juice", "permissions"]) {
    assert(existsSync(join(dir, `${name}.js`)), `${name}.js missing: run quarto-bld configure`);
  }
  assertEquals(JSON.parse(readTextFileSync(join(dir, "package.json"))).type, "module");
  assert(existsSync(join(dir, "deno-members.cjs")), "the bundles' Deno binding needs deno-members.cjs next to them");
  assert(!existsSync(join(dir, "path.js.map")));
  // the binding is module-local: no bundle mentions the global
  assert(!readTextFileSync(join(dir, "fs.js")).includes("Deno."));
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/run-stdlib-manifest.test.ts`
Expected: FAIL, `tools/run-stdlib/manifest.json` not found.

- [ ] **Step 3: Move the Deno import map; write the manifest**

```bash
mkdir -p src/resources/run-compat/deno tools/run-stdlib/stdlib
git mv src/resources/deno_std/run_import_map.json src/resources/run-compat/deno/run_import_map.json
```

`tools/run-stdlib/manifest.json` (key = `stdlib/<key>`; value = module specifier resolved from `tools/run-stdlib/node_modules`, or a local file):

```json
{
  "tar": "@jsr/std__archive/tar",
  "async": "@jsr/std__async",
  "bytes": "@jsr/std__bytes",
  "collections": "@jsr/std__collections",
  "crypto": "@jsr/std__crypto",
  "datetime": "@jsr/std__datetime",
  "dotenv": "@jsr/std__dotenv",
  "ascii85": "@jsr/std__encoding/ascii85",
  "base32": "@jsr/std__encoding/base32",
  "base58": "@jsr/std__encoding/base58",
  "base64": "@jsr/std__encoding/base64",
  "base64url": "@jsr/std__encoding/base64url",
  "csv": "@jsr/std__csv",
  "front_matter": "@jsr/std__front-matter",
  "hex": "@jsr/std__encoding/hex",
  "jsonc": "@jsr/std__jsonc",
  "toml": "@jsr/std__toml",
  "varint": "@jsr/std__encoding/varint",
  "yaml": "@jsr/std__yaml",
  "flags": "@jsr/std__flags",
  "fmt_bytes": "@jsr/std__fmt/bytes",
  "fmt_colors": "@jsr/std__fmt/colors",
  "fmt_printf": "@jsr/std__fmt/printf",
  "fs": "@jsr/std__fs",
  "http": "@jsr/std__http",
  "io": "@jsr/std__io",
  "log": "@jsr/std__log",
  "mediaTypes": "@jsr/std__media-types",
  "path": "@jsr/std__path",
  "permissions": "./stdlib/permissions.ts",
  "semver": "@jsr/std__semver",
  "streams": "@jsr/std__streams",
  "uuid": "@jsr/std__uuid",
  "juice": "juice"
}
```

That is 34 keys, the same as `run_import_map.json`. `fs` and `path` are the 0.224 JSR packages (full API), not `src/deno_ral/`. `permissions` stays a local stub because `@std/permissions@0.224` calls `Deno.permissions`, which has no Node meaning.

`tools/run-stdlib/package.json` (versions = the pins of `run_import_map.json`; the seven `deno.land/std@0.224.0` URLs map to `@std/encoding@0.224.0` and `@std/fmt@0.224.0`, the JSR releases of the same std version; all verified on `npm.jsr.io`/npm 2026-10-15):

```json
{
  "name": "quarto-run-stdlib-build",
  "private": true,
  "description": "Build-time inputs of share/run-stdlib (stdlib/* for quarto run scripts); never shipped as is",
  "dependencies": {
    "@jsr/std__archive": "0.224.3",
    "@jsr/std__async": "0.224.2",
    "@jsr/std__bytes": "0.224.0",
    "@jsr/std__collections": "0.224.2",
    "@jsr/std__crypto": "0.224.0",
    "@jsr/std__csv": "0.224.3",
    "@jsr/std__datetime": "0.224.5",
    "@jsr/std__dotenv": "0.224.2",
    "@jsr/std__encoding": "0.224.0",
    "@jsr/std__flags": "0.224.0",
    "@jsr/std__fmt": "0.224.0",
    "@jsr/std__front-matter": "0.224.3",
    "@jsr/std__fs": "0.224.0",
    "@jsr/std__http": "0.224.5",
    "@jsr/std__io": "0.224.8",
    "@jsr/std__jsonc": "0.224.3",
    "@jsr/std__log": "0.224.7",
    "@jsr/std__media-types": "0.224.1",
    "@jsr/std__path": "0.224.0",
    "@jsr/std__semver": "0.224.3",
    "@jsr/std__streams": "0.224.5",
    "@jsr/std__toml": "0.224.1",
    "@jsr/std__uuid": "0.224.3",
    "@jsr/std__yaml": "0.224.3",
    "juice": "10.0.0"
  }
}
```

`tools/run-stdlib/.npmrc`:

```
@jsr:registry=https://npm.jsr.io
save-exact=true
```

Then `(cd tools/run-stdlib && npm install --no-audit --no-fund)` creates `tools/run-stdlib/package-lock.json` (commit it). A separate package keeps the 0.224 versions out of the root `package.json`, whose `@jsr/std__*` entries mirror the CLI's newer `src/import_map.json` versions (PR 26's `check-deps.mjs`).

`tools/run-stdlib/stdlib/permissions.ts`:

```ts
/*
 * permissions.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 *
 * stdlib/permissions for scripts on Node: Node has no permission prompts, so
 * every request is granted. Mirrors @std/permissions@0.224 (grant, grantOrThrow).
 */
export interface PermissionDescriptor {
  name: string;
  path?: string;
  host?: string;
  command?: string;
  variable?: string;
}

export function grant(
  ...descriptors: PermissionDescriptor[]
): Promise<PermissionDescriptor[] | undefined> {
  return Promise.resolve(descriptors);
}

export function grantOrThrow(..._descriptors: PermissionDescriptor[]): Promise<void> {
  return Promise.resolve();
}
```

`tools/run-stdlib/stdlib/unsupported.ts` (the stub the builder substitutes for the members of the "not available on Node" table; `kUnsupportedMarker` is the literal PR 36's `bundle()` looks for in an engine bundle):

```ts
/*
 * unsupported.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 *
 * Thrown by the stubs build.mjs substitutes for the stdlib members that need
 * Deno members Quarto does not provide on Node (plan 35, Spec, "Supported
 * migration surface"). The marker is matched by PR 36's build-ts-extension.
 */
export const kUnsupportedMarker = "is not available when Quarto runs on Node.js";

export function unsupported(member: string): never {
  throw new Error(
    `${member} ${kUnsupportedMarker}: use node:fs or node:http, or run the script on Deno with QUARTO_RUN_RUNTIME=deno. See https://quarto.org/docs/projects/scripts-deno-to-node.html`,
  );
}
```

`tools/run-stdlib/stdlib/deno-binding.js` (injected into every bundle with esbuild `inject`: each `Deno.<member>` reference in the bundled std code becomes a reference to this module-local binding, so the bundles never read or create a global `Deno`; Decision 3):

```js
// deno-binding.js
//
// Copyright (C) 2026 Posit Software, PBC
//
// Module-local `Deno` for the stdlib/* bundles: esbuild `inject` replaces every
// global `Deno` reference with `quartoDeno`. The table comes from the copy of
// src/resources/run-compat/deno-members.cjs that build.mjs writes next to the
// bundle. No global is installed and no notice is printed: the user did not
// write `Deno.`, the standard library did.
import { createRequire } from "node:module";
const quartoDeno = createRequire(import.meta.url)("./deno-members.cjs").members;
export { quartoDeno as Deno };
```

`tools/run-stdlib/stdlib/deno-binding-inline.js` (the binding `--packages` injects instead: the `@quarto/std-<name>` packages are bundled a second time, by the esbuild CLI, into an engine's single `.js` file that ships anywhere, so nothing may be required from a file next to the bundle; the table is bundled in):

```js
// deno-binding-inline.js
//
// Copyright (C) 2026 Posit Software, PBC
//
// Module-local `Deno` for the @quarto/std-<name> packages of the default engine
// import map (PR 36): the member table is bundled into the package, because
// the package is itself bundled into an engine file by build-ts-extension.
import { members as quartoDeno } from "../../../src/resources/run-compat/deno-members.cjs";
export { quartoDeno as Deno };
```

`src/resources/run-compat/deno-members.cjs` (the member table; `deno-shim.cjs` in Task 3 wraps it for user scripts):

```js
// deno-members.cjs
//
// Copyright (C) 2026 Posit Software, PBC
//
// The Deno members Quarto provides on Node.js, on node:fs, node:child_process,
// node:util and process, with Deno's error classes. Two consumers: deno-shim.cjs
// wraps the table in the deprecated global `Deno` for user scripts (notice and
// exit hint live there), and every stdlib/* bundle references it as a
// module-local binding (tools/run-stdlib/stdlib/deno-binding.js; build.mjs
// copies this file next to the bundles). Nothing here prints a notice.
"use strict";
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const util = require("node:util");
const { spawn, spawnSync } = require("node:child_process");
const { fileURLToPath } = require("node:url");

class NotFound extends Error { constructor(m) { super(m); this.name = "NotFound"; } }
class AlreadyExists extends Error { constructor(m) { super(m); this.name = "AlreadyExists"; } }
class PermissionDenied extends Error { constructor(m) { super(m); this.name = "PermissionDenied"; } }
class NotSupported extends Error { constructor(m) { super(m); this.name = "NotSupported"; } }
const errors = { NotFound, AlreadyExists, PermissionDenied, NotSupported };

function translate(e) {
  if (!e || typeof e.code !== "string") return e;
  const Ctor = e.code === "ENOENT" ? NotFound : e.code === "EEXIST" ? AlreadyExists
    : (e.code === "EACCES" || e.code === "EPERM") ? PermissionDenied : null;
  if (!Ctor) return e;
  const err = new Ctor(e.message);
  err.cause = e;
  err.code = e.code;
  return err;
}
const sync = (fn) => (...a) => { try { return fn(...a); } catch (e) { throw translate(e); } };
const async = (fn) => async (...a) => { try { return await fn(...a); } catch (e) { throw translate(e); } };

function fileInfo(st) {
  return {
    isFile: st.isFile(), isDirectory: st.isDirectory(), isSymlink: st.isSymbolicLink(),
    size: st.size, mtime: st.mtime, atime: st.atime, birthtime: st.birthtime,
    mode: process.platform === "win32" ? null : st.mode, dev: st.dev, ino: st.ino,
  };
}
function dirEntry(d) {
  return { name: d.name, isFile: d.isFile(), isDirectory: d.isDirectory(), isSymlink: d.isSymbolicLink() };
}
// Deno's WriteFileOptions: append, create (default true). Node has no
// "append without create" flag; "a" is used and creates the file.
function writeFlag(o) {
  if (o && o.append) return "a";
  return o && o.create === false ? "r+" : "w";
}
function removeSyncImpl(p, o) {
  if (o && o.recursive) return fs.rmSync(p, { recursive: true });
  // Deno: a non-recursive remove of a non-empty directory throws
  return fs.lstatSync(p).isDirectory() ? fs.rmdirSync(p) : fs.unlinkSync(p);
}
async function removeImpl(p, o) {
  if (o && o.recursive) return fsp.rm(p, { recursive: true });
  return (await fsp.lstat(p)).isDirectory() ? fsp.rmdir(p) : fsp.unlink(p);
}
const tempPrefix = (o) => path.join((o && o.dir) || os.tmpdir(), (o && o.prefix) || "");
const symlinkType = (o) => (o && o.type === "dir" ? "dir" : o && o.type === "junction" ? "junction" : "file");

class Command {
  constructor(cmd, options = {}) { this.cmd = cmd; this.options = options; }
  #spawnOptions() {
    const o = this.options;
    const map = (v, d) => v === "inherit" ? "inherit" : v === "null" ? "ignore" : v === "piped" ? "pipe" : d;
    return {
      cwd: o.cwd, env: o.clearEnv ? { ...o.env } : { ...process.env, ...o.env },
      stdio: [map(o.stdin, "ignore"), map(o.stdout, "pipe"), map(o.stderr, "pipe")],
      windowsHide: true,
    };
  }
  #result(code, signal, out, err) {
    return { code: code ?? 1, success: code === 0, signal: signal ?? null, stdout: new Uint8Array(out ?? []), stderr: new Uint8Array(err ?? []) };
  }
  output() {
    return new Promise((resolve, reject) => {
      const child = spawn(this.cmd, this.options.args ?? [], this.#spawnOptions());
      const out = [], err = [];
      child.stdout?.on("data", (d) => out.push(d));
      child.stderr?.on("data", (d) => err.push(d));
      child.on("error", (e) => reject(translate(e)));
      child.on("close", (code, signal) => resolve(this.#result(code, signal, Buffer.concat(out), Buffer.concat(err))));
    });
  }
  outputSync() {
    const r = spawnSync(this.cmd, this.options.args ?? [], this.#spawnOptions());
    if (r.error) throw translate(r.error);
    return this.#result(r.status, r.signal, r.stdout, r.stderr);
  }
  spawn() {
    const child = spawn(this.cmd, this.options.args ?? [], this.#spawnOptions());
    const status = new Promise((resolve, reject) => {
      child.on("error", (e) => reject(translate(e)));
      child.on("close", (code, signal) => resolve({ code: code ?? 1, success: code === 0, signal: signal ?? null }));
    });
    return { pid: child.pid, status, kill: (sig) => child.kill(sig ?? "SIGTERM"), stdout: child.stdout, stderr: child.stderr, stdin: child.stdin };
  }
}

const members = {
  readTextFile: async((p) => fsp.readFile(p, "utf8")),
  readTextFileSync: sync((p) => fs.readFileSync(p, "utf8")),
  readFile: async(async (p) => new Uint8Array(await fsp.readFile(p))),
  readFileSync: sync((p) => new Uint8Array(fs.readFileSync(p))),
  writeTextFile: async((p, d, o) => fsp.writeFile(p, d, { flag: writeFlag(o), mode: o && o.mode })),
  writeTextFileSync: sync((p, d, o) => fs.writeFileSync(p, d, { flag: writeFlag(o), mode: o && o.mode })),
  writeFile: async((p, d, o) => fsp.writeFile(p, d, { flag: writeFlag(o), mode: o && o.mode })),
  writeFileSync: sync((p, d, o) => fs.writeFileSync(p, d, { flag: writeFlag(o), mode: o && o.mode })),
  stat: async(async (p) => fileInfo(await fsp.stat(p))),
  statSync: sync((p) => fileInfo(fs.statSync(p))),
  lstat: async(async (p) => fileInfo(await fsp.lstat(p))),
  lstatSync: sync((p) => fileInfo(fs.lstatSync(p))),
  mkdir: async((p, o) => fsp.mkdir(p, { recursive: !!(o && o.recursive), mode: o && o.mode })),
  mkdirSync: sync((p, o) => { fs.mkdirSync(p, { recursive: !!(o && o.recursive), mode: o && o.mode }); }),
  remove: async(removeImpl),
  removeSync: sync(removeSyncImpl),
  readDir: (p) => (async function* () {
    let dir;
    try { dir = await fsp.opendir(p); } catch (e) { throw translate(e); }
    for await (const d of dir) yield dirEntry(d);
  })(),
  readDirSync: sync((p) => fs.readdirSync(p, { withFileTypes: true }).map(dirEntry)),
  copyFile: async((a, b) => fsp.copyFile(a, b)),
  copyFileSync: sync((a, b) => fs.copyFileSync(a, b)),
  rename: async((a, b) => fsp.rename(a, b)),
  renameSync: sync((a, b) => fs.renameSync(a, b)),
  realPath: async((p) => fsp.realpath(p)),
  realPathSync: sync((p) => fs.realpathSync.native(p)),
  readLink: async((p) => fsp.readlink(p)),
  readLinkSync: sync((p) => fs.readlinkSync(p)),
  symlink: async((t, p, o) => fsp.symlink(t, p, symlinkType(o))),
  symlinkSync: sync((t, p, o) => fs.symlinkSync(t, p, symlinkType(o))),
  link: async((a, b) => fsp.link(a, b)),
  linkSync: sync((a, b) => fs.linkSync(a, b)),
  utime: async((p, a, m) => fsp.utimes(p, a, m)),
  utimeSync: sync((p, a, m) => fs.utimesSync(p, a, m)),
  uid: () => (process.getuid ? process.getuid() : null),
  gid: () => (process.getgid ? process.getgid() : null),
  permissions: { query: async () => ({ state: "granted" }), querySync: () => ({ state: "granted" }) },
  makeTempDir: async((o) => fsp.mkdtemp(tempPrefix(o))),
  makeTempDirSync: sync((o) => fs.mkdtempSync(tempPrefix(o))),
  cwd: sync(() => process.cwd()),
  chdir: sync((d) => process.chdir(d instanceof URL ? fileURLToPath(d) : d)),
  exit: (code) => process.exit(code ?? 0),
  execPath: () => process.execPath,
  inspect: (value, options) => util.inspect(value, options),
  env: {
    get: (k) => process.env[k],
    set: (k, v) => { process.env[k] = v; },
    delete: (k) => { delete process.env[k]; },
    has: (k) => k in process.env,
    toObject: () => ({ ...process.env }),
  },
  Command,
  errors,
  build: {
    os: process.platform === "win32" ? "windows" : process.platform,
    arch: process.arch === "x64" ? "x86_64" : process.arch === "arm64" ? "aarch64" : process.arch,
    target: "", vendor: "", env: undefined,
  },
  version: { deno: "compat", node: process.versions.node, v8: process.versions.v8, typescript: "" },
  get args() { return process.argv.slice(2); },
  get pid() { return process.pid; },
  get noColor() { return process.env.NO_COLOR !== undefined && process.env.NO_COLOR !== ""; },
};

module.exports = { members, errors, translate };
```

Add to `.gitignore` under `# generated javascript`:

```
src/resources/run-stdlib/
tools/run-stdlib/node_modules/
```

- [ ] **Step 4: The builder**

`tools/run-stdlib/build.mjs`. Three things beyond bundling: the `Deno` binding injection (Decision 3), the stubs for the "not available on Node" table, and the member gate that proves every `Deno` member the bundled std code reaches is in `deno-members.cjs` (the gate reads the esbuild metafile's inputs, strips comments with `esbuild.transformSync` so JSDoc examples do not count, and reuses `referencedMembers` from PR 26's `tools/node-bundle/check-shim.mjs`). `--manifest`, `--modules-from` and `--packages` exist for PR 36 (the `@quarto/std-<name>` packages of the engine import map); this PR only uses the defaults.

```js
// tools/run-stdlib/build.mjs
//
// Copyright (C) 2026 Posit Software, PBC
//
// Build one ESM bundle per stdlib/<name> module for `quarto run` scripts on
// Node (share/run-stdlib) and, with --packages, the @quarto/std-<name>
// packages of the default engine import map (PR 36, share/extension-build).
// Usage: node tools/run-stdlib/build.mjs --outdir <dir> [--manifest <file>]
//        [--modules-from <node_modules dir>] [--packages] [--force]
// Every bundle gets a module-local `Deno` binding (stdlib/deno-binding.js,
// esbuild `inject`); the members of the "not available on Node" table are
// replaced by stubs (stdlib/unsupported.ts); the member gate fails the build
// when a bundle reaches a Deno member deno-members.cjs does not provide.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { referencedMembers } from "../node-bundle/check-shim.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "..");
const membersFile = path.join(root, "src", "resources", "run-compat", "deno-members.cjs");
const bindingFile = path.join(here, "stdlib", "deno-binding.js");
const inlineBindingFile = path.join(here, "stdlib", "deno-binding-inline.js");
const unsupportedFile = path.join(here, "stdlib", "unsupported.ts");

function option(name, fallback) {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
const outdirArg = option("--outdir");
if (!outdirArg) {
  throw new Error("usage: node tools/run-stdlib/build.mjs --outdir <dir> [--manifest <file>] [--modules-from <dir>] [--packages] [--force]");
}
const outdir = path.resolve(outdirArg);
const manifestPath = path.resolve(option("--manifest", path.join(here, "manifest.json")));
const modulesFrom = path.resolve(option("--modules-from", path.join(here, "node_modules")));
const packages = process.argv.includes("--packages");
const force = process.argv.includes("--force");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

// Output layout: <outdir>/<name>.js, or <outdir>/@quarto/std-<name>/<name>.js with --packages.
const outDirFor = (name) => packages ? path.join(outdir, "@quarto", `std-${name}`) : outdir;
const outFile = (name) => path.join(outDirFor(name), `${name}.js`);

const stamp = path.join(outdir, packages ? ".quarto-std-inputs-mtime" : ".inputs-mtime");
const inputs = [
  manifestPath,
  path.join(path.dirname(modulesFrom), "package-lock.json"),
  membersFile,
  fileURLToPath(import.meta.url),
  ...fs.readdirSync(path.join(here, "stdlib")).map((f) => path.join(here, "stdlib", f)),
];
const inputsMtime = Math.max(...inputs.map((f) => fs.statSync(f).mtimeMs));
const outputs = Object.keys(manifest).map(outFile);
if (!force && fs.existsSync(stamp) && Number(fs.readFileSync(stamp, "utf8")) >= inputsMtime && outputs.every((f) => fs.existsSync(f))) {
  console.log(`run-stdlib up to date (${outputs.length} modules)`);
  process.exit(0);
}

if (modulesFrom === path.join(here, "node_modules") && !fs.existsSync(modulesFrom)) {
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  execFileSync(npm, ["ci", "--no-audit", "--no-fund"], { cwd: here, stdio: "inherit", shell: process.platform === "win32" });
}
// esbuild comes from the repository root's node_modules (PR 26)
const esbuild = await import("esbuild");

// The member table, for the gate: first-level members, and the keys of plain-object members.
const members = createRequire(import.meta.url)(membersFile).members;
const provided = new Set();
const objectMembers = new Set();
for (const [name, desc] of Object.entries(Object.getOwnPropertyDescriptors(members))) {
  provided.add(name);
  if (desc.value && typeof desc.value === "object" && !Array.isArray(desc.value)) {
    objectMembers.add(name);
    for (const sub of Object.keys(desc.value)) provided.add(`${name}.${sub}`);
  }
}
function isProvided(ref) {
  const [first] = ref.split(".");
  if (!provided.has(first)) return false;
  return objectMembers.has(first) ? provided.has(ref) : true;
}

// Stubs for the members of the "not available on Node" table (plan 35, Spec).
const kStubs = {
  file_handler: ["FileHandler"],
  rotating_file_handler: ["RotatingFileHandler"],
  file_server: ["serveDir", "serveFile"],
};
const stubPlugin = {
  name: "quarto-unsupported-std-members",
  setup(build) {
    build.onResolve({ filter: /(^|[\\/])(file_handler|rotating_file_handler|file_server)\.(js|ts)$/ }, (args) => {
      if (!/std__(log|http)([\\/]|$)/.test(args.resolveDir)) return undefined;
      return { path: path.basename(args.path).replace(/\.(js|ts)$/, ""), namespace: "quarto-unsupported" };
    });
    build.onLoad({ filter: /.*/, namespace: "quarto-unsupported" }, (args) => ({
      loader: "ts",
      resolveDir: here,
      contents: `import { unsupported } from ${JSON.stringify(unsupportedFile)};\n` +
        kStubs[args.path].map((n) =>
          n.endsWith("Handler")
            ? `export class ${n} { constructor() { unsupported(${JSON.stringify(n)}); } }`
            : `export function ${n}(): never { return unsupported(${JSON.stringify(n)}); }`
        ).join("\n") + "\n",
    }));
  },
};

// Node resolution for the manifest entries happens from `resolveDir`: the
// tools/run-stdlib checkout (0.224 pins) or, for PR 36, the repository root.
const resolveDir = path.dirname(modulesFrom);
const lock = JSON.parse(fs.readFileSync(path.join(resolveDir, "package-lock.json"), "utf8"));
const installedVersion = (entry) => {
  const pkg = entry.startsWith("@") ? entry.split("/").slice(0, 2).join("/") : entry.split("/")[0];
  return (lock.packages?.[`node_modules/${pkg}`] ?? {}).version ?? "0.0.0";
};

fs.mkdirSync(outdir, { recursive: true });
if (!packages) {
  fs.writeFileSync(path.join(outdir, "package.json"), '{ "type": "module" }\n');
  fs.copyFileSync(membersFile, path.join(outdir, "deno-members.cjs"));
}
const t0 = Date.now();
const failures = [];
for (const [name, entry] of Object.entries(manifest)) {
  const local = entry.startsWith("./");
  const contents = local
    ? `export * from ${JSON.stringify(path.join(here, entry).split(path.sep).join("/"))};\n`
    : `export * from ${JSON.stringify(entry)};\n` +
      (name === "juice" ? `export { default } from "juice";\n` : "");
  const dir = outDirFor(name);
  fs.mkdirSync(dir, { recursive: true });
  if (packages) {
    fs.writeFileSync(path.join(dir, "package.json"), JSON.stringify({
      name: `@quarto/std-${name}`,
      version: installedVersion(entry),
      private: true,
      type: "module",
      // every subpath (fs/walk, log/levels) resolves to the one bundle, whose
      // exports are a superset of each subpath's (PR 36 Decision 3)
      exports: { ".": `./${name}.js`, "./*": `./${name}.js` },
      types: "./index.d.ts",
    }, null, 2) + "\n");
    fs.writeFileSync(path.join(dir, "index.d.ts"), `export * from ${JSON.stringify(entry)};\n`);
    // no deno-members.cjs copy: the package bundles the table in (deno-binding-inline.js)
  }
  const result = await esbuild.build({
    stdin: { contents, resolveDir, sourcefile: `stdlib-${name}.js`, loader: "js" },
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node26",
    outfile: outFile(name),
    sourcemap: false,
    metafile: true,
    absWorkingDir: root,
    inject: [packages ? inlineBindingFile : bindingFile],
    plugins: [stubPlugin],
    logLevel: "warning",
    banner: { js: 'import { createRequire as __createRequire } from "node:module"; const require = __createRequire(import.meta.url);' },
  });
  // Member gate: every Deno member the bundled inputs reference must be in the table.
  const reached = new Set();
  for (const input of Object.keys(result.metafile.inputs)) {
    if (input.startsWith("quarto-unsupported:")) continue;
    const file = path.resolve(root, input);
    if (file === bindingFile || !fs.existsSync(file)) continue;
    const code = esbuild.transformSync(fs.readFileSync(file, "utf8"), { loader: "js", legalComments: "none" }).code;
    for (const ref of referencedMembers(code)) reached.add(ref);
  }
  const list = [...reached].sort();
  console.log(`stdlib/${name}: ${list.length === 0 ? "no Deno member" : list.map((r) => "Deno." + r).join(", ")}`);
  for (const ref of list) {
    if (!isProvided(ref)) failures.push(`stdlib/${name} reaches Deno.${ref}, which src/resources/run-compat/deno-members.cjs does not provide`);
  }
}
if (failures.length > 0) {
  console.error(failures.join("\n"));
  console.error("Add the member to deno-members.cjs or a stub to build.mjs, and the row to plan 35's \"not available on Node\" table.");
  process.exit(1);
}
fs.writeFileSync(stamp, String(inputsMtime));
console.log(`built ${outputs.length} run-stdlib modules into ${outdir} (${Date.now() - t0} ms)`);
```

`import("esbuild")` from `tools/run-stdlib/` resolves `tools/run-stdlib/node_modules/esbuild` first (absent) and then the root `node_modules/esbuild`.

- [ ] **Step 5: Wire it into `configure` and `prepare-dist`**

In `package/src/common/previewjs.ts` add:

```ts
// Build share/run-stdlib (stdlib/* for quarto run scripts on Node). PR 36 passes
// extraArgs (--manifest, --modules-from, --packages) for the engine import map.
export function buildRunStdlib(rootDir: string, outDir: string, force?: boolean, extraArgs: string[] = []) {
  const args = [join(rootDir, "tools", "run-stdlib", "build.mjs"), "--outdir", outDir, ...extraArgs];
  if (force) {
    args.push("--force");
  }
  const result = execSync(execPath(), { args, cwd: rootDir, stdout: "inherit", stderr: "inherit" });
  if (!result.success) {
    throw new Error("Failed to build the run-stdlib modules");
  }
}
```

`package/src/common/configure.ts`, after the preview build's `info("Build completed.")`:

```ts
  info("Building run-stdlib modules for quarto run...");
  buildRunStdlib(config.directoryInfo.root, join(config.directoryInfo.src, "resources", "run-stdlib"));
```

`package/src/common/prepare-dist.ts`, right after the `buildQuartoPreviewJs(..., true)` call:

```ts
  info("Building run-stdlib modules");
  buildRunStdlib(
    config.directoryInfo.root,
    join(config.directoryInfo.pkgWorking.share, "run-stdlib"),
    true,
  );
```

and in `supportingFiles()` add `join(config.directoryInfo.pkgWorking.share, "run-stdlib", ".inputs-mtime")` to `pathsToClean` (a build stamp, not a shipped file). The `src/resources/run-stdlib/` dev copy that `supportingFiles()` copies first is overwritten by the forced build.

- [ ] **Step 6: Run and commit**

Run:
```bash
node tools/run-stdlib/build.mjs --outdir src/resources/run-stdlib
ls src/resources/run-stdlib/*.js | wc -l
cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/run-stdlib-manifest.test.ts
```
Expected: one `stdlib/<name>: ...` line per module naming the `Deno` members it reaches (all in `deno-members.cjs`; `stdlib/fs` lists the eleven of the Context, `stdlib/path` lists none), then `built 34 run-stdlib modules ...`; `34`; `2 passed`. Paste the 34 report lines into the PR description: they are the evidence behind the "not available on Node" table.

```bash
git add tools/run-stdlib src/resources/run-compat/deno-members.cjs src/resources/run-compat/deno/run_import_map.json .gitignore package/src/common/previewjs.ts package/src/common/configure.ts package/src/common/prepare-dist.ts tests/unit/run-stdlib-manifest.test.ts
git commit -m "run: build the 34 stdlib/* modules for Node with a module-local Deno binding and a member gate"
```

### Task 2: `register.cjs`: resolve and load hooks

**Files:**
- Create: `src/resources/run-compat/register.cjs`
- Test: `tests/unit/run-compat-hooks.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
/*
 * run-compat-hooks.test.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 */
import { unitTest } from "../test.ts";
import { assert, assertEquals, assertStringIncludes } from "../asserts.ts";
import { dirname, join } from "../../src/deno_ral/path.ts";
import { makeTempDirSync } from "../../src/deno_ral/temp.ts";
import { mkdirSync, removeSync, writeTextFileSync } from "../../src/deno_ral/fs.ts";
import { exec } from "../../src/deno_ral/process.ts";
import { env } from "../../src/deno_ral/env.ts";
import { architectureToolsPath } from "../../src/core/resources.ts";

const root = env.get("QUARTO_ROOT")!;
const register = join(root, "src", "resources", "run-compat", "register.cjs");
const childEnv = {
  QUARTO_RUN_STDLIB_DIR: join(root, "src", "resources", "run-stdlib"),
  QUARTO_RUN_ESBUILD: architectureToolsPath("esbuild"),
  QUARTO_RUN_DENO_NOTICE: "0",
};

export async function runNodeScript(dir: string, file: string, files: Record<string, string>, extraEnv: Record<string, string> = {}) {
  for (const [name, text] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, name)), { recursive: true });
    writeTextFileSync(join(dir, name), text);
  }
  const r = await exec(architectureToolsPath("node"), {
    args: ["--require", register, "--enable-source-maps", join(dir, file), "one", "two"],
    cwd: dir,
    env: { ...childEnv, ...extraEnv },
  });
  const dec = (b: Uint8Array) => new TextDecoder().decode(b);
  return { success: r.success, code: r.code, out: dec(r.stdout).replaceAll("\r", ""), err: dec(r.stderr).replaceAll("\r", "") };
}

function withDir(fn: (dir: string) => Promise<void>) {
  return async () => {
    const dir = makeTempDirSync({ prefix: "run-hooks" });
    try {
      await fn(dir);
    } finally {
      removeSync(dir, { recursive: true });
    }
  };
}

unitTest("hooks - stdlib/path and stdlib/fs have their full 0.224 API", withDir(async (dir) => {
  const r = await runNodeScript(dir, "a.ts", {
    "a.ts": 'import { join, SEPARATOR, parse, common } from "stdlib/path";\n' +
      'import { exists, ensureFile, emptyDir } from "stdlib/fs";\n' +
      'await ensureFile("x/y.txt");\nconsole.log(join("a", "b").replace("\\\\", "/"), typeof SEPARATOR, parse("/q/r.md").ext, typeof common, await exists("x/y.txt"), typeof emptyDir);\n',
  });
  assert(r.success, r.err);
  assertEquals(r.out.trim(), "a/b string .md function true function");
}));

unitTest("hooks - type-only imports without `import type`, enums and parameter properties run", withDir(async (dir) => {
  const r = await runNodeScript(dir, "main.ts", {
    "types.ts": "export interface Foo { a: number }\nexport const x = 1;\n",
    "main.ts": 'import { Foo, x } from "./types.ts";\nenum E { A = 2 }\nclass P { constructor(public v: number) {} }\nconst f: Foo = { a: x };\nconsole.log(f.a + E.A + new P(3).v);\n',
  });
  assert(r.success, r.err);
  assertEquals(r.out.trim(), "6");
}));

unitTest("hooks - a script next to a \"type\": \"commonjs\" package.json still runs as ESM", withDir(async (dir) => {
  const r = await runNodeScript(dir, "s.ts", {
    "package.json": '{ "type": "commonjs" }\n',
    "helper.js": 'export const h = "h";\n',
    "s.ts": 'import { h } from "./helper.js";\nconsole.log(h);\n',
  });
  assert(r.success, r.err);
  assertEquals(r.out.trim(), "h");
}));

unitTest("hooks - errors for unknown stdlib names, remote URLs and missing npm packages", withDir(async (dir) => {
  const r1 = await runNodeScript(dir, "b.ts", { "b.ts": 'import "stdlib/nope";\n' });
  assert(!r1.success);
  assertStringIncludes(r1.err, "stdlib/nope is not a known Quarto stdlib module");
  const r2 = await runNodeScript(dir, "c.ts", { "c.ts": 'import "https://deno.land/std@0.224.0/path/mod.ts";\n' });
  assertStringIncludes(r2.err, "use stdlib/path");
  const r3 = await runNodeScript(dir, "d.ts", { "d.ts": 'import "npm:left-pad@1.3.0";\n' });
  assertStringIncludes(r3.err, "npm install left-pad");
}));

unitTest("hooks - stdlib/fmt_colors imports cleanly and leaves no global Deno (the bundle has its own binding)", withDir(async (dir) => {
  const r = await runNodeScript(dir, "e.ts", { "e.ts": 'import { bold } from "stdlib/fmt_colors";\nconsole.log(typeof Deno, bold("x").length > 0);\n' });
  assert(r.success, r.err);
  assertEquals(r.out.trim(), "undefined true");
}));

unitTest("hooks - stdlib/log's FileHandler is a stub that names itself (supported migration surface)", withDir(async (dir) => {
  const r = await runNodeScript(dir, "f.ts", {
    "f.ts": 'import { FileHandler, getLogger } from "stdlib/log";\nconsole.log(typeof getLogger);\nnew FileHandler("INFO", { filename: "x.log" });\n',
  });
  assert(!r.success);
  assertEquals(r.out.trim(), "function");
  assertStringIncludes(r.err, "FileHandler is not available when Quarto runs on Node.js");
}));

unitTest("hooks - a versioned npm: specifier warns when node_modules holds another version (version rule)", withDir(async (dir) => {
  const installed = {
    "node_modules/left-pad/package.json": '{ "name": "left-pad", "version": "1.2.0", "main": "index.js" }\n',
    "node_modules/left-pad/index.js": "module.exports = (s) => s;\n",
  };
  const r1 = await runNodeScript(dir, "v.ts", { ...installed, "v.ts": 'import lp from "npm:left-pad@^1.3.0";\nconsole.log(lp("x"));\n' });
  assert(r1.success, r1.err);
  assertEquals(r1.out.trim(), "x");
  assertStringIncludes(r1.err, "npm:left-pad@^1.3.0");
  assertStringIncludes(r1.err, "is not satisfied by the installed left-pad 1.2.0");
  assertStringIncludes(r1.err, join(dir, "v.ts"));
  const r2 = await runNodeScript(dir, "w.ts", { "w.ts": 'import lp from "npm:left-pad@1.2.0";\nconsole.log(lp("y"));\n' });
  assert(r2.success, r2.err);
  assertEquals(r2.err.includes("not satisfied"), false);
}));
```

(`@std/fmt/colors@0.224` reads `Deno?.noColor` at module level; in the bundle that is the module-local binding of Task 1, so nothing is installed on `globalThis`. Task 3's last test shows the same for a script that never mentions `Deno`.)

- [ ] **Step 2: Run it and see it fail**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/run-compat-hooks.test.ts`
Expected: FAIL, `Cannot find module '.../register.cjs'`.

- [ ] **Step 3: Implement `register.cjs`**

The version rule (Spec, "Supported migration surface") lives here for scripts: `satisfies` checks the five forms the rule names, `installedVersion` reads the resolved package's `package.json`, `checkVersion` warns once per package and requested version.

```js
// register.cjs
//
// Copyright (C) 2026 Posit Software, PBC
//
// Preloaded with `node --require` by `quarto run` (and project pre/post-render)
// for .ts/.js scripts on Node:
//  - resolve hook: stdlib/<name> -> $QUARTO_RUN_STDLIB_DIR/<name>.js;
//    npm:/jsr: specifiers -> node_modules; remote URLs -> clear errors
//  - load hook (local files only): .ts compiled by Quarto's esbuild (elides
//    type-only imports, supports enum and parameter properties, as Deno did);
//    ESM .js under a "type": "commonjs" package.json loaded as ESM;
//    the deprecated Deno shim installed when a module mentions `Deno.`
//  - version rule: a versioned npm:/jsr: specifier that the installed package
//    does not satisfy is a warning (plan 35, "Supported migration surface")
"use strict";
const { registerHooks } = require("node:module");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL, fileURLToPath } = require("node:url");

const kDocs = "https://quarto.org/docs/projects/scripts-deno-to-node.html";
const stdlibDir = process.env.QUARTO_RUN_STDLIB_DIR;
const esbuild = process.env.QUARTO_RUN_ESBUILD;
if (!stdlibDir || !esbuild) {
  throw new Error("QUARTO_RUN_STDLIB_DIR and QUARTO_RUN_ESBUILD must be set; run scripts through `quarto run`");
}
const stdlibNames = fs.readdirSync(stdlibDir).filter((f) => f.endsWith(".js")).map((f) => f.slice(0, -3)).sort();
const stdlibUrl = pathToFileURL(stdlibDir + path.sep).href;

function importerDir(context) {
  return context.parentURL && context.parentURL.startsWith("file:")
    ? path.dirname(fileURLToPath(context.parentURL))
    : process.cwd();
}

function notInstalled(pkg, context, extra) {
  const dir = importerDir(context);
  return new Error(
    `Cannot find package '${pkg}' from ${dir}. Quarto runs scripts on Node.js, which loads packages from node_modules: ` +
      `run \`npm install ${pkg}\` in ${dir}.${extra} See ${kDocs}`,
  );
}

// Version rule: "1", "1.2", "1.2.3", "^1.2.3", "~1.2.3" (optional leading v); other forms are not checked.
function satisfies(requested, installed) {
  const m = requested.replace(/^v/, "").match(/^([\^~])?(\d+)(?:\.(\d+))?(?:\.(\d+))?$/);
  if (!m) return true;
  const [maj, min, pat] = installed.split(/[.+-]/).map(Number);
  const op = m[1], A = Number(m[2]);
  const B = m[3] === undefined ? undefined : Number(m[3]);
  const C = m[4] === undefined ? undefined : Number(m[4]);
  if (maj !== A) return false;
  if (B === undefined) return true;
  const patchOk = C === undefined || pat >= C;
  if (op === "^") return A === 0 ? min === B && patchOk : min > B || (min === B && patchOk);
  if (op === "~") return min === B && patchOk;
  if (min !== B) return false;
  return C === undefined || pat === C;
}

function installedVersion(resolvedUrl, pkg) {
  const tail = path.join("node_modules", ...pkg.split("/"));
  let dir = path.dirname(fileURLToPath(resolvedUrl));
  while (dir !== path.dirname(dir)) {
    if (dir.endsWith(tail)) {
      try { return JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8")).version; } catch { return undefined; }
    }
    dir = path.dirname(dir);
  }
  return undefined;
}

const versionWarned = new Set();
function checkVersion(specifier, pkg, requested, resolved, context) {
  if (!requested) return resolved;
  const installed = installedVersion(resolved.url, pkg);
  const key = `${pkg}@${requested}`;
  if (installed && !satisfies(requested, installed) && !versionWarned.has(key)) {
    versionWarned.add(key);
    const importer = context.parentURL && context.parentURL.startsWith("file:") ? fileURLToPath(context.parentURL) : "the script";
    process.stderr.write(
      `WARNING: ${specifier} (imported by ${importer}) is not satisfied by the installed ${pkg} ${installed}. ` +
        `Quarto runs scripts on Node.js, where the project's package.json and lockfile decide the version. See ${kDocs}\n`,
    );
  }
  return resolved;
}

function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("stdlib/")) {
    const name = specifier.slice("stdlib/".length);
    if (!stdlibNames.includes(name)) {
      throw new Error(`${specifier} is not a known Quarto stdlib module. Known modules: ${stdlibNames.map((n) => "stdlib/" + n).join(", ")}. See ${kDocs}`);
    }
    return { url: pathToFileURL(path.join(stdlibDir, name + ".js")).href, shortCircuit: true };
  }
  let m = specifier.match(/^npm:\/?((?:@[^/@]+\/)?[^/@]+)(?:@([^/]+))?(\/.*)?$/);
  if (m) {
    let resolved;
    try {
      resolved = nextResolve(m[1] + (m[3] ?? ""), context);
    } catch {
      throw notInstalled(m[1], context, "");
    }
    return checkVersion(specifier, m[1], m[2], resolved, context);
  }
  m = specifier.match(/^jsr:\/?@([^/@]+)\/([^/@]+)(?:@([^/]+))?(\/.*)?$/);
  if (m) {
    const pkg = `@jsr/${m[1]}__${m[2]}`;
    let resolved;
    try {
      resolved = nextResolve(pkg + (m[4] ?? ""), context);
    } catch {
      throw notInstalled(pkg, context, " Add `@jsr:registry=https://npm.jsr.io` to .npmrc first.");
    }
    return checkVersion(specifier, pkg, m[3], resolved, context);
  }
  m = specifier.match(/^https:\/\/deno\.land\/std(?:@[^/]+)?\/([^/]+)\//);
  if (m) {
    const hint = stdlibNames.includes(m[1]) ? `use stdlib/${m[1]} instead` : "copy the module into your project";
    throw new Error(`Remote imports are not supported when Quarto runs scripts on Node.js (${specifier}): ${hint}. See ${kDocs}`);
  }
  if (/^https?:\/\//.test(specifier)) {
    throw new Error(`Remote imports are not supported when Quarto runs scripts on Node.js (${specifier}): install the package with npm or copy the module into your project. See ${kDocs}`);
  }
  return nextResolve(specifier, context);
}

let shimInstalled = false;
function maybeInstallShim(source) {
  if (!shimInstalled && /\bDeno\./.test(source)) {
    shimInstalled = true;
    require("./deno-shim.cjs");
  }
}

function compileTs(file, source) {
  const r = spawnSync(esbuild, [
    "--loader=ts", "--format=esm", "--target=node26", "--sourcemap=inline",
    `--sourcefile=${file}`, "--tsconfig-raw={}", "--log-level=error",
  ], { input: source, encoding: "utf8", maxBuffer: 256 * 1024 * 1024, windowsHide: true });
  if (r.error) {
    throw r.error;
  }
  if (r.status !== 0) {
    throw new SyntaxError(`${file}: ${r.stderr.trim()}`);
  }
  return r.stdout;
}

function load(url, context, nextLoad) {
  // Quarto's own bundles (share/run-stdlib) are loaded as they are: ESM, no shim
  if (!url.startsWith("file:") || url.includes("/node_modules/") || url.startsWith(stdlibUrl)) {
    return nextLoad(url, context);
  }
  const file = fileURLToPath(url);
  const ext = path.extname(file).toLowerCase();
  if (ext === ".ts" || ext === ".mts") {
    const source = fs.readFileSync(file, "utf8");
    maybeInstallShim(source);
    return { format: "module", source: compileTs(file, source), shortCircuit: true };
  }
  const result = nextLoad(url, context);
  if (ext === ".js" || ext === ".mjs") {
    const text = result.source != null ? String(result.source) : fs.readFileSync(file, "utf8");
    maybeInstallShim(text);
    if (result.format === "commonjs" && /^\s*(import|export)\s/m.test(text)) {
      // Deno ignored package.json; a "type": "commonjs" next to a script must not break it
      return { format: "module", source: text, shortCircuit: true };
    }
  }
  return result;
}

registerHooks({ resolve, load });
```

- [ ] **Step 4: Run the test**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/run-compat-hooks.test.ts`
Expected: `7 passed` (none of these scripts mentions `Deno.`, so `deno-shim.cjs`, Task 3, is not loaded yet).

- [ ] **Step 5: Commit**

```bash
git add src/resources/run-compat/register.cjs tests/unit/run-compat-hooks.test.ts tools/check-runtime-boundary.ts
git commit -m "run: Node module hooks (stdlib/*, esbuild TS compile, commonjs override, version rule)"
```

### Task 3: The Deno shim

**Files:**
- Create: `src/resources/run-compat/deno-shim.cjs`
- Test: `tests/unit/run-compat-shim.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
/*
 * run-compat-shim.test.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 */
import { unitTest } from "../test.ts";
import { assert, assertEquals, assertStringIncludes } from "../asserts.ts";
import { makeTempDirSync } from "../../src/deno_ral/temp.ts";
import { removeSync } from "../../src/deno_ral/fs.ts";
import { runNodeScript } from "./run-compat-hooks.test.ts";

async function inDir(fn: (dir: string) => Promise<void>) {
  const dir = makeTempDirSync({ prefix: "shim" });
  try {
    await fn(dir);
  } finally {
    removeSync(dir, { recursive: true });
  }
}

unitTest("shim - fs, env, args, cwd, errors; one notice per process", () => inDir(async (dir) => {
  const r = await runNodeScript(dir, "s.ts", {
    "s.ts": `
Deno.writeTextFileSync("x.txt", "hello");
console.log(Deno.readTextFileSync("x.txt"), Deno.args.join(","), Deno.cwd() === process.cwd());
console.log(Deno.statSync("x.txt").isFile, Deno.lstatSync("x.txt").isSymlink, Deno.env.get("SHIM_VAR"));
try { Deno.statSync("missing"); } catch (e) { console.log(e instanceof Deno.errors.NotFound); }
Deno.copyFileSync("x.txt", "y.txt"); Deno.renameSync("y.txt", "z.txt");
console.log([...Deno.readDirSync(".")].map((e) => e.name).sort().join(","), Deno.realPathSync("z.txt").endsWith("z.txt"));
const names = []; for await (const e of Deno.readDir(".")) names.push(e.name);
console.log(names.length, typeof Deno.build.os, typeof Deno.pid);
`,
  }, { SHIM_VAR: "v", QUARTO_RUN_DENO_NOTICE: "1" });
  assert(r.success, r.err);
  assertEquals(r.out.trim().split("\n"), ["hello one,two true", "true false v", "true", "s.ts,x.txt,z.txt true", "3 string number"]);
  assertEquals((r.err.match(/Deno compatibility shim is deprecated/g) ?? []).length, 1);
}));

unitTest("shim - unknown members are undefined, never throw; exit hint on failure", () => inDir(async (dir) => {
  const ok = await runNodeScript(dir, "u.ts", {
    "u.ts": 'console.log(typeof Deno.noColor, typeof Deno.openKv, "openKv" in Deno, Deno.cwd().length > 0);\n',
  });
  assert(ok.success, ok.err);
  assertEquals(ok.out.trim(), "boolean undefined false true");
  const bad = await runNodeScript(dir, "v.ts", { "v.ts": "await Deno.openKv();\n" });
  assert(!bad.success);
  assertStringIncludes(bad.err, "Deno.openKv is not provided by Quarto's Node.js compatibility shim");
}));

unitTest("shim - Deno.Command output() and outputSync()", () => inDir(async (dir) => {
  const r = await runNodeScript(dir, "c.ts", {
    "c.ts": `
const o = await new Deno.Command(Deno.execPath(), { args: ["-e", "console.log('hi'); process.exit(3)"] }).output();
console.log(o.code, o.success, new TextDecoder().decode(o.stdout).trim());
const s = new Deno.Command(Deno.execPath(), { args: ["-e", "process.stdout.write('sync')"] }).outputSync();
console.log(new TextDecoder().decode(s.stdout));
`,
  });
  assert(r.success, r.err);
  assertEquals(r.out.trim().split("\n"), ["3 false hi", "sync"]);
}));

unitTest("shim - not installed for scripts that never mention Deno", () => inDir(async (dir) => {
  const r = await runNodeScript(dir, "n.ts", { "n.ts": "console.log(typeof Deno);\n" });
  assert(r.success, r.err);
  assertEquals(r.out.trim(), "undefined");
}));
```

`runNodeScript` is exported from `run-compat-hooks.test.ts` (Task 2) so both files share it; if the harness from PR 31 forbids importing one test file from another, move it to `tests/unit/run-compat-utils.ts` and import it from both.

These two test files carry user-script sources that call the Deno API inside string literals. If PR 02's ratchet counts string contents in its `tests` scope, add `tests/unit/run-compat-hooks.test.ts` and `tests/unit/run-compat-shim.test.ts` to that scope's exclusions in `tools/check-runtime-boundary.ts`, with the comment `// user-script fixtures for the quarto run Deno shim`, the way `tests/docs/` fixtures are excluded. `src/resources/run-compat/*.cjs` implement the shim; if the `resources` scope includes `.cjs`, exclude `src/resources/run-compat/` the same way.

- [ ] **Step 2: Run it and see it fail**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/run-compat-shim.test.ts`
Expected: FAIL, `Cannot find module './deno-shim.cjs'`.

- [ ] **Step 3: Implement `deno-shim.cjs`**

A Proxy over Task 1's member table: the notice on the first access of any member, `undefined` plus the exit hint for the rest.

```js
// deno-shim.cjs
//
// Copyright (C) 2026 Posit Software, PBC
//
// A small, deprecated `Deno` global for `quarto run` scripts written for
// Quarto <= 1.11 (Deno). Installed by register.cjs only when a module
// mentions `Deno.`. The members come from deno-members.cjs (shared with the
// stdlib/* bundles, which never install this global). The first access of any
// member prints one notice per process (QUARTO_RUN_DENO_NOTICE=0 silences it).
// Unknown members are undefined, so feature detection (`typeof Deno.x`) keeps
// working; if the script then fails, one line names the members it touched and
// their Node equivalents.
"use strict";
const { members } = require("./deno-members.cjs");

const kDocs = "https://quarto.org/docs/projects/scripts-deno-to-node.html";
let noticed = false;
function notice(member) {
  if (noticed || process.env.QUARTO_RUN_DENO_NOTICE === "0") return;
  noticed = true;
  process.stderr.write(
    `WARNING: this script uses the Deno API (Deno.${member}). Quarto runs TypeScript scripts on Node.js; ` +
      `the Deno compatibility shim is deprecated. Use Node.js APIs (process, node:fs), or run the script on Deno ` +
      `with QUARTO_RUN_RUNTIME=deno (or \`project: script-runtime: deno\`). Set QUARTO_RUN_DENO_NOTICE=0 to hide this notice. See ${kDocs}\n`,
  );
}

// Node equivalents named in the exit hint
const equivalents = {
  run: "node:child_process", serve: "node:http", listen: "node:net", connect: "node:net", watchFs: "fs.watch",
  openKv: "no equivalent (use a JSON file)", open: "fs.openSync", create: "fs.openSync(path, 'w')",
  makeTempFile: "fs.mkdtempSync + fs.writeFileSync", makeTempFileSync: "fs.mkdtempSync + fs.writeFileSync",
  truncate: "fs.truncateSync", truncateSync: "fs.truncateSync", chmod: "fs.chmodSync", chmodSync: "fs.chmodSync",
  utime: "fs.utimesSync", utimeSync: "fs.utimesSync", hostname: "os.hostname()", osRelease: "os.release()",
  addSignalListener: "process.on(signal, handler)", test: "node:test", kill: "process.kill",
  stdin: "process.stdin", stdout: "process.stdout", stderr: "process.stderr", permissions: "no equivalent (Node has no permission prompts)",
  memoryUsage: "process.memoryUsage()", consoleSize: "process.stdout.columns / rows", dlopen: "no equivalent",
};
const unknownTouched = new Set();
process.on("exit", (code) => {
  if (code === 0) return;
  for (const m of unknownTouched) {
    const eq = equivalents[m];
    process.stderr.write(
      `Deno.${m} is not provided by Quarto's Node.js compatibility shim${eq ? `; Node.js equivalent: ${eq}` : ""}. See ${kDocs}\n`,
    );
  }
});

globalThis.Deno = new Proxy(members, {
  get(target, prop) {
    if (typeof prop === "symbol") return target[prop];
    notice(String(prop));
    if (prop in target) return target[prop];
    unknownTouched.add(String(prop));
    return undefined;
  },
  has(target, prop) { return prop in target; },
});
```

- [ ] **Step 4: Run both test files and commit**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/run-compat-hooks.test.ts unit/run-compat-shim.test.ts`
Expected: `11 passed`.

```bash
git add src/resources/run-compat/deno-shim.cjs tests/unit/run-compat-shim.test.ts tools/check-runtime-boundary.ts
git commit -m "run: an on-demand, deprecated Deno global over the member table for user scripts"
```

### Task 4: Runtime selection and the run handlers

**Files:**
- Create: `src/core/run/typescript.ts`
- Modify: `src/core/run/types.ts`, `src/core/run/deno.ts`, `src/core/run/register.ts`, `src/command/run/run.ts:52-56`
- Test: `tests/unit/run-runtime-select.test.ts`, `tests/smoke/run/run-script-node.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
/*
 * run-runtime-select.test.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 */
import { unitTest } from "../test.ts";
import { assertEquals, assertThrows } from "../asserts.ts";
import { selectScriptRuntime } from "../../src/core/run/typescript.ts";

unitTest("script runtime - env var > project key > node", () => {
  assertEquals(selectScriptRuntime(undefined, {}), "node");
  assertEquals(selectScriptRuntime("deno", {}), "deno");
  assertEquals(selectScriptRuntime("deno", { QUARTO_RUN_RUNTIME: "node" }), "node");
  assertEquals(selectScriptRuntime(undefined, { QUARTO_RUN_RUNTIME: "deno" }), "deno");
  assertThrows(() => selectScriptRuntime(undefined, { QUARTO_RUN_RUNTIME: "bun" }), Error, "QUARTO_RUN_RUNTIME must be node or deno");
});
```

```ts
/*
 * run-script-node.test.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 */
import { join } from "../../../src/deno_ral/path.ts";
import { makeTempDirSync } from "../../../src/deno_ral/temp.ts";
import { removeSync, writeTextFileSync } from "../../../src/deno_ral/fs.ts";
import { assert, assertEquals, assertStringIncludes } from "../../asserts.ts";
import { execProcess } from "../../../src/core/process.ts";
import { quartoDevCmd } from "../../utils.ts";
import { quartoSpawnEnvOptions } from "../../quarto-cmd.ts";
import { unitTest } from "../../test.ts";

const dir = makeTempDirSync({ prefix: "run-node" });
writeTextFileSync(join(dir, "which.ts"), 'import { join } from "stdlib/path";\nconsole.log(navigator.userAgent.split("/")[0], join("x", "y").replace("\\\\", "/"));\n');

async function run(env: Record<string, string>) {
  const r = await execProcess(
    { cmd: quartoDevCmd(), args: ["run", "which.ts"], cwd: dir, stdout: "piped", stderr: "piped", ...quartoSpawnEnvOptions({ QUARTO_LOG_LEVEL: "CRITICAL", ...env }) },
    undefined, undefined, undefined, true,
  );
  return { ok: r.success, out: (r.stdout ?? "").replaceAll("\r", "").trim(), err: (r.stderr ?? "").replaceAll("\r", "") };
}

unitTest("run - TypeScript scripts run on Node by default", async () => {
  const r = await run({});
  assert(r.ok, r.err);
  assertEquals(r.out, "Node.js x/y");
});

unitTest("run - QUARTO_RUN_RUNTIME=deno runs them on the Deno tool", async () => {
  const r = await run({ QUARTO_RUN_RUNTIME: "deno" });
  assert(r.ok, r.err);
  assertEquals(r.out, "Deno x/y");
});

unitTest("run - QUARTO_RUN_RUNTIME rejects other values", async () => {
  const r = await run({ QUARTO_RUN_RUNTIME: "bun" });
  assert(!r.ok);
  assertStringIncludes(r.err, "QUARTO_RUN_RUNTIME must be node or deno");
}, { teardown: () => { removeSync(dir, { recursive: true }); return Promise.resolve(); } });
```

- [ ] **Step 2: Run them and see them fail**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/run-runtime-select.test.ts smoke/run/run-script-node.test.ts`
Expected: FAIL (`src/core/run/typescript.ts` not found; the default run prints `Deno x/y`).

- [ ] **Step 3: `types.ts`**

Add to `src/core/run/types.ts`:

```ts
export type ScriptRuntime = "node" | "deno";
```

and `runtime?: ScriptRuntime;` (with its doc comment from the Interfaces) to `RunHandlerOptions`.

- [ ] **Step 4: `typescript.ts`**

```ts
/*
 * typescript.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 *
 * `quarto run` handler for .ts/.js scripts: Node.js by default, the Deno tool
 * when QUARTO_RUN_RUNTIME=deno or `project: script-runtime: deno`.
 */

import { extname, join } from "../../deno_ral/path.ts";
import { env } from "../../deno_ral/env.ts";
import { execProcess } from "../process.ts";
import { architectureToolsPath, resourcePath } from "../resources.ts";
import { quartoConfig } from "../quarto.ts";
import { RunHandler, RunHandlerOptions, ScriptRuntime } from "./types.ts";
import { denoRunHandler } from "./deno.ts";

export function selectScriptRuntime(
  requested: ScriptRuntime | undefined,
  environment: Record<string, string | undefined>,
): ScriptRuntime {
  const fromEnv = environment["QUARTO_RUN_RUNTIME"];
  const value = fromEnv && fromEnv.length > 0 ? fromEnv : requested ?? "node";
  if (value !== "node" && value !== "deno") {
    throw new Error(`QUARTO_RUN_RUNTIME must be node or deno (got '${value}')`);
  }
  return value;
}

// Quarto's own flags (package/scripts/common/quarto), plus source maps for the
// per-file TypeScript compile done by register.cjs.
const kNodeFlags = [
  "--enable-source-maps",
  "--enable-experimental-regexp-engine",
  "--stack-trace-limit=100",
  "--use-system-ca",
  "--use-env-proxy",
  "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
];

function devHookArgs(): string[] {
  // repository tooling (quarto run --dev) imports src/ through src/import_map.json
  const srcDir = env.get("QUARTO_SRC_PATH") || join(quartoConfig.sharePath(), "../../src");
  return ["--import", join(srcDir, "..", "tools", "node-bundle", "register-import-map.mjs")];
}

async function runOnNode(script: string, args: string[], stdin?: string, options?: RunHandlerOptions) {
  // The bundled Node (QUARTO_NODE honoured), not execPath(): under QUARTO_RUNTIME=deno
  // the CLI itself runs on the Deno tool (PR 33, "Dual-runtime combinations until PR 37").
  return await execProcess(
    {
      cmd: architectureToolsPath("node"),
      args: [
        ...(options?.dev ? devHookArgs() : []),
        "--require",
        resourcePath("run-compat/register.cjs"),
        ...kNodeFlags,
        script,
        ...args,
      ],
      cwd: options?.cwd,
      stdout: options?.stdout,
      env: {
        ...options?.env,
        QUARTO_RUN_STDLIB_DIR: resourcePath("run-stdlib"),
        QUARTO_RUN_ESBUILD: architectureToolsPath("esbuild"),
      },
    },
    stdin,
    undefined,
    undefined,
    true,
  );
}

export const typescriptRunHandler: RunHandler = {
  canHandle: (script: string) => [".js", ".ts", ".mjs", ".mts"].includes(extname(script).toLowerCase()),
  run: async (script, args, stdin, options) => {
    if (selectScriptRuntime(options?.runtime, env.toObject()) === "deno") {
      return denoRunHandler.run(script, args, stdin, options);
    }
    return runOnNode(script, args, stdin, options);
  },
};
```

- [ ] **Step 5: `deno.ts`: the explicit Deno-tool path**

In `src/core/run/deno.ts`:
- `denoRunHandler.canHandle` keeps `.js`/`.ts`; it is no longer registered (only called by `typescriptRunHandler`).
- The user-facing import map path becomes `resourcePath("run-compat/deno/run_import_map.json")` (was `join(denoDir, "../run_import_map.json")`); `initDenoCache` and its `share/deno_std/cache` seed stay until PR 37 (offline `QUARTO_RUN_NO_NETWORK` runs need them).
- Delete PR 00c's notice: `grep -n "QUARTO_RUN_DENO_NOTICE" src/core/run/*.ts` and remove the call and the helper it calls (the Deno path is now an explicit choice; the Node-side shim notice replaces it, under the same variable).

- [ ] **Step 6: Register and document**

`src/core/run/register.ts`: `import { denoRunHandler } from "./deno.ts";` becomes `import { typescriptRunHandler } from "./typescript.ts";`, and `installRunHandler(denoRunHandler);` becomes `installRunHandler(typescriptRunHandler);`.

`src/command/run/run.ts:52-56`:

```ts
  .description(
    "Run a TypeScript, R, Python, or Lua script.\n\n" +
      "TypeScript and JavaScript scripts run on the Node.js runtime bundled with Quarto; " +
      "set QUARTO_RUN_RUNTIME=deno to run them on Deno. For details, see:\n" +
      "https://quarto.org/docs/projects/scripts.html#typescript-scripts",
  )
```

- [ ] **Step 7: Run and commit**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/run-runtime-select.test.ts $(find smoke/run/ -name '*.test.ts')`
Expected: all pass (`run-script.test.ts`, `stdlib-run-version.test.ts`, `command-passthrough.test.ts` now on Node; `run-script-node.test.ts` 3 passed). Then `quarto run --dev tools/check-runtime-boundary.ts` prints unchanged counts (on Node). `rg -n 'execPath\(\)' src/core/run` prints nothing. If it fails on a `Deno.` member of the shim or the import-map hook, fix the tool (it is repository code) rather than the shim, and list the fix in the PR.

```bash
git add src/core/run src/command/run/run.ts tests/unit/run-runtime-select.test.ts tests/smoke/run/run-script-node.test.ts
git commit -m "run: TypeScript scripts run on Node by default; QUARTO_RUN_RUNTIME=deno selects the Deno tool"
```

### Task 5: Project key `script-runtime`

**Files:**
- Modify: `src/project/types.ts:47-48`, `src/resources/schema/project.yml:44-51`, `src/command/render/project.ts` (333, 855, 914-933, 935-1000)
- Regenerate: schema artifacts
- Test: `tests/smoke/project/project-script-runtime.test.ts`, fixture `tests/docs/project/prepost/script-runtime-deno/`

- [ ] **Step 1: Fixture and failing test**

`tests/docs/project/prepost/script-runtime-deno/_quarto.yml`:

```yaml
project:
  pre-render: which.ts
  script-runtime: deno
```

`tests/docs/project/prepost/script-runtime-deno/which.ts`:

```ts
// Records which runtime ran this pre-render script.
import { writeFileSync } from "node:fs";
writeFileSync("runtime.txt", navigator.userAgent.split("/")[0]);
```

`tests/docs/project/prepost/script-runtime-deno/index.qmd`:

```markdown
---
title: script-runtime
---

Body.
```

`tests/smoke/project/project-script-runtime.test.ts`:

```ts
/*
 * project-script-runtime.test.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 */
import { join } from "../../../src/deno_ral/path.ts";
import { existsSync, readTextFileSync, removeSync } from "../../../src/deno_ral/fs.ts";
import { assertEquals } from "../../asserts.ts";
import { docs } from "../../utils.ts";
import { testQuartoCmd, Verify } from "../../test.ts";
import { noErrors } from "../../verify.ts";

const dir = docs("project/prepost/script-runtime-deno");
const marker = join(dir, "runtime.txt");

const ranOnDeno: Verify = {
  name: "pre-render ran on Deno",
  verify: () => {
    assertEquals(readTextFileSync(marker), "Deno");
    return Promise.resolve();
  },
};

testQuartoCmd("render", [dir], [noErrors, ranOnDeno], {
  teardown: () => {
    for (const p of [marker, join(dir, "_site"), join(dir, "index.html"), join(dir, ".quarto")]) {
      if (existsSync(p)) removeSync(p, { recursive: true });
    }
    return Promise.resolve();
  },
}, "project script-runtime: deno runs pre-render scripts on the Deno tool");
```

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/project/project-script-runtime.test.ts`
Expected: FAIL (schema rejects `script-runtime`, or `runtime.txt` contains `Node.js`).

- [ ] **Step 2: Constant and schema**

`src/project/types.ts` after line 48: `export const kProjectScriptRuntime = "script-runtime";`

`src/resources/schema/project.yml`, after the `post-render` entry:

```yaml
        script-runtime:
          description: |
            Runtime for TypeScript and JavaScript `pre-render` and `post-render` scripts:
            `node` (default) or `deno` (uses the bundled Deno, or `quarto install deno`).
            The `QUARTO_RUN_RUNTIME` environment variable overrides it.
          schema:
            enum: [node, deno]
```

Run: `package/dist/bin/quarto dev-call build-artifacts` and commit the regenerated `src/resources/schema/json-schemas.json`, `src/resources/types/` and editor files it reports.

- [ ] **Step 3: Plumbing in `project.ts`**

- `runScripts(projDir, scripts, progress, quiet, env, runtime?: ScriptRuntime)`: pass `runtime` into `handler.run(script, args.slice(1), undefined, { cwd: projDir, stdout: ..., env, runtime })`.
- `runPreRender` and `runPostRender` gain a last parameter `runtime?: ScriptRuntime` forwarded to `runScripts`.
- Call sites (line 333 `await runPreRender(` and line 855 `await runPostRender(`): add `context.config?.project?.[kProjectScriptRuntime] as ScriptRuntime | undefined` as the last argument.
- Imports: `kProjectScriptRuntime` from `../../project/types.ts`, `ScriptRuntime` from `../../core/run/types.ts`.

- [ ] **Step 4: Run and commit**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/project/project-script-runtime.test.ts smoke/project/project-prepost.test.ts`
Expected: both pass; `project-prepost` runs its unchanged Deno-API fixtures on Node through the shim.

```bash
git add src/project/types.ts src/resources/schema src/resources/types src/command/render/project.ts tests/docs/project/prepost/script-runtime-deno tests/smoke/project/project-script-runtime.test.ts
git commit -m "project: script-runtime selects node or deno for pre/post-render scripts"
```

### Task 6: Resource scripts and `ast-diagram` on Node; retire `check-usage` (PR 25 runtime residue table, rows 1, 2, 3, 16)

These `.ts` resources ran on the Deno tool and are excluded from the `src` scope (PR 02 `kSrcExclusions`); the `resources` scope counts them. From this PR they would run on Node through the shim, so they are ported to Node APIs here (the shim is for users' scripts, not Quarto's own).

**Files:**
- Modify: `src/resources/scripts/juice.ts`, `src/resources/tools/ast-diagram/main.ts`, `src/command/dev-call/make-ast-diagram/cmd.ts`, `tools/runtime-boundary-baseline.json`
- Delete: `src/resources/scripts/check-usage.ts`, `src/resources/scripts/check-usage.sh`

- [ ] **Step 1: `juice.ts`**

`src/resources/filters/normalize/astpipeline.lua:68-69` runs `quarto run <share>/scripts/juice.ts <file>` for raw HTML tables in Typst output. Replace the file's body with:

```ts
import { readFileSync } from "node:fs";
import juice from "stdlib/juice";

console.log(juice(readFileSync(process.argv[2], "utf8")));
```

(`node:fs` and `process` exist on the Deno tool too, so `QUARTO_RUN_RUNTIME=deno` still renders.)

- [ ] **Step 2: `ast-diagram`**

In `src/resources/tools/ast-diagram/main.ts`: delete the `#!/usr/bin/env -S deno run …` line; `import { join } from "https://deno.land/std/path/mod.ts"` -> `import { join } from "node:path"`; `Deno.readTextFile`/`Deno.writeTextFile` -> `readFile`/`writeFile` from `node:fs/promises`; the `new Deno.Command("quarto", { args: [...], stdout: "piped" })` + `output()` -> `execFileSync("quarto", ["pandoc", "-t", "json", markdownFile], { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 })` from `node:child_process`; `Deno.args` -> `process.argv.slice(2)`; `new URL(".", import.meta.url).pathname` -> `dirname(fileURLToPath(import.meta.url))` (`node:url`; the `pathname` form breaks on Windows drive letters). `ast-diagram.ts` and `types.ts` are pure and unchanged.

In `src/command/dev-call/make-ast-diagram/cmd.ts`, replace the `execProcess({ cmd: execPath(), args: ["run", "--allow-read", "--allow-write", "--allow-run", <main.ts>, ...] })` spawn with the script run handler, so the script runs on whatever `selectScriptRuntime()` chooses:

```ts
    const script = resourcePath(join("tools", "ast-diagram", "main.ts"));
    const handler = handlerForScript(script);
    if (!handler) {
      throw new Error(`No run handler for ${script}`);
    }
    await handler.run(script, [...args, "--mode", options.mode || "full"]);
```

(`handlerForScript` from `../../../core/run/run.ts`; drop the `execProcess` and `execPath` imports if unused.)

- [ ] **Step 3: Delete `check-usage`**

```bash
git rm src/resources/scripts/check-usage.ts src/resources/scripts/check-usage.sh
rg -n 'check-usage' src package tests tools
```
Expected: no output (the script summarised `deno info` output and has no caller).

- [ ] **Step 4: Ratchet and verify**

Run:
```bash
rg -n '\bDeno\.' src/resources/scripts src/resources/tools
package/dist/bin/quarto run --dev tools/check-runtime-boundary.ts --update-baseline
package/dist/bin/quarto dev-call make-ast-diagram tests/docs/minimal.qmd
cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent $(rg -l 'typst' smoke/render | tr '\n' ' ')
```
Expected: the first `rg` prints nothing; the baseline's `resources` entry becomes 1 `Deno.` (the engine template, PR 36) and 0 std files; `make-ast-diagram` writes its HTML diagram next to the input as on `main`; the Typst render tests pass, and a render of a Typst document with a raw HTML `<table>` (`rg -l '<table' tests/docs/smoke-all/typst`) shows no `Deno compatibility shim` notice in its log. If a `tools/*.ts` script fails under `quarto run --dev` on Node (row 16 of the residue table), fix the script in this PR, as Task 4 step 7 says for the ratchet tool.

- [ ] **Step 5: Commit**

```bash
git add src/resources/scripts src/resources/tools/ast-diagram src/command/dev-call/make-ast-diagram/cmd.ts tools/runtime-boundary-baseline.json
git commit -m "run: juice.ts and ast-diagram on Node APIs; retire check-usage"
```

### Task 7: Changelog and docs

**Files:**
- Modify: `news/changelog-1.12.md`, `dev-docs/runtime-migration/docs-updates.md`

- [ ] **Step 1: Changelog** (under `## Commands`, `### \`run\``)

```markdown
- ([#NNNNN](https://github.com/quarto-dev/quarto-cli/pull/NNNNN)): `quarto run` and project `pre-render`/`post-render` TypeScript and JavaScript scripts now run on the Node.js runtime bundled with Quarto. The 34 `stdlib/*` imports are served from bundles shipped with Quarto; `stdlib/log`'s `FileHandler` and `stdlib/http`'s `serveDir`/`serveFile` are not available on Node (see the migration page for the full list). TypeScript is compiled per file, so type-only imports, enums and parameter properties work as before. The common `Deno` API calls run through a deprecated compatibility shim that prints a one-time notice (`QUARTO_RUN_DENO_NOTICE=0` hides it); other `Deno` members are undefined and named when the script fails. `npm:` and `jsr:` imports resolve from the project's `node_modules`, where the project's `package.json` and lockfile decide the version (a version in the import that the installed package does not satisfy is a warning); remote `https:` imports are not supported on Node. To keep running scripts on Deno, set `QUARTO_RUN_RUNTIME=deno` or `project: script-runtime: deno` in `_quarto.yml`.
```

- [ ] **Step 2: `docs-updates.md`**

PR 34 created the table; make sure its `projects/scripts-deno-to-node.qmd` row (the migration page PR 00c named) carries rows 4–6 of the supported migration surface matrix (Spec), the "not available on Node" table, the version rule and the governing-lockfile table, plus: per-file TypeScript compile (residual: re-exported types need `export type`); `"type": "commonjs"` no longer matters; `QUARTO_RUN_RUNTIME`, `project.script-runtime`; `quarto install deno`; the shim's member table and the migration table (`Deno.readTextFileSync` -> `fs.readFileSync(path, "utf8")`, `Deno.env.get` -> `process.env`, `Deno.args` -> `process.argv.slice(2)`, `Deno.Command` -> `node:child_process`, `Deno.exit` -> `process.exit`, `Deno.cwd` -> `process.cwd()`); and the 1.13 note. The `projects/scripts.qmd` row keeps a short "TypeScript scripts run on Node" section that links to it.

- [ ] **Step 3: Commit**

```bash
git add news/changelog-1.12.md dev-docs/runtime-migration/docs-updates.md
git commit -m "docs: scripts on Node, stdlib, shim, script-runtime"
```

## Verification

- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/run-stdlib-manifest.test.ts unit/run-compat-hooks.test.ts unit/run-compat-shim.test.ts unit/run-runtime-select.test.ts $(find smoke/run/ -name '*.test.ts') smoke/project/project-prepost.test.ts smoke/project/project-script-runtime.test.ts`: all pass on Linux and macOS; on Windows `stdlib-run-version` stays `ignore` as today.
- `quarto run --dev tools/check-runtime-boundary.ts`: runs on Node, unchanged counts; the ratchet workflow is green on the branch.
- `cd package/src && ./quarto-bld prepare-dist --set-version 99.9.9 && ls ../pkg-working/share/run-stdlib/*.js | wc -l` prints `34`; `ls ../pkg-working/share/run-compat` lists `deno`, `deno-members.cjs`, `deno-shim.cjs`, `register.cjs`; `ls ../pkg-working/share/run-stdlib/deno-members.cjs` exists.
- Installed layout: `cd package/pkg-working/bin && ./quarto run ../../../tests/docs/run/test-stdlib.ts` exits 0.
- Task 6 step 4 (resource scripts on Node; `resources` at 1/0; `make-ast-diagram` and the Typst HTML-table render).
- `rg -n 'execPath\(\)' src -g '*.ts' -g '!src/deno_ral/**'` prints nothing (PR 33's rule, "Dual-runtime combinations until PR 37"; PR 36 keeps it).
- Only if PR 33 Task 13 ran (`grep -n QUARTO_RUNTIME package/scripts/common/quarto`): the four rows of PR 33's combinations table. Locally, `QUARTO_RUNTIME=deno package/dist/bin/quarto render tests/docs/project/prepost/<a fixture with a pre-render .ts script>` once with `QUARTO_RUN_RUNTIME=node` and once with `QUARTO_RUN_RUNTIME=deno`, both green and the Node run with no `Deno/` in `navigator.userAgent`. In CI, add to the `dual-runtime-smoke` job of `test-node-bundle.yml` (PR 32 Task 5) one step that renders that fixture with the bundle on Deno under both values of `QUARTO_RUN_RUNTIME`; the Node side of the job already covers the first two rows.

## Review checklist

- [ ] `tools/run-stdlib/manifest.json` has 34 keys equal to `run_import_map.json`; `fs` and `path` are `@jsr/std__fs@0.224.0`/`@jsr/std__path@0.224.0`; `tools/run-stdlib/package-lock.json` committed.
- [ ] `register.cjs` uses `module.registerHooks`; the load hook only touches `file:` URLs outside `node_modules`; TypeScript goes through `QUARTO_RUN_ESBUILD` with an inline source map.
- [ ] The shim is installed on demand, never throws on unknown members, prints one notice under `QUARTO_RUN_DENO_NOTICE`, and `deno-members.cjs` implements `readDir`, `copyFile`, `rename`, `realPath`, `lstat`, `chdir` and their `Sync` forms (plus `readLink`, `symlink` for `@std/fs`, `inspect` for `fmt_printf`).
- [ ] No bundle under `share/run-stdlib/` contains `Deno.` (module-local binding); the builder's member report is in the PR description and lists no member outside `deno-members.cjs`; `FileHandler`/`RotatingFileHandler`/`serveDir`/`serveFile` are the stubs of `unsupported.ts`.
- [ ] The version rule: `register.cjs` warns once per package and requested version for the five forms of the rule and stays silent otherwise; the `npm:left-pad@^1.3.0` test passes.
- [ ] Precedence `QUARTO_RUN_RUNTIME` > `project.script-runtime` > `node`; the Deno path uses PR 33's `requireDenoToolBinary()`; the Node path uses `architectureToolsPath("node")`, and `execPath()` has no caller left in `src/` (PR 33, "Dual-runtime combinations until PR 37").
- [ ] PR 00c's Deno-side notice is gone; no other `QUARTO_RUN_DENO_NOTICE` reader remains besides the shim.
- [ ] Fixtures under `tests/docs/project/prepost/` (other than the new `script-runtime-deno/`) unchanged.
- [ ] `src/resources/scripts/` and `src/resources/tools/ast-diagram/` contain no `Deno.`; `check-usage` is gone; `make-ast-diagram` goes through the run handler; the `resources` baseline is 1/0 (PR 25's residue table rows 1-3 and 16 closed).

## Risks and rollback

- **Type-only imports in user scripts.** Without the esbuild compile, Node fails with `SyntaxError: The requested module './types.ts' does not provide an export named 'Foo'`. The load hook compiles every local `.ts`; the residual case is a re-export of a type (`export { Foo } from "./types.ts"`), which fails with the same message and needs `export type { Foo }` (Deno's transpiler has the same limitation; documented).
- **`"type": "commonjs"` next to a script.** Without the hook, Node prints `Failed to load the ES module ... Make sure to set "type": "module"` and `SyntaxError: Cannot use import statement outside a module`. The hook loads local files with `import`/`export` as ESM; a genuine CommonJS `.js` (no `import`/`export`) still loads as CommonJS.
- **A `stdlib/*` member that needs a `Deno` member the table lacks.** The known ones (`FileHandler`, `RotatingFileHandler`, `serveDir`, `serveFile`) are stubs that throw a message naming themselves (the "not available on Node" table); the builder's member gate fails the build for any other, so none ships unknowingly. If a user path turns out to need one, add the member to `deno-members.cjs` (both consumers get it) and the row to the table, or point the user at `QUARTO_RUN_RUNTIME=deno`.
- **The version rule warns, it does not pin.** A script that relied on Deno fetching `npm:left-pad@1.3.0` gets whatever the project installed, with a warning when it differs; exotic range forms (`>=`, `||`, `x`) are not checked at all. Documented on the migration page; the warning names the file so authors can fix `package.json`.
- **npm packages that detect Deno.** The shim is installed only when a module mentions `Deno.`; a script that mixes `Deno.*` and such a package may send the package down its Deno path. Workaround: `QUARTO_RUN_RUNTIME=deno`, or migrate the `Deno.*` calls.
- **Startup cost per local `.ts` file** (one esbuild process, tens of ms). Scripts have few local files; measure `quarto run` on `tests/docs/run/test-stdlib.ts` before/after in the PR description.
- **Rollback:** revert the PR; scripts run on the Deno tool again (it is still bundled until PR 37).

## Decisions needed

1. **Shim removal date.** Recommendation: keep the shim through 1.13 and decide then from issue reports; removing it has no maintenance benefit while it is a single file.
2. **`stdlib/*` beyond 1.13.** Recommendation: keep; the bundles are build-time inputs only.
3. **Module-local `Deno` binding for the `stdlib/*` bundles** (triage A1(b) reuses the bundles for in-process engines, which have no `Deno` global by review decision 1). Options: (a) keep the bundles dependent on the global shim: a bundle contains `Deno.`, `register.cjs` installs the shim when it loads one; scripts only, importing `stdlib/fmt_colors` turns on the deprecated global for a script that never wrote `Deno.`, and PR 36 cannot reuse the bundles. (b) esbuild `inject` of `tools/run-stdlib/stdlib/deno-binding.js`, which exports the member table of `deno-members.cjs` under the name `Deno`, so every `Deno.<member>` reference inside a bundle becomes a module-local reference: no global, no notice, the same bundles serve scripts and the engine map, and the builder's member gate proves every reference is in the table. (c) an engine-side `Deno` shim (A1 option (c), not taken). Recommendation and choice: (b); this plan is written for it.
4. Not changed because the review's concern is resolved by the design: "type-only imports not in the risk list" (now in Risks with the exact error, and mitigated by the per-file compile); "`stdlib/fs`/`stdlib/path` mapped to `deno_ral` lack APIs" (now the 0.224 JSR packages).
