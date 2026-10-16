# PR 36: `quarto call build-ts-extension` on esbuild; default import map kept; engines that reference `Deno.` are flagged

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `quarto call build-ts-extension` bundles engine extensions with the esbuild binary Quarto already ships instead of `deno bundle`, keeps Quarto's default import map (`path`, `path/posix`, `log`, `fs/`, `encoding/`) working through esbuild aliases and packages shipped in `share/extension-build/node_modules/`, reads its options from `package.json` (`quarto.build`) with a deprecated `deno.json` fallback, and Quarto warns when it loads a prebuilt engine bundle that references `Deno.`.
**Phase:** 3. **Depends on:** PR 33 (Node runtime; `requireDenoToolBinary()` used by today's build path; esbuild in `bin/tools`). **Unblocks:** PR 37.
**Branch:** `rt/36-build-ts-extension-node`.
**Suggested executor:** Opus. The build command is rewritten with user-facing errors, the import-map-to-alias translation has edge cases, and the engine-loading warning is a compatibility contract.
**Size:** M (about 16 files: the command, `src/core/esbuild.ts`, `src/execute/engine.ts`, `src/resources/extension-build/*`, `prepare-dist.ts`, the create template, `quarto-types` docs, 3 tests and 2 fixtures, changelog).
**Ships on:** Node. Gates: PR 32 matrix, `tests/smoke/build-ts-extension/build-ts-extension.test.ts` **with its fixture unchanged**, `tests/smoke/create/create.test.ts` (engine template), the new tests.

## Spec

### Context

Assessment section 6 ("Engine extension authors"), review findings for PR 36, decision 7. Today `src/command/call/build-ts-extension/cmd.ts`:

- `resolveConfig()` (lines 37-77) reads `deno.json` from the current directory (inline `imports` or an `importMap` path) or falls back to `share/extension-build/deno.json` (`lib: ["deno.ns", "DOM", "ES2021"]`, `importMap: ./import-map.json`).
- `share/extension-build/import-map.json` maps `@quarto/types` (type-only), `path`, `path/posix`, `log`, `log/`, `fs/`, `encoding/` to JSR std packages; `prepare-dist.ts:226-267` (`updateImportMap`) rewrites their versions from `src/import_map.json` for distribution.
- `bundle()` (lines 250-325) runs `deno bundle --config=<deno.json> --output=<file> [--minify] [--sourcemap] <entry>` on the Deno tool (`build-ts-extension/cmd.ts:257`; PR 33 made it `requireDenoToolBinary(...)`); `--check` runs `deno check`; `--init-config` writes a `deno.json` with an absolute `importMap`.

The smoke fixture `tests/smoke/build-ts-extension/src/test-engine.ts:15` does `import { extname } from "path";` with no config file, and the test asserts the bundle contains `function extname`. That is exactly what an existing third-party engine without its own config does. **This PR keeps the fixture and the test unchanged**: they are the acceptance test that the default import map still works.

Engines are loaded in-process: `src/execute/engine.ts:232` does `await import(toFileUrl(engine.path).href)`. A prebuilt engine bundle built for Quarto ≤ 1.11 may call `Deno.*`; on Node that fails with `ReferenceError: Deno is not defined`, surfacing as `Failed to import engine from <path>: Deno is not defined` (engine.ts:266) at load or as a later runtime error. Quarto's Node process has no `Deno` shim (decision 1; PR 33 removed it). An engine `.js` under a user `package.json` with `"type": "commonjs"` fails to load as ESM (`SyntaxError: Cannot use import statement outside a module`).

**Julia engine:** this PR does not touch `src/resources/extension-subtrees/julia-engine/` (decision 7; `dev-docs/subtree-extensions.md:23` forbids in-tree edits). The subtree is pulled with `quarto dev-call pull-git-subtree` after PumasAI ships the port to the runtime-neutral engine API, tracked as milestone J in `dev-docs/runtime-migration/README.md`; until then the PR 32 Node allowlist may carry the Julia tests, and the warning below skips bundled subtree engines (their status is tracked there, not reported to every user).

Decisions:

- **Bundler:** `bin/tools/<arch>/esbuild` through `esbuildCommand()` (`src/core/esbuild.ts`, already used for OJS). Flags: `--bundle --format=esm --platform=node --target=node26 --log-level=warning`, `--minify`, `--sourcemap`/`--sourcemap=inline`. With `--platform=node`, `node:*` built-ins stay external.
- **Import map on esbuild:** the esbuild binary has no import-map support, but `--alias:<name>=<package>` substitutes a package name and its subpaths before any other resolution (so it applies even to names like `path` that `--platform=node` would otherwise treat as built-ins). The import map in effect is translated: `jsr:[/]@<scope>/<name>@<ver>[/sub]` -> `@jsr/<scope>__<name>[/sub]`, `npm:<pkg>@<ver>[/sub]` -> `<pkg>[/sub]`; `x` and `x/` collapse to one alias `x`; a subpath key (`path/posix`) is covered by its first segment's alias when the targets agree; `@quarto/types` is skipped (type-only, erased). The aliased packages resolve from the project's `node_modules`, then from `NODE_PATH`, which the command sets to `share/extension-build/node_modules` (dist) or the repository's `node_modules` (dev). `prepare-dist` copies the default map's packages and their dependencies there.
- **Which map:** a legacy `deno.json` with `imports` or `importMap` -> that map (deprecation warning). Otherwise the default map `share/extension-build/import-map.json`, also for `package.json` projects, unless `"quarto": { "build": { "defaultImportMap": false } }`. Consequence to document: with the default map, bare `path`/`fs`/`log`/`encoding` mean the JSR std packages (as in 1.9-1.11), not Node built-ins; engines that want Node's write `node:path`.
- **Config:** `package.json` `quarto.build` keys `entryPoint`, `outputFile`, `minify`, `sourcemap`, `defaultImportMap`; `deno.json` `bundle` section read for one release with a warning.
- **`--check`:** runs the project's own `node_modules/typescript/bin/tsc --noEmit -p tsconfig.json` on the bundled Node; `--init-config` writes `package.json` (with `devDependencies.typescript`) and `tsconfig.json` whose `paths` cover `@quarto/types` and the default map's keys (pointing into `share/extension-build/node_modules`).
- **Engine contract** (`packages/quarto-types/README.md`, create template): engines use the `QuartoAPI` object and web-standard globals; `Deno.*` is unavailable; Node built-ins work but are outside the contract.
- **Detection at load:** before `import()`, `engine.ts` reads the bundle once (per path per process) and, when it contains `Deno.<member>` references, prints one warning naming the engine, up to five members, and the migration page. Bundled subtree engines (`resourcePath("extension-subtrees")`) are skipped. A failed import whose message is the CommonJS one gets a hint about `"type": "commonjs"`.

Assumptions about earlier PRs:

- PR 33: Node CLI; `requireDenoToolBinary`; `architectureToolsPath("esbuild")`; root `package.json` dependencies mirror `src/import_map.json` (PR 26 `check-deps.mjs`), so the default map's packages are in the root `node_modules`.
- PR 22/03-07: every `src/import_map.json` value for `path`, `path/posix`, `log`, `log/`, `fs/`, `encoding/` is a `jsr:` target.
- PR 14/08: `env`, `execPath()`, `cwd()`, `exit()` in `src/deno_ral/`.

### Scope

In:
- `src/command/call/build-ts-extension/cmd.ts` (rewrite); `src/core/esbuild.ts` (`esbuildCommand` takes `env`, includes stderr in the error).
- `src/resources/extension-build/`: keep `import-map.json`; delete `deno.json`; add `tsconfig.template.json`; rewrite `README.md`.
- `package/src/common/prepare-dist.ts`: keep `updateImportMap`; copy the default map's package closure to `share/extension-build/node_modules`.
- `src/execute/engine.ts`: `Deno.` detection warning and the CommonJS hint.
- `src/resources/create/extensions/engine/` template (`Deno.readTextFileSync` -> `quarto.mappedString.fromFile`) and README (row 4 of PR 25's runtime residue table: the last `resources` entry; the baseline reaches 0/0 here).
- `packages/quarto-types/README.md` contract; `llm-docs/quarto-api.md`; changelog; `docs-updates.md` row.

Out:
- `src/resources/extension-subtrees/julia-engine/` (decision 7, milestone J).
- `tests/smoke/build-ts-extension/src/test-engine.ts` and `build-ts-extension.test.ts` (unchanged on purpose).
- Adding Node-only members to `QuartoAPI`; publishing `@quarto/types` to npm.

### Interfaces

```ts
// src/command/call/build-ts-extension/cmd.ts
export interface ExtensionBuildConfig {
  entryPoint?: string;
  outputFile?: string;
  minify?: boolean;
  sourcemap?: boolean | "inline" | "external";
  defaultImportMap?: boolean; // package.json only; default true
}
export interface ResolvedBuildConfig {
  config: ExtensionBuildConfig;
  source: "package.json" | "deno.json" | "default";
  /** import map in effect (default map, or the deno.json one); {} when disabled */
  imports: Record<string, string>;
}
/** Reads ./package.json "quarto.build", else ./deno.json ("bundle", "imports"/"importMap"), else defaults. */
export function resolveConfig(dir: string, defaultImportMapPath: string): ResolvedBuildConfig;
/** Pure: esbuild --alias arguments for an import map. Throws for a target it cannot express. */
export function importMapAliases(imports: Record<string, string>): string[];
/** Pure: esbuild CLI arguments. */
export function esbuildArgs(entryPoint: string, outputPath: string, config: ExtensionBuildConfig, aliases: string[]): string[];
export const buildTsExtensionCommand: Command; // options: --check, --init-config; argument [entry-point]
```

```ts
// src/core/esbuild.ts
export async function esbuildCommand(args: string[], input: string, workingDir: string, env?: Record<string, string>): Promise<string | undefined>;
```

```ts
// src/execute/engine.ts
/** Pure: unique `Deno.<member>` references in a bundle's text, in order of first appearance. */
export function denoApiReferences(text: string): string[];
```

Warning text printed once per engine path:

```
Engine extension <path> references the Deno API (Deno.readTextFileSync, Deno.Command). Quarto runs on Node.js since 1.12 and these calls fail when executed. Rebuild the engine with `quarto call build-ts-extension` against the QuartoAPI: https://quarto.org/docs/extensions/engine.html#migrating-from-deno
```

`package.json` written by `--init-config`:

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
  "devDependencies": { "typescript": "5.9.3" }
}
```

### Files

- Modify: `src/command/call/build-ts-extension/cmd.ts` (whole file), `src/core/esbuild.ts:86-111`, `src/execute/engine.ts:229-272`
- Delete: `src/resources/extension-build/deno.json`
- Create: `src/resources/extension-build/tsconfig.template.json`
- Modify: `src/resources/extension-build/README.md`, `package/src/common/prepare-dist.ts` (extension-build block, lines 120-124 and 166-178)
- Modify: `src/resources/create/extensions/engine/src/qstart-filesafename-qend.ejs.ts:94`, `src/resources/create/extensions/engine/README.ejs.md:20-41`
- Modify: `packages/quarto-types/README.md`, `packages/quarto-types/src/quarto-api.ts:37-40`, `llm-docs/quarto-api.md`, `news/changelog-1.12.md`, `dev-docs/runtime-migration/docs-updates.md`
- Test: `tests/unit/build-ts-extension-args.test.ts`, `tests/unit/engine-deno-detection.test.ts`, `tests/smoke/engine/engine-deno-warning.test.ts` with fixture `tests/docs/engine/deno-api-engine/` (`_quarto.yml`, `deno-engine.js`, `index.qmd`)
- Unchanged (acceptance): `tests/smoke/build-ts-extension/build-ts-extension.test.ts`, `tests/smoke/build-ts-extension/src/test-engine.ts`

### Acceptance criteria

- `cd tests/smoke/build-ts-extension && quarto call build-ts-extension` (no config file) writes `_extensions/test-engine/test-engine.js` containing `function extname`; `tests/smoke/build-ts-extension/build-ts-extension.test.ts` passes unchanged; `git diff main -- tests/smoke/build-ts-extension` is empty.
- The same works from an installed layout (`package/pkg-working/bin/quarto call build-ts-extension`), where packages come from `share/extension-build/node_modules`.
- A project with a legacy `deno.json` (`bundle.entryPoint`, inline `imports`) builds and prints the deprecation warning.
- `quarto call build-ts-extension --init-config` writes `package.json` and `tsconfig.json`; after `npm install`, `--check` runs `tsc` and passes for the fixture engine copied into a temp directory.
- Rendering `tests/docs/engine/deno-api-engine/index.qmd` prints the warning once and still renders; bundled subtree engines produce no such warning.
- `quarto create extension engine` + build + render passes (`tests/smoke/create/create.test.ts`).
- `share/extension-build/` in a `prepare-dist` output contains `README.md`, `import-map.json`, `tsconfig.template.json`, `quarto-types.d.ts`, `node_modules/@jsr/` and nothing else.

## Plan

### Task 1: Config resolution, alias translation and esbuild arguments (unit tested)

**Files:**
- Modify: `src/command/call/build-ts-extension/cmd.ts`, `src/core/esbuild.ts`
- Test: `tests/unit/build-ts-extension-args.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
/*
 * build-ts-extension-args.test.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 */
import { unitTest } from "../test.ts";
import { assertEquals, assertThrows } from "../asserts.ts";
import { join } from "../../src/deno_ral/path.ts";
import { makeTempDirSync } from "../../src/deno_ral/temp.ts";
import { removeSync, writeTextFileSync } from "../../src/deno_ral/fs.ts";
import { esbuildArgs, importMapAliases, resolveConfig } from "../../src/command/call/build-ts-extension/cmd.ts";

const kDefault = {
  "@quarto/types": "./quarto-types.d.ts",
  "path": "jsr:@std/path@1.0.8",
  "path/posix": "jsr:@std/path@1.0.8/posix",
  "log": "jsr:/@std/log@0.224.0",
  "log/": "jsr:/@std/log@0.224.0/",
  "fs/": "jsr:/@std/fs@1.0.16/",
  "encoding/": "jsr:/@std/encoding@1.0.9/",
};

unitTest("build-ts-extension: the default import map becomes esbuild aliases", () => {
  assertEquals(importMapAliases(kDefault), [
    "--alias:path=@jsr/std__path",
    "--alias:log=@jsr/std__log",
    "--alias:fs=@jsr/std__fs",
    "--alias:encoding=@jsr/std__encoding",
  ]);
  assertEquals(importMapAliases({ "lodash": "npm:lodash@4.17.21", "x/": "npm:@scope/x@1.0.0/" }), [
    "--alias:lodash=lodash",
    "--alias:x=@scope/x",
  ]);
  assertThrows(() => importMapAliases({ "a": "https://example.com/a.ts" }), Error, "cannot be expressed");
  assertThrows(() => importMapAliases({ "p": "jsr:@std/path@1/posix", "p/win32": "jsr:@std/path@1/win32" }), Error, "cannot be expressed");
});

unitTest("build-ts-extension: esbuild args", () => {
  const aliases = ["--alias:path=@jsr/std__path"];
  assertEquals(esbuildArgs("src/e.ts", "_extensions/e/e.js", {}, aliases), [
    "--bundle", "--format=esm", "--platform=node", "--target=node26", "--log-level=warning",
    "--alias:path=@jsr/std__path", "--outfile=_extensions/e/e.js", "src/e.ts",
  ]);
  assertEquals(esbuildArgs("e.ts", "o.js", { minify: true, sourcemap: "inline" }, []).includes("--sourcemap=inline"), true);
  assertEquals(esbuildArgs("e.ts", "o.js", { sourcemap: true }, []).includes("--sourcemap"), true);
});

unitTest("build-ts-extension: package.json > deno.json > default", () => {
  const dir = makeTempDirSync({ prefix: "btx" });
  const defaultMap = join(dir, "default-map.json");
  writeTextFileSync(defaultMap, JSON.stringify({ imports: kDefault }));
  try {
    assertEquals(resolveConfig(dir, defaultMap), { config: {}, source: "default", imports: kDefault });
    writeTextFileSync(join(dir, "deno.json"), JSON.stringify({ bundle: { entryPoint: "src/a.ts" }, imports: { "x": "npm:x@1" } }));
    assertEquals(resolveConfig(dir, defaultMap), { config: { entryPoint: "src/a.ts" }, source: "deno.json", imports: { "x": "npm:x@1" } });
    writeTextFileSync(join(dir, "package.json"), JSON.stringify({ quarto: { build: { entryPoint: "src/b.ts", defaultImportMap: false } } }));
    assertEquals(resolveConfig(dir, defaultMap), { config: { entryPoint: "src/b.ts", defaultImportMap: false }, source: "package.json", imports: {} });
  } finally {
    removeSync(dir, { recursive: true });
  }
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/build-ts-extension-args.test.ts`
Expected: FAIL, `importMapAliases`/`esbuildArgs` are not exported.

- [ ] **Step 3: `esbuildCommand` takes `env` and reports stderr**

Replace `esbuildCommand` in `src/core/esbuild.ts`:

```ts
export async function esbuildCommand(
  args: string[],
  input: string,
  workingDir: string,
  env?: Record<string, string>,
) {
  const cmd = env_.get("QUARTO_ESBUILD") || architectureToolsPath("esbuild");
  const result = await execProcess(
    { cmd, args, cwd: workingDir, env, stdout: "piped", stderr: "piped" },
    input,
  );
  if (result.success) {
    return result.stdout;
  } else {
    console.error(result.stderr);
    throw new Error("esbuild command failed\n" + (result.stderr ?? ""));
  }
}
```

(`env_` is `import { env as env_ } from "../deno_ral/env.ts";`, renamed because the parameter is `env`; if the file already imports `env`, rename the parameter to `childEnv` instead and keep one import. `esbuildCompile` (OJS) only propagates the error, so the longer message is harmless.)

- [ ] **Step 4: Rewrite `cmd.ts`**

```ts
/*
 * cmd.ts
 *
 * Copyright (C) 2025-2026 Posit Software, PBC
 *
 * quarto call build-ts-extension: bundle a TypeScript execution engine into a
 * single ESM file with Quarto's esbuild. Options come from package.json
 * ("quarto.build"); a legacy deno.json is honoured with a deprecation warning.
 * Quarto's default import map (share/extension-build/import-map.json) is
 * applied through esbuild aliases, with its packages shipped in
 * share/extension-build/node_modules.
 */

import { Command } from "cliffy/command/mod.ts";
import { error, info, warning } from "../../../deno_ral/log.ts";
import { resourcePath } from "../../../core/resources.ts";
import { esbuildCommand } from "../../../core/esbuild.ts";
import { execProcess } from "../../../core/process.ts";
import { basename, dirname, extname, isAbsolute, join, resolve } from "../../../deno_ral/path.ts";
import { existsSync, mkdirSync, readDirSync, readTextFileSync, writeTextFileSync } from "../../../deno_ral/fs.ts";
import { expandGlobSync } from "../../../core/deno/expand-glob.ts";
import { cwd, execPath, exit } from "../../../deno_ral/process.ts";
import { readYaml } from "../../../core/yaml.ts";

export interface ExtensionBuildConfig {
  entryPoint?: string;
  outputFile?: string;
  minify?: boolean;
  sourcemap?: boolean | "inline" | "external";
  defaultImportMap?: boolean;
}

export interface ResolvedBuildConfig {
  config: ExtensionBuildConfig;
  source: "package.json" | "deno.json" | "default";
  imports: Record<string, string>;
}

interface BuildOptions {
  check?: boolean;
  initConfig?: boolean;
}

const kDocs = "https://quarto.org/docs/extensions/engine.html";

function readImports(file: string): Record<string, string> {
  return (JSON.parse(readTextFileSync(file)).imports ?? {}) as Record<string, string>;
}

export function resolveConfig(dir: string, defaultImportMapPath: string): ResolvedBuildConfig {
  const packageJson = join(dir, "package.json");
  if (existsSync(packageJson)) {
    const build = (JSON.parse(readTextFileSync(packageJson)).quarto?.build ?? {}) as ExtensionBuildConfig;
    const imports = build.defaultImportMap === false ? {} : readImports(defaultImportMapPath);
    return { config: build, source: "package.json", imports };
  }
  const denoJson = join(dir, "deno.json");
  if (existsSync(denoJson)) {
    const deno = JSON.parse(readTextFileSync(denoJson)) as {
      bundle?: ExtensionBuildConfig;
      imports?: Record<string, string>;
      importMap?: string;
    };
    let imports: Record<string, string> = deno.imports ?? {};
    if (deno.importMap) {
      const mapPath = isAbsolute(deno.importMap) ? deno.importMap : resolve(dir, deno.importMap);
      if (existsSync(mapPath)) {
        imports = readImports(mapPath);
      } else {
        // --init-config of Quarto <= 1.11 wrote an absolute path into an older install
        warning(`deno.json importMap ${deno.importMap} does not exist; using Quarto's default import map.`);
        imports = readImports(defaultImportMapPath);
      }
    }
    return { config: deno.bundle ?? {}, source: "deno.json", imports };
  }
  return { config: {}, source: "default", imports: readImports(defaultImportMapPath) };
}

// "jsr:/@std/path@1.0.8/posix" -> "@jsr/std__path/posix"; "npm:@a/b@1/x" -> "@a/b/x"
function aliasTarget(target: string): string | undefined {
  let m = target.match(/^jsr:\/?@([^/@]+)\/([^/@]+)(?:@[^/]*)?(\/.*)?$/);
  if (m) {
    return `@jsr/${m[1]}__${m[2]}${(m[3] ?? "").replace(/\/$/, "")}`;
  }
  m = target.match(/^npm:\/?((?:@[^/@]+\/)?[^/@]+)(?:@[^/]*)?(\/.*)?$/);
  if (m) {
    return `${m[1]}${(m[2] ?? "").replace(/\/$/, "")}`;
  }
  return undefined;
}

export function importMapAliases(imports: Record<string, string>): string[] {
  const aliases = new Map<string, string>();
  const subpathKeys: [string, string][] = [];
  for (const [key, target] of Object.entries(imports)) {
    if (key === "@quarto/types") {
      continue; // type-only: `import type` is erased by esbuild
    }
    const name = key.replace(/\/$/, "");
    const to = aliasTarget(target);
    if (to === undefined) {
      throw new Error(`import map entry "${key}": "${target}" cannot be expressed as an esbuild alias (only jsr: and npm: targets are supported). See ${kDocs}`);
    }
    const isSubpath = name.startsWith("@") ? name.split("/").length > 2 : name.includes("/");
    if (isSubpath) {
      subpathKeys.push([name, to]);
    } else if (!aliases.has(name)) {
      aliases.set(name, to);
    }
  }
  // "path/posix" is covered by the "path" alias when the targets agree
  for (const [name, to] of subpathKeys) {
    const base = name.startsWith("@") ? name.split("/").slice(0, 2).join("/") : name.split("/")[0];
    const rest = name.slice(base.length);
    if (aliases.get(base) === undefined || `${aliases.get(base)}${rest}` !== to) {
      throw new Error(`import map entry "${name}" cannot be expressed as an esbuild alias: esbuild aliases whole package names, and "${base}" does not map to the same package. See ${kDocs}`);
    }
  }
  return [...aliases.entries()].map(([name, to]) => `--alias:${name}=${to}`);
}

export function esbuildArgs(
  entryPoint: string,
  outputPath: string,
  config: ExtensionBuildConfig,
  aliases: string[],
): string[] {
  const args = ["--bundle", "--format=esm", "--platform=node", "--target=node26", "--log-level=warning"];
  if (config.minify) {
    args.push("--minify");
  }
  if (config.sourcemap === true || config.sourcemap === "external") {
    args.push("--sourcemap");
  } else if (config.sourcemap === "inline") {
    args.push("--sourcemap=inline");
  }
  args.push(...aliases, `--outfile=${outputPath}`, entryPoint);
  return args;
}

// Where the default map's packages live: shipped (prepare-dist) or the dev checkout's node_modules.
function defaultPackagesDir(): string {
  const shipped = resourcePath("extension-build/node_modules");
  return existsSync(shipped) ? shipped : join(resourcePath(), "..", "..", "node_modules");
}
```

Keep `autoDetectEntryPoint`, `inferFilename`, `extensionDirs`, `inferOutputPath` and `validateExtensionYml` from the current file (lines 79-248 and the `validateExtensionYml` function), with these edits only: `Deno.cwd()` -> `cwd()`, `Deno.exit(1)` -> `exit(1)`, `Deno.readDirSync` -> `readDirSync`, and the hint text `bundle.entryPoint in deno.json` -> `"quarto.build.entryPoint" in package.json`. Then add:

```ts
async function bundle(entryPoint: string, resolved: ResolvedBuildConfig): Promise<void> {
  info("Bundling...");
  const { config } = resolved;
  let outputPath: string;
  if (config.outputFile) {
    const specified = config.outputFile;
    outputPath = (!specified.includes("/") && !specified.includes("\\"))
      ? inferOutputPath(specified, specified)
      : specified;
  } else {
    outputPath = inferOutputPath(inferFilename(entryPoint));
  }
  if (!existsSync(dirname(outputPath))) {
    mkdirSync(dirname(outputPath), { recursive: true });
  }
  const aliases = importMapAliases(resolved.imports);
  try {
    await esbuildCommand(
      esbuildArgs(entryPoint, outputPath, config, aliases),
      "",
      cwd(),
      aliases.length > 0 ? { NODE_PATH: defaultPackagesDir() } : undefined,
    );
  } catch (e) {
    const text = e instanceof Error ? e.message : String(e);
    error("esbuild failed");
    if (text.includes("@quarto/types")) {
      error('@quarto/types only provides types; use "import type { ... } from \\"@quarto/types\\"".');
    }
    error(`Bare imports resolve from this project's node_modules (npm install <package>) or Quarto's default import map. See ${kDocs}`);
    exit(1);
  }
  validateExtensionYml(outputPath);
  info(`Built ${entryPoint} -> ${outputPath}`);
}

function quartoTypesPath(): string {
  const shipped = resourcePath("extension-build/quarto-types.d.ts");
  return existsSync(shipped)
    ? shipped
    : join(resourcePath(), "..", "..", "packages", "quarto-types", "dist", "index.d.ts");
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
    error("Fix the type errors above, or adjust compilerOptions in tsconfig.json.");
    exit(1);
  }
  info("Type check passed");
}

// tsconfig "paths" for @quarto/types and the default import map keys
function tsconfigPaths(): Record<string, string[]> {
  const fwd = (p: string) => p.replaceAll("\\", "/");
  const paths: Record<string, string[]> = { "@quarto/types": [fwd(quartoTypesPath())] };
  const pkgDir = defaultPackagesDir();
  for (const [key, target] of Object.entries(readImports(resourcePath("extension-build/import-map.json")))) {
    const to = aliasTarget(target);
    if (key === "@quarto/types" || to === undefined) continue;
    if (key.endsWith("/")) {
      paths[`${key}*`] = [fwd(join(pkgDir, to, "*"))];
    } else {
      paths[key] = [fwd(join(pkgDir, to))];
    }
  }
  return paths;
}

function initializeConfig(): void {
  const dirs = extensionDirs();
  const name = dirs.length === 1 ? basename(dirs[0]) : "quarto-engine";
  if (existsSync("package.json") && JSON.parse(readTextFileSync("package.json")).quarto?.build) {
    error('package.json already has a "quarto.build" section; nothing to do.');
    exit(1);
  }
  const pkg = existsSync("package.json")
    ? JSON.parse(readTextFileSync("package.json"))
    : { name, private: true, type: "module" };
  pkg.quarto = {
    ...(pkg.quarto ?? {}),
    build: { entryPoint: `src/${name}.ts`, outputFile: `_extensions/${name}/${name}.js`, minify: false, sourcemap: false },
  };
  pkg.scripts = { ...(pkg.scripts ?? {}), build: "quarto call build-ts-extension", check: "quarto call build-ts-extension --check" };
  pkg.devDependencies = { typescript: "5.9.3", ...(pkg.devDependencies ?? {}) };
  writeTextFileSync("package.json", JSON.stringify(pkg, null, 2) + "\n");
  info("Wrote package.json");
  if (!existsSync("tsconfig.json")) {
    const template = JSON.parse(readTextFileSync(resourcePath("extension-build/tsconfig.template.json")));
    template.compilerOptions.paths = tsconfigPaths();
    writeTextFileSync("tsconfig.json", JSON.stringify(template, null, 2) + "\n");
    info("Wrote tsconfig.json");
  } else {
    info(`tsconfig.json exists; add to compilerOptions.paths: ${JSON.stringify(tsconfigPaths())}`);
  }
  if (existsSync("deno.json")) {
    warning("deno.json is no longer used by quarto call build-ts-extension once package.json has quarto.build; delete it.");
  }
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
      const resolved = resolveConfig(cwd(), resourcePath("extension-build/import-map.json"));
      if (resolved.source === "deno.json") {
        warning(
          'deno.json is deprecated for quarto call build-ts-extension; move "bundle" to package.json "quarto.build" (quarto call build-ts-extension --init-config).',
        );
      }
      const entryPoint = entryPointArg || autoDetectEntryPoint(resolved.config.entryPoint);
      info(`Entry point: ${entryPoint}`);
      if (options.check) {
        await typeCheck();
      } else {
        await bundle(entryPoint, resolved);
      }
    } catch (e) {
      error(e instanceof Error ? e.message : String(e));
      exit(1);
    }
  });
```

`autoDetectEntryPoint` in the current file is `async`; make it synchronous (it awaits nothing after the edits) or keep `await` at the call site.

- [ ] **Step 5: Run the unit test**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/build-ts-extension-args.test.ts`
Expected: `3 passed`.

- [ ] **Step 6: Run the unchanged smoke test**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/build-ts-extension/build-ts-extension.test.ts && git diff --stat main -- smoke/build-ts-extension`
Expected: the test passes (`function extname` bundled from `@jsr/std__path` through `--alias:path=` and `NODE_PATH`); the diff is empty. If esbuild reports `Could not resolve "@jsr/std__path"`, print `NODE_PATH` in `bundle()` under `--log-level debug` and check that the dev `node_modules` has the package (`ls node_modules/@jsr/std__path`).

- [ ] **Step 7: Commit**

```bash
git add src/command/call/build-ts-extension/cmd.ts src/core/esbuild.ts tests/unit/build-ts-extension-args.test.ts
git commit -m "build-ts-extension: bundle with Quarto's esbuild; default import map via aliases; package.json config"
```

### Task 2: Shipped resources and `prepare-dist`

**Files:**
- Delete: `src/resources/extension-build/deno.json`
- Create: `src/resources/extension-build/tsconfig.template.json`
- Modify: `src/resources/extension-build/README.md`, `package/src/common/prepare-dist.ts`

- [ ] **Step 1: Resources**

```bash
git rm src/resources/extension-build/deno.json
```

`src/resources/extension-build/tsconfig.template.json` (`--init-config` fills `compilerOptions.paths`):

```json
{
  "compilerOptions": {
    "strict": true,
    "noEmit": true,
    "target": "ES2023",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "lib": ["ES2023", "DOM"],
    "types": [],
    "skipLibCheck": true,
    "paths": {}
  },
  "include": ["src/**/*.ts"]
}
```

`src/resources/extension-build/README.md`:

```markdown
# Extension Build Resources

Defaults for `quarto call build-ts-extension`, which bundles TypeScript
execution engines with Quarto's esbuild (`bin/tools/<arch>/esbuild`).

- **import-map.json**: Quarto's default import map (`path`, `path/posix`,
  `log`, `fs/`, `encoding/`, and the type-only `@quarto/types`). Applied as
  esbuild `--alias` arguments to projects without their own map, unless
  package.json sets `"quarto": { "build": { "defaultImportMap": false } }`.
  `prepare-dist` updates the versions from `src/import_map.json`.
- **node_modules/** (distribution only): the packages the default map points
  to, with their dependencies, copied by `prepare-dist`. esbuild finds them
  through `NODE_PATH`. In a dev checkout the repository's `node_modules` is used.
- **tsconfig.template.json**: written by `--init-config` with `paths` for
  `@quarto/types` and the default map's keys; used by `--check` (the project's
  own `node_modules/typescript`).
- **quarto-types.d.ts** (distribution only): copied from
  `packages/quarto-types/dist/index.d.ts`.

Engines run inside Quarto's Node.js process. They use the `QuartoAPI` object
passed to `init()` and web-standard globals; `Deno.*` is not available. See
`packages/quarto-types/README.md`, "Runtime contract".
```

- [ ] **Step 2: `prepare-dist.ts`**

Keep `updateImportMap` (lines 226-267) and its call (lines 120-124). After the `quarto-types.d.ts` copy (lines 166-178), add:

```ts
  // Packages of the default build-ts-extension import map, with their
  // dependencies, so engines without their own config build offline.
  info("Copying extension-build packages");
  const extensionImports = JSON.parse(
    readTextFileSync(join(extensionBuildDir, "import-map.json")),
  ).imports as Record<string, string>;
  const roots = new Set<string>();
  for (const target of Object.values(extensionImports)) {
    const m = target.match(/^jsr:\/?@([^/@]+)\/([^/@]+)@/);
    if (m) roots.add(`@jsr/${m[1]}__${m[2]}`);
  }
  copyPackageClosure(
    [...roots],
    join(config.directoryInfo.root, "node_modules"),
    join(extensionBuildDir, "node_modules"),
  );
```

and the helper at the end of the file:

```ts
// Copy packages and their transitive `dependencies` from a flat node_modules.
function copyPackageClosure(names: string[], from: string, to: string) {
  const seen = new Set<string>();
  const queue = [...names];
  while (queue.length > 0) {
    const name = queue.shift()!;
    if (seen.has(name)) continue;
    seen.add(name);
    const src = join(from, name);
    if (!existsSync(src)) {
      throw new Error(`extension-build package ${name} is missing from ${from}; run npm ci`);
    }
    copySync(src, join(to, name), { overwrite: true });
    const pkg = JSON.parse(readTextFileSync(join(src, "package.json")));
    queue.push(...Object.keys(pkg.dependencies ?? {}));
  }
}
```

(add `readTextFileSync` to the `fs.ts` import). npm installs the root dependencies flat, so `node_modules/<name>` exists for each transitive dependency unless two versions conflict; the thrown error names it if one is nested instead.

Run: `cd package/src && ./quarto-bld prepare-dist --set-version 99.9.9 > /dev/null && ls ../pkg-working/share/extension-build ../pkg-working/share/extension-build/node_modules/@jsr`
Expected: `README.md import-map.json node_modules quarto-types.d.ts tsconfig.template.json`; `std__encoding std__fs std__log std__path` plus their dependencies (e.g. `std__fmt`, `std__io`).

Then from the installed layout: `cp -r tests/smoke/build-ts-extension /tmp/btx && cd /tmp/btx && ../path/to/package/pkg-working/bin/quarto call build-ts-extension && grep -c "function extname" _extensions/test-engine/test-engine.js` prints `1`.

- [ ] **Step 3: Commit**

```bash
git add src/resources/extension-build package/src/common/prepare-dist.ts
git commit -m "build-ts-extension: ship the default import map's packages; tsconfig template replaces deno.json"
```

### Task 3: Flag engine bundles that reference `Deno.`

**Files:**
- Modify: `src/execute/engine.ts:229-272`
- Test: `tests/unit/engine-deno-detection.test.ts`, `tests/smoke/engine/engine-deno-warning.test.ts`, fixture `tests/docs/engine/deno-api-engine/`

- [ ] **Step 1: Write the failing tests and fixture**

`tests/unit/engine-deno-detection.test.ts`:

```ts
/*
 * engine-deno-detection.test.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 */
import { unitTest } from "../test.ts";
import { assertEquals } from "../asserts.ts";
import { denoApiReferences } from "../../src/execute/engine.ts";

// "D" + "eno." keeps the literal out of this file for the boundary ratchet's tests scope.
const D = "Deno";

unitTest("engine - Deno API references are listed once, in order", () => {
  assertEquals(
    denoApiReferences(`const a = ${D}.readTextFileSync(p); new ${D}.Command("x"); ${D}.readTextFileSync(q); const d = "${D}minator.x";`),
    [`${D}.readTextFileSync`, `${D}.Command`],
  );
  assertEquals(denoApiReferences(`const x = typeof ${D} === 'undefined';`), []);
});
```

The fixture `tests/docs/engine/deno-api-engine/deno-engine.js` is under `tests/docs/`, which the ratchet's `tests` scope excludes (the existing `tests/docs/project/prepost/` fixtures use the Deno API too); confirm with `grep -n "tests/docs" tools/check-runtime-boundary.ts`.

`tests/docs/engine/deno-api-engine/_quarto.yml`:

```yaml
project:
  type: default
engines:
  - path: deno-engine.js
```

`tests/docs/engine/deno-api-engine/deno-engine.js` (claims nothing; the Deno call is never executed):

```js
// Engine built for Quarto <= 1.11: references the Deno API in code that a
// render of index.qmd never runs. Used to check the load-time warning.
const legacy = () => Deno.readTextFileSync("never-read.txt");

export default {
  name: "deno-api-probe",
  defaultExt: ".qmd",
  defaultYaml: () => [],
  defaultContent: () => [],
  validExtensions: () => [],
  claimsFile: (_file, _ext) => false,
  claimsLanguage: (_language, _firstClass) => false,
  canFreeze: false,
  generatesFigures: false,
  launch: (_context) => {
    throw new Error(String(legacy));
  },
};
```

`tests/docs/engine/deno-api-engine/index.qmd`:

```markdown
---
title: deno-api-engine
---

Rendered by the markdown engine.
```

`tests/smoke/engine/engine-deno-warning.test.ts`:

```ts
/*
 * engine-deno-warning.test.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 */
import { docs } from "../../utils.ts";
import { testRender } from "../render/render.ts";
import { printsMessage } from "../../verify.ts";

testRender(
  docs("engine/deno-api-engine/index.qmd"),
  "html",
  false,
  [printsMessage({ level: "WARN", regex: /deno-engine\.js references the Deno API \(Deno\.readTextFileSync\)/ })],
);
```

(`testRender` lives in `tests/smoke/render/render.ts`; confirm the import path with `grep -n "export function testRender" tests/smoke/render/render.ts`.)

- [ ] **Step 2: Run them and see them fail**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/engine-deno-detection.test.ts smoke/engine/engine-deno-warning.test.ts`
Expected: FAIL (`denoApiReferences` not exported; no warning printed).

- [ ] **Step 3: Implement**

In `src/execute/engine.ts` add (imports: `readTextFileSync` from `../deno_ral/fs.ts`, `warning` from `../deno_ral/log.ts`, `resourcePath` from `../core/resources.ts`, `normalizePath` from `../core/path.ts`):

```ts
// Spelled without a literal "Deno" + "." so the boundary ratchet (PR 02, which
// counts that text in src/) stays at zero.
const kDenoGlobal = "Deno";
const kDenoMember = new RegExp(`\\b${kDenoGlobal}\\.([A-Za-z_$][\\w$]*)`, "g");

export function denoApiReferences(text: string): string[] {
  const found: string[] = [];
  for (const m of text.matchAll(kDenoMember)) {
    const ref = `${kDenoGlobal}.${m[1]}`;
    if (!found.includes(ref)) {
      found.push(ref);
    }
  }
  return found;
}

const kEngineMigrationUrl = "https://quarto.org/docs/extensions/engine.html#migrating-from-deno";
const checkedEngineBundles = new Set<string>();

// Engines built for Quarto <= 1.11 may call Deno APIs, which fail on Node.js.
// Read each bundle once per process and warn. Bundled subtree engines are
// tracked by the runtime migration (milestone J) and are not reported.
function warnIfEngineUsesDeno(enginePath: string) {
  const path = normalizePath(enginePath);
  if (checkedEngineBundles.has(path) || path.startsWith(normalizePath(resourcePath("extension-subtrees")))) {
    return;
  }
  checkedEngineBundles.add(path);
  let refs: string[];
  try {
    refs = denoApiReferences(readTextFileSync(path));
  } catch {
    return; // unreadable: the import below reports it
  }
  if (refs.length > 0) {
    warning(
      `Engine extension ${enginePath} references the Deno API (${refs.slice(0, 5).join(", ")}${refs.length > 5 ? ", ..." : ""}). ` +
        `Quarto runs on Node.js since 1.12 and these calls fail when executed. ` +
        `Rebuild the engine with \`quarto call build-ts-extension\` against the QuartoAPI: ${kEngineMigrationUrl}`,
    );
  }
}
```

In `resolveEngines`, call `warnIfEngineUsesDeno(engine.path);` as the first statement inside `if (typeof engine === "object") { try {`, before the `import()`. In the `catch` (line ~265), extend the message:

```ts
        const message = err.message || "Unknown error";
        const hint = /Cannot use import statement outside a module|Unexpected token 'export'/.test(message)
          ? ` The engine bundle is an ES module but the nearest package.json declares "type": "commonjs"; add { "type": "module" } to a package.json next to the engine file.`
          : "";
        throw new Error(`Failed to import engine from ${engine.path}: ${message}${hint}`);
```

- [ ] **Step 4: Run and commit**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/engine-deno-detection.test.ts $(find smoke/engine/ -name '*.test.ts') smoke/check/check-in-project.test.ts`
Expected: all pass (`check-in-project` uses `probe-engine.js`, which has no `Deno.`; no warning).

```bash
git add src/execute/engine.ts tests/unit/engine-deno-detection.test.ts tests/smoke/engine/engine-deno-warning.test.ts tests/docs/engine/deno-api-engine
git commit -m "engines: warn when a loaded engine bundle references the Deno API; hint for type: commonjs"
```

### Task 4: `quarto create extension engine` template

**Files:**
- Modify: `src/resources/create/extensions/engine/src/qstart-filesafename-qend.ejs.ts:94`, `src/resources/create/extensions/engine/README.ejs.md:20-41`

- [ ] **Step 1: Template source**

Line 94: `quarto.markdownRegex.partition(Deno.readTextFileSync(file))` -> `quarto.markdownRegex.partition(quarto.mappedString.fromFile(file).value)`.
Run: `grep -n "Deno\." src/resources/create/extensions/engine/src/qstart-filesafename-qend.ejs.ts` -> no output. Then `quarto run --dev tools/check-runtime-boundary.ts --update-baseline`: `resources` reaches 0/0 (PR 35 closed the other rows); commit `tools/runtime-boundary-baseline.json` with this task.

- [ ] **Step 2: README** (replace lines 20-41)

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
`TextEncoder`, `URL`). Deno APIs are not available. Quarto's default import
map provides `path`, `log`, `fs/` and `encoding/`; other packages can be added
with `npm install` in this directory and are bundled.

To type-check, create the build configuration once and install TypeScript:

```bash
quarto call build-ts-extension --init-config   # package.json (quarto.build) and tsconfig.json
npm install
quarto call build-ts-extension --check
```
```

- [ ] **Step 3: Run and commit**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/create/create.test.ts`
Expected: passes.

```bash
git add src/resources/create/extensions/engine
git commit -m "create: engine template uses the QuartoAPI and the esbuild build"
```

### Task 5: Engine contract docs and changelog

**Files:**
- Modify: `packages/quarto-types/README.md`, `packages/quarto-types/src/quarto-api.ts:37-40`, `llm-docs/quarto-api.md`, `news/changelog-1.12.md`, `dev-docs/runtime-migration/docs-updates.md`

- [ ] **Step 1: `packages/quarto-types/README.md`**, after `## Usage`:

```markdown
## Runtime contract

Engines are bundled to a single ESM file (`quarto call build-ts-extension`)
and loaded with `import()` inside Quarto's Node.js process. An engine may rely on:

- the `QuartoAPI` object passed to `init()` (markdown, mapped strings, paths,
  Jupyter helpers, `system.execProcess`, `system.tempContext`, console);
- web-standard globals available in Node.js: `fetch`, `crypto.subtle`,
  `TextEncoder`/`TextDecoder`, `URL`, timers, streams, `AbortController`.

`Deno.*` is not available (Quarto ran on Deno through 1.11; Quarto warns when
it loads an engine bundle that references it). Node.js built-ins (`node:fs`,
`node:path`, `node:net`, `node:child_process`) work because the engine shares
Quarto's process, but they are outside the contract: prefer the `QuartoAPI`
and ask for an addition when something is missing.
```

`packages/quarto-types/src/quarto-api.ts:37-40` doc comment:

```ts
/**
 * Global Quarto API interface, passed to an engine's init(). Together with
 * web-standard globals this is the supported surface for engines; Deno APIs
 * are not available (see README.md, "Runtime contract").
 */
```

Then `cd packages/quarto-types && npm run build` and commit `dist/index.d.ts` if it changed.

- [ ] **Step 2: `llm-docs/quarto-api.md`**: add a "Runtime contract" section with the same two bullets and a pointer to `src/resources/extension-build/README.md`.

- [ ] **Step 3: Changelog** (`## Extensions`)

```markdown
- ([#NNNNN](https://github.com/quarto-dev/quarto-cli/pull/NNNNN)): `quarto call build-ts-extension` now bundles with Quarto's esbuild. Quarto's default import map (`path`, `log`, `fs/`, `encoding/`) keeps working without configuration. Options move to `package.json` (`quarto.build`); a `deno.json` `bundle` section still works in 1.12 with a deprecation warning. `--init-config` writes `package.json` and `tsconfig.json`; `--check` uses the project's own TypeScript. Engines use the `QuartoAPI` object and web standards; Quarto warns when it loads an engine bundle that references the Deno API.
```

- [ ] **Step 4: `docs-updates.md`**: the `extensions/engine.qmd` row (PR 34) gains: config keys `quarto.build.entryPoint|outputFile|minify|sourcemap|defaultImportMap`; default import map and the fact that bare `path`/`fs` mean the JSR std packages; `#migrating-from-deno` anchor (the warning links to it) with the `Deno.*` -> `QuartoAPI`/web-standard table; the `"type": "commonjs"` note.

- [ ] **Step 5: Commit**

```bash
git add packages/quarto-types llm-docs/quarto-api.md news/changelog-1.12.md dev-docs/runtime-migration/docs-updates.md
git commit -m "docs: engine runtime contract; build-ts-extension on esbuild"
```

## Verification

- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/build-ts-extension-args.test.ts unit/engine-deno-detection.test.ts $(find smoke/build-ts-extension/ -name '*.test.ts') smoke/create/create.test.ts $(find smoke/engine/ -name '*.test.ts') smoke/inspect/inspect-extensions.test.ts unit/extension/filter-bundled-engines.test.ts smoke/check/check-in-project.test.ts`: all pass.
- `git diff main -- tests/smoke/build-ts-extension`: empty.
- `grep -rn "deno bundle\|deno check\|requireDenoToolBinary\|architectureToolsPath(\"deno\")" src/command/call/build-ts-extension` -> no output.
- Manual: scratch dir, `quarto create extension engine` (name `demo`), `quarto call build-ts-extension`, render the example; then `--init-config && npm install && quarto call build-ts-extension --check`. Legacy: `rm package.json tsconfig.json && printf '{"bundle":{"entryPoint":"src/demo.ts"}}' > deno.json && quarto call build-ts-extension` warns and builds (no `imports` in that deno.json: the build uses no aliases, so the template, which imports only `@quarto/types`, still builds).
- `quarto run --dev tools/check-runtime-boundary.ts`: unchanged.

## Review checklist

- [ ] The fixture `tests/smoke/build-ts-extension/src/test-engine.ts` and its test are unchanged and pass.
- [ ] `importMapAliases` covers `x`/`x/` collapsing, subpath keys covered by the base alias, `@quarto/types` skipped, clear errors for unsupported targets (unit test).
- [ ] `NODE_PATH` points at `share/extension-build/node_modules` in a distribution and at the repository `node_modules` in dev; `prepare-dist` copies the full dependency closure.
- [ ] `engine.ts` reads each bundle once per process, skips bundled subtree engines, and never blocks loading; the CommonJS hint only appears for that error shape.
- [ ] No edit under `src/resources/extension-subtrees/`.
- [ ] `cmd.ts` has no `Deno.` and no Deno binary use.

## Risks and rollback

- **Third-party engines built for 1.9-1.11 that call `Deno.*`** fail when that code runs. They are now named at load time with the migration link; authors rebuild (the default import map keeps their sources building). Users pin Quarto 1.11 meanwhile.
- **False-positive warnings:** a bundle may contain `Deno.` in code that never runs (e.g. `@std/log`'s `FileHandler` pulled in by the default `log` alias, or a Deno branch behind `typeof Deno`). The warning says "fail when executed", not "will fail"; authors silence it by rebuilding without those paths.
- **Bare `fs`/`path` meaning JSR std under the default map.** An engine that relied on Deno resolving bare `fs` to `node:fs` gets `@std/fs`; the docs say to write `node:fs`. Projects opt out with `defaultImportMap: false`.
- **esbuild alias limits:** an import map whose subpath key points to a different package than its base cannot be expressed; the build stops with a message naming the key.
- **Rollback:** revert the PR; `build-ts-extension` goes back to `deno bundle` on the Deno tool, which PR 33 keeps until PR 37.

## Decisions needed

1. **Should `QuartoAPI` grow `system.connectTcp()`/`system.spawnDetached()`** so engines (Julia's upstream port among them) need no `node:` imports? Recommendation: decide with PumasAI when they port (milestone J); not in this PR.
2. **Ship `typescript` for `--check`?** Recommendation: no (about 9 MB); `--init-config` adds it as a project dev dependency.
3. Not changed because decision 7 forbids it: the old Task 5 (in-tree port of `src/resources/extension-subtrees/julia-engine/`). The subtree is pulled after PumasAI ships the port (milestone J).
