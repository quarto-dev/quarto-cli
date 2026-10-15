# PR 26: Node bundle tooling and an allowed-failure Node CI job

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the throwaway spike in `dev-docs/runtime-migration/spike/` into maintained tooling (`tools/node-bundle/`, a root `package.json`) and a CI job that builds the Node bundle and renders smoke documents on Node 22, so Phase 2 PRs have a live, measurable target.
**Phase:** 2. **Depends on:** PR 03, 04, 05, 06, 07 (every import-map entry is `jsr:` or `npm:`). **Unblocks:** PR 31, PR 32.
**Branch:** `rt/26-node-build-job`.
**Suggested executor:** Opus. The resolver, the shim inventory and the CI diff need judgement about what the bundle really references; the rest is mechanical.
**Size:** M (12 new files, 2 modified).
**Ships on:** Deno; nothing under `src/` changes. The Node job (`.github/workflows/test-node-bundle.yml`) is `continue-on-error: true` and is not required.

## Spec

### Context

Assessment section 10 ("What the spike changes in the plan") asks for a standing CI job early: build the Node bundle the way the spike does, run smoke documents on it, and use its failure list as the backlog for Phase 1 and 2. Section 11 ("Order of work", step 9) says the Phase 2 Node implementations are validated by "the spike's bundle in a CI job". This PR is that job.

The spike (`dev-docs/runtime-migration/spike/`) proved the approach but is not maintainable: it hard-codes `/home/user/quarto-cli`, resolves `deno.land/x` packages to local git clones, carries stubs for packages PR 04–07 replace, and sits on `@deno/shim-deno` 0.19.2, which is stale (June 2024) and had two bugs that bit immediately (`makeTempFile*` treats the prefix as a directory; `Conn.read` fails with EAGAIN). After PR 03–07, every import-map value is `jsr:` or `npm:`, so the resolver only needs the import map plus the `jsr:` → `@jsr/<scope>__<name>` rewrite and `node:` externals.

**Decision: the shim is Quarto's own, temporary scaffolding.** `tools/node-bundle/deno-shim.js` does not depend on `@deno/shim-deno`. It implements only the `Deno.*` members the bundle actually references (the build fails when the bundle references a member the shim lacks, Task 3), it shrinks as PR 27–30 move each RAL module onto `node:` APIs (each of those PRs deletes the members it makes unused), and PR 33 deletes it. Justification: (a) a stale third-party shim would be a production dependency of the dev bundle for the whole of Phase 2 and would need patching anyway; (b) writing the members ourselves is the first draft of the RAL implementations PR 27–30 ship, so the work is not wasted; (c) a shim that only grows smaller is a progress metric: `node tools/node-bundle/build.mjs --check-shim` prints the members still in use.

**Decision: where Node-only dependencies live.** `ws` (WebSocket server, needed by the shim now and by `src/deno_ral/http.ts` from PR 29) and `esbuild` (the bundler) are `devDependencies` in the root `package.json`. `dependencies` is the exact mirror of `src/import_map.json` and is checked by `tools/node-bundle/check-deps.mjs`. PR 29 adds `"ws": "npm:ws@8.22.0"` to the import map and moves `ws` into `dependencies` (the check then requires it there).

**Decision: no `"type": "module"` in the root `package.json`.** The repository contains many `.js` files (`src/resources/**`, `tools/**`) that are not ESM for Node; a root `"type": "module"` would change how Node parses every one of them. All Node tooling uses the `.mjs` extension, and the bundle output is `tools/node-bundle/dist/quarto.mjs`.

### Scope

In:
- `tools/node-bundle/build.mjs`, `import-map.mjs` (shared resolver), `deno-shim.js`, `quarto-node` launcher, `check-deps.mjs`, `normalize-html.mjs`.
- Root `package.json`, `package-lock.json`, `.npmrc`; `.gitignore` entries.
- `.github/workflows/test-node-bundle.yml` (Linux only, `continue-on-error: true`).
- `dev-docs/runtime-migration/node-bundle.md` (usage note).
- `dev-docs/runtime-migration/spike/README.md`: one paragraph pointing at the new tooling.

Out:
- Any change under `src/` (the bundle must run the unmodified sources).
- macOS and Windows jobs, running the test suite on Node (PR 31, PR 32).
- Removing the spike directory (it stays as the historical record).
- `quarto-bld`/`prepare-dist` on Node (PR 33).

### Interfaces

`tools/node-bundle/import-map.mjs` (ESM, Node 22, no dependencies):

```js
/** Loads src/import_map.json and returns { imports, keys } (keys sorted longest first). */
export function loadImportMap(root: string): { imports: Record<string, string>; keys: string[] };
/** Applies the import map to a specifier (prefix entries ending in "/" and exact entries). Returns the input unchanged when nothing matches. */
export function applyImportMap(spec: string, map: { imports: Record<string, string>; keys: string[] }): string;
/** "jsr:@std/path@1.0.8/join" -> "@jsr/std__path/join". Throws on a malformed spec. */
export function jsrToNpm(spec: string): string;
/** "npm:/lodash@4.17.21/debounce.js" -> "lodash/debounce.js". Throws on a malformed spec. */
export function npmSpec(spec: string): string;
/** Parses a jsr:/npm: value into { name, version, subpath } where name is the npm package name ("@jsr/std__path" or "lodash"). */
export function packageOf(value: string): { name: string; version: string; subpath: string };
/** Resolves a bare specifier to an npm specifier, or returns { external: true } for node: builtins. Throws Error("unmapped remote import <spec> -> <mapped>") for any remaining https:// value. */
export function resolveBare(spec: string, map): { target: string } | { external: true };
```

`tools/node-bundle/build.mjs`: `node tools/node-bundle/build.mjs [--entry src/quarto.ts] [--out tools/node-bundle/dist/quarto.mjs] [--check-shim]`. Writes the bundle, `dist/meta.json` (esbuild metafile) and `dist/resolved.json` (specifier → npm target). With `--check-shim` it scans the bundle for `Deno.<member>` references, compares them with the members `deno-shim.js` defines, prints the list and exits 1 on any missing member.

`tools/node-bundle/check-deps.mjs`: `node tools/node-bundle/check-deps.mjs [--write]`. Compares the `dependencies` of `package.json` with the set derived from `src/import_map.json`; exits 1 and prints the differences; `--write` rewrites `dependencies` (sorted) and leaves `devDependencies` untouched.

`tools/node-bundle/normalize-html.mjs`: `node tools/node-bundle/normalize-html.mjs <dir>` rewrites every `.html`, `.css`, `.json` and `.xml` file under `<dir>` in place: 32-hex-digit hashes → `HASH`, `id="<8 hex>"` cell ids → `id="CELLID"`, ISO timestamps → `TIMESTAMP`.

`tools/node-bundle/quarto-node`: bash launcher. Resolves the repository root from its own location, exports `QUARTO_BIN_PATH=$ROOT/package/dist/bin`, `QUARTO_SHARE_PATH=$ROOT/src/resources`, runs `node --enable-experimental-regexp-engine --max-old-space-size=8192 --stack-trace-limit=100 $ROOT/tools/node-bundle/dist/quarto.mjs "$@"`. Honours `QUARTO_NODE` (path to a node binary, default `node`).

### Files

- Create: `tools/node-bundle/import-map.mjs` (resolver shared by `build.mjs`, `check-deps.mjs` and PR 31's loader hook)
- Create: `tools/node-bundle/build.mjs` (esbuild bundle; from `spike/build.mjs` without clones/stubs)
- Create: `tools/node-bundle/deno-shim.js` (`globalThis.Deno` for the bundle; temporary)
- Create: `tools/node-bundle/quarto-node` (launcher, executable bit set)
- Create: `tools/node-bundle/check-deps.mjs`
- Create: `tools/node-bundle/normalize-html.mjs`
- Create: `tools/node-bundle/check-deps.test.mjs` (node:test unit test for the resolver and the drift check)
- Create: `package.json`, `package-lock.json`, `.npmrc`
- Create: `.github/workflows/test-node-bundle.yml`
- Create: `dev-docs/runtime-migration/node-bundle.md`
- Modify: `.gitignore` (add `/node_modules` and `/tools/node-bundle/dist`)
- Modify: `dev-docs/runtime-migration/spike/README.md` (pointer paragraph at the top)
- Modify: `dev-docs/runtime-migration/README.md` (PR 26 status → `merged` at the end)

### Acceptance criteria

- `npm ci && node tools/node-bundle/build.mjs --check-shim` exits 0 on a clean checkout with Node 22 and prints `bundled src/quarto.ts -> tools/node-bundle/dist/quarto.mjs (...)` followed by `shim: N members referenced, 0 missing`.
- `tools/node-bundle/quarto-node --version` prints `99.9.9`.
- `tools/node-bundle/quarto-node render dev-docs/runtime-migration/spike/tests/simple.qmd` produces `simple.html`; after `normalize-html.mjs`, `diff` against the Deno render of the same file is empty.
- `node tools/node-bundle/check-deps.mjs` exits 0; editing one version in `src/import_map.json` makes it exit 1 with a one-line explanation per difference.
- `node --test tools/node-bundle/check-deps.test.mjs` passes.
- The workflow runs on pull requests, is marked `continue-on-error: true`, and uploads `node-render-diff` as an artifact.
- No file under `src/` changes (`git diff --stat main -- src/` is empty).

## Plan

### Task 1: Resolver module with tests

**Files:**
- Create: `tools/node-bundle/import-map.mjs`
- Create: `tools/node-bundle/check-deps.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
// tools/node-bundle/check-deps.test.mjs
// Copyright (C) 2026 Posit Software, PBC
import { test } from "node:test";
import assert from "node:assert/strict";
import { applyImportMap, jsrToNpm, npmSpec, packageOf, resolveBare, dependenciesFromImportMap } from "./import-map.mjs";

const map = {
  imports: {
    "path": "jsr:@std/path@1.0.8",
    "fs/": "jsr:/@std/fs@1.0.16/",
    "lodash/": "npm:/lodash@4.17.21/",
    "zod": "npm:/zod@3.24.4",
    "stale": "https://deno.land/x/stale@1.0.0/mod.ts",
  },
};
map.keys = Object.keys(map.imports).sort((a, b) => b.length - a.length);

test("applyImportMap handles exact and prefix entries", () => {
  assert.equal(applyImportMap("path", map), "jsr:@std/path@1.0.8");
  assert.equal(applyImportMap("fs/walk", map), "jsr:/@std/fs@1.0.16/walk");
  assert.equal(applyImportMap("lodash/debounce.js", map), "npm:/lodash@4.17.21/debounce.js");
  assert.equal(applyImportMap("./local.ts", map), "./local.ts");
});

test("jsrToNpm and npmSpec rewrite specifiers", () => {
  assert.equal(jsrToNpm("jsr:@std/path@1.0.8"), "@jsr/std__path");
  assert.equal(jsrToNpm("jsr:/@std/fs@1.0.16/walk"), "@jsr/std__fs/walk");
  assert.equal(npmSpec("npm:/lodash@4.17.21/debounce.js"), "lodash/debounce.js");
  assert.equal(npmSpec("npm:@b-fuze/deno-dom@0.1.49"), "@b-fuze/deno-dom");
  assert.throws(() => jsrToNpm("jsr:nope"), /bad jsr spec/);
});

test("packageOf extracts name, version and subpath", () => {
  assert.deepEqual(packageOf("jsr:/@std/fs@1.0.16/"), { name: "@jsr/std__fs", version: "1.0.16", subpath: "/" });
  assert.deepEqual(packageOf("npm:/zod@3.24.4"), { name: "zod", version: "3.24.4", subpath: "" });
});

test("resolveBare externalises node: and rejects https:", () => {
  assert.deepEqual(resolveBare("node:fs", map), { external: true });
  assert.deepEqual(resolveBare("zod", map), { target: "zod" });
  assert.throws(() => resolveBare("stale", map), /unmapped remote import stale -> https:\/\/deno\.land/);
});

test("dependenciesFromImportMap collapses subpaths and keeps one version per package", () => {
  assert.deepEqual(dependenciesFromImportMap(map), {
    "@jsr/std__fs": "1.0.16",
    "@jsr/std__path": "1.0.8",
    "lodash": "4.17.21",
    "zod": "3.24.4",
  });
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --test tools/node-bundle/check-deps.test.mjs`
Expected: `Error [ERR_MODULE_NOT_FOUND]: Cannot find module '.../tools/node-bundle/import-map.mjs'`

- [ ] **Step 3: Implement**

```js
// tools/node-bundle/import-map.mjs
// Copyright (C) 2026 Posit Software, PBC
//
// Resolves Deno import-map specifiers (src/import_map.json) to npm package
// specifiers for the Node bundle, the dependency drift check and the Node
// test loader hook. After PR 03-07 every import-map value is `jsr:` or `npm:`.
import fs from "node:fs";
import path from "node:path";

export function loadImportMap(root) {
  const file = path.join(root, "src", "import_map.json");
  const imports = JSON.parse(fs.readFileSync(file, "utf8")).imports;
  const keys = Object.keys(imports).sort((a, b) => b.length - a.length);
  return { imports, keys };
}

export function applyImportMap(spec, map) {
  for (const k of map.keys) {
    if (k.endsWith("/")) {
      if (spec.startsWith(k)) return map.imports[k] + spec.slice(k.length);
    } else if (spec === k) {
      return map.imports[k];
    }
  }
  return spec;
}

const kJsr = /^jsr:\/?@([^/]+)\/([^@/]+)@([^/]+)(\/.*)?$/;
const kNpm = /^npm:\/?((?:@[^/]+\/)?[^@/]+)@([^/]+)(\/.*)?$/;

export function jsrToNpm(spec) {
  const m = spec.match(kJsr);
  if (!m) throw new Error("bad jsr spec " + spec);
  return `@jsr/${m[1]}__${m[2]}${m[4] ?? ""}`;
}

export function npmSpec(spec) {
  const m = spec.match(kNpm);
  if (!m) throw new Error("bad npm spec " + spec);
  return m[1] + (m[3] ?? "");
}

export function packageOf(value) {
  let m = value.match(kJsr);
  if (m) return { name: `@jsr/${m[1]}__${m[2]}`, version: m[3], subpath: m[4] ?? "" };
  m = value.match(kNpm);
  if (m) return { name: m[1], version: m[2], subpath: m[3] ?? "" };
  throw new Error("not a jsr:/npm: value: " + value);
}

export function resolveBare(spec, map) {
  if (spec.startsWith("node:")) return { external: true };
  const mapped = applyImportMap(spec, map);
  if (mapped.startsWith("jsr:")) return { target: jsrToNpm(mapped) };
  if (mapped.startsWith("npm:")) return { target: npmSpec(mapped) };
  if (/^https?:\/\//.test(mapped)) {
    throw new Error(
      `unmapped remote import ${spec} -> ${mapped}. Every import-map value must be jsr: or npm: (see dev-docs/runtime-migration/03-deps-skypack-to-npm.md).`,
    );
  }
  return { target: mapped };
}

export function dependenciesFromImportMap(map) {
  const deps = {};
  for (const value of Object.values(map.imports)) {
    if (!/^(jsr|npm):/.test(value)) continue;
    const { name, version } = packageOf(value);
    if (deps[name] && deps[name] !== version) {
      throw new Error(`import map pins ${name} at both ${deps[name]} and ${version}`);
    }
    deps[name] = version;
  }
  return Object.fromEntries(Object.entries(deps).sort(([a], [b]) => a.localeCompare(b)));
}
```

- [ ] **Step 4: Run the tests**

Run: `node --test tools/node-bundle/check-deps.test.mjs`
Expected: `# pass 5` and `# fail 0`.

- [ ] **Step 5: Commit**

```bash
git add tools/node-bundle/import-map.mjs tools/node-bundle/check-deps.test.mjs
git commit -m "Add import-map resolver for the Node bundle tooling"
```

### Task 2: Root package.json, lockfile and the drift check

**Files:**
- Create: `tools/node-bundle/check-deps.mjs`
- Create: `package.json`, `package-lock.json`, `.npmrc`
- Modify: `.gitignore`

- [ ] **Step 1: Write the drift check**

```js
// tools/node-bundle/check-deps.mjs
// Copyright (C) 2026 Posit Software, PBC
//
// package.json `dependencies` must mirror src/import_map.json exactly.
// `devDependencies` (esbuild, ws until PR 29) are Node-only and not checked.
// Usage: node tools/node-bundle/check-deps.mjs [--write]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { dependenciesFromImportMap, loadImportMap } from "./import-map.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const pkgPath = path.join(root, "package.json");
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
const expected = dependenciesFromImportMap(loadImportMap(root));
const actual = pkg.dependencies ?? {};

const problems = [];
for (const [name, version] of Object.entries(expected)) {
  if (!(name in actual)) problems.push(`missing in package.json: "${name}": "${version}"`);
  else if (actual[name] !== version) problems.push(`version drift: ${name} is ${actual[name]} in package.json, ${version} in src/import_map.json`);
}
for (const name of Object.keys(actual)) {
  if (!(name in expected)) problems.push(`not in src/import_map.json: ${name} (move it to devDependencies or add an import-map entry)`);
}

if (process.argv.includes("--write")) {
  pkg.dependencies = expected;
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
  console.log(`wrote ${Object.keys(expected).length} dependencies to package.json; run 'npm install' to update package-lock.json`);
  process.exit(0);
}
if (problems.length) {
  console.error("package.json dependencies drift from src/import_map.json:");
  for (const p of problems) console.error("  " + p);
  console.error("Fix: node tools/node-bundle/check-deps.mjs --write && npm install");
  process.exit(1);
}
console.log(`package.json dependencies match src/import_map.json (${Object.keys(expected).length} packages)`);
```

- [ ] **Step 2: Create the package files**

```json
// package.json (dependencies are generated in the next step; keep devDependencies by hand)
{
  "name": "quarto-cli",
  "private": true,
  "description": "Node bundle tooling for quarto-cli (dev-docs/runtime-migration/node-bundle.md). dependencies mirrors src/import_map.json; devDependencies are Node-only.",
  "engines": { "node": ">=22.12" },
  "scripts": {
    "bundle": "node tools/node-bundle/build.mjs --check-shim",
    "check-deps": "node tools/node-bundle/check-deps.mjs",
    "test:tooling": "node --test tools/node-bundle/"
  },
  "dependencies": {},
  "devDependencies": {
    "esbuild": "0.28.1",
    "ws": "8.22.0"
  }
}
```

```ini
# .npmrc
@jsr:registry=https://npm.jsr.io
```

Append to `.gitignore`:

```
# Node bundle tooling (tools/node-bundle/)
/node_modules
/tools/node-bundle/dist
```

- [ ] **Step 3: Generate dependencies and the lockfile**

Run:
```bash
node tools/node-bundle/check-deps.mjs --write
npm install
node tools/node-bundle/check-deps.mjs
```
Expected: the first command prints `wrote N dependencies to package.json`; `npm install` creates `package-lock.json` and `node_modules/@jsr/...`; the third prints `package.json dependencies match src/import_map.json (N packages)`. N is the number of distinct packages in the import map after PR 03–07 (around 35). If `npm install` reports a 404 for an `@jsr/*` package, the import-map version does not exist on JSR: fix the import map in a follow-up to the dependency PR, not here.

- [ ] **Step 4: Verify the check fails on drift**

Run:
```bash
sed -i.bak 's/"zod": "npm:\/zod@3.24.4"/"zod": "npm:\/zod@3.24.5"/' src/import_map.json
node tools/node-bundle/check-deps.mjs; echo "exit=$?"
mv src/import_map.json.bak src/import_map.json
```
Expected: `version drift: zod is 3.24.4 in package.json, 3.24.5 in src/import_map.json` and `exit=1`.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json .npmrc .gitignore tools/node-bundle/check-deps.mjs
git commit -m "Add root package.json mirroring src/import_map.json with a drift check"
```

### Task 3: The bundler

**Files:**
- Create: `tools/node-bundle/build.mjs`

- [ ] **Step 1: Write the bundler**

```js
// tools/node-bundle/build.mjs
// Copyright (C) 2026 Posit Software, PBC
//
// Bundles src/quarto.ts for Node 22 with esbuild, resolving the Deno import
// map to npm / JSR-on-npm packages. Usage:
//   node tools/node-bundle/build.mjs [--entry src/quarto.ts] [--out tools/node-bundle/dist/quarto.mjs] [--check-shim]
import * as esbuild from "esbuild";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadImportMap, resolveBare } from "./import-map.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "..");

function arg(name, def) {
  const i = process.argv.indexOf(name);
  return i === -1 ? def : process.argv[i + 1];
}
const entry = path.resolve(root, arg("--entry", "src/quarto.ts"));
const outfile = path.resolve(root, arg("--out", "tools/node-bundle/dist/quarto.mjs"));
const checkShim = process.argv.includes("--check-shim");
const shimPath = path.join(here, "deno-shim.js");

const map = loadImportMap(root);
const resolved = new Map();

const plugin = {
  name: "deno-import-map",
  setup(build) {
    build.onResolve({ filter: /.*/ }, async (args) => {
      if (args.kind === "entry-point" || args.pluginData === "remapped") return;
      const spec = args.path;
      if (spec.startsWith("./") || spec.startsWith("../") || path.isAbsolute(spec) || spec.startsWith("file:")) return;
      let r;
      try {
        r = resolveBare(spec, map);
      } catch (e) {
        return { errors: [{ text: `${e.message} (from ${args.importer})` }] };
      }
      if (r.external) return { path: spec, external: true };
      resolved.set(spec, r.target);
      const res = await build.resolve(r.target, { kind: args.kind, resolveDir: root, pluginData: "remapped" });
      if (res.errors.length) {
        return { errors: res.errors.map((e) => ({ ...e, text: `${e.text} (mapping ${spec} -> ${r.target} from ${args.importer}; run npm ci)` })) };
      }
      return { path: res.path, external: res.external };
    });
  },
};

fs.mkdirSync(path.dirname(outfile), { recursive: true });
const t0 = Date.now();
const result = await esbuild.build({
  entryPoints: [entry],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  outfile,
  sourcemap: true,
  logLevel: "warning",
  plugins: [plugin],
  // src/quarto.ts guards its main() on import.meta.main; PR 19 replaces it with isMainModule().
  define: { "import.meta.main": "true" },
  banner: {
    js: [
      `import ${JSON.stringify(path.relative(path.dirname(outfile), shimPath).split(path.sep).join("/").replace(/^(?!\.)/, "./"))};`,
      `import { createRequire as __createRequire } from "node:module"; const require = __createRequire(import.meta.url);`,
    ].join("\n"),
  },
  metafile: true,
  tsconfigRaw: { compilerOptions: { useDefineForClassFields: true, verbatimModuleSyntax: false } },
});
const dist = path.dirname(outfile);
fs.writeFileSync(path.join(dist, "meta.json"), JSON.stringify(result.metafile));
fs.writeFileSync(path.join(dist, "resolved.json"), JSON.stringify(Object.fromEntries(resolved), null, 2));
const size = fs.statSync(outfile).size;
console.log(
  `bundled ${path.relative(root, entry)} -> ${path.relative(root, outfile)} (${(size / 1e6).toFixed(1)} MB, ${Object.keys(result.metafile.inputs).length} modules, ${Date.now() - t0} ms, ${result.warnings.length} warnings)`,
);

if (checkShim) {
  // Members the bundle references vs members the shim assigns. The shim is
  // temporary scaffolding (deleted in PR 33); this list is the progress metric.
  const bundle = fs.readFileSync(outfile, "utf8");
  const used = new Set([...bundle.matchAll(/\bDeno\.([A-Za-z_]\w*)/g)].map((m) => m[1]));
  const shim = fs.readFileSync(shimPath, "utf8");
  const defined = new Set([...shim.matchAll(/^\s*Deno\.([A-Za-z_]\w*)\s*=/gm)].map((m) => m[1]));
  const missing = [...used].filter((m) => !defined.has(m)).sort();
  console.log(`shim: ${used.size} members referenced, ${missing.length} missing`);
  if (missing.length) {
    console.error("Deno members referenced by the bundle but not defined in tools/node-bundle/deno-shim.js:\n  " + missing.join("\n  "));
    process.exit(1);
  }
}
```

- [ ] **Step 2: Run it without the shim present and see the clear error**

Run: `node tools/node-bundle/build.mjs`
Expected: a bundle is written (the banner imports `./deno-shim.js`, which does not exist yet, so the bundle cannot run) and the summary line prints. Then `node tools/node-bundle/dist/quarto.mjs --version` fails with `ERR_MODULE_NOT_FOUND ... deno-shim.js`, which Task 4 fixes.

- [ ] **Step 3: Commit**

```bash
git add tools/node-bundle/build.mjs
git commit -m "Add esbuild Node bundler driven by src/import_map.json"
```

### Task 4: The temporary Deno shim

**Files:**
- Create: `tools/node-bundle/deno-shim.js`

- [ ] **Step 1: Write the shim**

The member list is the union of the assessment's inventory (section 3.1 and 3.3) and what the spike needed. Every member is assigned as `Deno.<name> = ...` on its own line so `--check-shim` can find it. Fix the two `@deno/shim-deno` bugs by construction: temp paths are `<dir>/<prefix><random><suffix>`, and TCP reads are buffered.

```js
// tools/node-bundle/deno-shim.js
// Copyright (C) 2026 Posit Software, PBC
//
// TEMPORARY SCAFFOLDING. `globalThis.Deno` for the Node bundle, implemented
// on node: APIs. Each Phase 2 PR (27-30) moves a src/deno_ral module onto
// node: APIs and deletes the members it makes unused; PR 33 deletes this
// file. `node tools/node-bundle/build.mjs --check-shim` lists what is still
// referenced. Do not add members for new application code: application code
// must not call Deno.* (PR 02 ratchet).
import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import net from "node:net";
import http from "node:http";
import crypto from "node:crypto";
import util from "node:util";
import { spawn, spawnSync } from "node:child_process";
import { Readable, Writable } from "node:stream";
import { isatty } from "node:tty";
import url from "node:url";
import { WebSocketServer } from "ws";

const Deno = {};

// ---------------------------------------------------------------- errors
class DenoError extends Error {
  constructor(message, code) { super(message); this.name = new.target.name; this.code = code; }
}
const errors = {
  NotFound: class NotFound extends DenoError { constructor(m) { super(m, "ENOENT"); } },
  AlreadyExists: class AlreadyExists extends DenoError { constructor(m) { super(m, "EEXIST"); } },
  PermissionDenied: class PermissionDenied extends DenoError { constructor(m) { super(m, "EACCES"); } },
  AddrInUse: class AddrInUse extends DenoError { constructor(m) { super(m, "EADDRINUSE"); } },
  ConnectionRefused: class ConnectionRefused extends DenoError { constructor(m) { super(m, "ECONNREFUSED"); } },
  ConnectionReset: class ConnectionReset extends DenoError { constructor(m) { super(m, "ECONNRESET"); } },
  ConnectionAborted: class ConnectionAborted extends DenoError { constructor(m) { super(m, "ECONNABORTED"); } },
  NotConnected: class NotConnected extends DenoError { constructor(m) { super(m, "ENOTCONN"); } },
  BrokenPipe: class BrokenPipe extends DenoError { constructor(m) { super(m, "EPIPE"); } },
  NotSupported: class NotSupported extends DenoError { constructor(m) { super(m, "ENOTSUP"); } },
  Interrupted: class Interrupted extends DenoError { constructor(m) { super(m, "EINTR"); } },
  BadResource: class BadResource extends DenoError { constructor(m) { super(m, "EBADF"); } },
};
const byCode = {
  ENOENT: errors.NotFound, EEXIST: errors.AlreadyExists, EACCES: errors.PermissionDenied, EPERM: errors.PermissionDenied,
  EADDRINUSE: errors.AddrInUse, ECONNREFUSED: errors.ConnectionRefused, ECONNRESET: errors.ConnectionReset,
  ECONNABORTED: errors.ConnectionAborted, ENOTCONN: errors.NotConnected, EPIPE: errors.BrokenPipe, ENOTSUP: errors.NotSupported,
};
// Node throws plain errors with .code; Quarto does `instanceof Deno.errors.X` (17 sites until PR 25).
function mapError(e) {
  const C = e && byCode[e.code];
  if (!C) return e;
  const out = new C(e.message);
  out.stack = e.stack;
  return out;
}
function wrapSync(fn) { return (...a) => { try { return fn(...a); } catch (e) { throw mapError(e); } }; }
function wrapAsync(fn) { return async (...a) => { try { return await fn(...a); } catch (e) { throw mapError(e); } }; }
Deno.errors = errors;

// ---------------------------------------------------------------- paths & stat
const p = (x) => (x instanceof URL ? url.fileURLToPath(x) : x);
function fileInfo(st) {
  return {
    isFile: st.isFile(), isDirectory: st.isDirectory(), isSymlink: st.isSymbolicLink(),
    size: st.size, mtime: st.mtime, atime: st.atime, birthtime: st.birthtime, ctime: st.ctime,
    mode: st.mode, dev: st.dev, ino: st.ino, nlink: st.nlink, uid: st.uid, gid: st.gid, rdev: st.rdev,
    blksize: st.blksize, blocks: st.blocks, isBlockDevice: st.isBlockDevice(), isCharDevice: st.isCharacterDevice(),
    isFifo: st.isFIFO(), isSocket: st.isSocket(),
  };
}
function dirEntry(d) { return { name: d.name, isFile: d.isFile(), isDirectory: d.isDirectory(), isSymlink: d.isSymbolicLink() }; }
// Deno write options: append -> "a", createNew -> "x" flag; create:false is not used by Quarto on this path.
const writeFlags = (o = {}) => (o.append ? "a" : "w") + (o.createNew ? "x" : "");

Deno.readTextFileSync = wrapSync((f) => fs.readFileSync(p(f), "utf8"));
Deno.readTextFile = wrapAsync((f) => fsp.readFile(p(f), "utf8"));
Deno.readFileSync = wrapSync((f) => new Uint8Array(fs.readFileSync(p(f))));
Deno.readFile = wrapAsync(async (f) => new Uint8Array(await fsp.readFile(p(f))));
Deno.writeTextFileSync = wrapSync((f, d, o) => fs.writeFileSync(p(f), d, { flag: writeFlags(o), mode: o?.mode }));
Deno.writeTextFile = wrapAsync((f, d, o) => fsp.writeFile(p(f), d, { flag: writeFlags(o), mode: o?.mode }));
Deno.writeFileSync = wrapSync((f, d, o) => fs.writeFileSync(p(f), d, { flag: writeFlags(o), mode: o?.mode }));
Deno.writeFile = wrapAsync((f, d, o) => fsp.writeFile(p(f), d, { flag: writeFlags(o), mode: o?.mode }));
Deno.statSync = wrapSync((f) => fileInfo(fs.statSync(p(f))));
Deno.stat = wrapAsync(async (f) => fileInfo(await fsp.stat(p(f))));
Deno.lstatSync = wrapSync((f) => fileInfo(fs.lstatSync(p(f))));
Deno.lstat = wrapAsync(async (f) => fileInfo(await fsp.lstat(p(f))));
Deno.mkdirSync = wrapSync((f, o) => { fs.mkdirSync(p(f), { recursive: !!o?.recursive, mode: o?.mode }); });
Deno.mkdir = wrapAsync(async (f, o) => { await fsp.mkdir(p(f), { recursive: !!o?.recursive, mode: o?.mode }); });
Deno.removeSync = wrapSync((f, o) => fs.rmSync(p(f), { recursive: !!o?.recursive, force: false }));
Deno.remove = wrapAsync((f, o) => fsp.rm(p(f), { recursive: !!o?.recursive, force: false }));
Deno.renameSync = wrapSync((a, b) => fs.renameSync(p(a), p(b)));
Deno.rename = wrapAsync((a, b) => fsp.rename(p(a), p(b)));
Deno.copyFileSync = wrapSync((a, b) => fs.copyFileSync(p(a), p(b)));
Deno.copyFile = wrapAsync((a, b) => fsp.copyFile(p(a), p(b)));
Deno.readDirSync = wrapSync(function* (f) { for (const d of fs.readdirSync(p(f), { withFileTypes: true })) yield dirEntry(d); });
Deno.readDir = wrapSync(async function* (f) { for (const d of await fsp.readdir(p(f), { withFileTypes: true })) yield dirEntry(d); });
Deno.symlinkSync = wrapSync((t, f, o) => fs.symlinkSync(p(t), p(f), o?.type === "dir" ? "dir" : o?.type === "file" ? "file" : undefined));
Deno.symlink = wrapAsync((t, f, o) => fsp.symlink(p(t), p(f), o?.type === "dir" ? "dir" : o?.type === "file" ? "file" : undefined));
Deno.readLinkSync = wrapSync((f) => fs.readlinkSync(p(f)));
Deno.readLink = wrapAsync((f) => fsp.readlink(p(f)));
Deno.realPathSync = wrapSync((f) => fs.realpathSync.native(p(f)));
Deno.realPath = wrapAsync((f) => fsp.realpath(p(f)));
Deno.chmodSync = wrapSync((f, m) => fs.chmodSync(p(f), m));
Deno.chmod = wrapAsync((f, m) => fsp.chmod(p(f), m));
Deno.utimeSync = wrapSync((f, a, m) => fs.utimesSync(p(f), a, m));
Deno.utime = wrapAsync((f, a, m) => fsp.utimes(p(f), a, m));
Deno.truncateSync = wrapSync((f, l) => fs.truncateSync(p(f), l));
Deno.cwd = () => process.cwd();
Deno.chdir = wrapSync((d) => process.chdir(p(d)));

// Deno.open / Deno.create expose web streams (used by deno_ral/tar.ts and io helpers).
class FsFile {
  constructor(fd, filePath) { this.fd = fd; this.path = filePath; }
  get readable() { return Readable.toWeb(fs.createReadStream(this.path, { fd: this.fd, autoClose: true })); }
  get writable() { return Writable.toWeb(fs.createWriteStream(this.path, { fd: this.fd, autoClose: true })); }
  readSync(buf) { const n = fs.readSync(this.fd, buf); return n === 0 ? null : n; }
  writeSync(buf) { return fs.writeSync(this.fd, buf); }
  statSync() { return fileInfo(fs.fstatSync(this.fd)); }
  close() { try { fs.closeSync(this.fd); } catch { /* already closed by a stream */ } }
  [Symbol.dispose]() { this.close(); }
}
function openFlags(o = { read: true }) {
  if (o.createNew) return o.read ? "wx+" : "wx";
  if (o.append) return o.read ? "a+" : "a";
  if (o.truncate || (o.write && o.create && !o.read)) return o.read ? "w+" : "w";
  if (o.write) return o.read ? "r+" : "r+";
  return "r";
}
Deno.openSync = wrapSync((f, o) => new FsFile(fs.openSync(p(f), openFlags(o), o?.mode), p(f)));
Deno.open = wrapAsync(async (f, o) => Deno.openSync(f, o));
Deno.createSync = wrapSync((f) => new FsFile(fs.openSync(p(f), "w+"), p(f)));
Deno.create = wrapAsync(async (f) => Deno.createSync(f));

// ---------------------------------------------------------------- temp files: <dir>/<prefix><random><suffix>, 5 attempts
function tempPath(o = {}) {
  return path.join(o.dir ?? os.tmpdir(), `${o.prefix ?? ""}${crypto.randomBytes(6).toString("hex")}${o.suffix ?? ""}`);
}
function attempts(fn) {
  let last;
  for (let i = 0; i < 5; i++) { try { return fn(); } catch (e) { last = e; if (e.code !== "EEXIST") throw mapError(e); } }
  throw mapError(last);
}
Deno.makeTempDirSync = (o) => attempts(() => { const t = tempPath(o); fs.mkdirSync(t); return t; });
Deno.makeTempDir = async (o) => Deno.makeTempDirSync(o);
Deno.makeTempFileSync = (o) => attempts(() => { const t = tempPath(o); fs.closeSync(fs.openSync(t, "wx", 0o600)); return t; });
Deno.makeTempFile = async (o) => Deno.makeTempFileSync(o);

// ---------------------------------------------------------------- env, process, platform
Deno.env = {
  get: (k) => process.env[k],
  set: (k, v) => { process.env[k] = v; },
  delete: (k) => { delete process.env[k]; },
  has: (k) => k in process.env,
  toObject: () => ({ ...process.env }),
};
Deno.args = process.argv.slice(2);
Deno.exit = (code) => process.exit(code ?? 0);
Deno.execPath = () => process.execPath;
Deno.pid = process.pid;
Deno.uid = () => (process.getuid ? process.getuid() : null);
Deno.noColor = "NO_COLOR" in process.env;
Deno.build = {
  os: process.platform === "win32" ? "windows" : process.platform,
  arch: process.arch === "x64" ? "x86_64" : process.arch === "arm64" ? "aarch64" : process.arch,
  target: `${process.arch}-${process.platform}`,
};
Deno.version = { deno: `node-shim/${process.versions.node}`, v8: process.versions.v8, typescript: "n/a" };
Deno.consoleSize = () => ({ columns: process.stdout.columns ?? 80, rows: process.stdout.rows ?? 24 });
Deno.inspect = (v, o) => util.inspect(v, { depth: o?.depth ?? 4, colors: !!o?.colors });
Deno.addSignalListener = (sig, fn) => process.on(sig, fn);
Deno.removeSignalListener = (sig, fn) => process.off(sig, fn);
Deno.kill = (pid, sig = "SIGTERM") => process.kill(pid, sig);
Deno.permissions = { query: async () => ({ state: "granted" }), querySync: () => ({ state: "granted" }) };
Deno.hostname = () => os.hostname();
Deno.memoryUsage = () => process.memoryUsage();
Deno.stdout = { writeSync: (b) => fs.writeSync(1, b), write: async (b) => fs.writeSync(1, b), isTerminal: () => isatty(1), rid: 1,
  writable: Writable.toWeb(process.stdout) };
Deno.stderr = { writeSync: (b) => fs.writeSync(2, b), write: async (b) => fs.writeSync(2, b), isTerminal: () => isatty(2), rid: 2,
  writable: Writable.toWeb(process.stderr) };
Deno.stdin = { readSync: (b) => { const n = fs.readSync(0, b); return n === 0 ? null : n; }, isTerminal: () => isatty(0), rid: 0,
  readable: Readable.toWeb(process.stdin), setRaw: (on) => process.stdin.setRawMode?.(on) };
Deno.isatty = (rid) => isatty(rid);
Deno.dlopen = () => { throw new Error("FFI is not available on Node (deno_dom native plugin is removed in PR 20)"); };

// ---------------------------------------------------------------- Deno.Command
function stdio(v, def) { if (v === undefined) return def; if (typeof v === "number") return v; return v === "piped" ? "pipe" : v === "null" ? "ignore" : "inherit"; }
function spawnOptions(opts, mode) {
  const env = opts.clearEnv ? { ...(opts.env ?? {}) } : { ...process.env, ...(opts.env ?? {}) };
  const defIn = mode === "spawn" ? "inherit" : "ignore";
  const defOut = mode === "spawn" ? "inherit" : "pipe";
  return { cwd: opts.cwd, env, stdio: [stdio(opts.stdin, defIn), stdio(opts.stdout, defOut), stdio(opts.stderr, defOut)], windowsHide: true, signal: opts.signal };
}
// Node refuses to spawn .cmd/.bat without a shell (CVE-2024-27980); route them through cmd.exe.
function windowsCommand(cmd, args) {
  if (process.platform !== "win32" || !/\.(cmd|bat)$/i.test(cmd)) return [cmd, args, {}];
  const q = (s) => (/[\s"]/.test(s) ? `"${s.replace(/"/g, '\\"')}"` : s);
  return [process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", `"${[cmd, ...args].map(q).join(" ")}"`], { windowsVerbatimArguments: true }];
}
function exitStatus(code, signal) { return { success: code === 0, code: code ?? (signal ? 128 : 1), signal: signal ?? null }; }
class ChildProcess {
  constructor(child) {
    this.child = child; this.pid = child.pid;
    this.stdin = child.stdin ? Writable.toWeb(child.stdin) : null;
    this.stdout = child.stdout ? Readable.toWeb(child.stdout) : null;
    this.stderr = child.stderr ? Readable.toWeb(child.stderr) : null;
    this.status = new Promise((resolve, reject) => { child.on("error", (e) => reject(mapError(e))); child.on("close", (c, s) => resolve(exitStatus(c, s))); });
    this.status.catch(() => {});
  }
  async output() { const st = await this.status; return { ...st, stdout: new Uint8Array(), stderr: new Uint8Array() }; }
  kill(sig = "SIGTERM") { this.child.kill(sig); }
  ref() { this.child.ref(); }
  unref() { this.child.unref(); }
}
class Command {
  constructor(cmd, opts = {}) { this.cmd = cmd; this.opts = opts; }
  spawn() { const [c, a, extra] = windowsCommand(this.cmd, this.opts.args ?? []); return new ChildProcess(spawn(c, a, { ...spawnOptions(this.opts, "spawn"), ...extra })); }
  output() {
    return new Promise((resolve, reject) => {
      const [c, a, extra] = windowsCommand(this.cmd, this.opts.args ?? []);
      const child = spawn(c, a, { ...spawnOptions(this.opts, "output"), ...extra });
      const out = [], err = [];
      child.stdout?.on("data", (d) => out.push(d));
      child.stderr?.on("data", (d) => err.push(d));
      child.on("error", (e) => reject(mapError(e)));
      child.on("close", (code, signal) => resolve({ ...exitStatus(code, signal), stdout: new Uint8Array(Buffer.concat(out)), stderr: new Uint8Array(Buffer.concat(err)) }));
    });
  }
  outputSync() {
    const [c, a, extra] = windowsCommand(this.cmd, this.opts.args ?? []);
    const r = spawnSync(c, a, { ...spawnOptions(this.opts, "output"), ...extra, maxBuffer: 1024 * 1024 * 1024 });
    if (r.error) throw mapError(r.error);
    return { ...exitStatus(r.status, r.signal), stdout: new Uint8Array(r.stdout ?? Buffer.alloc(0)), stderr: new Uint8Array(r.stderr ?? Buffer.alloc(0)) };
  }
}
Deno.Command = Command;

// ---------------------------------------------------------------- Deno.openKv (JSON file; PR 30 replaces with deno_ral/kv.ts)
class Kv {
  constructor(file) { this.file = file; this.data = {}; this.vs = 0; try { this.data = JSON.parse(fs.readFileSync(file, "utf8")); } catch { /* new store */ } }
  flush() { const tmp = this.file + ".tmp"; fs.writeFileSync(tmp, JSON.stringify(this.data)); fs.renameSync(tmp, this.file); }
  async get(key) { const e = this.data[JSON.stringify(key)]; return { key, value: e === undefined ? null : revive(e.value), versionstamp: e ? e.vs : null }; }
  async set(key, value) { const vs = `${Date.now()}-${++this.vs}`; this.data[JSON.stringify(key)] = { value: freeze(value), vs }; this.flush(); return { ok: true, versionstamp: vs }; }
  async delete(key) { delete this.data[JSON.stringify(key)]; this.flush(); }
  async *list({ prefix = [] } = {}) {
    for (const [k, e] of Object.entries(this.data)) { const key = JSON.parse(k); if (prefix.every((x, i) => key[i] === x)) yield { key, value: revive(e.value), versionstamp: e.vs }; }
  }
  close() {}
  [Symbol.dispose]() {}
}
// Deno.Kv stores Uint8Array values (project cache "buffer-immediate" entries); JSON needs a tag.
function freeze(v) {
  if (v instanceof Uint8Array) return { $bytes: Buffer.from(v).toString("base64") };
  if (v && typeof v === "object" && !Array.isArray(v)) return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, freeze(x)]));
  return v;
}
function revive(v) {
  if (v && typeof v === "object" && typeof v.$bytes === "string") return new Uint8Array(Buffer.from(v.$bytes, "base64"));
  if (v && typeof v === "object" && !Array.isArray(v)) return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, revive(x)]));
  return v;
}
Deno.openKv = async (file) => { fs.mkdirSync(path.dirname(file), { recursive: true }); return new Kv(file); };

// ---------------------------------------------------------------- Deno.serve + Deno.upgradeWebSocket (PR 29 replaces with deno_ral/http.ts)
const upgradable = new WeakMap();
const upgraded = new WeakSet();
const wss = new WebSocketServer({ noServer: true });
function toRequest(req, hostname, port) {
  const u = `http://${req.headers.host ?? `${hostname}:${port}`}${req.url}`;
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) if (v !== undefined) headers.set(k, Array.isArray(v) ? v.join(", ") : v);
  const hasBody = !(req.method === "GET" || req.method === "HEAD");
  return new Request(u, { method: req.method, headers, body: hasBody ? Readable.toWeb(req) : undefined, duplex: hasBody ? "half" : undefined });
}
async function sendResponse(res, response) {
  if (!response) { res.statusCode = 500; res.end(); return; }
  res.statusCode = response.status;
  for (const [k, v] of response.headers) if (k !== "set-cookie") res.setHeader(k, v);
  const cookies = response.headers.getSetCookie();
  if (cookies.length) res.setHeader("set-cookie", cookies);
  if (response.body) for await (const chunk of response.body) res.write(chunk);
  res.end();
}
Deno.serve = (a, b) => {
  const opts = typeof a === "function" ? {} : a;
  const handler = typeof a === "function" ? a : (b ?? opts.handler);
  const port = opts.port ?? 8000;
  const hostname = opts.hostname ?? "0.0.0.0";
  const server = http.createServer();
  const info = (req) => ({ remoteAddr: { transport: "tcp", hostname: req.socket.remoteAddress, port: req.socket.remotePort } });
  server.on("request", async (req, res) => {
    try { await sendResponse(res, await handler(toRequest(req, hostname, port), info(req))); }
    catch (e) { console.error("[deno-shim serve]", e); res.statusCode = 500; res.end(); }
  });
  server.on("upgrade", async (req, socket, head) => {
    const request = toRequest(req, hostname, port);
    upgradable.set(request, { req, socket, head });
    try { const r = await handler(request, info(req)); if (!(r && upgraded.has(r))) socket.destroy(); }
    catch (e) { console.error("[deno-shim upgrade]", e); socket.destroy(); }
  });
  let addr;
  let resolveFinished, rejectFinished;
  const finished = new Promise((res, rej) => { resolveFinished = res; rejectFinished = rej; });
  server.on("close", () => resolveFinished());
  server.on("error", (e) => rejectFinished(mapError(e)));
  server.listen(port, hostname, () => {
    addr = server.address();
    (opts.onListen ?? (({ hostname, port }) => console.log(`Listening on http://${hostname}:${port}/`)))({ hostname: addr.address, port: addr.port, transport: "tcp" });
  });
  const shutdown = () => new Promise((r) => { server.closeAllConnections(); server.close(() => r()); });
  opts.signal?.addEventListener("abort", shutdown);
  return { finished, get addr() { return { hostname: addr?.address ?? hostname, port: addr?.port ?? port, transport: "tcp" }; }, shutdown, ref: () => server.ref(), unref: () => server.unref() };
};
Deno.upgradeWebSocket = (request) => {
  const u = upgradable.get(request);
  if (!u) throw new TypeError("Request is not upgradable");
  let socket;
  wss.handleUpgrade(u.req, u.socket, u.head, (ws) => { socket = ws; });
  // Node's Response rejects status 101; the handshake was already written by ws,
  // so this response is only a marker that the request was upgraded.
  const response = new Response(null, { status: 200 });
  upgraded.add(response);
  return { socket, response };
};

// ---------------------------------------------------------------- Deno.connect (buffered), Deno.listen (fake; PR 15 made probing async)
class Conn {
  constructor(socket) {
    this.socket = socket; this.chunks = []; this.waiters = []; this.ended = false;
    socket.on("data", (d) => { this.chunks.push(d); this.#wake(); });
    socket.on("end", () => { this.ended = true; this.#wake(); });
    socket.on("close", () => { this.ended = true; this.#wake(); });
    socket.on("error", (e) => { this.error = mapError(e); this.ended = true; this.#wake(); });
    this.localAddr = { transport: "tcp", hostname: socket.localAddress, port: socket.localPort };
    this.remoteAddr = { transport: "tcp", hostname: socket.remoteAddress, port: socket.remotePort };
  }
  #wake() { for (const r of this.waiters.splice(0)) r(); }
  async read(buf) {
    while (this.chunks.length === 0) { if (this.error) throw this.error; if (this.ended) return null; await new Promise((r) => this.waiters.push(r)); }
    const head = this.chunks[0]; const n = Math.min(head.length, buf.length);
    buf.set(head.subarray(0, n));
    if (n < head.length) this.chunks[0] = head.subarray(n); else this.chunks.shift();
    return n;
  }
  write(data) { return new Promise((resolve, reject) => this.socket.write(data, (e) => (e ? reject(mapError(e)) : resolve(data.length)))); }
  close() { this.socket.destroy(); }
  closeWrite() { return new Promise((r) => this.socket.end(r)); }
  setNoDelay(v = true) { this.socket.setNoDelay(v); }
  setKeepAlive(v = true) { this.socket.setKeepAlive(v); }
  ref() { this.socket.ref(); }
  unref() { this.socket.unref(); }
}
Deno.connect = (opts) => new Promise((resolve, reject) => {
  const socket = opts.transport === "unix" ? net.createConnection({ path: opts.path }) : net.createConnection({ host: opts.hostname ?? "127.0.0.1", port: opts.port });
  socket.once("connect", () => resolve(new Conn(socket)));
  socket.once("error", (e) => reject(mapError(e)));
});
Deno.listen = (opts) => {
  // Node cannot bind synchronously. Until PR 15 lands, report every port as free and
  // let Deno.serve fail loudly with AddrInUse.
  return { addr: { hostname: opts.hostname ?? "0.0.0.0", port: opts.port, transport: "tcp" }, close() {}, [Symbol.asyncIterator]: async function* () {} };
};

// ---------------------------------------------------------------- Deno.watchFs (PR 29 replaces with deno_ral/watch.ts)
Deno.watchFs = (paths, opts = { recursive: true }) => {
  const list = Array.isArray(paths) ? paths : [paths];
  const queue = []; const waiters = []; let closed = false;
  const push = (ev) => { queue.push(ev); for (const w of waiters.splice(0)) w(); };
  const watchers = list.map((dir) => fs.watch(dir, { recursive: opts.recursive !== false }, (type, name) => {
    const full = name ? path.join(dir, name) : dir;
    let kind = "modify";
    if (type === "rename") kind = fs.existsSync(full) ? "create" : "remove";
    push({ kind, paths: [full], flag: null });
  }));
  return {
    close() { closed = true; for (const w of watchers) w.close(); for (const w of waiters.splice(0)) w(); },
    async *[Symbol.asyncIterator]() {
      while (!closed) { if (queue.length) { yield queue.shift(); continue; } await new Promise((r) => waiters.push(r)); }
    },
  };
};

globalThis.Deno = Deno;
```

- [ ] **Step 2: Build with the shim check and run the bundle**

Run:
```bash
node tools/node-bundle/build.mjs --check-shim
chmod +x tools/node-bundle/dist/quarto.mjs 2>/dev/null; QUARTO_BIN_PATH=$PWD/package/dist/bin QUARTO_SHARE_PATH=$PWD/src/resources node tools/node-bundle/dist/quarto.mjs --version
```
Expected: `shim: N members referenced, 0 missing` and `99.9.9`. If members are missing, the error lists them; add each one as a `Deno.<name> = ...` line following the pattern above (the inventory in assessment section 3.1 is the reference), never by adding a dependency.

- [ ] **Step 3: Commit**

```bash
git add tools/node-bundle/deno-shim.js
git commit -m "Add temporary Deno shim for the Node bundle (no @deno/shim-deno)"
```

### Task 5: Launcher, HTML normaliser and a local render diff

**Files:**
- Create: `tools/node-bundle/quarto-node`
- Create: `tools/node-bundle/normalize-html.mjs`

- [ ] **Step 1: Write the launcher**

```bash
#!/usr/bin/env bash
# tools/node-bundle/quarto-node
# Copyright (C) 2026 Posit Software, PBC
#
# Runs the Node bundle (tools/node-bundle/dist/quarto.mjs) against the dev
# share directory and the binaries downloaded by ./configure.sh.
set -euo pipefail
SOURCE="${BASH_SOURCE[0]}"
while [ -h "$SOURCE" ]; do
  DIR="$(cd -P "$(dirname "$SOURCE")" && pwd)"
  SOURCE="$(readlink "$SOURCE")"
  [[ $SOURCE != /* ]] && SOURCE="$DIR/$SOURCE"
done
HERE="$(cd -P "$(dirname "$SOURCE")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
BUNDLE="$HERE/dist/quarto.mjs"
if [ ! -f "$BUNDLE" ]; then
  echo "quarto-node: $BUNDLE not found; run: node tools/node-bundle/build.mjs" >&2
  exit 1
fi
export QUARTO_BIN_PATH="${QUARTO_BIN_PATH:-$ROOT/package/dist/bin}"
export QUARTO_SHARE_PATH="${QUARTO_SHARE_PATH:-$ROOT/src/resources}"
export QUARTO_DEBUG="${QUARTO_DEBUG:-false}"
NODE="${QUARTO_NODE:-node}"
exec "$NODE" --enable-experimental-regexp-engine --max-old-space-size=8192 --stack-trace-limit=100 "$BUNDLE" "$@"
```

Run: `chmod +x tools/node-bundle/quarto-node && tools/node-bundle/quarto-node --version`
Expected: `99.9.9`.

- [ ] **Step 2: Write the normaliser**

```js
// tools/node-bundle/normalize-html.mjs
// Copyright (C) 2026 Posit Software, PBC
//
// Rewrites rendered output in place so a Deno render and a Node render of the
// same document diff clean: Sass cache hashes in library file names, Jupyter
// cell ids, and timestamps. Usage: node tools/node-bundle/normalize-html.mjs <dir>...
import fs from "node:fs";
import path from "node:path";

const rules = [
  [/[0-9a-f]{32}/g, "HASH"],
  [/ id="[0-9a-f]{8}"/g, ' id="CELLID"'],
  [/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?/g, "TIMESTAMP"],
];
const exts = new Set([".html", ".css", ".json", ".xml"]);

function* files(dir) {
  for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, d.name);
    if (d.isDirectory()) yield* files(full);
    else if (exts.has(path.extname(d.name))) yield full;
  }
}
let count = 0;
for (const dir of process.argv.slice(2)) {
  for (const file of files(dir)) {
    const before = fs.readFileSync(file, "utf8");
    let after = before;
    for (const [re, to] of rules) after = after.replace(re, to);
    // Library directories carry the hash in their file names too.
    if (after !== before) fs.writeFileSync(file, after);
    const renamed = file.replace(/[0-9a-f]{32}/g, "HASH");
    if (renamed !== file) fs.renameSync(file, renamed);
    count++;
  }
}
console.log(`normalized ${count} files`);
```

- [ ] **Step 3: Diff a Deno render against a Node render locally**

Run:
```bash
rm -rf /tmp/rt26 && mkdir -p /tmp/rt26 && cp -r dev-docs/runtime-migration/spike/tests /tmp/rt26/deno && cp -r dev-docs/runtime-migration/spike/tests /tmp/rt26/node
package/dist/bin/quarto render /tmp/rt26/deno/simple.qmd
tools/node-bundle/quarto-node render /tmp/rt26/node/simple.qmd
node tools/node-bundle/normalize-html.mjs /tmp/rt26/deno /tmp/rt26/node
diff -r /tmp/rt26/deno /tmp/rt26/node && echo "IDENTICAL"
```
Expected: both renders print `Output created: simple.html`; the diff prints `IDENTICAL`. (Before PR 01 the bslib Sass ordering differs; after it, the bootstrap hash is the only variable, and it is normalised.)

- [ ] **Step 4: Commit**

```bash
git add tools/node-bundle/quarto-node tools/node-bundle/normalize-html.mjs
git commit -m "Add quarto-node launcher and render-output normaliser"
```

### Task 6: The CI workflow

**Files:**
- Create: `.github/workflows/test-node-bundle.yml`

- [ ] **Step 1: Write the workflow**

```yaml
# Builds the Node bundle (tools/node-bundle/) and renders smoke documents on
# Node 22, diffing the output against the Deno render. Allowed to fail until
# PR 32 makes the Node matrix required.
name: Node Bundle (allowed failure)
on:
  workflow_dispatch:
  pull_request:
    branches: [main]
    paths-ignore:
      - "news/**"
      - ".claude/**"
  push:
    branches: [main]
    paths-ignore:
      - "news/**"
      - ".claude/**"

concurrency:
  group: node-bundle-${{ github.event.pull_request.number || github.ref }}
  cancel-in-progress: true

jobs:
  node-bundle:
    name: Build and render on Node (${{ matrix.os }})
    runs-on: ${{ matrix.os }}
    continue-on-error: true
    strategy:
      fail-fast: false
      matrix:
        os: [ubuntu-latest]
    env:
      SPIKE_TESTS: dev-docs/runtime-migration/spike/tests
    steps:
      - uses: actions/checkout@v6

      - name: Install Node 22
        uses: actions/setup-node@v6
        with:
          node-version: 22
          cache: npm

      # Downloads Deno, Pandoc, Dart Sass, Typst into package/dist/bin/tools (the Deno baseline needs them too).
      - name: Configure Quarto dev (Deno baseline)
        uses: ./.github/workflows/actions/quarto-dev

      - name: Install uv for Python
        uses: astral-sh/setup-uv@20cfd1bf945f4377ade1205e4dbc17946fc9a30d # v10.0.1
        with:
          version: "0.12.10"
          enable-cache: true
          cache-dependency-glob: "tests/uv.lock"

      - name: Install the tests Python environment (Jupyter)
        working-directory: tests
        run: uv sync --frozen

      - name: Install npm dependencies (npm + JSR via .npmrc)
        run: npm ci

      - name: Dependencies mirror the import map
        run: node tools/node-bundle/check-deps.mjs

      - name: Tooling unit tests
        run: node --test tools/node-bundle/

      - name: Build the bundle
        run: node tools/node-bundle/build.mjs --check-shim

      - name: Version and check
        run: |
          tools/node-bundle/quarto-node --version
          tools/node-bundle/quarto-node check 2>&1 | tee check.log || true

      - name: Render on Deno and on Node
        shell: bash
        run: |
          source tests/.venv/bin/activate
          rm -rf "$RUNNER_TEMP/render" && mkdir -p "$RUNNER_TEMP/render"
          cp -r "$SPIKE_TESTS" "$RUNNER_TEMP/render/deno"
          cp -r "$SPIKE_TESTS" "$RUNNER_TEMP/render/node"
          for runtime in deno node; do
            if [ "$runtime" = deno ]; then q="$PWD/package/dist/bin/quarto"; else q="$PWD/tools/node-bundle/quarto-node"; fi
            echo "::group::$runtime: simple.qmd"
            "$q" render "$RUNNER_TEMP/render/$runtime/simple.qmd"
            echo "::endgroup::"
            echo "::group::$runtime: website"
            "$q" render "$RUNNER_TEMP/render/$runtime/website"
            echo "::endgroup::"
            echo "::group::$runtime: jupyter.qmd"
            "$q" render "$RUNNER_TEMP/render/$runtime/jupyter.qmd"
            echo "::endgroup::"
          done

      - name: Diff the renders (hashes and timestamps normalised)
        id: diff
        shell: bash
        run: |
          node tools/node-bundle/normalize-html.mjs "$RUNNER_TEMP/render/deno" "$RUNNER_TEMP/render/node"
          if diff -r "$RUNNER_TEMP/render/deno" "$RUNNER_TEMP/render/node" > node-render.diff; then
            echo "Node render identical to Deno render"
          else
            echo "::warning::Node render differs from Deno render; see the node-render-diff artifact"
            head -c 20000 node-render.diff
            exit 1
          fi

      - name: Upload the diff and the renders
        if: always()
        uses: actions/upload-artifact@v7
        with:
          name: node-render-diff
          path: |
            node-render.diff
            check.log
            ${{ runner.temp }}/render
          if-no-files-found: ignore
          retention-days: 14
```

- [ ] **Step 2: Validate the workflow locally where possible**

Run: `node -e "require('node:fs'); console.log('ok')" && python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/test-node-bundle.yml')); print('yaml ok')"`
Expected: `ok` and `yaml ok`. (If `pyyaml` is absent: `npx -y yaml-lint .github/workflows/test-node-bundle.yml`.)

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/test-node-bundle.yml
git commit -m "Add allowed-failure CI job building and rendering the Node bundle"
```

### Task 7: Documentation

**Files:**
- Create: `dev-docs/runtime-migration/node-bundle.md`
- Modify: `dev-docs/runtime-migration/spike/README.md`
- Modify: `dev-docs/runtime-migration/README.md`

- [ ] **Step 1: Write the usage note**

```markdown
# Running quarto-cli on Node (dev bundle)

`tools/node-bundle/` builds `src/quarto.ts` into a single ESM file for Node 22
and runs it with a temporary `Deno` shim. It exists so Phase 2 of the runtime
migration (`dev-docs/runtime-migration/README.md`) can be validated on Node
before the runtime flip. Nothing here is shipped to users.

## Setup

```bash
./configure.sh                      # Pandoc, Dart Sass, Typst, Deno under package/dist/bin/tools
npm ci                              # npm + JSR packages (see .npmrc)
node tools/node-bundle/build.mjs --check-shim
tools/node-bundle/quarto-node render path/to/doc.qmd
```

`QUARTO_NODE=/path/to/node` selects a Node binary; `QUARTO_DEBUG=true` enables
debug logging as with the Deno dev build.

## Files

| Path | Role |
|---|---|
| `tools/node-bundle/import-map.mjs` | Maps `src/import_map.json` to npm/JSR package specifiers. Shared with `check-deps.mjs` and the Node test loader hook (PR 31). |
| `tools/node-bundle/build.mjs` | esbuild bundler. `--check-shim` fails when the bundle references a `Deno.*` member the shim does not define. Writes `dist/quarto.mjs`, `dist/meta.json`, `dist/resolved.json`. |
| `tools/node-bundle/deno-shim.js` | Temporary `globalThis.Deno` on `node:` APIs. Shrinks with PR 27–30; deleted in PR 33. |
| `tools/node-bundle/quarto-node` | Launcher with the dev share path and V8 flags. |
| `tools/node-bundle/check-deps.mjs` | Fails when `package.json` `dependencies` drift from the import map. `--write` regenerates them. |
| `tools/node-bundle/normalize-html.mjs` | Normalises hashes, cell ids and timestamps so Deno and Node renders diff clean. |
| `package.json` | `dependencies` mirror the import map (checked); `devDependencies` are Node-only (`esbuild`, `ws`). No `"type": "module"`: all tooling is `.mjs`. |
| `.github/workflows/test-node-bundle.yml` | Allowed-failure job: build, `check`, render `spike/tests/{simple.qmd,website,jupyter.qmd}` on both runtimes, diff. |

## Adding or bumping a dependency

1. Edit `src/import_map.json` (only `jsr:` and `npm:` values).
2. `node tools/node-bundle/check-deps.mjs --write && npm install`.
3. Commit `package.json` and `package-lock.json` with the import map.

## When the shim check fails

`--check-shim` lists `Deno.*` members the bundle uses that the shim lacks.
Application code must not add new `Deno.*` calls (PR 02 ratchet); if the
member comes from a dependency, add it to the shim following the existing
pattern and note it in the PR. Members become unused as PR 27–30 land; delete
them in those PRs.

## Reading a render diff

The artifact `node-render-diff` holds `node-render.diff`, `check.log` and
both render trees. Differences after normalisation are real behaviour
differences and belong in the Phase 1/2 backlog.
```

- [ ] **Step 2: Point the spike README at the tooling**

Insert after the first paragraph of `dev-docs/runtime-migration/spike/README.md`:

```markdown
> Superseded by `tools/node-bundle/` (PR 26); see `../node-bundle.md`. This
> directory is kept as the record of the 2026-10-14 spike. The `tests/`
> documents are still the smoke set used by `.github/workflows/test-node-bundle.yml`.
```

- [ ] **Step 3: Update the PR table**

In `dev-docs/runtime-migration/README.md`, change the PR 26 row status from `planned` to `merged` (this is done on the PR branch; the reviewer checks it).

- [ ] **Step 4: Commit**

```bash
git add dev-docs/runtime-migration/node-bundle.md dev-docs/runtime-migration/spike/README.md dev-docs/runtime-migration/README.md
git commit -m "Document the Node bundle tooling"
```

## Verification

Before opening the PR:

- `node --test tools/node-bundle/` → `# pass 5`, `# fail 0`.
- `node tools/node-bundle/check-deps.mjs` → `package.json dependencies match src/import_map.json (N packages)`.
- `node tools/node-bundle/build.mjs --check-shim` → `shim: N members referenced, 0 missing`.
- `tools/node-bundle/quarto-node --version` → `99.9.9`; `tools/node-bundle/quarto-node check` reaches the Chromium row (puppeteer-core from PR 07 is in the bundle).
- The local render diff from Task 5 step 3 prints `IDENTICAL`.
- `git diff --stat main -- src/` → empty.
- Existing Deno suite unaffected: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/path.test.ts` passes (sanity; the PR touches no `src/` file).
- The ratchet: `quarto run --dev tools/check-runtime-boundary.ts` passes (counts unchanged).
- Push the branch and confirm the `Node Bundle (allowed failure)` job runs, uploads `node-render-diff`, and that a failure does not block the PR.

## Review checklist

- [ ] `tools/node-bundle/build.mjs` contains no absolute paths and no clone directories; the only resolution sources are `src/import_map.json`, `node_modules`, and `node:` externals.
- [ ] A remaining `https://` import-map value fails the build with `unmapped remote import <spec> -> <value>` naming the importer.
- [ ] `deno-shim.js` has no third-party imports other than `ws`; every member is a `Deno.<name> =` assignment on its own line; the file header says it is temporary and names PR 33.
- [ ] `package.json` has no `"type": "module"`; `dependencies` equals `dependenciesFromImportMap`; `ws` and `esbuild` are `devDependencies`.
- [ ] `package-lock.json` resolves `@jsr/*` packages from `https://npm.jsr.io` (grep `npm.jsr.io` in the lockfile).
- [ ] The workflow is `continue-on-error: true`, Linux only, uploads the diff artifact `if: always()`.
- [ ] `normalize-html.mjs` only rewrites hashes, cell ids and timestamps (no other content changes), so a non-empty diff is a real difference.
- [ ] No file under `src/` changed.

## Risks and rollback

- **npm.jsr.io availability or a JSR package without a Node-compatible build.** Shows up as `npm ci` 404 or a bundle-time resolution error naming the package. Rollback: the job is allowed to fail; nothing else depends on it. Fix forward by pinning a different version in the import map (which the Deno build also uses).
- **Shim drift.** New `Deno.*` uses in a dependency break the Node job with a clear member list. The ratchet (PR 02) prevents new uses in application code.
- **`package.json` at the root confuses other tooling** (editor TypeScript server picking up `node_modules`). Mitigated by `/node_modules` in `.gitignore` and no `"type"` field. If it bites, move `package.json` to `tools/node-bundle/` and point `check-deps.mjs` and the workflow at it; `import-map.mjs` takes the root as a parameter so this is a two-line change.
- **Rollback of the whole PR:** delete `tools/node-bundle/`, `package.json`, `package-lock.json`, `.npmrc`, the workflow, and the two `.gitignore` lines. No application code depends on them.

## Decisions needed

None. The shim ownership, the Node-only dependency placement and the absence of `"type": "module"` are decided above with their justification; reverse any of them in the PR description if the reviewer disagrees.
