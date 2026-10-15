# OJS runtime

Sources for `quarto-ojs-runtime.js` and `quarto-ojs-runtime.min.js`, the bundles that
Quarto serves for `{ojs}` cells. The built bundles are committed in
`src/resources/formats/html/ojs/`.

- `quarto-ojs-runtime/`: Quarto's runtime: code transforms, the Observable connector,
  the inspector, and Shiny integration.
- `external-*/`: Quarto forks of Observable's
  [runtime](https://github.com/observablehq/runtime),
  [stdlib](https://github.com/observablehq/stdlib) and
  [parser](https://github.com/observablehq/parser), of
  [d3-require](https://github.com/d3/d3-require), and of
  [unofficial-observablehq-compiler](https://github.com/asg017/unofficial-observablehq-compiler).

All of these packages are under the ISC license, as given in each `package.json`, except
two files vendored in `quarto-ojs-runtime/src/`: `escodegen.js` is a fork of
[escodegen](https://github.com/estools/escodegen) (BSD-2-Clause) and `escape.js` comes from
[escape-html](https://github.com/component/escape-html) (MIT). Both keep their license
headers, which are preserved in `quarto-ojs-runtime.js`.

These moved from `packages/ojs/` in [quarto-dev/quarto](https://github.com/quarto-dev/quarto)
([#15043](https://github.com/quarto-dev/quarto-cli/issues/15043)), where the forks were
`git subtree`s. They were copied from
[quarto-dev/quarto@42177e13](https://github.com/quarto-dev/quarto/tree/42177e13074cf905619bbb52b1dba313fb5b4bb1/packages/ojs),
the head of [quarto-dev/quarto#1180](https://github.com/quarto-dev/quarto/pull/1180) before
it deleted them. That commit is not on quarto-dev/quarto's `main` branch.

## Building

With Node.js 24 or later:

```bash
cd packages/ojs
npm ci
npm run build
```

This writes both bundles directly into `src/resources/formats/html/ojs/`. The build is
reproducible: CI rebuilds the bundles and fails if they differ from the committed
ones, so commit the rebuilt bundles together with any change here.

The npm workspaces link the forks to each other and to the runtime. Rollup bundles
everything from source. The compiler fork's `module` field points to its ES module
source, so its `dist/` build isn't needed.

## Maintaining the forks

The forks are plain copies here, so `git subtree pull` doesn't work. To take an
upstream change, apply it by hand and rebuild. Upstream development of these
packages has largely stopped.

Changes from the copies in quarto-dev/quarto:

- The forks' `devDependencies` are removed. They were for each fork's own build,
  tests and linting, which don't run here, and their old rollup plugins conflict
  with npm's peer dependency checks. The forks' `scripts` won't work without them.
  The forks' `yarn.lock` files are removed too; `package-lock.json` here covers
  every package.
- The forks' `.github/` and `.circleci/` directories are removed. GitHub only runs
  workflows from the repository root, and the forks' scripts can't run here anyway.
- The compiler fork's `package.json` gains `"module": "src/index.js"`.

## Notes

- Keep `@observablehq/inputs` on 0.10. Version 0.11 renames the form class
  (`__ns__` to `inputs-3a86ea`), which breaks Shiny's button styling.
- `src/resources/formats/html/ojs/quarto-ojs.css` is maintained directly in that
  directory. quarto-dev/quarto had an older copy of it, which wasn't brought over.
