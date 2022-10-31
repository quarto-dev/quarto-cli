/*
* include-notebook.ts
*
* Copyright (C) 2022 by RStudio, PBC
*
*/

import { resourcePath } from "../resources.ts";

import { languages } from "./base.ts";

import { jupyterFromFile, jupyterToMarkdown } from "../jupyter/jupyter.ts";

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

export interface NotebookInclude {
  path: string;
  cellIds: string[] | undefined;
  params: Record<string, string>;
}

const resolveCellIds = (hash: string) => {
  if (hash.indexOf(",") > 0) {
    return hash.split(",");
  } else {
    return hash;
  }
};

// If the path is a notebook path, then process it separately.
const kPlaceholderProtocol = "ipynb://";
export function parseNotebookPath(path: string) {
  if (!path.startsWith(kPlaceholderProtocol)) {
    path = `${kPlaceholderProtocol}/${path}`;
  }
  const url = new URL(path);
  const pathname = url.pathname;
  if (extname(pathname) === ".ipynb") {
    const hash = url.hash;
    const cellIds = resolveCellIds(hash);
    return {
      path: pathname,
      cellIds,
    } as NotebookInclude;
  } else {
    return undefined;
  }
}

export function notebookForInclude(
  nbInclude: NotebookInclude,
  context: RenderContext,
) {
  const nb = jupyterFromFile(nbInclude.path);
  const cells: JupyterCell[] = [];

  // If cellIds are present, filter the notebook to only include
  // those cells
  if (nbInclude.cellIds) {
    for (const cell of nb.cells) {
      // cellId can either by a literal cell Id, or a tag with that value
      const hasId = cell.id ? nbInclude.cellIds.includes(cell.id) : false;
      if (hasId) {
        // It's an ID
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
    nb.cells = cells;
  }

  // Read any notebook metadata
  const notebookMetadata = context.format.metadata["notebook"] as Record<
    string,
    unknown
  >;

  // Resolve any execution options from the notebook metadata
  nb.cells = nb.cells.map((cell) => {
    cell.metadata = {
      "echo": false,
      "warning": false,
      ...notebookMetadata,
      ...cell.metadata,
    };
    return cell;
  });

  return nb;
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
