# PR 34: Installers ship Node correctly; platform minimums; `quarto check` runtime row; runtime environment contract

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every installer ships the Node binary with Node's own macOS entitlements and refuses to install where Node 26 cannot run, `quarto check` reports and strictly checks the pinned Node version, the conda recipe template uses `nodejs`, and the runtime environment contract (review S6) is written down as one table with a test per testable row.
**Phase:** 3. **Depends on:** PR 33 (the flip; launchers, `src/core/runtime-env.ts`, Rust launcher, `quarto install deno`). **Unblocks:** PR 37.
**Branch:** `rt/34-installers-and-check`.
**Suggested executor:** Opus. Signing and notarization with new entitlements, installer metadata on three platforms and a proxy end-to-end test need judgement; the TypeScript is small.
**Size:** M (about 16 files: `node-entitlements.plist`, `installer.ts` (macOS), `distribution.xml`, `installer.ts` (Linux), `create-release.yml`, `check.ts`, conda recipe (3 files), `llm-docs/code-signing-installers.md`, 2 tests, changelog, `docs-updates.md`).
**Ships on:** Node. Gates: the PR 32 Node matrix, `create-release.yml` dispatched with `publish-release=false` (all platforms), `test-smokes-built.yml` on its artifacts.

## Spec

### Context

Assessment sections 3.6 and 6 (operators, CI, packagers), review S6 and the PR 34 findings in `REVIEW-2026-10-15.md` section 4. After PR 33 the CLI runs on Node everywhere, including `quarto.exe` (the Rust launcher moved into PR 33 so the MSI never broke), and the installers already carry `bin/tools/<arch>/node` signed with Quarto's two-key `entitlements.plist`. What is left:

- **macOS entitlements.** Quarto signs `pandoc`, `esbuild`, `typst`, `dart` and (since PR 33) `node` with `package/scripts/macos/entitlements.plist`: `com.apple.security.cs.allow-jit` and `com.apple.security.cs.allow-unsigned-executable-memory`. Node's release signing (`tools/osx-codesign.sh` in `nodejs/node`, which passes `tools/osx-entitlements.plist` to `codesign --options runtime`) grants six keys at `v26.12.0` (read 2026-10-15):
  - `com.apple.security.cs.allow-jit`
  - `com.apple.security.cs.allow-unsigned-executable-memory`
  - `com.apple.security.cs.disable-executable-page-protection`
  - `com.apple.security.cs.allow-dyld-environment-variables`
  - `com.apple.security.cs.disable-library-validation`
  - `com.apple.security.get-task-allow`

  Without `disable-library-validation`, hardened-runtime Node refuses to load a native addon (`.node`) that is not signed by Posit's team ID; PR 35 sends script authors to npm packages, some of which ship native addons. `get-task-allow` is a debugging entitlement (lets other processes attach); it is not needed to run Node and Quarto should not ship it. This PR signs `node` with a new `node-entitlements.plist` holding the first five keys. **The executor re-reads Node's plist for the pinned version** (`curl -sS https://raw.githubusercontent.com/nodejs/node/<version>/tools/osx-entitlements.plist`) and records any difference in the PR description.
- **Platform minimums.** Node 26 official binaries need macOS ≥ 13.5 (x64 and arm64), Linux glibc ≥ 2.28 and kernel ≥ 4.18 (x64 and arm64) (`BUILDING.md` at `v26.12.0`, "Supported platforms", re-read 2026-10-16), and Windows 10 / Server 2016 or newer. macOS x64 is Tier 2 "until early 2028" (footnote 8: the project's Intel macOS test infrastructure ends then; Intel macOS moves to experimental and Node keeps shipping untested universal binaries for supported lines). Deno 2.x ran on older macOS releases. Today `package/scripts/macos/distribution.xml` has no `allowed-os-versions`, so the pkg installs on macOS 12 and `quarto` then fails with a dyld error; the deb/rpm metadata (`package/src/linux/installer.ts:73-103`) declares no libc dependency.
- **RHEL 7 job.** `create-release.yml` still carries the disabled `make-tarball-rhel` job (`if: false`, lines 207-256) that downloads a conda-forge Deno; Node 26 cannot run on RHEL 7's glibc 2.17.
- **`quarto check`.** PR 19 already replaced `Deno.version.deno` at `src/command/check/check.ts:274` with `runtime().version`; the row label is still `"Deno"` and the strict pin still `"2.7.14"` (line 305). `quarto check --output <file>` writes the label as a JSON key (`dependencies[name]`, lines 317-323).
- **Conda.** `package/conda-recipe/build.sh:5,27`, `bld.bat:3,24` export `QUARTO_DENO`; `meta.yaml` pins `deno` (`max_pin="x.x.x"`) and `deno-dom`.
- **Docs.** `llm-docs/code-signing-installers.md` describes signing `deno`; quarto.org documents `QUARTO_DENO*`.

Assumptions about earlier PRs:

- PR 33: launchers pass `--enable-experimental-regexp-engine --max-old-space-size=8192 --stack-trace-limit=100 --use-system-ca --use-env-proxy --disable-warning=MODULE_TYPELESS_PACKAGE_JSON`; `NODE_OPTIONS`/`NODE_PATH` saved as `QUARTO_SAVED_*` and restored by `src/core/runtime-env.ts`; `runtimeEnvWarnings()` covers `QUARTO_DENO*`; `tests/smoke/env/launcher-env.test.ts` and `tests/unit/runtime-env.test.ts` exist; `bin/tools/<arch>/deno` still ships (tool) until PR 37.
- PR 19: `runtime()` in `src/deno_ral/platform.ts` returns `{ name, version }` with `version` without a leading `v`.
- PR 28 + PR 14b: stdio is blocking on Node so `exit()` never truncates, and a broken pipe ends the process quietly with status 0 (vocabulary, `exit`); `tests/smoke/inspect/inspect-pipe.test.ts` exists.
- PR 20: `deno_dom` is gone from the signing lists and launchers.

### Scope

In:
- `package/scripts/macos/node-entitlements.plist` (new); `package/src/macos/installer.ts` signs `node` with it; a `create-release.yml` step that verifies the entitlements on the built tarball.
- `package/scripts/macos/distribution.xml`: `allowed-os-versions` 13.5. `package/src/linux/installer.ts`: `libc6 (>= 2.28)` (deb) and `glibc >= 2.28` (rpm) dependencies.
- `create-release.yml`: delete `make-tarball-rhel` and its references.
- `src/command/check/check.ts`: `Node.js` row and pin; `kPinnedBinaryVersions` exported; unit test against `configuration`.
- Conda recipe template: `nodejs` (exact pin), `QUARTO_NODE`; keeps `deno` for the tool until PR 37.
- The runtime environment contract table (below) and `tests/smoke/env/proxy.test.ts`.
- `llm-docs/code-signing-installers.md`, changelog, `dev-docs/runtime-migration/docs-updates.md`.

Out:
- The Rust launcher, launcher flags, `NODE_OPTIONS` handling, `QUARTO_DENO*` warnings (PR 33). `quarto run` (PR 35), `build-ts-extension` (PR 36), removing the Deno tool and `QUARTO_RUNTIME` (PR 37).
- Installer layout, install locations, MSI upgrade code.

### Runtime environment contract (review S6)

One row per environment variable, flag or process behaviour that changed at the flip. "Test" names the test that pins the row; "manual" rows cannot run in CI and list the exact manual check.

| # | Behaviour | Deno (≤ 1.11) | Node (1.12) | Implemented in | Test |
|---|---|---|---|---|---|
| 1 | `HTTP_PROXY`/`HTTPS_PROXY`/`NO_PROXY` for `fetch` (publish, `install`, `add`, `check`) | honoured | `--use-env-proxy` in every launcher | PR 33 | `tests/smoke/env/proxy.test.ts` (this PR) |
| 2 | stdout/stderr complete when piped and Quarto exits (`quarto inspect \| head`) | sync writes | the layer makes stdio blocking at load; `exit()` never truncates; EPIPE ends the process with status 0 | PR 28 | `tests/smoke/inspect/inspect-pipe.test.ts` (PR 14b) |
| 3 | `QUARTO_DENO` | CLI runtime binary; conda sets it | never the CLI runtime; locates the Deno tool; one warning when `QUARTO_NODE` is unset | PR 33 | `tests/unit/runtime-env.test.ts` |
| 4 | `QUARTO_DENO_OPTIONS`, `QUARTO_DENO_EXTRA_OPTIONS` | Deno flags | not passed to Node; one warning | PR 33 | `tests/smoke/env/launcher-env.test.ts` |
| 5 | `QUARTO_DENO_V8_OPTIONS` | `--v8-flags=` list | each flag passed to Node; deprecation warning | PR 33 | `tests/smoke/env/launcher-env.test.ts` |
| 6 | `NODE_OPTIONS`, `NODE_PATH` | not read | moved aside for Quarto's Node, restored for every child | PR 33 | `tests/smoke/env/launcher-env.test.ts` |
| 7 | `QUARTO_NODE`, `QUARTO_NODE_OPTIONS` | n/a | Node binary; extra flags after Quarto's | PR 33 | `tests/smoke/env/launcher-env.test.ts` (flags reach `node` under `QUARTO_LAUNCHER_DEBUG=1`) |
| 8 | `QUARTO_DENO_DIR`, `QUARTO_DENO_DOM`, `DENO_DIR` | Deno cache, deno_dom plugin | ignored by the CLI; warning for the two `QUARTO_` ones | PR 33 | `tests/unit/runtime-env.test.ts` |
| 9 | CA store (`DENO_TLS_CA_STORE=system,mozilla`) | set by launchers | `--use-system-ca`; `NODE_EXTRA_CA_CERTS` honoured | PR 33 | manual: on a machine with a corporate root CA in the OS store, `quarto add quarto-ext/fontawesome --no-prompt` behind the corporate TLS proxy succeeds |
| 10 | Cliffy prompts (`cbreak`, Ctrl-C) | raw mode with `cbreak` | `process.stdin.setRawMode`, no `cbreak` (Cliffy 1.3.1) | measured in Spike #2 | manual: `quarto create project` in a terminal, press Ctrl-C at the first prompt: exits with code 130 and restores the terminal (`stty -a` shows `icanon` on) |
| 11 | macOS hardened runtime | Deno signed with 2 keys | `node` signed with Node's keys minus `get-task-allow` | this PR | `create-release.yml` step "Verify node entitlements" (Task 1) |
| 12 | Minimum OS | Deno's | macOS 13.5, glibc 2.28, Windows 10 | this PR | `tests/unit/linux-installer-config.test.ts` (Task 2); macOS: manual `installer -pkg ... -target /` on macOS 12 refuses |
| 13 | `QUARTO_RUNTIME=node\|deno` | n/a | dual-runtime window (only if Spike #2 passed) | PR 33 Task 13 | `tests/smoke/env/launcher-env.test.ts` |
| 14 | `QUARTO_NODE_VERSION` (configure override) | `DENO_VERSION` | renamed from the proposed `NODE_VERSION` (Docker collision) | PR 33 | manual: `NODE_VERSION=26.12.0 ./configure.sh` downloads `$NODE` from `configuration`, no 404 |
| 15 | `QUARTO_TS_PROFILE` | `--inspect-brk` | unchanged | PR 33 | manual: `QUARTO_TS_PROFILE=1 quarto --help` waits for a debugger on 9229 |
| 16 | `NO_COLOR=TRUE` on Windows | set by launchers | unchanged | PR 33 | existing Windows smoke tests (colourless log assertions) |
| 17 | Process groups, signals (`quarto preview` Ctrl-C kills children) | `Deno.kill`; `taskkill /T` on Windows | layer `killProcess` (negative pid: group on POSIX, `taskkill /T` tree on Windows) | PR 28 | `tests/unit/process-group.test.ts` (PR 14b: POSIX group cases on Linux/macOS, the `taskkill /T` case on Windows; see its "Windows coverage" table for what has no Windows equivalent) and `tests/smoke/preview/preview-reload.test.ts`, `preview-project-reload.test.ts` (stop and port release on the three OSes) |

### Interfaces

```ts
// src/command/check/check.ts (exported for the unit test)
export const kPinnedBinaryVersions: {
  readonly pandoc: string;   // "3.10.0" (configuration PANDOC padded to three parts)
  readonly dartsass: string; // "1.101.0"
  readonly node: string;     // "26.12.0" (configuration NODE without "v")
  readonly typst: string;    // "0.15.1"
};
```

`quarto check versions` rows after this PR:

```
      Pandoc version 3.10.0: OK
      Dart Sass version 1.101.0: OK
      Node.js version 26.12.0: OK
      Typst version 0.15.1: OK
```

`quarto check --output file.json`: `dependencies["Node.js"]` replaces `dependencies["Deno"]` (the `"Deno"` key is gone, not kept as an alias, because it would report a Node version under a Deno label).

```ts
// package/src/linux/installer.ts
/** nfpm package dependencies per format (exported for the unit test). */
export function packageDependencies(format: "deb" | "rpm"): string[];
```

### Files

- Create: `package/scripts/macos/node-entitlements.plist`
- Modify: `package/src/macos/installer.ts` (the `node` entry PR 33 added: sign with the new plist)
- Modify: `package/scripts/macos/distribution.xml`
- Modify: `package/src/linux/installer.ts:73-103` (`packageDependencies`, `depends`)
- Modify: `.github/workflows/create-release.yml:207-256,612-615,660-666,711,729-732` (RHEL job) and the `test-zip-mac` job (entitlement check)
- Modify: `src/command/check/check.ts:298-307` (+ the exported constant)
- Modify: `package/conda-recipe/build.sh`, `package/conda-recipe/bld.bat`, `package/conda-recipe/meta.yaml`
- Modify: `llm-docs/code-signing-installers.md`, `news/changelog-1.12.md`
- Create: `dev-docs/runtime-migration/docs-updates.md`
- Test: `tests/unit/check-pinned-versions.test.ts`, `tests/unit/linux-installer-config.test.ts`, `tests/smoke/env/proxy.test.ts`

### Acceptance criteria

- `create-release.yml` dispatched with `publish-release=false`, `os=all`: every job green, including notarization (`make-installer-mac`), the new "Verify node entitlements" step and the Windows MSI; `test-smokes-built.yml` green on the artifacts.
- `codesign -d --entitlements - <bin>/tools/aarch64/node` on the built tarball lists exactly the five keys of `node-entitlements.plist`; `pandoc` still lists the two keys of `entitlements.plist`.
- The macOS pkg's `distribution.xml` contains `<os-version min="13.5"/>`; the deb declares `libc6 (>= 2.28)`, the rpm `glibc >= 2.28` (`dpkg-deb -f <deb> Depends`, `rpm -qpR <rpm>`).
- `quarto check versions` prints `Node.js version 26.12.0: OK` and no Deno row; `quarto check --strict versions` passes; `tests/smoke/check/check-versions-no-mismatch.test.ts` passes; `quarto check --output out.json` has `dependencies["Node.js"]` and no `dependencies["Deno"]`.
- `tests/smoke/env/proxy.test.ts` passes on the three OSes.
- `grep -n -i "rhel\|deno" .github/workflows/create-release.yml` shows only the `deno.exe` signing line PR 33 kept for the tool.

## Plan

### Task 1: Node's entitlements on macOS

**Files:**
- Create: `package/scripts/macos/node-entitlements.plist`
- Modify: `package/src/macos/installer.ts`, `.github/workflows/create-release.yml` (`test-zip-mac`)

- [ ] **Step 1: Re-read Node's plist for the pinned version**

Run: `curl -sS "https://raw.githubusercontent.com/nodejs/node/$(. ./configuration && echo $NODE)/tools/osx-entitlements.plist"`
Expected: the six keys listed in the Context. If the set differs, use the new set minus `com.apple.security.get-task-allow` in step 2 and note the difference in the PR description.

- [ ] **Step 2: `node-entitlements.plist`**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<!--
  Entitlements for bin/tools/<arch>/node: Node's own release entitlements
  (nodejs/node tools/osx-entitlements.plist) without get-task-allow, which
  only lets debuggers attach. disable-library-validation lets Node load
  native addons (.node) that are not signed by Posit.
-->
<plist version="1.0">
<dict>
	<key>com.apple.security.cs.allow-jit</key>
	<true/>
	<key>com.apple.security.cs.allow-unsigned-executable-memory</key>
	<true/>
	<key>com.apple.security.cs.disable-executable-page-protection</key>
	<true/>
	<key>com.apple.security.cs.allow-dyld-environment-variables</key>
	<true/>
	<key>com.apple.security.cs.disable-library-validation</key>
	<true/>
</dict>
</plist>
```

- [ ] **Step 3: Sign `node` with it**

In `package/src/macos/installer.ts`, after `const entitlements = join(...)` add:

```ts
    const nodeEntitlements = join(
      config.directoryInfo.pkg,
      "scripts",
      "macos",
      "node-entitlements.plist",
    );
```

remove the `node` push PR 33 added to `signWithEntitlements`, and add a third list signed after the loop:

```ts
    // Node gets Node's own entitlements (node-entitlements.plist)
    const signWithNodeEntitlements = ["aarch64", "x86_64"].map((arch) =>
      join(config.directoryInfo.pkgWorking.bin, "tools", arch, "node")
    );
    for (const fileToSign of signWithNodeEntitlements) {
      info(fileToSign);
      await signCode(applicationDevId, fileToSign, nodeEntitlements);
    }
```

- [ ] **Step 4: Verify in the release workflow**

In `.github/workflows/create-release.yml`, job `test-zip-mac`, after the `tar -zxf` step add:

```yaml
      - name: Verify node entitlements
        if: ${{ github.event_name != 'schedule' }}
        shell: bash
        run: |
          for arch in aarch64 x86_64; do
            ents=$(codesign -d --entitlements - --xml "bin/tools/$arch/node" 2>/dev/null)
            for key in allow-jit allow-unsigned-executable-memory disable-executable-page-protection allow-dyld-environment-variables disable-library-validation; do
              echo "$ents" | grep -q "com.apple.security.cs.$key" || { echo "::error::$arch/node lacks $key"; exit 1; }
            done
            if echo "$ents" | grep -q "get-task-allow"; then echo "::error::$arch/node has get-task-allow"; exit 1; fi
          done
          bin/tools/aarch64/node -e 'console.log("node runs under hardened runtime")'
```

(Scheduled builds skip signing, hence the `if`.)

- [ ] **Step 5: Commit**

```bash
git add package/scripts/macos/node-entitlements.plist package/src/macos/installer.ts .github/workflows/create-release.yml
git commit -m "macos: sign node with Node's release entitlements (minus get-task-allow) and verify them"
```

### Task 2: Platform minimums

**Files:**
- Modify: `package/scripts/macos/distribution.xml`, `package/src/linux/installer.ts`
- Test: `tests/unit/linux-installer-config.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
/*
 * linux-installer-config.test.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 */
import { unitTest } from "../test.ts";
import { assertEquals } from "../asserts.ts";
import { join } from "../../src/deno_ral/path.ts";
import { readTextFileSync } from "../../src/deno_ral/fs.ts";
import { env } from "../../src/deno_ral/env.ts";
import { packageDependencies } from "../../package/src/linux/installer.ts";

unitTest("linux installers require Node 26's glibc", () => {
  assertEquals(packageDependencies("deb"), ["libc6 (>= 2.28)"]);
  assertEquals(packageDependencies("rpm"), ["glibc >= 2.28"]);
});

unitTest("macOS pkg refuses macOS older than Node 26's minimum", () => {
  const xml = readTextFileSync(join(env.get("QUARTO_ROOT")!, "package", "scripts", "macos", "distribution.xml"));
  assertEquals(/<allowed-os-versions>\s*<os-version min="13\.5"\s*\/>\s*<\/allowed-os-versions>/.test(xml), true);
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/linux-installer-config.test.ts`
Expected: FAIL, `packageDependencies` is not exported.

- [ ] **Step 3: Implement**

`package/src/linux/installer.ts`, above `createNfpmConfig`:

```ts
// Node 26's official Linux binaries need glibc >= 2.28 (nodejs/node BUILDING.md).
export function packageDependencies(format: "deb" | "rpm"): string[] {
  return format === "deb" ? ["libc6 (>= 2.28)"] : ["glibc >= 2.28"];
}
```

and in the format-specific block: `config.overrides.deb = { recommends: ["unzip", "xz-utils"], depends: packageDependencies("deb") };` and `config.overrides.rpm = { recommends: ["xz"], depends: packageDependencies("rpm") };`.

`package/scripts/macos/distribution.xml`, after `<options hostArchitectures="arm64,x86_64" />`:

```xml
  <!-- Node 26 (bin/tools/<arch>/node) needs macOS 13.5 or newer -->
  <allowed-os-versions>
    <os-version min="13.5"/>
  </allowed-os-versions>
```

- [ ] **Step 4: Run and commit**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/linux-installer-config.test.ts`
Expected: `2 passed`.

```bash
git add package/src/linux/installer.ts package/scripts/macos/distribution.xml tests/unit/linux-installer-config.test.ts
git commit -m "installers: require macOS 13.5 and glibc 2.28 (Node 26 minimums)"
```

### Task 3: Remove the RHEL 7 tarball job

**Files:**
- Modify: `.github/workflows/create-release.yml`

- [ ] **Step 1: Delete the job and its references**

- Delete `make-tarball-rhel` (lines 207-256, from `  make-tarball-rhel:` through its `Upload Artifact` step).
- `publish-release` `needs:` (lines 612-615): remove the comment `# optional in release to not be blocked by RHEL build depending on conda-forge deno dependency` and the commented `# make-tarball-rhel,`.
- `Generate Checksums` (lines 660-666): remove the `if [ -f "RHEL Zip/..." ]` block.
- `Create Release` `files:` (line 711): remove the `RHEL Zip` line; keep `fail_on_unmatched_files: false` only if another optional artifact still needs it (`grep -n "fail_on_unmatched" .github/workflows/create-release.yml` and read the comment).
- `cleanup-when-failure` `needs:` (lines 729-732): remove the same comment and commented line.
- Lines 116-118 (`# TODO: uncomment this again if new issue with RHEL build`): delete the two comment lines.

Run: `grep -n -i "rhel" .github/workflows/create-release.yml`
Expected: no output.

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/create-release.yml
git commit -m "ci: drop the disabled RHEL 7 tarball job (Node 26 needs glibc 2.28)"
```

### Task 4: `quarto check` reports Node.js

**Files:**
- Modify: `src/command/check/check.ts:298-307`
- Test: `tests/unit/check-pinned-versions.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
/*
 * check-pinned-versions.test.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 */
import { unitTest } from "../test.ts";
import { assertEquals } from "../asserts.ts";
import { join } from "../../src/deno_ral/path.ts";
import { readTextFileSync } from "../../src/deno_ral/fs.ts";
import { env } from "../../src/deno_ral/env.ts";
import { kPinnedBinaryVersions } from "../../src/command/check/check.ts";

function configurationValue(key: string): string {
  const text = readTextFileSync(join(env.get("QUARTO_ROOT")!, "configuration"));
  const m = text.match(new RegExp(`^export ${key}=(\\S+)$`, "m"));
  if (!m) throw new Error(`${key} not found in configuration`);
  return m[1];
}

unitTest("quarto check pins match the configuration file", () => {
  assertEquals("v" + kPinnedBinaryVersions.node, configurationValue("NODE"));
  assertEquals(kPinnedBinaryVersions.dartsass, configurationValue("DARTSASS"));
  assertEquals(kPinnedBinaryVersions.typst, configurationValue("TYPST"));
  assertEquals(kPinnedBinaryVersions.pandoc.replace(/\.0$/, ""), configurationValue("PANDOC"));
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/check-pinned-versions.test.ts`
Expected: FAIL, `kPinnedBinaryVersions` is not exported.

- [ ] **Step 3: Implement**

PR 19 already changed line 274 to `const denoVersion = runtime().version;`. Rename the variable to `runtimeVersion` (two occurrences). Add after the imports:

```ts
// Versions of the bundled binaries, as in the `configuration` file at the
// repository root (not shipped). `quarto check --strict` requires an exact
// match; tests/unit/check-pinned-versions.test.ts keeps both in sync.
export const kPinnedBinaryVersions = {
  pandoc: "3.10.0",
  dartsass: "1.101.0",
  node: "26.12.0",
  typst: "0.15.1",
} as const;
```

Replace lines 298-307 (the `FIXME` comment and `versionConstraints`):

```ts
  const versionConstraints: [string | undefined, string, string][] = [
    [pandocVersion, kPinnedBinaryVersions.pandoc, "Pandoc"],
    [sassVersion, kPinnedBinaryVersions.dartsass, "Dart Sass"],
    [runtimeVersion, kPinnedBinaryVersions.node, "Node.js"],
    [typstVersion, kPinnedBinaryVersions.typst, "Typst"],
  ];
```

The `name` is both the text label and the JSON key, so `--output` now writes `"Node.js"`. Use the values in `configuration` when executing (the test enforces it).

- [ ] **Step 4: Run the tests**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/check-pinned-versions.test.ts smoke/check/check-versions-no-mismatch.test.ts smoke/check/check.test.ts`
Expected: all pass. Then `package/dist/bin/quarto check versions --output /tmp/c.json && node -e 'const d=require("/tmp/c.json").dependencies; console.log(Object.keys(d).join(","))'` prints `Pandoc,Dart Sass,Node.js,Typst` (order as `quarto check` writes it; `Deno` absent).

- [ ] **Step 5: Commit**

```bash
git add src/command/check/check.ts tests/unit/check-pinned-versions.test.ts
git commit -m "check: report and pin the Node.js runtime version"
```

### Task 5: Proxy end-to-end test (contract row 1)

**Files:**
- Test: `tests/smoke/env/proxy.test.ts`

- [ ] **Step 1: Write the test**

`quarto add <url>` fetches an arbitrary URL with `fetch` (`unknownUrlResolver` in `src/extension/extension-host.ts:266-279`); a plain-HTTP URL makes the proxy see the request in clear.

```ts
/*
 * proxy.test.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 *
 * Contract row 1: fetch honours HTTP_PROXY (launchers pass --use-env-proxy).
 */
import { assert, assertStringIncludes } from "../../asserts.ts";
import { execProcess } from "../../../src/core/process.ts";
import { quartoDevCmd } from "../../utils.ts";
import { quartoSpawnEnvOptions } from "../../quarto-cmd.ts";
import { unitTest } from "../../test.ts";
import { serveHttp } from "../../../src/deno_ral/http.ts";
import { makeTempDirSync } from "../../../src/deno_ral/temp.ts";
import { removeSync } from "../../../src/deno_ral/fs.ts";

unitTest("proxy - quarto add sends its request through HTTP_PROXY", async () => {
  const seen: string[] = [];
  // A forward proxy receives the absolute URL in the request line.
  const server = serveHttp({
    port: 0,
    hostname: "127.0.0.1",
    handler: (req) => {
      seen.push(req.url);
      return new Response("not found", { status: 404 });
    },
    onListen: () => {},
  });
  await server.listening;
  const dir = makeTempDirSync({ prefix: "proxy-test" });
  try {
    const proxy = `http://127.0.0.1:${server.addr.port}`;
    const r = await execProcess(
      {
        cmd: quartoDevCmd(),
        args: ["add", "http://quarto-proxy-test.invalid/ext.zip", "--no-prompt"],
        cwd: dir,
        stdout: "piped",
        stderr: "piped",
        ...quartoSpawnEnvOptions({ HTTP_PROXY: proxy, http_proxy: proxy, NO_PROXY: "", no_proxy: "" }),
      },
      undefined, undefined, undefined, true,
    );
    assert(!r.success, "the proxy answers 404, so quarto add must fail");
    assert(seen.length > 0, `the proxy saw no request; stderr: ${r.stderr}`);
    assertStringIncludes(seen[0], "quarto-proxy-test.invalid/ext.zip");
  } finally {
    await server.shutdown();
    removeSync(dir, { recursive: true });
  }
});
```

`serveHttp`, `listening` and `onListen` are the PR 16 vocabulary (`port: 0` binds an ephemeral port; `addr.port` is the bound one). If the server's request object carries only the path (`/ext.zip`), assert on `req.headers.get("host")` being `quarto-proxy-test.invalid` instead.

- [ ] **Step 2: Run it**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/env/proxy.test.ts`
Expected: `1 passed`. To see it fail, run once with `QUARTO_NODE_OPTIONS=--no-use-env-proxy` exported (the extra flag comes last and wins): `seen` stays empty and the DNS lookup of `quarto-proxy-test.invalid` fails instead.

- [ ] **Step 3: Commit**

```bash
git add tests/smoke/env/proxy.test.ts
git commit -m "tests: fetch goes through HTTP_PROXY (runtime contract row 1)"
```

### Task 6: Conda recipe template

**Files:**
- Modify: `package/conda-recipe/build.sh`, `package/conda-recipe/bld.bat`, `package/conda-recipe/meta.yaml`

The recipe keeps `deno` until PR 37: `quarto run` and `build-ts-extension` still need the Deno tool, and with `QUARTO_VENDOR_BINARIES=false` nothing downloads it. `QUARTO_DENO` therefore stays exported (it locates the tool); `QUARTO_NODE` is exported too, which also keeps PR 33's "`QUARTO_DENO` is ignored" warning quiet for conda users.

- [ ] **Step 1: `build.sh`**

- After line 5 (`export QUARTO_DENO=$PREFIX/bin/deno`) add `export QUARTO_NODE=$PREFIX/bin/node`. Delete line 6 (`QUARTO_DENO_DOM`) if PR 20 left it.
- In the activate heredoc add `  export QUARTO_NODE=$PREFIX/bin/node` after the `QUARTO_DENO` line; delete the `QUARTO_DENO_DOM` line.
- In the deactivate heredoc add `  unset QUARTO_NODE`; delete `unset QUARTO_DENO_DOM`.

- [ ] **Step 2: `bld.bat`**

- After line 3 add `SET QUARTO_NODE=%PREFIX%\node.exe` (conda-forge's `nodejs` installs `node.exe` at the environment root, not in `Library\bin`; confirm with `conda create -n t nodejs && dir %CONDA_PREFIX%\node.exe` before committing, and use the confirmed directory in all three places).
- Activate block: add `  echo SET "QUARTO_NODE=%PREFIX:\=/%\node.exe"`; delete the `QUARTO_DENO_DOM` line.
- Deactivate block: add `  echo SET QUARTO_NODE=`; delete `echo SET QUARTO_DENO_DOM=`.

- [ ] **Step 3: `meta.yaml`**

Replace the `deno_dom_version` line (line 3) with:

```yaml
{% set node_version = load_file_regex(load_file='./configuration', regex_pattern='export\sNODE=v(\S+)').group(1) %}
```

In `requirements.host` replace `- deno-dom  {{ deno_dom_version }}` with `- nodejs    {{ node_version }}`. In `run`, replace the `deno-dom` pin and its comment with:

```yaml
    # Exact pin, consistent with `quarto check --strict`, which requires the
    # Node.js version Quarto was built and tested with.
    - {{ pin_compatible("nodejs", max_pin="x.x.x") }}
```

and change the first comment of `run` to say `Deno (a tool for quarto run until Quarto 1.13), Node.js and pandoc`.

- [ ] **Step 4: Commit**

```bash
git add package/conda-recipe
git commit -m "packaging: conda recipe template adds nodejs (exact pin) and QUARTO_NODE"
```

The conda-forge feedstock (`conda-forge/quarto-feedstock`) is maintained outside this repository; open an issue there linking this PR when it merges.

### Task 7: Docs: signing notes, changelog, quarto.org checklist

**Files:**
- Modify: `llm-docs/code-signing-installers.md`, `news/changelog-1.12.md`
- Create: `dev-docs/runtime-migration/docs-updates.md`

- [ ] **Step 1: `llm-docs/code-signing-installers.md`**

Run `grep -n -i "deno\|entitlements" llm-docs/code-signing-installers.md` and update each hit: the per-arch binaries signed with entitlements are `node` (with `node-entitlements.plist`, five keys, listed) and `pandoc`/`esbuild`/`typst`/`dart` (with `entitlements.plist`, two keys); `deno` is still signed with `entitlements.plist` while it ships as a tool (until PR 37); the Windows `sign-files` list has `node.exe` and `deno.exe`; `bin/package.json` is signed like `quarto.js`; `deno_dom` lines are deleted.

- [ ] **Step 2: Changelog**

In `news/changelog-1.12.md`:

Under `## Commands`, `### \`check\``:

```markdown
- ([#NNNNN](https://github.com/quarto-dev/quarto-cli/pull/NNNNN)): `quarto check` reports the bundled Node.js version. In `quarto check --output` JSON, the `dependencies` key `Deno` is renamed to `Node.js`.
```

Under `## Installation` (create it after `## Dependencies` if absent):

```markdown
- ([#NNNNN](https://github.com/quarto-dev/quarto-cli/pull/NNNNN)): Quarto now requires macOS 13.5 or newer, a Linux distribution with glibc 2.28 or newer (e.g. Ubuntu 20.04, Debian 10, RHEL 8), and Windows 10 or newer, the minimums of its bundled Node.js 26. The macOS installer and the deb/rpm packages check this at install time. The RHEL 7 tarball is no longer built.
```

- [ ] **Step 3: quarto.org checklist**

Create `dev-docs/runtime-migration/docs-updates.md`:

```markdown
# quarto.org pages to update for the Node runtime

The website lives in `quarto-dev/quarto-web`; open one PR there when PRs 33-36
of the runtime migration are merged. Page paths come from links in this
repository and from `https://quarto.org/llms.txt`; verify each before editing.
What is supported on Node, for which releases, with which author action,
fallback and retirement is stated once, in plan 35's Spec ("Supported
migration surface"); the two migration pages below publish its rows and the
other pages link to them rather than restate them.

| Page (`quarto-web/docs/...`) | What to change | Source PR |
|---|---|---|
| `advanced/environment-vars.qmd` | Replace the `QUARTO_DENO*` rows with `QUARTO_NODE`, `QUARTO_NODE_OPTIONS`; `QUARTO_DENO` now only locates the Deno tool; `QUARTO_DENO_OPTIONS`/`_EXTRA_OPTIONS`/`_DIR`/`_DOM` ignored with a warning; `QUARTO_DENO_V8_OPTIONS` deprecated; `NODE_OPTIONS`/`NODE_PATH` not applied to Quarto, passed to children; `HTTP(S)_PROXY`/`NO_PROXY` honoured; `QUARTO_RUNTIME` (only if the dual-runtime window shipped) | 33 |
| `get-started/installation.qmd`, download page | Minimum macOS 13.5, glibc 2.28, Windows 10; no RHEL 7 tarball | 34 |
| `troubleshooting/index.qmd` | Replace `QUARTO_DENO_V8_OPTIONS`/`DENO_DIR` advice with `QUARTO_NODE_OPTIONS`; corporate CA: OS store is used, `NODE_EXTRA_CA_CERTS` for extra CAs; proxies: `HTTPS_PROXY`/`NO_PROXY` | 33, 34 |
| `projects/scripts-deno-to-node.qmd` (created by PR 00c for 1.11) | Rows 4–6 of plan 35's supported migration surface matrix (plain scripts, `stdlib/*` scripts, Deno-native scripts); the "`stdlib/*` members not available on Node" table; the version rule for `npm:`/`jsr:` imports and the governing-lockfile table; the shim's member table and the `Deno.*` -> `node:` migration table; `QUARTO_RUN_RUNTIME=deno` / `project: script-runtime: deno` with `quarto install deno`; per-file TypeScript compile (`export type` for re-exported types); the 1.13 note | 35 |
| `projects/scripts.qmd` (`#deno-scripts`, `#periodic-scripts`) | Short "TypeScript scripts run on Node" section linking to `scripts-deno-to-node.qmd`; `Deno` shim and its notice | 35 |
| `extensions/engine.qmd` (or the page that documents `quarto call build-ts-extension`) | `package.json` `quarto.build` config; esbuild; the default import map on Node (`path`/`encoding` the JSR std packages, `log`/`fs` Node-compatible builds, `FileHandler`/`RotatingFileHandler` fail the build); engines use `QuartoAPI` and web standards; `#migrating-from-deno`: rows 2–3 of plan 35's matrix (prebuilt and rebuilt engines), the `Deno.*` -> `QuartoAPI`/web-standard table, the version rule and the engine rows of the governing-lockfile table; prebuilt bundles referencing `Deno.` are flagged at load; the `"type": "commonjs"` note | 36 |
| `prerelease/1.12/_highlights.qmd` | "Quarto now runs on Node.js" | 33 |
| `cli/check.qmd` (if it documents `--output`) | JSON key `Node.js` | 34 |
```

- [ ] **Step 4: Commit**

```bash
git add llm-docs/code-signing-installers.md news/changelog-1.12.md dev-docs/runtime-migration/docs-updates.md
git commit -m "docs: Node signing notes, platform minimums, check JSON key, quarto.org checklist"
```

## Verification

- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/check-pinned-versions.test.ts unit/linux-installer-config.test.ts unit/runtime-env.test.ts $(find smoke/env/ -name '*.test.ts') $(find smoke/check/ -name '*.test.ts')`: all pass.
- `quarto run --dev tools/check-runtime-boundary.ts`: unchanged counts.
- `cd package/src && ./quarto-bld prepare-dist --set-version 99.9.9 && ./quarto-bld make-installer-deb --set-version 99.9.9 && dpkg-deb -f ../out/quarto-99.9.9-linux-amd64.deb Depends` prints `libc6 (>= 2.28)`.
- Dispatch `create-release.yml` with `publish-release=false`, `pre-release=true`, `os=all`: all jobs green; `test-smokes-built.yml` on the artifacts green (see `.claude/rules/testing/built-version-ci.md`).
- On an Apple Silicon Mac with the built pkg: `codesign -d --entitlements - /Applications/quarto/bin/tools/aarch64/node` lists the five keys.

## Review checklist

- [ ] `node-entitlements.plist` equals Node's plist for the pinned version minus `get-task-allow`; the PR description shows the `curl` of step 1; `entitlements.plist` is unchanged for the other binaries.
- [ ] `distribution.xml` has `allowed-os-versions` 13.5; deb/rpm `depends` set; tests pass.
- [ ] `create-release.yml` has no `rhel`; `needs` and `files` lists consistent.
- [ ] `check.ts`: no `Deno` label, JSON key `Node.js`, pins equal `configuration` (unit test); the changelog names the key rename.
- [ ] Conda: `nodejs` pinned `x.x.x`, `QUARTO_NODE` exported, `deno` and `QUARTO_DENO` kept (tool) with a note that PR 37 removes them.
- [ ] The contract table has a test or an exact manual check for every row.

## Risks and rollback

- **Notarization rejects the new entitlements.** Symptom: `Notarization was not accepted (status: Invalid)` naming `tools/<arch>/node`. Apple accepts all five keys for Developer ID (Node's own notarized pkg carries them); if one is rejected, drop it, keep `allow-jit`, `allow-unsigned-executable-memory`, `disable-library-validation`, and record it. Rollback: revert Task 1 (node falls back to PR 33's two-key signing).
- **Intel macOS becomes an untested Node platform in early 2028** (`BUILDING.md` footnote 8). Quarto's `darwin-x64` build then runs on binaries Node no longer tests; keep the macOS x64 smoke job in CI and decide at that point whether 1.13+ keeps the Intel pkg.
- **Users on macOS 12 or glibc < 2.28 lose updates.** The installer now says so at install time instead of failing at run time; the changelog and installation page state the minimums. Those users stay on Quarto 1.11 (Deno).
- **Readers of `quarto check --output` that look for `"Deno"`** (none found in `quarto-dev` repositories by `grep`; RStudio and Positron read `quarto --version`) get no runtime entry. The changelog line names the rename.
- **Rollback:** revert the PR; PR 33's installers keep working (two-key signing, no OS gate). The release-level rules (prerelease soak and promotion criteria, revert by default for a P1 in the layer, what the runtime switches are for, returning to 1.11) are PR 33's, "Risks and rollback", "Rollout and rollback after the flip"; this PR supplies the `quarto check` evidence that rule 1 needs.

## Decisions needed

1. Not changed because PR 19 already did it: the review's "Task 4 edits `check.ts:274` which PR 25 removed". This plan only renames the label and the pin.
2. Not changed: packagers who relied on `QUARTO_DENO` selecting the CLI runtime (the old plan's "packagers keep working" claim was wrong). PR 33 never aliases it; packagers set `QUARTO_NODE`; the conda template does both during the transition.
3. Deprecation window for `QUARTO_DENO_V8_OPTIONS`: translated in 1.12 with a warning; removal in 1.13 (recommended). Decide when PR 37 lands.
4. **Performance release blockers** (triage A11, review decision 8; open, maintainer). The triage recommends the baseline set: cold and warm CLI startup, one book render, one website render, a preview reload and peak RSS, Windows included, with thresholds set in this PR before anything is measured. This plan has no performance task yet: once A11 is decided, the baseline and thresholds become a task here (measured against 1.11 on the same machine, as part of the prerelease soak PR 33's "Rollout and rollback after the flip" describes). Until then no performance gate blocks a release, and the PR description says so. Whoever executes this PR checks `TRIAGE-2026-10-16.md` A11 first.
