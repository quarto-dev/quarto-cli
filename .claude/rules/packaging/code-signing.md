---
paths:
  - "package/src/macos/installer.ts"
  - "package/src/windows/installer.ts"
  - "package/scripts/macos/entitlements.plist"
  - "package/scripts/macos/distribution.xml"
  - ".github/workflows/create-release.yml"
  - ".github/workflows/actions/keychain/action.yml"
  - ".github/workflows/actions/sign-files/action.yml"
---

# Code Signing for Installers

For how release installers get signed and notarized on macOS and Windows (Gatekeeper, SmartScreen, and the keychain/signing actions in `create-release.yml`), see `llm-docs/code-signing-installers.md`.
