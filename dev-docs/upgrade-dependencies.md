Change version numbers in `./configuration` to correspond to new versions.

Contact JJ so he uploads the binaries to the S3 bucket.

## Upgrade deno

### Upgrade standard library

- run `./configure.sh` to locally install all dependencies.

- In `src/import_map.json`, change the version number of the imports like `https://deno.land/std@0.204.0/archive` to the new version number (e.g. `0.205.0`).

- run `./package/scripts/vendoring/vendor.sh`

### Upgrade Deno download link for RHEL build from conda-forge

- Go to <https://anaconda.org/conda-forge/deno/files> and find the version of Deno required.
  - BTW those versions are built at <https://github.com/conda-forge/deno-feedstock>
- Take the hash part of the download link for linux-64 (e.g. `hcab8b69_0` for `linux-64/deno-1.46.3-hcab8b69_0.conda`)
- Use it in the build release action: `.github\workflows\create-release.yml` at the step `- name: Move Custom Deno`
  ```
  echo Placing custom Deno ${DENO:1}. See available versions at https://anaconda.org/conda-forge/deno/files
  curl -L https://anaconda.org/conda-forge/deno/${DENO:1}/download/linux-64/deno-${DENO:1}-hcab8b69_0.conda --output deno.conda
  ```
- Commit the `create-release.yml`

## Upgrade mermaidjs

Apparently mermaidjs doesn't actually build mermaid in their releases :shrug:.
They also don't appear to offer any clear documentation on how to do it, and `npm install` from their `packages/mermaidjs` directory just fails.

So, we grab the published javascript bundles from unpkg.com.

For version 11.2.0, for example, these are:

- https://unpkg.com/mermaid@11.2.0/dist/mermaid.js
- https://unpkg.com/mermaid@11.2.0/dist/mermaid.min.js

Copy these files to `src/resources/formats/html/mermaid`.
