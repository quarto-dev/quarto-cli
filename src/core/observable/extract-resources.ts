/*
* extract-resources.ts
*
* Copyright (C) 2021 by RStudio, PBC
*
*/

import { dirname, relative, resolve } from "path/mod.ts";
import { parseModule } from "observablehq/parser";
import { make, simple } from "acorn/walk";
import { parse as parseES6 } from "acorn/acorn";

import { parseError } from "./errors.ts";

// we need to patch the base walker ourselves because OJS sometimes
// emits Program nodes with "cells" rather than "body"
// JJA: in the version of acorn that deno downloaded on my system
// a second argumento to make ('baseVisitor') is required. It looks
// like it can be 'undefined' though. you should probably update
// your acorn dependency and see if you see the same error
//
// ASK: Learn a better way to find deno installed deno deps than
// grepping for hashes in ~/Library/Caches
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
function localES6Imports(parse: any) {
  const result: string[] = [];
  simple(parse, {
    // deno-lint-ignore no-explicit-any
    ImportDeclaration(node: any) {
      const source = node.source?.value as string;
      if (source.startsWith("/") || source.startsWith(".")) {
        result.push(source);
      }
    },
  }, walkerBase);
  return result;
}

// deno-lint-ignore no-explicit-any
function literalFileAttachments(parse: any) {
  const result: string[] = [];
  simple(parse, {
    // deno-lint-ignore no-explicit-any
    CallExpression(node: any) {
      if (node.callee?.type !== "Identifier") {
        return;
      }
      if (node.callee?.name !== "FileAttachment") {
        return;
      }
      // deno-lint-ignore no-explicit-any
      const args = (node.arguments || []) as any[];
      if (args.length < 1) {
        return;
      }
      if (args[0]?.type !== "Literal") {
        return;
      }
      result.push(args[0]?.value);
    },
  }, walkerBase);
  return result;
}

function resolveES6Path(
  path: string,
  origin: string,
  projectRoot?: string,
) {
  if (path.startsWith("/")) {
    if (projectRoot === undefined) {
      return resolve(dirname(origin), `.${path}`);
    } else {
      return resolve(projectRoot, `.${path}`);
    }
  } else {
    // assert(path.startsWith('.'));
    return resolve(dirname(origin), path);
  }
}

interface NameWithOrigin {
  origin: string;
}

export function extractResources(
  ojsSource: string,
  mdFilename: string,
  projectRoot?: string,
) {
  // ES6 module walk
  let result: string[] = [];
  const imports: Map<string, NameWithOrigin> = new Map();
  let ojsAST;
  try {
    ojsAST = parseModule(ojsSource);
  } catch (e) {
    parseError(ojsSource);
    throw new Error();
  }
  for (const importPath of localES6Imports(ojsAST)) {
    const resolvedImportPath = resolveES6Path(
      importPath,
      mdFilename,
      projectRoot,
    );
    if (!imports.has(resolvedImportPath)) {
      imports.set(resolvedImportPath, {
        origin: mdFilename,
      });
      result.push(resolvedImportPath);
    }
  }
  while (imports.size > 0) {
    const [currentImport, { origin }] = imports.entries().next().value;
    imports.delete(currentImport);
    const contents = Deno.readTextFileSync(currentImport);
    const es6AST = parseES6(contents, {
      ecmaVersion: "2020",
      sourceType: "module",
    });
    const localImports = localES6Imports(es6AST);
    for (const importPath of localImports) {
      const resolvedImportPath = resolveES6Path(
        importPath,
        origin,
        projectRoot,
      );
      if (!imports.has(resolvedImportPath)) {
        imports.set(resolvedImportPath, {
          origin: currentImport,
        });
        result.push(resolvedImportPath);
      }
    }
  }
  // convert ES6 resolved paths to relative paths
  result = result.map((path) => relative(dirname(mdFilename), path));

  // add FileAttachment literals, which are always relative
  result.push(...literalFileAttachments(ojsAST));
  return result;
}
