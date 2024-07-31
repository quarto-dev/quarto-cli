import { parse } from "npm:scss-parser";
import { assert } from "jsr:@std/assert";
import * as prettier from "npm:prettier";
import { walk, withTypeAndArray, filterDeep, mapDeep, collect } from "./sass-analyzer/ast-utils.ts";
import { isRealContent, isNotPunctuation } from "./sass-analyzer/remove-nonsemantic-entries.ts";
import { simplifyLineInfo } from "./sass-analyzer/line-info.ts";
import { explicitlyTagDefaultValues } from "./sass-analyzer/default-declarations.ts";
import { fixImmediateTypes, tagNamedColors, tagColorConstructors, findDimensionValues } from "./sass-analyzer/value-types.ts";
import { propagateDeclarationTypes } from "./sass-analyzer/declaration-types.ts";
import { groupArguments } from "./sass-analyzer/group-arguments.ts";
import { getVariableDependencies } from "./sass-analyzer/get-dependencies.ts";
import { inverse } from "../../src/core/lib/external/colors.ts";

export const getSassAst = async (contents: string) => {
  // scss-parser doesn't support the `...` operator and it breaks their parser oO, so we remove it.
  // our analysis doesn't need to know about it.
  contents = contents.replaceAll("...", "_dot_dot_dot");
  // it also doesn't like some valid ways to do '@import url'
  contents = contents.replaceAll("@import url", "//@import url");

  // the scss-parser also apparently breaks on Quarto's SCSS unless it's
  // been prettified first :shrug:
  contents = await prettier.format(contents, { parser: "scss" });

  // Create an AST from a string of SCSS
  // and convert it to a plain JSON object
  const ast = JSON.parse(JSON.stringify(parse(contents)));

  assert(ast.type === "stylesheet");
  assert(Array.isArray(ast.value));

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

const drawColorDependencyGraph = (ast: any) => {
  const declarations = propagateDeclarationTypes(ast);

  // const declarations: Record<string, any> = {};
  // ast.children.forEach((node: any) => {
  //   if (node?.type === "declaration") {
  //     declarations[node.property.variable.value] = node;
  //   }
  // });

  let labelCount = 0;
  const labels: Map<string, string> = new Map();
  const dotNodeName = (name: string) => {
    if (labels.has(name)) {
      return { id: labels.get(name) };
    }
    const newName = `N${labelCount++}`;
    labels.set(name, newName);
    return { id: newName, nodeDecl: `${newName}[label="${name}"]` };
  }

  console.log("```{dot}");
  console.log("digraph G {\n  rankdir=LR;\n");
  console.log("  splines=false;");
  console.log("  node [shape=rectangle, color=gray]");
  console.log("  edge [color=gray]");

  const varDeps = getVariableDependencies(ast);
  const inverseVarDeps = new Map<string, Set<string>>();
  for (const [name, deps] of varDeps) {
    for (const dep of deps.dependencies) {
      if (!inverseVarDeps.has(dep)) {
        inverseVarDeps.set(dep, new Set());
      }
      if (declarations.get(name)?.valueType !== "color" ||
        declarations.get(dep)?.valueType !== "color") {
        continue;
      }
      inverseVarDeps.get(dep)!.add(name);
    }
  }
  
  for (const [name, deps] of varDeps) {
    if (deps.node.valueType !== "color") {
      continue;
    }
    // only show numbered colors if they have inverse dependencies
    // if (name.match(/^.+-[0-9]00$/) && !inverseVarDeps.get(name)?.size) {
    //   continue;
    // }
    for (const dep of deps.dependencies) {
      if (declarations.get(dep)?.valueType !== "color") {
        continue;
      }
      const {id: sourceId, nodeDecl: sourceNodeDecl } = dotNodeName(dep);
      const {id: targetId, nodeDecl: targetNodeDecl } = dotNodeName(name);
      if (sourceNodeDecl) {
        console.log(`  ${sourceNodeDecl}`);
      }
      if (targetNodeDecl) {
        console.log(`  ${targetNodeDecl}`);
      }

      console.log(`  ${sourceId} -> ${targetId}`);
    }
  }

  console.log("}");
  console.log("```");
}

if (import.meta.main) {
  const ast = await getSassAst(Deno.readTextFileSync(Deno.args[0] || "/dev/stdin"));
  let cleaned = cleanSassAst(ast);
  drawColorDependencyGraph(cleaned);
  // const declarations = propagateDeclarationTypes(cleaned);
  // for (const [name, node] of declarations) {
  //   if (node.valueType === "color") {
  //     console.log(name, node.line);
  //   }
  //   // console.log(name, node);
  // }
}