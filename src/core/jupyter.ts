import { ensureDirSync } from "fs/ensure_dir.ts";
import { join } from "path/mod.ts";

import { dirAndStem } from "./path.ts";

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
    tags?: string[];
    lines_to_next_cell?: number;
  };
  source: string[];
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
  // https://github.com/mwouts/jupytext/blob/master/jupytext/cell_to_text.py

  const md: string[] = [];

  for (const cell of nb.cells) {
    if (["markdown", "raw"].includes(cell.cell_type)) {
      md.push(...mdFromContentCell(cell));
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

// cell output control tags. also define some aliases for tags used in
// jupyterbook/runtools: https://github.com/mwouts/jupytext/issues/337
const kIncludeCodeTags = ["include-code"];
const kIncludeOutputTags = ["include-output"];
const kIncludeWarningsTags = ["include-warnings"];
const kRemoveCodeTags = ["remove-code", "remove-input", "remove_inupt"];
const kRemoveOutputTags = ["remove-output", "remove_output"];
const kRemoveWarningsTags = ["remove-warnings"];
const kRemoveCellTags = ["remove-cell", "remove_cell"];

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

  if (includeCode(cell, options.includeCode)) {
    md.push("```" + options.language + "\n");
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
