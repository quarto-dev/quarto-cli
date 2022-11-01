/*
* include-notebook.ts
*
* Copyright (C) 2022 by RStudio, PBC
*
*/

import { resourcePath } from "../resources.ts";

import { languages } from "./base.ts";

import {
  jupyterCellWithOptions,
  jupyterFromFile,
  jupyterToMarkdown,
} from "../jupyter/jupyter.ts";

import {
  kFigDpi,
  kFigFormat,
  kFigPos,
  kKeepHidden,
} from "../../config/constants.ts";
import {
  isHtmlCompatible,
  isIpynbOutput,
  isLatexOutput,
  isMarkdownOutput,
  isPresentationOutput,
} from "../../config/format.ts";
import { resolveParams } from "../../command/render/flags.ts";
import { RenderContext, RenderFlags } from "../../command/render/types.ts";
import {
  JupyterAssets,
  JupyterCell,
  JupyterNotebook,
} from "../jupyter/types.ts";

import { dirname, extname } from "path/mod.ts";

const kLabel = "label";

export interface NotebookAddress {
  path: string;
  ids?: string[];
  indexes?: number[];
}

const kHashRegex = /(.*?)#(.*)/;
const kIndexRegex = /(.*)\[([0-9,-]*)\]/;

// notebook.ipynb#cellid1
// notebook.ipynb#cellid1
// notebook.ipynb#cellid1,cellid2,cellid3
// notebook.ipynb[0]
// notebook.ipynb[0,1]
// notebook.ipynb[0-2]
// notebook.ipynb[2,0-1]
export function parseNotebookPath(path: string): NotebookAddress | undefined {
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

export function notebookForAddress(
  nbAddress: NotebookAddress,
  filter?: (cell: JupyterCell) => JupyterCell,
) {
  try {
    const nb = jupyterFromFile(nbAddress.path);

    if (nbAddress.ids) {
      // If cellIds are present, filter the notebook to only include
      // those cells (cellIds can eiher be an explicitly set cellId, a label in the
      // cell metadata, or a tag on a cell that matches an id)
      const theCells = nbAddress.ids.map((id) => {
        const cell = cellForId(id, nb);
        if (cell === undefined) {
          throw new Error(
            `The cell ${id} does not exist in notebook`,
          );
        } else {
          return cell;
        }
      });
      nb.cells = theCells;
    } else if (nbAddress.indexes) {
      // Filter and sort based upon cell index
      nb.cells = nbAddress.indexes.map((idx) => {
        if (idx < 0 || idx >= nb.cells.length) {
          throw new Error(
            `The cell index ${idx} isn't within the range of cells`,
          );
        }
        return nb.cells[idx];
      });
    }

    // If there is a cell filter, apply it
    if (filter) {
      nb.cells = nb.cells.map(filter);
    }

    return nb;
  } catch (ex) {
    throw new Error(
      `Failed to read notebook ${nbAddress.path}\n${ex.message || ""}`,
      ex,
    );
  }
}

export async function notebookMarkdown(
  notebook: JupyterNotebook,
  assets: JupyterAssets,
  context: RenderContext,
  flags: RenderFlags,
) {
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
  if (result) {
    return result.markdown;
  } else {
    return undefined;
  }
}

function cellForId(id: string, nb: JupyterNotebook) {
  for (const cell of nb.cells) {
    // cellId can either by a literal cell Id, or a tag with that value
    const hasId = cell.id ? id === cell.id : false;
    if (hasId) {
      // It's an ID
      return cell;
    } else {
      // Check for label in options
      const cellWithOptions = jupyterCellWithOptions(
        nb.metadata.kernelspec.language.toLowerCase(),
        cell,
      );
      const hasLabel = cellWithOptions.options[kLabel]
        ? id === cellWithOptions.options[kLabel]
        : false;

      if (hasLabel) {
        // It matches a label
        return cell;
      } else {
        // Check tags
        const hasTag = cell.metadata.tags
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

function cellInIdList(ids: string[], cell: JupyterCell, nb: JupyterNotebook) {
  // cellId can either by a literal cell Id, or a tag with that value
  const hasId = cell.id ? ids.includes(cell.id) : false;
  if (hasId) {
    // It's an ID
    return true;
  } else {
    // Check for label in options
    const cellWithOptions = jupyterCellWithOptions(
      nb.metadata.kernelspec.language.toLowerCase(),
      cell,
    );
    const hasLabel = cellWithOptions.options[kLabel]
      ? ids.includes(cellWithOptions.options[kLabel])
      : false;

    if (hasLabel) {
      // It matches a label
      return cell;
    } else {
      // Check tags
      const hasTag = cell.metadata.tags
        ? cell.metadata.tags.find((tag) => ids.includes(tag)) !==
          undefined
        : false;
      if (hasTag) {
        return cell;
      }
    }
  }
}

const resolveCellIds = (hash?: string) => {
  if (hash && hash.indexOf(",") > 0) {
    return hash.split(",");
  } else if (hash) {
    return [hash];
  } else {
    return undefined;
  }
};

const resolveCellRange = (rangeRaw?: string) => {
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
};
