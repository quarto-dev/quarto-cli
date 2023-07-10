/*
 * jupyter-embed.ts
 *
 * Copyright (C) 2022 by Posit, PBC
 */

import { resourcePath } from "../resources.ts";
import { getNamedLifetime, ObjectWithLifetime } from "../lifetimes.ts";

import {
  jupyterAssets,
  jupyterFromFile,
  jupyterToMarkdown,
  kQuartoOutputDisplay,
  kQuartoOutputOrder,
} from "../jupyter/jupyter.ts";

import {
  kCellLabel,
  kFigDpi,
  kFigFormat,
  kFigPos,
  kKeepHidden,
} from "../../config/constants.ts";
import {
  isHtmlCompatible,
  isHtmlOutput,
  isIpynbOutput,
  isLatexOutput,
  isMarkdownOutput,
  isPresentationOutput,
} from "../../config/format.ts";
import { resolveParams } from "../../command/render/flags.ts";
import {
  RenderContext,
  RenderFlags,
  RenderServices,
} from "../../command/render/types.ts";
import {
  JupyterAssets,
  JupyterCell,
  JupyterCellOutput,
} from "../jupyter/types.ts";

import { dirname, extname, join } from "path/mod.ts";
import { languages } from "../handlers/base.ts";
import {
  extractJupyterWidgetDependencies,
  includesForJupyterWidgetDependencies,
} from "./widgets.ts";
import { globalTempContext } from "../temp.ts";
import { isAbsolute } from "path/mod.ts";
import { partitionMarkdown } from "../pandoc/pandoc-partition.ts";
import { normalizePath, safeExistsSync } from "../path.ts";
import { basename } from "path/mod.ts";
import { InternalError } from "../lib/error.ts";
import { ipynbFormat } from "../../format/ipynb/format-ipynb.ts";
import {
  kQmdIPynb,
  kRenderedIPynb,
  NotebookMetadata,
} from "../../render/notebook/notebook-types.ts";
import { ProjectContext } from "../../project/types.ts";
import { logProgress } from "../log.ts";
import * as ld from "../../../src/core/lodash.ts";

export interface JupyterNotebookAddress {
  path: string;
  ids?: string[];
  indexes?: number[];
}

export interface JupyterMarkdownOptions extends Record<string, unknown> {
  echo?: boolean;
  warning?: boolean;
  asis?: boolean;
  preserveCellMetadata?: boolean;
  filter?: (cell: JupyterCell) => boolean;
}

interface JupyterNotebookOutputCache extends ObjectWithLifetime {
  cache: Record<
    string,
    { outputs: JupyterCellOutput[]; title?: string }
  >;
}

const kEcho = "echo";
const kWarning = "warning";
const kOutput = "output";

const kHashRegex = /(.*?)#(.*)/;
const kIndexRegex = /(.*)\[([0-9,-]*)\]/;

const placeholderRegex = () => {
  return /<!-- 12A0366C\|(.*)\|:(.*?) \| (.*?) \| (.*?) -->/g;
};

const kNotebookCache = "notebook-cache";
const kRenderFileLifeTime = "render-file";

// Parses a notebook address string into a file path with
// an optional list of ids or list of cell indexes.
export function parseNotebookAddress(
  path: string,
): JupyterNotebookAddress | undefined {
  // This is a hash based path
  const hashResult = path.match(kHashRegex);
  if (hashResult) {
    const path = hashResult[1];
    if (isEmbeddable(path)) {
      return {
        path,
        ids: resolveCellIds(hashResult[2]),
      };
    } else {
      unsupportedEmbed(path);
    }
  }

  // This is an index based path
  const indexResult = path.match(kIndexRegex);
  if (indexResult) {
    const path = indexResult[1];
    if (isEmbeddable(path)) {
      return {
        path,
        indexes: resolveRange(indexResult[2]),
      };
    } else {
      unsupportedEmbed(path);
    }
  }

  // This is the path to a notebook
  if (isEmbeddable(path)) {
    return {
      path,
    };
  } else {
    unsupportedEmbed(path);
  }
}

function unsupportedEmbed(path: string) {
  throw new Error(
    `Unable to embed content from ${path}. Embedding currently only supports content from Juptyer Notebooks.`,
  );
}

export async function ensureNotebookContext(
  markdown: string,
  services: RenderServices,
  context?: ProjectContext,
) {
  const regex = placeholderRegex();
  let match = regex.exec(markdown);
  const nbsToRender: Array<{ path: string; name: string }> = [];

  while (match) {
    // Parse the address and if this is a notebook
    // then proceed with the replacement
    const inputPath = match[1];
    const nbAddr = match[2];
    const nbAddress = parseNotebookAddress(nbAddr);
    if (!nbAddress) {
      throw new InternalError(
        "Unexpected - there must be a notebook address since we matched.",
      );
    }
    const nbAbsPath = resolveNbPath(inputPath, nbAddress.path, context);
    if (!isNotebook(nbAbsPath)) {
      if (!services.notebook.get(nbAbsPath, context)?.[kQmdIPynb]) {
        nbsToRender.push({ path: nbAbsPath, name: nbAddress.path });
      }
    }
    match = regex.exec(markdown);
  }

  const uniqueRenders = ld.uniqBy(
    nbsToRender,
    (nb: { path: string }) => nb.path,
  ) as Array<{ path: string; name: string }>;
  if (uniqueRenders.length) {
    logProgress("Rendering qmd embeds");
  }
  let count = 0;
  for (const nb of uniqueRenders) {
    logProgress(`[${++count}/${uniqueRenders.length}] ${nb.name}`);

    // See if we can get a nice title
    const partitioned = partitionMarkdown(Deno.readTextFileSync(nb.path));
    let notebookMeta: NotebookMetadata | undefined;
    const filename = basename(nb.path);
    if (partitioned.yaml && partitioned.yaml.title) {
      notebookMeta = {
        title: partitioned.yaml.title as string,
        filename,
      };
    } else {
      notebookMeta = {
        title: filename,
        filename: filename,
      };
    }

    // Render the document
    await services.notebook.render(
      nb.path,
      ipynbFormat(),
      kQmdIPynb,
      services,
      notebookMeta,
      context,
    );
  }
}

// Creates a placeholder that will later be replaced with
// rendered notebook markdown. Note that the placeholder
// must stipulate all the information required to generate the
// markdown (e.g. options, output indexes and so on)
export function notebookMarkdownPlaceholder(
  input: string,
  nbPath: string,
  options: JupyterMarkdownOptions,
  outputs?: string,
) {
  return `<!-- 12A0366C|${input}|:${nbPath} | ${outputs || ""} | ${
    optionsToPlaceholder(options)
  } -->\n`;
}

// Replaces any notebook markdown placeholders with the
// rendered contents.
export async function replaceNotebookPlaceholders(
  to: string,
  context: RenderContext,
  flags: RenderFlags,
  markdown: string,
  services: RenderServices,
) {
  const assetCache: Record<string, JupyterAssets> = {};
  const regex = placeholderRegex();
  let match = regex.exec(markdown);
  let includes;
  const notebooks: string[] = [];
  while (match) {
    // Parse the address and if this is a notebook
    // then proceed with the replacement
    const inputPath = match[1];
    const nbAddressStr = match[2];

    const nbAddress = parseNotebookAddress(nbAddressStr);
    if (!nbAddress) {
      throw new InternalError(
        "Expected to find a valid notebook address string for an embed.",
      );
    }

    // This holds the notebook path that will end being used
    // for reading the embed
    const nbAbsPath = resolveNbPath(inputPath, nbAddress.path, context.project);

    let assets = assetCache[inputPath];
    if (!assets) {
      assets = jupyterAssets(
        inputPath,
        to,
      );
      assetCache[inputPath] = assets;
    }

    if (nbAddress) {
      // If a list of outputs are provided, resolve that range
      const outputsStr = match[3];
      const nbOutputs = outputsStr ? resolveRange(outputsStr) : undefined;

      // If cell options are provided, resolve those
      const placeholderStr = match[4];
      const nbOptions = placeholderStr
        ? placeholderToOptions(placeholderStr)
        : {};

      // Compute appropriate includes based upon the note
      // dependendencies
      const notebookIncludes = () => {
        if (safeExistsSync(nbAbsPath)) {
          const notebook = jupyterFromNotebookOrQmd(
            nbAbsPath,
            services,
            context.project,
          );

          const dependencies = isHtmlOutput(context.format.pandoc)
            ? extractJupyterWidgetDependencies(notebook)
            : undefined;
          if (dependencies) {
            const tempDir = globalTempContext().createDir();
            return includesForJupyterWidgetDependencies(
              [dependencies],
              tempDir,
            );
          } else {
            return undefined;
          }
        } else {
          throw new Error(
            `Unable to embed content from notebook '${nbAddress.path}'\nThe file ${nbAbsPath} doesn't exist or cannot be read.`,
          );
        }
      };
      includes = notebookIncludes();

      // Render the notebook markdown
      const nbMarkdown = await notebookMarkdown(
        inputPath,
        nbAddress,
        assets,
        context,
        flags,
        nbOptions,
        nbOutputs,
      );

      if (nbMarkdown && !notebooks.includes(nbAddress.path)) {
        notebooks.push(nbAddress.path);
      }

      // Replace the placeholders with the rendered markdown
      markdown = markdown.replaceAll(match[0], nbMarkdown || "");
    }
    match = regex.exec(markdown);
  }
  regex.lastIndex = 0;

  const supporting = Object.values(assetCache).map((assets) => {
    return join(assets.base_dir, assets.supporting_dir);
  });

  return {
    notebooks,
    includes,
    markdown,
    supporting,
  };
}

function resolveNbPath(input: string, path: string, context?: ProjectContext) {
  if (isAbsolute(path)) {
    return path;
  } else {
    if (isAbsolute(input)) {
      return join(dirname(input), path);
    } else {
      const baseDir = context ? context.dir : Deno.cwd();
      return join(baseDir, dirname(input), path);
    }
  }
}

// Gets the markdown for a specific notebook and set of options
export async function notebookMarkdown(
  inputPath: string,
  nbAddress: JupyterNotebookAddress,
  assets: JupyterAssets,
  context: RenderContext,
  flags: RenderFlags,
  options?: JupyterMarkdownOptions,
  outputs?: number[],
) {
  // Get the cell outputs for this notebook
  const notebookInfo = await getCachedNotebookInfo(
    inputPath,
    nbAddress,
    assets,
    context,
    flags,
    options,
    outputs,
  );

  // This notebook is empty
  if (notebookInfo.outputs.length === 0) {
    return undefined;
  }

  // Wrap any injected cells with a div that includes a back link to
  // the notebook that originated the cells
  const notebookMarkdown = (
    nbAddress: JupyterNotebookAddress,
    cells: JupyterCellOutput[],
    title?: string,
  ) => {
    const cellId = cells.length > 0 ? cells[0].id || "" : "";
    const markdown = [
      "",
      `:::{.quarto-embed-nb-cell notebook="${nbAddress.path}" ${
        title ? `notebook-title="${title}"` : ""
      } notebook-cellId="${cellId}"}`,
    ];

    const cellOutput = cells.map((cell) => cell.markdown).join("");
    markdown.push("");
    markdown.push(cellOutput);
    markdown.push("");
    markdown.push(":::");
    return markdown.join("\n");
  };

  if (nbAddress.ids) {
    // If cellIds are present, filter the notebook to only include
    // those cells (cellIds can eiher be an explicitly set cellId, a label in the
    // cell metadata, or a tag on a cell that matches an id)
    const theCells = nbAddress.ids.map((id) => {
      const cell = cellForId(id, notebookInfo.outputs);
      if (cell === undefined) {
        throw new Error(
          `The cell ${id} does not exist in notebook`,
        );
      } else if (cell.markdown.trim() === "") {
        throw new Error(
          `The notebook ${nbAddress.path} doesn't contain output to embed with the cell id, tag, or label '${id}'. Please be sure to have executed any cells that you are embedding.`,
        );
      } else {
        return cell;
      }
    });
    return notebookMarkdown(nbAddress, theCells, notebookInfo.title);
  } else if (nbAddress.indexes) {
    // Filter and sort based upon cell indexes
    const theCells = nbAddress.indexes.map((idx) => {
      if (idx < 1 || idx > notebookInfo.outputs.length) {
        throw new Error(
          `The cell index ${idx} isn't within the range of cells`,
        );
      } else {
        const cell = notebookInfo.outputs[idx - 1];
        if (cell.markdown.trim() === "") {
          throw new Error(
            `The notebook ${nbAddress.path} doesn't contain output to embed for the cell in position ${idx}. Please be sure to have executed any cells that you are embedding.`,
          );
        }
        return cell;
      }
    });
    return notebookMarkdown(nbAddress, theCells, notebookInfo.title);
  } else {
    // Return all the cell outputs as there is no addtional
    // specification of cells
    const notebookMd = notebookMarkdown(
      nbAddress,
      notebookInfo.outputs,
      notebookInfo.title,
    );
    if (notebookMd.trim() === "") {
      throw new Error(
        `The notebook ${nbAddress.path} doesn't contain output to embed. Please be sure to have executed any cells that you are embedding.`,
      );
    } else {
      return notebookMd;
    }
  }
}

const isNotebook = (path: string) => {
  return extname(path) === ".ipynb";
};

const isEmbeddable = (path: string) => {
  return isNotebook(path) || extname(path) === ".qmd";
};

// Caches the notebook info for a a particular notebook and
// set of options. Since the markdown is what is cached,
// the cache will include options that control markdown output
// when determining whether it can use cached contents.
async function getCachedNotebookInfo(
  inputPath: string,
  nbAddress: JupyterNotebookAddress,
  assets: JupyterAssets,
  context: RenderContext,
  flags: RenderFlags,
  options?: JupyterMarkdownOptions,
  outputs?: number[],
) {
  // We can cache outputs on a per rendered file basis to
  // improve performance
  const lifetime = getNamedLifetime(kRenderFileLifeTime);
  if (lifetime === undefined) {
    throw new InternalError(`named lifetime ${kRenderFileLifeTime} not found`);
  }
  const nbCache =
    lifetime.get(kNotebookCache) as unknown as JupyterNotebookOutputCache ||
    {
      cache: {},
      cleanup: () => {
      },
    };

  // Compute a cache key
  const cacheKey = notebookCacheKey(
    inputPath,
    nbAddress,
    assets,
    options,
    outputs,
  );
  if (!nbCache.cache[cacheKey]) {
    // Render the notebook and place it in the cache
    // Read and filter notebook

    const nbAbsPath = resolveNbPath(inputPath, nbAddress.path, context.project);

    // See if we can resolve non-notebooks. Note that this
    // requires that we have pre-rendered any notebooks that we discover
    // along the embed pipeline
    const notebook = jupyterFromNotebookOrQmd(
      nbAbsPath,
      context.options.services,
      context.project,
    );
    if (options) {
      notebook.cells = notebook.cells.map((cell) => {
        if (options.echo !== undefined) {
          cell.metadata[kEcho] = options.echo;
        }

        if (options.warning !== undefined) {
          cell.metadata[kWarning] = options.warning;
        }

        if (options.asis !== undefined) {
          cell.metadata[kOutput] = options.asis ? true : false;
        }

        // Filter outputs if so desired
        if (outputs && cell.outputs) {
          cell.outputs = cell.outputs.map((output, index) => {
            const oneBasedIdx = index + 1;
            output.metadata = output.metadata || {};
            if (!outputs.includes(oneBasedIdx)) {
              output.metadata[kQuartoOutputDisplay] = false;
            } else {
              const explicitOrder = outputs.indexOf(oneBasedIdx);
              if (explicitOrder > -1) {
                output.metadata[kQuartoOutputOrder] = explicitOrder;
              }
            }
            return output;
          });
        }
        return cell;
      });
    }

    // Filter the cells, if applicable
    if (options?.filter) {
      notebook.cells = notebook.cells.filter((cell) => {
        if (options?.filter) {
          return options?.filter(cell);
        } else {
          return true;
        }
      });
    }

    // Get the markdown for the notebook
    const format = context.format;
    const executeOptions = {
      target: context.target,
      resourceDir: resourcePath(),
      tempDir: context.options.services.temp.createDir(),
      dependencies: true,
      libDir: context.libDir,
      format: context.format,
      projectDir: context.project?.dir,
      cwd: flags.executeDir ||
        dirname(normalizePath(context.target.source)),
      params: resolveParams(flags.params, flags.paramsFile),
      quiet: flags.quiet,
      previewServer: context.options.previewServer,
      handledLanguages: languages(),
    };
    const result = await jupyterToMarkdown(
      notebook,
      {
        executeOptions,
        language: notebook.metadata.kernelspec.language.toLowerCase(),
        assets,
        execute: format.execute,
        keepHidden: format.render[kKeepHidden],
        preserveCellMetadata: options?.preserveCellMetadata,
        toHtml: isHtmlCompatible(format),
        toLatex: isLatexOutput(format.pandoc),
        toMarkdown: isMarkdownOutput(format),
        toIpynb: isIpynbOutput(format.pandoc),
        toPresentation: isPresentationOutput(format.pandoc),
        figFormat: format.execute[kFigFormat],
        figDpi: format.execute[kFigDpi],
        figPos: format.render[kFigPos],
        fixups: "minimal",
      },
    );

    // Compute the notebook title
    const title = findTitle(result.cellOutputs);

    // Place the outputs in the cache
    nbCache.cache[cacheKey] = { outputs: result.cellOutputs, title };
    lifetime.attach(nbCache, kNotebookCache);
  }
  return nbCache.cache[cacheKey];
}

// Tries to find a title within a Notebook
function findTitle(cells: JupyterCellOutput[]) {
  for (const cell of cells) {
    const partitioned = partitionMarkdown(cell.markdown);
    if (partitioned.yaml?.title) {
      return partitioned.yaml.title as string;
    } else if (partitioned.headingText) {
      return partitioned.headingText;
    }
  }
  return undefined;
}

// Create a notebook hash key for the cache
// that incorporates options that affect markdown
// output
function notebookCacheKey(
  inputPath: string,
  nbAddress: JupyterNotebookAddress,
  assets: JupyterAssets,
  nbOptions?: JupyterMarkdownOptions,
  nbOutputs?: number[],
) {
  const optionsKey = nbOptions
    ? Object.keys(nbOptions).reduce((current, key) => {
      if (
        nbOptions[key] !== undefined && typeof (nbOptions[key] === "boolean")
      ) {
        return current + `${key}:${String(nbOptions[key])}`;
      } else {
        return current;
      }
    }, "")
    : "";

  const coreKey = optionsKey
    ? `${inputPath}-${nbAddress.path}-${optionsKey}`
    : `${inputPath}-${nbAddress.path}`;

  const outputsKey = nbOutputs ? nbOutputs.join(",") : "";
  return `${coreKey}:${outputsKey}:${assets.supporting_dir}`;
}

function optionsToPlaceholder(options: JupyterMarkdownOptions) {
  return Object.keys(options).map((key) => {
    return `${key}:${String(options[key])}`;
  }).join(",");
}

function placeholderToOptions(placeholder: string) {
  const parts = placeholder.split(",");
  const options: JupyterMarkdownOptions = {};
  for (const part of parts) {
    const kv = part.split(":");
    if (kv.length > 1) {
      const key = part.split(":")[0];
      const value = part.split(":").slice(1).join(":");
      options[key] = value.toLowerCase() === "true";
    } else {
      throw new Error("Unexpected placeholder for notebook option: " + part);
    }
  }
  return options;
}

// Finds a cell matching an id. It will first try an explicit
// matching cell Id, then a cell label (in the code chunk front matter),
// and otherwise look for a cell(s) with that tag
function cellForId(id: string, cells: JupyterCellOutput[]) {
  for (const cell of cells) {
    // cellId can either by a literal cell Id, or a tag with that value
    const hasId = cell.id ? id === cell.id : false;
    if (hasId) {
      // It's an ID
      return cell;
    }

    // Check label
    const hasLabel = cell.options && cell.options[kCellLabel]
      ? id === cell.options[kCellLabel]
      : false;

    if (hasLabel) {
      // It matches a label
      return cell;
    }

    // Check tags
    const hasTag = cell.metadata && cell.metadata.tags
      ? cell.metadata.tags.find((tag) => id === tag) !==
        undefined
      : false;

    if (hasTag) {
      return cell;
    }

    // Check contents of the cell itself
    if (cell.markdown && cell.markdown.includes(id)) {
      // Now look more carefully to see if id is indeed an attr
      if (cell.markdown.match(new RegExp(`.*{#${id}((\s\S*\})|\})$`, "gm"))) {
        return cell;
      }
    }
  }
}

// Parses a string into one or more cellids.
// Syntax like:
//   notebook.ipynb#cellid1
//   notebook.ipynb#cellid1,cellid2,cellid3
function resolveCellIds(hash?: string) {
  if (hash && hash.indexOf(",") > 0) {
    return hash.split(",");
  } else if (hash) {
    return [hash];
  } else {
    return undefined;
  }
}

// Parses a string with one more numbers or ranges into
// a list of numbers, in order.
// Syntax like:
//   notebook.ipynb[0]
//   notebook.ipynb[0,1]
//   notebook.ipynb[0-2]
//   notebook.ipynb[2,0-1]
//   notebook.ipynb[2,6-4]
function resolveRange(rangeRaw?: string) {
  if (rangeRaw) {
    const result: number[] = [];

    const ranges = rangeRaw.split(",");
    ranges.forEach((range) => {
      if (range.indexOf("-") > -1) {
        // This is range
        const parts = range.split("-");
        const start = parseInt(parts[0]);
        const end = parseInt(parts[1]);
        const step = start > end ? -1 : 1;
        for (let i = start; step > 0 ? i <= end : i >= end; i = i + step) {
          result.push(i);
        }
      } else {
        // This is raw value
        result.push(parseInt(range));
      }
    });
    return result;
  } else {
    return undefined;
  }
}

function jupyterFromNotebookOrQmd(
  nbAbsPath: string,
  services: RenderServices,
  project?: ProjectContext,
) {
  // See if we can resolve non-notebooks. Note that this
  // requires that we have pre-rendered any notebooks that we discover
  // along the embed pipeline
  let jupyterNotebookPath = nbAbsPath;
  if (!isNotebook(jupyterNotebookPath)) {
    const notebook = services.notebook.get(
      nbAbsPath,
      project,
    );
    if (notebook?.[kQmdIPynb] && notebook[kQmdIPynb]) {
      jupyterNotebookPath = notebook[kQmdIPynb].path;
    } else {
      throw new InternalError(
        `Expected an 'ipynb' file to be present for the 'qmd' file ${nbAbsPath}`,
      );
    }
  }

  return jupyterFromFile(jupyterNotebookPath);
}
