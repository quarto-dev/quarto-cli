/*
 * ojs-code-transform.ts
 *
 * Copyright (C) 2021-2023 Posit Software, PBC
 */

import { make, simple } from "acorn-walk";
import { generate } from "./escodegen.js";
import { parseModule } from "external-observablehq-parser";

// we need to patch the base walker ourselves because OJS sometimes
// emits Program nodes with "cells" rather than "body"
const walkerBase = make({
  Import() {},
  // deno-lint-ignore no-explicit-any
  ViewExpression(node, st, c) {
    c(node.id, st, "Identifier");
  },
  // deno-lint-ignore no-explicit-any
  MutableExpression(node, st, c) {
    c(node.id, st, "Identifier");
  },
  // deno-lint-ignore no-explicit-any
  Cell(node, st, c) {
    c(node.body, st);
  },
  // deno-lint-ignore no-explicit-any
  Program(node, st, c) {
    if (node.body) {
      for (let i = 0, list = node.body; i < list.length; i += 1) {
        const stmt = list[i];
        c(stmt, st, "Statement");
      }
    } else if (node.cells) {
      for (let i = 0, list = node.cells; i < list.length; i += 1) {
        const stmt = list[i];
        c(stmt, st);
      }
    } else {
      throw new Error(
        `OJS traversal: I don't know how to walk this node: ${node}`,
      );
    }
  },
});

// deno-lint-ignore no-explicit-any
export function ojsSimpleWalker(parse, visitor) {
  simple(parse, visitor, walkerBase);
}

function isPlotPlotCall(node) {
  if (node.type !== "CallExpression") {
    return null;
  }
  const callee = node.callee;
  if (callee.type !== "MemberExpression") {
    return null;
  }
  if (callee.property.type !== "Identifier" || 
      callee.property.name !== "plot") {
    return null;
  }

  let result = node.arguments;

  node = callee.object;
  while (true) {
    if (node.type === "Identifier" && 
        node.name === "Plot") {
      return result;
    }
    if (node.type !== "CallExpression" ||
        node.callee.type !== "MemberExpression") {
      return null;
    }
    node = node.callee.object;
  }
}


/*
Rewrites Plot.(method(...).method(...).)plot({
  ...
})
to
Plot.(method(...).method(...).)plot({
  width: card[$CARD_IN_SCOPE].width,
  height: card[$CARD_IN_SCOPE].height,
  ...
}) */
const multipleOutputCellMap = {};
function rewritePlotPlotCall(exp, cellName) {
  // First, check if cellName exists. If it doesn't,
  // then that's likely because we're on a multiple-output cell.
  // attempt to find a cell with the name cellName-1, cellName-2, etc.
  const fixupCellName = () => {
    if (document.getElementById(cellName) === null) {
      let index = 1;
      let subcellName;
      do {
        subcellName = `${cellName}-${index}`;
        index += 1;
        if (document.getElementById(subcellName) !== null && multipleOutputCellMap[subcellName] === undefined) {
          multipleOutputCellMap[subcellName] = true;
          return subcellName;
        }
      } while (document.getElementById(subcellName) !== null);
      return undefined;
    } else {
      return cellName;
    }
  }
  
  const args = isPlotPlotCall(exp);
  if (args === null) {
    return false;
  }
  if (args.length > 1) {
    return false;
  }
  if (args.length === 0) {
    args.push({
      type: "ObjectExpression",
      properties: []
    });
  }
  if (args[0].type !== "ObjectExpression") {
    return false;
  }

  const props = args[0].properties;
  // this will need to be more robust in the future.
  // deno-lint-ignore no-explicit-any
  if (!props.every((a) => a.type === "Property")) {
    return false;
  }
  // insert
  //     width: cards[cardIndex].width property
  // and height: cards[cardIndex].height property

  const cellNameToUse = fixupCellName();
  if (cellNameToUse === undefined) {
    return false;
  }
  const value = (field) => ({
    type: "MemberExpression",
    object: {
      type: "MemberExpression",
      computed: true,
      object: {
        type: "Identifier",
        name: "cards",
      },
      property: {
        type: "Literal",
        value: cellNameToUse,
      },
    },
    property: {
      type: "Identifier",
      name: field,
    },
  });
  const prop = (field) => ({
    type: "Property",
    key: {
      type: "Identifier",
      name: field,
    },
    value: value(field),
  });

  props.unshift(prop("width"));
  props.unshift(prop("height"));
  return true;
}

export function autosizeOJSPlot(
  src,
  cellName,
) {
  // deno-lint-ignore no-explicit-any
  let ast;
  try {
    ast = parseModule(src);
  } catch (e) {
    // if we fail to parse, don't do anything
    // FIXME warn?
    if (!(e instanceof SyntaxError)) throw e;
    return src;
  }
  ojsSimpleWalker(ast, {
    // deno-lint-ignore no-explicit-any
    CallExpression(exp) {
      if (rewritePlotPlotCall(exp, cellName)) {
        return;
      }
    }
  });

  const result = ast.cells.map((cell) => {
    const bodySrc = generate(cell.body);
    if (cell.id === null) {
      return bodySrc;
    } else if (cell.id.type === "Identifier") {
      return `${cell.id.name} = ${bodySrc}`;
    } else if (cell.id.type === "ViewExpression") {
      return `viewof ${cell.id.id.name} = ${bodySrc}`;
    } else if (cell.id.type === "MutableExpression") {
      return `mutable ${cell.id.id.name} = ${bodySrc}`;
    } else {
      throw new Error(`OJS: I don't know how to handle this cell id: ${cell.id.type}`);
    }
  }).join("\n");
  return result;
}

