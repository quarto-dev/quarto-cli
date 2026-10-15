# PR 33: Build tooling on Node (`configure`, `quarto-bld`, `prepare-dist`, dev launchers)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `./configure.sh` and `./configure.cmd` install the official Node.js binary instead of Deno, `quarto-bld` and `prepare-dist` run on Node with the plain esbuild bundler from PR 26, and the dev launchers start `node`.
**Phase:** 3. **Depends on:** PR 32 (Node CI matrix required and green), PR 26 (`tools/node-bundle/`, root `package.json`), PR 24 (`package/src` codemodded), PR 20 (deno_dom FFI removed), PR 19 (`platform.ts` `runtime()`, `main.ts` `isMainModule`). **Unblocks:** PR 34, 35, 36, 39.
**Branch:** `rt/33-build-tooling-node`.
**Suggested executor:** Opus. Shell scripts on three platforms, a Node dependency downloader, and launcher semantics (flag mapping, environment sanitising) need judgement; the TypeScript edits are small but spread over many files.
**Size:** L (about 45 files: 2 configure scripts, 4 launchers, 6 `package/src` modules, 3 `tools/node-bundle` files, CI action, VS Code config, tests, docs).
**Ships on:** Node. This is the flip. After this PR a dev checkout has no Deno binary; the full test suite runs on the Node matrix from PR 32 and must stay green.

## Spec

### Context

Assessment sections 3.6 and 7 (Phase 3, step 1): Quarto ships its own runtime binary under `bin/tools/<arch>/`, an esbuild bundle `bin/quarto.js`, and launcher scripts. The Node version has the same shape. The build tooling (`configure.sh`, `quarto-bld`, `prepare-dist`, vendoring, `deno_std` download) is the last code that runs *on* Deno and *about* Deno once PR 25 reached boundary zero and PR 27 to 31 put the runtime layer on Node APIs.

What changes for callers:

- Developers run `./configure.sh` as before; it now downloads Node 26 into `package/dist/bin/tools/<arch>/node`, runs `npm ci` at the repository root, and no longer runs `deno install`/`deno cache`. `package/dist/bin/quarto` runs `node` on an esbuild bundle of `src/quarto.ts` that is rebuilt when any source file is newer than the bundle (under one second, see the spike numbers in assessment section 10).
- `quarto-bld` runs `package/src/bld.ts` through the same bundler.
- `prepare-dist` produces `bin/quarto.js` with `tools/node-bundle/build.mjs` instead of `tools/deno-esbuild-bundle.ts`, and places `node` (not `deno`) under `bin/tools/<arch>/`.
- Operators keep `QUARTO_DENO`, `QUARTO_DENO_OPTIONS`, `QUARTO_DENO_EXTRA_OPTIONS`, `QUARTO_DENO_V8_OPTIONS` working for one release as aliases of `QUARTO_NODE` and `QUARTO_NODE_OPTIONS` (the launchers map them; PR 34 adds the one-time deprecation warning). `DENO_DIR`, `QUARTO_DENO_DIR` and `QUARTO_DENO_DOM` have no equivalent and are ignored.

Verified facts this plan relies on (checked 2026-10-14 against `https://nodejs.org/dist/index.json` and `https://raw.githubusercontent.com/nodejs/Release/main/schedule.json`):

- Node `v26.12.0` is the current release of the 26 line (released 2026-10-14). Node 26 becomes Active LTS on 2026-10-28 and is maintained until 2029-04-30. Node `v24.22.0` is today's Active LTS ("Krypton") and enters Maintenance on 2026-10-20. The plan pins `v26.12.0`; when this plan is executed, replace it with the newest `26.x.y` in `index.json` (the field name and download layout do not change within a major line).
- Download names (from `https://nodejs.org/dist/v26.12.0/SHASUMS256.txt`): `node-v26.12.0-linux-x64.tar.xz`, `node-v26.12.0-linux-arm64.tar.xz`, `node-v26.12.0-darwin-x64.tar.gz`, `node-v26.12.0-darwin-arm64.tar.gz`, `node-v26.12.0-win-x64.zip` (a `win-arm64.zip` exists too; Quarto's Windows build stays x64-only, as today with Deno).
- Node 26 type stripping is stable and on by default, but it rejects `enum`, parameter properties, `namespace` with runtime code and import aliases; `--experimental-transform-types` was removed in v26.0.0 (`doc/api/typescript.md`). `src/` has 12 `enum` declarations (`src/publish/confluence/api/types.ts`, `src/publish/provider-types.ts`, `src/publish/netlify/api/models/accountSetup.ts`, `src/project/types/website/listing/website-listing-shared.ts`, `src/core/giscus.ts`) and 40 files with constructor parameter properties (the Netlify API services, `src/command/call/axe/scan.ts`, `src/core/knitr.ts`, `src/publish/confluence/api/index.ts`, `src/publish/quarto-pub/api/index.ts`, and the multi-line constructors in `src/publish/types.ts`, `src/publish/rsconnect/api/index.ts`, `src/tools/github.ts`, `src/core/brand/brand.ts`; the assessment, section 3.5, has the same numbers). Node also has no import maps; `package.json` `imports` only accepts `#`-prefixed keys, and `src/import_map.json` maps bare names like `path`, `fs/exists`, `cliffy/command/mod.ts`. **Therefore dev mode runs the esbuild bundle, exactly like production**, instead of `node src/quarto.ts`. esbuild handles enums and parameter properties, the PR 26 resolver plugin applies the import map, and a source map plus `--enable-source-maps` keeps stack traces pointing at `src/*.ts`. This is the "pick one and justify" decision the assignment asked for: the `package.json` `imports` route would require rewriting every bare specifier in 451 files and would still not cover enums.
- Node reads `NODE_OPTIONS` (space-separated CLI flags) and `NODE_PATH` from the environment (`doc/api/cli.md`). The launchers unset both so a user's Node setup cannot change Quarto's runtime, the way `DENO_DIR` is pinned today. `--use-system-ca` (added v23.8.0) replaces `DENO_TLS_CA_STORE=system,mozilla`; `NODE_EXTRA_CA_CERTS` is left alone because it is the documented way to add a corporate CA.
- V8 flags are accepted directly by `node`: the spike launcher (`dev-docs/runtime-migration/spike/quarto-node`) ran `node --enable-experimental-regexp-engine --max-old-space-size=8192 --stack-trace-limit=100 dist/quarto.js`. `--enable-experimental-regexp-engine` is required for the `/regex/l` flag (quarto-cli#9737). `--max-heap-size`, set by the Deno launchers, is dropped: `--max-old-space-size` is the documented Node flag and the spike rendered every test document without it.

Assumptions about earlier PRs (state them in the PR description if they differ):

- PR 26 committed `tools/node-bundle/build.mjs` (the spike bundler with the import-map resolver plugin), `tools/node-bundle/deno-shim.js`, `tools/node-bundle/quarto-node`, a root `package.json` (`"type": "module"`, `esbuild@0.28.1`, `ws`, the `@jsr/*` packages) with `package-lock.json`, and a root `.npmrc` containing `@jsr:registry=https://npm.jsr.io`. PR 25 made the shim unnecessary for `src/`; this plan stops importing it from the bundle banner.
- PR 24 replaced `Deno.args`/`import.meta.main` in `package/src/bld.ts` with `args()` from `src/deno_ral/process.ts` and `isMainModule(import.meta)` from `src/deno_ral/main.ts`, and dropped `Deno.run` and `deno info` from `package/src` (so `package/src/common/import-report/deno-info.ts` and the `cycle-dependencies` command already read esbuild's metafile).
- PR 20 deleted `package/src/common/dependencies/deno_dom.ts`, the `DENO_DOM` field of `configuration`, and the `DENO_DOM_PLUGIN`/`QUARTO_DENO_DOM` lines of the launchers. The launcher rewrites below start from that state.
- PR 31 gave `tests/run-tests.sh` and `tests/run-tests.ps1` a `QUARTO_TEST_RUNTIME` switch (`deno` by default, `node` opt-in) and PR 32 runs the required matrix with `QUARTO_TEST_RUNTIME=node`. Task 11 flips the default; PR 37 deletes the `deno` branch.

### Scope

In:
- `configuration`: `NODE=v26.12.0`.
- `package/src/common/dependencies/node.ts`; `archiveUrl` treats bucket `node` like bucket `deno` (download from the official site, not S3).
- `configure.sh`, `configure.cmd`, `package/scripts/common/utils.sh`: download and unpack Node, `npm ci`, remove `deno_std` download and vendoring.
- `tools/node-bundle/build.mjs`: export a `bundle()` function, add `--entry`/`--outfile`/`--no-sourcemap` flags, drop the shim banner; new `tools/node-bundle/ensure.mjs` (rebuild when stale).
- `package/src/quarto-bld`, `package/src/quarto-bld.cmd`: bundle `bld.ts` and run it with `node`.
- `package/src/util/bundle.ts` (new) replaces `bundle()` in `package/src/util/deno.ts`; `prepare-dist.ts` uses it and installs Node instead of Deno; `tools/deno-esbuild-bundle.ts` deleted.
- `package/src/common/previewjs.ts` runs `node build.mjs`; `src/webui/quarto-preview/build.ts` becomes `build.mjs`.
- `src/core/devconfig.ts`: `node` replaces `deno`.
- `package/scripts/common/quarto`, `package/scripts/windows/quarto.cmd`: run `node`; alias mapping; `NODE_OPTIONS`/`NODE_PATH` sanitised.
- `package/scripts/windows/check-node-in-use.cmd` replaces `check-deno-in-use.cmd`.
- The two binary names in the macOS signing list (`package/src/macos/installer.ts`) and the Windows `sign-files` paths (`create-release.yml`), so the nightly release build keeps working between this PR and PR 34.
- `.github/workflows/actions/quarto-dev/action.yml`: npm cache replaces the two Deno caches.
- `.github/workflows/test-quarto-latexmk.yml`: install Deno with `denoland/setup-deno` so `compile-quarto-latexmk` keeps working until PR 39.
- `.vscode/launch.json`: Node launch configurations.
- `tests/run-tests.sh`, `tests/run-tests.ps1`: default runtime `node`.
- Changelog entry, `dev-docs/upgrade-dependencies.md` "Upgrade Node" section.

Out:
- Installers and the Rust launcher (PR 34). `quarto check` runtime row (PR 34). Deprecation warnings for the alias variables (PR 34).
- `quarto run` on Node (PR 35), `build-ts-extension` (PR 36).
- Deleting `deno.jsonc`, `src/vendor_deps.ts`, `package/scripts/deno_std/`, `src/resources/deno_std/`, the `DENO` field, `package/src/util/deno.ts` `compile()`/`install()` (PR 37 and PR 39).
- Lint/format/typecheck tooling (`tsc --noEmit`, `tsconfig.json`): PR 38. This PR removes the `--check` flag from the dev launcher; the opt-in `npm run typecheck` script is PR 38's deliverable.

### Interfaces

```ts
// package/src/common/dependencies/node.ts
import { Dependency } from "./dependencies.ts";

/** Official Node.js release for Quarto's five platform/arch pairs. */
export function node(version: string): Dependency;

/**
 * Archive file name on nodejs.org for a platform pair, e.g.
 * nodeArchiveName("v26.12.0", "linux", "x86_64") === "node-v26.12.0-linux-x64.tar.xz".
 * Exported for the unit test.
 */
export function nodeArchiveName(
  version: string,
  os: "windows" | "linux" | "darwin",
  arch: "x86_64" | "aarch64",
): string;

/** Directory name inside the archive, e.g. "node-v26.12.0-linux-x64". */
export function nodeArchiveDir(
  version: string,
  os: "windows" | "linux" | "darwin",
  arch: "x86_64" | "aarch64",
): string;
```

```ts
// package/src/util/bundle.ts
import { Configuration } from "../common/config.ts";

/**
 * Bundle src/quarto.ts into pkg-working/bin/quarto.js with
 * tools/node-bundle/build.mjs (no source map). Throws on a non-zero exit.
 */
export async function bundleQuarto(config: Configuration): Promise<void>;
```

```js
// tools/node-bundle/build.mjs (ESM, runs on the bundled Node)
/**
 * @param {{ entry: string, outfile: string, sourcemap?: boolean, metafile?: boolean }} options
 * @returns {Promise<{ modules: number, bytes: number, ms: number }>}
 */
export async function bundle(options);
// CLI: node tools/node-bundle/build.mjs --entry <file.ts> --outfile <file.js> [--no-sourcemap] [--metafile <file.json>]
```

```js
// tools/node-bundle/ensure.mjs
// CLI: node tools/node-bundle/ensure.mjs --entry <file.ts> --outfile <file.js> [--watch-dir <dir>]...
// Exit 0 after (re)building when any *.ts/*.js/*.json under the watch dirs (default: the
// entry's directory tree, src/import_map.json, package-lock.json) is newer than outfile,
// or when outfile is missing. Prints "bundle up to date" or the build.mjs summary line.
```

```ts
// src/core/devconfig.ts
export interface DevConfig {
  node: string;        // was: deno
  pandoc: string;
  dartsass: string;
  esbuild: string;
  typst: string;
  script: string;      // md5 of the launcher script
  importMap: string;   // md5 of src/import_map.json
  packageLock: string; // md5 of package-lock.json (new)
}
export function createDevConfig(node: string, pandoc: string, dartsass: string, esbuild: string, typst: string, scriptDir: string): DevConfig;
```

Environment variables read by the launchers after this PR (both dev and installed):

| Variable | Meaning | Default |
|---|---|---|
| `QUARTO_NODE` | path to the Node binary | `<bin>/tools/<arch>/node[.exe]` |
| `QUARTO_NODE_OPTIONS` | extra `node` CLI flags, space separated, appended after Quarto's own | empty |
| `QUARTO_DENO` | alias of `QUARTO_NODE` (used only when `QUARTO_NODE` is unset) | |
| `QUARTO_DENO_OPTIONS`, `QUARTO_DENO_EXTRA_OPTIONS` | appended to `QUARTO_NODE_OPTIONS` verbatim | |
| `QUARTO_DENO_V8_OPTIONS` | comma-separated V8 flags, converted to space-separated and appended to `QUARTO_NODE_OPTIONS` | |
| `QUARTO_TS_PROFILE` | adds `--inspect-brk` (unchanged) | |
| `QUARTO_DEBUG`, `QUARTO_SHARE_PATH`, `QUARTO_BIN_PATH`, `QUARTO_FORCE_VERSION`, `QUARTO_ACTION`, `QUARTO_TARGET` | unchanged | |
| `NODE_OPTIONS`, `NODE_PATH` | **removed from the environment** before `node` starts | |

Quarto's own flags, in order: `--enable-experimental-regexp-engine --max-old-space-size=8192 --stack-trace-limit=100 --use-system-ca`, plus `--enable-source-maps` in dev mode.

### Files

- Create: `package/src/common/dependencies/node.ts` (Node release dependency)
- Create: `package/src/util/bundle.ts` (`bundleQuarto`)
- Create: `tools/node-bundle/ensure.mjs` (stale check and rebuild)
- Create: `src/webui/quarto-preview/build.mjs` (replaces `build.ts`)
- Create: `package/scripts/windows/check-node-in-use.cmd` (replaces `check-deno-in-use.cmd`)
- Create: `tests/unit/node-dependency.test.ts`
- Create: `tests/unit/node-bundle-ensure.test.ts`
- Modify: `configuration:12-13` (add `NODE`, comment `DENO`)
- Modify: `configure.sh` (whole file)
- Modify: `configure.cmd` (whole file)
- Modify: `package/scripts/common/utils.sh` (whole file)
- Modify: `tools/node-bundle/build.mjs` (export `bundle`, CLI flags, no shim banner, eslint-disable post-step)
- Modify: `package/src/quarto-bld`, `package/src/quarto-bld.cmd` (whole files)
- Modify: `package/src/common/prepare-dist.ts:13,23,78-101,126-134` (Node dependency, `bundleQuarto`, remove `node-dist`)
- Modify: `package/src/common/dependencies/dependencies.ts:22-30` (no change to the list; `node` is handled like `deno` was, by `prepare-dist` and `configure`)
- Modify: `package/src/common/archive-binary-dependencies.ts:27-33` (`bucket === "node"`)
- Modify: `package/src/common/configure.ts:28-35,69-78` (npm check uses the bundled npm; dev config fields)
- Modify: `package/src/common/previewjs.ts` (whole file)
- Modify: `package/src/util/deno.ts:12-41` (delete `bundle()`; keep `compile`, `install`, `updateDenoPath` for PR 39)
- Modify: `package/src/common/compile-quarto-latexmk.ts:13` (import no longer brings `bundle`)
- Modify: `src/core/devconfig.ts:19-56,95-115,157-183`
- Modify: `package/scripts/common/quarto` (whole file)
- Modify: `package/scripts/windows/quarto.cmd` (whole file)
- Modify: `package/src/macos/installer.ts:90-96` (`deno` -> `node`)
- Modify: `.github/workflows/create-release.yml:398` (`deno.exe` -> `node.exe`)
- Modify: `.github/workflows/actions/quarto-dev/action.yml:7-39`
- Modify: `.github/workflows/test-quarto-latexmk.yml:33-35`
- Modify: `.vscode/launch.json` (both configurations)
- Modify: `tests/run-tests.sh`, `tests/run-tests.ps1` (default `QUARTO_TEST_RUNTIME=node`)
- Modify: `dev-docs/upgrade-dependencies.md:18-40`
- Modify: `news/changelog-1.11.md` (Dependencies)
- Delete: `tools/deno-esbuild-bundle.ts`, `src/webui/quarto-preview/build.ts`, `package/scripts/windows/check-deno-in-use.cmd`

### Acceptance criteria

- `./configure.sh` on Linux x64/arm64 and macOS x64/arm64, and `./configure.cmd` on Windows x64, produce `package/dist/bin/tools/<arch>/node` (`node.exe`) reporting the version in `configuration`, `package/dist/config/node-version`, a populated root `node_modules/`, and `src/resources/preview/quarto-preview.js`; no `deno` binary and no `package/dist/bin/deno_cache` directory exist afterwards.
- `package/dist/bin/quarto --version` prints `99.9.9`; `package/dist/bin/quarto render tests/docs/smoke-all/2023/01/04/issue-3847.qmd` succeeds; `package/dist/bin/quarto --paths` output is unchanged.
- Editing any `src/**/*.ts` file and running `package/dist/bin/quarto --help` rebuilds `package/dist/bin/quarto-dev.js` once (the launcher prints nothing extra on a rebuild; `QUARTO_DEBUG_BUNDLE=1` prints the build summary).
- `NODE_OPTIONS=--invalid-flag package/dist/bin/quarto --help` works (the variable is unset before Node starts).
- `QUARTO_DENO_V8_OPTIONS=--stack-trace-limit=200 package/dist/bin/quarto --help` works and `node` received `--stack-trace-limit=200` (verify with `QUARTO_DEBUG_BUNDLE=1`, which also echoes the command line).
- `cd package/src && ./quarto-bld prepare-dist --set-version 99.9.9` produces `package/pkg-working/bin/quarto.js`, `package/pkg-working/bin/tools/<arch>/node`, no `tools/<arch>/node-dist` directory, no `deno`; `cd package/pkg-working/bin && ./quarto check` passes (the `test-bundle.yml` steps).
- `quarto-bld validate-bundle` passes (the bundle contains no `eslint-disable-next-line` text).
- The unit tests added here pass on the three OSes, and the PR 32 Node matrix is green with `QUARTO_TEST_RUNTIME` defaulting to `node`.
- `grep -rn "deno" configure.sh configure.cmd package/scripts/common/quarto package/scripts/windows/quarto.cmd package/src/quarto-bld package/src/quarto-bld.cmd` returns only the alias-handling lines (`QUARTO_DENO*`).

## Plan

### Task 1: Pin Node in `configuration` and add the dependency module

**Files:**
- Modify: `configuration:12-13`
- Create: `package/src/common/dependencies/node.ts`
- Modify: `package/src/common/archive-binary-dependencies.ts:27-33`
- Test: `tests/unit/node-dependency.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
/*
 * node-dependency.test.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 */
import { unitTest } from "../test.ts";
import { assertEquals } from "../asserts.ts";
import {
  node,
  nodeArchiveDir,
  nodeArchiveName,
} from "../../package/src/common/dependencies/node.ts";
import { archiveUrl } from "../../package/src/common/archive-binary-dependencies.ts";

unitTest("node dependency - archive names match nodejs.org", () => {
  assertEquals(
    nodeArchiveName("v26.12.0", "linux", "x86_64"),
    "node-v26.12.0-linux-x64.tar.xz",
  );
  assertEquals(
    nodeArchiveName("v26.12.0", "linux", "aarch64"),
    "node-v26.12.0-linux-arm64.tar.xz",
  );
  assertEquals(
    nodeArchiveName("v26.12.0", "darwin", "x86_64"),
    "node-v26.12.0-darwin-x64.tar.gz",
  );
  assertEquals(
    nodeArchiveName("v26.12.0", "darwin", "aarch64"),
    "node-v26.12.0-darwin-arm64.tar.gz",
  );
  assertEquals(
    nodeArchiveName("v26.12.0", "windows", "x86_64"),
    "node-v26.12.0-win-x64.zip",
  );
  assertEquals(
    nodeArchiveDir("v26.12.0", "windows", "x86_64"),
    "node-v26.12.0-win-x64",
  );
});

unitTest("node dependency - downloads from nodejs.org, not the S3 archive", () => {
  const dep = node("v26.12.0");
  assertEquals(dep.bucket, "node");
  const linux = dep.architectureDependencies["x86_64"]["linux"]!;
  assertEquals(
    archiveUrl(dep, linux),
    "https://nodejs.org/dist/v26.12.0/node-v26.12.0-linux-x64.tar.xz",
  );
  const win = dep.architectureDependencies["x86_64"]["windows"]!;
  assertEquals(
    archiveUrl(dep, win),
    "https://nodejs.org/dist/v26.12.0/node-v26.12.0-win-x64.zip",
  );
  // No Windows arm64 build is shipped (same policy as the Deno years).
  assertEquals(dep.architectureDependencies["aarch64"]["windows"], undefined);
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/node-dependency.test.ts`
Expected: FAIL with `Module not found "package/src/common/dependencies/node.ts"`.

- [ ] **Step 3: Add `NODE` to `configuration`**

Replace lines 12-13 of `configuration`:

```bash
# Binary dependencies
# NODE is the bundled JavaScript runtime (official build from https://nodejs.org/dist/).
# Node 26 is Active LTS from 2026-10-28 and maintained until 2029-04-30.
export NODE=v26.12.0
# DENO is no longer downloaded by configure. It is kept until PR 37 for
# `quarto-bld compile-quarto-latexmk` (see dev-docs/runtime-migration/39-quarto-latexmk-packaging.md).
export DENO=v2.7.14
```

- [ ] **Step 4: Implement `node.ts`**

```ts
/*
 * node.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 */
import { Dependency } from "./dependencies.ts";
import { Configuration } from "../config.ts";
import { dirname, join } from "../../../../src/deno_ral/path.ts";
import {
  copyFileSync,
  chmodSync,
  ensureDirSync,
  existsSync,
  removeSync,
  safeMoveSync,
} from "../../../../src/deno_ral/fs.ts";
import { env } from "../../../../src/deno_ral/env.ts";
import { unzip } from "../../util/utils.ts";
import { unTar } from "../../util/tar.ts";

type Os = "windows" | "linux" | "darwin";
type Arch = "x86_64" | "aarch64";

const kNodeArch: Record<Arch, string> = { x86_64: "x64", aarch64: "arm64" };
const kNodeOs: Record<Os, string> = { windows: "win", linux: "linux", darwin: "darwin" };
const kNodeExt: Record<Os, string> = { windows: "zip", linux: "tar.xz", darwin: "tar.gz" };

export function nodeArchiveDir(version: string, os: Os, arch: Arch): string {
  return `node-${version}-${kNodeOs[os]}-${kNodeArch[arch]}`;
}

export function nodeArchiveName(version: string, os: Os, arch: Arch): string {
  return `${nodeArchiveDir(version, os, arch)}.${kNodeExt[os]}`;
}

export function node(version: string): Dependency {
  const release = (os: Os, arch: Arch) => {
    return {
      filename: nodeArchiveName(version, os, arch),
      url: `https://nodejs.org/dist/${version}/`,
      configure: async (_config: Configuration, path: string) => {
        const vendor = env.get("QUARTO_VENDOR_BINARIES");
        if (vendor !== undefined && vendor !== "true") {
          return;
        }
        // tools/ directory that received the download
        const toolsDir = dirname(path);
        const archDir = join(toolsDir, arch);
        ensureDirSync(archDir);

        // Expand next to the download, then keep the whole tree as
        // <arch>/node-dist (npm lives there; configure uses it) and copy the
        // bare binary to <arch>/node. prepare-dist deletes node-dist.
        if (os === "windows") {
          await unzip(path, toolsDir);
        } else {
          await unTar(path, toolsDir);
        }
        const extracted = join(toolsDir, nodeArchiveDir(version, os, arch));
        const dist = join(archDir, "node-dist");
        if (existsSync(dist)) {
          removeSync(dist, { recursive: true });
        }
        // safeMoveSync falls back to copy+delete on EXDEV (tmpfs vs disk on some runners)
        safeMoveSync(extracted, dist);

        const binary = os === "windows" ? "node.exe" : "node";
        const src = os === "windows" ? join(dist, binary) : join(dist, "bin", binary);
        const dest = join(archDir, binary);
        copyFileSync(src, dest);
        if (os !== "windows") {
          chmodSync(dest, 0o755);
        }
      },
    };
  };

  return {
    name: "Node.js runtime",
    bucket: "node",
    version,
    architectureDependencies: {
      "x86_64": {
        "windows": release("windows", "x86_64"),
        "linux": release("linux", "x86_64"),
        "darwin": release("darwin", "x86_64"),
      },
      "aarch64": {
        "linux": release("linux", "aarch64"),
        "darwin": release("darwin", "aarch64"),
      },
    },
  };
}

```

`safeMoveSync` is the existing `src/deno_ral/fs.ts` helper (see `.claude/rules/typescript/deno-ral.md`, "Safe File Operations"); the file has exactly one `fs.ts` import line.

- [ ] **Step 5: Treat bucket `node` like `deno` in `archiveUrl`**

Replace lines 27-33 of `package/src/common/archive-binary-dependencies.ts`:

```ts
  // Runtimes are fetched from their official release site, not from S3
  // (the S3 mirror is for tools whose upstream URLs have changed shape).
  if (dependency.bucket === "deno" || dependency.bucket === "node") {
    return platformDependency.url + platformDependency.filename;
  } else {
    return `${kBucketBaseUrl}/${dependency.bucket}/${dependency.version}/${platformDependency.filename}`;
  }
```

- [ ] **Step 6: Run the test**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/node-dependency.test.ts`
Expected: `2 passed`.

- [ ] **Step 7: Commit**

```bash
git add configuration package/src/common/dependencies/node.ts package/src/common/archive-binary-dependencies.ts tests/unit/node-dependency.test.ts
git commit -m "build: pin Node 26 in configuration and add the node dependency"
```

### Task 2: `build.mjs` as a library and `ensure.mjs`

**Files:**
- Modify: `tools/node-bundle/build.mjs`
- Create: `tools/node-bundle/ensure.mjs`
- Test: `tests/unit/node-bundle-ensure.test.ts`

- [ ] **Step 1: Write the failing test**

The test exercises the stale check through the CLI, using a throwaway entry file so it does not depend on `src/`.

```ts
/*
 * node-bundle-ensure.test.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 */
import { unitTest } from "../test.ts";
import { assert, assertEquals, assertStringIncludes } from "../asserts.ts";
import { join } from "../../src/deno_ral/path.ts";
import { makeTempDirSync } from "../../src/deno_ral/temp.ts";
import {
  existsSync,
  readTextFileSync,
  removeSync,
  statSync,
  utimeSync,
  writeTextFileSync,
} from "../../src/deno_ral/fs.ts";
import { exec, execPath } from "../../src/deno_ral/process.ts";
import { env } from "../../src/deno_ral/env.ts";

const root = env.get("QUARTO_ROOT")!;
const ensure = join(root, "tools", "node-bundle", "ensure.mjs");

async function runEnsure(entry: string, outfile: string, watchDir: string) {
  const r = await exec(execPath(), {
    args: [ensure, "--entry", entry, "--outfile", outfile, "--watch-dir", watchDir],
    cwd: root,
  });
  assert(r.success, new TextDecoder().decode(r.stderr));
  return new TextDecoder().decode(r.stdout);
}

unitTest("ensure.mjs builds when missing, skips when fresh, rebuilds when stale", async () => {
  const dir = makeTempDirSync({ prefix: "ensure-test" });
  try {
    const entry = join(dir, "main.ts");
    const dep = join(dir, "dep.ts");
    const outfile = join(dir, "out", "main.js");
    writeTextFileSync(dep, "export const v: number = 1;\n");
    writeTextFileSync(entry, 'import { v } from "./dep.ts";\nconsole.log("v=" + v);\n');

    const first = await runEnsure(entry, outfile, dir);
    assertStringIncludes(first, "bundled");
    assert(existsSync(outfile));
    assertStringIncludes(readTextFileSync(outfile), "v=");

    const second = await runEnsure(entry, outfile, dir);
    assertStringIncludes(second, "bundle up to date");

    // make dep.ts newer than the bundle
    const later = new Date(statSync(outfile).mtime!.getTime() + 5000);
    writeTextFileSync(dep, "export const v: number = 2;\n");
    utimeSync(dep, later, later);
    const third = await runEnsure(entry, outfile, dir);
    assertStringIncludes(third, "bundled");
    const run = await exec(execPath(), { args: [outfile] });
    assertEquals(new TextDecoder().decode(run.stdout).trim(), "v=2");
  } finally {
    removeSync(dir, { recursive: true });
  }
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/node-bundle-ensure.test.ts`
Expected: FAIL, stderr contains `Cannot find module '.../tools/node-bundle/ensure.mjs'`.

- [ ] **Step 3: Refactor `build.mjs`**

Replace the top-level `esbuild.build` call and the trailing summary of `tools/node-bundle/build.mjs` (the PR 26 file keeps the resolver plugin; only the parts shown change). The plugin's `vendor`, `stubs` and `spike` paths from the spike are already gone in PR 26; the resolver resolves relative to the repository root where `package.json` lives.

```js
// ---- replace everything after the `plugin` definition ----

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

/**
 * Bundle one TypeScript entry point for Node with the import-map resolver.
 * @param {{ entry: string, outfile: string, sourcemap?: boolean, metafile?: boolean }} options
 */
export async function bundle(options) {
  const entry = path.resolve(options.entry);
  const outfile = path.resolve(options.outfile);
  const sourcemap = options.sourcemap ?? true;
  fs.mkdirSync(path.dirname(outfile), { recursive: true });
  const t0 = Date.now();
  const result = await esbuild.build({
    entryPoints: [entry],
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node26",
    outfile,
    sourcemap,
    logLevel: "warning",
    plugins: [plugin],
    banner: {
      js: 'import { createRequire as __createRequire } from "node:module"; const require = __createRequire(import.meta.url);',
    },
    metafile: true,
    tsconfigRaw: {
      compilerOptions: { useDefineForClassFields: true, verbatimModuleSyntax: false },
    },
  });
  // tools/bundle-bug-finder runs eslint over the bundle (quarto-bld validate-bundle);
  // a dependency ships an inline "eslint-disable-next-line" that eslint would honour.
  const text = fs.readFileSync(outfile, "utf8");
  if (text.includes("eslint-disable-next-line")) {
    fs.writeFileSync(outfile, text.replaceAll("eslint-disable-next-line", ""));
  }
  if (options.metafile) {
    fs.writeFileSync(
      typeof options.metafile === "string" ? options.metafile : outfile + ".meta.json",
      JSON.stringify(result.metafile),
    );
  }
  const bytes = fs.statSync(outfile).size;
  return { modules: Object.keys(result.metafile.inputs).length, bytes, ms: Date.now() - t0 };
}

function parseArgs(argv) {
  const opts = { sourcemap: true };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--entry") opts.entry = argv[++i];
    else if (a === "--outfile") opts.outfile = argv[++i];
    else if (a === "--no-sourcemap") opts.sourcemap = false;
    else if (a === "--metafile") opts.metafile = argv[++i];
    else throw new Error(`build.mjs: unknown argument ${a}`);
  }
  if (!opts.entry || !opts.outfile) {
    throw new Error("usage: node tools/node-bundle/build.mjs --entry <file.ts> --outfile <file.js> [--no-sourcemap] [--metafile <file.json>]");
  }
  return opts;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const opts = parseArgs(process.argv.slice(2));
  const r = await bundle(opts);
  console.log(
    `bundled ${path.relative(root, opts.entry)} -> ${path.relative(root, opts.outfile)} (${(r.bytes / 1e6).toFixed(1)} MB, ${r.modules} modules, ${r.ms} ms)`,
  );
}
```

Also delete the `define: { "import.meta.main": "true" }` option if PR 26 kept it (PR 19 replaced `import.meta.main` with `isMainModule(import.meta)`, which compares `import.meta.filename` with `process.argv[1]`; a define would make every module think it is main) and the `import ".../deno-shim.js"` banner line.

- [ ] **Step 4: Write `ensure.mjs`**

```js
// tools/node-bundle/ensure.mjs
//
// Copyright (C) 2026 Posit Software, PBC
//
// Rebuild a bundle when any watched source file is newer than it. Used by the
// dev launchers (package/scripts/common/quarto, quarto.cmd) and quarto-bld so
// that editing src/*.ts is picked up on the next run without a manual build.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bundle } from "./build.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const kExts = new Set([".ts", ".js", ".mjs", ".cjs", ".json"]);

function parseArgs(argv) {
  const opts = { watchDirs: [], extraFiles: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--entry") opts.entry = path.resolve(argv[++i]);
    else if (a === "--outfile") opts.outfile = path.resolve(argv[++i]);
    else if (a === "--watch-dir") opts.watchDirs.push(path.resolve(argv[++i]));
    else if (a === "--watch-file") opts.extraFiles.push(path.resolve(argv[++i]));
    else throw new Error(`ensure.mjs: unknown argument ${a}`);
  }
  if (!opts.entry || !opts.outfile) {
    throw new Error("usage: node tools/node-bundle/ensure.mjs --entry <file.ts> --outfile <file.js> [--watch-dir <dir>]... [--watch-file <file>]...");
  }
  if (opts.watchDirs.length === 0) {
    opts.watchDirs.push(path.dirname(opts.entry));
  }
  // import map and lockfile changes change what gets bundled
  opts.extraFiles.push(path.join(root, "src", "import_map.json"));
  opts.extraFiles.push(path.join(root, "package-lock.json"));
  return opts;
}

// Returns the first file newer than `since`, or null. Skips node_modules and
// the large non-code trees under src/resources that never enter the bundle.
const kSkipDirs = new Set(["node_modules", ".git", "dist", "vendor", "formats", "library", "projects", "filters", "extensions", "pandoc", "fonts"]);
function firstNewer(dir, since) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return null;
  }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (kSkipDirs.has(e.name)) continue;
      const hit = firstNewer(p, since);
      if (hit) return hit;
    } else if (kExts.has(path.extname(e.name))) {
      try {
        if (fs.statSync(p).mtimeMs > since) return p;
      } catch {
        // deleted between readdir and stat
      }
    }
  }
  return null;
}

const opts = parseArgs(process.argv.slice(2));
let reason = null;
if (!fs.existsSync(opts.outfile)) {
  reason = "missing";
} else {
  const since = fs.statSync(opts.outfile).mtimeMs;
  for (const f of opts.extraFiles) {
    if (fs.existsSync(f) && fs.statSync(f).mtimeMs > since) {
      reason = f;
      break;
    }
  }
  if (!reason) {
    for (const d of opts.watchDirs) {
      const hit = firstNewer(d, since);
      if (hit) {
        reason = hit;
        break;
      }
    }
  }
}

if (!reason) {
  console.log("bundle up to date");
} else {
  const r = await bundle({ entry: opts.entry, outfile: opts.outfile, sourcemap: true });
  console.log(
    `bundled ${path.relative(root, opts.entry)} -> ${path.relative(root, opts.outfile)} (${(r.bytes / 1e6).toFixed(1)} MB, ${r.modules} modules, ${r.ms} ms; reason: ${reason === "missing" ? "missing" : path.relative(root, reason)})`,
  );
}
```

Note on `kSkipDirs`: `src/resources/types/schema-types.ts` is imported by `src/execute/engine.ts`, so `types` is deliberately not skipped; `src/resources/filters` and the other listed names contain no TypeScript that the bundle imports (verify with `grep -rl "resources/\(formats\|library\|projects\|filters\|extensions\|pandoc\|fonts\)/" src --include=*.ts | grep -v "src/resources"` returning nothing that is an `import`).

- [ ] **Step 5: Run the test**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/node-bundle-ensure.test.ts`
Expected: `1 passed`.

- [ ] **Step 6: Commit**

```bash
git add tools/node-bundle/build.mjs tools/node-bundle/ensure.mjs tests/unit/node-bundle-ensure.test.ts
git commit -m "build: export bundle() from build.mjs and add ensure.mjs stale check"
```

### Task 3: `configure.sh`, `configure.cmd`, `utils.sh`

**Files:**
- Modify: `package/scripts/common/utils.sh`
- Modify: `configure.sh`
- Modify: `configure.cmd`

- [ ] **Step 1: Rewrite `utils.sh`**

```bash
# NODE_ARCH_DIR is the tools/<arch> directory; NODE_ARCHIVE is the file name on
# https://nodejs.org/dist/$NODE/. Both are used by configure.sh, the dev
# launcher and run-tests.sh.

NODEURL=https://nodejs.org/dist

if [[ $OSTYPE == 'darwin'* ]]; then
  FULLARCH=$(uname -sm)
  if [[ $FULLARCH == "Darwin x86_64" ]]; then
    NODE_ARCH_DIR=x86_64
    NODE_ARCHIVE="node-${NODE}-darwin-x64.tar.gz"
  elif [[ $FULLARCH == "Darwin arm64" ]]; then
    NODE_ARCH_DIR=aarch64
    NODE_ARCHIVE="node-${NODE}-darwin-arm64.tar.gz"
  else
    echo "configure script failed: unrecognized architecture " ${FULLARCH}
    exit 1
  fi
else
  NIXARCH=$(uname -m)
  if [[ $NIXARCH == "x86_64" ]]; then
    NODE_ARCH_DIR=x86_64
    NODE_ARCHIVE="node-${NODE}-linux-x64.tar.xz"
  elif [[ $NIXARCH == "aarch64" ]]; then
    NODE_ARCH_DIR=aarch64
    NODE_ARCHIVE="node-${NODE}-linux-arm64.tar.xz"
  else
    echo "configure script failed: unrecognized architecture " ${NIXARCH}
    exit 1
  fi
fi
# archive directory name = archive name without the extension
NODE_ARCHIVE_DIR="${NODE_ARCHIVE%.tar.*}"
```

`utils.sh` is sourced after `configuration` everywhere it is used (`configure.sh` sources `configuration` first; `quarto-bld` and `deno_std/download.sh` source `utils.sh` first and then `configuration`; swap the order in `quarto-bld` in Task 4 and delete `download.sh` in PR 37). Grep for other users: `grep -rn "utils.sh" package .github configure.sh tests` and make each of them source `configuration` first.

- [ ] **Step 2: Rewrite `configure.sh`**

```bash
#!/usr/bin/env bash
set -ex
source configuration

# Defaults are set in configuration file, but can be overridden here.
#  We can't put these overrides in the configuration file because it is parsed
#  very naively on windows.
export NODE=${NODE_VERSION=$NODE}
export PANDOC=${PANDOC_VERSION=$PANDOC}
export DARTSASS=${DART_SASS_VERSION=$DARTSASS}
export ESBUILD=${ESBUILD_VERSION=$ESBUILD}
export TYPST=${TYPST_VERSION=$TYPST}

source package/scripts/common/utils.sh
source package/src/set_package_paths.sh

# Selects curl or wget based on availability and https support.
function download() {
	url=$1
	destination=$2

	if curl --version | grep -qF ' https '; then
	  curl --fail -L -o "$destination" "$url"
	else
	  wget -q -O "$destination" "$url"
	fi
}

QUARTO_VENDOR_BINARIES=${QUARTO_VENDOR_BINARIES=true}

NODE_BIN=${QUARTO_NODE=$QUARTO_BIN_PATH/tools/$NODE_ARCH_DIR/node}

if [[ "${QUARTO_VENDOR_BINARIES}" = "true" ]]; then
  if [[ (! -f "$NODE_BIN") || "$("$NODE_BIN" --version)" != "$NODE" ]]; then
    echo "Bootstrapping Node.js $NODE..."

    rm -rf "$QUARTO_DIST_PATH"

    ## Binary Directory
    mkdir -p "$QUARTO_BIN_PATH/tools/$NODE_ARCH_DIR"
    pushd "$QUARTO_BIN_PATH/tools"

    download "$NODEURL/$NODE/$NODE_ARCHIVE" "$NODE_ARCHIVE"
    download "$NODEURL/$NODE/SHASUMS256.txt" SHASUMS256.txt
    grep " $NODE_ARCHIVE\$" SHASUMS256.txt | shasum -a 256 -c -
    rm SHASUMS256.txt

    tar -xf "$NODE_ARCHIVE"
    rm -rf "$NODE_ARCH_DIR/node-dist"
    mv "$NODE_ARCHIVE_DIR" "$NODE_ARCH_DIR/node-dist"
    cp "$NODE_ARCH_DIR/node-dist/bin/node" "$NODE_ARCH_DIR/node"
    chmod 755 "$NODE_ARCH_DIR/node"
    rm "$NODE_ARCHIVE"

    # we create a symlink here so that we need only one quarto-cli.code-workspace file
    ln -sf "$NODE_ARCH_DIR/node" node

    # write node version file for later use (the dev launcher compares it with configuration)
    mkdir -p "$QUARTO_BIN_PATH/../config"
    echo "$NODE" > "$QUARTO_BIN_PATH/../config/node-version"

    popd
  fi
  export QUARTO_NODE=$QUARTO_BIN_PATH/tools/$NODE_ARCH_DIR/node
  # npm from the downloaded distribution (its shebang resolves `node` on PATH)
  export PATH="$QUARTO_BIN_PATH/tools/$NODE_ARCH_DIR/node-dist/bin:$PATH"
else
  if [ -z "$QUARTO_NODE" ]; then
    echo "QUARTO_NODE is not set. You either need to allow QUARTO_VENDOR_BINARIES or set QUARTO_NODE to the path of a node binary."
    exit 1
  fi
  if ! command -v npm > /dev/null; then
    echo "npm not found on PATH. QUARTO_VENDOR_BINARIES=false requires npm from the same Node installation as QUARTO_NODE."
    exit 1
  fi
fi

# Node must not pick up the user's NODE_OPTIONS/NODE_PATH during the build
unset NODE_OPTIONS NODE_PATH

echo "Installing TypeScript dependencies (npm ci)"
npm ci --no-audit --no-fund

pushd "$QUARTO_PACKAGE_PATH/src/"

# Run the configure command to bootstrap installation
./quarto-bld configure --log-level info

popd

if ! quarto_loc="$(type -p quarto)" || [[ -z $quarto_loc ]]; then
  echo "Quarto symlink doesn't appear to be configured."
else
	quarto --version
fi
```

`shasum -a 256 -c` exists on macOS (Perl) and on Linux (`perl-Digest-SHA`); if a Linux image lacks `shasum`, replace that line with `grep " $NODE_ARCHIVE\$" SHASUMS256.txt | sha256sum -c -`. Keep one of the two forms in the committed file and name the other in a comment.

- [ ] **Step 3: Rewrite `configure.cmd`**

```bat
@ECHO OFF
SETLOCAL ENABLEDELAYEDEXPANSION

REM Batch script reminder: variables between % % are evaluated as parse time, not at runtime.
REM    Variables set dynamically (including being read from a file) should be evaluated
REM    using ! ! instead of % %. However, this only allows one level of expansion. Do not
REM    try to create a variable that derives from a derived variable. It will be empty.

call package\src\store_win_configuration.bat
call .\win_configuration.bat

if NOT DEFINED QUARTO_VENDOR_BINARIES (
  set "QUARTO_VENDOR_BINARIES=true"
)

SET "NODE_ARCH_DIR=x86_64"
SET "NODE_ARCHIVE_DIR=node-!NODE!-win-x64"
SET "NODE_ARCHIVE=!NODE_ARCHIVE_DIR!.zip"

if "%QUARTO_VENDOR_BINARIES%" == "true" (

  REM Windows-specific: Check if node.exe is running from package/dist before deleting it
  call package\scripts\windows\check-node-in-use.cmd "!QUARTO_DIST_PATH!"
  if "!ERRORLEVEL!"=="1" exit /B 1

  echo Removing package/dist/ directory...
  RMDIR /S /Q "!QUARTO_DIST_PATH!" 2>NUL

  REM Fallback: Verify deletion succeeded (defense in depth)
  if exist "!QUARTO_DIST_PATH!" (
    echo.
    echo ============================================================
    echo Error: Could not delete package/dist/ directory
    echo This may be due to permissions, antivirus, or another process holding files
    echo ============================================================
    echo.
    echo Try closing applications and run configure.cmd again
    exit /B 1
  )

  IF NOT EXIST "!QUARTO_BIN_PATH!\tools\!NODE_ARCH_DIR!" MKDIR "!QUARTO_BIN_PATH!\tools\!NODE_ARCH_DIR!"
  PUSHD "!QUARTO_BIN_PATH!\tools"

  ECHO Bootstrapping Node.js !NODE!...
  CURL --fail -L "https://nodejs.org/dist/!NODE!/!NODE_ARCHIVE!" -o "!NODE_ARCHIVE!"
  REM Windows 10 build 17063+ ships bsdtar as System32\tar; it extracts zip files.
  REM Use the absolute path in case a GNU tar (Git for Windows) is first on PATH.
  %WINDIR%\System32\tar -xf "!NODE_ARCHIVE!"
  IF ERRORLEVEL 1 (
    ECHO Unable to decompress !NODE_ARCHIVE!
    exit /B 1
  )
  DEL "!NODE_ARCHIVE!"
  IF EXIST "!NODE_ARCH_DIR!\node-dist" RMDIR /S /Q "!NODE_ARCH_DIR!\node-dist"
  MOVE "!NODE_ARCHIVE_DIR!" "!NODE_ARCH_DIR!\node-dist" > NUL
  COPY /Y "!NODE_ARCH_DIR!\node-dist\node.exe" "!NODE_ARCH_DIR!\node.exe" > NUL

  REM write node version file for later use
  IF NOT EXIST "!QUARTO_BIN_PATH!\..\config" MKDIR "!QUARTO_BIN_PATH!\..\config"
  ECHO !NODE!> "!QUARTO_BIN_PATH!\..\config\node-version"

  SET "QUARTO_NODE=!QUARTO_BIN_PATH!\tools\!NODE_ARCH_DIR!\node.exe"
  REM npm.cmd from the downloaded distribution
  SET "PATH=!QUARTO_BIN_PATH!\tools\!NODE_ARCH_DIR!\node-dist;!PATH!"
  POPD
) ELSE (
  IF NOT DEFINED QUARTO_NODE (
    ECHO QUARTO_NODE is not set. You either need to allow QUARTO_VENDOR_BINARIES or set QUARTO_NODE to the path of node.exe.
    EXIT /B 1
  )
)

SET "NODE_OPTIONS="
SET "NODE_PATH="

ECHO Installing TypeScript dependencies (npm ci)
CALL npm ci --no-audit --no-fund
IF ERRORLEVEL 1 EXIT /B 1

PUSHD !QUARTO_PACKAGE_PATH!\src
ECHO Configuring Quarto from !cd!
CALL .\quarto-bld.cmd configure --log-level info
echo Configuration done
POPD

IF EXIST !QUARTO_BIN_PATH!\quarto.cmd (
  CALL "!QUARTO_BIN_PATH!\quarto" --version
)

ECHO NOTE: To use quarto please use quarto.cmd (located in this folder) or add the following path to your PATH
ECHO !QUARTO_BIN_PATH!

endlocal & set QUARTO_BIN_DEV=%QUARTO_BIN_PATH%

GOTO :eof
```

`store_win_configuration.bat` converts every `export NAME=value` line of `configuration` to `SET`, so `!NODE!` is available after `call .\win_configuration.bat` (verified: it filters on the `export ` prefix only).

- [ ] **Step 4: Replace `check-deno-in-use.cmd`**

Create `package/scripts/windows/check-node-in-use.cmd` as a copy of `check-deno-in-use.cmd` with these substitutions: every `deno.exe` -> `node.exe`, `Get-Process -Name deno` -> `Get-Process -Name node` (two occurrences), `DENO_CHECK_PATH` -> `NODE_CHECK_PATH` (three occurrences), the header comment and the two user-facing `echo` lines (`Deno is running from this directory` -> `Node.js is running from this directory`, `Please close Deno processes` -> `Please close Node.js processes`, `Deno processes from this directory:` -> `Node.js processes from this directory:`). Delete `check-deno-in-use.cmd`.

```bash
git mv package/scripts/windows/check-deno-in-use.cmd package/scripts/windows/check-node-in-use.cmd
sed -i 's/deno\.exe/node.exe/g; s/-Name deno/-Name node/g; s/DENO_CHECK_PATH/NODE_CHECK_PATH/g; s/check-deno-in-use/check-node-in-use/g; s/Deno is running/Node.js is running/; s/close Deno processes/close Node.js processes/; s/Deno processes from/Node.js processes from/; s/if deno.exe is running/if node.exe is running/; s/if any deno.exe/if any node.exe/; s/while deno is still/while node is still/; s/No deno process/No node process/; s/Deno process found/Node process found/g; s/if deno.exe is running from the specified/if node.exe is running from the specified/; s/system deno in PATH or deno from/system node in PATH or node from/' package/scripts/windows/check-node-in-use.cmd
grep -n -i deno package/scripts/windows/check-node-in-use.cmd   # expect no output
```

- [ ] **Step 5: Run `./configure.sh` locally**

Run: `./configure.sh 2>&1 | tail -20`
Expected: ends with `99.9.9`; `ls package/dist/bin/tools/x86_64/` lists `node`, `node-dist/`, `pandoc`, `dart-sass/`, `esbuild`, `typst`, `typst-gather`; `cat package/dist/config/node-version` prints `v26.12.0`; `ls package/dist/bin/deno_cache` fails with "No such file".

(`quarto-bld configure` is still the Deno-era script at this point; Task 4 makes `./quarto-bld` run on Node. Run this step after Task 4 if `quarto-bld configure` fails here, and record the order in the commit message.)

- [ ] **Step 6: Commit**

```bash
git add configure.sh configure.cmd package/scripts/common/utils.sh package/scripts/windows/check-node-in-use.cmd
git rm -q package/scripts/windows/check-deno-in-use.cmd 2>/dev/null || true
git commit -m "build: configure scripts download Node instead of Deno and run npm ci"
```

### Task 4: `quarto-bld` and `quarto-bld.cmd` on Node

**Files:**
- Modify: `package/src/quarto-bld`
- Modify: `package/src/quarto-bld.cmd`

- [ ] **Step 1: Rewrite `quarto-bld`**

```bash
#!/usr/bin/env bash
set -e

export SCRIPT_PATH=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )

# Prepares Quarto source files for packaging
source "${SCRIPT_PATH}/../../configuration"
source "${SCRIPT_PATH}/../scripts/common/utils.sh"
source "${SCRIPT_PATH}/set_package_paths.sh"

if [ -z "$QUARTO_NODE" ]; then
  export QUARTO_NODE=$SCRIPT_PATH/../dist/bin/tools/$NODE_ARCH_DIR/node
fi

export RUST_BACKTRACE=full
unset NODE_OPTIONS NODE_PATH

# bld.ts imports Cliffy and src/ through src/import_map.json, which Node cannot
# read, so it is bundled first (tools/node-bundle/build.mjs applies the map).
# ensure.mjs only rebuilds when a source file is newer than the bundle.
BLD_BUNDLE="$SCRIPT_PATH/../dist/bin/quarto-bld.js"
"$QUARTO_NODE" "$QUARTO_ROOT/tools/node-bundle/ensure.mjs" \
  --entry "$SCRIPT_PATH/bld.ts" --outfile "$BLD_BUNDLE" \
  --watch-dir "$SCRIPT_PATH" --watch-dir "$QUARTO_ROOT/src" > /dev/null

# --enable-experimental-regexp-engine is required for /regex/l, https://github.com/quarto-dev/quarto-cli/issues/9737
exec "$QUARTO_NODE" --enable-experimental-regexp-engine --stack-trace-limit=100 --enable-source-maps "$BLD_BUNDLE" "$@"
```

- [ ] **Step 2: Rewrite `quarto-bld.cmd`**

```bat
@ECHO OFF

if NOT DEFINED WIN_CONFIG_TRANSLATED call %~dp0\store_win_configuration.bat
call %~dp0\..\..\win_configuration.bat

if NOT DEFINED QUARTO_NODE (
  SET "QUARTO_NODE=%~dp0\..\dist\bin\tools\x86_64\node.exe"
)
SET "RUST_BACKTRACE=full"
SET "NODE_OPTIONS="
SET "NODE_PATH="

SET "BLD_BUNDLE=%~dp0\..\dist\bin\quarto-bld.js"
"%QUARTO_NODE%" "%QUARTO_ROOT%tools\node-bundle\ensure.mjs" --entry "%~dp0\bld.ts" --outfile "%BLD_BUNDLE%" --watch-dir "%~dp0." --watch-dir "%QUARTO_ROOT%src" > NUL
IF ERRORLEVEL 1 EXIT /B 1

REM --enable-experimental-regexp-engine is required for /regex/l, https://github.com/quarto-dev/quarto-cli/issues/9737
"%QUARTO_NODE%" --enable-experimental-regexp-engine --stack-trace-limit=100 --enable-source-maps "%BLD_BUNDLE%" %*
```

(`QUARTO_ROOT` from `win_configuration.bat` ends with a backslash: `set "QUARTO_ROOT=%~dp0"`.)

- [ ] **Step 3: Verify**

Run: `cd package/src && ./quarto-bld --help`
Expected: the Cliffy help listing `configure`, `prepare-dist`, `make-installer-*`, `compile-quarto-latexmk`; `ls ../dist/bin/quarto-bld.js ../dist/bin/quarto-bld.js.map` exist.

Run: `./quarto-bld configure --log-level info 2>&1 | tail -5`
Expected: `Wrote dev config to bin directory` and the symlink messages (this still writes the Deno-era dev config until Task 7; that is fine, `quarto.ts` reads it only through `devConfigsEqual`).

- [ ] **Step 4: Commit**

```bash
git add package/src/quarto-bld package/src/quarto-bld.cmd
git commit -m "build: quarto-bld bundles bld.ts and runs it on Node"
```

### Task 5: `prepare-dist` bundles with `build.mjs` and ships Node

**Files:**
- Create: `package/src/util/bundle.ts`
- Modify: `package/src/util/deno.ts:12-41`
- Modify: `package/src/common/prepare-dist.ts:13,23,78-101,126-134`
- Modify: `package/src/common/compile-quarto-latexmk.ts:13`
- Delete: `tools/deno-esbuild-bundle.ts`

- [ ] **Step 1: Write `bundle.ts`**

```ts
/*
 * bundle.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 */
import { join } from "../../../src/deno_ral/path.ts";
import { exec, execPath } from "../../../src/deno_ral/process.ts";
import { info } from "../../../src/deno_ral/log.ts";
import { Configuration } from "../common/config.ts";

// Bundle src/quarto.ts for the distribution. Runs tools/node-bundle/build.mjs
// on the same Node binary that runs quarto-bld (execPath()).
export async function bundleQuarto(config: Configuration) {
  const entry = join(config.directoryInfo.src, "quarto.ts");
  const outfile = join(config.directoryInfo.pkgWorking.bin, "quarto.js");
  const build = join(config.directoryInfo.root, "tools", "node-bundle", "build.mjs");
  const result = await exec(execPath(), {
    args: [build, "--entry", entry, "--outfile", outfile, "--no-sourcemap"],
    cwd: config.directoryInfo.root,
    stdout: "piped",
    stderr: "inherit",
  });
  if (!result.success) {
    throw new Error(`Failure to bundle ${entry} (exit ${result.code})`);
  }
  info(new TextDecoder().decode(result.stdout).trim());
}
```

- [ ] **Step 2: Remove `bundle()` from `util/deno.ts`**

Delete lines 12-41 (`// TODO in we only use the bundler ...` through the closing brace of `bundle`). Keep `compile`, `install`, `updateDenoPath`: they are used by `compile-quarto-latexmk.ts` and are PR 39's business. Add this comment above `compile`:

```ts
// compile() and install() still drive `deno compile`/`deno install` for the
// tinitex sidecar. They need QUARTO_DENO to point at a Deno binary (configure
// no longer downloads one). PR 39 replaces them.
```

- [ ] **Step 3: Update `prepare-dist.ts`**

Replace the imports on lines 13 and 23:

```ts
import { bundleQuarto } from "../util/bundle.ts";
// line 23:
import { node } from "./dependencies/node.ts";
```

Replace lines 78-101 (`// Download Deno` through the end of the dependency loop):

```ts
  // Download Node (the runtime)
  const nodeVersion = env.get("NODE");
  if (!nodeVersion) {
    throw new Error("NODE is not defined in the environment (source `configuration`)");
  }
  await configArchDependency(node(nodeVersion), targetDir, config);

  // Download the dependencies
  for (const dependency of kDependencies) {
    await configArchDependency(dependency, targetDir, config);
  }

  // The runtime's full distribution (npm, headers, docs) is only needed at
  // configure time; the installer ships the bare binary.
  for (const arch of ["x86_64", "aarch64"]) {
    const nodeDist = join(targetDir, arch, "node-dist");
    if (existsSync(nodeDist)) {
      info(`Removing ${nodeDist}`);
      removeSync(nodeDist, { recursive: true });
    }
  }
```

Add `import { env } from "../../../src/deno_ral/env.ts";` and `removeSync` to the `fs.ts` import. (The `deno_dom` `catch` block is gone with PR 20; if it is still present when you execute, delete it in this step.)

Replace lines 126-134 (`// Create the deno bundle` block):

```ts
  // Create the Node bundle
  info("\nCreating Node bundle");
  info(join(config.directoryInfo.pkgWorking.bin, "quarto.js"));
  await bundleQuarto(config);
  info("");
```

- [ ] **Step 4: Fix the import in `compile-quarto-latexmk.ts`**

Line 13 already imports only `compile, install, updateDenoPath`; confirm `bundle` is not imported anywhere else:

Run: `grep -rn "util/deno.ts" package/src`
Expected: only `compile-quarto-latexmk.ts`.

- [ ] **Step 5: Delete the Deno bundler**

```bash
git rm tools/deno-esbuild-bundle.ts
grep -rn "deno-esbuild-bundle" . --include=*.ts --include=*.md --include=*.yml --include=*.sh | grep -v runtime-migration
```
Expected: no output (the assessment mentions it, which is history).

- [ ] **Step 6: Run `prepare-dist` and the bundle test steps**

Run:
```bash
cd package/src && ./quarto-bld prepare-dist --set-version 99.9.9 --log-level info 2>&1 | tail -15
ls ../pkg-working/bin/tools/x86_64/
cd ../pkg-working/bin && ./quarto --version && ./quarto check 2>&1 | head -20
cd ../../src && ./quarto-bld validate-bundle
```
Expected: `bundled src/quarto.ts -> package/pkg-working/bin/quarto.js (... MB, ... modules, ... ms)`; the tools directory lists `node` but not `node-dist` or `deno`; `./quarto --version` prints `99.9.9`; `quarto check` reaches `Checking versions of quarto binary dependencies...` (the Deno row still prints until PR 34); `validate-bundle` exits 0. (`./quarto` in `pkg-working/bin` is still the Deno launcher until Task 8; run the last two commands again after Task 8.)

- [ ] **Step 7: Commit**

```bash
git add package/src/util/bundle.ts package/src/util/deno.ts package/src/common/prepare-dist.ts
git commit -m "build: prepare-dist bundles with tools/node-bundle and ships Node"
```

### Task 6: `quarto-preview.js` build on Node

**Files:**
- Create: `src/webui/quarto-preview/build.mjs`
- Delete: `src/webui/quarto-preview/build.ts`
- Modify: `package/src/common/previewjs.ts`
- Modify: `package/src/common/configure.ts:28-35`

- [ ] **Step 1: Write `build.mjs`**

```js
// build.mjs
//
// Copyright (C) 2026 Posit Software, PBC
//
// Build src/resources/preview/quarto-preview.js with vite when a tracked file
// in this directory is newer than the generated file (or --force is given).
// Invoked by package/src/common/previewjs.ts on the bundled Node.
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
process.chdir(here);
const args = process.argv.slice(2);

const kQuartoPreviewJs = "../../resources/preview/quarto-preview.js";
let jsBuildTime = 0;
try {
  jsBuildTime = fs.statSync(kQuartoPreviewJs).mtimeMs;
} catch {
  jsBuildTime = 0;
}

const buildFromArgs = () => args.includes("--force");

const buildFromGit = () => {
  let stdout;
  try {
    stdout = execFileSync("git", ["ls-files"], { encoding: "utf8" });
  } catch {
    // git not installed or not a repository: rebuild
    return true;
  }
  const files = stdout.split("\n").filter((line) => line.length > 0);
  return files.some((file) => {
    try {
      return fs.statSync(file).mtimeMs > jsBuildTime;
    } catch {
      return false; // listed but deleted
    }
  });
};

if (!(buildFromArgs() || buildFromGit())) {
  console.log("No changes to quarto-preview.js, skipping build");
  process.exit(0);
}

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const run = (npmArgs) => {
  console.log(`Running: npm ${npmArgs.join(" ")}`);
  const r = spawnSync(npm, npmArgs, { stdio: "inherit", shell: process.platform === "win32" });
  if (r.status !== 0) {
    console.error("Command failed");
    process.exit(r.status ?? 1);
  }
};

console.log("Building quarto-preview.js");
console.log("Installing...");
run(["ci", "--no-audit", "--no-fund"]);
console.log("Building...");
run(["run", "build"]);
```

- [ ] **Step 2: Rewrite `previewjs.ts`**

```ts
/*
 * previewjs.ts
 *
 * Copyright (C) 2020-2026 Posit Software, PBC
 */

import { join } from "../../../src/deno_ral/path.ts";
import { execSync, execPath } from "../../../src/deno_ral/process.ts";

// Build src/resources/preview/quarto-preview.js with the bundled Node. npm must
// be on PATH (configure.sh puts tools/<arch>/node-dist/bin there).
export function buildQuartoPreviewJs(srcDir: string, force?: boolean) {
  const args = [join(quartoPreviewJsDir(srcDir), "build.mjs")];
  if (force) {
    args.push("--force");
  }
  return execSync(execPath(), {
    args,
    cwd: quartoPreviewJsDir(srcDir),
    stderr: "inherit",
    stdout: "inherit",
  });
}

export function quartoPreviewJsDir(srcDir: string) {
  return join(srcDir, "webui", "quarto-preview");
}
```

Update the two callers: `configure.ts:47` becomes `buildQuartoPreviewJs(config.directoryInfo.src)` (unchanged signature position for `srcDir`), `prepare-dist.ts:105` becomes `buildQuartoPreviewJs(config.directoryInfo.src, true)`. The removed middle parameter was `denoDir`, always `undefined`.

- [ ] **Step 3: Make the npm check in `configure.ts` honest**

Replace lines 28-35 of `package/src/common/configure.ts`:

```ts
  // npm is required for building quarto-preview.js (used by `quarto preview`
  // live-reload). configure.sh/configure.cmd put the bundled Node's npm on
  // PATH; with QUARTO_VENDOR_BINARIES=false the caller provides it.
  if ((await which("npm")) === undefined) {
    throw new Error(
      "npm not found on PATH. Run ./configure.sh (which adds the bundled Node's npm to PATH) or install Node.js.",
    );
  }
```

- [ ] **Step 4: Delete `build.ts`, remove the local `deno.jsonc`**

```bash
git rm src/webui/quarto-preview/build.ts src/webui/quarto-preview/deno.jsonc
```

- [ ] **Step 5: Verify**

Run: `rm -f src/resources/preview/quarto-preview.js && cd package/src && ./quarto-bld configure --log-level info 2>&1 | grep -A3 "Building quarto-preview"`
Expected: `Running: npm ci ...`, `Running: npm run build`, and `ls -la src/resources/preview/quarto-preview.js` exists afterwards. A second run prints `No changes to quarto-preview.js, skipping build`.

- [ ] **Step 6: Commit**

```bash
git add src/webui/quarto-preview/build.mjs package/src/common/previewjs.ts package/src/common/configure.ts package/src/common/prepare-dist.ts
git commit -m "build: quarto-preview.js build script runs on Node"
```

### Task 7: Dev config records Node

**Files:**
- Modify: `src/core/devconfig.ts:19-56,95-115,157-183`
- Modify: `package/src/common/configure.ts:69-78`

- [ ] **Step 1: Update the interface and factory**

Replace lines 19-56 of `src/core/devconfig.ts`:

```ts
export interface DevConfig {
  node: string;
  pandoc: string;
  dartsass: string;
  esbuild: string;
  typst: string;
  script: string;
  importMap: string;
  packageLock: string;
}

export function createDevConfig(
  node: string,
  pandoc: string,
  dartsass: string,
  esbuild: string,
  typst: string,
  scriptDir: string,
): DevConfig {
  const scriptPath = join(scriptDir, "quarto" + (isWindows ? ".cmd" : ""));
  const srcDir = env.get("QUARTO_SRC_PATH") ||
    join(quartoConfig.sharePath(), "../../src");
  const rootDir = join(srcDir, "..");
  return {
    node,
    pandoc,
    dartsass,
    esbuild,
    typst,
    script: md5HashSync(readTextFileSync(scriptPath)),
    importMap: md5HashSync(readTextFileSync(join(srcDir, "import_map.json"))),
    packageLock: md5HashSync(readTextFileSync(join(rootDir, "package-lock.json"))),
  };
}
```

(`env` and `readTextFileSync` imports exist after PR 10/14; if the file still uses `Deno.env.get`/`Deno.readTextFileSync` when you get here, PR 10 or 14 has not landed and this plan must wait.)

Replace lines 95-103 (`readSourceDevConfig` tail):

```ts
  return createDevConfig(
    readConfig("NODE"),
    readConfig("PANDOC"),
    readConfig("DARTSASS"),
    readConfig("ESBUILD"),
    readConfig("TYPST"),
    quartoConfig.binPath(),
  );
```

Replace `devConfigsEqual` (lines 106-115):

```ts
export function devConfigsEqual(a: DevConfig, b: DevConfig) {
  return a.node === b.node &&
    a.pandoc === b.pandoc &&
    a.dartsass == b.dartsass &&
    a.esbuild == b.esbuild &&
    a.typst === b.typst &&
    a.script == b.script &&
    a.importMap === b.importMap &&
    a.packageLock === b.packageLock;
}
```

Replace the body of `reconfigureReason` (lines 161-182):

```ts
  const versionMessage = (dep: string, version: string) => {
    return `install ${dep} version ${version}`;
  };
  if (installed === null || installed.node !== source.node) {
    return versionMessage("Node.js", source.node);
  } else if (installed.pandoc !== source.pandoc) {
    return versionMessage("Pandoc", source.pandoc);
  } else if (installed.dartsass !== source.dartsass) {
    return versionMessage("Dart Sass", source.dartsass);
  } else if (installed.esbuild !== source.esbuild) {
    return versionMessage("Esbuild", source.esbuild);
  } else if (installed.typst !== source.typst) {
    return versionMessage("Typst", source.typst);
  } else if (installed.script !== source.script) {
    return "update Quarto wrapper script";
  } else if (installed.importMap !== source.importMap) {
    return "update dev import map";
  } else if (installed.packageLock !== source.packageLock) {
    return "install updated npm dependencies";
  }
```

Also change the Windows message on line 128 from `install Deno` wording: it reads `Quarto requires reconfiguration to ${reason}` already; no Deno text. The comment on lines 121-124 says "because deno.exe is running"; change `deno.exe` to `node.exe`.

- [ ] **Step 2: Update the caller in `configure.ts`**

Replace lines 69-78:

```ts
  const devConfig = createDevConfig(
    env.get("NODE") || "",
    env.get("PANDOC") || "",
    env.get("DARTSASS") || "",
    env.get("ESBUILD") || "",
    env.get("TYPST") || "",
    config.directoryInfo.bin,
  );
```

- [ ] **Step 3: Verify**

Run: `cd package/src && ./quarto-bld configure --log-level info > /dev/null && cat ../dist/config/dev-config`
Expected: JSON with keys `node`, `pandoc`, `dartsass`, `esbuild`, `typst`, `script`, `importMap`, `packageLock`; `node` is `v26.12.0`.

- [ ] **Step 4: Commit**

```bash
git add src/core/devconfig.ts package/src/common/configure.ts
git commit -m "build: dev config records the Node version and package-lock hash"
```

### Task 8: Dev launchers run Node

**Files:**
- Modify: `package/scripts/common/quarto` (whole file)
- Modify: `package/scripts/windows/quarto.cmd` (whole file)

- [ ] **Step 1: Rewrite `package/scripts/common/quarto`**

Keep lines 1-33 (script path resolution and `QUARTO_ROOT` detection) unchanged. Replace everything from line 34 (`QUARTO_SRC_PATH=`) to the end:

```bash
QUARTO_SRC_PATH="$QUARTO_ROOT/src"
DEV_PATH=$QUARTO_SRC_PATH/quarto.ts

if [ -f "$DEV_PATH" ]; then
  QUARTO_DEV_MODE=true
  if [ "$1" == "--version" ] || [ "$1" == "-v" ]; then
    if [ "$QUARTO_FORCE_VERSION" != "" ]; then
      echo $QUARTO_FORCE_VERSION
      exit 0
    fi
    echo "99.9.9"
    exit 0
  fi

  export QUARTO_BIN_PATH=$SCRIPT_PATH
  export QUARTO_SHARE_PATH="${QUARTO_SHARE_PATH=$QUARTO_SRC_PATH/resources/}"

  if [ -z ${QUARTO_DEBUG+x} ]; then
    export QUARTO_DEBUG=true
  fi

  # Check for Node update
  QUARTO_DIST_CONFIG=$QUARTO_BIN_PATH/../config
  mkdir -p $QUARTO_DIST_CONFIG
  NODE_VERSION_FILE=$QUARTO_DIST_CONFIG/node-version
  NODE_SOURCE_VERSION="`(cd "$QUARTO_ROOT" && source ./configuration && echo $NODE)`"
  if [ -f "$NODE_VERSION_FILE" ]; then
    # echo is to trim whitespace to avoid version comparison issues
    NODE_INSTALLED_VERSION=$(echo `cat "$NODE_VERSION_FILE"`)
    if [ "${NODE_SOURCE_VERSION}" != "${NODE_INSTALLED_VERSION}" ]; then
      # configure will call back into this script so we need to update the
      # version so that the check will pass next time through
      (cd "$QUARTO_ROOT" && ./configure.sh)
      echo ""
      printf "\\033[0;31mQuarto required reconfiguration to install Node.js. Had ${NODE_INSTALLED_VERSION}, needed ${NODE_SOURCE_VERSION}. Please try command again.\\033[0m\n\n"
      exit 1
    fi
  fi

  # Caller can point node at another bundle (e.g. a test build)
  if [ -z ${QUARTO_TARGET+x} ]; then
    QUARTO_TARGET=$QUARTO_BIN_PATH/quarto-dev.js
  fi
  # Node runs source through an esbuild bundle (Node's type stripping rejects
  # enums and parameter properties, and cannot read src/import_map.json).
  # ensure.mjs rebuilds only when a source file is newer than the bundle.
  QUARTO_NODE_DEV_OPTIONS="--enable-source-maps"
else
  QUARTO_TARGET=${SCRIPT_PATH}/quarto.js
  export QUARTO_BIN_PATH=$SCRIPT_PATH
  QUARTO_NODE_DEV_OPTIONS=""

  # If Quarto is bundled into an `.app` file, it will be looking for the
  # share directory over in the resources folder.
  if [ -z "${QUARTO_SHARE_PATH+x}" ]; then
    if [[ $SCRIPT_PATH == *"/Contents/MacOS/quarto/bin" ]]; then
      export QUARTO_SHARE_PATH="`cd "$SCRIPT_PATH/../../../Resources/quarto/share";pwd`"
    elif [[ $SCRIPT_PATH == *"/usr/local/bin/quarto" ]]; then
      export QUARTO_SHARE_PATH="`cd "$SCRIPT_PATH/../../share/quarto";pwd`"
    else
      export QUARTO_SHARE_PATH="`cd "$SCRIPT_PATH/../share";pwd`"
    fi
  fi

  if [ "$1" == "--version" ] || [ "$1" == "-v" ]; then
    if [ "$QUARTO_FORCE_VERSION" != "" ]; then
      echo $QUARTO_FORCE_VERSION
      exit 0
    fi
    echo `cat "$QUARTO_SHARE_PATH/version"`
    exit 0
  fi
fi

if [ "$1" == "--paths" ]; then
  echo "$QUARTO_BIN_PATH"
  echo "$QUARTO_SHARE_PATH"
  exit 0
fi

if [[ $OSTYPE == 'darwin'* ]]; then
  # We cannot use uname to determine the _machine_ architecture:
  # https://github.com/quarto-dev/quarto-cli/issues/2420#issuecomment-1245768732
  # However, sysctl can return unexpected values in sandboxed/virtualized environments.
  # Use sysctl -n to get just the value, and check multiple possible patterns.
  FULLARCH="$(/usr/sbin/sysctl -n machdep.cpu.brand_string 2>/dev/null)"

  if [[ $FULLARCH == *"Intel"* ]] || [[ $FULLARCH == *"Xeon"* ]] || [[ $FULLARCH == *"Core"* ]]; then
    ARCH_DIR=x86_64
  elif [[ $FULLARCH == *"Apple"* ]] || [[ $FULLARCH == *"ARM"* ]]; then
    ARCH_DIR=aarch64
  else
    # Fallback to uname -m if sysctl doesn't give us recognizable output
    # This helps with sandboxed/virtualized environments
    UNAME_ARCH=$(uname -m)
    if [[ $UNAME_ARCH == "x86_64" ]]; then
      ARCH_DIR=x86_64
    elif [[ $UNAME_ARCH == "arm64" ]]; then
      ARCH_DIR=aarch64
    else
      echo "quarto script failed: unrecognized architecture. sysctl returned: '${FULLARCH}', uname -m returned: '${UNAME_ARCH}'"
      exit 1
    fi
  fi
else
  NIXARCH=$(uname -m)
  if [[ $NIXARCH == "x86_64" ]]; then
    ARCH_DIR=x86_64
  elif [[ $NIXARCH == "aarch64" ]]; then
    ARCH_DIR=aarch64
  else
    echo "configure script failed: unrecognized architecture " ${NIXARCH}
    exit 1
  fi
fi

# Runtime binary. QUARTO_DENO is accepted as an alias for one release (1.11);
# quarto.js prints a deprecation notice when an alias is used (PR 34).
if [ "$QUARTO_NODE" == "" ]; then
  if [ "$QUARTO_DENO" != "" ]; then
    QUARTO_NODE="$QUARTO_DENO"
  else
    QUARTO_NODE="${SCRIPT_PATH}/tools/${ARCH_DIR}/node"
  fi
fi
export QUARTO_NODE

# A user's Node setup must not change Quarto's runtime: NODE_OPTIONS would be
# prepended to our flags and NODE_PATH would shadow bundled modules.
unset NODE_OPTIONS NODE_PATH

# Quarto's own flags. --enable-experimental-regexp-engine is required for
# /regex/l, https://github.com/quarto-dev/quarto-cli/issues/9737.
# --use-system-ca replaces DENO_TLS_CA_STORE=system,mozilla (NODE_EXTRA_CA_CERTS still works).
QUARTO_NODE_BASE_OPTIONS="--enable-experimental-regexp-engine --max-old-space-size=8192 --stack-trace-limit=100 --use-system-ca ${QUARTO_NODE_DEV_OPTIONS}"

# Aliases of QUARTO_NODE_OPTIONS kept for one release. The V8 variable was a
# comma-separated list for deno's --v8-flags=; node takes each flag separately.
if [ "$QUARTO_DENO_V8_OPTIONS" != "" ]; then
  QUARTO_NODE_OPTIONS="${QUARTO_NODE_OPTIONS} ${QUARTO_DENO_V8_OPTIONS//,/ }"
fi
if [ "$QUARTO_DENO_OPTIONS" != "" ]; then
  QUARTO_NODE_OPTIONS="${QUARTO_NODE_OPTIONS} ${QUARTO_DENO_OPTIONS}"
fi
if [ "$QUARTO_DENO_EXTRA_OPTIONS" != "" ]; then
  QUARTO_NODE_OPTIONS="${QUARTO_NODE_OPTIONS} ${QUARTO_DENO_EXTRA_OPTIONS}"
fi

if [ "$QUARTO_TS_PROFILE" != "" ]; then
  QUARTO_NODE_OPTIONS="--inspect-brk ${QUARTO_NODE_OPTIONS}"
  export QUARTO_TS_PROFILE=true
fi

if [ "$QUARTO_DEV_MODE" == true ]; then
  BUNDLE_LOG=$("${QUARTO_NODE}" "${QUARTO_ROOT}/tools/node-bundle/ensure.mjs" --entry "${DEV_PATH}" --outfile "${QUARTO_TARGET}") || exit 1
  if [ "$QUARTO_DEBUG_BUNDLE" != "" ]; then
    echo "$BUNDLE_LOG" >&2
    echo "${QUARTO_NODE} ${QUARTO_NODE_BASE_OPTIONS} ${QUARTO_NODE_OPTIONS} ${QUARTO_TARGET} $@" >&2
  fi
fi

exec "${QUARTO_NODE}" ${QUARTO_NODE_BASE_OPTIONS} ${QUARTO_NODE_OPTIONS} "${QUARTO_TARGET}" "$@"
```

`QUARTO_ACTION` (`run` vs other deno subcommands) and `QUARTO_IMPORT_MAP_ARG`, `QUARTO_CACHE_OPTIONS`, `QUARTO_NO_TYPECHECK` are gone: Node has one way to run a file. `grep -rn "QUARTO_ACTION\|QUARTO_NO_TYPECHECK" . --include=*.sh --include=*.ps1 --include=*.yml --include=*.md | grep -v runtime-migration` must return nothing after this task (fix `tests/README.md` mentions in PR 37 if any).

- [ ] **Step 2: Rewrite `package/scripts/windows/quarto.cmd`**

```bat
@ECHO OFF

SETLOCAL ENABLEDELAYEDEXPANSION

SET "SCRIPT_PATH=%~dp0"
SET DEV_PATH=..\..\..

:: Set SRC_PATH in a way that normalizes the ../.. stuff away
for %%i in ("%~dp0\%DEV_PATH%") do SET "QUARTO_ROOT=%%~fi"
SET "QUARTO_TS_PATH=!QUARTO_ROOT!\src\quarto.ts"

IF EXIST "!QUARTO_TS_PATH!" (
	set QUARTO_DEV_MODE=true

	IF "%1"=="--version" (
		IF DEFINED QUARTO_FORCE_VERSION (
			ECHO !QUARTO_FORCE_VERSION!
			GOTO end
		)
		ECHO 99.9.9
		GOTO end
	)

	IF "%1"=="-v" (
		IF DEFINED QUARTO_FORCE_VERSION (
			ECHO !QUARTO_FORCE_VERSION!
			GOTO end
		)
		ECHO 99.9.9
		GOTO end
	)

  call !QUARTO_ROOT!\win_configuration.bat
  REM overrride share path to point to our dev folder instead of dist
  set QUARTO_SHARE_PATH=!QUARTO_ROOT!\src\resources

	IF NOT DEFINED QUARTO_TARGET (
		SET "QUARTO_TARGET=!QUARTO_BIN_PATH!\quarto-dev.js"
	)

	IF NOT DEFINED QUARTO_DEBUG (
		SET QUARTO_DEBUG=true
	)

	:: Normalize path to remove ../.. stuff
	for %%i in ("!SCRIPT_PATH!..\config\node-version") do SET "NODE_VERSION_FILE=%%~fi"

  if exist "!NODE_VERSION_FILE!" (
		set /p NODE_INSTALLED_VERSION=<"!NODE_VERSION_FILE!"
	  if NOT "!NODE!"=="!NODE_INSTALLED_VERSION!" (
			echo !NODE!>"!NODE_VERSION_FILE!"
			cd !QUARTO_ROOT!
			call configure.cmd
			echo.
			echo Quarto required reconfiguration to install Node.js !NODE!. Please try command again.
			exit /b 1
		)
	) else (
		echo !NODE!>"!NODE_VERSION_FILE!"
	)

	SET "QUARTO_NODE_DEV_OPTIONS=--enable-source-maps"

) ELSE (

	IF NOT DEFINED QUARTO_SHARE_PATH (
	  for %%i in ("!SCRIPT_PATH!\..\share") do SET "QUARTO_SHARE_PATH=%%~fi"
	)

	IF "%1"=="-v" (
		IF DEFINED QUARTO_FORCE_VERSION (
			ECHO !QUARTO_FORCE_VERSION!
			GOTO end
		)
		TYPE "!QUARTO_SHARE_PATH!\version"
		GOTO end
	)

	IF "%1"=="--version" (
		IF DEFINED QUARTO_FORCE_VERSION (
			ECHO !QUARTO_FORCE_VERSION!
			GOTO end
		)
		TYPE "!QUARTO_SHARE_PATH!\version"
		GOTO end
	)

	SET "QUARTO_TARGET=%SCRIPT_PATH%\quarto.js"
	SET "QUARTO_BIN_PATH=%SCRIPT_PATH%"
	SET "QUARTO_NODE_DEV_OPTIONS="
)

IF "%1"=="--paths" (
	ECHO !QUARTO_BIN_PATH!
	ECHO !QUARTO_SHARE_PATH!
	GOTO end
)

SET NO_COLOR=TRUE

REM Runtime binary. QUARTO_DENO is accepted as an alias for one release (1.11).
IF NOT DEFINED QUARTO_NODE (
	IF DEFINED QUARTO_DENO (
		SET "QUARTO_NODE=!QUARTO_DENO!"
	) ELSE (
		SET "QUARTO_NODE=!SCRIPT_PATH!\tools\x86_64\node.exe"
	)
)

REM A user's Node setup must not change Quarto's runtime.
SET "NODE_OPTIONS="
SET "NODE_PATH="

REM --enable-experimental-regexp-engine is required for /regex/l, https://github.com/quarto-dev/quarto-cli/issues/9737
SET "QUARTO_NODE_BASE_OPTIONS=--enable-experimental-regexp-engine --max-old-space-size=8192 --stack-trace-limit=100 --use-system-ca !QUARTO_NODE_DEV_OPTIONS!"

REM Aliases of QUARTO_NODE_OPTIONS kept for one release. V8 flags were comma separated for deno.
IF DEFINED QUARTO_DENO_V8_OPTIONS (
	SET "QUARTO_NODE_OPTIONS=!QUARTO_NODE_OPTIONS! !QUARTO_DENO_V8_OPTIONS:,= !"
)
IF DEFINED QUARTO_DENO_OPTIONS (
	SET "QUARTO_NODE_OPTIONS=!QUARTO_NODE_OPTIONS! !QUARTO_DENO_OPTIONS!"
)
IF DEFINED QUARTO_DENO_EXTRA_OPTIONS (
	SET "QUARTO_NODE_OPTIONS=!QUARTO_NODE_OPTIONS! !QUARTO_DENO_EXTRA_OPTIONS!"
)

IF DEFINED QUARTO_TS_PROFILE (
	SET "QUARTO_NODE_OPTIONS=--inspect-brk !QUARTO_NODE_OPTIONS!"
	SET "QUARTO_TS_PROFILE=true"
)

IF DEFINED QUARTO_DEV_MODE (
	"!QUARTO_NODE!" "!QUARTO_ROOT!\tools\node-bundle\ensure.mjs" --entry "!QUARTO_TS_PATH!" --outfile "!QUARTO_TARGET!" > NUL
	IF ERRORLEVEL 1 exit /b 1
)

"!QUARTO_NODE!" !QUARTO_NODE_BASE_OPTIONS! !QUARTO_NODE_OPTIONS! "!QUARTO_TARGET!" %*

:end
```

- [ ] **Step 3: Verify the dev launcher**

Run (Linux/macOS):
```bash
package/dist/bin/quarto --version
package/dist/bin/quarto --paths
QUARTO_DEBUG_BUNDLE=1 package/dist/bin/quarto --help 2>&1 | head -3
touch src/core/path.ts && QUARTO_DEBUG_BUNDLE=1 package/dist/bin/quarto --help 2>&1 | head -1
NODE_OPTIONS=--not-a-flag package/dist/bin/quarto --help > /dev/null && echo "NODE_OPTIONS ignored: OK"
QUARTO_DENO_V8_OPTIONS=--stack-trace-limit=200 QUARTO_DEBUG_BUNDLE=1 package/dist/bin/quarto --help 2>&1 | grep -c "stack-trace-limit=200"
package/dist/bin/quarto render tests/docs/smoke-all/2023/01/04/issue-3847.qmd
```
Expected: `99.9.9`; two paths ending in `package/dist/bin` and `src/resources/`; the first `--help` prints `bundle up to date` (or `bundled ...` the very first time) then the command line; after `touch`, `bundled src/quarto.ts -> package/dist/bin/quarto-dev.js (... reason: src/core/path.ts)`; `NODE_OPTIONS ignored: OK`; `1`; the render writes `issue-3847.html`.

- [ ] **Step 4: Re-run the `prepare-dist` bundle check from Task 5 step 6**

Run: `cd package/src && ./quarto-bld prepare-dist --set-version 99.9.9 > /dev/null && cd ../pkg-working/bin && ./quarto --version && ./quarto check`
Expected: `99.9.9` then a complete `quarto check` (the launcher in `pkg-working/bin` is now the Node one; `copyQuartoScript` copies `package/scripts/common/quarto`).

- [ ] **Step 5: Commit**

```bash
git add package/scripts/common/quarto package/scripts/windows/quarto.cmd
git commit -m "build: dev and installed launchers run Node with alias env vars"
```

### Task 9: Keep the nightly release build green (binary names in signing lists)

**Files:**
- Modify: `package/src/macos/installer.ts:90-96`
- Modify: `.github/workflows/create-release.yml:398`

- [ ] **Step 1: macOS signing list**

Replace lines 90-96 of `package/src/macos/installer.ts`:

```ts
    ["aarch64", "x86_64"].forEach((arch) => {
      // Node (V8 JIT) needs the same entitlements Deno did:
      // allow-jit and allow-unsigned-executable-memory (entitlements.plist).
      signWithEntitlements.push(join(
        config.directoryInfo.pkgWorking.bin,
        "tools",
        arch,
        "node",
      ));
```

- [ ] **Step 2: Windows signing paths**

Replace line 398 of `.github/workflows/create-release.yml` (`./package/pkg-working/bin/tools/x86_64/deno.exe`) with `./package/pkg-working/bin/tools/x86_64/node.exe`. If line 401 (`deno_dom/plugin.dll`) is still there, delete it (PR 20).

- [ ] **Step 3: Commit**

```bash
git add package/src/macos/installer.ts .github/workflows/create-release.yml
git commit -m "build: sign node instead of deno in release installers"
```

PR 34 does the rest of the installer work (Rust launcher, RHEL job, docs). Until PR 34 lands, `quarto.exe` still spawns `deno`, so a Windows MSI built from this commit does not run; the tarball/zip on Linux and macOS work because they use the shell launcher. The PR description must say so and PR 34 must follow within the same prerelease.

### Task 10: CI caches and the latexmk workflow

**Files:**
- Modify: `.github/workflows/actions/quarto-dev/action.yml:7-39`
- Modify: `.github/workflows/test-quarto-latexmk.yml:33-35`

- [ ] **Step 1: Replace the two Deno caches with an npm cache**

Replace lines 7-39 of `.github/workflows/actions/quarto-dev/action.yml`:

```yaml
    - name: Cache npm downloads
      uses: actions/cache@v5
      with:
        path: ~/.npm
        key: ${{ runner.os }}-${{ runner.arch }}-npm-v1-${{ hashFiles('package-lock.json', 'src/webui/quarto-preview/package-lock.json', 'tools/bundle-bug-finder/package-lock.json') }}
        restore-keys: |
          ${{ runner.os }}-${{ runner.arch }}-npm-v1-

    - name: Configure Quarto (.sh)
      if: runner.os != 'Windows'
      shell: bash
      run: |
        # install with symlink in /usr/local/bin which in PATH on CI
        ./configure.sh

    - name: Configure Quarto (.ps1)
      if: runner.os == 'Windows'
      shell: pwsh
      run: |
        ./configure.cmd
        "$(Get-ChildItem -Path ./package/dist/bin/quarto.cmd | %{ $_.FullName } | Split-Path)" >> $env:GITHUB_PATH
```

`~/.npm` is npm's download cache on all three runners (`%LOCALAPPDATA%\npm-cache` is used on Windows when `~/.npm` does not exist; `actions/cache` expands `~` on Windows to the user profile, where npm 11 keeps `.npm` as well; verify in the first Windows run that the cache step reports a non-zero size and bump to `${{ env.LOCALAPPDATA }}\npm-cache` if not). `tools/bundle-bug-finder/package-lock.json` is gitignored, so `hashFiles` ignores it harmlessly; remove it from the list if the hash function warns.

- [ ] **Step 2: Keep `compile-quarto-latexmk` running until PR 39**

Insert after line 34 of `.github/workflows/test-quarto-latexmk.yml` (after the `quarto-dev` step):

```yaml
      # compile-quarto-latexmk still uses `deno compile` (replaced in PR 39).
      - uses: denoland/setup-deno@v2
        with:
          deno-version: v2.7.14
      - name: Point quarto-bld at Deno
        shell: bash
        run: echo "QUARTO_DENO=$(which deno)" >> "$GITHUB_ENV"
```

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/actions/quarto-dev/action.yml .github/workflows/test-quarto-latexmk.yml
git commit -m "ci: cache npm instead of the Deno caches; keep latexmk compile on setup-deno"
```

### Task 11: Test runner default and VS Code launch configurations

**Files:**
- Modify: `tests/run-tests.sh`, `tests/run-tests.ps1`
- Modify: `.vscode/launch.json`

- [ ] **Step 1: Default the test runtime to Node**

In `tests/run-tests.sh` and `tests/run-tests.ps1`, find the PR 31 line that sets the default of `QUARTO_TEST_RUNTIME` (`QUARTO_TEST_RUNTIME="${QUARTO_TEST_RUNTIME:-deno}"` or the PowerShell equivalent) and change the default to `node`. Also delete the `DENO_DIR` block at lines 52-62 of `run-tests.sh` and lines 33-34, 62-66 of `run-tests.ps1` (the Deno binary and `DENO_DIR` no longer exist); the `deno` branch itself stays until PR 37 and fails with "deno not found" if selected, which is the intended signal.

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/node-dependency.test.ts unit/node-bundle-ensure.test.ts smoke/run/run-script.test.ts`
Expected: all pass on Node without setting `QUARTO_TEST_RUNTIME`.

- [ ] **Step 2: `.vscode/launch.json`**

Replace both configurations:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Launch Quarto (dev bundle)",
      "request": "launch",
      "type": "node",
      "args": ["serve"],
      "cwd": "${workspaceFolder}/../quarto-demo",
      "runtimeExecutable": "${workspaceFolder}/package/dist/bin/tools/node",
      "runtimeArgs": [
        "--enable-source-maps",
        "--enable-experimental-regexp-engine",
        "--max-old-space-size=8192",
        "--stack-trace-limit=100",
        "--inspect-brk",
        "${workspaceFolder}/package/dist/bin/quarto-dev.js"
      ],
      "preLaunchTask": "quarto: ensure dev bundle",
      "env": {
        "QUARTO_BIN_PATH": "${workspaceFolder}/package/dist/bin",
        "QUARTO_SHARE_PATH": "${workspaceFolder}/src/resources",
        "QUARTO_ROOT": "${workspaceFolder}",
        "QUARTO_DEBUG": "true"
      },
      "windows": {
        "runtimeExecutable": "${workspaceFolder}\\package\\dist\\bin\\tools\\x86_64\\node.exe"
      }
    },
    {
      "name": "Run Quarto test",
      "request": "launch",
      "type": "node",
      "cwd": "${workspaceFolder}/tests",
      "runtimeExecutable": "${workspaceFolder}/package/dist/bin/tools/node",
      "runtimeArgs": ["--inspect-brk"],
      "program": "${workspaceFolder}/tests/run-tests.sh",
      "args": ["smoke/logging/log-level-direct.test.ts"],
      "env": {
        "QUARTO_ROOT": "${workspaceFolder}",
        "QUARTO_BIN_PATH": "${workspaceFolder}/package/dist/bin",
        "QUARTO_SHARE_PATH": "${workspaceFolder}/src/resources",
        "QUARTO_DEBUG": "true",
        "QUARTO_TESTS_NO_CONFIG": "true"
      },
      "windows": {
        "runtimeExecutable": "${workspaceFolder}\\package\\dist\\bin\\tools\\x86_64\\node.exe"
      }
    }
  ]
}
```

Add `.vscode/tasks.json`:

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "quarto: ensure dev bundle",
      "type": "shell",
      "command": "${workspaceFolder}/package/dist/bin/tools/node",
      "args": [
        "${workspaceFolder}/tools/node-bundle/ensure.mjs",
        "--entry", "${workspaceFolder}/src/quarto.ts",
        "--outfile", "${workspaceFolder}/package/dist/bin/quarto-dev.js"
      ],
      "problemMatcher": []
    }
  ]
}
```

The "Run Quarto test" configuration delegates to `run-tests.sh` because the exact `node --test` invocation is owned by PR 31's harness; adjust `program`/`args` to the harness entry if PR 31 exposes a direct one (check `tests/README.md`).

- [ ] **Step 3: Commit**

```bash
git add tests/run-tests.sh tests/run-tests.ps1 .vscode/launch.json .vscode/tasks.json
git commit -m "build: test runner defaults to Node; VS Code launches the Node bundle"
```

### Task 12: Changelog and dev-docs

**Files:**
- Modify: `news/changelog-1.11.md` (`## Dependencies`)
- Modify: `dev-docs/upgrade-dependencies.md:18-40`

- [ ] **Step 1: Changelog**

Add under `## Dependencies` (create the section after `## Regression fixes` if absent, per `.claude/rules/changelog.md`):

```markdown
- ([#NNNNN](https://github.com/quarto-dev/quarto-cli/pull/NNNNN)): Quarto now runs on Node.js v26.12.0 instead of Deno. The `QUARTO_DENO`, `QUARTO_DENO_OPTIONS`, `QUARTO_DENO_EXTRA_OPTIONS` and `QUARTO_DENO_V8_OPTIONS` environment variables keep working in 1.11 as aliases of `QUARTO_NODE` and `QUARTO_NODE_OPTIONS`; `QUARTO_DENO_DIR` and `QUARTO_DENO_DOM` are ignored. `NODE_OPTIONS` and `NODE_PATH` from the environment are not passed to Quarto's runtime.
```

Replace `NNNNN` with this PR's number once opened.

- [ ] **Step 2: `dev-docs/upgrade-dependencies.md`**

Replace the `## Upgrade deno` section (lines 18-40, including the RHEL conda-forge subsection) with:

```markdown
## Upgrade Node.js

- Pick the newest release of the current LTS line at <https://nodejs.org/dist/index.json> (`"lts"` is a codename string for LTS releases). Quarto tracks one major line per Quarto release.
- Update `NODE` in `configuration`.
- Update the pinned version in `src/command/check/check.ts` (`quarto check --strict` compares the running runtime with it; `tests/smoke/check/check-versions-no-mismatch.test.ts` fails on a mismatch).
- Run `./configure.sh` (Linux/macOS) or `./configure.cmd` (Windows): the dev launcher notices `package/dist/config/node-version` differs from `configuration` and reconfigures on the next run anyway.
- Dispatch `create-release.yml` without publishing before merging (see the top of this file): the Node binary is signed and notarized like every other bundled binary.
```

- [ ] **Step 3: Commit**

```bash
git add news/changelog-1.11.md dev-docs/upgrade-dependencies.md
git commit -m "docs: changelog and upgrade notes for the Node runtime"
```

## Verification

Before opening the PR:

- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/node-dependency.test.ts unit/node-bundle-ensure.test.ts`: 3 passed.
- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/run/run-script.test.ts smoke/check/check-versions-no-mismatch.test.ts smoke/render/`: green (the `check-versions` strict test still reports the Deno row until PR 34; if it fails on `Deno version: (not detected)`, that is PR 34's change and this PR marks the test `ignore` with a comment naming PR 34).
- `quarto run --dev tools/check-runtime-boundary.ts`: counts unchanged (this PR adds no `Deno.*`).
- Fresh clone test on Linux: `git clone … && ./configure.sh && package/dist/bin/quarto render tests/docs/smoke-all/2023/01/04/issue-3847.qmd`.
- `cd package/src && ./quarto-bld prepare-dist --set-version 99.9.9 && ./quarto-bld validate-bundle && (cd ../pkg-working/bin && ./quarto check)`.
- Push the branch and let `test-smokes.yml`, `test-bundle.yml`, `test-quarto-latexmk.yml`, `test-install.yml` run; dispatch `create-release.yml` with `publish-release=false` and confirm the Linux and macOS jobs pass (Windows MSI is expected to fail at "Build Launcher"-dependent smoke steps until PR 34; the `Sign files` step must pass with `node.exe`).
- `grep -rn "deno" configure.sh configure.cmd package/scripts/common/quarto package/scripts/windows/quarto.cmd package/src/quarto-bld package/src/quarto-bld.cmd` shows only `QUARTO_DENO*` alias lines.

## Review checklist

- [ ] `configuration` pins `NODE` to a 26.x release that exists in `https://nodejs.org/dist/index.json`; the checksum step in `configure.sh` verifies the download.
- [ ] `node.ts` produces exactly the five archive names listed in the Context section; no S3 mirror is involved (`archiveUrl` special case).
- [ ] The dev launchers unset `NODE_OPTIONS` and `NODE_PATH`, pass `--use-system-ca`, and map all four `QUARTO_DENO*` aliases; no reference to `DENO_DIR`, `--importmap`, `--check`, `--cached-only`, `--unstable-*` remains.
- [ ] Dev mode runs the bundle via `ensure.mjs`; the watch excludes `node_modules` and the heavy resource trees but includes `src/resources/types`.
- [ ] `prepare-dist` output contains `bin/tools/<arch>/node` and no `node-dist`; macOS copies both arches like Pandoc.
- [ ] `build.mjs` no longer defines `import.meta.main` and no longer imports the Deno shim; the `eslint-disable-next-line` scrub is preserved.
- [ ] `quarto-preview.js` builds through `build.mjs` with `npm ci` (not `npm install`).
- [ ] Changelog entry names the alias variables and the `NODE_OPTIONS` behaviour.
- [ ] No file under `src/` other than `src/core/devconfig.ts` changed.

## Risks and rollback

- **`npm ci` needs network access to registry.npmjs.org and npm.jsr.io at configure time.** Before this PR, `deno install` needed jsr.io and the GitHub-hosted tarballs; the surface is comparable. Corporate proxies: npm honours `HTTPS_PROXY`; document `npm config set cafile` in the troubleshooting page (PR 34 docs list).
- **A stale dev bundle.** If `ensure.mjs` misses a file type (e.g. a `.wasm` import), developers see old behaviour. The reason line under `QUARTO_DEBUG_BUNDLE=1` and `rm package/dist/bin/quarto-dev.js` are the escape hatches; add the extension to `kExts` and the test.
- **Windows `tar` on older Windows 10 builds cannot extract zip.** The old `configure.cmd` had an `unzip` fallback; keep the same two-step fallback if the first CI Windows run fails (`IF ERRORLEVEL 1 unzip -o ...`).
- **Node 26 glibc requirement (>= 2.28).** The official Linux binaries do not run on RHEL 7 / CentOS 7; neither did Deno 2 on glibc 2.17 in practice (the RHEL tarball job is disabled today). PR 34 removes the job.
- **Rollback:** revert the PR; `main` goes back to Deno with the PR 32 Node matrix as an allowed-failure job. No data formats changed (the dev config file is regenerated by `configure`).

## Decisions needed

1. **Pin `v26.12.0` now or wait for 2026-10-28 (LTS promotion)?** Recommendation: pin the newest 26.x at execution time; the LTS label changes nothing in the binary. If the team wants an LTS-labelled release on the first prerelease, PR 33 can land with `v24.22.0` and PR 34 bumps to 26 (the dependency module and `configuration` are the only places); not recommended because 24 enters Maintenance on 2026-10-20.
2. **Dev mode through the bundle (chosen) vs `node src/quarto.ts` after removing the 12 enums and 40 parameter-property files.** Recommendation: bundle. It is what ships, it keeps `src/import_map.json` as the single dependency map, and the enum cleanup can still happen in PR 38 for `tsc`'s `erasableSyntaxOnly` if the team wants it, without changing the launcher.
