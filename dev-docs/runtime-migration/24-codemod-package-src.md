# PR 24: Codemod `package/src` (240 sites); drop `Deno.run` and `deno info`

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the build tooling under `package/src` off `Deno.*`: replace the 13 `Deno.run` calls with `exec` (or a direct filesystem call where the process was a stand-in for one), replace the two `deno info --json` invocations with a module graph derived from esbuild's metafile, route the remaining `jsr:` imports through `src/deno_ral/`, and run the codemod for the rest.
**Phase:** 1. **Depends on:** PR 09 (codemod tool, `fs.ts`/`temp.ts`), PR 14 (`env.ts`), PR 08 (`process.ts`), PR 19 (`platform.ts`, `main.ts`), PR 22 (std seams; it already rewrote `package/src/util/git.ts` and `util/utils.ts` import lines), PR 02. **Unblocks:** PR 25, PR 33.
**Branch:** `rt/24-codemod-package-src`.
**Suggested executor:** Sonnet. The hand conversions are small and each has a fixed target; the metafile adapter is a 60-line pure function with a unit test.
**Size:** M. 40 files with `Deno.*` sites, 1 new module, 1 new test, `tools/deno-esbuild-bundle.ts`.
**Ships on:** Deno; `quarto-bld` keeps working (it is how the distribution is built).

## Spec

### Context

Assessment section 11, "Order of work" step 8: `package/src` drops `Deno.run` and `deno info` in favour of the layer and esbuild's metafile. Section 3.1: build tooling is Deno TS using `Deno.run`, `deno info`, `deno compile`, `deno install`. Section 11, three facts: `tools/deno-esbuild-bundle.ts` runs esbuild (npm) under Deno with `@luca/esbuild-deno-loader`; the launchers run `deno run bin/quarto.js`.

Inventory (2026-10-14): 240 `Deno.*` sites in 40 files. By API: `env` 48, `writeTextFileSync` 29, `removeSync` 29, `readTextFileSync` 23, `copyFileSync` 21, `args` 16, `run` 13, `exit` 8, `cwd` 7, `renameSync` 6, `remove` 5, `copyFile` 5, `readDirSync` 4, `makeTempDirSync` 4, `writeFileSync` 3, `chmodSync` 3, `chdir` 3, `build` 3 (PR 19), `makeTempFile` 2, `Command` 2, `writeTextFile` 1, `symlinkSync` 1, `execPath` 1, `errors` 1, `create` 1, `CommandStatus` 1 (PR 21). Largest files: `common/update-html-dependencies.ts` 57, `common/configure.ts` 19, `common/import-report/explain-all-cycles.ts` 11, `macos/installer.ts` 10, `common/import-report/explain-import-chain.ts` 10.

Sites that need hands:

| Site | Today | Replacement |
|---|---|---|
| `package/src/util/tar.ts:95-99,119-124` | `Deno.run({ cmd: tarCmd[, cwd] })` + `p.status()` (with `@ts-expect-error`) | `exec(tarCmd[0], { args: tarCmd.slice(1), cwd, stdout: "inherit", stderr: "inherit" })` |
| `package/src/util/git.ts:49-57,67-95,113-120` | `Deno.run` for `git checkout`, `git clone` (stderr piped, parsed for `Cloning into '...'`), `git apply` | `exec("git", ...)` |
| `package/src/common/configure.ts:169-175` | `Deno.run({ cwd: targetDir, cmd: ["ln", "-s", linkTarget, "pandoc"] })`, not awaited | `symlinkSync(linkTarget, join(targetDir, "pandoc"))` from `fs.ts` |
| `package/src/common/import-report/deno-info.ts:65-75` | `Deno.run([deno, "info", root, "--json"])` | `getModuleGraph(root)` from the metafile adapter |
| `package/src/common/cyclic-dependencies.ts:141-169` | `runCmd(QUARTO_DENO, ["info", src/quarto.ts, "--json"])` | `getModuleGraph(join(src, "quarto.ts"))` |
| `package/src/common/import-report/explain-import-chain.ts:140-143`, `explain-all-cycles.ts:144-147` | `Deno.run({ cmd: ["quarto", "preview", filename] })` | `exec("quarto", { args: ["preview", filename], stdin: "inherit", stdout: "inherit", stderr: "inherit" })` |
| `package/src/common/import-report/report-risky-files.ts:63-68` | `Deno.run({ cmd: ["rg", "-l", "export const"], stdout: "piped", stderr: "piped" })` | `exec("rg", { args: ["-l", "export const"] })` |
| `package/src/common/import-report/report-bundle-async-cycles.ts:28-63` | `Deno.run([deno, "run", ..., explain-all-cycles.ts, entry, "--simplify", "--toon", file])` | `exec(execPath(), { args: ["run", ...] })` (still a Deno invocation; PR 35/37 own the runtime flags) |
| `package/src/util/cmd.ts:26-31` | `new Deno.Command(runCmd, { args, stdout: "piped", stderr: "piped" }).output()` (PR 08 already retyped `CmdResult.status` to `ExitStatus` and may have converted the call; skip Task 3 step 3 if `grep -n 'Deno\.Command' package/src/util/cmd.ts` is empty) | `exec(runCmd, { args })` |
| `package/src/util/utils.ts:26-28` | `Deno.create(dest)` + `writeAll(file, contents)` | `writeFileSync(dest, contents)` |
| `package/src/common/import-report/find-bad-imports.ts:2`, `find-bad-types-constants.ts:2` | `import { brightBlue } from "jsr:/@std/fmt@^0.224.0/colors"` | `src/deno_ral/colors.ts` |
| `package/src/common/import-report/report-bundle-async-cycles.ts:13-15` | `npm:acorn@8.14.0`, `npm:acorn-walk@8.3.4`, `npm:javascript-lp-solver` | unchanged (build-tool dependencies, not runtime seams; `acorn` has an import-map alias after PR 03 but the script pins its own version on purpose) |

PR 08 (Task 8) converts the same `Deno.run` and `Deno.Command` sites in `package/src` (`tar.ts`, `git.ts`, `configure.ts`, the import-report scripts, `util/cmd.ts`) to `exec`/`execSync`. Whichever of PR 08 and PR 24 lands second runs `grep -rn 'Deno\.run(\|new Deno\.Command' package/src --include=*.ts` first and skips the files that are already converted; the replacements above and PR 08's agree, except that this PR replaces PR 08's `execSync("ln", …)` in `configure.ts` with `symlinkSync` and routes `deno-info.ts` through the metafile adapter instead of `exec`.

`deno info --json` to esbuild metafile: `tools/deno-esbuild-bundle.ts` already runs `esbuild.build({ plugins: denoPlugins({ importMapURL }), entryPoints: ["./quarto.ts"], outfile: "../package/pkg-working/bin/quarto.js", bundle: true, format: "esm" })` from `src/`. Adding `metafile: true` and writing `result.metafile` to `../package/pkg-working/bin/quarto.meta.json` gives the module graph for the `quarto.ts` root for free during `quarto-bld prepare-dist`. The import-report scripts accept any root (`Deno.args[0]`), so the adapter also runs esbuild in-process (`write: false`) for roots other than the one in the saved metafile. The metafile shape (esbuild `Metafile`):

```ts
interface Metafile {
  inputs: { [path: string]: { bytes: number; imports: { path: string; kind: string; external?: boolean; original?: string }[] } };
  outputs: { ... };
}
```

Keys and `imports[].path` are relative paths from the esbuild working directory for local files and `namespace:specifier` strings for files the deno loader resolved remotely (`https://...`, `jsr:...`, `npm:...`). `original` is the specifier as written in the source. Type-only imports do not appear (esbuild erases them), so the converted graph has no `dependencies[].type` entries; `find-bad-imports.ts:14-26` (the "library imports from inside src/core/lib" check that relied on `dep.type.error`) loses that branch and is documented as such.

Assumptions: `tools/codemod-deno-ral.ts --dir package/src` computes imports relative to `src/deno_ral` from outside `src/` (PR 09's tool handles arbitrary `--dir`); `src/deno_ral/process.ts` exports `exec`, `execPath`, `ExecOutput` per the vocabulary.

### Scope

In: the table; `tools/deno-esbuild-bundle.ts` metafile output; the codemod over `package/src`; baseline.
Out: `deno compile`/`deno install` in `package/src/util/deno.ts` and `compile-quarto-latexmk.ts` (`execProcess` calls of the Deno binary; PR 33/39); the `npm:` pins in `report-bundle-async-cycles.ts`; `package/src/quarto-bld` shell launchers (PR 33).

### Interfaces

`package/src/common/import-report/module-graph.ts` (new):

```ts
/*
 * module-graph.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 *
 * Module graph of a TypeScript entry point in the shape `deno info --json`
 * used to produce, derived from an esbuild metafile.
 */

import type { DenoInfoJSON } from "./deno-info.ts";

/** Minimal esbuild Metafile shape this adapter reads. */
export interface EsbuildMetafile {
  inputs: Record<string, {
    bytes: number;
    imports: { path: string; kind: string; external?: boolean; original?: string }[];
  }>;
}

/** Converts a metafile produced with working directory `cwd` and entry
 * `entry` (both absolute paths) into the `deno info` shape: every input
 * becomes a module with a file:// (or remote) specifier; every import
 * becomes a dependency with `code.specifier` resolved the same way. */
export function moduleGraphFromMetafile(
  metafile: EsbuildMetafile,
  cwd: string,
  entry: string,
): DenoInfoJSON;

/** Module graph for `root` (absolute or cwd-relative path to a .ts file).
 * Uses `package/pkg-working/bin/quarto.meta.json` when it exists and `root`
 * is `src/quarto.ts`; otherwise runs esbuild in-process with the same
 * resolver as tools/deno-esbuild-bundle.ts (write: false, metafile: true). */
export function getModuleGraph(root: string): Promise<DenoInfoJSON>;
```

`package/src/common/import-report/deno-info.ts`: `getDenoInfo(root)` becomes a one-line wrapper `return getModuleGraph(root)` (kept so the six report scripts need no signature change; the file's interfaces stay).

### Files

- Create: `package/src/common/import-report/module-graph.ts`, `tests/unit/package/module-graph.test.ts`.
- Modify: `tools/deno-esbuild-bundle.ts:12-38`; `package/src/common/import-report/deno-info.ts:65-75`; `package/src/common/cyclic-dependencies.ts:141-169`; `package/src/util/tar.ts`, `git.ts`, `cmd.ts`, `utils.ts`; `package/src/common/configure.ts:160-176`; `package/src/common/import-report/{explain-import-chain,explain-all-cycles,report-risky-files,report-bundle-async-cycles,find-bad-imports,find-bad-types-constants}.ts`; every other `package/src` file the codemod touches; `tools/runtime-boundary-baseline.json`.

### Acceptance criteria

- `grep -rnE '\bDeno\.' package/src --include=*.ts` prints nothing.
- `grep -rn 'from "jsr:\|from "https:' package/src --include=*.ts` prints nothing (`npm:` pins in `report-bundle-async-cycles.ts` are allowed and listed in the PR).
- `grep -rn '"info"' package/src --include=*.ts` prints nothing.
- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/package/module-graph.test.ts` passes.
- `package/src/quarto-bld prepare-dist` completes and writes `package/pkg-working/bin/quarto.js` and `quarto.meta.json`; `package/src/quarto-bld cycle-dependencies -o /tmp/cycles.json` writes a JSON with the same top-level keys as before (`cycle: [a, b]`, `stacks`).
- `quarto run --dev package/src/common/import-report/find-bad-imports.ts src/quarto.ts` runs and exits 0.
- Ratchet: `package/src` `Deno.*` count 0; baseline committed.

## Plan

### Task 1: Metafile adapter with a unit test

**Files:**
- Create: `package/src/common/import-report/module-graph.ts`, `tests/unit/package/module-graph.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
/*
 * module-graph.test.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { assertEquals } from "../../asserts.ts";
import { unitTest } from "../../test.ts";
import { moduleGraphFromMetafile } from "../../../package/src/common/import-report/module-graph.ts";
import { moduleGraph } from "../../../package/src/common/import-report/deno-info.ts";

const cwd = "/repo/src";

unitTest("module-graph - converts local and remote metafile inputs to deno-info modules", async () => {
  const info = moduleGraphFromMetafile({
    inputs: {
      "quarto.ts": {
        bytes: 10,
        imports: [
          { path: "core/log.ts", kind: "import-statement", original: "./core/log.ts" },
          { path: "jsr:@std/path@1.0.8/mod.ts", kind: "import-statement", original: "path" },
        ],
      },
      "core/log.ts": { bytes: 5, imports: [] },
      "jsr:@std/path@1.0.8/mod.ts": { bytes: 7, imports: [] },
    },
  }, cwd, "/repo/src/quarto.ts");

  assertEquals(info.roots, ["file:///repo/src/quarto.ts"]);
  const specs = info.modules.map((m) => m.specifier).sort();
  assertEquals(specs, [
    "file:///repo/src/core/log.ts",
    "file:///repo/src/quarto.ts",
    "jsr:@std/path@1.0.8/mod.ts",
  ]);
  const entry = info.modules.find((m) => m.specifier === "file:///repo/src/quarto.ts")!;
  assertEquals(entry.dependencies.map((d) => d.code?.specifier), [
    "file:///repo/src/core/log.ts",
    "jsr:@std/path@1.0.8/mod.ts",
  ]);
  assertEquals(entry.dependencies.map((d) => d.specifier), ["./core/log.ts", "path"]);
  assertEquals(entry.size, 10);
  assertEquals(entry.mediaType, "TypeScript");

  // The existing consumer turns it into an adjacency list.
  const { graph, errors } = moduleGraph(info);
  assertEquals(errors, []);
  assertEquals(graph["file:///repo/src/quarto.ts"], [
    "file:///repo/src/core/log.ts",
    "jsr:@std/path@1.0.8/mod.ts",
  ]);
  await Promise.resolve();
});

unitTest("module-graph - external imports are kept as edges to their specifier", async () => {
  const info = moduleGraphFromMetafile({
    inputs: {
      "a.ts": {
        bytes: 1,
        imports: [{ path: "node:fs", kind: "import-statement", external: true }],
      },
    },
  }, cwd, "/repo/src/a.ts");
  assertEquals(info.modules[0].dependencies[0].code?.specifier, "node:fs");
  await Promise.resolve();
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/package/module-graph.test.ts`
Expected: type-check error `Module not found ".../package/src/common/import-report/module-graph.ts"`.

- [ ] **Step 3: Implement**

```ts
/*
 * module-graph.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 *
 * Module graph of a TypeScript entry point in the shape `deno info --json`
 * used to produce, derived from an esbuild metafile. Replaces the
 * `deno info` subprocess the import reports and cycle-dependencies used.
 */

import * as esbuild from "npm:esbuild@0.27.1";
import { denoPlugins } from "jsr:@luca/esbuild-deno-loader@^0.11.1";
import { existsSync, readTextFileSync } from "../../../../src/deno_ral/fs.ts";
import { dirname, extname, isAbsolute, join, resolve, toFileUrl } from "../../../../src/deno_ral/path.ts";
import { cwd as processCwd } from "../../../../src/deno_ral/process.ts";
import type { DenoInfoJSON, DenoInfoModule } from "./deno-info.ts";

export interface EsbuildMetafile {
  inputs: Record<string, {
    bytes: number;
    imports: { path: string; kind: string; external?: boolean; original?: string }[];
  }>;
}

function isRemote(path: string): boolean {
  return /^(https?:|jsr:|npm:|node:|data:)/.test(path);
}

function toSpecifier(path: string, cwd: string): string {
  if (isRemote(path)) return path;
  return toFileUrl(isAbsolute(path) ? path : resolve(cwd, path)).href;
}

function mediaTypeFor(path: string): string {
  switch (extname(path)) {
    case ".ts": return "TypeScript";
    case ".js": case ".mjs": return "JavaScript";
    case ".json": return "Json";
    case ".wasm": return "Wasm";
    default: return "Unknown";
  }
}

export function moduleGraphFromMetafile(
  metafile: EsbuildMetafile,
  cwd: string,
  entry: string,
): DenoInfoJSON {
  const modules: DenoInfoModule[] = [];
  for (const [path, input] of Object.entries(metafile.inputs)) {
    const specifier = toSpecifier(path, cwd);
    modules.push({
      specifier,
      local: isRemote(path) ? "" : resolve(cwd, path),
      emit: "",
      map: null,
      mediaType: mediaTypeFor(path),
      size: input.bytes,
      dependencies: input.imports.map((imp) => ({
        specifier: imp.original ?? imp.path,
        code: {
          specifier: toSpecifier(imp.path, cwd),
          span: { start: 0, end: 0 },
        },
      })),
    });
  }
  return { roots: [toSpecifier(entry, cwd)], modules };
}

function repoRoot(): string {
  // package/src/common/import-report/module-graph.ts → repo root
  return resolve(dirname(new URL(import.meta.url).pathname), "../../../..");
}

export async function getModuleGraph(root: string): Promise<DenoInfoJSON> {
  const entry = resolve(processCwd(), root);
  const srcDir = join(repoRoot(), "src");
  const saved = join(repoRoot(), "package", "pkg-working", "bin", "quarto.meta.json");
  if (entry === join(srcDir, "quarto.ts") && existsSync(saved)) {
    const metafile = JSON.parse(readTextFileSync(saved)) as EsbuildMetafile;
    return moduleGraphFromMetafile(metafile, srcDir, entry);
  }
  const importMapURL = toFileUrl(join(srcDir, "import_map.json")).href;
  const result = await esbuild.build({
    plugins: [...denoPlugins({ importMapURL })],
    entryPoints: [entry],
    absWorkingDir: srcDir,
    bundle: true,
    format: "esm",
    write: false,
    metafile: true,
    logLevel: "silent",
  });
  esbuild.stop();
  return moduleGraphFromMetafile(result.metafile as EsbuildMetafile, srcDir, entry);
}
```

`toFileUrl` is exported by `src/deno_ral/path.ts` (line 20). On Windows, `new URL(import.meta.url).pathname` has a leading slash before the drive letter; use `fromFileUrl(import.meta.url)` from `path.ts` instead of `.pathname` (write it that way from the start: `resolve(dirname(fromFileUrl(import.meta.url)), "../../../..")`).

- [ ] **Step 4: Run the test**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/package/module-graph.test.ts`
Expected: `..` then `ok | 2 passed | 0 failed`.

- [ ] **Step 5: Commit**

```bash
git add package/src/common/import-report/module-graph.ts tests/unit/package/module-graph.test.ts
git commit -m "package/src: module graph from an esbuild metafile (replacement for deno info --json)"
```

### Task 2: Bundle script writes the metafile; `deno info` callers use the adapter

**Files:**
- Modify: `tools/deno-esbuild-bundle.ts:12-44`, `package/src/common/import-report/deno-info.ts:65-75`, `package/src/common/cyclic-dependencies.ts:7-14,141-169`

- [ ] **Step 1: `tools/deno-esbuild-bundle.ts`**

Replace lines 12–38 with:

```ts
const result = await esbuild.build({
  plugins: [...denoPlugins({ importMapURL })],
  entryPoints: ["./quarto.ts"],
  outfile: "../package/pkg-working/bin/quarto.js",
  bundle: true,
  format: "esm",
  metafile: true,
});
esbuild.stop();
// Module graph for package/src/common/import-report and cycle-dependencies.
Deno.writeTextFileSync(
  "../package/pkg-working/bin/quarto.meta.json",
  JSON.stringify(result.metafile),
);
```

(The commented-out plugin experiment on lines 14–31 is dropped; `tools/` is bundler code, not application code, so its `Deno.` calls are fine until PR 33.)

- [ ] **Step 2: `deno-info.ts:65-75`**

```ts
import { getModuleGraph } from "./module-graph.ts";

export function getDenoInfo(root: string): Promise<DenoInfoJSON> {
  return getModuleGraph(root);
}
```

and delete the `architectureToolsPath` import on line 10 (now unused).

- [ ] **Step 3: `cyclic-dependencies.ts:141-169`**

```ts
async function loadModules(config: Configuration) {
  info("Reading modules");
  const jsonOutput = await getModuleGraph(
    join(config.directoryInfo.src, "quarto.ts"),
  );

  // module path, array of import paths
  const modules: Record<string, string[]> = {};
  for (const mod of jsonOutput.modules) {
    modules[mod.specifier] = mod.dependencies
      .map((dep) => dep.code?.specifier)
      .filter((p): p is string => p !== undefined);
  }

  return modules;
}
```

Add `import { getModuleGraph } from "./import-report/module-graph.ts";` and remove the `runCmd` import (line 10) if nothing else in the file uses it.

- [ ] **Step 4: Verify**

Run: `package/src/quarto-bld prepare-dist 2>&1 | tail -3 && ls -la package/pkg-working/bin/quarto.meta.json`
Expected: prepare-dist finishes; the metafile exists (several MB).
Run: `package/src/quarto-bld cycle-dependencies -o /tmp/cycles.json && python3 -c "import json;d=json.load(open('/tmp/cycles.json'));print(len(d), list(d.values())[0]['cycle'])"`
Expected: a positive count and a two-element cycle like `['file:///.../src/core/log.ts', 'file:///.../src/core/process.ts']`.
Run: `quarto run --dev package/src/common/import-report/find-bad-imports.ts src/quarto.ts; echo exit=$?` → `exit=0`.
Run: `quarto run --dev package/src/common/import-report/explain-all-cycles.ts src/quarto.ts --toon /tmp/cycles.toon && head -3 /tmp/cycles.toon` → `edges[N]{from,to}:` followed by edge lines.

- [ ] **Step 5: Commit**

```bash
git add tools/deno-esbuild-bundle.ts package/src/common/import-report/deno-info.ts package/src/common/cyclic-dependencies.ts
git commit -m "package/src: module graph from esbuild metafile instead of deno info"
```

### Task 3: `Deno.run` and `Deno.Command` by hand

**Files:** `package/src/util/tar.ts`, `git.ts`, `cmd.ts`, `utils.ts`, `package/src/common/configure.ts`, four import-report scripts

- [ ] **Step 1: `tar.ts`**

Add `import { exec } from "../../../src/deno_ral/process.ts";`. Lines 94–106:

```ts
  info(tarCmd);
  const status = await exec(tarCmd[0], {
    args: tarCmd.slice(1),
    stdout: "inherit",
    stderr: "inherit",
  });
  if (status.code !== 0) {
```

Lines 118–125:

```ts
  info(tarCmd);
  const status = await exec(tarCmd[0], {
    args: tarCmd.slice(1),
    cwd,
    stdout: "inherit",
    stderr: "inherit",
  });
  if (status.code !== 0) {
```

Delete both `// @ts-expect-error` lines.

- [ ] **Step 2: `git.ts`**

Add `import { exec } from "../../../src/deno_ral/process.ts";`.

```ts
async function checkout(dir: string, commit: string) {
  info(`Checking out ${commit}`);
  const status = await exec("git", {
    args: ["checkout", commit],
    cwd: dir,
    stdout: "inherit",
    stderr: "inherit",
  });
  if (status.code !== 0) {
    throw Error("Failed to checkout");
  }
}

async function clone(workingDir: string, url: string) {
  info(`Cloning ${url}`);
  const result = await exec("git", {
    args: ["clone", url],
    cwd: workingDir,
    stdout: "inherit",
    stderr: "piped",
  });
  if (result.code !== 0) {
    throw Error("Failed to clone repo");
  }
  const outputTxt = new TextDecoder().decode(result.stderr);
  if (outputTxt) {
    // Forward the output
    info(outputTxt);
    // Find the directory that we cloned into and return that
    const match = outputTxt.match(/^Cloning into '(.*)'\.\.\.$/m);
    if (match) {
      return match[1];
    } else {
      throw Error("Failed to determine cloned repo directory");
    }
  } else {
    throw Error("No output from git clone");
  }
}

export async function applyGitPatches(patches: string[]) {
  if (!patches) return undefined;
  info(`Applying Git patches...`);
  for (const patch of patches) {
    info(`  - patch ${colors.blue(patch)}`);
    const status = await exec("git", {
      args: ["apply", patch, "--ignore-space-change", "--reject"],
      stdout: "inherit",
      stderr: "piped",
    });
    if (status.code !== 0) {
      throw Error(`Failed to apply patch: '${patch}'`);
    }
  }
}
```

- [ ] **Step 3: `cmd.ts:26-31`**

```ts
  const output = await exec(runCmd, { args });
```

(`exec` defaults to piped stdout/stderr; `output.code`, `output.stdout`, `output.stderr` keep their meaning.) Import `exec` from `../../../src/deno_ral/process.ts`.

- [ ] **Step 4: `utils.ts:19-29`**

```ts
export async function download(src: string, dest: string): Promise<void> {
  const response = await fetch(src);
  const data = await response.blob();
  const buffer = await data.arrayBuffer();
  writeFileSync(dest, new Uint8Array(buffer));
}
```

Import `writeFileSync` from `../../../src/deno_ral/fs.ts`; drop the `writeAll` import (PR 22 rewrote it to `io.ts`; now unused).

- [ ] **Step 5: `configure.ts:160-176`**

```ts
export function copyPandocScript(config: Configuration, targetDir: string) {
  const linkTarget = join(config.arch, "pandoc");

  const pandocFile = join(targetDir, "pandoc");
  if (existsSync(pandocFile)) {
    info("> removing existing pandoc link");
    removeSync(pandocFile);
  }

  if (!isWindows) {
    info("> creating pandoc symlink");
    symlinkSync(linkTarget, pandocFile);
  }
}
```

Import `removeSync`, `symlinkSync` from `../../../src/deno_ral/fs.ts` (merge with the existing import). `symlinkSync(target, path)` with a relative `target` creates the same relative link `ln -s x86_64/pandoc pandoc` did; it is also now synchronous and error-checked where the old `Deno.run` was fire-and-forget.

- [ ] **Step 6: The import-report scripts**

`explain-import-chain.ts:140-143` and `explain-all-cycles.ts:144-147`:

```ts
  await exec("quarto", {
    args: ["preview", filename],
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });
```

`report-risky-files.ts:63-68`: read lines 69–80 to see how the output is consumed (it calls `p.output()` for stdout after checking the status); convert to:

```ts
  const rg = await exec("rg", { args: ["-l", "export const"] });
  if (rg.code !== 0) {
    exit(rg.code);
  }
  const rgOutput = new TextDecoder().decode(rg.stdout);
```

and replace the later `new TextDecoder().decode(await p.output())` with `rgOutput`.

`report-bundle-async-cycles.ts:28-63`:

```ts
  const scriptPath = resolve("package/src/common/import-report/explain-all-cycles.ts");
  const importMapPath = resolve("src/import_map.json");

  const result = await exec(execPath(), {
    args: [
      "run",
      "--allow-read",
      "--allow-write",
      "--allow-env",
      "--allow-net",
      "--allow-run",
      "--allow-import",
      "--import-map",
      importMapPath,
      scriptPath,
      entryPoint,
      "--simplify",
      "--toon",
      cyclesFile,
    ],
  });
  if (!result.success) {
    const error = new TextDecoder().decode(result.stderr);
    throw new Error(`Failed to generate cycles: ${error}`);
  }
  return cyclesFile;
```

(`execPath()` is the running Deno binary, the same `QUARTO_DENO` pointed at; the `architectureToolsPath` import goes away. The `run` flags are Deno's and stay until PR 35/37 give these scripts a Node entry.)

`find-bad-imports.ts:2` and `find-bad-types-constants.ts:2`: `import { brightBlue } from "../../../../src/deno_ral/colors.ts";`.

- [ ] **Step 7: Verify**

Run: `grep -rn 'Deno\.run\|Deno\.Command\|Deno\.create\|from "jsr:' package/src --include=*.ts` → nothing.
Run: `package/src/quarto-bld configure 2>&1 | tail -3` → finishes; `ls -l package/dist/bin/tools/pandoc` shows a symlink to `x86_64/pandoc` (or `aarch64/`).
Run: `quarto run --dev package/src/common/import-report/report-risky-files.ts src/quarto.ts | head -3` → a list of risky files (needs `rg` on PATH).

- [ ] **Step 8: Commit**

```bash
git add package/src/util package/src/common/configure.ts package/src/common/import-report
git commit -m "package/src: exec/symlinkSync/writeFileSync instead of Deno.run, Deno.Command, Deno.create; colors via deno_ral"
```

### Task 4: Codemod the rest

**Files:** every `package/src` file with remaining `Deno.*`

- [ ] **Step 1: Measure before**

```bash
grep -rhoE '\bDeno\.[A-Za-z_]+' package/src --include=*.ts | sort | uniq -c | sort -rn
```

Expected: the `env`/fs/`args`/`exit`/`cwd` rows from the inventory (about 215 sites); no `run`, `Command`, `create`, `build`.

- [ ] **Step 2: Run**

```bash
quarto run --dev tools/codemod-deno-ral.ts --rules fs,temp,env,process,platform --dir package/src --dry-run | head -80
quarto run --dev tools/codemod-deno-ral.ts --rules fs,temp,env,process,platform --dir package/src
grep -rnE '\bDeno\.' package/src --include=*.ts
```

Expected: the final grep prints nothing. Hand-fix any `skipped:` lines the tool reported (`Deno.errors.NotFound` at `validate-bundle.ts:72` becomes `isNotFound(e)` from `errors.ts` if the `fs` rule does not cover `instanceof Deno.errors.*`).

- [ ] **Step 3: Verify the build tooling end to end**

Run: `package/src/quarto-bld --help | head -3` → command list.
Run: `package/src/quarto-bld configure` → completes.
Run: `package/src/quarto-bld prepare-dist` → completes; `package/pkg-working/bin/quarto.js` and `quarto.meta.json` exist.
Run: `package/pkg-working/bin/quarto --version` (if the working dist has a launcher) or `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/render/render-html.test.ts` → pass.
Run: `package/src/quarto-bld update-html-dependencies --help` → prints usage (compiles the 57-site file).
CI: `.github/workflows/test-bundle.yml` exercises `prepare-dist`; `create-release.yml` (no-publish dispatch) exercises the installers.

- [ ] **Step 4: Commit**

```bash
git add package/src
git commit -m "package/src: codemod remaining Deno.* calls to deno_ral"
```

### Task 5: Ratchet

- [ ] **Step 1:** `quarto run --dev tools/check-runtime-boundary.ts --update-baseline` → `package/src` `Deno.*` count 0, std-import count 0.
- [ ] **Step 2: Commit**

```bash
git add tools/runtime-boundary-baseline.json
git commit -m "ratchet baseline: package/src at zero"
```

## Verification

- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/package/module-graph.test.ts` → `ok | 2 passed | 0 failed`.
- `package/src/quarto-bld configure && package/src/quarto-bld prepare-dist` → succeed; metafile written.
- `package/src/quarto-bld cycle-dependencies -o /tmp/cycles.json` → JSON written.
- `quarto run --dev package/src/common/import-report/find-bad-imports.ts src/quarto.ts` → exit 0.
- Acceptance greps → empty.
- `quarto run --dev tools/check-runtime-boundary.ts` → passes at zero for `package/src`.

## Review checklist

- [ ] No subprocess is spawned for `ln -s` anymore; the symlink target stays relative.
- [ ] `git clone` directory detection still parses stderr.
- [ ] `tar` commands inherit stdio (progress visible in CI logs as before).
- [ ] `getModuleGraph` prefers the saved metafile only for `src/quarto.ts` and falls back to in-process esbuild otherwise.
- [ ] Documented: type-only edges are absent from the metafile graph; `find-bad-imports`' lib check loses that branch.
- [ ] Codemod commit contains only prefix removals and import lines.
- [ ] `npm:` pins in `report-bundle-async-cycles.ts` listed in the PR as intentional.

## Risks and rollback

- esbuild in-process from `quarto run --dev` needs network for `npm:esbuild` and `jsr:@luca/esbuild-deno-loader` on first use (same as `tools/deno-esbuild-bundle.ts` today; the dev cache keeps them).
- The metafile omits type-only imports; any report that depended on them changes output. `cycle-dependencies` (runtime cycles) is unaffected and is the one used in CI.
- Rollback: revert the five commits; `deno info` comes back with them.

## Decisions needed

None.
