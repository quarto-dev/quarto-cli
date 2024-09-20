// our attempt at factoring out a clean parser
// that works in Deno and on the web

import { walk } from "./ast-utils.ts";

export const makeParserModule = (
  parse: any,
  prettierFormat: any
) => {
  return {
    getSassAst: async (contents: string) => {
      // scss-parser doesn't support the `...` operator and it breaks their parser oO, so we remove it.
      // our analysis doesn't need to know about it.
      contents = contents.replaceAll("...", "_dot_dot_dot");
      // it also doesn't like some valid ways to do '@import url'
      contents = contents.replaceAll("@import url", "//@import url");

      // the scss-parser also apparently breaks on Quarto's SCSS unless it's
      // been prettified first :shrug:
      contents = await prettierFormat(contents, { parser: "scss" });

      // Create an AST from a string of SCSS
      // and convert it to a plain JSON object
      const ast = JSON.parse(JSON.stringify(parse(contents)));

      if (!(ast.type === "stylesheet")) {
        throw new Error("Expected AST to have type 'stylesheet'");
      };
      if (!Array.isArray(ast.value)) {
        throw new Error("Expected AST to have an array value");
      }

      // rename 'value' to 'children'
      // because they also use 'value' for the value of a property

      // this is the only place we'll use 'walk' instead of the
      // more explicit 'mapDeep' and 'filterValuesDeep' functions
      // below, which will then assume 'children'

      walk(ast, (node: any) => {
        if (Array.isArray(node)) {
          return true;
        }
        if (["value", "identifier", "operator"].includes(node?.type)) {
          return true;
        }
        if (!node?.value || !Array.isArray(node.value)) {
          return true;
        }
        node.children = node.value;
        delete node.value;
        return true;
      });

      return ast;
    }
  }  
}
