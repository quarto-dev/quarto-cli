/*
* extract-resources.ts
*
* Copyright (C) 2021 by RStudio, PBC
*
*/

import { dirname, relative, resolve } from "path/mod.ts";
import { encode as base64Encode } from "encoding/base64.ts";
import { lookup } from "media_types/mod.ts";

import { parseModule } from "observablehq/parser";
import { make, simple } from "acorn/walk";
import { parse as parseES6 } from "acorn/acorn";

import { parseError } from "./errors.ts";

import { esbuildCompile } from "../../core/esbuild.ts";

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

/*
 * localImports walks the AST of either OJS source code
 * or JS source code to extract local imports
 */
// deno-lint-ignore no-explicit-any
function localImports(parse: any) {
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

function directDependencies(
  source: string,
  filename: string,
  language: "js" | "ojs",
  projectRoot?: string,
) {
  let ast;
  if (language === "js") {
    try {
      ast = parseES6(source, {
        ecmaVersion: "2020",
        sourceType: "module",
      });
    } catch (_e) {
      parseError(source);
      throw new Error();
    }
  } else {
    // language === "ojs"
    try {
      ast = parseModule(source);
    } catch (_e) {
      parseError(source);
      throw new Error();
    }
  }

  return localImports(ast).map((importPath) => {
    const resolvedImportPath = resolveES6Path(
      importPath,
      filename,
      projectRoot,
    );
    return {
      resolvedImportPath,
      filename,
      importPath,
    };
  });
}

export interface ResourceDescription {
  filename: string;
  referent?: string;
  // import statements have importPaths, the actual in-ast name used.
  // we need that in case of self-contained files to build local resolvers
  // correctly.
  importPath?: string;
  type: string;
}

export function extractResources(
  ojsSource: string,
  mdFilename: string,
  projectRoot?: string,
) {
  let result: ResourceDescription[] = [];
  const handled: Set<string> = new Set();
  const imports: Map<string, ResourceDescription> = new Map();

  // we're assuming that we always start in an {ojs} block.
  for (
    const { resolvedImportPath, filename, importPath } of directDependencies(
      ojsSource,
      mdFilename,
      "ojs",
      projectRoot,
    )
  ) {
    if (!imports.has(resolvedImportPath)) {
      const v = {
        filename: resolvedImportPath,
        referent: mdFilename,
        importPath,
        type: "import",
      };
      result.push(v);
      imports.set(resolvedImportPath, v);
    }
  }

  while (imports.size > 0) {
    const [thisResolvedImportPath, _resource] = imports.entries().next().value;
    imports.delete(thisResolvedImportPath);
    if (handled.has(thisResolvedImportPath)) {
      continue;
    }
    handled.add(thisResolvedImportPath);
    const source = Deno.readTextFileSync(thisResolvedImportPath);

    let language;
    if (thisResolvedImportPath.endsWith(".js")) {
      language = "js";
    } else if (thisResolvedImportPath.endsWith(".ojs")) {
      language = "ojs";
    } else {
      throw new Error(`Unknown language in file ${thisResolvedImportPath}`);
    }

    for (
      const { resolvedImportPath, filename, importPath } of directDependencies(
        source,
        thisResolvedImportPath,
        language as ("js" | "ojs"),
        projectRoot,
      )
    ) {
      if (!imports.has(resolvedImportPath)) {
        const v = {
          filename: resolvedImportPath,
          referent: thisResolvedImportPath,
          importPath,
          type: "import",
        };
        result.push(v);
        imports.set(resolvedImportPath, v);
      }
    }
  }

  // add FileAttachment literals, which are always relative
  const fileAttachments = [];
  for (const importFile of result) {
    if (importFile.filename.endsWith(".ojs")) {
      const ast = parseModule(Deno.readTextFileSync(importFile.filename));
      fileAttachments.push(...literalFileAttachments(ast));
    }
  }
  // also do it for the current .ojs chunk.
  const ast = parseModule(ojsSource);
  fileAttachments.push(...literalFileAttachments(ast));

  // convert resolved paths to relative paths
  result = result.map((description) => {
    const { referent, type, importPath } = description;
    let relName = relative(dirname(mdFilename), description.filename);
    if (!relName.startsWith(".")) {
      relName = `./${relName}`;
    }
    return {
      filename: relName,
      referent,
      importPath,
      type,
    };
  });

  result.push(...fileAttachments.map((filename) => ({
    filename,
    type: "FileAttachment",
  })));
  return result;
}

export function uniqueResources(
  resourceList: ResourceDescription[],
) {
  const result = [];
  const uniqResources = new Map<string, ResourceDescription>();
  for (const resource of resourceList) {
    if (!uniqResources.has(resource.filename)) {
      result.push(resource);
      uniqResources.set(resource.filename, resource);
    }
  }
  return result;
}

function asDataURL(
  content: string,
  mimeType: string,
) {
  const b64Src = base64Encode(content);
  return `data:${mimeType};base64,${b64Src}`;
}

export async function makeSelfContainedResources(
  resourceList: ResourceDescription[],
  wd: string,
) {
  const uniqResources = uniqueResources(resourceList);

  const jsFiles = uniqResources.filter((r) =>
    r.type === "import" && r.filename.endsWith(".js")
  );
  const ojsFiles = uniqResources.filter((r) =>
    r.type === "import" && r.filename.endsWith("ojs")
  );
  const attachments = uniqResources.filter((r) => r.type !== "import");

  const jsModuleResolves = [];
  if (jsFiles.length > 0) {
    const bundleInput = jsFiles
      .map((r) => `export * from "${r.filename}";`)
      .join("\n");
    const es6BundledModule = await esbuildCompile(
      bundleInput,
      wd,
      ["--target=es2018"],
    );

    const jsModule = asDataURL(
      es6BundledModule as string,
      "application/javascript",
    );
    jsModuleResolves.push(...jsFiles.map((f) => [f.importPath, jsModule])); // inefficient but browser caching makes it correct
  }
  const result = [
    ...jsModuleResolves,
    ...ojsFiles.map(
      (f) => [
        f.importPath,
        asDataURL(
          Deno.readTextFileSync(f.filename),
          "application/ojs-javascript",
        ),
      ],
    ),
    ...attachments.map(
      (f) => [
        f.filename,
        asDataURL(Deno.readTextFileSync(f.filename), lookup(f.filename)!),
      ],
    ),
  ];
  return result;
}
