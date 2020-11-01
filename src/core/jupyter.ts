import { ensureDirSync } from "fs/ensure_dir.ts";
import { join } from "path/mod.ts";

import { dirAndStem } from "./path.ts";

// nbformat v4
// https://ipython.org/ipython-doc/dev/notebook/nbformat.html

export interface JupyterNotebook {
  metadata: {
    kernelspec: {
      language: string;
    };
  };
  cells: JupyterCell[];
}

export interface JupyterCell {
  cell_type: "markdown" | "code" | "raw";
  metadata: {
    // nbformat v4 spec
    collapsed?: boolean;
    autoscroll?: boolean | "auto";
    deletable?: boolean;
    format?: string; // for "raw"
    name?: string;
    tags?: string[];
    // used by jupytext to preserve line spacing
    lines_to_next_cell?: number;
  };
  source: string[];
  outputs?: JupyterOutput[];
}

export interface JupyterOutput {
  output_type: "stream" | "display_data" | "execute_result" | "error";
  isolated?: boolean;
}

export interface JupyterOutputStream extends JupyterOutput {
  name: string;
  text: string[];
}

// TODO: consider marking up same as pandoc

// TODO: JUPYTER_OUTPUT_TYPE (mime type)

export interface JupyterOutputDisplayData extends JupyterOutput {
  data: { [mimeType: string]: unknown };
  metadata: { [mimeType: string]: unknown };
}

export interface JupyterOutputExecuteResult extends JupyterOutputDisplayData {
  execution_count: number;
}

export interface JupyterOutputError extends JupyterOutput {
  ename: string;
  evalue: string;
  traceback: string[];
}

export function jupyterFromFile(input: string) {
  // parse the notebook
  const nbContents = Deno.readTextFileSync(input);
  const nb = JSON.parse(nbContents) as JupyterNotebook;

  // validate that we have a language
  if (!nb.metadata.kernelspec.language) {
    throw new Error("No langage set for Jupyter notebook " + input);
  }

  // validate that we have cells
  if (!nb.cells) {
    throw new Error("No cells available in Jupyter notebook " + input);
  }

  return nb;
}

export interface JupyterAssets {
  files_dir: string;
  figures_dir: string;
}

export function jupyterAssets(input: string) {
  const [_, stem] = dirAndStem(input);
  const files_dir = stem + "_files";
  const figures_dir = join(files_dir, "figure-ipynb");
  ensureDirSync(figures_dir);
  return {
    files_dir,
    figures_dir,
  };
}

export interface JupyterToMarkdownOptions {
  language: string;
  assets: JupyterAssets;
  includeCode?: boolean;
  includeOutput?: boolean;
  includeWarnings?: boolean;
}

export function jupyterToMarkdown(
  nb: JupyterNotebook,
  options: JupyterToMarkdownOptions,
) {
  const md: string[] = [];

  for (const cell of nb.cells) {
    if (cell.cell_type === "markdown") {
      md.push(...mdFromContentCell(cell));
    } else if (cell.cell_type === "raw") {
      md.push(...mdFromRawCell(cell));
    } else if (cell.cell_type === "code") {
      md.push(...mdFromCodeCell(cell, options));
    } else {
      throw new Error("Unexpected cell type " + cell.cell_type);
    }
  }

  // return markdown
  return md.join("");
}

function mdFromContentCell(cell: JupyterCell) {
  return [...cell.source, "\n\n"];
}

// TODO: raw needs to look at format and use pandoc raw tags where appropriate

function mdFromRawCell(cell: JupyterCell) {
  return mdFromContentCell(cell);
}

// cell output control tags. also define some aliases for tags used in
// jupyterbook/runtools: https://github.com/mwouts/jupytext/issues/337
const kIncludeCodeTags = ["include-code"];
const kIncludeOutputTags = ["include-output"];
const kIncludeWarningsTags = ["include-warnings"];
const kRemoveCodeTags = ["remove-code", "remove-input", "remove_inupt"];
const kRemoveOutputTags = ["remove-output", "remove_output"];
const kRemoveWarningsTags = ["remove-warnings"];
const kRemoveCellTags = ["remove-cell", "remove_cell"];

// https://ipython.org/ipython-doc/dev/notebook/nbformat.html
// https://github.com/mwouts/jupytext/blob/master/jupytext/cell_to_text.py
function mdFromCodeCell(
  cell: JupyterCell,
  options: JupyterToMarkdownOptions,
) {
  // bail if "remove-cell" is defined
  if (hasTag(cell, kRemoveCellTags)) {
    return [];
  }

  // markdown to return
  const md: string[] = [];

  // TODO: propagate tags as css classes, other attributes?
  // e.g. name as id?, data attributes

  if (includeCode(cell, options.includeCode)) {
    md.push("```{" + options.language + "}\n");
    md.push(...cell.source, "\n");
    md.push("```\n");
  }

  if (includeOutput(cell, options.includeOutput)) {
    //

    if (includeWarnings(cell, options.includeWarnings)) {
      //
    }
  }

  // lines to next cell
  if (cell.metadata.lines_to_next_cell) {
    md.push("\n".repeat(cell.metadata.lines_to_next_cell));
  }

  return md;
}

function includeCode(cell: JupyterCell, includeDefault?: boolean) {
  return shouldInclude(
    cell,
    !!includeDefault,
    kIncludeCodeTags,
    kRemoveCodeTags,
  );
}

function includeOutput(cell: JupyterCell, includeDefault?: boolean) {
  return shouldInclude(
    cell,
    !!includeDefault,
    kIncludeOutputTags,
    kRemoveOutputTags,
  );
}

function includeWarnings(cell: JupyterCell, includeDefault?: boolean) {
  return shouldInclude(
    cell,
    !!includeDefault,
    kIncludeWarningsTags,
    kRemoveWarningsTags,
  );
}

function shouldInclude(
  cell: JupyterCell,
  includeDefault: boolean,
  includeTags: string[],
  removeTags: string[],
) {
  if (includeDefault) {
    return !hasTag(cell, removeTags);
  } else {
    return hasTag(cell, includeTags);
  }
}

function hasTag(cell: JupyterCell, tags: string[]) {
  if (!cell.metadata.tags) {
    return false;
  }
  return cell.metadata.tags.filter((tag) => tags.includes(tag)).length > 0;
}
