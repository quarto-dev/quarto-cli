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

export interface JupyterNotebookAssets {
  files_dir: string;
  figures_dir: string;
}

export function jupyterNotebookAssets(input: string) {
  const [_, stem] = dirAndStem(input);
  const files_dir = stem + "_files";
  const figures_dir = join(files_dir, "figure-ipynb");
  ensureDirSync(figures_dir);
  return {
    files_dir,
    figures_dir,
  };
}

export function jupyterNotebookToMarkdown(
  nb: JupyterNotebook,
  assets: JupyterNotebookAssets,
) {
  // https://github.com/mwouts/jupytext/blob/master/jupytext/cell_to_text.py

  // markdown lines
  const markdown: string[] = [];

  // get language
  const language = nb.metadata.kernelspec.language;
  if (!language) {
    throw new Error("No kernel language available for notebook");
  }

  // write out raw/markdown cells literally
  for (const cell of nb.cells) {
    if (["markdown", "raw"].includes(cell.cell_type)) {
      markdown.push(...cell.source, "\n\n");
    } else if (cell.cell_type === "code") {
      markdown.push("```" + language + "\n");
      markdown.push(...cell.source, "\n");
      markdown.push("```\n");
      if (cell.metadata.lines_to_next_cell) {
        markdown.push("\n".repeat(cell.metadata.lines_to_next_cell));
      }
    } else {
      throw new Error("Unexpected cell type " + cell.cell_type);
    }
  }

  // return markdown
  return markdown.join("");
}
