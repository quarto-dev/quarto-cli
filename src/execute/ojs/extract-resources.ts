/*
 * extract-resources.ts
 *
 * Copyright (C) 2021-2022 Posit Software, PBC
 */

import * as colors from "fmt/colors.ts";
import { dirname, fromFileUrl, relative, resolve } from "../../deno_ral/path.ts";
import { encodeBase64 } from "encoding/base64.ts";
import { lookup } from "media_types/mod.ts";

import { parseModule } from "observablehq/parser";
import { parse as parseES6 } from "acorn/acorn";

import { esbuildCommand, esbuildCompile } from "../../core/esbuild.ts";
import { breakQuartoMd } from "../../core/lib/break-quarto-md.ts";

import { ojsSimpleWalker } from "./ojs-tools.ts";
import {
  asMappedString,
  mappedConcat,
  MappedString,
} from "../../core/mapped-text.ts";
import { QuartoMdCell } from "../../core/lib/break-quarto-md.ts";
import { getNamedLifetime } from "../../core/lifetimes.ts";
import { resourcePath } from "../../core/resources.ts";
import { error } from "../../deno_ral/log.ts";
import { stripColor } from "../../core/lib/external/colors.ts";
import { lines } from "../../core/lib/text.ts";
import { InternalError } from "../../core/lib/error.ts";
import { kRenderServicesLifetime } from "../../config/constants.ts";

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

interface DirectDependency {
  resolvedImportPath: string;
  pathType: "relative" | "root-relative";
  importPath: string;
}

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

// Extracts the direct dependencies from a single js, ojs or qmd file
async function directDependencies(
  source: MappedString,
  fileDir: string,
  language: "js" | "ojs" | "qmd",
  projectRoot?: string,
): Promise<DirectDependency[]> {
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
    // try to parse the module, and don't chase dependencies in case
    // of a parse error. The actual dependencies will be analyzed from the ast
    // below.
    try {
      ast = parseModule(source.value);
    } catch (e) {
      if (!(e instanceof SyntaxError)) throw e;
      return [];
    }
  } else {
    // language === "qmd"
    const ojsCellsSrc = (await breakQuartoMd(source))
      .cells
      .filter((cell: QuartoMdCell) =>
        cell.cell_type !== "markdown" &&
        cell.cell_type !== "raw" &&
        cell.cell_type?.language === "ojs"
      )
      .flatMap((v: QuartoMdCell) => v.source); // (concat)
    return await directDependencies(
      mappedConcat(ojsCellsSrc),
      fileDir,
      "ojs",
      projectRoot,
    );
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
      cell.cell_type?.language === "ojs"
    ) {
      pageResources.push(
        ...(await extractResourceDescriptionsFromOJSChunk(
          cell.source,
          mdDir,
          projectRoot,
        )),
      );
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

/**
 * Resolves an import, potentially compiling typescript to javascript in the process
 *
 * @param file filename
 * @param referent referent file
 * @param projectRoot project root, if it exists. Used to check for ts dependencies
 *      that reach outside of project root, in which case we emit an error
 * @returns {
 *   source: string - the resulting source file of the import, used to chase dependencies
 *   createdResources: ResourceDescription[] - when compilation happens, returns array
 *     of created files, so that later cleanup is possible.
 * }
 */
async function resolveImport(
  file: string,
  referent: string,
  projectRoot: string | undefined,
  mdDir: string,
  visited?: Set<string>,
): Promise<
  {
    source: string;
    createdResources: ResourceDescription[];
  }
> {
  visited = visited ?? new Set();
  let source: string;
  const createdResources: ResourceDescription[] = [];
  if (!file.endsWith(".ts") && !file.endsWith(".tsx")) {
    try {
      source = Deno.readTextFileSync(file);
    } catch (_e) {
      error(`OJS dependency ${file} (from ${referent}) not found.`);
      throw new Error();
    }
    // file existed, everything is fine.
    return {
      source,
      createdResources,
    };
  }

  // now for the hard case, it's a typescript import. We:

  // - use esbuild to compile all the dependencies into javascript
  // - transform the import statements so they work on the browser
  // - place the files in the right locations
  // - report the created resources for future cleanup.

  // note that we "lie" about the source of a typescript import.
  // we report the javascript compiled source that exists as the source of the created ".js" file
  // instead of the ".ts[x]" file (which won't exist in the project output directory).
  // We do this because we know that
  // the {ojs} cell will be transformed to refer to that ".js" file later.

  projectRoot = projectRoot ?? dirname(referent);

  const deno = Deno.execPath();
  const p = Deno.run({
    cmd: [
      deno,
      "check",
      file,
      "-c",
      resourcePath("conf/deno-ts-compile.jsonc"),
      `--importmap=${resourcePath("conf/jsx-import-map.json")}`,
    ],
    stderr: "piped",
  });
  const [status, stderr] = await Promise.all([p.status(), p.stderrOutput()]);
  if (!status.success) {
    error("Compilation of typescript dependencies in ojs cell failed.");

    let errStr = new TextDecoder().decode(stderr);
    const errorLines = lines(stripColor(errStr));

    // offer guidance around deno bug https://github.com/denoland/deno/issues/14723
    const denoBugErrorLines = errorLines
      .map((l, i) => ({ text: l, line: i }))
      .filter((x) =>
        x.text.trim().indexOf(
          "TS7026 [ERROR]: JSX element implicitly has type 'any' because no interface 'JSX.IntrinsicElements' exists.",
        ) !== -1
      );

    console.log(errorLines);
    const errorCountRe = /^Found (\d+) errors.$/;
    const errorCount = Number(
      (errorLines.filter((x) => (x.trim().match(errorCountRe)))[0] ??
        "Found 1 errors.").match(errorCountRe)![1],
    );

    // attempt to patch the original error message
    if (denoBugErrorLines.length > 0) {
      const m = errorLines[denoBugErrorLines[0].line + 3].trim().match(
        /^.*(file:.+):\d+:\d+$/,
      );
      if (m === null) {
        // this is an internal error, but we do the best we can by simply printing out the
        // error as we know it
        console.log(errStr);
        throw new InternalError("Internal error in deno ojs cell compilation.");
      }

      const badFile = fromFileUrl(m[1]);
      const badContents = Deno.readTextFileSync(badFile);
      if (!badContents.startsWith("/** @jsxImportSource quarto-tsx */")) {
        console.log(`
File ${colors.red(badFile)} must start with

${colors.yellow("/** @jsxImportSource quarto-tsx */")}

We apologize for the inconvenience; this is a temporary workaround for an upstream bug.
`);
      }

      if (denoBugErrorLines.length !== errorCount) {
        console.log(`Other compilation errors follow below.\n`);

        let colorErrorLines = lines(errStr);
        for (let i = denoBugErrorLines.length - 1; i >= 0; i--) {
          colorErrorLines.splice(denoBugErrorLines[i].line, 5);
        }
        colorErrorLines = colorErrorLines.map((line) => {
          if (line.match(errorCountRe)) {
            return `Found ${errorCount - denoBugErrorLines.length} errors.`;
          }
          return line;
        });
        // skip "check..." since we already printed the file name
        errStr = colorErrorLines.slice(1).join("\n");
      }
      throw new Error();
    }
    console.log(errStr);
    throw new Error();
  }

  const localFile = file.replace(/[.]ts$/, ".js").replace(/[.]tsx$/, ".js");
  const fileDir = dirname(localFile);
  if (!fileDir.startsWith(resolve(projectRoot))) {
    error(
      `ERROR: File ${file} has typescript import dependency ${localFile},
outside of main folder ${resolve(projectRoot)}. 
quarto will only generate javascript files in ${
        resolve(projectRoot)
      } or subfolders.`,
    );
    throw new Error();
  }

  const jsSource = await esbuildCommand(
    [
      file,
      "--format=esm",
      "--sourcemap=inline",
      "--jsx-factory=window._ojs.jsx.createElement",
    ],
    "",
    fileDir,
  );

  if (typeof jsSource === "undefined") {
    throw new InternalError(
      `esbuild compilation of file ${file} failed`,
    );
  }

  let fixedSource = jsSource;

  const ast = parseES6(jsSource, {
    ecmaVersion: "2020",
    sourceType: "module",
  });
  const recursionList: string[] = [];
  // deno-lint-ignore no-explicit-any
  const patchDeclaration = (node: any) => {
    if (
      node.source?.value.endsWith(".ts") ||
      node.source?.value.endsWith(".tsx")
    ) {
      recursionList.push(node.source.value);
      const rawReplacement = JSON.stringify(
        node.source.value.replace(/[.]ts$/, ".js").replace(/[.]tsx$/, ".js"),
      );

      fixedSource = fixedSource.substring(0, node.source.start) +
        rawReplacement + fixedSource.slice(node.source.end);
    }
  };
  // patch the source to import from .js instead of .ts and .tsx
  ojsSimpleWalker(ast, {
    ExportNamedDeclaration: patchDeclaration,
    ImportDeclaration: patchDeclaration,
  });

  for (const tsImport of recursionList) {
    if (!(visited!.has(tsImport))) {
      visited.add(tsImport);
      const { createdResources: recursionCreatedResources } =
        await resolveImport(
          resolve(dirname(file), tsImport),
          file,
          projectRoot,
          mdDir,
          visited,
        );
      createdResources.push(...recursionCreatedResources);
    }
  }

  const transformedSource = fixedSource;
  Deno.writeTextFileSync(localFile, transformedSource);
  createdResources.push({
    pathType: "relative",
    resourceType: "import",
    referent,
    filename: resolve(dirname(referent!), localFile),
    importPath: `./${relative(resolve(mdDir), localFile)}`,
  });

  source = Deno.readTextFileSync(localFile);
  return { source, createdResources };
}

export async function extractResourceDescriptionsFromOJSChunk(
  ojsSource: MappedString,
  mdDir: string,
  projectRoot?: string,
) {
  let result: ResourceDescription[] = [];
  const handled: Set<string> = new Set();
  const imports: Map<string, ResourceDescription> = new Map();

  // FIXME get a uuid here
  const rootReferent = `${mdDir}/<<root>>.qmd`;

  // we're assuming that we always start in an {ojs} block.
  for (
    const { resolvedImportPath, pathType, importPath }
      of await directDependencies(
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
    const [thisResolvedImportPath, importResource]: [
      string,
      ResourceDescription,
    ] = imports.entries().next().value;
    imports.delete(thisResolvedImportPath);
    if (handled.has(thisResolvedImportPath)) {
      continue;
    }
    handled.add(thisResolvedImportPath);
    const resolvedImport = await resolveImport(
      thisResolvedImportPath,
      importResource.referent!,
      projectRoot,
      mdDir,
    ); // Deno.readTextFileSync(thisResolvedImportPath);
    if (resolvedImport === undefined) {
      console.error(
        `WARNING: While following dependencies, could not resolve reference:`,
      );
      console.error(`  Reference: ${importResource.importPath}`);
      console.error(`  In file: ${importResource.referent}`);
      continue;
    }
    const source = resolvedImport.source;
    result.push(...resolvedImport.createdResources);
    // if we're in a project, then we need to clean up at end of render-files lifetime
    if (projectRoot) {
      getNamedLifetime(kRenderServicesLifetime, true)!.attach({
        cleanup() {
          for (const res of resolvedImport.createdResources) {
            // it's possible to include a createdResource more than once if it's used
            // more than once, so we could end up with more than one request
            // to delete it. Fail gracefully if so.
            try {
              Deno.removeSync(res.filename);
            } catch (e) {
              if (e.name !== "NotFound") {
                throw e;
              }
            }
          }
          return;
        },
      });
    }
    let language;
    if (
      thisResolvedImportPath.endsWith(".js") ||
      thisResolvedImportPath.endsWith(".ts") ||
      thisResolvedImportPath.endsWith(".tsx")
    ) {
      language = "js";
    } else if (thisResolvedImportPath.endsWith(".ojs")) {
      language = "ojs";
    } else if (thisResolvedImportPath.endsWith(".qmd")) {
      language = "qmd";
    } else {
      throw new Error(
        `Unknown language in file "${thisResolvedImportPath}"`,
      );
    }

    for (
      const { resolvedImportPath, pathType, importPath }
        of await directDependencies(
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
  //
  // similarly, we filter out ".ts" and ".tsx" imports, since what
  // we need are the generated ".js" ones.

  result = result.filter((description) =>
    !description.filename.endsWith(".qmd") &&
    !description.filename.endsWith(".ts") &&
    !description.filename.endsWith(".tsx")
  );

  // convert resolved paths to relative paths
  result = result.map((description) => {
    const { referent, resourceType, importPath, pathType } = description;
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
    content: ArrayBuffer | string,
    mimeType: string,
  ) => {
    const b64Src = encodeBase64(content);
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
        const mimeType = lookup(resolvedFileName) ||
          "application/octet-stream";
        return [
          f.filename,
          asDataURL(
            Deno.readFileSync(resolvedFileName).buffer,
            mimeType,
          ),
        ];
      },
    ),
  ];
  return result;
}
