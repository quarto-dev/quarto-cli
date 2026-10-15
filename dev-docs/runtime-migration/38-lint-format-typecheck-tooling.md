# PR 38: `oxlint`, `dprint`, `tsc --noEmit` replace `deno lint`, `deno fmt`, `deno check`

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Linting, formatting and type checking of the TypeScript sources run on npm tools (`oxlint`, `dprint` with the TypeScript plugin's Deno preset, `tsc` with `@types/node`), the 714 `deno-lint-ignore` directives are migrated, the `deno.ns` type library is gone, editor settings point at the new tools, and CI runs all three.
**Phase:** 3. **Depends on:** PR 37 (no `deno.jsonc`, no `Deno.` identifiers, docs renamed). **Unblocks:** nothing (last tooling PR).
**Branch:** `rt/38-lint-format-typecheck-tooling`.
**Suggested executor:** Sonnet. Configuration files with known option names, a mechanical directive codemod, and a type-error triage with clear rules.
**Size:** M (about 12 new/changed config and script files, one CI workflow, editor settings, and the directive codemod touching about 300 files mechanically).
**Ships on:** Node. Gates: the new `lint.yml` workflow green; the existing suite unchanged (formatting-only diffs are expected to be near zero).

## Spec

### Context

Assessment section 3.5: "`deno check` -> `tsc --noEmit` with `@types/node`. Removing the `deno.ns` lib from the type environment is the best migration guide: every remaining `Deno.*` use becomes a compile error. `deno lint` -> `oxlint` or ESLint. `deno fmt` -> `dprint`, which is the formatter inside `deno fmt`, so formatting churn is near zero."

What exists today:

- `deno.jsonc` (deleted in PR 37) carried `compilerOptions.noErrorTruncation: true`, `lint.include: ["src/"]`, `lint.rules.exclude: ["require-await", "no-inferrable-types"]`, `fmt.include: ["src/"]`, and an exclude list generated from `package/src/common/deno-meta.json` (deleted in PR 37) whose source globs were:

  ```
  src/resources/create/extensions/revealjs-plugin/_extensions/qstart-filesafename-qend/qstart-filesafename-qend.js
  src/resources/editor/
  src/core/lib/external/
  src/vendor/
  src/resources/vendor/
  src/resources/formats/pdf/pdfjs/
  src/resources/deno_std/
  **/*.min.js
  **/*.umd.js
  **/*.esm.js
  src/resources/library/**/*.js
  src/resources/formats/**/*.js
  src/resources/projects/website/**/*.js
  ```
- `package/src/common/project-lint.sh` ran `deno lint -c deno.jsonc` and printed the files with findings.
- The dev launcher passed `--check` (deleted in PR 33); nothing type-checks the tree today.
- `.vscode/settings.json` enables the Deno extension (`deno.enable`, `deno.lint`, `deno.unstable`, `deno.importMap`, `deno.disablePaths`) and sets `denoland.vscode-deno` as the TypeScript formatter; `.vscode/extensions.json` recommends `denoland.vscode-deno`; `quarto-cli.code-workspace` repeats the `deno.*` settings and `deno.path`.

Lint directives in the tree (counted 2026-10-14; `grep -rhoE "deno-lint-ignore(-file)? [a-z-]+( [a-z-]+)*"` plus bare file directives):

| Directive | `src/` | `tests/` + `package/src` | oxlint rule |
|---|---|---|---|
| `no-explicit-any` | 222 | 47 | `typescript/no-explicit-any` |
| `require-await` | 13 | 347 | `eslint/require-await` |
| `camelcase` | 7 | 0 | none in oxlint (`eslint/camelcase` is not implemented as of oxlint 1.88.0; verified in `crates/oxc_linter/src/rules.rs`) -> directive deleted, rule not enabled |
| `no-control-regex` | 3 | 1 | `eslint/no-control-regex` |
| `no-cond-assign` | 2 | 0 | `eslint/no-cond-assign` |
| `prefer-const` | 1 | 0 | `eslint/prefer-const` |
| `no-prototype-builtins` | 1 | 0 | `eslint/no-prototype-builtins` |
| `no-empty` | 1 | 0 | `eslint/no-empty` |
| `no-window-prefix` | 0 | 4 | Deno-only rule -> directive deleted |
| `deno-lint-ignore-file <rule>` | 5 | 0 | `/* oxlint-disable <rule> */` |
| `deno-lint-ignore-file` (bare) | 65 (all scopes) | | `/* oxlint-disable */` |

714 directive lines in total. `no-unused-vars` is not used as a directive but is part of `deno lint`'s recommended set (with the `_` prefix exemption) and maps to `eslint/no-unused-vars`.

Tool versions on npm (2026-10-14): `oxlint 1.88.0`, `dprint 0.63.0`, `@dprint/typescript 0.96.1`, `typescript 7.0.2` (the native compiler) and `5.9.x`, `@types/node 26.6.5`. This plan pins `typescript@5.9` because its `paths`/`moduleResolution: "bundler"` behaviour is what the codebase was checked against under Deno's bundled 5.x compiler; evaluating TypeScript 7 is a one-line bump later.

`dprint-plugin-typescript` has a `deno` preset (`"deno": true` in the plugin's config schema, `deployment/schema.json`) that sets exactly `deno fmt`'s defaults: line width 80, 2-space indent, no tabs, double quotes, semicolons always, trailing commas only on multi-line. The plan uses the preset and additionally spells the five values out so a reader sees them.

Node's type stripping rejects `enum` and parameter properties, but PR 33 bundles with esbuild, so this PR does **not** enable `erasableSyntaxOnly`; it is listed as an optional follow-up.

Assumptions about earlier PRs:

- PR 26's root `package.json` exists with `"type": "module"` and a `devDependencies` block; `.npmrc` maps `@jsr`.
- PR 33 refactored `tools/node-bundle/build.mjs` and kept the resolver helpers (`applyImportMap`, `jsrToNpm`, `npmSpec`) as module-level functions; this PR exports them for the `paths` generator.
- PR 37 renamed `.claude/rules/typescript/deno-essentials.md` to `essentials.md` (and possibly `src/deno_ral/` to `src/runtime/`; the plan writes `src/deno_ral/` and the executor substitutes).
- After PR 03-07 and 22, `src/import_map.json` has only `jsr:`, `npm:` and relative targets (no `https://` targets). Task 3's generator errors on anything else, which is the check.

### Scope

In:
- `.oxlintrc.json`, `dprint.json`, `tsconfig.json`, `tsconfig.paths.json` (generated, committed), `tools/typecheck/gen-tsconfig-paths.mjs`, `tools/lint/migrate-directives.mjs` (one-off codemod, kept for reference), `tools/lint/files-with-findings.sh` (replaces `package/src/common/project-lint.sh`).
- Root `package.json` scripts and devDependencies.
- The directive migration across `src/`, `tests/`, `package/src`, `tools/`.
- Type-error triage until `npm run typecheck` passes.
- `.github/workflows/lint.yml`.
- `.vscode/settings.json`, `.vscode/extensions.json`, `quarto-cli.code-workspace`.
- `.claude/rules/typescript/essentials.md` (Lint Directives section), `.claude/rules/typescript/cliffy-commands.md` (directive in the example), `.claude/rules/testing/typescript-tests.md:80`, `dev-docs/add-typescript-dependency.md` step 5 wording.

Out:
- Reformatting the tree beyond what `dprint fmt` changes under the Deno preset (expected: nothing or a handful of files; the diff is reviewed, not hidden).
- Enabling rules `deno lint` did not enable (no new findings; the config is "recommended parity", with `require-await` and `no-inferrable-types` off exactly as before).
- Linting `.js` files under `src/resources` (same exclusions as before).
- Type-checking `src/webui/quarto-preview` (own `tsconfig.json`) and `packages/quarto-types` (own build).

### Interfaces

`package.json` scripts:

```json
{
  "scripts": {
    "lint": "oxlint -c .oxlintrc.json src tests package/src tools",
    "fmt": "dprint fmt",
    "fmt:check": "dprint check",
    "typecheck": "node tools/typecheck/gen-tsconfig-paths.mjs --check && tsc -p tsconfig.json"
  },
  "devDependencies": {
    "@dprint/typescript": "0.96.1",
    "@types/node": "26.6.5",
    "dprint": "0.63.0",
    "oxlint": "1.88.0",
    "typescript": "5.9.3"
  }
}
```

`tools/typecheck/gen-tsconfig-paths.mjs`: reads `src/import_map.json`, writes `tsconfig.paths.json` (`{ "compilerOptions": { "paths": {...} } }`); `--check` exits 1 when the committed file differs from what it would write (CI drift check).

Directive mapping implemented by `tools/lint/migrate-directives.mjs` (idempotent):

| Input line | Output |
|---|---|
| `// deno-lint-ignore no-explicit-any` | `// oxlint-disable-next-line typescript/no-explicit-any` |
| `// deno-lint-ignore require-await` | `// oxlint-disable-next-line eslint/require-await` |
| `// deno-lint-ignore no-control-regex` | `// oxlint-disable-next-line eslint/no-control-regex` |
| `// deno-lint-ignore no-cond-assign` / `prefer-const` / `no-prototype-builtins` / `no-empty` | `// oxlint-disable-next-line eslint/<rule>` |
| `// deno-lint-ignore camelcase` or `no-window-prefix` | line deleted |
| `// deno-lint-ignore a b` (several rules) | one `oxlint-disable-next-line` listing the mapped rules, comma separated; rules without mapping dropped; line deleted if none remain |
| `// deno-lint-ignore-file` | `/* oxlint-disable */` |
| `// deno-lint-ignore-file camelcase` | line deleted |
| `// deno-lint-ignore-file <mapped rules>` | `/* oxlint-disable <mapped rules> */` |

Verify the directive syntax on one file before running the codemod (`oxlint` accepts `// oxlint-disable-next-line <rule>` and `// eslint-disable-next-line <rule>`; the plugin-prefixed form `typescript/no-explicit-any` is accepted; if a given oxlint version rejects the prefix, run the codemod with `--bare-rule-names`).

### Files

- Create: `.oxlintrc.json`, `dprint.json`, `tsconfig.json`, `tsconfig.paths.json`, `tools/typecheck/gen-tsconfig-paths.mjs`, `tools/lint/migrate-directives.mjs`, `tools/lint/files-with-findings.sh`, `.github/workflows/lint.yml`
- Modify: `package.json`, `package-lock.json`, `tools/node-bundle/build.mjs` (export helpers), `.vscode/settings.json`, `.vscode/extensions.json`, `quarto-cli.code-workspace`, `.claude/rules/typescript/essentials.md`, `.claude/rules/typescript/cliffy-commands.md`, `.claude/rules/testing/typescript-tests.md`, `dev-docs/add-typescript-dependency.md`
- Modify (codemod): every `.ts` file containing `deno-lint-ignore` (about 300 files)
- Modify (type fixes): files reported by `tsc`
- Delete: `package/src/common/project-lint.sh`
- Test: `tests/unit/lint-directives-codemod.test.ts`

### Acceptance criteria

- `npm run lint` exits 0 with zero findings on `src`, `tests`, `package/src`, `tools`.
- `grep -rn "deno-lint-ignore" src tests package tools .claude` prints nothing.
- `npm run fmt:check` exits 0; the formatting diff this PR introduces (`git diff --stat` of the `dprint fmt` commit) is reviewed and small (expected under 20 files; anything larger means the preset is wrong).
- `npm run typecheck` exits 0 with `strict: true`, `types: ["node"]`, `lib: ["ES2023", "DOM", "DOM.Iterable"]`, no `deno.ns`.
- `tsconfig.paths.json` is regenerated from `src/import_map.json` and `--check` detects drift.
- `.github/workflows/lint.yml` runs the three scripts on `ubuntu-latest` on push and pull_request and passes.
- No `deno.*` key remains in `.vscode/settings.json` or `quarto-cli.code-workspace`; `.vscode/extensions.json` recommends `dprint.dprint` and `oxc.oxc-vscode`.

## Plan

### Task 1: Dependencies and `dprint`

**Files:**
- Modify: `package.json`, `package-lock.json`
- Create: `dprint.json`

- [ ] **Step 1: Install**

```bash
npm install --save-dev --save-exact oxlint@1.88.0 dprint@0.63.0 @dprint/typescript@0.96.1 typescript@5.9.3 @types/node@26.6.5
ls node_modules/@dprint/typescript/
```
Expected: the listing contains `plugin.wasm` (the npm package ships the Wasm plugin; if the file is named differently, use that name in `dprint.json`).

- [ ] **Step 2: `dprint.json`**

```json
{
  "typescript": {
    "deno": true,
    "lineWidth": 80,
    "indentWidth": 2,
    "useTabs": false,
    "quoteStyle": "alwaysDouble",
    "semiColons": "always",
    "trailingCommas": "onlyMultiLine"
  },
  "includes": [
    "src/**/*.ts",
    "tests/**/*.ts",
    "package/src/**/*.ts",
    "tools/**/*.{ts,mjs}"
  ],
  "excludes": [
    "**/node_modules",
    "src/resources/create/extensions/revealjs-plugin/_extensions/qstart-filesafename-qend/qstart-filesafename-qend.js",
    "src/resources/editor/",
    "src/core/lib/external/",
    "src/resources/vendor/",
    "src/resources/formats/pdf/pdfjs/",
    "src/resources/extension-subtrees/",
    "src/webui/",
    "src/resources/run-stdlib/",
    "src/resources/types/",
    "**/*.min.js",
    "**/*.umd.js",
    "**/*.esm.js",
    "src/resources/library/**/*.js",
    "src/resources/formats/**/*.js",
    "src/resources/projects/website/**/*.js",
    "tests/.venv/",
    "tests/integration/playwright/node_modules/"
  ],
  "plugins": ["node_modules/@dprint/typescript/plugin.wasm"]
}
```

The five explicit values are the Deno preset's values, spelled out for readers. `src/resources/types/` holds generated files (`schema-types.ts`, Zod) and the Julia subtree formats itself upstream; both were implicitly outside `deno fmt`'s `include: ["src/"]`? No: `src/resources/types` *was* inside `src/`. If `dprint check` reports those generated files, keep them excluded (the generator, not the formatter, owns them) and say so in the PR.

- [ ] **Step 3: Run the formatter and inspect**

```bash
npx dprint check 2>&1 | tail -5
npx dprint fmt
git diff --stat | tail -3
```
Expected: `dprint check` lists at most a handful of files; after `dprint fmt` the diff is whitespace/trailing-comma only. If more than about 20 files change, stop: compare one file's diff with what `deno fmt` would have done (`git stash; git show HEAD:<file>`) and fix the config before committing.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json dprint.json
git commit -m "tooling: dprint with the deno preset replaces deno fmt"
git add -A src tests package tools && git commit -m "style: dprint fmt" || true
```

### Task 2: `oxlint` and the directive codemod

**Files:**
- Create: `.oxlintrc.json`, `tools/lint/migrate-directives.mjs`, `tools/lint/files-with-findings.sh`
- Delete: `package/src/common/project-lint.sh`
- Test: `tests/unit/lint-directives-codemod.test.ts`

- [ ] **Step 1: Write the failing test for the codemod**

```ts
/*
 * lint-directives-codemod.test.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 */
import { unitTest } from "../test.ts";
import { assertEquals } from "../asserts.ts";
import { migrateDirectives } from "../../tools/lint/migrate-directives.mjs";

unitTest("lint directives: line directives map to oxlint rules", () => {
  assertEquals(
    migrateDirectives("  // deno-lint-ignore no-explicit-any\n  const x: any = 1;\n"),
    "  // oxlint-disable-next-line typescript/no-explicit-any\n  const x: any = 1;\n",
  );
  assertEquals(
    migrateDirectives("// deno-lint-ignore require-await no-explicit-any\n"),
    "// oxlint-disable-next-line eslint/require-await, typescript/no-explicit-any\n",
  );
});

unitTest("lint directives: unmapped rules are dropped, empty directives deleted", () => {
  assertEquals(migrateDirectives("// deno-lint-ignore camelcase\nconst a_b = 1;\n"), "const a_b = 1;\n");
  assertEquals(migrateDirectives("  // deno-lint-ignore no-window-prefix\n  window.x;\n"), "  window.x;\n");
  assertEquals(migrateDirectives("// deno-lint-ignore camelcase no-explicit-any\n"), "// oxlint-disable-next-line typescript/no-explicit-any\n");
});

unitTest("lint directives: file directives", () => {
  assertEquals(migrateDirectives("// deno-lint-ignore-file\n\nexport {};\n"), "/* oxlint-disable */\n\nexport {};\n");
  assertEquals(migrateDirectives("// deno-lint-ignore-file camelcase\n\nexport {};\n"), "\nexport {};\n");
  assertEquals(migrateDirectives("// deno-lint-ignore-file no-explicit-any\n"), "/* oxlint-disable typescript/no-explicit-any */\n");
});

unitTest("lint directives: idempotent", () => {
  const once = migrateDirectives("// deno-lint-ignore no-empty\ntry {} catch {}\n");
  assertEquals(migrateDirectives(once), once);
});
```

(If the Node harness cannot import `.mjs` from a `.test.ts` through the bundler, put the pure function in `tools/lint/migrate-directives-core.ts` and have the `.mjs` import it; the test then imports the `.ts`.)

- [ ] **Step 2: Run it and see it fail**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/lint-directives-codemod.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Write the codemod**

```js
// tools/lint/migrate-directives.mjs
//
// Copyright (C) 2026 Posit Software, PBC
//
// One-off codemod: deno-lint-ignore directives -> oxlint directives.
// Usage: node tools/lint/migrate-directives.mjs [--bare-rule-names] <dir>...
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const kRuleMap = {
  "no-explicit-any": "typescript/no-explicit-any",
  "no-inferrable-types": "typescript/no-inferrable-types",
  "require-await": "eslint/require-await",
  "no-control-regex": "eslint/no-control-regex",
  "no-cond-assign": "eslint/no-cond-assign",
  "prefer-const": "eslint/prefer-const",
  "no-prototype-builtins": "eslint/no-prototype-builtins",
  "no-empty": "eslint/no-empty",
  "no-unused-vars": "eslint/no-unused-vars",
  "ban-types": "typescript/ban-types",
  "no-this-alias": "typescript/no-this-alias",
  "no-namespace": "typescript/no-namespace",
  "no-fallthrough": "eslint/no-fallthrough",
  "no-case-declarations": "eslint/no-case-declarations",
  "no-unsafe-finally": "eslint/no-unsafe-finally",
  "no-async-promise-executor": "eslint/no-async-promise-executor",
  "no-deprecated-deno-api": null,
  "no-window-prefix": null,
  "camelcase": null,
};

let bareRuleNames = false;

function mapRules(rules) {
  const out = [];
  for (const r of rules) {
    if (!(r in kRuleMap)) {
      throw new Error(`unknown deno-lint rule "${r}"; add it to kRuleMap`);
    }
    const mapped = kRuleMap[r];
    if (mapped) out.push(bareRuleNames ? mapped.split("/")[1] : mapped);
  }
  return out;
}

export function migrateDirectives(source) {
  const lines = source.split("\n");
  const out = [];
  for (const line of lines) {
    let m = line.match(/^(\s*)\/\/\s*deno-lint-ignore-file(?:\s+(.*))?\s*$/);
    if (m) {
      const rules = m[2] ? mapRules(m[2].trim().split(/\s+/)) : [];
      if (m[2] && rules.length === 0) continue;             // only unmapped rules: drop the line
      out.push(`${m[1]}/* oxlint-disable${rules.length ? " " + rules.join(", ") : ""} */`);
      continue;
    }
    m = line.match(/^(\s*)\/\/\s*deno-lint-ignore\s+(.*?)\s*$/);
    if (m) {
      const rules = mapRules(m[2].split(/\s+/));
      if (rules.length === 0) continue;
      out.push(`${m[1]}// oxlint-disable-next-line ${rules.join(", ")}`);
      continue;
    }
    out.push(line);
  }
  return out.join("\n");
}

function walk(dir, files) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name === ".git") continue;
      walk(p, files);
    } else if (/\.(ts|mts|js|mjs)$/.test(e.name)) {
      files.push(p);
    }
  }
  return files;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  bareRuleNames = args.includes("--bare-rule-names");
  const dirs = args.filter((a) => !a.startsWith("--"));
  let changed = 0;
  for (const dir of dirs) {
    for (const file of walk(dir, [])) {
      const before = fs.readFileSync(file, "utf8");
      if (!before.includes("deno-lint-ignore")) continue;
      const after = migrateDirectives(before);
      if (after !== before) {
        fs.writeFileSync(file, after);
        changed++;
      }
    }
  }
  console.log(`migrated directives in ${changed} files`);
}
```

- [ ] **Step 4: `.oxlintrc.json`**

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["typescript"],
  "categories": {
    "correctness": "off"
  },
  "rules": {
    "eslint/no-cond-assign": "error",
    "eslint/no-control-regex": "error",
    "eslint/no-empty": "error",
    "eslint/no-prototype-builtins": "error",
    "eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_", "caughtErrorsIgnorePattern": "^_" }],
    "eslint/prefer-const": "error",
    "eslint/no-fallthrough": "error",
    "eslint/no-case-declarations": "error",
    "eslint/no-unsafe-finally": "error",
    "eslint/no-async-promise-executor": "error",
    "eslint/require-await": "off",
    "typescript/no-explicit-any": "error",
    "typescript/no-inferrable-types": "off",
    "typescript/no-namespace": "error",
    "typescript/no-this-alias": "error"
  },
  "ignorePatterns": [
    "node_modules",
    "src/resources/create/extensions/revealjs-plugin/_extensions/qstart-filesafename-qend/qstart-filesafename-qend.js",
    "src/resources/editor/",
    "src/core/lib/external/",
    "src/resources/vendor/",
    "src/resources/formats/pdf/pdfjs/",
    "src/resources/extension-subtrees/",
    "src/resources/run-stdlib/",
    "src/webui/",
    "**/*.min.js",
    "**/*.umd.js",
    "**/*.esm.js",
    "src/resources/library/**/*.js",
    "src/resources/formats/**/*.js",
    "src/resources/projects/website/**/*.js",
    "tests/.venv/",
    "tests/integration/playwright/node_modules/"
  ]
}
```

`categories.correctness: "off"` then an explicit rule list reproduces `deno lint`'s recommended set as far as the directives in the tree reveal it; `require-await` and `no-inferrable-types` are off exactly as `deno.jsonc` had them. If `oxlint` reports findings for a rule that `deno lint` never reported (e.g. `no-unused-vars` on a `catch (e)` binding), prefer fixing the code when it is a real unused name; disable the rule only with a comment in `.oxlintrc.json` naming the number of findings. The `$schema` path is informational; if the package does not ship `configuration_schema.json`, delete the line.

- [ ] **Step 5: Run the codemod and the linter**

```bash
node tools/lint/migrate-directives.mjs src tests package/src tools
grep -rn "deno-lint-ignore" src tests package tools | head        # expect nothing
npx oxlint -c .oxlintrc.json src tests package/src tools 2>&1 | tail -3
```
Expected: `migrated directives in N files` (N about 300); no leftover directives; oxlint ends with `Found 0 warnings and 0 errors`. If oxlint reports `unknown rule` for the prefixed names in directives, rerun with `git checkout -- src tests package tools && node tools/lint/migrate-directives.mjs --bare-rule-names src tests package/src tools`. For real findings: a `require-await` directive that survived on a function oxlint does not flag is harmless; findings for enabled rules are fixed in the code or, when they are `deno lint` false negatives of a rule we keep, with an `oxlint-disable-next-line` and a reason.

- [ ] **Step 6: Replace `project-lint.sh`**

`tools/lint/files-with-findings.sh`:

```bash
#!/usr/bin/env bash
# Prints the files with lint findings, one per line (replaces package/src/common/project-lint.sh).
# Run from the repository root.
npx oxlint -c .oxlintrc.json --format=unix src tests package/src tools 2>/dev/null | sed 's/:.*$//' | sort -u
```

```bash
chmod +x tools/lint/files-with-findings.sh
git rm package/src/common/project-lint.sh
```

- [ ] **Step 7: Run the unit test, commit**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/lint-directives-codemod.test.ts`
Expected: `4 passed`.

```bash
git add .oxlintrc.json tools/lint tests/unit/lint-directives-codemod.test.ts
git commit -m "tooling: oxlint replaces deno lint; directive codemod"
git add -A src tests package tools && git commit -m "lint: migrate deno-lint-ignore directives to oxlint"
```

### Task 3: `tsc --noEmit` with a generated `paths` map

**Files:**
- Create: `tsconfig.json`, `tsconfig.paths.json`, `tools/typecheck/gen-tsconfig-paths.mjs`
- Modify: `tools/node-bundle/build.mjs` (export `applyImportMap`, `jsrToNpm`, `npmSpec`)

- [ ] **Step 1: Export the resolver helpers**

In `tools/node-bundle/build.mjs`, prefix `function applyImportMap`, `function jsrToNpm`, `function npmSpec` with `export`. (They are module-level functions in the PR 26/33 file; the CLI guard at the bottom keeps `node build.mjs` behaviour unchanged.)

- [ ] **Step 2: The generator**

```js
// tools/typecheck/gen-tsconfig-paths.mjs
//
// Copyright (C) 2026 Posit Software, PBC
//
// Generate tsconfig.paths.json from src/import_map.json so `tsc` resolves the
// same bare names the bundler resolves. Usage: node tools/typecheck/gen-tsconfig-paths.mjs [--check]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { jsrToNpm, npmSpec } from "../node-bundle/build.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const importMap = JSON.parse(fs.readFileSync(path.join(root, "src", "import_map.json"), "utf8")).imports;
const out = path.join(root, "tsconfig.paths.json");

function packagePath(target) {
  if (target.startsWith("jsr:")) return `node_modules/${jsrToNpm(target)}`;
  if (target.startsWith("npm:")) return `node_modules/${npmSpec(target)}`;
  if (target.startsWith("./") || target.startsWith("../")) return path.posix.join("src", target);
  throw new Error(`import_map.json target not resolvable for tsc: ${target} (only jsr:, npm: and relative targets are supported after PR 03-07)`);
}

const paths = {};
for (const [key, target] of Object.entries(importMap)) {
  const pkg = packagePath(target);
  if (key.endsWith("/")) {
    paths[`${key}*`] = [`${pkg.replace(/\/$/, "")}/*`];
  } else {
    paths[key] = [pkg];
  }
}
const json = JSON.stringify({ "//": "generated by tools/typecheck/gen-tsconfig-paths.mjs from src/import_map.json; do not edit", compilerOptions: { baseUrl: ".", paths } }, null, 2) + "\n";

if (process.argv.includes("--check")) {
  const current = fs.existsSync(out) ? fs.readFileSync(out, "utf8") : "";
  if (current !== json) {
    console.error("tsconfig.paths.json is out of date: run `node tools/typecheck/gen-tsconfig-paths.mjs`");
    process.exit(1);
  }
  console.log("tsconfig.paths.json up to date");
} else {
  fs.writeFileSync(out, json);
  console.log(`wrote ${path.relative(root, out)} (${Object.keys(paths).length} entries)`);
}
```

JSR packages on npm expose subpaths through `exports`; `moduleResolution: "bundler"` honours `exports`, so `"@std/path/posix"` resolves through `node_modules/@jsr/std__path` + its `exports` map. For `key/*` entries, if `tsc` cannot map a subpath that `exports` renames (e.g. `fs/exists` -> `./exists`), add a second candidate in the generator (`${pkg}/*.ts`, `${pkg}/*.js`) and note it in the file's comment.

- [ ] **Step 3: `tsconfig.json`**

```json
{
  "extends": "./tsconfig.paths.json",
  "compilerOptions": {
    "noEmit": true,
    "strict": true,
    "target": "ES2023",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "allowJs": false,
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "types": ["node"],
    "skipLibCheck": true,
    "noErrorTruncation": true,
    "useDefineForClassFields": true,
    "verbatimModuleSyntax": false,
    "isolatedModules": true
  },
  "include": [
    "src/**/*.ts",
    "tests/**/*.ts",
    "package/src/**/*.ts",
    "tools/**/*.ts"
  ],
  "exclude": [
    "node_modules",
    "src/webui",
    "src/core/lib/external",
    "src/resources/vendor",
    "src/resources/extension-subtrees",
    "src/resources/run-stdlib",
    "src/resources/editor",
    "src/resources/formats",
    "src/resources/library",
    "src/resources/projects",
    "src/resources/create",
    "tests/.venv",
    "tests/integration/playwright"
  ]
}
```

`DOM` is required by the deno_dom-typed code (`src/core/deno-dom.ts` and the HTML post-processors use `HTMLDocument`, `Element`); `DOM.Iterable` for `NodeList` iteration. `lib` deliberately contains no Deno library: that is what turns any surviving `Deno.*` into a compile error. `src/resources/create` is excluded because its `.ejs.ts` templates are not valid TypeScript before expansion; `src/resources/types` stays included (it is imported by `src/`).

- [ ] **Step 4: First run and triage**

```bash
node tools/typecheck/gen-tsconfig-paths.mjs
npx tsc -p tsconfig.json 2>&1 | tee /tmp/tsc.txt | tail -3
grep -c "error TS" /tmp/tsc.txt
grep -oE "error TS[0-9]+" /tmp/tsc.txt | sort | uniq -c | sort -rn | head
```

Expected classes of errors and how to resolve each (do them in this order, re-running `tsc` after each class):

1. **Unresolved modules (`TS2307`)**: a `paths` gap. Fix the generator (subpath candidates), never add an `// @ts-ignore`.
2. **`Deno` namespace (`TS2304: Cannot find name 'Deno'`)**: should be zero after PR 37; if any remain they are bugs: route through `src/deno_ral/` and update the ratchet baseline test.
3. **Lib differences**: `window`/`globalThis.addEventListener("unload")` in `tests/test.ts` (Deno's `unload` event; the Node harness of PR 31 replaced it, delete the dead branch), `ReadableStream`/`WritableStream` type mismatches between DOM and Node (`import type { ReadableStream } from "node:stream/web"` where a Node stream is meant, or cast at the single boundary in `src/deno_ral/process.ts`), `TextDecoder` encoding literal types, `crypto.subtle` (both libs agree), `fetch` `Response.body` nullability (DOM says `ReadableStream | null`, same as Deno).
4. **`@types/node` strictness** (`Buffer` vs `Uint8Array` generics in Node 22+ types: `Uint8Array<ArrayBufferLike>`): fix at the `src/deno_ral/` boundary by typing returns as `Uint8Array` and copying with `new Uint8Array(buf)` where TS insists.
5. **`import.meta` properties** (`filename`, `dirname`, `main`): `@types/node` declares `filename`/`dirname`; `main` must not appear (PR 19).
6. **Implicit any / strict null** errors that `deno check` also had but hid because the dev launcher's `--check` only covered the entry graph of `quarto.ts`: fix the code; for test files with large counts, a file-level `// @ts-nocheck` is acceptable only with a tracking issue number in the comment, and the PR lists those files.

Stop condition: `npx tsc -p tsconfig.json` prints no errors. Record the before/after counts in the PR description.

- [ ] **Step 5: Package script and commit**

Add the `typecheck` script from Interfaces to `package.json`. Run `npm run typecheck`; expected: `tsconfig.paths.json up to date` then a silent `tsc` exit 0.

```bash
git add tsconfig.json tsconfig.paths.json tools/typecheck tools/node-bundle/build.mjs package.json
git commit -m "tooling: tsc --noEmit with @types/node and generated import-map paths"
git add -A src tests package tools && git commit -m "types: fix errors surfaced by tsc without the deno.ns library"
```

### Task 4: CI workflow

**Files:**
- Create: `.github/workflows/lint.yml`

- [ ] **Step 1: Workflow**

```yaml
name: Lint, Format, Typecheck
on:
  workflow_dispatch:
  pull_request:
    branches: [main]
    paths-ignore:
      - ".claude/**"
      - "news/**"
  push:
    branches: [main]
    paths-ignore:
      - ".claude/**"
      - "news/**"

concurrency:
  group: lint-${{ github.ref }}
  cancel-in-progress: true

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - name: Read Node version from configuration
        id: node
        shell: bash
        run: |
          source ./configuration
          echo "version=${NODE#v}" >> "$GITHUB_OUTPUT"
      - uses: actions/setup-node@v6
        with:
          node-version: ${{ steps.node.outputs.version }}
          cache: npm
      - run: npm ci --no-audit --no-fund
      - name: oxlint
        run: npm run lint
      - name: dprint check
        run: npm run fmt:check
      - name: tsc
        run: npm run typecheck
```

This job does not need `configure.sh` (no binaries, no bundle): `actions/setup-node` with the version from `configuration` is enough and finishes in about a minute.

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/lint.yml
git commit -m "ci: lint, format and typecheck workflow"
```

### Task 5: Editor settings and rules docs

**Files:**
- Modify: `.vscode/settings.json`, `.vscode/extensions.json`, `quarto-cli.code-workspace`, `.claude/rules/typescript/essentials.md`, `.claude/rules/typescript/cliffy-commands.md`, `.claude/rules/testing/typescript-tests.md:80`, `dev-docs/add-typescript-dependency.md`

- [ ] **Step 1: `.vscode/settings.json`**

Replace the `[typescript]` block and delete the five `deno.*` keys:

```json
  "[typescript]": {
    "editor.defaultFormatter": "dprint.dprint",
    "editor.formatOnSave": true
  },
  "[javascript]": {
    "editor.defaultFormatter": "dprint.dprint"
  },
  "oxc.enable": true,
  "oxc.configPath": ".oxlintrc.json",
  "typescript.tsdk": "node_modules/typescript/lib",
```

(`dprint.dprint` reads `dprint.json`; `oxc.oxc-vscode` reads `.oxlintrc.json`.)

- [ ] **Step 2: `.vscode/extensions.json`**

Replace `"denoland.vscode-deno"` with `"dprint.dprint"` and add `"oxc.oxc-vscode"` after it.

- [ ] **Step 3: `quarto-cli.code-workspace`**

Delete every key starting with `deno.` (`deno.importMap`, `deno.lint`, `deno.enable`, `deno.unstable`, `deno.path`, `deno.disablePaths`, `deno.suggest.imports.hosts`, the seven `deno.inlayHints.*`). Add `"typescript.tsdk": "node_modules/typescript/lib"`. Keep `quarto.path`.

- [ ] **Step 4: Rules docs**

`.claude/rules/typescript/essentials.md`, "Lint Directives" section:

```markdown
## Lint Directives

`npm run lint` runs oxlint (`.oxlintrc.json`); `npm run fmt` runs dprint (`dprint.json`, Deno-compatible style); `npm run typecheck` runs `tsc --noEmit` (`tsconfig.json`; `tsconfig.paths.json` is generated from `src/import_map.json`, regenerate it with `node tools/typecheck/gen-tsconfig-paths.mjs` after editing the import map).

Suppress a finding on the next line (use sparingly, with the plugin prefix):

- `// oxlint-disable-next-line typescript/no-explicit-any` for Cliffy options and JSON parsing
- `// oxlint-disable-next-line eslint/no-control-regex` for regexes with control characters

`/* oxlint-disable */` at the top of a file disables all rules for that file (vendored or generated code only).
```

`.claude/rules/typescript/cliffy-commands.md`: `// deno-lint-ignore no-explicit-any` -> `// oxlint-disable-next-line typescript/no-explicit-any`. `.claude/rules/testing/typescript-tests.md:80`: `// deno-lint-ignore require-await` -> delete the line (the rule is off). `dev-docs/add-typescript-dependency.md` step 5: replace `(after PR 38)` with nothing and add `node tools/typecheck/gen-tsconfig-paths.mjs` before `npm run typecheck`.

- [ ] **Step 5: Commit**

```bash
git add .vscode quarto-cli.code-workspace .claude/rules dev-docs/add-typescript-dependency.md
git commit -m "editor/docs: dprint, oxlint and tsc settings replace the Deno extension"
```

## Verification

- `npm run lint && npm run fmt:check && npm run typecheck` all exit 0 locally.
- `grep -rn "deno-lint-ignore\|deno\.ns\|denoland.vscode-deno\|\"deno\." . --include=*.ts --include=*.json --include=*.md --include=*.code-workspace | grep -v "node_modules\|dev-docs/runtime-migration\|news/"` prints nothing.
- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/lint-directives-codemod.test.ts unit/` green; the full matrix green (the directive codemod and type fixes must not change behaviour).
- `lint.yml` green on the branch; introduce a deliberate `const x: any = 1;` in a scratch commit and confirm the workflow fails, then drop the commit.
- `node tools/typecheck/gen-tsconfig-paths.mjs --check` fails after editing `src/import_map.json` and passes after regenerating.

## Review checklist

- [ ] `dprint.json` uses the `deno` preset; the formatting commit is small and whitespace-only.
- [ ] `.oxlintrc.json` enables no rule `deno lint` did not enable; `require-await` and `no-inferrable-types` are off; unused-vars ignores `_` prefixes.
- [ ] Every `deno-lint-ignore` line was either mapped or deleted (only `camelcase`/`no-window-prefix`); the codemod is idempotent (unit test).
- [ ] `tsconfig.json` has no Deno lib, `types: ["node"]`, `lib` with `DOM`; the `exclude` list mirrors the lint excludes plus templates.
- [ ] Type fixes touch `src/deno_ral/` boundaries rather than sprinkling casts; any `// @ts-nocheck` file is listed in the PR with an issue.
- [ ] `lint.yml` reads the Node version from `configuration` (one source of truth with `configure.sh`).
- [ ] No `deno.*` keys in editor settings; recommended extensions updated.

## Risks and rollback

- **`dprint`'s Deno preset drifts from `deno fmt` in a later plugin version**, producing a large reformat on upgrade. Mitigation: exact version pins; review the diff on every bump.
- **`oxlint` rule semantics differ from `deno lint`** (e.g. `no-unused-vars` on destructured bindings). The explicit rule list keeps the surface small; findings are fixed or documented in `.oxlintrc.json`.
- **`tsc` is slower than `deno check`** on 137k lines (expect 30-60 s on CI). It runs in its own job; developers run it on demand. If it becomes a bottleneck, `typescript@7` (native) is the upgrade path and is already published.
- **Rollback:** revert the PR. The directive codemod commit can be reverted independently (it is the only one touching many files), after which `deno lint` is still unavailable but no tooling claims to lint.

## Decisions needed

1. **`oxlint` (recommended) vs ESLint + `typescript-eslint`.** oxlint: single binary, no config sprawl, milliseconds per run, every rule used in the tree except `camelcase` exists. ESLint: `camelcase` exists and type-aware rules are possible, at the cost of 10x the dependencies and seconds per run. The seven `camelcase` directives protect API-shaped names (`html_url`, `tag_name` in `src/tools/github.ts`); not enforcing the rule loses nothing.
2. **Enable `erasableSyntaxOnly` and remove the 12 enums / 40 parameter-property files?** Recommendation: not in this PR (the bundle makes it unnecessary); open an issue if the team wants `node src/quarto.ts` to work without the bundle.
