/*
 * scss-analyzer-parse.test.ts
 *
 * Tests for the SCSS static-analysis parser wrapper, in particular the
 * text-level workarounds in src/core/sass/analyzer/parse.ts that shield
 * the brittle third-party scss-parser from valid-but-oddly-formatted SCSS.
 * Validates fixes for:
 *   https://github.com/quarto-dev/quarto-cli/issues/14687 (colon with no space)
 *   https://github.com/quarto-dev/quarto-cli/issues/11703 (double semicolon)
 *
 * Copyright (C) 2020-2026 Posit Software, PBC
 */

import { unitTest } from "../test.ts";
import { assert } from "testing/asserts";
import { parse } from "scss-parser";
import { makeParserModule } from "../../src/core/sass/analyzer/parse.ts";
import { cssVarsBlock } from "../../src/core/sass/add-css-vars.ts";

const { getSassAst } = makeParserModule(parse);

// SCSS snippets that are valid (Dart Sass compiles them) but used to make
// the raw scss-parser throw. Each entry documents a shape the workarounds
// in parse.ts must keep rescuing.
const parseableSnippets: [string, string][] = [
  // issue #14687: declaration on the same line as `{`, no space after colon
  [".example {width:100px;}", "same-line declaration, numeric value"],
  [".example { width:100px; }", "same-line declaration, spaces inside braces"],
  [".example {width:$foo;}", "same-line declaration, variable value"],
  [".example {width:100px}", "same-line declaration, missing semicolon"],
  [".example {color:#fff;}", "same-line declaration, hex color value"],
  [".example {width:100%;}", "same-line declaration, percentage value"],
  [".example {margin:0;}", "same-line declaration, bare zero value"],
  [".example {width:.5em;}", "same-line declaration, leading-dot value"],
  [
    ".example {width:100px;height:200px;}",
    "second declaration follows a semicolon on the same line",
  ],
  ["a:hover {width:100px;}", "pseudo-class selector before a one-line rule"],
  [
    "@media (min-width:600px) { body { margin:0; } }",
    "one-line media query with colon-no-space declarations",
  ],
  [
    ".x {background:url(data:image/png;base64,AAAA);}",
    "data: url payload containing colons and semicolons",
  ],
  ['.x {content:"{a:1}";}', "string value containing brace/colon characters"],
  // issue #11703: consecutive semicolons (empty statements) inside a block
  ["a { b: 1;; }", "double semicolon after a declaration"],
  ["a { b: 1; ; }", "semicolons separated by a space"],
  ["a { b: 1;;; }", "triple semicolon"],
  ["a { b: 1;\n;\n}", "semicolons separated by a newline"],
  [
    ".hanged { max-height: 100% !important;; }",
    "double semicolon after !important (issue #11703 shape)",
  ],
  // shapes that already worked before issue #14687; guard against regressions
  [".example {\n  width:100px;\n}", "line-start declaration, no space after colon"],
  [".foo { &:hover {color:red;} }", "nested parent-selector rule on one line"],
  ["$brand: #ff0000;\n.example {width:100px;}", "variable assignment plus one-line rule"],
];

unitTest(
  "scss-analyzer - parses valid SCSS shapes that break raw scss-parser (issues #14687, #11703)",
  // deno-lint-ignore require-await
  async () => {
    for (const [snippet, description] of parseableSnippets) {
      try {
        const ast = getSassAst(snippet);
        assert(
          ast.type === "stylesheet",
          `Expected a stylesheet AST for: ${description}`,
        );
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        throw new Error(
          `getSassAst failed on "${snippet}" (${description}): ${message}`,
        );
      }
    }
  },
);

unitTest(
  "scss-analyzer - cssVarsBlock exports colors despite one-line rules (issue #14687)",
  // deno-lint-ignore require-await
  async () => {
    const scss = [
      "$brand: #ff0000;",
      "$body-bg: $brand;",
      ".example {width:100px;}",
    ].join("\n");
    const block = cssVarsBlock(scss);
    assert(
      block.includes("--quarto-scss-export-brand:"),
      `Expected $brand to be exported as a CSS variable, got:\n${block}`,
    );
  },
);
