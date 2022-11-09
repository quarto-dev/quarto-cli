/*
* jupyter-embed.ts
*
* Copyright (C) 2022 by RStudio, PBC
*
*/

import { resourcePath } from "../resources.ts";
import { getNamedLifetime, ObjectWithLifetime } from "../lifetimes.ts";

import {
  jupyterAssets,
  jupyterFromFile,
  jupyterToMarkdown,
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
import { RenderContext, RenderFlags } from "../../command/render/types.ts";
import { JupyterAssets, JupyterCellOutput } from "../jupyter/types.ts";

import { dirname, extname } from "path/mod.ts";
import { languages } from "../handlers/base.ts";
import {
  extractJupyterWidgetDependencies,
  includesForJupyterWidgetDependencies,
} from "./widgets.ts";
import { globalTempContext } from "../temp.ts";

export interface JupyterNotebookAddress {
  path: string;
  ids?: string[];
  indexes?: number[];
}

export interface JupyterMarkdownOptions
  extends Record<string, boolean | undefined> {
  echo?: boolean;
  warning?: boolean;
  asis?: boolean;
}

interface JupyterNotebookOutputCache extends ObjectWithLifetime {
  cache: Record<
    string,
    { outputs: JupyterCellOutput[] }
  >;
}

const kEcho = "echo";
const kWarning = "warning";
const kOutput = "output";

const kHashRegex = /(.*?)#(.*)/;
const kIndexRegex = /(.*)\[([0-9,-]*)\]/;
const kPlaceholderRegex = /<!-- 12A0366C:(.*?) \| (.*?) -->/;

const kNotebookCache = "notebook-cache";
const kRenderFileLifeTime = "render-file";

// notebook.ipynb#cellid1
// notebook.ipynb#cellid1
// notebook.ipynb#cellid1,cellid2,cellid3
// notebook.ipynb[0]
// notebook.ipynb[0,1]
// notebook.ipynb[0-2]
// notebook.ipynb[2,0-1]
export function parseNotebookAddress(
  path: string,
): JupyterNotebookAddress | undefined {
  const isNotebook = (path: string) => {
    return extname(path) === ".ipynb";
  };

  // This is a hash based path
  const hashResult = path.match(kHashRegex);
  if (hashResult) {
    const path = hashResult[1];
    if (isNotebook(path)) {
      return {
        path,
        ids: resolveCellIds(hashResult[2]),
      };
    } else {
      return undefined;
    }
  }

  // This is an index based path
  const indexResult = path.match(kIndexRegex);
  if (indexResult) {
    const path = indexResult[1];
    if (isNotebook(path)) {
      return {
        path,
        indexes: resolveCellRange(indexResult[2]),
      };
    } else {
      return undefined;
    }
  }

  // This is the path to a notebook
  if (isNotebook(path)) {
    return {
      path,
    };
  } else {
    return undefined;
  }
}

export function notebookMarkdownPlaceholder(
  path: string,
  options: JupyterMarkdownOptions,
) {
  return `<!-- 12A0366C:${path} | ${optionsToPlaceholder(options)} -->`;
}

export async function replaceNotebookPlaceholders(
  to: string,
  input: string,
  context: RenderContext,
  flags: RenderFlags,
  markdown: string,
) {
  let match = kPlaceholderRegex.exec(markdown);
  let includes;
  while (match) {
    // Find and parse the placeholders
    const nbPath = match[1];
    const optionPlaceholder = match[2];
    const nbOptions = optionPlaceholder
      ? placeholderToOptions(optionPlaceholder)
      : {};

    // Parse the address
    const nbAddress = parseNotebookAddress(nbPath);
    if (nbAddress) {
      // Assets
      const assets = jupyterAssets(
        input,
        to,
      );

      const notebookIncludes = () => {
        const notebook = jupyterFromFile(nbAddress.path);
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
      };
      includes = notebookIncludes();

      // Render the notebook markdown
      const nbMarkdown = await notebookMarkdown(
        nbAddress,
        assets,
        context,
        flags,
        nbOptions,
      );

      // Replace the placeholders with the rendered markdown
      markdown = markdown.replaceAll(match[0], nbMarkdown);
    }

    match = kPlaceholderRegex.exec(markdown);
  }
  kPlaceholderRegex.lastIndex = 0;
  return {
    includes,
    markdown,
  };
}

async function notebookMarkdown(
  nbAddress: JupyterNotebookAddress,
  assets: JupyterAssets,
  context: RenderContext,
  flags: RenderFlags,
  options?: JupyterMarkdownOptions,
) {
  // Get the cell outputs for this notebook
  const cellOutputs = await getCellOutputs(
    nbAddress,
    assets,
    context,
    flags,
    options,
  );

  // Wrap any injected cells with a div that includes a back link to
  // the notebook that originated the cells
  const notebookMarkdown = (cells: JupyterCellOutput[]) => {
    const markdown = ["", `:::{notebook="${nbAddress.path}"}`];
    markdown.push("");
    markdown.push(cells.map((cell) => cell.markdown).join(""));
    markdown.push("");
    markdown.push(":::");
    return markdown.join("\n");
  };

  if (nbAddress.ids) {
    // If cellIds are present, filter the notebook to only include
    // those cells (cellIds can eiher be an explicitly set cellId, a label in the
    // cell metadata, or a tag on a cell that matches an id)
    const theCells = nbAddress.ids.map((id) => {
      const cell = cellForId(id, cellOutputs);
      if (cell === undefined) {
        throw new Error(
          `The cell ${id} does not exist in notebook`,
        );
      } else {
        return cell;
      }
    });
    return notebookMarkdown(theCells);
  } else if (nbAddress.indexes) {
    // Filter and sort based upon cell indexes
    const theCells = nbAddress.indexes.map((idx) => {
      if (idx < 0 || idx >= cellOutputs.length) {
        throw new Error(
          `The cell index ${idx} isn't within the range of cells`,
        );
      }
      return cellOutputs[idx];
    });
    return notebookMarkdown(theCells);
  } else {
    // Return all the cell outputs as there is no addtional
    // specification of cells
    return notebookMarkdown(cellOutputs);
  }
}

async function getCellOutputs(
  nbAddress: JupyterNotebookAddress,
  assets: JupyterAssets,
  context: RenderContext,
  flags: RenderFlags,
  options?: JupyterMarkdownOptions,
) {
  // We can cache outputs on a per rendered file basis to
  // improve performance
  const lifetime = getNamedLifetime(kRenderFileLifeTime);
  if (lifetime === undefined) {
    throw new Error("Internal Error: named lifetime render-file not found");
  }
  const nbCache =
    lifetime.get(kNotebookCache) as unknown as JupyterNotebookOutputCache ||
    {
      cache: {},
      cleanup: () => {
      },
    };

  // Compute a cache key
  const cacheKey = notebookCacheKey(nbAddress, options);
  if (!nbCache.cache[cacheKey]) {
    // Render the notebook and place it in the cache
    // Read and filter notebook
    const notebook = jupyterFromFile(nbAddress.path);
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
        return cell;
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
        dirname(Deno.realPathSync(context.target.source)),
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
        toHtml: isHtmlCompatible(format),
        toLatex: isLatexOutput(format.pandoc),
        toMarkdown: isMarkdownOutput(format.pandoc),
        toIpynb: isIpynbOutput(format.pandoc),
        toPresentation: isPresentationOutput(format.pandoc),
        figFormat: format.execute[kFigFormat],
        figDpi: format.execute[kFigDpi],
        figPos: format.render[kFigPos],
      },
    );

    // Place the outputs in the cache
    nbCache.cache[cacheKey] = { outputs: result.cellOutputs };
    lifetime.attach(nbCache, kNotebookCache);
  }
  return nbCache.cache[cacheKey].outputs;
}

function notebookCacheKey(
  nbAddress: JupyterNotebookAddress,
  nbOptions?: JupyterMarkdownOptions,
) {
  const optionsKey = nbOptions
    ? Object.keys(nbOptions).reduce((key, current) => {
      if (nbOptions[key] !== undefined) {
        return current + `${key}:${String(nbOptions[key])}`;
      } else {
        return current;
      }
    }, "")
    : "";
  return optionsKey ? `${nbAddress.path}-${optionsKey}` : nbAddress.path;
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

function cellForId(id: string, cells: JupyterCellOutput[]) {
  for (const cell of cells) {
    // cellId can either by a literal cell Id, or a tag with that value
    const hasId = cell.id ? id === cell.id : false;
    if (hasId) {
      // It's an ID
      return cell;
    } else {
      const hasLabel = cell.options && cell.options[kCellLabel]
        ? id === cell.options[kCellLabel]
        : false;

      if (hasLabel) {
        // It matches a label
        return cell;
      } else {
        // Check tags
        const hasTag = cell.metadata && cell.metadata.tags
          ? cell.metadata.tags.find((tag) => id === tag) !==
            undefined
          : false;
        if (hasTag) {
          return cell;
        }
      }
    }
  }
}

function resolveCellIds(hash?: string) {
  if (hash && hash.indexOf(",") > 0) {
    return hash.split(",");
  } else if (hash) {
    return [hash];
  } else {
    return undefined;
  }
}

function resolveCellRange(rangeRaw?: string) {
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
