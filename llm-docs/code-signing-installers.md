---
main_commit: a8d0dcfee
analyzed_date: 2026-05-19
key_files:
  - package/src/macos/installer.ts
  - package/src/windows/installer.ts
  - package/scripts/macos/entitlements.plist
  - package/scripts/macos/distribution.xml
  - .github/workflows/create-release.yml
  - .github/workflows/actions/keychain/action.yml
  - .github/workflows/actions/sign-files/action.yml
---

# Code Signing for Quarto Installers

How release installers get signed and (on macOS) notarized in the `Build Installers` workflow. Covers macOS first, then Windows. Both pipelines run from `create-release.yml`.

Signing happens only on official releases — local `quarto-bld` builds skip it when the relevant env vars / secrets are absent (macOS prints `warning: Missing Application Developer Id, not signing`; Windows step is gated by repo secrets that only the Apple keychain action and DigiCert smctl can resolve).

## Why sign?

- **macOS Gatekeeper** refuses to launch unsigned/un-notarized binaries downloaded from the internet (quarantine bit).
- **Windows SmartScreen / Defender** treats unsigned `.exe`/`.msi` as untrusted; signed binaries with a reputable EV/OV cert get past warnings.
- Both stores require the binaries inside the bundle to be signed individually, not just the wrapper installer.

---

## macOS

### Identities involved

Two Apple Developer ID certs live in the build keychain as `.p12` files:

| Cert                     | Purpose                                                        | Tool that uses it |
| ------------------------ | -------------------------------------------------------------- | ----------------- |
| Developer ID Application | Sign individual executables (Mach-O binaries, dylibs, scripts) | `codesign`        |
| Developer ID Installer   | Sign the `.pkg` (`productsign`)                                | `productsign`     |

After signing, the `.pkg` is submitted to Apple's notary service. Notarization is an out-of-band check Apple performs on the bundle; once approved, the result is **stapled** onto the `.pkg` so offline machines also see it as valid.

### Secrets → env vars → purpose

GitHub repo secrets shown in the screenshot map as follows. `_P12` / `_PW` feed the keychain action; `_ID` / `_CONNECT_*` feed the bld step.

| Secret                 | Used in                      | Resolved to                     | Used for                                  |
| ---------------------- | ---------------------------- | ------------------------------- | ----------------------------------------- |
| `APPLE_SIGN_P12`       | `actions/keychain` step 1    | `certificate.p12`               | Application cert (base64-encoded)         |
| `APPLE_SIGN_PW`        | `actions/keychain` step 1    | keychain `-P` import password   | Decrypt the Application `.p12`            |
| `APPLE_INSTALLER_P12`  | `actions/keychain` step 2    | `installer.p12`                 | Installer cert (base64-encoded)           |
| `APPLE_INSTALLER_PW`   | `actions/keychain` step 2    | keychain `-P` import password   | Decrypt the Installer `.p12`              |
| `APPLE_KEYCHAIN_PW`    | both keychain steps          | keychain create/unlock password | Per-runner ephemeral keychain             |
| `APPLE_SIGN_ID`        | `make-installer-mac` env     | `QUARTO_APPLE_APP_DEV_ID`       | `codesign -s <id>` identity string        |
| `APPLE_INSTALLER_ID`   | `make-installer-mac` env     | `QUARTO_APPLE_INST_DEV_ID`      | `productsign --sign <id>` identity string |
| `APPLE_CONNECT_UN`     | `make-installer-mac` env     | `QUARTO_APPLE_CONNECT_UN`       | Apple ID for `notarytool`                 |
| `APPLE_CONNECT_PW`     | `make-installer-mac` env     | `QUARTO_APPLE_CONNECT_PW`       | App-specific password for `notarytool`    |
| `APPLE_CONNECT_TEAMID` | `make-installer-mac` env     | `QUARTO_APPLE_CONNECT_TEAMID`   | Team ID for `notarytool`                  |
| `APPLE_SIGN_CERT`      | (not referenced in workflow) | —                               | Legacy; kept for historical recovery      |

The `_ID` values are the **certificate "Common Name" strings** (e.g. `Developer ID Application: Posit Software, PBC (XXXXXXXX)`), not file paths. `codesign` looks them up in the keychain by name.

Note: **Team ID is public information** — stamped into every signed `.pkg` and visible via `pkgutil --check-signature` on any released binary. Storing it as a GitHub secret (`APPLE_CONNECT_TEAMID`) only causes `(***)` masking in CI logs that obscures debugging. Future maintainers can safely hardcode it in the workflow YAML instead.

### Keychain setup — `.github/workflows/actions/keychain`

Composite action invoked twice in `make-installer-mac` — once per cert. For each invocation it:

1. Base64-decodes the cert secret into a temporary `.p12` file.
2. Creates the `build.keychain` if missing (`security create-keychain`), adds it to the search list, and makes it default.
3. Unlocks with `APPLE_KEYCHAIN_PW`, sets a 2-hour relock timeout.
4. Imports the `.p12` with `-T /usr/bin/productsign -T /usr/bin/codesign` (only those two tools allowed to use the key).
5. Runs `security set-key-partition-list` so non-interactive shells can use the key without GUI prompts.
6. Wipes the on-disk `.p12` / `.cer` files.

Both certs land in the same keychain. The keychain is deleted in the `Cleanup Keychain` step at the end of the job (`if: always()`).

### Signing flow — `package/src/macos/installer.ts`

Entry: `makeInstallerMac(config)` (`package/src/macos/installer.ts:30`). Wired into `quarto-bld make-installer-mac` via `package/src/bld.ts:92`.

Sequence:

1. **Decide whether to sign** — reads `QUARTO_APPLE_APP_DEV_ID`. Empty → skip everything below with a warning.
2. **Sign individual binaries** with `codesign` (via `signCode()` at `package/src/macos/installer.ts:293`). Two lists:
   - **With entitlements** (`entitlements.plist`): per-arch `deno`, `dart-sass/src/dart`, `esbuild`, `pandoc`, `typst`, optional `typst-gather`, optional `deno_dom/libplugin.dylib`. Entitlements grant JIT (`com.apple.security.cs.allow-jit`) and unsigned-executable-memory (`com.apple.security.cs.allow-unsigned-executable-memory`) — required by Deno's V8 and by the other JIT-using tools.
   - **Without entitlements**: shell wrappers, JS bundle, and the Dart Sass AOT snapshot — `quarto`, `quarto.js`, `dart-sass/sass`, `dart-sass/src/sass.snapshot`. The snapshot is a Mach-O loaded by the (entitled) `dart` VM, not its own process, so it needs a valid signature + secure timestamp but no entitlements. See the notarization-Invalid troubleshooting below for why it must be signed.
   - `codesign` invocation: `-s <id> --timestamp --options=runtime --force --deep --verbose=4` (`+ --entitlements <plist>` for the first list). `--options=runtime` opts into Hardened Runtime, a notarization prerequisite.
3. **Build the tarball** (`quarto-<v>-macos.tar.gz`) from the signed `pkg-working` tree. The tarball ships unwrapped binaries with the signatures embedded — no `.pkg`, no notarization, but each Mach-O is signed individually.
4. **Build the core `.pkg`** with `pkgbuild` (identifier `org.rstudio.quarto`), then sign it via `productsign --sign <installer-id> --timestamp` (function `signPackage()` at `package/src/macos/installer.ts:282`). Renames signed output back over the original. Note: the `pkgbuild` invocation passes `--install-location` twice (`/Library/Quarto` then `/Applications/quarto`); CLI argv semantics mean the later flag wins, so the effective install location is `/Applications/quarto`. The earlier `/Library/Quarto` value is dead and should be cleaned up next time the file is touched.
5. **Wrap with `productbuild`** using `distribution.xml` (in `package/scripts/macos/`) to produce the user-facing `quarto-<v>-macos.pkg`. The distribution XML restricts host architectures to `arm64,x86_64` and disables customization. The wrapped `.pkg` is signed again with `productsign`.
6. **Notarize** the wrapped `.pkg` (`notarizeAndWait()` at `package/src/macos/installer.ts:325`):
   ```
   xcrun notarytool submit --apple-id <un> --password <pw> --team-id <team> <pkg> --wait
   ```
   The `--wait` flag makes the call block until Apple returns `Accepted` / `Invalid`. Submission ID is parsed from stdout via `/id: (.*)/`.
7. **Staple** the notarization ticket (`stapleNotary()` at `package/src/macos/installer.ts:422`):
   ```
   xcrun stapler staple <pkg>
   ```
   After this, the `.pkg` itself contains the notarization receipt; Gatekeeper validates offline.

### Troubleshooting: notarization 403 "required agreement... has expired"

Symptom: `xcrun notarytool submit` exits with `Status 1` and stderr containing:

```text
ERROR: Error: HTTP status code: 403. A required agreement is missing or has expired. This request requires an in-effect agreement that has not been signed or has expired. Ensure your team has signed the necessary legal agreements and that they are not expired.
```

**This is not a credential issue.** None of the `APPLE_*` GitHub secrets need rotation — certs, app-specific password, Apple ID, Team ID are all still valid. The 403 comes from Apple's notary service rejecting submissions because the Apple Developer Program License Agreement (PLA) for the team has been updated and not yet re-accepted. Apple updates the PLA periodically; until the team's Account Holder accepts the new terms, every notarization 403s with this exact text.

Fix:

1. Identify the team's Account Holder — only that role can accept the PLA (not Admin, not Developer). Check at <https://developer.apple.com/account> → Membership.
2. Account Holder logs into <https://developer.apple.com/account> and accepts the PLA banner at the top of the page.
3. Re-run the failed workflow. No code or secret change required.

If the Account Holder is unreachable (departed staff, etc.):

- **Org enrollment**: a current Admin can be promoted to Account Holder by Apple support — the team itself persists across personnel changes.
- **Individual enrollment**: the team IS the person — cannot be transferred. The only path is migrating Quarto's signing to a different team (re-issuing both certs under that team and rotating all `APPLE_*` secrets).

Determining which type the current signing team uses: inspect any past released `.pkg` from a non-CI environment (CI logs mask the Team ID portion of cert Common Names). On a Mac, `pkgutil --check-signature quarto-X.Y.Z-macos.pkg` shows the full chain. On Linux/WSL, the `.pkg` is a xar archive — its TOC contains base64-encoded X.509 certs that can be extracted with Python's stdlib and parsed with `openssl x509`. The cert subject's `O = ...` field is a company name for org enrollment, a person name for individual enrollment.

### Troubleshooting: notarization Invalid "Archive contains critical validation errors"

Symptom: `notarizeAndWait()` throws `Notarization was not accepted (status: Invalid)`, and the dumped `xcrun notarytool log <id>` lists per-file `issues` such as:

```text
"The binary is not signed with a valid Developer ID certificate."
"The signature does not include a secure timestamp."
```

Root cause: the named file is a Mach-O binary inside the bundle that no `codesign` call covered. Every native Mach-O in the payload must be individually signed (with `--timestamp`); Apple's notary rejects the whole submission if any is unsigned. Fix: add the file to `signWithEntitlements` (if it JITs / is a directly-executed hardened-runtime process) or `signWithoutEntitlements` (data-like code loaded by another signed process) in `package/src/macos/installer.ts`, then re-run the release build.

This is easy to miss because a bundled binary can *change format across a version bump*. Concrete case (#14664): Dart Sass `src/sass.snapshot` shipped as an **ELF** blob through 1.87.0 — Apple's notary ignored it (not native code), so it was never signed and notarization passed for years. Dart Sass 1.101.0 switched the macOS AOT snapshot to a native **Mach-O** (`cf fa ed fe`), which the notary then required signed; the never-signed snapshot flipped the result to Invalid. Diagnosing this depended on the terminal-status check in `notarizeAndWait()` — `notarytool submit --wait` had exited 0, so an exit-code-only check would (and previously did) mask the rejection and proceed to `stapler staple`, whose downstream "CloudKit … Record not found" error is a misleading symptom of the missing ticket, not a propagation race.

Prevention: dispatch `create-release.yml` (publish-release=false) on the branch before merging any bundled-binary bump — see `dev-docs/upgrade-dependencies.md`.

### Historical: `waitForNotaryStatus` / `altool` (candidate for removal)

`waitForNotaryStatus()` at `package/src/macos/installer.ts:360` is **dead code** — defined and never called. Kept here so we have enough context to decide whether to delete it next time the file is touched.

**What it did:** before `notarytool`, notarization was a two-call dance:

1. `xcrun altool --notarize-app …` → returns a request UUID immediately.
2. `xcrun altool --notarization-info <uuid> …` → polled until status moved off `in progress`.

`waitForNotaryStatus()` implements step 2: 15-second poll interval, 20-minute total ceiling, 5 consecutive errors before giving up. Matched a now-removed companion submit function.

**Why it's dead:** `notarizeAndWait()` (used today) calls `xcrun notarytool submit … --wait`, which blocks until Apple returns a terminal status. `notarytool` made the polling helper redundant in a single call. The `requestId` returned by `notarizeAndWait()` is also never used by the caller — `makeInstallerMac` stores it in `const requestId = …` and then immediately moves on to `stapleNotary(packagePath)`. So the whole "submit → poll" pattern collapsed into one synchronous call.

**Why Apple forced it:** `altool` notarization endpoints were deprecated in Xcode 13 (2021) and the service was shut off on **Nov 1, 2023** — `altool --notarize-app` now errors regardless of credentials. Reviving `waitForNotaryStatus()` is not a viable fallback; the API behind it is gone.

**Other vestigial bits in the same file:**

- `sleepSync()` (`package/src/macos/installer.ts:276`) — `SharedArrayBuffer` + `Atomics.wait` polyfill for a removed Deno `sleepSync` API. Not called from anywhere either; was a helper for the same polling pattern.
- The TODO at the top of the file ("Could also consider moving the keychain work out of the github actions and into typescript") is unresolved but unrelated to the dead code.

**Recommendation:** safe to delete `waitForNotaryStatus()` and the local `sleepSync()` in `installer.ts` in a small cleanup PR. `waitForNotaryStatus()` has no callers anywhere in the repo, and the `sleepSync()` defined in this file is unused locally and not referenced elsewhere. (An unrelated `sleepSync()` helper also lives in `src/project/serve/serve.ts:888` — same `SharedArrayBuffer` + `Atomics.wait` polyfill, but it has its own caller at `serve.ts:908` and is independent of the installer's copy.) The `notarytool` path is the only supported Apple notarization API today; if it ever breaks, the fix is to update arguments, not to fall back to `altool`.

### What does NOT get signed on macOS

- The `.tar.gz` distribution itself (just an archive — the binaries inside are signed).
- The R / Python / Julia files shipped under `share/` (not Mach-O).
- The `quarto.js` bundle has a signature applied (without entitlements), but it runs through `deno`, so the signature is mostly for tamper-evidence rather than Gatekeeper enforcement.

---

## Windows

### Cert provider

Posit signs via **DigiCert ONE / KeyLocker** (cloud-held EV cert). Local CLI is `smctl` (Software Trust Manager CLI) plus the standard `signtool.exe` from the Windows 10 SDK / App Certification Kit. The private key never leaves DigiCert's HSM — `smctl windows certsync` syncs the public cert into the local Windows cert store so `signtool` can reference it by thumbprint.

### Secrets → env vars → purpose

| Secret                       | Env var on sign step      | Used for                                                                          |
| ---------------------------- | ------------------------- | --------------------------------------------------------------------------------- |
| `SM_HOST`                    | `SM_HOST`                 | DigiCert tenant host URL                                                          |
| `SM_API_KEY`                 | `SM_API_KEY`              | DigiCert API auth                                                                 |
| `SM_CLIENT_CERT_FILE_B64`    | `SM_CLIENT_CERT_FILE_B64` | Base64 of client auth PFX (decoded to `.build\certificates\codesign.pfx`)         |
| `SM_CLIENT_CERT_PASSWORD`    | `SM_CLIENT_CERT_PASSWORD` | PFX password                                                                      |
| `SM_CLIENT_CERT_FINGERPRINT` | `CERT_FINGERPRINT`        | SHA-1 thumbprint passed to `signtool /sha1` to select the cert in the local store |

### Signing flow — `.github/workflows/actions/sign-files`

Composite action invoked **twice** per release in `make-installer-win`:

1. **Before MSI build** — sign every binary that will be bundled by WiX:
   `quarto.exe` (launcher), `deno.exe`, `esbuild.exe`, `dart.exe`, `deno_dom/plugin.dll`, `typst-gather.exe`, `pandoc.exe`, plus the `quarto.js` bundle.
2. **After MSI build** — sign the resulting `quarto-<v>-win.msi`, passing `signtools-extra-args: /d "Quarto CLI"` so the SmartScreen / UAC prompt shows a friendly description.

Each invocation runs these steps (`.github/workflows/actions/sign-files/action.yml`):

1. **Setup client cert** — fail-fast if `SM_CLIENT_CERT_FILE_B64` missing; base64-decode into `.build\certificates\codesign.pfx` (cached across the second invocation).
2. **Install smctl** if absent — downloads `smtools-windows-x64.msi` from `rstudio-buildtools.s3.amazonaws.com` with retry-on-failure (transient S3 failures previously caused silent install failures); runs `msiexec /qn /log`; verifies `smctl.exe` is on disk; adds DigiCert install dir + Windows Kits App Certification Kit (signtool) to `PATH`.
3. **Verify all required env vars** are set, else fail with `::error`.
4. **`smctl windows certsync`** — pull the EV cert from DigiCert into the local Windows cert store.
5. **For each path** in the multi-line `paths:` input:
   ```
   signtool.exe sign /sha1 $CERT_FINGERPRINT \
     /tr http://timestamp.digicert.com /td SHA256 /fd SHA256 \
     <extra-args> <path>
   signtool.exe verify /v /pa <path>
   ```
   `/tr` adds an RFC 3161 timestamp (signature stays valid after cert expiry); `/fd SHA256` uses SHA-256 file digest; `/pa` verifies against the default authentication policy (the one SmartScreen uses).

Any single signing or verify failure fails the whole step.

### Windows launcher

`package/launcher/Cargo.toml` builds `quarto.exe` (Rust launcher) just before signing in `make-installer-win`. The Rust launcher is what the user actually runs; the underlying `quarto.cmd` / `deno` executes from inside the install dir. All of `quarto.exe`, `deno.exe`, and the bundled tools get signed individually so SmartScreen accepts the process tree, not just the MSI.

### No notarization on Windows

Microsoft has no equivalent of Apple's notary service — a valid Authenticode signature + SmartScreen reputation (built up over downloads/time) is the trust mechanism. An EV cert (which Posit uses) bypasses SmartScreen reputation accrual on day one.

---

## Cross-references

- `dev-docs/checklist-make-a-new-quarto-release.md` — release runbook (overall release process, not signing specifics).
- `package/src/bld.ts` — registration of `make-installer-mac` / `make-installer-win` commands.
- `.github/workflows/create-release.yml` — orchestrating workflow; jobs `make-installer-mac` and `make-installer-win` are the signing entry points.

## When to update this doc

Re-analyze when any of these change:

- Apple migrates off `notarytool` (rare).
- A new binary is added to the Mac bundle and needs a `signWithEntitlements` / `signWithoutEntitlements` entry in `package/src/macos/installer.ts`.
- A new binary is added to the Windows bundle and needs an entry in the `paths:` block of the `Sign files before making ZIP and MSI installer` step in `create-release.yml`.
- DigiCert KeyLocker is replaced (e.g. switch back to a local HSM or a different signing-as-a-service provider) — `sign-files/action.yml` and the `SM_*` secret set would change.
- `entitlements.plist` gains/loses entitlements (e.g. a new JIT-using tool, hardened-runtime exception).
