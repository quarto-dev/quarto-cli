/*
*
* ojs-tools.ts
*
* Copyright (C) 2021 by RStudio, PBC
*
*/

import { make, simple } from "acorn/walk";

// we need to patch the base walker ourselves because OJS sometimes
// emits Program nodes with "cells" rather than "body"
const walkerBase = make({
  Import() {},
  // deno-lint-ignore no-explicit-any
  ViewExpression(node: any, st: any, c: any) {
    c(node.id, st, "Identifier");
  },
  // deno-lint-ignore no-explicit-any
  MutableExpression(node: any, st: any, c: any) {
    c(node.id, st, "Identifier");
  },
  // deno-lint-ignore no-explicit-any
  Cell(node: any, st: any, c: any) {
    c(node.body, st);
  },
  // deno-lint-ignore no-explicit-any
  Program(node: any, st: any, c: any) {
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
      console.log("I don't know how to walk this node", node);
      throw new Error("Internal error while walking OJS source");
    }
  },
});

// deno-lint-ignore no-explicit-any
export function ojsSimpleWalker(parse: any, visitor: any) {
  simple(parse, visitor, walkerBase);
}
