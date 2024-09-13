Change version numbers in `./configuration` to correspond to new versions.

Contact JJ so he uploads the binaries to the S3 bucket.

## Upgrade deno

### Upgrade standard library

- run `./configure.sh` to locally install all dependencies.

- In `src/import_map.json`, change the version number of the imports like `https://deno.land/std@0.204.0/archive` to the new version number (e.g. `0.205.0`).

- run `./package/scripts/vendoring/vendor.sh`

## Upgrade mermaidjs

Apparently mermaidjs doesn't actually build mermaid in their releases :shrug:.
They also don't appear to offer any clear documentation on how to do it, and `npm install` from their `packages/mermaidjs` directory just fails.

So, we grab the published javascript bundles from unpkg.com.

For version 11.2.0, for example, these are:

- https://unpkg.com/mermaid@11.2.0/dist/mermaid.js
- https://unpkg.com/mermaid@11.2.0/dist/mermaid.min.js

Copy these files to `src/resources/formats/html/mermaid`.
