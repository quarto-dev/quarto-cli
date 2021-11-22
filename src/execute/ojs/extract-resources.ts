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
import { parse as parseES6 } from "acorn/acorn";

import { esbuildCompile } from "../../core/esbuild.ts";
import { breakQuartoMd } from "../../core/break-quarto-md.ts";

import { jsParseError, ojsParseError } from "./errors.ts";
import { ojsSimpleWalker } from "./ojs-tools.ts";
import { MappedString, mappedConcat, asMappedString } from "../../core/mapped-text.ts";

// ResourceDescription filenames are always project-relative
export interface ResourceDescription {
  filename: string;
  referent?: string;
  // import statements have importPaths, the actual in-ast name used.
  // we need that in case of self-contained files to build local resolvers
  // correctly.
  importPath?: string;
  pathType: "relative" | "root-relative";
  resourceType: "import" | "FileAttachment";
}

// resolves a ResourceDescription's filename to its absolute path
export function resolveResourceFilename(
  resource: ResourceDescription,
  rootDir: string,
): string {
  if (resource.pathType == "relative") {
    const result = resolve(
      rootDir,
      dirname(resource.referent!),
      resource.filename,
    );
    return result;
  } else if (resource.pathType === "root-relative") {
    const result = resolve(
      rootDir,
      dirname(resource.referent!),
      `.${resource.filename}`,
    );
    return result;
  } else {
    throw new Error(`Unrecognized pathType ${resource.pathType}`);
  }
}

// drops resources with project-relative filenames
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

interface DirectDependency {
  resolvedImportPath: string;
  pathType: "relative" | "root-relative";
  importPath: string;
}

// Extracts the direct dependencies from a single js, ojs or qmd file
async function directDependencies(
  source: MappedString,
  fileDir: string,
  language: "js" | "ojs" | "qmd",
  projectRoot?: string,
): Promise<DirectDependency[]> {
  interface ResolvedES6Path {
    pathType: "root-relative" | "relative";
    resolvedImportPath: string;
  }

  const resolveES6Path = (
    path: string,
    originDir: string,
    projectRoot?: string,
  ): ResolvedES6Path => {
    if (path.startsWith("/")) {
      if (projectRoot === undefined) {
        return {
          pathType: "root-relative",
          resolvedImportPath: resolve(originDir, `.${path}`),
        };
      } else {
        return {
          pathType: "root-relative",
          resolvedImportPath: resolve(projectRoot, `.${path}`),
        };
      }
    } else {
      // Here, it's always the case that path.startsWith('.')
      return {
        pathType: "relative",
        resolvedImportPath: resolve(originDir, path),
      };
    }
  };

  /*
  * localImports walks the AST of either OJS source code
  * or JS source code to extract local imports
  */
  // deno-lint-ignore no-explicit-any
  const localImports = (parse: any) => {
    const result: string[] = [];
    ojsSimpleWalker(parse, {
      // deno-lint-ignore no-explicit-any
      ExportNamedDeclaration(node: any) {
        if (node.source?.value) {
          const source = node.source?.value as string;
          if (source.startsWith("/") || source.startsWith(".")) {
            result.push(source);
          }
        }
      },
      // deno-lint-ignore no-explicit-any
      ImportDeclaration(node: any) {
        const source = node.source?.value as string;
        if (source.startsWith("/") || source.startsWith(".")) {
          result.push(source);
        }
      },
    });
    return result;
  };

  let ast;
  if (language === "js") {
    try {
      ast = parseES6(source.value, {
        ecmaVersion: "2020",
        sourceType: "module",
      });
    } catch (e) {
      if (!(e instanceof SyntaxError)) {
        throw e;
      }
      return [];
    }
  } else if (language === "ojs") {
    // console.log("WE ARE HERE");
    // console.log(source.value);
    // console.log("======");
    // console.log(source.originalString);
    // console.log("======");
    try {
      ast = parseModule(source.value);
    } catch (e) {
      // we don't chase dependencies if there are parse errors.
      // we also don't report errors, because that would have happened elsewhere.
      // ojsParseError(e, source);
      // throw new Error();
      if (!(e instanceof SyntaxError)) {
        throw e;
      }
      return [];
    }
  } else {
    // language === "qmd"
    const ojsCellsSrc = (await breakQuartoMd(source))
      .cells
      .filter((cell) =>
        cell.cell_type !== "markdown" &&
        cell.cell_type !== "raw" &&
        cell.cell_type !== "math" &&
        cell.cell_type?.language === "ojs"
      )
      .flatMap((v) => v.source); // (concat)
    return await directDependencies(mappedConcat(ojsCellsSrc), fileDir, "ojs", projectRoot);
  }

  return localImports(ast).map((importPath) => {
    const { resolvedImportPath, pathType } = resolveES6Path(
      importPath,
      fileDir,
      projectRoot,
    );
    return {
      resolvedImportPath,
      pathType,
      importPath,
    };
  });
}

export async function extractResolvedResourceFilenamesFromQmd(
  markdown: MappedString,
  mdDir: string,
  projectRoot: string,
) {
  const pageResources = [];

  for (const cell of (await breakQuartoMd(markdown)).cells) {
    if (
      cell.cell_type !== "markdown" &&
      cell.cell_type !== "raw" &&
      cell.cell_type !== "math" &&
      cell.cell_type?.language === "ojs"
    ) {
      pageResources.push(...(await extractResourceDescriptionsFromOJSChunk(
        cell.source,
        mdDir,
        projectRoot,
      )));
    }
  }

  // after converting root-relative and relative paths
  // all to absolute, we might once again have duplicates.
  // We need another uniquing pass here.
  const result = new Set<string>();
  for (const resource of uniqueResources(pageResources)) {
    result.add(resolveResourceFilename(resource, Deno.cwd()));
  }
  return Array.from(result);
}

export async function extractResourceDescriptionsFromOJSChunk(
  ojsSource: MappedString,
  mdDir: string,
  projectRoot?: string,
) {
  /*
  * literalFileAttachments walks the AST to extract the filenames
  * in 'FileAttachment(string)' expressions
  */
  // deno-lint-ignore no-explicit-any
  const literalFileAttachments = (parse: any) => {
    const result: string[] = [];
    ojsSimpleWalker(parse, {
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
    });
    return result;
  };

  let result: ResourceDescription[] = [];
  const handled: Set<string> = new Set();
  const imports: Map<string, ResourceDescription> = new Map();

  // FIXME get a uuid here
  const rootReferent = `${mdDir}/<<root>>.qmd`;

  // we're assuming that we always start in an {ojs} block.
  for (
    const { resolvedImportPath, pathType, importPath } of await directDependencies(
      ojsSource,
      mdDir,
      "ojs",
      projectRoot,
    )
  ) {
    if (!imports.has(resolvedImportPath)) {
      const v: ResourceDescription = {
        filename: resolvedImportPath,
        referent: rootReferent,
        pathType,
        importPath,
        resourceType: "import",
      };
      result.push(v);
      imports.set(resolvedImportPath, v);
    }
  }

  while (imports.size > 0) {
    const [thisResolvedImportPath, importResource] =
      imports.entries().next().value;
    imports.delete(thisResolvedImportPath);
    if (handled.has(thisResolvedImportPath)) {
      continue;
    }
    handled.add(thisResolvedImportPath);
    let source;
    try {
      source = Deno.readTextFileSync(thisResolvedImportPath);
    } catch (_e) {
      console.error(
        `WARNING: While following dependencies, could not resolve reference:`,
      );
      console.error(`  Reference: ${importResource.importPath}`);
      console.error(`  In file: ${importResource.referent}`);
      continue;
    }

    let language;
    if (thisResolvedImportPath.endsWith(".js")) {
      language = "js";
    } else if (thisResolvedImportPath.endsWith(".ojs")) {
      language = "ojs";
    } else if (thisResolvedImportPath.endsWith(".qmd")) {
      language = "qmd";
    } else {
      throw new Error(
        `Unknown language "${language}" in file "${thisResolvedImportPath}"`,
      );
    }

    for (
      const { resolvedImportPath, pathType, importPath } of await directDependencies(
        asMappedString(source),
        dirname(thisResolvedImportPath),
        language as ("js" | "ojs" | "qmd"),
        projectRoot,
      )
    ) {
      if (!imports.has(resolvedImportPath)) {
        const v: ResourceDescription = {
          filename: resolvedImportPath,
          referent: thisResolvedImportPath,
          pathType,
          importPath,
          resourceType: "import",
        };
        result.push(v);
        imports.set(resolvedImportPath, v);
      }
    }
  }

  const fileAttachments = [];
  for (const importFile of result) {
    if (importFile.filename.endsWith(".ojs")) {
      try {
        const ast = parseModule(Deno.readTextFileSync(importFile.filename));
        for (const attachment of literalFileAttachments(ast)) {
          fileAttachments.push({
            filename: attachment,
            referent: importFile.filename,
          });
        }
      } catch (e) {
        if (!(e instanceof SyntaxError)) {
          throw e;
        }
      }
    }
  }
  // also do it for the current .ojs chunk.
  try {
    const ast = parseModule(ojsSource.value);
    for (const attachment of literalFileAttachments(ast)) {
      fileAttachments.push({
        filename: attachment,
        referent: rootReferent,
      });
    }
  } catch (e) {
    // ignore parse errors
    if (!(e instanceof SyntaxError)) {
      throw e;
    }
  }

  // while traversing the reference graph, we want to
  // keep around the ".qmd" references which arise from
  // import ... from "[...].qmd". But we don't want
  // qmd files to end up as actual resources to be copied
  // to _site, so we filter them out here.

  result = result.filter((description) =>
    !description.filename.endsWith(".qmd")
  );

  // convert relative resolved paths to relative paths
  result = result.map((description) => {
    const { referent, resourceType, importPath, pathType } = description;
    if (pathType === "relative") {
      let relName = relative(mdDir, description.filename);
      if (!relName.startsWith(".")) {
        relName = `./${relName}`;
      }
      return {
        filename: relName,
        referent,
        importPath,
        pathType,
        resourceType,
      };
    } else {
      return description;
    }
  });

  result.push(...fileAttachments.map(({ filename, referent }) => {
    let pathType;
    if (filename.startsWith("/")) {
      pathType = "root-relative";
    } else {
      pathType = "relative";
    }

    // FIXME why can't the TypeScript typechecker realize this cast is unneeded?
    // it complains about pathType and resourceType being strings
    // rather than one of their two respectively allowed values.
    return ({
      referent,
      filename,
      pathType,
      resourceType: "FileAttachment",
    }) as ResourceDescription;
  }));
  return result;
}

/* creates a list of [project-relative-name, data-url] values suitable
* for inclusion in self-contained files
*/
export async function makeSelfContainedResources(
  resourceList: ResourceDescription[],
  wd: string,
) {
  const asDataURL = (
    content: string,
    mimeType: string,
  ) => {
    const b64Src = base64Encode(content);
    return `data:${mimeType};base64,${b64Src}`;
  };

  const uniqResources = uniqueResources(resourceList);

  const jsFiles = uniqResources.filter((r) =>
    r.resourceType === "import" && r.filename.endsWith(".js")
  );
  const ojsFiles = uniqResources.filter((r) =>
    r.resourceType === "import" && r.filename.endsWith("ojs")
  );
  const attachments = uniqResources.filter((r) => r.resourceType !== "import");

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
        // FIXME is this one also wrong?
        f.importPath,
        asDataURL(
          Deno.readTextFileSync(f.filename),
          "application/ojs-javascript",
        ),
      ],
    ),
    ...attachments.map(
      (f) => {
        const resolvedFileName = resolveResourceFilename(f, Deno.cwd());
        return [
          f.filename,
          asDataURL(
            Deno.readTextFileSync(resolvedFileName),
            lookup(resolvedFileName)!,
          ),
        ];
      },
    ),
  ];
  return result;
}
