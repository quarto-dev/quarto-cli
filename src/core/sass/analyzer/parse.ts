// our attempt at factoring out a clean parser
// that works in Deno and on the web

import { walk } from "./ast-utils.ts";
let counter = 1;
export const makeParserModule = (
  parse: any,
) => {
  return {
    getSassAst: (contents: string) => {
      // scss-parser doesn't support the `...` operator and it breaks their parser oO, so we remove it.
      // our analysis doesn't need to know about it.
      contents = contents.replaceAll("...", "_dot_dot_dot");
      // it also doesn't like some valid ways to do '@import url'
      contents = contents.replaceAll("@import url", "//@import url");

      // https://github.com/quarto-dev/quarto-cli/issues/11121
      // It also doesn't like empty rules

      // that long character class rule matches everything in \s except for \n
      // using the explanation from regex101.com as a reference
      contents = contents.replaceAll(
        /^[\t\f\v \u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]*([^\n{]+)([{])\s*([}])$/mg,
        "$1$2 /* empty rule */ $3",
      );

      // it also really doesn't like statements that don't end in a semicolon
      // so, in case you are reading this code to understand why the parser is failing,
      // ensure that your SCSS has semicolons at the end of every statement.
      // we try to work around this by adding semicolons at the end of declarations that don't have them
      contents = contents.replaceAll(
        /^(?!(?=\/\/)|(?=\s*[@#$]))(.*[^}/\s\n;])([\s\n]*)}(\n|$)/mg,
        "$1;$2}$3",
      );
      // It also doesn't like values that follow a colon directly without a space
      contents = contents.replaceAll(
        /(^\s*[A-Za-z0-9-]+):([^ \n])/mg,
        "$1: $2",
      );

      // This is relatively painful, because unfortunately the error message of scss-parser
      // is not helpful.

      // Create an AST from a string of SCSS
      // and convert it to a plain JSON object
      const ast = JSON.parse(JSON.stringify(parse(contents)));

      if (!(ast.type === "stylesheet")) {
        throw new Error("Expected AST to have type 'stylesheet'");
      }
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
    },
  };
};
