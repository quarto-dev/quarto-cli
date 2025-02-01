import { withTypeAndArray, filterDeep, mapDeep } from "./ast-utils.ts";
import { isRealContent, isNotPunctuation } from "./remove-nonsemantic-entries.ts";
import { simplifyLineInfo } from "./line-info.ts";
import { explicitlyTagDefaultValues } from "./default-declarations.ts";
import { fixImmediateTypes, tagNamedColors, tagColorConstructors, findDimensionValues } from "./value-types.ts";
import { groupArguments } from "./group-arguments.ts";
import { forwardAnnotations } from "./forward-annotations.ts";

const valueArrayToObjectKeys = (outer: any) => 
  withTypeAndArray(outer, (node: any) => {
    const keys = node.children.map((v: any) => v.type);
    if (keys.length !== new Set(keys).size) {
      return node;
    }
    return {
      ...node,
      ...Object.fromEntries(node.children
        .map((v: any) => {
          const key = v.type;
          let children = v.children;
          return [key, {...v, children}];
        })),
    };
  });

export const cleanSassAst = (ast: any) => {
  // we now attempt to turn this glorified lexer into a real AST

  // before everything else, we associate declarations with the
  // annotations that tell us which part of the theming system
  // they belong to
  ast = forwardAnnotations(ast);

  // before clearing out the punctuation, group arguments
  ast = filterDeep(ast, isRealContent);
  ast = mapDeep(ast, groupArguments);

  // clear out all the gunk from the AST
  ast = filterDeep(ast, isNotPunctuation);

  ast = mapDeep(ast, simplifyLineInfo);
  ast = mapDeep(ast, explicitlyTagDefaultValues);
  ast = mapDeep(ast, findDimensionValues);
  ast = mapDeep(ast, fixImmediateTypes);
  ast = mapDeep(ast, tagColorConstructors);
  ast = mapDeep(ast, tagNamedColors);

  // if the value array looks like an array of keys and values,
  // insert those values into the parent object
  // additionally, in these properties, if the value is an array
  // with a single element, remove the array and just use the
  // element.
  ast = mapDeep(ast, valueArrayToObjectKeys);

  return ast;
}
