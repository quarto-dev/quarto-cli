# PR 36: `quarto call build-ts-extension` on esbuild with `package.json`; engine contract; Julia engine port

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `quarto call build-ts-extension` bundles engine extensions with the esbuild binary Quarto already ships, configured from `package.json` instead of `deno.json`; `@quarto/types` states that engines use the `QuartoAPI` object and web standards (no `Deno.*`); the bundled Julia engine is ported to that contract so it keeps working in the Node process.
**Phase:** 3. **Depends on:** PR 33 (Node runtime; engines load in-process through `import()` on Node). **Unblocks:** PR 37.
**Branch:** `rt/36-build-ts-extension-node`.
**Suggested executor:** Opus. The build command is a rewrite with user-facing error messages, and the Julia engine port replaces a hand-written TCP read loop; both need judgement.
**Size:** M (about 20 files: the command, `src/resources/extension-build/*`, `prepare-dist.ts`, the create template, the Julia engine source and bundle, `quarto-types` docs, tests, changelog).
**Ships on:** Node. Gates: PR 32 matrix, `tests/smoke/build-ts-extension/`, `tests/smoke/create/create.test.ts` (engine template), the merged `tests/smoke/julia-engine/` suite on CI runners with Julia.

## Spec

### Context

Assessment section 6 ("Engine extension authors") and Phase 3 step 4. Today `src/command/call/build-ts-extension/cmd.ts`:

- `resolveConfig()` (lines 37-77) reads `deno.json` from the current directory or falls back to `share/extension-build/deno.json` (`compilerOptions.lib: ["deno.ns", "DOM", "ES2021"]`, `importMap: ./import-map.json` mapping `@quarto/types`, `path`, `log`, `fs/`, `encoding/` to JSR std packages).
- `autoDetectEntryPoint()` (lines 79-158): CLI argument, then `bundle.entryPoint`, then the single `.ts` in `src/`, then `src/mod.ts`.
- `bundle()` (lines 250-325) runs **`deno bundle --config=<deno.json> --output=<file> [--minify] [--sourcemap] <entry>`** on the bundled Deno (`QUARTO_DENO` or `architectureToolsPath("deno")`, line 257). `deno bundle` is Deno 2's built-in esbuild wrapper that understands import maps and `jsr:` specifiers. `--check` runs `deno check` (lines 439-457). `--init-config` writes a `deno.json` with an absolute `importMap` path (lines 358-400).
- `prepare-dist.ts:121-124, 226-267` rewrites `share/extension-build/import-map.json` for distribution.

Engines are loaded in-process: `src/execute/engine.ts:232` does `await import(toFileUrl(engine.path).href)` and calls `init(getQuartoAPI())`. On Node this dynamic `import()` of a bundled ESM `.js` file works unchanged (the spike loaded the whole CLI that way). What breaks is the content of the bundles: anything that calls `Deno.*` at run time. There is one such engine in the tree: `src/resources/extension-subtrees/julia-engine/` (a git subtree of the upstream Julia engine repository, discovered as a "bundled subtree extension" by `src/extension/extension.ts:680-735`), whose `src/julia-engine.ts` has 21 `Deno.*` call sites (`Deno.build`, `Deno.removeSync`, `Deno.readTextFileSync`, `Deno.writeTextFileSync`, `Deno.env.get`, four `Deno.Command`, `Deno.writeFileSync`/`readFileSync`, `Deno.connect`, `Deno.Conn`/`Deno.TcpConn` types, `conn.read`, `Deno.consoleSize`, `Deno.stdout.writeSync`, `Deno.kill`) and imports `path`, `fs/exists`, `encoding/base64` through the import map and `jsr:@std/io@0.224.0/write-all` directly. Its checked-in `_extensions/julia-engine/julia-engine.js` (45 KB) carries 24 `Deno.` references. The `create` template for engines (`src/resources/create/extensions/engine/src/qstart-filesafename-qend.ejs.ts:94`) has one `Deno.readTextFileSync`.

Decisions:

- **Bundler:** the esbuild binary under `bin/tools/<arch>/esbuild` through `esbuildCommand()` in `src/core/esbuild.ts` (already used for OJS). No npm `esbuild` package is needed at run time. Flags: `--bundle --format=esm --platform=node --target=node26 --log-level=warning`, `--minify`, `--sourcemap` or `--sourcemap=inline`. With `--platform=node`, esbuild leaves `node:*` builtins external, which is what the in-process loader needs.
- **Config:** `package.json` in the extension project, section `"quarto": { "build": { "entryPoint", "outputFile", "minify", "sourcemap" } }`. Same keys as the old `bundle` section. A `deno.json` with a `bundle` section is still read for one release with a deprecation warning, so existing projects build before they migrate. Bare specifiers resolve from the project's `node_modules` (standard Node semantics); there is no import map. `@quarto/types` is type-only, so `import type { ... } from "@quarto/types"` is erased by esbuild and needs no mapping; a value import of it fails at bundle time with a message explaining that.
- **Type checking (`--check`):** Quarto does not ship `tsc` (about 9 MB). `--check` runs the project's own `node_modules/typescript/bin/tsc --noEmit -p tsconfig.json` with the bundled Node when present and otherwise explains how to add it. `--init-config` writes `package.json` (with `devDependencies.typescript`) and `tsconfig.json` (`moduleResolution: "bundler"`, `allowImportingTsExtensions`, `lib: ["ES2023", "DOM"]`, `types: []`, `paths["@quarto/types"]` -> the shipped `quarto-types.d.ts`).
- **Engine contract (documented in `packages/quarto-types/README.md` and the create template):** engines use the `QuartoAPI` object passed to `init()` and web-standard globals (`fetch`, `crypto.subtle`, `TextEncoder`, `URL`, `setTimeout`, streams). `Deno.*` is unavailable. Node built-ins (`node:fs`, `node:path`, `node:child_process`, `node:net`) work because engines run inside Quarto's Node process, and the Julia engine uses them where `QuartoAPI` has no equivalent (TCP, detached spawn); they are listed as "available, not guaranteed" so a future sandboxed loader can revisit.

Assumptions about earlier PRs:

- PR 13 (codemod of TS under `src/resources`) did **not** touch `src/resources/extension-subtrees/julia-engine/src/julia-engine.ts`, because the engine cannot import `src/deno_ral/` (it is bundled standalone). If it did, revert that part first: an engine bundle must not contain a copy of Quarto's runtime layer.
- PR 33 ships `node` and the Node launchers; `architectureToolsPath("esbuild")` is unchanged.
- PR 08/14: `env`, `exec`, `execPath` in `src/deno_ral/`; `execProcess` unchanged.

### Scope

In:
- `src/command/call/build-ts-extension/cmd.ts` (rewrite).
- `src/resources/extension-build/`: delete `deno.json`, `import-map.json`; add `tsconfig.template.json`; rewrite `README.md`.
- `package/src/common/prepare-dist.ts`: remove `updateImportMap`; keep copying `quarto-types.d.ts`.
- `tests/smoke/build-ts-extension/` fixture and assertions.
- `src/resources/create/extensions/engine/`: README and template (`Deno.readTextFileSync` -> `quarto.mappedString.fromFile`).
- `src/resources/extension-subtrees/julia-engine/src/julia-engine.ts` port and rebuilt `_extensions/julia-engine/julia-engine.js`; `README.md`/`AGENTS.md` lines that mention Deno.
- `packages/quarto-types/README.md` and `src/quarto-api.ts` doc comment; `llm-docs/quarto-api.md` one paragraph.
- Changelog; `dev-docs/runtime-migration/docs-updates.md` row for the engine page.

Out:
- Publishing `@quarto/types` to npm (the README says "not yet"; unchanged).
- Adding Node-only members to `QuartoAPI` (a TCP helper, a detached spawn). The Julia engine uses `node:net`/`node:child_process` directly; if more engines need them, a later PR adds API.
- The julia-engine test suite itself (merged by `.github/actions/merge-extension-tests`); only the source and bundle change.

### Interfaces

```ts
// src/command/call/build-ts-extension/cmd.ts
export interface ExtensionBuildConfig {
  entryPoint?: string;
  outputFile?: string;
  minify?: boolean;
  sourcemap?: boolean | "inline" | "external";
}
/** Reads ./package.json "quarto.build"; falls back to ./deno.json "bundle" with a deprecation warning; else {}. */
export function resolveConfig(cwd: string): { config: ExtensionBuildConfig; source: "package.json" | "deno.json" | "default" };
/** esbuild CLI arguments for a given config and output path (pure; unit tested). */
export function esbuildArgs(entryPoint: string, outputPath: string, config: ExtensionBuildConfig): string[];
export const buildTsExtensionCommand: Command;  // options: --check, --init-config; argument [entry-point]
```

`package.json` written by `--init-config` (name derived from the `_extensions/<name>` directory when exactly one exists, else `quarto-engine`):

```json
{
  "name": "<name>",
  "private": true,
  "type": "module",
  "quarto": {
    "build": {
      "entryPoint": "src/<name>.ts",
      "outputFile": "_extensions/<name>/<name>.js",
      "minify": false,
      "sourcemap": false
    }
  },
  "scripts": {
    "build": "quarto call build-ts-extension",
    "check": "quarto call build-ts-extension --check"
  },
  "devDependencies": {
    "typescript": "^5.9.3"
  }
}
```

`tsconfig.json` written by `--init-config` (from `share/extension-build/tsconfig.template.json` with `__QUARTO_TYPES__` replaced by the absolute path of the shipped `quarto-types.d.ts`):

```json
{
  "compilerOptions": {
    "strict": true,
    "noEmit": true,
    "target": "ES2023",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "lib": ["ES2023", "DOM"],
    "types": [],
    "skipLibCheck": true,
    "paths": { "@quarto/types": ["__QUARTO_TYPES__"] }
  },
  "include": ["src/**/*.ts"]
}
```

```ts
// src/resources/extension-subtrees/julia-engine/src/julia-engine.ts (new helper)
/** Newline-delimited TCP client over node:net, replacing Deno.connect + the byte loop. */
class LineSocket {
  static connect(port: number, host?: string): Promise<LineSocket>;
  readLine(): Promise<string | null>;   // null when the server closed the connection
  write(data: string): Promise<void>;
  close(): void;
}
```

### Files

- Modify: `src/command/call/build-ts-extension/cmd.ts` (whole file)
- Delete: `src/resources/extension-build/deno.json`, `src/resources/extension-build/import-map.json`
- Create: `src/resources/extension-build/tsconfig.template.json`
- Modify: `src/resources/extension-build/README.md` (whole file)
- Modify: `package/src/common/prepare-dist.ts:121-124,166-178,226-267`
- Modify: `tests/smoke/build-ts-extension/build-ts-extension.test.ts:17-35`, `tests/smoke/build-ts-extension/src/test-engine.ts:15,78`
- Create: `tests/smoke/build-ts-extension/src/util.ts`, `tests/smoke/build-ts-extension/package.json`
- Create: `tests/unit/build-ts-extension-args.test.ts`
- Modify: `src/resources/create/extensions/engine/README.ejs.md:20-41`, `src/resources/create/extensions/engine/src/qstart-filesafename-qend.ejs.ts:94`
- Modify: `src/resources/extension-subtrees/julia-engine/src/julia-engine.ts` (imports, 21 sites, `writeJuliaCommand` read loop), `_extensions/julia-engine/julia-engine.js` (rebuilt), `README.md:17`, `AGENTS.md:26,30`
- Modify: `packages/quarto-types/README.md`, `packages/quarto-types/src/quarto-api.ts:37-40`
- Modify: `llm-docs/quarto-api.md` (one "Runtime contract" paragraph)
- Modify: `news/changelog-1.11.md`, `dev-docs/runtime-migration/docs-updates.md`

### Acceptance criteria

- `cd tests/smoke/build-ts-extension && quarto call build-ts-extension` writes `_extensions/test-engine/test-engine.js` containing the local helper (`function helperFromUtil`) and `export default`, with no `Deno.` text; the smoke test passes.
- `quarto call build-ts-extension --init-config` in an empty extension project writes `package.json` and `tsconfig.json` as specified; after `npm install`, `quarto call build-ts-extension --check` runs `tsc` and passes for the test fixture.
- A project with only a legacy `deno.json` (`bundle.entryPoint`) still builds and prints `WARNING: deno.json is deprecated for quarto call build-ts-extension; move the "bundle" section to package.json "quarto.build" (quarto call build-ts-extension --init-config)`.
- A value import of `@quarto/types` fails with a message containing `@quarto/types only provides types; use "import type"`.
- `grep -c "Deno\." src/resources/extension-subtrees/julia-engine/_extensions/julia-engine/julia-engine.js` prints `0`; `tests/smoke/julia-engine/` passes on a runner with Julia (CI `merge-extension-tests` leg).
- `quarto create extension engine` followed by `quarto call build-ts-extension` and a render passes (`tests/smoke/create/create.test.ts`).
- `share/extension-build/` in a `prepare-dist` output contains `README.md`, `tsconfig.template.json`, `quarto-types.d.ts` and nothing else.

## Plan

### Task 1: esbuild argument builder and config resolution (unit tested)

**Files:**
- Modify: `src/command/call/build-ts-extension/cmd.ts`
- Test: `tests/unit/build-ts-extension-args.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
/*
 * build-ts-extension-args.test.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 */
import { unitTest } from "../test.ts";
import { assertEquals, assertStringIncludes } from "../asserts.ts";
import { join } from "../../src/deno_ral/path.ts";
import { makeTempDirSync } from "../../src/deno_ral/temp.ts";
import { removeSync, writeTextFileSync } from "../../src/deno_ral/fs.ts";
import { esbuildArgs, resolveConfig } from "../../src/command/call/build-ts-extension/cmd.ts";

unitTest("build-ts-extension: esbuild args", () => {
  assertEquals(esbuildArgs("src/e.ts", "_extensions/e/e.js", {}), [
    "--bundle", "--format=esm", "--platform=node", "--target=node26", "--log-level=warning",
    "--outfile=_extensions/e/e.js", "src/e.ts",
  ]);
  const full = esbuildArgs("src/e.ts", "out.js", { minify: true, sourcemap: "inline" });
  assertStringIncludes(full.join(" "), "--minify");
  assertStringIncludes(full.join(" "), "--sourcemap=inline");
  assertEquals(esbuildArgs("src/e.ts", "out.js", { sourcemap: true }).includes("--sourcemap"), true);
});

unitTest("build-ts-extension: config from package.json, deno.json fallback, default", () => {
  const dir = makeTempDirSync({ prefix: "btx" });
  try {
    assertEquals(resolveConfig(dir), { config: {}, source: "default" });
    writeTextFileSync(join(dir, "deno.json"), JSON.stringify({ bundle: { entryPoint: "src/a.ts", minify: true } }));
    assertEquals(resolveConfig(dir), { config: { entryPoint: "src/a.ts", minify: true }, source: "deno.json" });
    writeTextFileSync(join(dir, "package.json"), JSON.stringify({ quarto: { build: { entryPoint: "src/b.ts", sourcemap: "external" } } }));
    assertEquals(resolveConfig(dir), { config: { entryPoint: "src/b.ts", sourcemap: "external" }, source: "package.json" });
  } finally {
    removeSync(dir, { recursive: true });
  }
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/build-ts-extension-args.test.ts`
Expected: FAIL, `esbuildArgs`/`resolveConfig` are not exported (the current `resolveConfig` is async and private).

- [ ] **Step 3: Rewrite `cmd.ts`**

Replace the whole file:

```ts
/*
 * cmd.ts
 *
 * Copyright (C) 2025-2026 Posit Software, PBC
 *
 * quarto call build-ts-extension: bundle a TypeScript execution engine into a
 * single ESM file with Quarto's esbuild. Configuration lives in package.json
 * ("quarto.build"); a legacy deno.json "bundle" section is honoured with a
 * deprecation warning in 1.11.
 */

import { Command } from "cliffy/command/mod.ts";
import { error, info, warning } from "../../../deno_ral/log.ts";
import { resourcePath } from "../../../core/resources.ts";
import { esbuildCommand } from "../../../core/esbuild.ts";
import { execProcess } from "../../../core/process.ts";
import { basename, dirname, extname, join } from "../../../deno_ral/path.ts";
import { existsSync, mkdirSync, readDirSync, readTextFileSync, writeTextFileSync } from "../../../deno_ral/fs.ts";
import { expandGlobSync } from "../../../core/deno/expand-glob.ts";
import { cwd, execPath, exit } from "../../../deno_ral/process.ts";
import { readYaml } from "../../../core/yaml.ts";

export interface ExtensionBuildConfig {
  entryPoint?: string;
  outputFile?: string;
  minify?: boolean;
  sourcemap?: boolean | "inline" | "external";
}

interface BuildOptions {
  check?: boolean;
  initConfig?: boolean;
}

const kDocs = "https://quarto.org/docs/extensions/engine.html";

export function resolveConfig(
  dir: string,
): { config: ExtensionBuildConfig; source: "package.json" | "deno.json" | "default" } {
  const packageJson = join(dir, "package.json");
  if (existsSync(packageJson)) {
    const pkg = JSON.parse(readTextFileSync(packageJson)) as { quarto?: { build?: ExtensionBuildConfig } };
    return { config: pkg.quarto?.build ?? {}, source: "package.json" };
  }
  const denoJson = join(dir, "deno.json");
  if (existsSync(denoJson)) {
    const deno = JSON.parse(readTextFileSync(denoJson)) as { bundle?: ExtensionBuildConfig };
    return { config: deno.bundle ?? {}, source: "deno.json" };
  }
  return { config: {}, source: "default" };
}

export function esbuildArgs(entryPoint: string, outputPath: string, config: ExtensionBuildConfig): string[] {
  const args = ["--bundle", "--format=esm", "--platform=node", "--target=node26", "--log-level=warning"];
  if (config.minify) {
    args.push("--minify");
  }
  if (config.sourcemap === true || config.sourcemap === "external") {
    args.push("--sourcemap");
  } else if (config.sourcemap === "inline") {
    args.push("--sourcemap=inline");
  }
  args.push(`--outfile=${outputPath}`, entryPoint);
  return args;
}

function autoDetectEntryPoint(configEntryPoint?: string): string {
  if (configEntryPoint) {
    if (!existsSync(configEntryPoint)) {
      error(`Entry point specified in the build configuration does not exist: ${configEntryPoint}`);
      exit(1);
    }
    return configEntryPoint;
  }
  const srcDir = "src";
  if (!existsSync(srcDir)) {
    error("No src/ directory found.\n");
    error("Create a TypeScript file in src/:");
    error("  mkdir -p src");
    error("  touch src/my-engine.ts\n");
    error("Or specify the entry point as argument:");
    error("  quarto call build-ts-extension src/my-engine.ts\n");
    error('Or set "quarto.build.entryPoint" in package.json (quarto call build-ts-extension --init-config).');
    exit(1);
  }
  const tsFiles: string[] = [];
  for (const entry of readDirSync(srcDir)) {
    if (entry.isFile && entry.name.endsWith(".ts")) {
      tsFiles.push(entry.name);
    }
  }
  if (tsFiles.length === 0) {
    error("No .ts files found in src/\n");
    error("Create a TypeScript file:");
    error("  touch src/my-engine.ts");
    exit(1);
  }
  if (tsFiles.length === 1) {
    return join(srcDir, tsFiles[0]);
  }
  if (tsFiles.includes("mod.ts")) {
    return join(srcDir, "mod.ts");
  }
  error(`Multiple .ts files found in src/: ${tsFiles.join(", ")}\n`);
  error("Specify the entry point as argument:");
  error("  quarto call build-ts-extension src/my-engine.ts\n");
  error("Or rename one file to mod.ts, or set \"quarto.build.entryPoint\" in package.json.");
  exit(1);
}

function inferFilename(entryPoint: string): string {
  return `${basename(entryPoint, extname(entryPoint))}.js`;
}

function extensionDirs(): string[] {
  const dirs: string[] = [];
  if (!existsSync("_extensions")) {
    return dirs;
  }
  for (const entry of expandGlobSync("_extensions/**/_extension.yml")) {
    dirs.push(dirname(entry.path));
  }
  return dirs;
}

function inferOutputPath(outputFilename: string, userSpecifiedFilename?: string): string {
  const extensionName = basename(outputFilename, extname(outputFilename));
  const dirs = extensionDirs();
  if (!existsSync("_extensions")) {
    error("No _extensions/ directory found.\n");
    if (userSpecifiedFilename) {
      error(`You specified outputFile: "${userSpecifiedFilename}" in package.json.`);
      error("To write to the current directory, use a path prefix:");
      error(`  "outputFile": "./${userSpecifiedFilename}"\n`);
      error("Or create an extension structure:");
    } else {
      error("Extension projects must have an _extensions/ directory with _extension.yml.");
      error("Create the extension structure:");
    }
    error(`  mkdir -p _extensions/${extensionName}`);
    error(`  touch _extensions/${extensionName}/_extension.yml`);
    exit(1);
  }
  if (dirs.length === 0) {
    error("No _extension.yml found in _extensions/ subdirectories.\n");
    error("Create the extension metadata:");
    error(`  touch _extensions/${extensionName}/_extension.yml`);
    exit(1);
  }
  if (dirs.length > 1) {
    const names = dirs.map((d) => d.replace(/^.*_extensions\//, ""));
    error(`Multiple extension directories found: ${names.join(", ")}\n`);
    error('Set "quarto.build.outputFile" in package.json to the full path, e.g.');
    error(`  "outputFile": "_extensions/${names[0]}/${outputFilename}"`);
    exit(1);
  }
  return join(dirs[0], outputFilename);
}

async function bundle(entryPoint: string, config: ExtensionBuildConfig): Promise<void> {
  info("Bundling...");
  let outputPath: string;
  if (config.outputFile) {
    const specified = config.outputFile;
    outputPath = (!specified.includes("/") && !specified.includes("\\"))
      ? inferOutputPath(specified, specified)
      : specified;
  } else {
    outputPath = inferOutputPath(inferFilename(entryPoint));
  }
  const outputDir = dirname(outputPath);
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }
  try {
    await esbuildCommand(esbuildArgs(entryPoint, outputPath, config), "", cwd());
  } catch (e) {
    // esbuildCommand prints esbuild's stderr and (after this PR) includes it
    // in the thrown error's message, so the hint below can inspect it.
    const text = e instanceof Error ? e.message : String(e);
    error("esbuild failed");
    if (text.includes("@quarto/types")) {
      error('@quarto/types only provides types; use "import type { ... } from \\"@quarto/types\\"".');
    }
    error(`Bare imports resolve from this project's node_modules (npm install <package>). See ${kDocs}`);
    exit(1);
  }
  validateExtensionYml(outputPath);
  info(`Built ${entryPoint} -> ${outputPath}`);
}

function validateExtensionYml(outputPath: string): void {
  const extensionYmlPath = join(dirname(outputPath), "_extension.yml");
  if (!existsSync(extensionYmlPath)) {
    return;
  }
  try {
    const yml = readYaml(extensionYmlPath);
    const engines = yml?.contributes?.engines;
    if (Array.isArray(engines)) {
      const outputFilename = basename(outputPath);
      for (const engine of engines) {
        const enginePath = typeof engine === "string" ? engine : engine?.path;
        if (enginePath && enginePath !== outputFilename) {
          warning(`_extension.yml specifies engine path "${enginePath}" but built file is "${outputFilename}"`);
          warning(`  Update _extension.yml to: path: ${outputFilename}`);
        }
      }
    }
  } catch {
    // Ignore YAML parsing errors
  }
}

function quartoTypesPath(): string {
  // distribution: share/extension-build/quarto-types.d.ts (copied by prepare-dist)
  const shipped = resourcePath("extension-build/quarto-types.d.ts");
  if (existsSync(shipped)) {
    return shipped;
  }
  // dev checkout: packages/quarto-types/dist/index.d.ts (npm run build there)
  return join(resourcePath(), "..", "..", "packages", "quarto-types", "dist", "index.d.ts");
}

async function typeCheck(): Promise<void> {
  const tsc = join(cwd(), "node_modules", "typescript", "bin", "tsc");
  const tsconfig = join(cwd(), "tsconfig.json");
  if (!existsSync(tsc) || !existsSync(tsconfig)) {
    error("Type checking needs TypeScript in this project and a tsconfig.json.\n");
    error("  quarto call build-ts-extension --init-config   # writes package.json and tsconfig.json");
    error("  npm install                                     # installs typescript");
    exit(1);
  }
  info("Type-checking...");
  const result = await execProcess({ cmd: execPath(), args: [tsc, "--noEmit", "-p", tsconfig], cwd: cwd() });
  if (!result.success) {
    error("Type check failed\n");
    error("See errors above. Fix type errors in your code or adjust compilerOptions in tsconfig.json.");
    exit(1);
  }
  info("Type check passed");
}

function initializeConfig(): void {
  const dirs = extensionDirs();
  const name = dirs.length === 1 ? basename(dirs[0]) : "quarto-engine";
  const packageJson = "package.json";
  const tsconfig = "tsconfig.json";
  if (existsSync(packageJson) && JSON.parse(readTextFileSync(packageJson)).quarto?.build) {
    error('package.json already has a "quarto.build" section; nothing to do.');
    exit(1);
  }
  const pkg = existsSync(packageJson) ? JSON.parse(readTextFileSync(packageJson)) : { name, private: true, type: "module" };
  pkg.quarto = {
    ...(pkg.quarto ?? {}),
    build: {
      entryPoint: `src/${name}.ts`,
      outputFile: `_extensions/${name}/${name}.js`,
      minify: false,
      sourcemap: false,
    },
  };
  pkg.scripts = { ...(pkg.scripts ?? {}), build: "quarto call build-ts-extension", check: "quarto call build-ts-extension --check" };
  pkg.devDependencies = { typescript: "^5.9.3", ...(pkg.devDependencies ?? {}) };
  writeTextFileSync(packageJson, JSON.stringify(pkg, null, 2) + "\n");
  info(`Wrote ${packageJson}`);

  if (!existsSync(tsconfig)) {
    const template = readTextFileSync(resourcePath("extension-build/tsconfig.template.json"));
    writeTextFileSync(tsconfig, template.replace("__QUARTO_TYPES__", quartoTypesPath().replaceAll("\\", "/")));
    info(`Wrote ${tsconfig} (types: ${quartoTypesPath()})`);
  } else {
    info(`${tsconfig} exists; add "paths": { "@quarto/types": ["${quartoTypesPath()}"] } to compilerOptions if missing`);
  }
  if (existsSync("deno.json")) {
    warning("deno.json is no longer used by quarto call build-ts-extension; delete it once package.json is in place.");
  }
  info("");
  info("Next: npm install, then quarto call build-ts-extension");
}

export const buildTsExtensionCommand = new Command()
  .name("build-ts-extension")
  .arguments("[entry-point:string]")
  .description(
    "Build TypeScript execution engine extensions.\n\n" +
      "Bundles a TypeScript engine into a single JavaScript file with Quarto's esbuild. " +
      "Engines use the QuartoAPI object and web standards; Deno APIs are not available.\n\n" +
      "The entry point is determined by:\n" +
      "  1. [entry-point] command-line argument (if specified)\n" +
      "  2. quarto.build.entryPoint in package.json (if specified)\n" +
      "  3. Single .ts file in src/ directory\n" +
      "  4. src/mod.ts (if multiple .ts files exist)",
  )
  .option("--check", "Type-check only with the project's TypeScript (skip bundling)")
  .option("--init-config", "Write package.json (quarto.build) and tsconfig.json")
  .action(async (options: BuildOptions, entryPointArg?: string) => {
    try {
      if (options.initConfig) {
        initializeConfig();
        return;
      }
      const { config, source } = resolveConfig(cwd());
      if (source === "deno.json") {
        warning(
          'deno.json is deprecated for quarto call build-ts-extension; move the "bundle" section to package.json "quarto.build" (quarto call build-ts-extension --init-config).',
        );
      } else if (source === "package.json") {
        info("Using build configuration from package.json");
      }
      const entryPoint = entryPointArg || autoDetectEntryPoint(config.entryPoint);
      info(`Entry point: ${entryPoint}`);
      if (options.check) {
        await typeCheck();
      } else {
        await bundle(entryPoint, config);
      }
    } catch (e) {
      error(e instanceof Error ? e.message : String(e));
      exit(1);
    }
  });
```

The `@quarto/types` hint relies on one change in `src/core/esbuild.ts` `esbuildCommand()` (line 109 today): replace `throw new Error("esbuild command failed");` with `throw new Error("esbuild command failed\n" + result.stderr);`. The other caller, `esbuildCompile` (OJS bundling), only propagates the error, so the extra text is harmless there.

- [ ] **Step 4: Run the test**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/build-ts-extension-args.test.ts`
Expected: `2 passed`.

- [ ] **Step 5: Commit**

```bash
git add src/command/call/build-ts-extension/cmd.ts src/core/esbuild.ts tests/unit/build-ts-extension-args.test.ts
git commit -m "build-ts-extension: bundle with Quarto's esbuild, configured from package.json"
```

### Task 2: Shipped resources and `prepare-dist`

**Files:**
- Delete: `src/resources/extension-build/deno.json`, `src/resources/extension-build/import-map.json`
- Create: `src/resources/extension-build/tsconfig.template.json`
- Modify: `src/resources/extension-build/README.md`
- Modify: `package/src/common/prepare-dist.ts:121-124,226-267`

- [ ] **Step 1: Resources**

```bash
git rm src/resources/extension-build/deno.json src/resources/extension-build/import-map.json
```

`src/resources/extension-build/tsconfig.template.json`: the JSON from the Interfaces section (with the literal `__QUARTO_TYPES__` placeholder).

`src/resources/extension-build/README.md`:

```markdown
# Extension Build Resources

Default files for `quarto call build-ts-extension`, which bundles TypeScript
execution engines with Quarto's esbuild (`bin/tools/<arch>/esbuild`).

## Files

- **tsconfig.template.json**: written to the extension project by
  `quarto call build-ts-extension --init-config` with `__QUARTO_TYPES__`
  replaced by the absolute path of `quarto-types.d.ts`. Used by `--check`
  (which runs the project's own `node_modules/typescript/bin/tsc`).
- **quarto-types.d.ts**: type definitions, copied from
  `packages/quarto-types/dist/index.d.ts` during packaging (`prepare-dist`).
  In a dev checkout, run `npm run build` in `packages/quarto-types` and the
  command finds `dist/index.d.ts` there.

## Engine contract

Engines run inside Quarto's Node.js process. They use the `QuartoAPI` object
passed to `init()` and web-standard globals. `Deno.*` is not available. Node
built-ins (`node:fs`, `node:net`, ...) work but are not part of the
compatibility promise; see `packages/quarto-types/README.md`.

Bare imports are resolved from the extension project's `node_modules`; there
is no import map. Type-only imports of `@quarto/types` are erased at bundle
time.
```

- [ ] **Step 2: `prepare-dist.ts`**

Delete lines 121-124 (`// Update extension-build import map for distribution` block) and the `updateImportMap` function (lines 226-267). Update the comment at lines 166-168 to:

```ts
  // Copy quarto-types to the extension-build directory (tsconfig.template.json
  // and README.md arrive with the resources copy in supportingFiles()).
```

Run: `cd package/src && ./quarto-bld prepare-dist --set-version 99.9.9 > /dev/null && ls ../pkg-working/share/extension-build`
Expected: `README.md  quarto-types.d.ts  tsconfig.template.json`.

- [ ] **Step 3: Commit**

```bash
git add src/resources/extension-build package/src/common/prepare-dist.ts
git commit -m "build-ts-extension: ship tsconfig template; drop the Deno import map"
```

### Task 3: Smoke test fixture

**Files:**
- Modify: `tests/smoke/build-ts-extension/src/test-engine.ts:15,78`
- Create: `tests/smoke/build-ts-extension/src/util.ts`, `tests/smoke/build-ts-extension/package.json`
- Modify: `tests/smoke/build-ts-extension/build-ts-extension.test.ts:17-35`
- Modify: `tests/smoke/build-ts-extension/README.md`

- [ ] **Step 1: Fixture**

`tests/smoke/build-ts-extension/src/util.ts`:

```ts
// A local module, so the test can check that esbuild bundled it.
export function helperFromUtil(input: string): string {
  return input.split(".").pop() ?? "";
}
```

In `src/test-engine.ts`: replace line 15 `import { extname } from "path";` with `import { helperFromUtil } from "./util.ts";` and line 78 `const _ext = extname(options.target.input);` with `const _ext = helperFromUtil(options.target.input);`.

`tests/smoke/build-ts-extension/package.json`:

```json
{
  "name": "test-engine",
  "private": true,
  "type": "module",
  "quarto": {
    "build": {
      "entryPoint": "src/test-engine.ts",
      "outputFile": "_extensions/test-engine/test-engine.js"
    }
  }
}
```

- [ ] **Step 2: Assertions**

Replace `verifyImportBundled` (lines 17-35 of the test):

```ts
const verifyImportBundled: Verify = {
  name: "Verify local import was bundled and no Deno API remains",
  verify: async () => {
    const bundlePath = "_extensions/test-engine/test-engine.js";
    const content = readTextFileSync(bundlePath);
    assert(content.includes("function helperFromUtil"), "Bundle does not contain the local helper; esbuild did not bundle ./util.ts");
    assert(content.includes("export {") || content.includes("export default"), "Bundle is not ESM");
    assert(!/\bDeno\./.test(content), "Bundle references Deno.*");
  },
};
```

(import `readTextFileSync` from `../../../src/deno_ral/fs.ts`.) Update `README.md` in that directory: replace the `deno.json` sentences with `package.json` (`quarto.build`) and delete the "inline imports" note.

- [ ] **Step 3: Run**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/build-ts-extension/build-ts-extension.test.ts`
Expected: passes; `git status` shows the rebuilt `_extensions/test-engine/test-engine.js` is untracked/ignored (it was before too).

- [ ] **Step 4: Commit**

```bash
git add tests/smoke/build-ts-extension
git commit -m "tests: build-ts-extension fixture uses package.json and a local import"
```

### Task 4: `quarto create extension engine` template

**Files:**
- Modify: `src/resources/create/extensions/engine/src/qstart-filesafename-qend.ejs.ts:94`
- Modify: `src/resources/create/extensions/engine/README.ejs.md:20-41`

- [ ] **Step 1: Template source**

Line 94: replace `quarto.markdownRegex.partition(Deno.readTextFileSync(file))` with `quarto.markdownRegex.partition(quarto.mappedString.fromFile(file).value)`.

Run: `grep -n "Deno\." src/resources/create/extensions/engine/src/qstart-filesafename-qend.ejs.ts` -> no output.

- [ ] **Step 2: README**

Replace lines 20-41 of `README.ejs.md`:

```markdown
### Building

```bash
quarto call build-ts-extension
```

This bundles `src/<%= filesafename %>.ts` into
`_extensions/<%= filesafename %>/<%= filesafename %>.js` with Quarto's esbuild.
Commit the built file together with the source.

Engines run inside Quarto's Node.js process and use the `QuartoAPI` object
passed to `init()` plus web-standard globals (`fetch`, `crypto.subtle`,
`TextEncoder`, `URL`). Deno APIs are not available. Packages installed with
`npm install` in this directory can be imported and are bundled.

To type-check, create the build configuration once and install TypeScript:

```bash
quarto call build-ts-extension --init-config   # package.json (quarto.build) and tsconfig.json
npm install
quarto call build-ts-extension --check
```
```

- [ ] **Step 3: Run the create smoke test**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/create/create.test.ts`
Expected: passes (the `engine` template builds and renders).

- [ ] **Step 4: Commit**

```bash
git add src/resources/create/extensions/engine
git commit -m "create: engine template uses the QuartoAPI and package.json build config"
```

### Task 5: Port the bundled Julia engine

**Files:**
- Modify: `src/resources/extension-subtrees/julia-engine/src/julia-engine.ts`
- Modify (regenerate): `src/resources/extension-subtrees/julia-engine/_extensions/julia-engine/julia-engine.js`
- Modify: `src/resources/extension-subtrees/julia-engine/README.md:17`, `AGENTS.md:26,30`

- [ ] **Step 1: Imports (lines 7-11)**

```ts
// Node built-ins (the engine runs inside Quarto's Node.js process)
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { copyFileSync, existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { connect, type Socket } from "node:net";
```

- [ ] **Step 2: Platform, extension dir, safe remove (lines 44-60)**

```ts
// Platform detection
const isWindows = process.platform === "win32";

// Extension directory (where the bundled JS and resource files live)
const extensionDir = dirname(fileURLToPath(import.meta.url));

// Module-level quarto API reference
let quarto: QuartoAPI;

// Safe file removal helper
function safeRemoveSync(file: string, options: { recursive?: boolean } = {}) {
  try {
    rmSync(file, { recursive: !!options.recursive });
  } catch (e) {
    if (existsSync(file)) {
      throw e;
    }
  }
}
```

- [ ] **Step 3: File reads and writes**

- Line 141: `Deno.readTextFileSync(file)` -> `readFileSync(file, "utf8")`.
- Line 230: `Deno.writeTextFileSync(ipynbPath, JSON.stringify(nb, null, 2));` -> `writeFileSync(ipynbPath, JSON.stringify(nb, null, 2));`.
- Line 466: `Deno.writeFileSync(projectToml, Deno.readFileSync(projectTomlTemplate));` -> `copyFileSync(projectTomlTemplate, projectToml);`.
- Lines 515, 519: `Deno.readTextFileSync(transportFile)` -> `readFileSync(transportFile, "utf8")`.
- `printJuliaServerLog`: `Deno.stdout.writeSync(Deno.readFileSync(juliaServerLogFile()));` -> `process.stdout.write(readFileSync(juliaServerLogFile()));`.
- Line 1062: `Deno.stdout.writeSync((new TextEncoder()).encode(status));` -> `process.stdout.write(status);`.

- [ ] **Step 4: Environment, console, signals**

- Line 331: `return Deno.env.get("QUARTO_JULIA") ?? "julia";` -> `return process.env.QUARTO_JULIA ?? "julia";`.
- Line 351: `let juliaProject = Deno.env.get("QUARTO_JULIA_PROJECT");` -> `let juliaProject = process.env.QUARTO_JULIA_PROJECT;`.
- Line 639: `return Deno.consoleSize().columns ?? null;` -> `return process.stdout.columns ?? null;` (keep the try/catch).
- Line 1077: `Deno.kill(transportOptions.pid, "SIGTERM");` -> `process.kill(transportOptions.pid, "SIGTERM");`.

- [ ] **Step 5: Processes (four `Deno.Command` sites)**

The `QUARTO_JULIA_PROJECT` test (lines 362-380):

```ts
      const result = await quarto.system.execProcess({
        cmd: juliaCmd(),
        args: ["--startup-file=no", `--project=${juliaProject}`, "-e", "using QuartoNotebookRunner"],
        env: {
          // ignore the main env
          "JULIA_LOAD_PATH": isWindows ? "@;@stdlib" : "@:@stdlib",
        },
        stdout: "piped",
        stderr: "piped",
      });
      if (!result.success) {
        throw Error(
          `Executing \`using QuartoNotebookRunner\` failed with QUARTO_JULIA_PROJECT="${juliaProject}". Ensure that this project exists, has QuartoNotebookRunner installed and is instantiated correctly.`,
        );
      }
```

The two detached server starts (lines 395-446): keep the argument lists exactly as they are and replace each `const command = new Deno.Command(<cmd>, { args: [...], env: {...} });` + `const result = command.outputSync(); if (!result.success) { throw new Error(new TextDecoder().decode(result.stderr)); }` with

```ts
      const result = await quarto.system.execProcess({
        cmd: <cmd>,
        args: [...same list...],
        env: { "JULIA_LOAD_PATH": <same value> },
        stdout: "piped",
        stderr: "piped",
      });
      if (!result.success) {
        throw new Error(result.stderr ?? "");
      }
```

(`startOrReuseJuliaServer` is already `async`.) `ensureQuartoNotebookRunnerEnvironment` (lines 467-477):

```ts
  const { success } = await quarto.system.execProcess({
    cmd: juliaCmd(),
    args: ["--startup-file=no", `--project=${runtimeDir}`, join(extensionDir, "ensure_environment.jl")],
  });
  if (!success) {
    throw (new Error("Ensuring an updated julia server environment failed"));
  }
```

`execProcess` merges `env` into the inherited environment, the same way `Deno.Command` did.

- [ ] **Step 6: TCP: `LineSocket` replaces `Deno.connect` and the read loop**

Add after the `safeRemoveSync` helper:

```ts
// Newline-delimited client for the QuartoNotebookRunner control server.
// Replaces Deno.connect() plus a hand-written chunk/newline loop.
class LineSocket {
  private buffered = "";
  private pending: Array<(line: string | null) => void> = [];
  private closed = false;

  private constructor(private readonly socket: Socket) {
    socket.setEncoding("utf8");
    socket.on("data", (chunk: string) => {
      this.buffered += chunk;
      this.flush();
    });
    socket.on("close", () => {
      this.closed = true;
      this.flush();
    });
    socket.on("error", () => {
      this.closed = true;
      this.flush();
    });
  }

  static connect(port: number, host = "127.0.0.1"): Promise<LineSocket> {
    return new Promise((resolve, reject) => {
      const socket = connect({ port, host });
      socket.once("connect", () => resolve(new LineSocket(socket)));
      socket.once("error", reject);
    });
  }

  private flush() {
    while (this.pending.length > 0) {
      const nl = this.buffered.indexOf("\n");
      if (nl !== -1) {
        const line = this.buffered.slice(0, nl);
        this.buffered = this.buffered.slice(nl + 1);
        this.pending.shift()!(line);
      } else if (this.closed) {
        this.pending.shift()!(null);
      } else {
        break;
      }
    }
  }

  readLine(): Promise<string | null> {
    return new Promise((resolve) => {
      this.pending.push(resolve);
      this.flush();
    });
  }

  write(data: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket.write(data, (err) => (err ? reject(err) : resolve()));
    });
  }

  close() {
    this.socket.destroy();
  }
}
```

Then:

- Line 532: `const conn = await Deno.connect({ port: transportOptions.port });` -> `const conn = await LineSocket.connect(transportOptions.port);`.
- Line 562: return type `Promise<Deno.TcpConn>` -> `Promise<LineSocket>`.
- Line 837: parameter `conn: Deno.Conn` -> `conn: LineSocket`.
- Lines 857-867 (HMAC): replace `const hmac = encodeBase64(signatureBytes);` with `const hmac = Buffer.from(signatureBytes).toString("base64");` and `await writeAll(conn, messageBytes);` with `await conn.write(message);` (delete the `messageBytes` line).
- Lines 869-926 (from `let restOfPreviousResponse = new Uint8Array(512);` to the line `trace(options, "received server response");`): replace the whole block with

```ts
  while (true) {
    const line = await conn.readLine();
    if (line === null) {
      throw new Error(`Julia server closed the connection while waiting for the response to "${command.type}"`);
    }
    const response = line;
    trace(options, "received server response");
```

and keep everything from `// one command should be sent, ended by a newline` on, replacing `const json = response.split("\n")[0];` with `const json = response;`. The `continue` for progress updates stays (it waits for the next line). The `conn.close()` calls (lines 553, 1064, 1118) are unchanged in spelling.

- [ ] **Step 7: Rebuild and verify**

```bash
cd src/resources/extension-subtrees/julia-engine
grep -n "Deno\.\|from \"path\"\|fs/exists\|encoding/base64\|jsr:" src/julia-engine.ts      # expect no output
../../../../package/dist/bin/quarto call build-ts-extension src/julia-engine.ts
grep -c "Deno\." _extensions/julia-engine/julia-engine.js                                    # expect 0
cd ../../../..
```

If Julia and `QuartoNotebookRunner` are available locally: `cd tests && ./run-tests.sh --agent $(ls docs/julia-engine 2>/dev/null >/dev/null && echo smoke/julia-engine/ || echo "")` after running `.github/actions/merge-extension-tests` steps by hand (`cp -r src/resources/extension-subtrees/julia-engine/tests/docs/julia-engine tests/docs/ && cp -r src/resources/extension-subtrees/julia-engine/tests/smoke/julia-engine tests/smoke/`). Otherwise rely on CI (the `test-smokes.yml` legs that run the merge action).

- [ ] **Step 8: Docs in the subtree**

- `README.md:17`: replace the sentence about "small Deno wrappers" with "A few system utilities (`delay`, `safeRemoveSync`, `LineSocket`) are implemented at the top of `src/julia-engine.ts` on Node built-ins; the engine uses the `QuartoAPI` for processes and logging."
- `AGENTS.md:26,30`: replace "Deno tests using `jsr:` imports" / "the deno bundled with quarto" with "tests run through quarto-cli's test runner (Node)". Keep the rest.

- [ ] **Step 9: Commit and upstream note**

```bash
git add src/resources/extension-subtrees/julia-engine
git commit -m "julia-engine: port to the QuartoAPI and Node built-ins; rebuild bundle"
```

The subtree's upstream repository is the one `src/command/dev-call/pull-git-subtree/cmd.ts` pulls from; after this PR merges, push the change upstream (`git subtree push --prefix=src/resources/extension-subtrees/julia-engine <remote> <branch>`) and open a PR there so the next pull does not revert it. Say so in the PR description.

### Task 6: `@quarto/types` contract and changelog

**Files:**
- Modify: `packages/quarto-types/README.md`, `packages/quarto-types/src/quarto-api.ts:37-40`
- Modify: `llm-docs/quarto-api.md`
- Modify: `news/changelog-1.11.md`, `dev-docs/runtime-migration/docs-updates.md`

- [ ] **Step 1: README section**

Insert after `## Usage` in `packages/quarto-types/README.md`:

```markdown
## Runtime contract

Engines are bundled to a single ESM file (`quarto call build-ts-extension`)
and loaded with `import()` inside Quarto's Node.js process. An engine may rely on:

- the `QuartoAPI` object passed to `init()` (markdown, mapped strings, paths,
  Jupyter helpers, `system.execProcess`, `system.tempContext`, console);
- web-standard globals available in Node.js: `fetch`, `crypto.subtle`,
  `TextEncoder`/`TextDecoder`, `URL`, timers, streams, `AbortController`.

`Deno.*` is not available (Quarto ran on Deno through 1.10; engines that used
it must be rebuilt against this contract). Node.js built-ins (`node:fs`,
`node:path`, `node:net`, `node:child_process`) work today because the engine
shares Quarto's process, but they are outside the contract: prefer the
`QuartoAPI` and ask for an API addition when something is missing.
```

Also update the doc comment at `packages/quarto-types/src/quarto-api.ts:37-40`:

```ts
/**
 * Global Quarto API interface, passed to an engine's init(). Together with
 * web-standard globals this is the supported surface for engines; Deno APIs
 * are not available (see README.md, "Runtime contract").
 */
```

Rebuild the types: `cd packages/quarto-types && npm run build` (updates `dist/index.d.ts`, which is checked in: confirm with `git status`).

- [ ] **Step 2: `llm-docs/quarto-api.md`**

Add a short section "Runtime contract" with the same three bullets and a pointer to `src/resources/extension-build/README.md`.

- [ ] **Step 3: Changelog and docs checklist**

Under `## Extensions`:

```markdown
- ([#NNNNN](https://github.com/quarto-dev/quarto-cli/pull/NNNNN)): `quarto call build-ts-extension` now bundles with Quarto's esbuild and reads its configuration from `package.json` (`quarto.build`); a `deno.json` `bundle` section still works in 1.11 with a deprecation warning. `--init-config` writes `package.json` and `tsconfig.json`; `--check` uses the project's own TypeScript. Engines use the `QuartoAPI` object and web standards; Deno APIs are no longer available to engines.
```

In `dev-docs/runtime-migration/docs-updates.md`, the `extensions/engine.qmd` row already names PR 36; append "config keys: `quarto.build.entryPoint|outputFile|minify|sourcemap`; `--init-config`, `--check` behaviour; runtime contract paragraph from `packages/quarto-types/README.md`".

- [ ] **Step 4: Commit**

```bash
git add packages/quarto-types llm-docs/quarto-api.md news/changelog-1.11.md dev-docs/runtime-migration/docs-updates.md
git commit -m "docs: engine runtime contract (QuartoAPI and web standards)"
```

## Verification

- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/build-ts-extension-args.test.ts smoke/build-ts-extension/ smoke/create/create.test.ts smoke/engine/ smoke/inspect/inspect-extensions.test.ts unit/extension/filter-bundled-engines.test.ts`: all pass.
- `grep -rn "Deno\." src/resources/extension-subtrees/julia-engine/src src/resources/create/extensions/engine tests/smoke/build-ts-extension/src` -> no output; `grep -c "Deno\." src/resources/extension-subtrees/julia-engine/_extensions/julia-engine/julia-engine.js` -> `0`.
- Manual: in a scratch directory, `quarto create extension engine` (name `demo`), `quarto call build-ts-extension`, `quarto render example.qmd`; then `quarto call build-ts-extension --init-config && npm install && quarto call build-ts-extension --check`.
- Legacy path: in the same directory, `rm package.json tsconfig.json && printf '{"bundle":{"entryPoint":"src/demo.ts"}}' > deno.json && quarto call build-ts-extension` prints the deprecation warning and builds.
- CI: the Julia legs of `test-smokes.yml` (which run `.github/actions/merge-extension-tests`) are green.
- `quarto run --dev tools/check-runtime-boundary.ts`: unchanged.

## Review checklist

- [ ] `cmd.ts` never references `deno bundle`, `deno check`, `QUARTO_DENO`, or `architectureToolsPath("deno")`.
- [ ] `esbuildArgs` output matches the unit test; `--platform=node` is present (builtins external).
- [ ] The `@quarto/types` value-import hint appears on esbuild resolution failures that mention it.
- [ ] `tsconfig.template.json` has `types: []` (engines do not get `@types/node` by default) and the `__QUARTO_TYPES__` placeholder; `--init-config` writes an absolute, forward-slash path.
- [ ] Julia engine: no `Deno.` in source or bundle; `LineSocket` handles a partial line followed by a close (returns the partial? no: it returns `null` only when no newline arrives before close, and the caller throws) and multiple lines in one chunk (progress updates).
- [ ] Julia engine env merging: `JULIA_LOAD_PATH` set per call, not globally.
- [ ] `packages/quarto-types/dist/index.d.ts` regenerated and committed.
- [ ] Subtree upstream PR referenced in the description.

## Risks and rollback

- **Third-party engines built with 1.9/1.10 that call `Deno.*`** fail at render time with `ReferenceError: Deno is not defined` inside the engine. The error surfaces as `Failed to import engine from <path>` (engine.ts:266) when it happens at module evaluation, or as a runtime error later. Mitigation: the changelog and the engine docs page tell authors to rebuild against the contract; the Julia engine port in this PR is the worked example. Rollback: none needed for Quarto itself; authors can pin Quarto 1.10.
- **Projects that already committed a `deno.json` for `build-ts-extension`** keep working in 1.11 (deprecation warning); the fallback is removed in 1.12.
- **`LineSocket` behaviour differences** (encoding, back-pressure): the protocol is small JSON lines; `setEncoding("utf8")` reassembles multi-byte characters across chunks, which the old byte loop did not guarantee. If the Julia suite shows hangs, log `readLine` calls with `trace()` and compare with the Deno-era transcript.
- **Rollback of the Julia port alone:** `git revert` the Task 5 commit; the engine then fails on Node, so this is only useful while debugging on a Deno-era checkout.

## Decisions needed

1. **Should `QuartoAPI` grow `system.connectTcp()` and `system.spawnDetached()` so the Julia engine needs no `node:` imports?** Recommendation: not in this PR; the engine is the only consumer and `node:net`/`node:child_process` are stable. Revisit when a second engine needs them (then move `LineSocket` into `src/core/api/`).
2. **Ship `typescript` with Quarto for `--check`?** Recommendation: no (9 MB, and extension authors already have npm); the `--init-config` flow installs it per project.
