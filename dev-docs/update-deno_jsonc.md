## tl;dr

deno.jsonc currently doesn't support globs, so we have a script to expand the globs ourselves.

## Steps

```
$ cd quarto-cli
$ deno run --allow-all package/src/common/create-deno-config.ts > deno.jsonc
```
