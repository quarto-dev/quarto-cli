/*
 * add-css-vars.ts
 *
 * Analyzes SCSS files for CSS variables and adds them as additional CSS variables
 * for our tooling to use.
 *
 * Copyright (C) 2024 Posit Software, PBC
 */

import { parse } from "scss-parser";

import { makeParserModule } from "./analyzer/parse.ts";
import { cleanSassAst } from "./analyzer/clean-ast.ts";
import { propagateDeclarationTypes } from "./analyzer/declaration-types.ts";
import { getVariableDependencies } from "./analyzer/get-dependencies.ts";

const { getSassAst } = makeParserModule(parse);

// Reverse the _u<hex>_ encoding applied in parse.ts so that
// variable names emitted into the CSS vars block match the
// original SCSS source that Dart Sass compiles against.
// Non-ASCII codepoints are valid in CSS custom property names since they
// follow the <ident> production (see spec references in parse.ts).
const decodeScssName = (name: string) =>
  name.replace(/_u([0-9a-f]+)_/g, (_, hex: string) =>
    String.fromCodePoint(parseInt(hex, 16))
  );

export class SCSSParsingError extends Error {
  constructor(message: string) {
    super(`SCSS Parsing Error: ${message}`);
    this.name = "SCSSParsingError";
  }
}

export const cssVarsBlock = (scssSource: string) => {
  let astOriginal;
  try {
    astOriginal = getSassAst(scssSource);
  } catch (e) {
    if (!(e instanceof Error)) throw e;
    throw new SCSSParsingError(e.message);
  }
  const ast = propagateDeclarationTypes(cleanSassAst(astOriginal));
  const deps = getVariableDependencies(ast);

  const output: string[] = [":root {"];
  for (const [dep, _] of deps) {
    const decl = ast.get(dep);
    if (decl.valueType === "color") {
      const originalName = decodeScssName(dep);
      output.push(`--quarto-scss-export-${originalName}: #{$${originalName}};`);
    }
  }
  output.push("}");
  return output.join("\n");
};
