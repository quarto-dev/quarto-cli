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
  ast = mapDeep(ast, findDimensionValues);
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
      ast.children = ast.children.map((v: any) => mapDeep(v, cb));
    }
    if (Array.isArray(ast.value)) {
      ast.value = ast.value.map((v: any) => mapDeep(v, cb));
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
  withType(outer, (node: any) => {
    const l = node.value?.length;
    if (node?.type !== "value" || l < 2) {
      return node;
    }
    if (node.value[l - 1]?.type !== "identifier" || 
      node.value[l - 1]?.value !== "default" ||
      node.value[l - 2]?.type !== "operator" ||
      node.value[l - 2]?.value !== "!") {
      return node;
    }
    return {
      ...node,
      value: node.value.slice(0, -2),
      isDefault: true,
    };
  });

const knownUnits: Set<string> = new Set([
  // found in 2024-07-29
  // length https://developer.mozilla.org/en-US/docs/Web/CSS/length,
  "cap", "ic", "lh", "rcap", "rch", "rex", "ric", "rlh", "vb", "vi", "cqw",
  "cqh", "cqi", "cqmin", "cqmax", 
  "Q",
  "rem", "em", "px", "pt", "pc", "cm", "mm", "in", "ex", "ch", "vw", "vh", "vmin", "vmax",
  // angle https://developer.mozilla.org/en-US/docs/Web/CSS/angle
  "deg", "grad", "rad", "turn",
  // time https://developer.mozilla.org/en-US/docs/Web/CSS/time
  "s", "ms",
  // resolution https://developer.mozilla.org/en-US/docs/Web/CSS/resolution
  "dpi", "dpcm", "dppx", "x",
  // frequency https://developer.mozilla.org/en-US/docs/Web/CSS/frequency
  "Hz", "kHz"
]);

// this also finds percentages
const findDimensionValues = (outer: any) =>
  withType(outer, (node: any) => {
    if (node?.type !== "value") {
      return node;
    }
    const value = node?.value;
    if (!Array.isArray(value)) {
      return node;
    }
    const newValues = [];
    for (let i = 0; i < value.length; ++i) {
      const thisValue = value[i];
      const nextValue = value[i + 1];
      if (thisValue?.type === "number" && 
        nextValue?.type === "identifier" && 
        knownUnits.has(nextValue?.value)) {
        newValues.push({
          ...thisValue,
          type: "dimension",
          unit: nextValue.value,
        });
        ++i;
      } else if (thisValue?.type === "number" &&
        nextValue?.type === "operator" &&
        nextValue?.value === "%") {
        // this might be chancy if there's stuff like (3 % 2) floating around
        // I couldn't find any in our .scss files, but :grimace:
        newValues.push({
          ...thisValue,
          type: "percentage",
        });
        ++i;
      } else {
        newValues.push(thisValue);
      }
    }
    return {
      ...node,
      value: newValues,
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
  true: { type: "boolean", value: true },
  null: { type: "null", value: null },
}

const fixImmediateTypes = (outer: any) =>
  withType(outer, (node: any) => {
    if (node.type === "identifier" && typedImmediateValues[node.value]) {
      return {...node, ...typedImmediateValues[node.value]};
    }
    return node;
  });

if (import.meta.main) {
  debugger;
  const ast = await getSassAst(Deno.readTextFileSync(Deno.args[0] || "/dev/stdin"));
  const cleaned = cleanSassAst(ast);
  console.log(JSON.stringify(cleaned.children.filter((v: any) => v.type === "declaration"
  && v.value.value[0].type === "identifier")));

  // for (const node of cleaned.children) {
  //   // boolean
  //   // color_hex
  //   // dimension
  //   // function
  //   // identifier
  //   // number
  //   // operator
  //   // parentheses
  //   // percentage
  //   // string_double
  //   // variable

  //   if (node?.type === "declaration") {
  //     const type = node?.value?.value[0]?.type;
  //     if (type === "identifier") {
  //       console.log(node);
  //     }
  //   }
  // }
  // walk(cleaned, (node: any) => {
  //   if (node?.type === "declaration") {
  //     console.log(node?.value?.value[0]?.type);
  //   }
  //   return true;
  // });
  // console.log(JSON.stringify(cleaned));
}