Change version numbers in `./configuration` to correspond to new versions.

Update hardcoded version strings in `src/command/check/check.ts` (`versionConstraints` array, ~line 249) so that they match the new versions in `configuration`. The `configuration` file warns about this in a comment.

## Verify installer signing & notarization before merging (bundled binaries)

Regular CI does **not** build, sign, or notarize the installers — that only happens in `create-release.yml`. A bundled binary bump (Deno, Pandoc, Dart Sass, Typst, esbuild, …) can change what the platform code-signing/notarization steps must cover, so a bump that passes normal CI can still break the macOS/Windows release build. **Before merging any PR that bumps a bundled binary**, dispatch the release workflow on the PR branch without publishing and confirm the installer jobs pass:

```bash
gh workflow run create-release.yml --repo quarto-dev/quarto-cli --ref <branch> -f publish-release=false
# then watch make-installer-mac and make-installer-win in the resulting run
```

Why this bites (real incident, #14664): Dart Sass 1.101.0 changed its macOS AOT snapshot (`dart-sass/src/sass.snapshot`) container from ELF to Mach-O. Apple's notary ignores non-native files but requires every Mach-O signed, so the never-signed snapshot flipped notarization from Accepted to Invalid — invisible to normal CI, only caught at release time. When a bump does require a new signing entry, add it in `package/src/macos/installer.ts` / the Windows `sign-files` paths; see `llm-docs/code-signing-installers.md`.

## Upgrade deno

### Upgrade standard library

- run `./configure.sh` (Linux/macOS) or `./configure.cmd` (Windows) to locally install all dependencies against the new Deno binary.

- `src/import_map.json` has migrated to JSR (`jsr:/@std/<package>@<version>` entries). If `configure` errors with `Module not found: jsr:/@std/...`, bump only the specific `@std` package(s) named in the error to a compatible version on <https://jsr.io/@std>. Otherwise, leave `src/import_map.json` alone — historical pattern is reactive (no pre-emptive bumps).

- run `./configure.sh` / `./configure.cmd` again.

Bumping a version in `src/import_map.json` (or any of the other keyed files) automatically invalidates the CI Deno cache on next run. See [ci-deno-caching.md](ci-deno-caching.md) for the key composition and how to force invalidation manually.

### Upgrade Deno download link for RHEL build from conda-forge

- Go to <https://anaconda.org/conda-forge/deno/files> and find the version of Deno required.
  - BTW those versions are built at <https://github.com/conda-forge/deno-feedstock>
- Take the hash part of the download link for linux-64 (e.g. `hcab8b69_0` for `linux-64/deno-1.46.3-hcab8b69_0.conda`)
- Use it in the build release action: `.github\workflows\create-release.yml` at the step `- name: Move Custom Deno`. The hash appears in **three places** inside that step (echo line, curl line, tar line). All three must be updated.
  ```
  echo Placing custom Deno ${DENO:1}. See available versions at https://anaconda.org/conda-forge/deno/files hcab8b69_0
  curl -L https://anaconda.org/conda-forge/deno/${DENO:1}/download/linux-64/deno-${DENO:1}-hcab8b69_0.conda --output deno.conda
  unzip deno.conda
  tar --use-compress-program=unzstd -xvf pkg-deno-${DENO:1}-hcab8b69_0.tar.zst
  ```
- The `make-tarball-rhel` job that wraps these steps may carry `if: false` for unrelated reasons; the hash is updated for forward consistency even while the job is disabled.
- Commit the `create-release.yml`

## Upgrade mermaidjs

Apparently mermaidjs doesn't actually build mermaid in their releases :shrug:.
They also don't appear to offer any clear documentation on how to do it, and `npm install` from their `packages/mermaidjs` directory just fails.

So, we grab the published javascript bundles from unpkg.com.

For version 11.2.0, for example, these are:

- https://unpkg.com/mermaid@11.2.0/dist/mermaid.js
- https://unpkg.com/mermaid@11.2.0/dist/mermaid.min.js

Copy these files to `src/resources/formats/html/mermaid`.
