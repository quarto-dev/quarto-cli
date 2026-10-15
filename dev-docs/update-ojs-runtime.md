# Updating the OJS runtime

How to change the browser runtime behind `{ojs}` cells: Quarto's own runtime code, a bundled npm dependency, or one of the Observable forks.

The sources live in [`packages/ojs/`](../packages/ojs/). Its [README](../packages/ojs/README.md) describes the layout, the build, how the forks are maintained, and the dependency pins. Read it first; this page is the end-to-end procedure around it. For how Quarto compiles `{ojs}` cells and injects the runtime, see [`llm-docs/ojs-architecture.md`](../llm-docs/ojs-architecture.md).

## What the build produces

`npm run build` in `packages/ojs` writes two bundles into [`src/resources/formats/html/ojs/`](../src/resources/formats/html/ojs/):

- `quarto-ojs-runtime.js` is the bundle Quarto uses. Renders link it as a module script or inline it when self-contained.
- `quarto-ojs-runtime.min.js` is built, committed, and shipped in the distribution with the rest of `src/resources/`, but nothing in quarto-cli references it.

`quarto-ojs.css` in the same directory is not built. Edit it there directly.

## Procedure

1. Make the change in `packages/ojs/`:
   - Quarto's runtime: edit `quarto-ojs-runtime/src/`.
   - A bundled npm dependency: `npm install <package>@<version> --workspace quarto-ojs-runtime` from `packages/ojs`, which updates `quarto-ojs-runtime/package.json` and `package-lock.json`. Check the README notes for pinned packages (for example `@observablehq/inputs` stays on 0.10).
   - An upstream fork change: apply it by hand in the matching `external-*/` directory (see the README).
2. Bump the runtime version, so the bundle banner (`// quarto-ojs-runtime vX.Y.Z ...`) identifies the build:

   ```bash
   cd packages/ojs
   npm version patch --workspace quarto-ojs-runtime --no-git-tag-version
   ```

   This updates `quarto-ojs-runtime/package.json` and the matching entry in `package-lock.json`.
3. Rebuild with Node.js 24 or later:

   ```bash
   cd packages/ojs
   npm ci
   npm run build
   ```

4. Commit the source change, `package-lock.json`, and both bundles together. CI rebuilds them and fails if the committed bundles differ.

The build is reproducible: the banner holds no date, so the same sources produce identical bundles. On Windows, rollup writes the unminified bundle with CRLF line endings because the sources are checked out with CRLF. The `eol=lf` attribute on `src/**` normalizes them, so `git diff` shows no line-ending changes.

npm workspaces create junctions under `node_modules`. To remove `node_modules` on Windows, unlink the junctions first (`Remove-Item` without `-Recurse` on each reparse point); `Remove-Item -Recurse` on a junction deletes the files of the package it points to.

## Verify

- The bundle must not contain a closing script tag, because self-contained renders inline it without escaping:

  ```bash
  rg -c '</script' src/resources/formats/html/ojs/quarto-ojs-runtime.js   # must print nothing
  ```

- Third-party notices in `quarto-ojs-runtime/src/escodegen.js` (BSD-2-Clause) and `escape.js` (MIT, from escape-html) must still appear in the unminified bundle. The minified bundle keeps only the escape-html notice, which is a `/*!` comment; Terser drops the escodegen one.
- `git diff --stat` after the build lists only the bundles you expect to change.
- Run the OJS Playwright specs (render `tests/docs/playwright/ojs/` first; see `.claude/rules/testing/playwright-tests.md`):

  ```bash
  cd tests/integration/playwright
  npx playwright test ojs-
  ```

- Run the OJS smoke tests: `tests/smoke/ojs/*.test.ts` and `tests/smoke/render/render-ojs.test.ts`, plus the smoke-all documents with `{ojs}` cells (`rg -l '```\{ojs' tests/docs/smoke-all --glob '*.qmd'`).
- Render an `{ojs}` document with `embed-resources: true` and open the HTML from disk. This is the inlined-bundle path, which the linked path does not exercise.
- For changes to `@observablehq/inputs` or the Shiny bridge (`quarto-observable-shiny.js`), check a Shiny document with OJS inputs. Button styling depends on the Inputs form class name.
- For a `mime` upgrade, compare `FileAttachment(...).mimeType` for common extensions before and after. The runtime reports the bundled `mime` package's type to user code.

The [OJS Runtime Bundle workflow](../.github/workflows/test-ojs-runtime.yml) runs on pull requests that touch `packages/ojs/` or the bundles. It checks that the bundles match a rebuild, not that they work; the Playwright and smoke suites cover behavior.
