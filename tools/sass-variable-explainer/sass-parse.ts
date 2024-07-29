import { parse } from "npm:scss-parser";
import { assert } from "jsr:@std/assert";
import * as prettier from "npm:prettier";
import { walk } from "./walk.ts";

export const getSassAst = async (contents: string) => {
  // scss-parser doesn't support the `...` operator and it breaks their parser oO, so we remove it.
  // our analysis doesn't need to know about it.
  contents = contents.replaceAll("...", "_dot_dot_dot");

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

export const cleanSassAst = (ast: any) => {
  // clear out all the gunk from the AST
  ast = filterDeep(ast, isRealContent);
  ast = mapDeep(ast, simplifyLineInfo);
  ast = mapDeep(ast, explicitlyTagDefaultValues);
  ast = mapDeep(ast, fixImmediateTypes);

  // if the value array looks like an array of keys and values,
  // insert those values into the parent object
  // additionally, in these properties, if the value is an array
  // with a single element, remove the array and just use the
  // element.
  ast = mapDeep(ast, valueArrayToObjectKeys);

  return ast;
}

const withType = (node: any, func: (ast: any) => any) => {
  if (!node?.type) {
    return node;
  }
  return func(node);
}

const withTypeAndArray = (node: any, func: (ast: any) => any) => {
  if (!node?.type) {
    return node;
  }
  if (!node?.children || !Array.isArray(node.children)) {
    return node;
  }
  return func(node);
}

const filterDeep = (outer: any, cb: (v: any) => boolean): any =>
  withType(outer, (ast: any) => {
    return Object.fromEntries(Object.entries(ast).map(([k, v]) => {
      if (Array.isArray(v)) {
        return [k, v.filter(cb).map((v: any) => filterDeep(v, cb))];
      } else if (v && typeof v === "object") {
        return [k, filterDeep(v, cb)];
      } else {
        return [k, v];
      }
    }));
  });

const mapDeep = (outer: any, cb: (mapped: any) => any): any =>
  withType(outer, (ast: any) => {
    if (Array.isArray(ast.children)) {
      ast = {
        ...ast,
        children: ast.children.map((v: any) => mapDeep(v, cb))
      };
    }
    return cb(ast);
  });

const isRealContent = (v: any) => {
  if (!v?.type) {
    return true;
  }
  if (["space", "comment_singleline", "comment_multiline", "punctuation"].includes(v.type)) {
    return false;
  }
  return true;
}

const simplifyLineInfo = (outer: any) => 
  withType(outer, (node: any) => {
    const start = node?.start;
    const next = node?.next;
    return {
      ...node,
      start: undefined,
      next: undefined,
      line: start?.line
    }
  });

const explicitlyTagDefaultValues = (outer: any) =>
  withTypeAndArray(outer, (node: any) => {
    const l = node.children.length;
    if (node?.type !== "value" ||
      l < 2) {
      return node;
    }
    if (node.children[l - 1]?.type !== "identifier" || 
      node.children[l - 1]?.value !== "default" ||
      node.children[l - 2]?.type !== "operator" ||
      node.children[l - 2]?.value !== "!") {
      return node;
    }
    return {
      ...node,
      children: node.children.slice(0, -2),
      isDefault: true,
    };
  });

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

const typedImmediateValues: Record<string, any> = {
  false: { type: "boolean", value: false },
  true: { type: "boolean", value: false },
}

const fixImmediateTypes = (outer: any) =>
  withTypeAndArray(outer, (node: any) => {
    if (node.type === "identifier" && typedImmediateValues[node.children]) {
      return {...typedImmediateValues[node.children]};
    }
    return node;
  });

if (import.meta.main) {
  debugger;
  const ast = await getSassAst(Deno.readTextFileSync(Deno.args[0] || "/dev/stdin"));
  const cleaned = cleanSassAst(ast);
  console.log(JSON.stringify(cleaned));
}