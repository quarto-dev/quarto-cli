# PR 34: Installers ship Node, Rust launcher, `quarto check` runtime row, env var aliases, docs

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every installer (deb, rpm, tarball, pkg, msi, zip) ships and launches the Node binary, `quarto.exe` spawns `node`, `quarto check` reports and strictly checks the pinned Node version, the `QUARTO_DENO*` aliases print a one-time deprecation notice, and the documentation lists what changed.
**Phase:** 3. **Depends on:** PR 33. **Unblocks:** PR 37 (CI switch assumes installers work on Node).
**Branch:** `rt/34-installers-and-check`.
**Suggested executor:** Opus. A Rust launcher change, three installer pipelines with signing/notarization, and user-facing wording need judgement; the TypeScript is small.
**Size:** M (about 18 files: `main.rs`, `create-release.yml`, `check.ts`, a new `runtime-env.ts`, conda recipe, `llm-docs/code-signing-installers.md`, changelog, tests, docs list).
**Ships on:** Node (PR 33 flipped). The PR 32 Node matrix and `create-release.yml` (dispatched with `publish-release=false`) are the gates.

## Spec

### Context

Assessment sections 3.6 (distribution and packaging) and 6 (operators and CI, packagers) and Phase 3 step 5. PR 33 put `node` into `package/dist` and `pkg-working`, taught the shell launchers to start it, and swapped the two binary names in the signing lists so nightly builds keep working. What is left for a Node-based prerelease to be installable everywhere:

- The Rust launcher `package/launcher/src/main.rs` (shipped as `quarto.exe` on Windows; built on every platform) still spawns `deno run ... quarto.js` with Deno flags (lines 50-113).
- `create-release.yml` still has the disabled `make-tarball-rhel` job that downloads a conda-forge Deno (lines 207-256) and lists `RHEL Zip` in the publish step (lines 613, 711, 730).
- `src/command/check/check.ts:274,305` reads `Deno.version.deno` and pins `2.7.14`.
- Nothing prints a deprecation notice when a `QUARTO_DENO*` variable is set; PR 33's launchers honour the aliases silently.
- The conda recipe template in `package/conda-recipe/` names `deno` and `deno-dom`.
- `llm-docs/code-signing-installers.md` describes signing `deno`.
- quarto.org documents `quarto run` scripts as Deno scripts and the `QUARTO_DENO*` variables.

Linux deb/rpm (`package/src/linux/installer.ts`, `package/scripts/linux/*/postinst`), the macOS pkg scripts (`package/scripts/macos/pkg/postinstall`, `distribution.xml`) and the Windows WiX sources (`package/src/windows/quarto.wxs`, `installer.ts`) contain nothing runtime-specific: they copy `bin/` and `share/` trees and symlink `pandoc`. They need no change beyond what `prepare-dist` already puts into `pkg-working` (verified by reading each file; the review checklist asks the reviewer to confirm).

macOS signing and notarization (from `llm-docs/code-signing-installers.md` and `package/src/macos/installer.ts:69-164`): every Mach-O in the payload is signed individually with `--options=runtime --timestamp`; binaries that JIT get `entitlements.plist` (`com.apple.security.cs.allow-jit`, `com.apple.security.cs.allow-unsigned-executable-memory`). Node's V8 JIT needs exactly those two entitlements, so the entry PR 33 added for `tools/<arch>/node` in `signWithEntitlements` is complete. The official Node binaries arrive signed by the OpenJS Foundation; `codesign --force` replaces that signature with Posit's Developer ID, which is what Deno's binaries also went through. Windows: `sign-files` signs `node.exe` with `smctl` (PR 33 swapped the path); no notarization exists on Windows.

Assumptions about earlier PRs:

- PR 19 added `runtime(): { name: "deno" | "node" | "bun"; version: string }` to `src/deno_ral/platform.ts`, where `version` has no leading `v` (`process.versions.node`).
- PR 14 added `env` to `src/deno_ral/env.ts`; PR 22 routed `semver/mod.ts` through `src/deno_ral/semver.ts` (if `check.ts` still imports `semver/mod.ts` directly, keep that import; the ratchet decides).
- PR 20 removed `QUARTO_DENO_DOM`/`DENO_DOM_PLUGIN` from the launchers and `main.rs`. The `main.rs` rewrite below starts from the file as it is on `main` and deletes those lines if still present.

### Scope

In:
- `package/launcher/src/main.rs`: spawn `node`, Quarto's flags, `QUARTO_NODE` with `QUARTO_DENO` alias, `QUARTO_NODE_OPTIONS` with the three `QUARTO_DENO*` aliases, remove `NODE_OPTIONS`/`NODE_PATH`.
- `.github/workflows/create-release.yml`: delete `make-tarball-rhel` and its references.
- `src/command/check/check.ts`: Node.js row, pinned constant exported, unit test against `configuration`.
- `src/core/runtime-env.ts` (new): one-time deprecation warning for `QUARTO_DENO*`; called from `src/quarto.ts`.
- `tests/binary-mode-strip-env.txt`: add `QUARTO_NODE`, `QUARTO_NODE_OPTIONS`.
- `package/conda-recipe/*`: `nodejs` instead of `deno`/`deno-dom`.
- `llm-docs/code-signing-installers.md`: Node wording.
- `news/changelog-1.11.md`: `quarto check` JSON key change, deprecation notice.
- A `dev-docs/runtime-migration/docs-updates.md` checklist of quarto.org pages to change (the website lives in `quarto-dev/quarto-web`; this PR cannot edit it).

Out:
- `quarto run` behaviour (PR 35). `build-ts-extension` (PR 36). Removing the `DENO` field and the Deno test-runner branch (PR 37). `tinitex` packaging (PR 39).
- Changing installer layout, install locations, or the MSI upgrade code.

### Interfaces

```ts
// src/core/runtime-env.ts
/**
 * Deprecated environment variables from the Deno years and their replacement.
 * The launchers (package/scripts/common/quarto, quarto.cmd, quarto.exe) still
 * honour the first four as aliases in 1.11; the last two are ignored.
 */
export const kDeprecatedRuntimeEnv: ReadonlyArray<{ name: string; replacement: string | null }>;

/** Messages for every deprecated variable present in `env`. Pure; unit tested. */
export function deprecatedRuntimeEnvMessages(env: Record<string, string | undefined>): string[];

/** Print each message once per process through warnOnce. Called from src/quarto.ts. */
export function warnDeprecatedRuntimeEnv(): void;
```

```ts
// src/command/check/check.ts (exported for the unit test)
export const kPinnedBinaryVersions: {
  readonly pandoc: string;   // "3.10.0"
  readonly dartsass: string; // "1.101.0"
  readonly node: string;     // "26.12.0"
  readonly typst: string;    // "0.15.1"
};
```

`quarto check versions` output rows after this PR:

```
      Pandoc version 3.10.0: OK
      Dart Sass version 1.101.0: OK
      Node.js version 26.12.0: OK
      Typst version 0.15.1: OK
```

JSON (`quarto check --output file.json`): `dependencies["Node.js"]` replaces `dependencies["Deno"]`.

Rust launcher command line (installed Quarto on Windows, and on macOS/Linux when `quarto.exe`-style launcher is used by RStudio builds):

```
node --enable-experimental-regexp-engine --max-old-space-size=8192 --stack-trace-limit=100 --use-system-ca [QUARTO_NODE_OPTIONS...] <bin>/quarto.js <args...>
```

with `QUARTO_NODE`, `QUARTO_BIN_PATH`, `QUARTO_SHARE_PATH` set in the child environment and `NODE_OPTIONS`, `NODE_PATH` removed. `NO_COLOR=TRUE` on Windows stays.

### Files

- Modify: `package/launcher/src/main.rs` (whole file)
- Modify: `.github/workflows/create-release.yml:207-256,607-620,696-721,724-735` (RHEL job and references)
- Modify: `src/command/check/check.ts:274,302-307`
- Create: `src/core/runtime-env.ts`
- Modify: `src/quarto.ts` (call `warnDeprecatedRuntimeEnv()` right after `checkReconfiguration`)
- Modify: `tests/binary-mode-strip-env.txt`
- Modify: `package/conda-recipe/build.sh:5-6,27-28,38-39`, `package/conda-recipe/bld.bat:3,24-25,34-35`, `package/conda-recipe/meta.yaml:2-3,18-19,23-32`
- Modify: `llm-docs/code-signing-installers.md:84,165,192,226`
- Modify: `news/changelog-1.11.md`
- Create: `dev-docs/runtime-migration/docs-updates.md`
- Test: `tests/unit/runtime-env.test.ts`, `tests/unit/check-pinned-versions.test.ts`

### Acceptance criteria

- `cargo build --release --manifest-path package/launcher/Cargo.toml` succeeds on Linux, macOS and Windows; `package/launcher/target/release/quarto --paths` run from a `pkg-working/bin` copy prints the bin and share dirs; `... --version` prints the version file; `... render <doc>` renders with `node` as the child process (`ps`/Task Manager shows `node`, no `deno`).
- `create-release.yml` dispatched with `publish-release=false` succeeds on all platforms; the Windows zip test job (`test-zip-win`) and the macOS tarball test job pass; the MSI installs and `quarto check` runs from a fresh Windows VM or the `test-smokes-built.yml` Windows leg.
- `quarto check versions` prints a `Node.js version 26.12.0: OK` row and no `Deno` row; `quarto check --strict versions` reports no mismatch; `tests/smoke/check/check-versions-no-mismatch.test.ts` passes.
- `QUARTO_DENO_V8_OPTIONS=--stack-trace-limit=50 quarto --help` prints exactly one `WARNING: QUARTO_DENO_V8_OPTIONS is deprecated ...` line (on stderr, before the help) and still works.
- `QUARTO_DENO_DIR=/tmp quarto --help` prints the "ignored" variant of the warning.
- No warning is printed when none of the variables is set.
- `grep -n -i deno package/launcher/src/main.rs .github/workflows/create-release.yml package/conda-recipe/*` shows only the alias handling in `main.rs`.

## Plan

### Task 1: Rust launcher spawns Node

**Files:**
- Modify: `package/launcher/src/main.rs`

- [ ] **Step 1: Rewrite `main.rs`**

```rust
use std::process::Command;
use std::{env, ffi::OsString, fs, path::Path, path::PathBuf};

fn main() {
    // compute executable path (resolving symlinks)
    let mut exe_file: PathBuf = env::current_exe().expect("failed to get exe path");
    let exe_metadata = fs::symlink_metadata(exe_file.as_path())
        .expect("failed to get symlink metadata for exe path");
    if exe_metadata.is_symlink() {
        exe_file =
            fs::read_link(exe_file.as_path()).expect("failed to canonicalize executable path");
    }

    // compute bin_dir and share_dir (share_dir may be provided externally)
    let bin_dir = exe_file
        .parent()
        .expect("failed to get executable parent")
        .to_path_buf();
    let mut share_dir = path_from_env("QUARTO_SHARE_PATH");
    if share_dir.as_os_str().is_empty() {
        share_dir = share_dir_from_bin_dir(&bin_dir);
    }

    // some other file paths
    let js_file = bin_dir.join(Path::new("quarto.js"));

    // get command line args (skip first which is the program)
    let args: Vec<OsString> = env::args_os().skip(1).collect();

    // handle no args at all
    if args.is_empty() {
        std::process::exit(0);
    }

    // handle --version
    if &args[0] == "--version" || &args[0] == "-v" {
        let version_path = share_dir.join("version");
        let version = fs::read_to_string(version_path).expect("failed to read version");
        println!("{}", version);
        std::process::exit(0);
    }

    // handle --paths
    if &args[0] == "--paths" {
        println!("{}\n{}", bin_dir.display(), share_dir.display());
        std::process::exit(0);
    }

    // compute the node location (allow it to be defined externally).
    // QUARTO_DENO is accepted as an alias of QUARTO_NODE for one release (1.11);
    // quarto.js prints the deprecation notice.
    let mut node_file = path_from_env("QUARTO_NODE");
    if node_file.as_os_str().is_empty() {
        node_file = path_from_env("QUARTO_DENO");
    }
    if node_file.as_os_str().is_empty() {
        node_file = bin_dir
            .join("tools")
            .join(arch_dir())
            .join(NODE_BINARY);
    }

    // set environment variables required by quarto.js
    std::env::set_var("QUARTO_NODE", &node_file);
    std::env::set_var("QUARTO_BIN_PATH", &bin_dir);
    std::env::set_var("QUARTO_SHARE_PATH", &share_dir);

    // a user's Node setup must not change Quarto's runtime: NODE_OPTIONS would
    // be prepended to our flags and NODE_PATH would shadow bundled modules
    std::env::remove_var("NODE_OPTIONS");
    std::env::remove_var("NODE_PATH");

    // windows-specific env vars
    #[cfg(target_os = "windows")]
    std::env::set_var("NO_COLOR", std::ffi::OsStr::new("TRUE"));

    // Quarto's own node options.
    // --enable-experimental-regexp-engine is required for /regex/l, https://github.com/quarto-dev/quarto-cli/issues/9737
    // --use-system-ca replaces DENO_TLS_CA_STORE=system,mozilla
    let mut node_options: Vec<String> = vec![
        String::from("--enable-experimental-regexp-engine"),
        String::from("--max-old-space-size=8192"),
        String::from("--stack-trace-limit=100"),
        String::from("--use-system-ca"),
    ];

    // QUARTO_NODE_OPTIONS: space separated extra flags
    if let Ok(extra) = env::var("QUARTO_NODE_OPTIONS") {
        node_options.extend(extra.split_whitespace().map(String::from));
    }
    // Aliases kept for one release. The V8 variable was comma separated for deno's --v8-flags=.
    if let Ok(v8) = env::var("QUARTO_DENO_V8_OPTIONS") {
        node_options.extend(v8.split(',').filter(|s| !s.is_empty()).map(String::from));
    }
    for name in ["QUARTO_DENO_OPTIONS", "QUARTO_DENO_EXTRA_OPTIONS"] {
        if let Ok(extra) = env::var(name) {
            node_options.extend(extra.split_whitespace().map(String::from));
        }
    }

    // run node
    let mut child = Command::new(&node_file)
        .args(node_options)
        .arg(js_file)
        .args(args)
        .spawn()
        .expect("failed to run node");

    // forward exit status
    let status = child.wait().expect("failed to wait on node");
    if status.success() {
        std::process::exit(0)
    } else {
        match status.code() {
            Some(code) => std::process::exit(code),
            // errors reaping the status code have been observed
            // (see https://github.com/quarto-dev/quarto-cli/issues/2296)
            // so in that return a normal exit status -- need further
            // investigation to figure out if there is more to do here
            None => std::process::exit(0),
        }
    }
}

// return a PathBuf for an environment variable using os encoding
// (return empty string if the variable is not found)
fn path_from_env(key: &str) -> PathBuf {
    PathBuf::from(env::var_os(key).unwrap_or(OsString::new()))
}

fn share_dir_from_bin_dir(bin_dir: &PathBuf) -> PathBuf {
    // if quarto is bundled into an `.app` file (e.g. RStudio) it will be
    // looking for the share directory over in the resources folder.
    if bin_dir.ends_with("Contents/MacOS/quarto/bin") {
        bin_dir
            .parent()
            .expect("failed to get bin_dir parent")
            .parent()
            .expect("failed to get bin_dir parent")
            .parent()
            .expect("failed to get bin_dir parent")
            .join("Resources")
            .join("quarto")
            .join("share")
    // if using standard linux filesystem local bin folder then
    // look for 'share' in the right place
    } else if bin_dir.ends_with("usr/local/bin/quarto") {
        bin_dir
            .parent()
            .expect("failed to get bin_dir parent")
            .parent()
            .expect("failed to get bin_dir parent")
            .join("share")
            .join("quarto")
    } else {
        bin_dir
            .parent()
            .expect("failed to get bin path parent")
            .join("share")
    }
}

// tools/<arch> directory holding the runtime. Windows builds are x64 only.
fn arch_dir() -> &'static str {
    if cfg!(target_os = "windows") {
        return "x86_64";
    }
    match arch_string().as_str() {
        s if s.starts_with("Darwin arm64") => "aarch64",
        s if s.starts_with("Darwin x86_64") => "x86_64",
        s if s.starts_with("Linux aarch64") => "aarch64",
        _ => "x86_64",
    }
}

// returns a string describing the architecture. only works on Unix
fn arch_string() -> String {
    let out = Command::new("uname")
        .args(["-sm"])
        .output()
        .expect("Failed to run uname")
        .stdout;
    String::from_utf8(out).expect("Couldn't convert to string")
}

#[cfg(target_os = "windows")]
const NODE_BINARY: &str = "node.exe";

#[cfg(not(target_os = "windows"))]
const NODE_BINARY: &str = "node";
```

The `Linux aarch64` arm was a `TODO` in the Deno version; adding it makes the launcher usable for Linux arm64 tarballs if a downstream packager uses it.

- [ ] **Step 2: Build and try it against a prepared distribution**

Run:
```bash
cargo build --release --manifest-path package/launcher/Cargo.toml
cd package/src && ./quarto-bld prepare-dist --set-version 99.9.9 > /dev/null && cd ../..
cp package/launcher/target/release/quarto package/pkg-working/bin/quarto-launcher
package/pkg-working/bin/quarto-launcher --paths
package/pkg-working/bin/quarto-launcher --version
NODE_OPTIONS=--bogus QUARTO_DENO_V8_OPTIONS=--stack-trace-limit=50 package/pkg-working/bin/quarto-launcher check versions
```
Expected: two paths; `99.9.9`; `quarto check versions` runs (the bogus `NODE_OPTIONS` is dropped; after Task 3 the deprecation warning for `QUARTO_DENO_V8_OPTIONS` appears first). On macOS `uname -sm` gives `Darwin arm64`; verify the `tools/aarch64/node` path is used by running with a missing binary and reading the panic message.

- [ ] **Step 3: Commit**

```bash
git add package/launcher/src/main.rs
git commit -m "launcher: spawn node with Quarto's flags and env var aliases"
```

### Task 2: Remove the RHEL tarball job

**Files:**
- Modify: `.github/workflows/create-release.yml`

- [ ] **Step 1: Delete the job and its references**

Delete the `make-tarball-rhel` job (lines 207-256, from `  make-tarball-rhel:` to the end of its `Upload Artifact` step). Then:

- In `publish-release`'s `needs:` list (around line 607-620) remove `make-tarball-rhel` and the comment `# optional in release to not be blocked by RHEL build depending on conda-forge deno dependency`.
- In `Generate Checksums` (lines 661-665) remove the `if [ -f "RHEL Zip/..." ]` block.
- In the `files:` list of `Create Release` (line 711) remove `./RHEL Zip/quarto-${{needs.configure.outputs.version}}-linux-rhel7-amd64.tar.gz`.
- In the `cleanup`/failure job `needs:` (around line 724-735) remove `make-tarball-rhel` and the duplicate comment.

Run: `grep -n -i "rhel\|deno" .github/workflows/create-release.yml`
Expected: no output.

Node 26's official Linux binaries require glibc 2.28 (RHEL 8+), so a RHEL 7 build cannot be produced from the official binary; RHEL 7 reached end of maintenance in June 2024. Mention this in the PR description.

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/create-release.yml
git commit -m "ci: drop the RHEL 7 tarball job (Node 26 needs glibc 2.28; job was disabled)"
```

### Task 3: One-time deprecation notice for `QUARTO_DENO*`

**Files:**
- Create: `src/core/runtime-env.ts`
- Modify: `src/quarto.ts`
- Modify: `tests/binary-mode-strip-env.txt`
- Test: `tests/unit/runtime-env.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
/*
 * runtime-env.test.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 */
import { unitTest } from "../test.ts";
import { assertEquals, assertStringIncludes } from "../asserts.ts";
import { deprecatedRuntimeEnvMessages } from "../../src/core/runtime-env.ts";

unitTest("runtime-env - no messages when nothing deprecated is set", () => {
  assertEquals(deprecatedRuntimeEnvMessages({ QUARTO_NODE: "/x/node", PATH: "/bin" }), []);
});

unitTest("runtime-env - aliases name their replacement", () => {
  const msgs = deprecatedRuntimeEnvMessages({
    QUARTO_DENO: "/opt/deno",
    QUARTO_DENO_V8_OPTIONS: "--stack-trace-limit=50",
  });
  assertEquals(msgs.length, 2);
  assertStringIncludes(msgs[0], "QUARTO_DENO is deprecated");
  assertStringIncludes(msgs[0], "QUARTO_NODE");
  assertStringIncludes(msgs[1], "QUARTO_DENO_V8_OPTIONS is deprecated");
  assertStringIncludes(msgs[1], "QUARTO_NODE_OPTIONS");
  assertStringIncludes(msgs[1], "space-separated");
});

unitTest("runtime-env - ignored variables say so", () => {
  const msgs = deprecatedRuntimeEnvMessages({ QUARTO_DENO_DIR: "/tmp", QUARTO_DENO_DOM: "/x.so" });
  assertEquals(msgs.length, 2);
  assertStringIncludes(msgs[0], "QUARTO_DENO_DIR is ignored");
  assertStringIncludes(msgs[1], "QUARTO_DENO_DOM is ignored");
});

unitTest("runtime-env - empty values do not count as set", () => {
  assertEquals(deprecatedRuntimeEnvMessages({ QUARTO_DENO: "" }), []);
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/runtime-env.test.ts`
Expected: FAIL, module `src/core/runtime-env.ts` not found.

- [ ] **Step 3: Implement `runtime-env.ts`**

```ts
/*
 * runtime-env.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 *
 * Deprecated environment variables from the Deno runtime (Quarto <= 1.10).
 * The launchers still honour the aliases in 1.11; they are removed in 1.12.
 */

import { env } from "../deno_ral/env.ts";
import { warnOnce } from "./log.ts";

const kDocsUrl = "https://quarto.org/docs/advanced/environment-vars.html";

export const kDeprecatedRuntimeEnv: ReadonlyArray<
  { name: string; replacement: string | null; note?: string }
> = [
  { name: "QUARTO_DENO", replacement: "QUARTO_NODE" },
  { name: "QUARTO_DENO_OPTIONS", replacement: "QUARTO_NODE_OPTIONS" },
  { name: "QUARTO_DENO_EXTRA_OPTIONS", replacement: "QUARTO_NODE_OPTIONS" },
  {
    name: "QUARTO_DENO_V8_OPTIONS",
    replacement: "QUARTO_NODE_OPTIONS",
    note: "V8 flags are now space-separated, e.g. QUARTO_NODE_OPTIONS=\"--stack-trace-limit=200\"",
  },
  { name: "QUARTO_DENO_DIR", replacement: null },
  { name: "QUARTO_DENO_DOM", replacement: null },
];

export function deprecatedRuntimeEnvMessages(
  environment: Record<string, string | undefined>,
): string[] {
  const messages: string[] = [];
  for (const entry of kDeprecatedRuntimeEnv) {
    const value = environment[entry.name];
    if (value === undefined || value === "") {
      continue;
    }
    if (entry.replacement) {
      messages.push(
        `${entry.name} is deprecated and will be removed in Quarto 1.12; use ${entry.replacement} instead.` +
          (entry.note ? ` ${entry.note}.` : "") +
          ` See ${kDocsUrl}`,
      );
    } else {
      messages.push(
        `${entry.name} is ignored: Quarto runs on Node.js and has no equivalent setting. See ${kDocsUrl}`,
      );
    }
  }
  return messages;
}

export function warnDeprecatedRuntimeEnv() {
  for (const message of deprecatedRuntimeEnvMessages(env.toObject())) {
    warnOnce(message);
  }
}
```

- [ ] **Step 4: Call it at startup**

In `src/quarto.ts`, import `warnDeprecatedRuntimeEnv` from `./core/runtime-env.ts` and call it as the first statement inside the main runner callback, after `checkReconfiguration()` runs (search for `await checkReconfiguration();` in the `mainRunner` body near the bottom of the file and add `warnDeprecatedRuntimeEnv();` on the next line). The logger is initialised by `mainRunner` before the callback, so `warnOnce` goes to the configured log.

- [ ] **Step 5: Strip the new variables in binary-mode tests**

Append to the "Dev-tree pointers" block of `tests/binary-mode-strip-env.txt`:

```
QUARTO_NODE
QUARTO_NODE_OPTIONS
```

Keep `QUARTO_DENO`, `QUARTO_DENO_DOM`, `DENO_DIR` in the list until PR 37 (a developer's shell may still export them).

- [ ] **Step 6: Run the tests**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/runtime-env.test.ts unit/binary-mode-strip-env.test.ts`
Expected: all pass. Then `QUARTO_DENO_DIR=/tmp package/dist/bin/quarto --help 2>&1 | head -2` prints `WARNING: QUARTO_DENO_DIR is ignored: ...` once.

- [ ] **Step 7: Commit**

```bash
git add src/core/runtime-env.ts src/quarto.ts tests/unit/runtime-env.test.ts tests/binary-mode-strip-env.txt
git commit -m "runtime: one-time deprecation notice for QUARTO_DENO* environment variables"
```

### Task 4: `quarto check` reports Node.js

**Files:**
- Modify: `src/command/check/check.ts:274,302-307`
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
  // pandoc is padded to three components by check.ts
  assertEquals(kPinnedBinaryVersions.pandoc.replace(/\.0$/, ""), configurationValue("PANDOC"));
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/check-pinned-versions.test.ts`
Expected: FAIL, `kPinnedBinaryVersions` is not exported.

- [ ] **Step 3: Implement**

In `src/command/check/check.ts`:

Replace line 274 (`const denoVersion = Deno.version.deno;`):

```ts
  const nodeVersion = runtime().version;
```

and add `import { runtime } from "../../deno_ral/platform.ts";` (merge into the existing `platform.ts` import on line 32).

Replace lines 298-307 (the `FIXME` comment and `versionConstraints`):

```ts
  const versionConstraints: [string | undefined, string, string][] = [
    [pandocVersion, kPinnedBinaryVersions.pandoc, "Pandoc"],
    [sassVersion, kPinnedBinaryVersions.dartsass, "Dart Sass"],
    [nodeVersion, kPinnedBinaryVersions.node, "Node.js"],
    [typstVersion, kPinnedBinaryVersions.typst, "Typst"],
  ];
```

Add near the top of the file (after the imports):

```ts
// Versions of the bundled binaries, as in the `configuration` file at the
// repository root (which is not shipped). `quarto check --strict` requires an
// exact match; tests/unit/check-pinned-versions.test.ts keeps both in sync.
export const kPinnedBinaryVersions = {
  pandoc: "3.10.0",
  dartsass: "1.101.0",
  node: "26.12.0",
  typst: "0.15.1",
} as const;
```

- [ ] **Step 4: Run the tests**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/check-pinned-versions.test.ts smoke/check/check-versions-no-mismatch.test.ts smoke/check/check.test.ts`
Expected: all pass; `package/dist/bin/quarto check versions` prints the `Node.js version 26.12.0: OK` row.

- [ ] **Step 5: Commit**

```bash
git add src/command/check/check.ts tests/unit/check-pinned-versions.test.ts
git commit -m "check: report and pin the Node.js runtime version"
```

### Task 5: Conda recipe template

**Files:**
- Modify: `package/conda-recipe/build.sh`, `package/conda-recipe/bld.bat`, `package/conda-recipe/meta.yaml`

- [ ] **Step 1: `build.sh`**

Replace lines 5-6 with `export QUARTO_NODE=$PREFIX/bin/node`, lines 27-28 (inside the activate heredoc) with `  export QUARTO_NODE=$PREFIX/bin/node`, and lines 38-39 (deactivate) with `  unset QUARTO_NODE`.

- [ ] **Step 2: `bld.bat`**

Replace line 3 with `SET QUARTO_NODE=%LIBRARY_BIN%\node.exe`, lines 24-25 with `  echo SET "QUARTO_NODE=%LIBRARY_BIN:\=/%\node.exe"`, lines 34-35 with `  echo SET QUARTO_NODE=`.

- [ ] **Step 3: `meta.yaml`**

Replace lines 2-3 with:

```yaml
{% set node_version = load_file_regex(load_file='./configuration', regex_pattern='export\sNODE=v(\S+)').group(1) %}
```

Replace the `deno`/`deno-dom` entries in `requirements.build`/`host` (lines 18-19) with `    - nodejs      {{ node_version }}` and the `run` pins (lines 28-32) with `    - {{ pin_compatible("nodejs", max_pin="x") }}` plus the comment `# Node.js major versions are ABI-stable for Quarto's bundle; any 26.x works.` Remove the `deno-dom` comment block (lines 30-32).

The conda-forge feedstock (`conda-forge/quarto-feedstock`) is maintained outside this repository; open an issue there linking this PR when it merges.

- [ ] **Step 4: Commit**

```bash
git add package/conda-recipe
git commit -m "packaging: conda recipe template uses nodejs"
```

### Task 6: Docs: signing doc, changelog, quarto.org checklist

**Files:**
- Modify: `llm-docs/code-signing-installers.md:84,165,192,226`
- Modify: `news/changelog-1.11.md`
- Create: `dev-docs/runtime-migration/docs-updates.md`

- [ ] **Step 1: `llm-docs/code-signing-installers.md`**

- Line 84: replace `per-arch \`deno\`` with `per-arch \`node\`` and `required by Deno's V8` with `required by Node's V8`.
- Line 165: replace `but it runs through \`deno\`` with `but it runs through \`node\``.
- Line 192: replace `\`deno.exe\`` with `\`node.exe\`` and delete `\`deno_dom/plugin.dll\`,`.
- Line 226: replace `the underlying \`quarto.cmd\` / \`deno\` executes` with `the underlying \`node\` executes`, and `All of \`quarto.exe\`, \`deno.exe\`` with `All of \`quarto.exe\`, \`node.exe\``.

Run: `grep -n -i deno llm-docs/code-signing-installers.md` -> no output.

- [ ] **Step 2: Changelog**

Under `## Commands` add `### \`check\`` (keep H3 ordering alphabetical within the section if others exist):

```markdown
- ([#NNNNN](https://github.com/quarto-dev/quarto-cli/pull/NNNNN)): `quarto check` reports the bundled Node.js version (the `Deno` row is gone; the JSON output key is `Node.js`).
```

Under `## Other fixes and improvements`:

```markdown
- ([#NNNNN](https://github.com/quarto-dev/quarto-cli/pull/NNNNN)): Setting `QUARTO_DENO`, `QUARTO_DENO_OPTIONS`, `QUARTO_DENO_EXTRA_OPTIONS` or `QUARTO_DENO_V8_OPTIONS` prints a one-time deprecation notice; they are removed in Quarto 1.12. `QUARTO_DENO_DIR` and `QUARTO_DENO_DOM` are ignored with a notice.
```

- [ ] **Step 3: quarto.org checklist**

Create `dev-docs/runtime-migration/docs-updates.md`:

```markdown
# quarto.org pages to update for the Node runtime

The website lives in `quarto-dev/quarto-web`. Open one PR there when PR 34 and
PR 35 of the runtime migration are merged. `quarto.org` could not be fetched
from the sandbox that wrote this list, so the page names below come from the
links in this repository (`news/changelog-1.6.md` links
`docs/projects/scripts.html#deno-scripts`; `src/command/run/run.ts` links
`docs/projects/scripts.html#periodic-scripts`) and from memory of the site map.
Verify each path against `https://quarto.org/llms.txt` before editing.

| Page (`quarto-web/docs/...`) | What to change |
|---|---|
| `projects/scripts.qmd` (`#deno-scripts`, `#periodic-scripts`) | Rename the section to "TypeScript scripts". `quarto run` runs `.ts` on Node.js: `process`, `node:fs`, npm packages from the project's `node_modules`; `stdlib/*` imports keep working; the `Deno` global is a compatibility shim that prints a notice (PR 35 wording); `quarto install deno` for scripts that need real Deno; deprecation timeline (1.11 shim, 1.12 removal). |
| `extensions/engine.qmd` (or wherever `quarto call build-ts-extension` is documented; check `extensions/` and `prerelease/1.9/`) | `package.json` replaces `deno.json`; esbuild bundling; engines use the `QuartoAPI` object and web standards, no `Deno.*` (PR 36 wording). |
| `get-started/installation.qmd` and the download page notes | Installer contents: the bundled runtime is Node.js; nothing to install separately. |
| `troubleshooting/index.qmd` | Replace any `QUARTO_DENO_V8_OPTIONS` / `DENO_DIR` advice; add the npm proxy note for `./configure.sh` (developers). |
| `advanced/environment-vars.qmd` | Replace the `QUARTO_DENO*` rows with `QUARTO_NODE`, `QUARTO_NODE_OPTIONS`; note `NODE_OPTIONS`/`NODE_PATH` are not inherited. |
| `prerelease/1.11/_highlights.qmd` | One highlight: "Quarto now runs on Node.js". |
| `docs/download/` installer tables | No change unless the RHEL 7 tarball row exists; remove it. |

Repository docs updated by the plans themselves: `dev-docs/upgrade-dependencies.md` (PR 33), `llm-docs/code-signing-installers.md` (PR 34), `.claude/CLAUDE.md`, `.claude/rules/typescript/*`, `tests/README.md`, `dev-docs/ci-deno-caching.md`, `dev-docs/update-deno_jsonc.md`, `dev-docs/add-typescript-dependency.md` (PR 37), `src/resources/create/extensions/engine/README.ejs.md` and `packages/quarto-types/README.md` (PR 36).
```

- [ ] **Step 4: Commit**

```bash
git add llm-docs/code-signing-installers.md news/changelog-1.11.md dev-docs/runtime-migration/docs-updates.md
git commit -m "docs: Node runtime in signing notes, changelog, and quarto.org checklist"
```

## Verification

- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/runtime-env.test.ts unit/check-pinned-versions.test.ts unit/binary-mode-strip-env.test.ts smoke/check/`: all pass.
- `quarto run --dev tools/check-runtime-boundary.ts`: unchanged counts.
- `cargo build --release --manifest-path package/launcher/Cargo.toml` on the local OS; `package/launcher/target/release/quarto --paths` from a `pkg-working/bin` copy.
- Dispatch `create-release.yml` with `publish-release=false`, `pre-release=true`, `os=all`: all jobs green; download the Windows zip and run `quarto.exe check` on a Windows machine (or let `test-smokes-built.yml` run on the artifacts: see `.claude/rules/testing/built-version-ci.md`).
- `package/dist/bin/quarto --paths` prints the same two lines as before PR 33 (`quarto-dev` action's sanity check also asserts this).
- `grep -rn "Deno.version" src` -> no output.

## Review checklist

- [ ] `main.rs`: `NODE_OPTIONS` and `NODE_PATH` removed before spawn; `QUARTO_DENO` only used when `QUARTO_NODE` is unset; V8 alias split on commas, other aliases on whitespace; no `DENO_*` env set.
- [ ] `create-release.yml` has no `rhel`, `deno`, `conda` references; `publish-release` `needs` list and `files` list are consistent with the remaining jobs.
- [ ] Linux `installer.ts`, `postinst`/`postrm`, macOS `distribution.xml`/`postinstall`, Windows `quarto.wxs`/`installer.ts` were read and need no change (they copy trees and symlink `pandoc`).
- [ ] `check.ts` pins equal `configuration` (unit test) and the JSON key is `Node.js`.
- [ ] The deprecation notice is printed once per process, names the replacement, and does not fire for empty values.
- [ ] `tests/binary-mode-strip-env.txt` strips `QUARTO_NODE*` and still strips `QUARTO_DENO*`.
- [ ] `docs-updates.md` lists every page that mentions Deno that the reviewer knows of; add missing ones in review.

## Risks and rollback

- **Notarization rejects the Node binary.** Symptom: `Notarization was not accepted (status: Invalid)` with an issue naming `tools/<arch>/node`. Cause would be a missing entitlement or signature; the `signWithEntitlements` entry covers it, and `node --version` from the signed binary must still run (a broken signature kills the process with `Killed: 9`). Rollback: revert PR 33 and 34 together.
- **SmartScreen on Windows.** `node.exe` is signed with Posit's EV certificate like `deno.exe` was; no new reputation needed.
- **Downstream packagers** (Homebrew, conda-forge, Positron, RStudio) read `QUARTO_DENO` in their wrappers. The alias keeps them working for 1.11; the deprecation notice tells them what to change. Rollback is the same revert.
- **`arch_dir()` on Linux arm64 tarballs** now resolves `aarch64`; previously the launcher was Windows-only in practice. If a packager relied on the old `x86_64` fallback on arm64 (unlikely: the binary would not run), they set `QUARTO_NODE`.

## Decisions needed

1. **Deprecation window for the `QUARTO_DENO*` aliases: one release (remove in 1.12, recommended) or two.** The assessment proposes one release; the aliases are shell-only and cheap to keep, so extending costs little if users ask.
2. **Keep the RHEL 7 tarball by building from Node's "unofficial builds" (`unofficial-builds.nodejs.org`, glibc 2.17 variants)?** Recommendation: no; the job has been disabled for a long time and RHEL 7 is out of maintenance. Revisit only on user demand.
