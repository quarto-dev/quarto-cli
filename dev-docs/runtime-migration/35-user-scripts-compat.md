# PR 35: `quarto run` and project scripts on Node (`stdlib/*` hook, Deno shim, `quarto install deno`)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `quarto run script.ts` and project `pre-render`/`post-render` `.ts` scripts run on the bundled Node with `stdlib/*` imports resolved to modules shipped in `share/run-stdlib/`, a deprecated `Deno` global shim for the common filesystem and process calls, and an opt-in `quarto install deno` tool that `quarto run` prefers when present.
**Phase:** 3. **Depends on:** PR 33 (Node runtime, `tools/node-bundle/build.mjs` as a library, `prepare-dist` on Node). **Unblocks:** PR 37 (deletes `src/resources/deno_std/` except what this PR keeps).
**Branch:** `rt/35-user-scripts-compat`.
**Suggested executor:** Opus. The resolve hook, the shim's error messages and the compatibility policy are user-facing contracts that need judgement; the tool installer is modelled on existing code.
**Size:** L (about 45 files: run handlers, hook and shim, 36 stdlib bundle entries, builder, tool installer, root `package.json`, `.gitignore`, tests, workflow, docs, changelog).
**Ships on:** Node. Gates: PR 32 matrix, `tests/smoke/run/`, `tests/smoke/project/project-prepost.test.ts`, the new `test-install.yml` job.

## Spec

### Context

Assessment section 6 ("Users who write TypeScript scripts for Quarto: the main compatibility break") and Phase 3 step 3. Today `src/core/run/deno.ts` runs `.ts`/`.js` scripts with the bundled Deno (`architectureToolsPath("deno")`), `--allow-all`, the `stdlib/*` import map from `src/resources/deno_std/run_import_map.json` (36 names mapping to `jsr:@std/*@0.224.x`, `https://deno.land/std@0.224.0/encoding/*.ts` and `https://cdn.skypack.dev/juice@10.0.0`), and a `DENO_DIR` cache copied from `share/deno_std/cache` into the user cache dir on first use (`initDenoCache`). Project scripts (`pre-render`, `post-render`) go through the same handler. Users wrote against `Deno.*` and `stdlib/*` for years; quarto.org documents it (`docs/projects/scripts.html#deno-scripts`). PR 33 removed the Deno binary from `package/dist`, so without this PR every `.ts` script fails with "deno not found".

Facts this plan relies on (verified 2026-10-14 against `nodejs/node` `v26.x` docs):

- `module.registerHooks()` (synchronous, in-thread resolve/load hooks) is Stability 1.2 "Release candidate" in Node 26; `module.register()` (the asynchronous, off-thread API) is runtime-deprecated since v26.0.0 (DEP0205) with the text "Use `module.registerHooks()` instead". The hook can be registered before application code with `--require ./register.cjs` (stable flag) or `--import` (Stability 1). This plan uses `--require` with a CommonJS file.
- The synchronous `resolve(specifier, context, nextResolve)` hook receives `context.parentURL` and returns `{ url, shortCircuit }` or delegates to `nextResolve(newSpecifier, context)`, which is how an import map is implemented (the docs' own "Import maps" example).
- Type stripping is on by default; scripts using `enum`, parameter properties or runtime `namespace` fail with `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX`. This is documented as a limitation; `quarto install deno` is the escape hatch.
- Node resolves bare specifiers from `node_modules` only; there is no on-demand download. `QUARTO_RUN_NO_NETWORK` therefore has no module-loading meaning on Node (it keeps its meaning for the Deno path: `--cached-only`).
- The `@std/*` 0.224 packages exist on `npm.jsr.io` as `@jsr/std__<name>`; PR 26's root `.npmrc` maps the `@jsr` scope there. `@std/path`, `@std/yaml`, `@std/csv`, `@std/toml`, `@std/jsonc`, `@std/front-matter`, `@std/semver`, `@std/uuid`, `@std/collections`, `@std/bytes`, `@std/async`, `@std/datetime`, `@std/fmt`, `@std/streams`, `@std/crypto`, `@std/encoding`, `@std/io`, `@std/archive`, `@std/log`, `@std/dotenv`, `@std/http` are plain JavaScript that bundles for Node; where one of them calls `Deno.*` at runtime (the `FileHandler` of `@std/log`, `loadSync` of `@std/dotenv`, `serveDir` of `@std/http`) the shim either covers the call or throws a clear error. `@std/fs@0.224` and `@std/permissions` call `Deno.*` for everything, so `stdlib/fs` is served by Quarto's own `src/deno_ral/fs.ts` (on `node:fs` since PR 27, same export names: `existsSync`, `ensureDirSync`, `walk`, `expandGlob`, `copy`, `move`, `emptyDir`, `EOL`) and `stdlib/permissions` by a stub that reports every permission as granted.
- The in-repo test fixtures `tests/docs/project/prepost/extension/_extensions/author/prerender/pre-render.ts`, `tests/docs/project/prepost/invalid-mutate/pre.ts` and `tests/docs/project/prepost/script-env-vars/check-env.ts` use `Deno.statSync`, `Deno.errors.NotFound`, `Deno.writeTextFileSync`, `Deno.removeSync`, `Deno.env.get`, `Deno.cwd` and `stdlib/path`, `stdlib/fs`. They are representative of user scripts and define the minimum shim surface; they are kept unchanged on purpose as regression tests for the shim.

Assumptions about earlier PRs:

- PR 33 exports `bundle({ entry, outfile, sourcemap })` from `tools/node-bundle/build.mjs` and ships `tools/node-bundle/ensure.mjs`; the root `package.json` has `esbuild@0.28.1`; `prepare-dist.ts` calls `buildQuartoPreviewJs(..., true)` right before `copyQuartoScript` (this PR adds the stdlib build next to it).
- PR 27 made `src/deno_ral/fs.ts` a Node implementation that no longer imports `@std/fs`; `src/deno_ral/path.ts` re-exports `@std/path` 1.x.
- PR 14/08: `env`, `exec`, `execPath` exist in `src/deno_ral/`.
- PR 19: `isMainModule`, `platform.ts` `arch`, `os`.

### Scope

In:
- `src/core/run/typescript.ts` (new): the `.ts`/`.js`/`.mjs`/`.mts` handler; Node by default, delegates to the Deno handler when `quarto install deno` is installed or `QUARTO_RUN_DENO=1`; `--dev` scripts (repository tooling under `tools/`) are bundled with `tools/node-bundle/ensure.mjs` and run on Node.
- `src/core/run/deno.ts` retargeted: runs the installed Deno tool with `share/run-compat/deno/run_import_map.json`, `DENO_DIR` under the Quarto cache dir; `initDenoCache` and the `share/deno_std/cache` copy are deleted.
- `src/core/run/register.ts`: registers `typescriptRunHandler`.
- `src/resources/run-compat/register.cjs`, `src/resources/run-compat/deno-shim.cjs`, `src/resources/run-compat/stdlib/permissions.ts`, `src/resources/run-compat/run-stdlib.json`, `src/resources/run-compat/deno/run_import_map.json` (moved from `src/resources/deno_std/`).
- `tools/node-bundle/build-run-stdlib.mjs`: builds `run-stdlib/<name>.js` for the 36 names; called by `quarto-bld configure` (into `src/resources/run-stdlib/`, gitignored) and `prepare-dist` (into `share/run-stdlib/`).
- Root `package.json`: the pinned `@jsr/std__*@0.224.x` and `juice@10.0.0` packages (build-time only; bundled).
- `src/tools/impl/deno.ts` (new) and the `deno` entry in `src/tools/tools.ts`.
- `.github/workflows/test-install.yml`: a `quarto install deno` job.
- Tests, changelog, `src/command/run/run.ts` help text.

Out:
- Deleting `src/resources/deno_std/deno_std.lock`, `import_map.json`, `package/scripts/deno_std/*`, `vendor.sh` (PR 37).
- `build-ts-extension` (PR 36).
- Rewriting the in-repo test fixtures to Node APIs (they are the shim's tests).
- Publishing `@quarto/run-stdlib` to npm or any package registry.

### Interfaces

```ts
// src/core/run/typescript.ts
import { RunHandler } from "./types.ts";
/** Runs .ts/.js/.mjs/.mts scripts. Node unless useDenoForScripts() is true. */
export const typescriptRunHandler: RunHandler;
/**
 * true when QUARTO_RUN_DENO=1, or when QUARTO_RUN_DENO is unset and
 * `quarto install deno` has been run. QUARTO_RUN_DENO=0 forces Node.
 * Throws when QUARTO_RUN_DENO=1 and Deno is not installed.
 */
export async function useDenoForScripts(): Promise<boolean>;
```

```ts
// src/core/run/deno.ts (retargeted)
/** Runs the script with the Deno installed by `quarto install deno`. */
export const denoRunHandler: RunHandler;
```

```ts
// src/tools/impl/deno.ts
export const denoInstallable: InstallableTool;   // name: "Deno"
export function denoInstallDir(): string;         // quartoDataDir("deno")
export function denoBinaryPath(): string;         // <installDir>/deno[.exe]
export async function denoInstalled(): Promise<boolean>;
export const kDenoKnownGoodVersion = "v2.7.14";  // fallback when the GitHub API is unreachable
```

Environment read by `quarto run` on Node:

| Variable | Meaning |
|---|---|
| `QUARTO_RUN_DENO` | `1`: run on the installed Deno (error if missing); `0`: never use Deno; unset: Deno if installed |
| `QUARTO_RUN_NO_NETWORK` | Deno path: `--cached-only`. Node path: no effect on module loading (documented); exported to the script unchanged |
| `QUARTO_RUN_DENO_SHIM_QUIET` | `1`: suppress the shim's deprecation notice (CI logs) |

Environment set for the script process on Node: `QUARTO_RUN_STDLIB_DIR` (absolute path of `run-stdlib/`), plus everything `execProcess` already passes (`QUARTO_PROJECT_*`, etc.).

Node command line built by the handler:

```
<execPath()> --require <share>/run-compat/register.cjs --enable-experimental-regexp-engine --stack-trace-limit=100 <script> <args...>
```

`register.cjs` resolve hook:

| Specifier shape | Resolution |
|---|---|
| `stdlib/<name>` | `file://$QUARTO_RUN_STDLIB_DIR/<name>.js`; unknown name: error listing the 36 names |
| `npm:<pkg>[@ver][/sub]` | `nextResolve("<pkg>/sub")` from the importer (project `node_modules`); failure: error "run `npm install <pkg>` in <dir>" |
| `jsr:@<scope>/<name>[@ver][/sub]` | `nextResolve("@jsr/<scope>__<name>/sub")`; same failure text plus the `.npmrc` line |
| `https://deno.land/std@…/<mod>/…` | error naming `stdlib/<mod>` |
| any other `http(s):` URL | error: remote imports are not supported on Node; vendor the file |
| everything else | `nextResolve` unchanged |

`deno-shim.cjs` installs `globalThis.Deno` with exactly these members (each prints the deprecation notice once per process on first use, unless `QUARTO_RUN_DENO_SHIM_QUIET=1`):

`readTextFile`, `readTextFileSync`, `readFile`, `readFileSync`, `writeTextFile`, `writeTextFileSync`, `writeFile`, `writeFileSync`, `stat`, `statSync`, `mkdir`, `mkdirSync`, `remove`, `removeSync`, `cwd`, `env` (`get`, `set`, `delete`, `has`, `toObject`), `args`, `exit`, `Command` (`output()`, `outputSync()`, `spawn()` with `status` and `kill`), `makeTempDir`, `makeTempDirSync`, `errors` (`NotFound`, `AlreadyExists`, `PermissionDenied`), `build` (`os`, `arch`), `version` (`deno: "compat"`, `node`), `pid`, `execPath`.

`statSync`, `removeSync`, `mkdirSync`, `errors`, `build`, `version`, `pid`, `execPath` go beyond the list in the assignment because the in-repo fixtures and `@std/dotenv`/`@std/log` need them; they are the same code paths as their async forms. Any other member throws `Error: Deno.<name> is not available when Quarto runs scripts on Node.js. <equivalent>. See https://quarto.org/docs/projects/scripts.html#migrating-from-deno`, with a table of equivalents for `readDir`/`readDirSync` (`fs.readdirSync`), `run` (`node:child_process`), `serve`/`listen` (`node:http`/`node:net`), `connect` (`node:net`), `watchFs` (`fs.watch`), `openKv` (no equivalent), `open`/`create` (`fs.openSync`), `chdir` (`process.chdir`), `copyFile(Sync)` (`fs.copyFileSync`), `rename(Sync)` (`fs.renameSync`), `realPath(Sync)` (`fs.realpathSync`), `readLink`/`symlink` (`fs`), `hostname` (`os.hostname`), `osRelease` (`os.release`), `addSignalListener` (`process.on`), `test` (`node:test`), `inspect` (`util.inspect`), `kill` (`process.kill`), `stdin`/`stdout`/`stderr` (`process.*`).

Deprecation timeline (changelog and docs text):

- Quarto 1.11: scripts run on Node. `stdlib/*` keeps working. `Deno.*` works through the shim with a one-time notice. `quarto install deno` runs scripts on a real Deno; `quarto run` uses it automatically when installed.
- Quarto 1.12: the `Deno` shim is removed; scripts that still use `Deno.*` need Node APIs or `quarto install deno`. `stdlib/*` stays.
- The Deno handler stays as long as Deno publishes releases Quarto can download (the Deno team committed to monthly releases until October 2027); it is re-evaluated for 1.13.

### Files

- Create: `src/core/run/typescript.ts`
- Modify: `src/core/run/deno.ts` (whole file)
- Modify: `src/core/run/register.ts:27-33`
- Modify: `src/command/run/run.ts:52-56` (description)
- Create: `src/resources/run-compat/register.cjs`
- Create: `src/resources/run-compat/deno-shim.cjs`
- Create: `src/resources/run-compat/stdlib/permissions.ts`
- Create: `src/resources/run-compat/run-stdlib.json`
- Move: `src/resources/deno_std/run_import_map.json` -> `src/resources/run-compat/deno/run_import_map.json`
- Create: `tools/node-bundle/build-run-stdlib.mjs`
- Modify: `package.json` (root; dependencies)
- Modify: `.gitignore` (`src/resources/run-stdlib/`)
- Modify: `package/src/common/configure.ts` (build stdlib after preview js), `package/src/common/prepare-dist.ts` (build into `share/run-stdlib`)
- Create: `src/tools/impl/deno.ts`
- Modify: `src/tools/tools.ts:32-38`
- Modify: `.github/workflows/test-install.yml` (new job)
- Modify: `news/changelog-1.11.md`
- Test: `tests/unit/run-compat-hooks.test.ts`, `tests/unit/run-compat-shim.test.ts`, `tests/unit/run-stdlib-manifest.test.ts`, `tests/smoke/run/run-script-node.test.ts`; existing `tests/smoke/run/*.test.ts`, `tests/smoke/project/project-prepost.test.ts` must pass unchanged

### Acceptance criteria

- `quarto run tests/docs/run/test-stdlib.ts` (imports `readLines` from `stdlib/io`) exits 0 on Linux and macOS (the existing `stdlib-run-version.test.ts`, which also stays `ignore: isWindows`).
- All of `tests/smoke/run/run-script.test.ts` pass (`console.log` script, stdout/stderr separation).
- `tests/smoke/project/project-prepost.test.ts` passes with the fixtures unchanged, and the render log contains exactly one shim notice per script process.
- A script `console.log(typeof Deno.readDir)` fails with the message naming `fs.readdirSync`.
- `QUARTO_RUN_DENO_SHIM_QUIET=1` suppresses the notice.
- `quarto run --dev tools/check-runtime-boundary.ts` works (bundled, source-mapped).
- `quarto install deno` downloads the latest Deno release into `quartoDataDir("deno")`; `quarto check` lists `Deno: v2.x.y`; `quarto run script.ts` then runs on Deno (`QUARTO_RUN_DENO=0 quarto run` goes back to Node); `quarto uninstall deno` removes it.
- `QUARTO_RUN_DENO=1 quarto run x.ts` without Deno installed prints `Deno is not installed. Run 'quarto install deno' or unset QUARTO_RUN_DENO.` and exits 1.
- `share/run-stdlib/` in a `prepare-dist` output contains 36 `.js` files, a `package.json` (`{ "type": "module" }`) and no `.map`; `share/run-compat/` contains `register.cjs`, `deno-shim.cjs`, `deno/run_import_map.json`; `share/deno_std/` is absent from the output (`prepare-dist` no longer copies it; PR 37 deletes the source directory).

## Plan

### Task 1: The stdlib manifest and builder

**Files:**
- Create: `src/resources/run-compat/run-stdlib.json`
- Create: `src/resources/run-compat/stdlib/permissions.ts`
- Create: `tools/node-bundle/build-run-stdlib.mjs`
- Modify: `package.json`, `.gitignore`
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
const manifestPath = join(root, "src", "resources", "run-compat", "run-stdlib.json");

unitTest("run-stdlib manifest covers every name of the Deno import map", () => {
  const manifest = JSON.parse(readTextFileSync(manifestPath)) as Record<string, { entry: string; default?: boolean }>;
  const denoMap = JSON.parse(
    readTextFileSync(join(root, "src", "resources", "run-compat", "deno", "run_import_map.json")),
  ).imports as Record<string, string>;
  const names = Object.keys(denoMap).map((k) => k.replace(/^stdlib\//, "")).sort();
  assertEquals(Object.keys(manifest).sort(), names);
  assertEquals(names.length, 36);
  for (const [name, spec] of Object.entries(manifest)) {
    if (spec.entry.endsWith(".ts")) {
      assert(existsSync(join(root, spec.entry)), `${name}: ${spec.entry} does not exist`);
    } else {
      const pkg = spec.entry.startsWith("@") ? spec.entry.split("/").slice(0, 2).join("/") : spec.entry.split("/")[0];
      const pkgJson = JSON.parse(readTextFileSync(join(root, "package.json")));
      assert(pkgJson.dependencies[pkg], `${name}: ${pkg} missing from package.json dependencies`);
    }
  }
});

unitTest("run-stdlib bundles exist in dev mode after configure", () => {
  const dir = join(root, "src", "resources", "run-stdlib");
  assert(existsSync(join(dir, "path.js")), "run `quarto-bld configure` first");
  assert(existsSync(join(dir, "fs.js")));
  assert(existsSync(join(dir, "juice.js")));
  assert(!existsSync(join(dir, "path.js.map")), "stdlib bundles ship without source maps");
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/run-stdlib-manifest.test.ts`
Expected: FAIL with `run_import_map.json` not found at the new path (the move happens in this task).

- [ ] **Step 3: Move the Deno import map and write the manifest**

```bash
mkdir -p src/resources/run-compat/deno src/resources/run-compat/stdlib
git mv src/resources/deno_std/run_import_map.json src/resources/run-compat/deno/run_import_map.json
```

`src/resources/run-compat/run-stdlib.json` (every key is a `stdlib/<key>` import name; `entry` is an npm specifier resolved from the root `node_modules` or a repository file bundled with the import map; `default: true` re-exports the default export too):

```json
{
  "tar": { "entry": "@jsr/std__archive/tar" },
  "async": { "entry": "@jsr/std__async" },
  "bytes": { "entry": "@jsr/std__bytes" },
  "collections": { "entry": "@jsr/std__collections" },
  "crypto": { "entry": "@jsr/std__crypto" },
  "datetime": { "entry": "@jsr/std__datetime" },
  "dotenv": { "entry": "@jsr/std__dotenv" },
  "ascii85": { "entry": "@jsr/std__encoding/ascii85" },
  "base32": { "entry": "@jsr/std__encoding/base32" },
  "base58": { "entry": "@jsr/std__encoding/base58" },
  "base64": { "entry": "@jsr/std__encoding/base64" },
  "base64url": { "entry": "@jsr/std__encoding/base64url" },
  "csv": { "entry": "@jsr/std__csv" },
  "front_matter": { "entry": "@jsr/std__front-matter" },
  "hex": { "entry": "@jsr/std__encoding/hex" },
  "jsonc": { "entry": "@jsr/std__jsonc" },
  "toml": { "entry": "@jsr/std__toml" },
  "varint": { "entry": "@jsr/std__encoding/varint" },
  "yaml": { "entry": "@jsr/std__yaml" },
  "flags": { "entry": "@jsr/std__flags" },
  "fmt_bytes": { "entry": "@jsr/std__fmt/bytes" },
  "fmt_colors": { "entry": "@jsr/std__fmt/colors" },
  "fmt_printf": { "entry": "@jsr/std__fmt/printf" },
  "fs": { "entry": "src/deno_ral/fs.ts" },
  "http": { "entry": "@jsr/std__http" },
  "io": { "entry": "@jsr/std__io" },
  "log": { "entry": "@jsr/std__log" },
  "mediaTypes": { "entry": "@jsr/std__media-types" },
  "path": { "entry": "src/deno_ral/path.ts" },
  "permissions": { "entry": "src/resources/run-compat/stdlib/permissions.ts" },
  "semver": { "entry": "@jsr/std__semver" },
  "streams": { "entry": "@jsr/std__streams" },
  "uuid": { "entry": "@jsr/std__uuid" },
  "juice": { "entry": "juice", "default": true }
}
```

(34 keys above plus `fmt_bytes`... count them: the Deno map has 36 entries; the test asserts equality, so copy the key list from `run_import_map.json` and add the two you are missing before running. The two most easily forgotten are `front_matter` and `mediaTypes`, which are already present above; if the test reports a difference, the missing name is the one it prints.)

`src/resources/run-compat/stdlib/permissions.ts`:

```ts
/*
 * permissions.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 *
 * Node has no permission prompts: every request is granted. Mirrors the
 * @std/permissions@0.224 API (grant, grantOrThrow).
 */
export interface PermissionDescriptor {
  name: string;
  path?: string;
  host?: string;
  command?: string;
  variable?: string;
}

export async function grant(
  ...descriptors: PermissionDescriptor[]
): Promise<PermissionDescriptor[] | undefined> {
  return descriptors;
}

export async function grantOrThrow(
  ..._descriptors: PermissionDescriptor[]
): Promise<void> {
  return;
}
```

- [ ] **Step 4: Add the packages to the root `package.json`**

Add to `dependencies` (versions are the ones `run_import_map.json` pins today; confirm each exists with `npm view <pkg>@<ver> version` before `npm install`):

```json
"@jsr/std__archive": "0.224.3",
"@jsr/std__async": "0.224.2",
"@jsr/std__bytes": "0.224.0",
"@jsr/std__collections": "0.224.2",
"@jsr/std__crypto": "0.224.0",
"@jsr/std__csv": "0.224.3",
"@jsr/std__datetime": "0.224.5",
"@jsr/std__dotenv": "0.224.2",
"@jsr/std__encoding": "0.224.3",
"@jsr/std__flags": "0.224.0",
"@jsr/std__fmt": "0.224.0",
"@jsr/std__front-matter": "0.224.3",
"@jsr/std__http": "0.224.5",
"@jsr/std__io": "0.224.8",
"@jsr/std__jsonc": "0.224.3",
"@jsr/std__log": "0.224.7",
"@jsr/std__media-types": "0.224.1",
"@jsr/std__semver": "0.224.3",
"@jsr/std__streams": "0.224.5",
"@jsr/std__toml": "0.224.1",
"@jsr/std__uuid": "0.224.3",
"@jsr/std__yaml": "0.224.3",
"juice": "10.0.0"
```

Where the root `package.json` from PR 26 already pins a different version of one of these for the CLI bundle (PR 26 used `@jsr/std__async@1.0.12` etc.), keep the CLI's version and add the 0.224 one under an npm alias so both coexist, e.g. `"std-run-async": "npm:@jsr/std__async@0.224.2"`, and use the alias name in `run-stdlib.json`. The manifest test derives the package name from the entry, so an alias is just another dependency key.

Then: `npm install --no-audit --no-fund` (updates `package-lock.json`), `git add package.json package-lock.json`.

Add to `.gitignore` under `# generated javascript`:

```
src/resources/run-stdlib/
```

- [ ] **Step 5: Write the builder**

```js
// tools/node-bundle/build-run-stdlib.mjs
//
// Copyright (C) 2026 Posit Software, PBC
//
// Build the `stdlib/<name>` modules that `quarto run` scripts import, one ESM
// bundle per name, from src/resources/run-compat/run-stdlib.json.
// Usage: node tools/node-bundle/build-run-stdlib.mjs --outdir <dir> [--force]
import * as esbuild from "esbuild";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bundle } from "./build.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const manifestPath = path.join(root, "src", "resources", "run-compat", "run-stdlib.json");

function parseArgs(argv) {
  const opts = { force: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--outdir") opts.outdir = path.resolve(argv[++i]);
    else if (argv[i] === "--force") opts.force = true;
    else throw new Error(`build-run-stdlib.mjs: unknown argument ${argv[i]}`);
  }
  if (!opts.outdir) throw new Error("usage: node tools/node-bundle/build-run-stdlib.mjs --outdir <dir> [--force]");
  return opts;
}

const opts = parseArgs(process.argv.slice(2));
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
fs.mkdirSync(opts.outdir, { recursive: true });
// The bundles are ESM; without this Node would have to detect the module
// syntax of each .js file (share/ has no package.json of its own).
fs.writeFileSync(path.join(opts.outdir, "package.json"), '{ "type": "module" }\n');

// Rebuild everything when the manifest or the lockfile changed, or when any
// output is missing. Individual staleness is not worth tracking: 36 small
// bundles take about a second in total.
const inputsMtime = Math.max(
  fs.statSync(manifestPath).mtimeMs,
  fs.statSync(path.join(root, "package-lock.json")).mtimeMs,
  fs.statSync(path.join(root, "src", "deno_ral", "fs.ts")).mtimeMs,
  fs.statSync(path.join(root, "src", "deno_ral", "path.ts")).mtimeMs,
);
const outputs = Object.keys(manifest).map((name) => path.join(opts.outdir, `${name}.js`));
const fresh = !opts.force && outputs.every((f) => fs.existsSync(f) && fs.statSync(f).mtimeMs >= inputsMtime);
if (fresh) {
  console.log(`run-stdlib up to date (${outputs.length} modules in ${path.relative(root, opts.outdir)})`);
  process.exit(0);
}

const t0 = Date.now();
for (const [name, spec] of Object.entries(manifest)) {
  const outfile = path.join(opts.outdir, `${name}.js`);
  if (spec.entry.endsWith(".ts")) {
    // repository file: goes through the import-map resolver of build.mjs
    await bundle({ entry: path.join(root, spec.entry), outfile, sourcemap: false });
  } else {
    // npm package: a one-line re-export module bundled from the repository root
    const contents = spec.default
      ? `export * from "${spec.entry}";\nexport { default } from "${spec.entry}";\n`
      : `export * from "${spec.entry}";\n`;
    await esbuild.build({
      stdin: { contents, resolveDir: root, sourcefile: `stdlib-${name}.js`, loader: "js" },
      bundle: true,
      platform: "node",
      format: "esm",
      target: "node26",
      outfile,
      sourcemap: false,
      logLevel: "warning",
      banner: {
        js: 'import { createRequire as __createRequire } from "node:module"; const require = __createRequire(import.meta.url);',
      },
    });
  }
}
console.log(`built ${outputs.length} run-stdlib modules into ${path.relative(root, opts.outdir)} (${Date.now() - t0} ms)`);
```

- [ ] **Step 6: Wire it into `configure` and `prepare-dist`**

In `package/src/common/configure.ts`, after the `Build completed.` line of the preview build (line 51):

```ts
  info("Building run-stdlib modules for `quarto run`...");
  buildRunStdlib(join(config.directoryInfo.src, "resources", "run-stdlib"));
```

In `package/src/common/prepare-dist.ts`, right after the `buildQuartoPreviewJs(..., true)` call and before `copyQuartoScript`:

```ts
  info("Building run-stdlib modules");
  buildRunStdlib(join(config.directoryInfo.pkgWorking.share, "run-stdlib"), true);
```

and in `supportingFiles()`, add `join(config.directoryInfo.pkgWorking.share, "deno_std")` to `pathsToClean` (the directory still exists in `src/resources` until PR 37 and must not ship), and `join(config.directoryInfo.pkgWorking.share, "run-stdlib")` is produced by the build above (the `src/resources` copy happens first and may contain a stale dev build; the `--force` rebuild overwrites it).

Add to `package/src/common/previewjs.ts` (same file, same pattern as the preview build):

```ts
export function buildRunStdlib(outDir: string, force?: boolean) {
  const root = env.get("QUARTO_ROOT");
  if (!root) {
    throw new Error("QUARTO_ROOT is not set (quarto-bld sets it from set_package_paths.sh / win_configuration.bat)");
  }
  const script = join(root, "tools", "node-bundle", "build-run-stdlib.mjs");
  const args = [script, "--outdir", outDir];
  if (force) args.push("--force");
  const result = execSync(execPath(), { args, cwd: root, stderr: "inherit", stdout: "inherit" });
  if (!result.success) {
    throw new Error("Failed to build run-stdlib modules");
  }
}
```

(add `import { env } from "../../../src/deno_ral/env.ts";` to `previewjs.ts`; `QUARTO_ROOT` is exported by `set_package_paths.sh`/`win_configuration.bat` for every `quarto-bld` invocation.)

- [ ] **Step 7: Run the builder and the test**

Run:
```bash
node tools/node-bundle/build-run-stdlib.mjs --outdir src/resources/run-stdlib
ls src/resources/run-stdlib | wc -l
cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/run-stdlib-manifest.test.ts
```
Expected: `built 36 run-stdlib modules ...`; `36`; `2 passed`.

- [ ] **Step 8: Commit**

```bash
git add src/resources/run-compat/run-stdlib.json src/resources/run-compat/stdlib/permissions.ts src/resources/run-compat/deno/run_import_map.json tools/node-bundle/build-run-stdlib.mjs package.json package-lock.json .gitignore package/src/common/configure.ts package/src/common/prepare-dist.ts package/src/common/previewjs.ts tests/unit/run-stdlib-manifest.test.ts
git commit -m "run: build stdlib/* modules for Node from a manifest"
```

### Task 2: The resolve hook (`register.cjs`)

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
import { join } from "../../src/deno_ral/path.ts";
import { makeTempDirSync } from "../../src/deno_ral/temp.ts";
import { removeSync, writeTextFileSync } from "../../src/deno_ral/fs.ts";
import { exec, execPath } from "../../src/deno_ral/process.ts";
import { env } from "../../src/deno_ral/env.ts";

const root = env.get("QUARTO_ROOT")!;
const register = join(root, "src", "resources", "run-compat", "register.cjs");
const stdlibDir = join(root, "src", "resources", "run-stdlib");

async function runScript(dir: string, name: string, source: string) {
  const file = join(dir, name);
  writeTextFileSync(file, source);
  const r = await exec(execPath(), {
    args: ["--require", register, file],
    cwd: dir,
    env: { QUARTO_RUN_STDLIB_DIR: stdlibDir, QUARTO_RUN_DENO_SHIM_QUIET: "1" },
  });
  return { ...r, out: new TextDecoder().decode(r.stdout), err: new TextDecoder().decode(r.stderr) };
}

unitTest("register.cjs resolves stdlib/* to the bundled modules", async () => {
  const dir = makeTempDirSync({ prefix: "hooks" });
  try {
    const r = await runScript(dir, "a.ts",
      'import { join } from "stdlib/path";\nimport { existsSync } from "stdlib/fs";\nconsole.log(join("a", "b"), existsSync("a.ts"));\n');
    assert(r.success, r.err);
    assertEquals(r.out.trim().replace("\\", "/"), "a/b true");
  } finally {
    removeSync(dir, { recursive: true });
  }
});

unitTest("register.cjs rejects unknown stdlib names and remote URLs with hints", async () => {
  const dir = makeTempDirSync({ prefix: "hooks" });
  try {
    const r1 = await runScript(dir, "b.ts", 'import "stdlib/nope";\n');
    assert(!r1.success);
    assertStringIncludes(r1.err, "stdlib/nope is not a known Quarto stdlib module");
    assertStringIncludes(r1.err, "stdlib/path");
    const r2 = await runScript(dir, "c.ts", 'import "https://deno.land/std@0.224.0/path/mod.ts";\n');
    assert(!r2.success);
    assertStringIncludes(r2.err, "use stdlib/path");
  } finally {
    removeSync(dir, { recursive: true });
  }
});

unitTest("register.cjs rewrites npm: and jsr: specifiers to node_modules", async () => {
  const dir = makeTempDirSync({ prefix: "hooks" });
  try {
    const r = await runScript(dir, "d.ts", 'import "npm:left-pad@1.3.0";\n');
    assert(!r.success);
    assertStringIncludes(r.err, "npm install left-pad");
    assertStringIncludes(r.err, dir);
  } finally {
    removeSync(dir, { recursive: true });
  }
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/run-compat-hooks.test.ts`
Expected: FAIL, `Cannot find module '.../register.cjs'`.

- [ ] **Step 3: Implement `register.cjs`**

```js
// register.cjs
//
// Copyright (C) 2026 Posit Software, PBC
//
// Preloaded with `node --require` by `quarto run` for .ts/.js scripts:
//  1. resolve hook (module.registerHooks, synchronous): stdlib/<name> -> the
//     bundles in $QUARTO_RUN_STDLIB_DIR; npm:/jsr: specifiers -> node_modules;
//     https: imports -> an error with a hint.
//  2. the Deno compatibility shim (./deno-shim.cjs), deprecated.
"use strict";
const { registerHooks } = require("node:module");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL, fileURLToPath } = require("node:url");

const kDocs = "https://quarto.org/docs/projects/scripts.html#typescript-scripts";
const stdlibDir = process.env.QUARTO_RUN_STDLIB_DIR;
if (!stdlibDir) {
  throw new Error("QUARTO_RUN_STDLIB_DIR is not set; run scripts through `quarto run`");
}
const stdlibNames = fs.readdirSync(stdlibDir)
  .filter((f) => f.endsWith(".js"))
  .map((f) => f.slice(0, -3))
  .sort();

function importerDir(context) {
  if (context.parentURL && context.parentURL.startsWith("file:")) {
    return path.dirname(fileURLToPath(context.parentURL));
  }
  return process.cwd();
}

function notInstalled(pkg, context, extra) {
  const dir = importerDir(context);
  return new Error(
    `Cannot find package '${pkg}' from ${dir}. ` +
      `Quarto runs scripts on Node.js, which loads packages from node_modules: run \`npm install ${pkg}\` in ${dir}.${extra} See ${kDocs}`,
  );
}

function resolve(specifier, context, nextResolve) {
  // stdlib/<name>
  if (specifier.startsWith("stdlib/")) {
    const name = specifier.slice("stdlib/".length);
    if (!stdlibNames.includes(name)) {
      throw new Error(
        `${specifier} is not a known Quarto stdlib module. Known modules: ${stdlibNames.map((n) => "stdlib/" + n).join(", ")}. See ${kDocs}`,
      );
    }
    // no `format` here: returning one would require a custom load hook (Node docs);
    // the outdir's package.json ("type": "module") makes the .js files ESM.
    return { url: pathToFileURL(path.join(stdlibDir, name + ".js")).href, shortCircuit: true };
  }
  // npm:pkg@ver/sub -> pkg/sub
  let m = specifier.match(/^npm:\/?((?:@[^/@]+\/)?[^/@]+)(?:@[^/]+)?(\/.*)?$/);
  if (m) {
    const target = m[1] + (m[2] ?? "");
    try {
      return nextResolve(target, context);
    } catch (e) {
      throw notInstalled(m[1], context, "");
    }
  }
  // jsr:@scope/name@ver/sub -> @jsr/scope__name/sub
  m = specifier.match(/^jsr:\/?@([^/@]+)\/([^/@]+)(?:@[^/]+)?(\/.*)?$/);
  if (m) {
    const pkg = `@jsr/${m[1]}__${m[2]}`;
    try {
      return nextResolve(pkg + (m[3] ?? ""), context);
    } catch (e) {
      throw notInstalled(pkg, context, " Add `@jsr:registry=https://npm.jsr.io` to .npmrc first.");
    }
  }
  // https://deno.land/std@x/<mod>/... -> stdlib/<mod>
  m = specifier.match(/^https:\/\/deno\.land\/std(?:@[^/]+)?\/([^/]+)\//);
  if (m) {
    const hint = stdlibNames.includes(m[1]) ? `use stdlib/${m[1]} instead` : "copy the module into your project";
    throw new Error(`Remote imports are not supported when Quarto runs scripts on Node.js (${specifier}): ${hint}. See ${kDocs}`);
  }
  if (/^https?:\/\//.test(specifier)) {
    throw new Error(`Remote imports are not supported when Quarto runs scripts on Node.js (${specifier}): copy the module into your project or install it with npm. See ${kDocs}`);
  }
  return nextResolve(specifier, context);
}

registerHooks({ resolve });

require("./deno-shim.cjs");
```

Before Task 3 exists, create a placeholder-free `deno-shim.cjs` is not allowed; instead write Task 3's file now (it is independent), then run both test files together in Task 3 step 5. For this task's step 4 only, temporarily comment out the last `require` line, run the hook test, then restore it before committing (the commit of this task includes the real shim from Task 3).

- [ ] **Step 4: Run the test**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/run-compat-hooks.test.ts`
Expected: `3 passed`.

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
import { join } from "../../src/deno_ral/path.ts";
import { makeTempDirSync } from "../../src/deno_ral/temp.ts";
import { readTextFileSync, removeSync, writeTextFileSync } from "../../src/deno_ral/fs.ts";
import { exec, execPath } from "../../src/deno_ral/process.ts";
import { env } from "../../src/deno_ral/env.ts";

const root = env.get("QUARTO_ROOT")!;
const register = join(root, "src", "resources", "run-compat", "register.cjs");
const stdlibDir = join(root, "src", "resources", "run-stdlib");

async function run(dir: string, source: string, extraEnv: Record<string, string> = {}) {
  const file = join(dir, "s.ts");
  writeTextFileSync(file, source);
  const r = await exec(execPath(), {
    args: ["--require", register, file, "one", "two"],
    cwd: dir,
    env: { QUARTO_RUN_STDLIB_DIR: stdlibDir, ...extraEnv },
  });
  return { ...r, out: new TextDecoder().decode(r.stdout), err: new TextDecoder().decode(r.stderr) };
}

unitTest("deno shim - fs, env, args, cwd, errors; one notice per process", async () => {
  const dir = makeTempDirSync({ prefix: "shim" });
  try {
    const r = await run(dir, `
Deno.writeTextFileSync("x.txt", "hello");
console.log(Deno.readTextFileSync("x.txt"), Deno.args.join(","), Deno.cwd() === process.cwd());
console.log(Deno.statSync("x.txt").isFile, Deno.env.get("SHIM_VAR"));
try { Deno.statSync("missing.txt"); } catch (e) { console.log(e instanceof Deno.errors.NotFound); }
Deno.removeSync("x.txt");
const d = await Deno.makeTempDir({ prefix: "q" });
Deno.mkdirSync(d + "/sub/deep", { recursive: true });
await Deno.remove(d, { recursive: true });
console.log(Deno.build.os.length > 0, typeof Deno.pid);
`, { SHIM_VAR: "v" });
    assert(r.success, r.err);
    assertEquals(r.out.trim().split("\n"), ["hello one,two true", "true v", "true", "true number"]);
    assertEquals((r.err.match(/Deno compatibility shim is deprecated/g) ?? []).length, 1);
    assertStringIncludes(r.err, "Deno.writeTextFileSync");
  } finally {
    removeSync(dir, { recursive: true });
  }
});

unitTest("deno shim - Deno.Command output() and outputSync()", async () => {
  const dir = makeTempDirSync({ prefix: "shim" });
  try {
    const r = await run(dir, `
const c = new Deno.Command(Deno.execPath(), { args: ["-e", "console.log('hi'); process.exit(3)"] });
const o = await c.output();
console.log(o.code, o.success, new TextDecoder().decode(o.stdout).trim());
const s = new Deno.Command(Deno.execPath(), { args: ["-e", "process.stdout.write('sync')"] }).outputSync();
console.log(new TextDecoder().decode(s.stdout));
`, { QUARTO_RUN_DENO_SHIM_QUIET: "1" });
    assert(r.success, r.err);
    assertEquals(r.out.trim().split("\n"), ["3 false hi", "sync"]);
    assertEquals(r.err, "");
  } finally {
    removeSync(dir, { recursive: true });
  }
});

unitTest("deno shim - unsupported members throw with the Node equivalent", async () => {
  const dir = makeTempDirSync({ prefix: "shim" });
  try {
    const r = await run(dir, `try { Deno.readDirSync("."); } catch (e) { console.log(e.message); }\n`, { QUARTO_RUN_DENO_SHIM_QUIET: "1" });
    assert(r.success, r.err);
    assertStringIncludes(r.out, "Deno.readDirSync is not available");
    assertStringIncludes(r.out, "fs.readdirSync");
  } finally {
    removeSync(dir, { recursive: true });
  }
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/run-compat-shim.test.ts`
Expected: FAIL (`Deno is not defined` or module not found).

- [ ] **Step 3: Implement `deno-shim.cjs`**

```js
// deno-shim.cjs
//
// Copyright (C) 2026 Posit Software, PBC
//
// A small, deprecated `Deno` global for `quarto run` scripts written for the
// Deno years. Covers the filesystem, environment and process calls seen in
// user scripts; everything else throws with the Node equivalent. Removed in
// Quarto 1.12. QUARTO_RUN_DENO_SHIM_QUIET=1 silences the notice.
"use strict";
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");

const kDocs = "https://quarto.org/docs/projects/scripts.html#migrating-from-deno";
let noticed = false;
function notice(member) {
  if (noticed || process.env.QUARTO_RUN_DENO_SHIM_QUIET === "1") return;
  noticed = true;
  process.stderr.write(
    `WARNING: this script uses the Deno API (Deno.${member}). Quarto runs scripts on Node.js and the Deno compatibility shim is deprecated: it will be removed in Quarto 1.12. Use Node.js APIs (process, node:fs) or run 'quarto install deno'. See ${kDocs}\n`,
  );
}

class NotFound extends Error { constructor(m) { super(m); this.name = "NotFound"; } }
class AlreadyExists extends Error { constructor(m) { super(m); this.name = "AlreadyExists"; } }
class PermissionDenied extends Error { constructor(m) { super(m); this.name = "PermissionDenied"; } }
const errors = { NotFound, AlreadyExists, PermissionDenied };

function translate(e) {
  if (!e || typeof e.code !== "string") return e;
  const Ctor = e.code === "ENOENT" ? NotFound : e.code === "EEXIST" ? AlreadyExists : (e.code === "EACCES" || e.code === "EPERM") ? PermissionDenied : null;
  if (!Ctor) return e;
  const err = new Ctor(e.message);
  err.cause = e;
  return err;
}
function sync(name, fn) {
  return (...args) => { notice(name); try { return fn(...args); } catch (e) { throw translate(e); } };
}
function async(name, fn) {
  return async (...args) => { notice(name); try { return await fn(...args); } catch (e) { throw translate(e); } };
}

function fileInfo(st) {
  return {
    isFile: st.isFile(), isDirectory: st.isDirectory(), isSymlink: st.isSymbolicLink(),
    size: st.size, mtime: st.mtime, atime: st.atime, birthtime: st.birthtime,
    mode: process.platform === "win32" ? null : st.mode, dev: st.dev, ino: st.ino,
  };
}
function writeOpts(o) {
  return { flag: o && o.append ? (o.create === false ? "r+" : "a") : (o && o.create === false ? "r+" : "w") };
}
function tempDir(o) {
  const dir = (o && o.dir) || os.tmpdir();
  return path.join(dir, (o && o.prefix) || "");
}

class Command {
  constructor(cmd, options = {}) { notice("Command"); this.cmd = cmd; this.options = options; }
  #spawnOptions() {
    const o = this.options;
    const map = (v, dflt) => v === "inherit" ? "inherit" : v === "null" ? "ignore" : v === "piped" ? "pipe" : dflt;
    return {
      cwd: o.cwd, env: o.env ? { ...process.env, ...o.env } : process.env,
      stdio: [map(o.stdin, "ignore"), map(o.stdout, "pipe"), map(o.stderr, "pipe")],
      shell: false, windowsHide: true,
    };
  }
  #result(code, signal, stdout, stderr) {
    return { code: code ?? 1, success: code === 0, signal: signal ?? null, stdout: new Uint8Array(stdout ?? []), stderr: new Uint8Array(stderr ?? []) };
  }
  output() {
    return new Promise((resolve, reject) => {
      const child = spawn(this.cmd, this.options.args ?? [], this.#spawnOptions());
      const out = [], err = [];
      if (child.stdout) child.stdout.on("data", (d) => out.push(d));
      if (child.stderr) child.stderr.on("data", (d) => err.push(d));
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

const supported = {
  readTextFile: async("readTextFile", (p) => fsp.readFile(p, "utf8")),
  readTextFileSync: sync("readTextFileSync", (p) => fs.readFileSync(p, "utf8")),
  readFile: async("readFile", async (p) => new Uint8Array(await fsp.readFile(p))),
  readFileSync: sync("readFileSync", (p) => new Uint8Array(fs.readFileSync(p))),
  writeTextFile: async("writeTextFile", (p, d, o) => fsp.writeFile(p, d, writeOpts(o))),
  writeTextFileSync: sync("writeTextFileSync", (p, d, o) => fs.writeFileSync(p, d, writeOpts(o))),
  writeFile: async("writeFile", (p, d, o) => fsp.writeFile(p, d, writeOpts(o))),
  writeFileSync: sync("writeFileSync", (p, d, o) => fs.writeFileSync(p, d, writeOpts(o))),
  stat: async("stat", async (p) => fileInfo(await fsp.stat(p))),
  statSync: sync("statSync", (p) => fileInfo(fs.statSync(p))),
  mkdir: async("mkdir", (p, o) => fsp.mkdir(p, { recursive: !!(o && o.recursive), mode: o && o.mode })),
  mkdirSync: sync("mkdirSync", (p, o) => { fs.mkdirSync(p, { recursive: !!(o && o.recursive), mode: o && o.mode }); }),
  remove: async("remove", (p, o) => fsp.rm(p, { recursive: !!(o && o.recursive), force: false })),
  removeSync: sync("removeSync", (p) => { fs.rmSync(p, { recursive: true, force: false }); }),
  cwd: sync("cwd", () => process.cwd()),
  makeTempDir: async("makeTempDir", (o) => fsp.mkdtemp(tempDir(o))),
  makeTempDirSync: sync("makeTempDirSync", (o) => fs.mkdtempSync(tempDir(o))),
  exit: (code) => { notice("exit"); process.exit(code ?? 0); },
  execPath: sync("execPath", () => process.execPath),
  env: {
    get: (k) => { notice("env.get"); return process.env[k]; },
    set: (k, v) => { notice("env.set"); process.env[k] = v; },
    delete: (k) => { notice("env.delete"); delete process.env[k]; },
    has: (k) => { notice("env.has"); return k in process.env; },
    toObject: () => { notice("env.toObject"); return { ...process.env }; },
  },
  Command,
  errors,
};
Object.defineProperty(supported, "args", { enumerable: true, get() { notice("args"); return process.argv.slice(2); } });
Object.defineProperty(supported, "pid", { enumerable: true, get() { notice("pid"); return process.pid; } });
supported.build = { os: process.platform === "win32" ? "windows" : process.platform, arch: process.arch === "x64" ? "x86_64" : process.arch === "arm64" ? "aarch64" : process.arch, target: "", vendor: "", env: undefined };
supported.version = { deno: "compat", node: process.versions.node, v8: process.versions.v8, typescript: "" };

// `removeSync` above is lenient about `recursive` on purpose: Deno throws on a
// non-empty directory without the flag, Node's rmSync does not expose the same
// error cleanly; scripts that relied on the throw are rare.
const equivalents = {
  readDir: "fs.readdirSync(path, { withFileTypes: true })", readDirSync: "fs.readdirSync(path, { withFileTypes: true })",
  run: "node:child_process (spawn)", serve: "node:http (createServer)", listen: "node:net (createServer)",
  connect: "node:net (connect)", watchFs: "fs.watch", openKv: "no equivalent (use a JSON file)",
  open: "fs.openSync", create: "fs.openSync(path, 'w')", chdir: "process.chdir", copyFile: "fs.copyFileSync",
  copyFileSync: "fs.copyFileSync", rename: "fs.renameSync", renameSync: "fs.renameSync", realPath: "fs.realpathSync",
  realPathSync: "fs.realpathSync", readLink: "fs.readlinkSync", readLinkSync: "fs.readlinkSync", symlink: "fs.symlinkSync",
  symlinkSync: "fs.symlinkSync", lstat: "fs.lstatSync", lstatSync: "fs.lstatSync", hostname: "os.hostname()",
  osRelease: "os.release()", addSignalListener: "process.on(signal, handler)", test: "node:test", inspect: "util.inspect",
  kill: "process.kill", stdin: "process.stdin", stdout: "process.stdout", stderr: "process.stderr",
  makeTempFile: "fs.mkdtempSync + fs.writeFileSync", makeTempFileSync: "fs.mkdtempSync + fs.writeFileSync",
  truncate: "fs.truncateSync", truncateSync: "fs.truncateSync", chmod: "fs.chmodSync", chmodSync: "fs.chmodSync",
  utime: "fs.utimesSync", utimeSync: "fs.utimesSync", permissions: "no equivalent (Node has no permission prompts)",
  dlopen: "no equivalent", upgradeWebSocket: "the ws package", memoryUsage: "process.memoryUsage()", consoleSize: "process.stdout.columns",
};

globalThis.Deno = new Proxy(supported, {
  get(target, prop) {
    if (prop in target || typeof prop === "symbol") return target[prop];
    const eq = equivalents[prop];
    throw new Error(
      `Deno.${String(prop)} is not available when Quarto runs scripts on Node.js. ` +
        (eq ? `Use ${eq}. ` : "Use the Node.js API or run 'quarto install deno'. ") +
        `See ${kDocs}`,
    );
  },
  has(target, prop) { return prop in target; },
});
```

- [ ] **Step 4: Run both unit test files**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/run-compat-hooks.test.ts unit/run-compat-shim.test.ts`
Expected: `6 passed`.

- [ ] **Step 5: Commit**

```bash
git add src/resources/run-compat/register.cjs src/resources/run-compat/deno-shim.cjs tests/unit/run-compat-hooks.test.ts tests/unit/run-compat-shim.test.ts
git commit -m "run: Node resolve hook for stdlib/* and a deprecated Deno shim for user scripts"
```

### Task 4: The `quarto install deno` tool

**Files:**
- Create: `src/tools/impl/deno.ts`
- Modify: `src/tools/tools.ts:32-38`

- [ ] **Step 1: Implement the tool**

```ts
/*
 * deno.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 *
 * `quarto install deno`: a Deno runtime for `quarto run` scripts that still
 * need Deno APIs. Downloaded from GitHub releases into the Quarto data dir.
 */

import { existsSync, readTextFileSync, safeRemoveSync, chmodSync, writeTextFileSync, ensureDirSync } from "../../deno_ral/fs.ts";
import { basename, join } from "../../deno_ral/path.ts";
import { arch, isWindows, os as platformOs } from "../../deno_ral/platform.ts";
import { warning } from "../../deno_ral/log.ts";
import { unzip } from "../../core/zip.ts";
import { quartoDataDir } from "../../core/appdirs.ts";
import { execProcess } from "../../core/process.ts";
import { InstallableTool, InstallContext, kUpdatePath, PackageInfo, RemotePackageInfo } from "../types.ts";
import { getLatestRelease } from "../github.ts";
import { createToolSymlink, removeToolSymlink } from "../tools.ts";

const kDenoRepo = "denoland/deno";
// The last Deno release Quarto shipped (configuration DENO before PR 33).
// Used when api.github.com is unreachable.
export const kDenoKnownGoodVersion = "v2.7.14";
const kVersionFileName = "version";

export function denoInstallDir(): string {
  return quartoDataDir("deno");
}

export function denoBinaryPath(): string {
  return join(denoInstallDir(), isWindows ? "deno.exe" : "deno");
}

export async function denoInstalled(): Promise<boolean> {
  return existsSync(denoBinaryPath());
}

function denoTarget(): string {
  const cpu = arch === "aarch64" ? "aarch64" : "x86_64";
  switch (platformOs) {
    case "windows":
      return "x86_64-pc-windows-msvc";
    case "darwin":
      return `${cpu}-apple-darwin`;
    default:
      return `${cpu}-unknown-linux-gnu`;
  }
}

export const denoInstallable: InstallableTool = {
  name: "Deno",
  prereqs: [],
  installed: denoInstalled,
  installDir: async () => (await denoInstalled()) ? denoInstallDir() : undefined,
  binDir: async () => (await denoInstalled()) ? denoInstallDir() : undefined,
  installedVersion,
  latestRelease,
  preparePackage,
  install,
  afterInstall,
  uninstall,
};

async function installedVersion(): Promise<string | undefined> {
  const versionFile = join(denoInstallDir(), kVersionFileName);
  if (existsSync(versionFile)) {
    return readTextFileSync(versionFile).trim();
  }
  if (await denoInstalled()) {
    const r = await execProcess({ cmd: denoBinaryPath(), args: ["--version"], stdout: "piped" });
    return r.stdout?.split("\n")[0]?.split(" ")[1];
  }
  return undefined;
}

async function latestRelease(): Promise<RemotePackageInfo> {
  const asset = `deno-${denoTarget()}.zip`;
  try {
    const release = await getLatestRelease(kDenoRepo);
    const found = release.assets.find((a) => a.name === asset);
    if (!found) {
      throw new Error(`release ${release.tag_name} has no asset ${asset}`);
    }
    return {
      url: release.html_url,
      version: release.tag_name,
      assets: [{ name: asset, url: found.browser_download_url }],
    };
  } catch (e) {
    warning(`Could not query the latest Deno release (${e instanceof Error ? e.message : String(e)}); using ${kDenoKnownGoodVersion}.`);
    return {
      url: `https://github.com/${kDenoRepo}/releases/tag/${kDenoKnownGoodVersion}`,
      version: kDenoKnownGoodVersion,
      assets: [{ name: asset, url: `https://github.com/${kDenoRepo}/releases/download/${kDenoKnownGoodVersion}/${asset}` }],
    };
  }
}

async function preparePackage(context: InstallContext): Promise<PackageInfo> {
  const pkgInfo = await latestRelease();
  const asset = pkgInfo.assets[0];
  const filePath = join(context.workingDir, asset.name);
  await context.download(`Deno ${pkgInfo.version}`, asset.url, filePath);
  return { filePath, version: pkgInfo.version };
}

async function install(pkgInfo: PackageInfo, context: InstallContext): Promise<void> {
  const dir = denoInstallDir();
  ensureDirSync(dir);
  await context.withSpinner({ message: `Unzipping ${basename(pkgInfo.filePath)}` }, async () => {
    const r = await unzip(pkgInfo.filePath, dir);
    if (!r.success) {
      throw new Error(`Failed to extract ${basename(pkgInfo.filePath)}\n${r.stderr}`);
    }
  });
  if (!isWindows) {
    chmodSync(denoBinaryPath(), 0o755);
  }
  writeTextFileSync(join(dir, kVersionFileName), pkgInfo.version);
}

async function afterInstall(context: InstallContext): Promise<boolean> {
  if (context.flags[kUpdatePath]) {
    await context.withSpinner({ message: "Updating PATH" }, async () => {
      await createToolSymlink(denoBinaryPath(), "deno", context);
    });
    return isWindows;
  }
  return false;
}

async function uninstall(context: InstallContext): Promise<void> {
  if (context.flags[kUpdatePath]) {
    await removeToolSymlink("deno");
  }
  await context.withSpinner({ message: "Removing Deno" }, async () => {
    const dir = denoInstallDir();
    if (existsSync(dir)) {
      safeRemoveSync(dir, { recursive: true });
    }
  });
}
```

`createToolSymlink`/`removeToolSymlink` are what `verapdf.ts` imports from `../tools.ts`; keep the same import.

- [ ] **Step 2: Register it**

In `src/tools/tools.ts` lines 32-38 add `deno: denoInstallable,` after `verapdf` and `import { denoInstallable } from "./impl/deno.ts";` next to the other `impl` imports. The `quarto install` help (`src/command/install/cmd.ts`) derives its list from `installableToolNames()`, so it shows `Deno` automatically; add an example after the Chrome one:

```ts
  .example(
    "Install Deno for `quarto run` scripts that use Deno APIs",
    "quarto install deno",
  )
```

- [ ] **Step 3: Try it**

Run: `package/dist/bin/quarto install deno --no-prompt && package/dist/bin/quarto check install 2>&1 | grep -i deno && ls "$(package/dist/bin/quarto tools 2>/dev/null | true)" ; ls ~/.local/share/quarto/deno 2>/dev/null || ls ~/Library/Application\ Support/quarto/deno`
Expected: the install spinner completes; `quarto check` prints `Deno: v2.x.y`; the data dir has `deno` and `version`.

- [ ] **Step 4: Commit**

```bash
git add src/tools/impl/deno.ts src/tools/tools.ts src/command/install/cmd.ts
git commit -m "tools: quarto install deno"
```

### Task 5: The run handlers

**Files:**
- Create: `src/core/run/typescript.ts`
- Modify: `src/core/run/deno.ts` (whole file)
- Modify: `src/core/run/register.ts:27-33`
- Modify: `src/command/run/run.ts:52-56`
- Test: `tests/smoke/run/run-script-node.test.ts`

- [ ] **Step 1: Write the failing smoke test**

```ts
/*
 * run-script-node.test.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 */
import { basename, join } from "../../../src/deno_ral/path.ts";
import { makeTempDirSync } from "../../../src/deno_ral/temp.ts";
import { removeSync, writeTextFileSync } from "../../../src/deno_ral/fs.ts";
import { assert, assertEquals, assertStringIncludes } from "../../asserts.ts";
import { execProcess } from "../../../src/core/process.ts";
import { quartoDevCmd } from "../../utils.ts";
import { quartoSpawnEnvOptions } from "../../quarto-cmd.ts";
import { unitTest } from "../../test.ts";

const workingDir = makeTempDirSync({ prefix: "run-node" });

function runTest(name: string, file: string, source: string, env: Record<string, string>, check: (stdout: string, stderr: string, success: boolean) => void) {
  const script = join(workingDir, file);
  writeTextFileSync(script, source);
  unitTest(name, async () => {
    const result = await execProcess(
      { cmd: quartoDevCmd(), args: ["run", basename(script)], ...quartoSpawnEnvOptions({ QUARTO_LOG_LEVEL: "CRITICAL", ...env }) },
      undefined, undefined, undefined, true,
    );
    check((result.stdout ?? "").replaceAll("\r", ""), (result.stderr ?? "").replaceAll("\r", ""), result.success);
  }, {
    cwd: () => workingDir,
    teardown: () => { removeSync(script); return Promise.resolve(); },
  });
}

runTest("run-node: Node globals and stdlib/path", "a.ts",
  'import { join } from "stdlib/path";\nconsole.log(process.versions.node.split(".")[0], join("x", "y").replace("\\\\", "/"));\n',
  { QUARTO_RUN_DENO: "0" },
  (out, _err, ok) => { assert(ok); assertEquals(out.trim(), "26 x/y"); });

runTest("run-node: Deno shim prints one notice", "b.ts",
  'Deno.writeTextFileSync("b.txt", "1"); Deno.removeSync("b.txt"); console.log("done");\n',
  { QUARTO_RUN_DENO: "0" },
  (out, err, ok) => { assert(ok); assertEquals(out.trim(), "done"); assertEquals((err.match(/shim is deprecated/g) ?? []).length, 1); });

runTest("run-node: QUARTO_RUN_DENO=1 without Deno installed is an error", "c.ts",
  'console.log("never");\n',
  { QUARTO_RUN_DENO: "1", XDG_DATA_HOME: join(workingDir, "empty-data"), LOCALAPPDATA: join(workingDir, "empty-data") },
  (_out, err, ok) => { assert(!ok); assertStringIncludes(err, "quarto install deno"); });
```

(The third test points the data dir at an empty location so a developer's own `quarto install deno` does not make it pass vacuously; on macOS `quartoDataDir` uses `~/Library/Application Support`, so mark that test `ignore: isMac` with a comment, or set `HOME` too.)

- [ ] **Step 2: Run it and see it fail**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/run/run-script-node.test.ts`
Expected: FAIL (the first test fails because the current handler calls the removed Deno binary).

- [ ] **Step 3: Write `typescript.ts`**

```ts
/*
 * typescript.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 *
 * `quarto run` handler for .ts/.js scripts on Node (default) or on a Deno
 * installed with `quarto install deno`.
 */

import { extname, join, normalize } from "../../deno_ral/path.ts";
import { env } from "../../deno_ral/env.ts";
import { exec, execPath } from "../../deno_ral/process.ts";
import { existsSync } from "../../deno_ral/fs.ts";
import { execProcess } from "../process.ts";
import { resourcePath } from "../resources.ts";
import { quartoCacheDir } from "../appdirs.ts";
import { md5HashSync } from "../hash.ts";
import { quartoConfig } from "../quarto.ts";
import { RunHandler, RunHandlerOptions } from "./types.ts";
import { denoRunHandler } from "./deno.ts";
import { denoInstalled } from "../../tools/impl/deno.ts";

export async function useDenoForScripts(): Promise<boolean> {
  const setting = env.get("QUARTO_RUN_DENO");
  if (setting === "0") {
    return false;
  }
  const installed = await denoInstalled();
  if (setting === "1" && !installed) {
    throw new Error(
      "Deno is not installed. Run 'quarto install deno' or unset QUARTO_RUN_DENO.",
    );
  }
  return setting === "1" || installed;
}

export const typescriptRunHandler: RunHandler = {
  canHandle: (script: string) => {
    return [".js", ".ts", ".mjs", ".mts"].includes(extname(script).toLowerCase());
  },
  run: async (script, args, stdin, options) => {
    if (options?.dev) {
      return runDevScript(script, args, stdin, options);
    }
    if (await useDenoForScripts()) {
      return denoRunHandler.run(script, args, stdin, options);
    }
    return runOnNode(script, args, stdin, options);
  },
};

// Node's own flags for scripts; the --require preload installs the stdlib/*
// resolve hook and the deprecated Deno shim.
function nodeFlags(): string[] {
  return [
    "--require",
    resourcePath("run-compat/register.cjs"),
    "--enable-experimental-regexp-engine",
    "--stack-trace-limit=100",
  ];
}

async function runOnNode(script: string, args: string[], stdin?: string, options?: RunHandlerOptions) {
  return await execProcess(
    {
      cmd: execPath(),
      args: [...nodeFlags(), script, ...args],
      ...options,
      env: {
        ...options?.env,
        QUARTO_RUN_STDLIB_DIR: resourcePath("run-stdlib"),
      },
    },
    stdin,
    undefined,
    undefined,
    true,
  );
}

// Repository tooling (`quarto run --dev tools/x.ts`) imports src/ modules by
// import-map names, so it is bundled like src/quarto.ts and run with source maps.
async function runDevScript(script: string, args: string[], stdin?: string, options?: RunHandlerOptions) {
  const srcDir = env.get("QUARTO_SRC_PATH") || join(quartoConfig.sharePath(), "../../src");
  const root = normalize(join(srcDir, ".."));
  const ensure = join(root, "tools", "node-bundle", "ensure.mjs");
  if (!existsSync(ensure)) {
    throw new Error(`quarto run --dev requires a source checkout (missing ${ensure})`);
  }
  const outfile = join(quartoCacheDir("run-dev"), md5HashSync(normalize(script)) + ".js");
  const built = await exec(execPath(), {
    args: [ensure, "--entry", script, "--outfile", outfile, "--watch-dir", srcDir, "--watch-dir", join(root, "tools")],
    cwd: root,
    stdout: "null",
    stderr: "inherit",
  });
  if (!built.success) {
    throw new Error(`Failed to bundle ${script}`);
  }
  return await execProcess(
    {
      cmd: execPath(),
      args: ["--enable-source-maps", "--enable-experimental-regexp-engine", "--stack-trace-limit=100", outfile, ...args],
      ...options,
    },
    stdin,
    undefined,
    undefined,
    true,
  );
}
```

- [ ] **Step 4: Retarget `deno.ts`**

Replace the whole file:

```ts
/*
 * deno.ts
 *
 * Copyright (C) 2020-2026 Posit Software, PBC
 *
 * `quarto run` handler that runs scripts on the Deno installed with
 * `quarto install deno` (see typescript.ts for when it is chosen).
 */

import { extname } from "../../deno_ral/path.ts";
import { env } from "../../deno_ral/env.ts";
import { quartoCacheDir } from "../appdirs.ts";
import { execProcess } from "../process.ts";
import { resourcePath } from "../resources.ts";
import { RunHandler } from "./types.ts";
import { denoBinaryPath } from "../../tools/impl/deno.ts";

export const denoRunHandler: RunHandler = {
  canHandle: (script: string) => {
    return [".js", ".ts"].includes(extname(script).toLowerCase());
  },
  run: async (script, args, stdin, options) => {
    // the stdlib/* import map of the Deno years; modules are fetched by Deno
    // into a cache under the Quarto cache dir (or must already be there with
    // QUARTO_RUN_NO_NETWORK=true)
    const importMap = resourcePath("run-compat/deno/run_import_map.json");
    const cachedOnly = env.get("QUARTO_RUN_NO_NETWORK") === "true";
    return await execProcess(
      {
        cmd: denoBinaryPath(),
        args: [
          "run",
          "--import-map",
          importMap,
          ...(cachedOnly ? ["--cached-only"] : []),
          "--allow-all",
          "--unstable-kv",
          "--unstable-ffi",
          script,
          ...args,
        ],
        ...options,
        env: {
          ...options?.env,
          DENO_DIR: quartoCacheDir("deno"),
          DENO_NO_UPDATE_CHECK: "1",
        },
      },
      stdin,
      undefined,
      undefined,
      true,
    );
  },
};
```

`run_import_map.json` still points `stdlib/ascii85` and friends at `https://deno.land/std@0.224.0/...` and `stdlib/juice` at `cdn.skypack.dev`; those hosts may disappear. In this file's header comment add: "If deno.land or skypack stop serving these, change the targets in `run_import_map.json` to the `jsr:@std/encoding@0.224.3/<name>` and `npm:juice@10.0.0` forms." Do not change them now: the test fixtures do not import them and a change needs a Deno to verify.

- [ ] **Step 5: Register and document**

`src/core/run/register.ts`: replace `import { denoRunHandler } from "./deno.ts";` with `import { typescriptRunHandler } from "./typescript.ts";` and `installRunHandler(denoRunHandler);` with `installRunHandler(typescriptRunHandler);`.

`src/command/run/run.ts` lines 52-56: description becomes

```ts
  .description(
    "Run a TypeScript, R, Python, or Lua script.\n\n" +
      "TypeScript and JavaScript scripts run on the Node.js runtime bundled with Quarto " +
      "(or on Deno after `quarto install deno`). For details, see:\n" +
      "https://quarto.org/docs/projects/scripts.html#periodic-scripts",
  )
```

- [ ] **Step 6: Run the tests**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/run/ smoke/project/project-prepost.test.ts`
Expected: all pass (`stdlib-run-version` is ignored on Windows as before). Then with Deno installed from Task 4: `QUARTO_RUN_DENO=1 package/dist/bin/quarto run tests/docs/run/test-stdlib.ts` exits 0 and `QUARTO_RUN_DENO=1 QUARTO_RUN_NO_NETWORK=true package/dist/bin/quarto run tests/docs/run/test-stdlib.ts` exits 0 on the second run (cache populated by the first).

- [ ] **Step 7: Commit**

```bash
git add src/core/run/typescript.ts src/core/run/deno.ts src/core/run/register.ts src/command/run/run.ts tests/smoke/run/run-script-node.test.ts
git commit -m "run: TypeScript scripts run on Node by default, on Deno when installed"
```

### Task 6: CI job for `quarto install deno`, changelog

**Files:**
- Modify: `.github/workflows/test-install.yml`
- Modify: `news/changelog-1.11.md`

- [ ] **Step 1: Add the job**

Append to `.github/workflows/test-install.yml` (same `matrix.os` style as the existing jobs; read the file's first job for the exact `uses: ./.github/workflows/actions/quarto-dev` step and copy it):

```yaml
  install-deno:
    runs-on: ${{ matrix.os }}
    strategy:
      fail-fast: false
      matrix:
        os: [ubuntu-latest, macos-latest, windows-latest]
    steps:
      - uses: actions/checkout@v6
      - uses: ./.github/workflows/actions/quarto-dev
      - name: Install Deno through quarto
        shell: bash
        run: |
          quarto install deno --no-prompt
          quarto check install 2>&1 | grep -E "Deno: v[0-9]"
      - name: Run a script on the installed Deno and on Node
        shell: bash
        run: |
          printf 'import { join } from "stdlib/path";\nconsole.log(join("a","b"), typeof Deno.version.deno);\n' > s.ts
          out=$(quarto run s.ts); echo "$out"; echo "$out" | grep -q "string"
          out=$(QUARTO_RUN_DENO=0 QUARTO_RUN_DENO_SHIM_QUIET=1 quarto run s.ts); echo "$out"; echo "$out" | grep -q "string"
          quarto uninstall deno --no-prompt
          ! quarto check install 2>&1 | grep -E "Deno: v[0-9]"
```

- [ ] **Step 2: Changelog**

Under `## Commands`, add `### \`run\``:

```markdown
- ([#NNNNN](https://github.com/quarto-dev/quarto-cli/pull/NNNNN)): `quarto run` and project `pre-render`/`post-render` TypeScript scripts now run on the Node.js runtime bundled with Quarto. `stdlib/*` imports keep working. Scripts that use the `Deno` API keep working through a compatibility shim that prints a one-time notice; the shim covers the filesystem, environment and process calls and will be removed in Quarto 1.12. `npm:` and `jsr:` imports resolve from the project's `node_modules`; remote `https:` imports are no longer supported.
- ([#NNNNN](https://github.com/quarto-dev/quarto-cli/pull/NNNNN)): Add `quarto install deno`, which installs a Deno runtime that `quarto run` then uses for TypeScript scripts (set `QUARTO_RUN_DENO=0` to keep using Node, `QUARTO_RUN_DENO=1` to require Deno).
```

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/test-install.yml news/changelog-1.11.md
git commit -m "ci: test quarto install deno; changelog for scripts on Node"
```

## Verification

- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/run-stdlib-manifest.test.ts unit/run-compat-hooks.test.ts unit/run-compat-shim.test.ts smoke/run/ smoke/project/project-prepost.test.ts`: all pass on Linux and macOS; Windows skips `stdlib-run-version` as before.
- `quarto run --dev tools/check-runtime-boundary.ts`: runs (bundled) and reports unchanged counts.
- `cd package/src && ./quarto-bld prepare-dist --set-version 99.9.9 && ls ../pkg-working/share/run-stdlib/*.js | wc -l` prints `36` (plus `package.json` in the directory); `ls ../pkg-working/share/run-compat` lists `register.cjs deno deno-shim.cjs run-stdlib.json stdlib`; `ls ../pkg-working/share/deno_std` fails.
- `cd package/pkg-working/bin && ./quarto run ../../../tests/docs/run/test-stdlib.ts` exits 0 (installed layout).
- `test-install.yml` green on the three OSes.

## Review checklist

- [ ] The 36 names in `run-stdlib.json` equal the keys of `run_import_map.json`; `fs`, `path`, `permissions` come from repository files; everything else from pinned 0.224 packages.
- [ ] `register.cjs` uses `module.registerHooks` (not `module.register`) and is loaded with `--require`; every error message carries the docs link; unknown `stdlib/*` lists the known names.
- [ ] The shim exposes exactly the listed members; every supported member calls `notice()`; the Proxy's `get` throws for everything else with a Node equivalent when one exists; `QUARTO_RUN_DENO_SHIM_QUIET=1` silences the notice.
- [ ] `useDenoForScripts()` semantics: `0` never, `1` required, unset auto.
- [ ] `denoRunHandler` sets `DENO_DIR` under the Quarto cache dir and no longer copies `share/deno_std/cache`.
- [ ] `prepare-dist` output contains `share/run-stdlib` and `share/run-compat` and no `share/deno_std`.
- [ ] Test fixtures under `tests/docs/project/prepost/` were not modified.
- [ ] Changelog states the 1.12 removal of the shim.

## Risks and rollback

- **A `stdlib/*` module calls `Deno.*` beyond the shim** (`@std/log` `FileHandler`, `@std/http` `serveDir`). Symptom: `Deno.openSync is not available ...` naming the equivalent. Mitigation: the error is explicit; `quarto install deno` restores the old behaviour. Add the member to the shim only if a widely used `stdlib` path needs it.
- **Type-stripping limits** (`enum` in user scripts): Node prints `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX`; documented in the scripts page; `quarto install deno` is the workaround.
- **`npm.jsr.io` availability** at `npm ci` time (build only, never at run time for users).
- **Windows path handling in the hook** (`file:` URLs with drive letters): covered by `pathToFileURL`/`fileURLToPath`; the hook tests run on the Windows matrix.
- **Rollback:** revert the PR; `.ts` scripts fail with "deno not found" until re-applied (PR 33 already removed Deno), so the rollback unit is PR 33 + 35 together, or an interim release note telling users to `quarto install deno`... which this PR adds. In practice: fix forward.

## Decisions needed

1. **Auto-prefer Deno when installed (as specified) vs require `QUARTO_RUN_DENO=1`.** Recommendation: keep auto-prefer; a user who runs `quarto install deno` did so to get Deno semantics, and `QUARTO_RUN_DENO=0` exists for the opposite case.
2. **Keep `stdlib/*` beyond 1.12.** Recommendation: yes, as long as the 0.224 packages bundle; they are build-time inputs only and cost nothing at run time. Revisit if a security advisory hits one of them.
