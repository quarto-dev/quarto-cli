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

export interface NotebookAddress {
  path: string;
  cellIds: string[] | undefined;
  params: Record<string, string>;
}

const resolveCellIds = (hash?: string) => {
  if (hash && hash.indexOf(",") > 0) {
    return hash.split(",");
  } else {
    return hash;
  }
};

// tag specified in yaml
// label in yaml
// notebook.ipynb#cellid1
// notebook.ipynb#cellid1
// notebook.ipynb#cellid1,cellid2,cellid3
// notebook.ipynb[0]
// notebook.ipynb[0,1]
// notebook.ipynb[0-2]

// If the path is a notebook path, then process it separately.
export function parseNotebookPath(path: string) {
  const hasHash = path.indexOf("#") !== -1;
  const hash = hasHash ? path.split("#")[1] : undefined;
  path = path.split("#")[0];

  if (extname(path) === ".ipynb") {
    const cellIds = resolveCellIds(hash);
    return {
      path,
      cellIds,
    } as NotebookAddress;
  } else {
    return undefined;
  }
}

const kLabel = "label";

export function notebookForAddress(
  nbInclude: NotebookAddress,
  filter?: (cell: JupyterCell) => JupyterCell,
) {
  try {
    const nb = jupyterFromFile(nbInclude.path);
    const cells: JupyterCell[] = [];

    // If cellIds are present, filter the notebook to only include
    // those cells (cellIds can eiher be an explicitly set cellId, a label in the
    // cell metadata, or a tag on a cell that matches an id)
    if (nbInclude.cellIds) {
      for (const cell of nb.cells) {
        // cellId can either by a literal cell Id, or a tag with that value
        const hasId = cell.id ? nbInclude.cellIds.includes(cell.id) : false;
        if (hasId) {
          // It's an ID
          cells.push(cell);
        } else {
          // Check for label in options
          const cellWithOptions = jupyterCellWithOptions(
            nb.metadata.kernelspec.language.toLowerCase(),
            cell,
          );
          const hasLabel = cellWithOptions.options[kLabel]
            ? nbInclude.cellIds.includes(cellWithOptions.options[kLabel])
            : false;

          if (hasLabel) {
            // It matches a label
            cells.push(cell);
          } else {
            // Check tags
            const hasTag = cell.metadata.tags
              ? cell.metadata.tags.find((tag) =>
                nbInclude.cellIds?.includes(tag)
              ) !==
                undefined
              : false;
            if (hasTag) {
              cells.push(cell);
            }
          }
        }
      }
      nb.cells = cells;
    }

    if (filter) {
      nb.cells = nb.cells.map(filter);
    }

    return nb;
  } catch (ex) {
    throw new Error(`Failed to read included notebook ${nbInclude.path}`, ex);
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
