Change version numbers in `./configuration` to correspond to new versions.

Contact JJ so he uploads the binaries to the S3 bucket.

## Upgrade deno

### Upgrade standard library

- run `./configure.sh` to locally install all dependencies.

- In `src/import_map.json`, change the version number of the imports like `https://deno.land/std@0.204.0/archive` to the new version number (e.g. `0.205.0`).

- run `./package/scripts/vendoring/vendor.sh`
