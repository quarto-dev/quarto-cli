import { ensureDirSync } from "fs/ensure_dir.ts";
import { join } from "path/mod.ts";

import { dirAndStem } from "./path.ts";

// TODO: display errors ("allow-errors")

// TODO: images for "display_data" / "execute_result"

// TODO: JS/CSS/etc. for other mime types

// TODO: warning needs to get rid of wierd '<ipython>' artifact
// TODO: raw needs to look at format and use pandoc raw tags where appropriate
// TODO: JUPYTER_OUTPUT_TYPE (mime type) as part of format

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

export const kCellCollapsed = "collapsed";
export const kCellAutoscroll = "autoscroll";
export const kCellDeletable = "deletable";
export const kCellFormat = "format";
export const kCellName = "name";
export const kCellTags = "tags";
export const kCellId = "id";
export const kCellClass = "class";
export const kCellLinesToNext = "lines_to_next_cell";

export interface JupyterCell {
  cell_type: "markdown" | "code" | "raw";
  metadata: {
    // nbformat v4 spec
    [kCellCollapsed]?: boolean;
    [kCellAutoscroll]?: boolean | "auto";
    [kCellDeletable]?: boolean;
    [kCellFormat]?: string; // for "raw"
    [kCellName]?: string;
    [kCellTags]?: string[];

    // id and classes for pandoc
    [kCellId]?: string;
    [kCellClass]?: string;

    // used by jupytext to preserve line spacing
    [kCellLinesToNext]?: number;
  };
  source: string[];
  outputs?: JupyterOutput[];
}

export interface JupyterOutput {
  output_type: "stream" | "display_data" | "execute_result" | "error";
  isolated?: boolean;
}

export interface JupyterOutputStream extends JupyterOutput {
  name: "stdout" | "stderr";
  text: string[];
}

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
    switch (cell.cell_type) {
      case "markdown":
        md.push(...mdFromContentCell(cell));
        break;
      case "raw":
        md.push(...mdFromRawCell(cell));
        break;
      case "code":
        md.push(...mdFromCodeCell(cell, options));
        break;
      default:
        throw new Error("Unexpected cell type " + cell.cell_type);
    }
  }

  // return markdown
  return md.join("");
}

function mdFromContentCell(cell: JupyterCell) {
  return [...cell.source, "\n\n"];
}

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

  // write div enclosure
  const divMd: string[] = [`::: {`];

  // metadata to exlucde from cell div attributes
  const kCellMetadataFilter = [
    kCellCollapsed,
    kCellAutoscroll,
    kCellDeletable,
    kCellFormat,
    kCellName,
    kCellTags,
    kCellId,
    kCellClass,
    kCellLinesToNext,
  ];

  // id/name
  const id = cell.metadata.id || cell.metadata.name;
  if (id) {
    divMd.push(`#${id.replace(/^#/, "")} `);
  }

  // cell_type classes
  divMd.push(`.cell .code `);

  // css classes
  if (cell.metadata.class) {
    const classes = cell.metadata.class.trim().split(/\s+/)
      .map((clz) => clz.startsWith(".") ? clz : ("." + clz))
      .join(" ");
    divMd.push(classes + " ");
  }

  // forward other attributes we don't know about
  for (const key of Object.keys(cell.metadata)) {
    if (!kCellMetadataFilter.includes(key.toLowerCase())) {
      // deno-lint-ignore no-explicit-any
      divMd.push(`${key}="${(cell.metadata as any)[key]}" `);
    }
  }

  // strip trailing space and add terminator
  md.push(divMd.join("").replace(/ $/, "").concat("}\n"));

  // write code if appropriate
  if (includeCode(cell, options.includeCode)) {
    md.push("```{" + options.language + "}\n");
    md.push(...cell.source, "\n");
    md.push("```\n");
  }

  // write output if approproate
  if (includeOutput(cell, options.includeOutput)) {
    for (const output of cell.outputs || []) {
      // filter warnings if necessary
      if (
        output.output_type === "stream" &&
        (output as JupyterOutputStream).name === "stderr" &&
        !includeWarnings(cell, options.includeWarnings)
      ) {
        continue;
      }

      // leading newline
      md.push("\n");

      // div preamble
      md.push(`::: {.output .${output.output_type} `);

      // add stream name class if necessary
      if (output.output_type === "stream") {
        const stream = output as JupyterOutputStream;
        md.push(`.${stream.name}`);
      }
      md.push("}\n");

      // produce output
      switch (output.output_type) {
        case "stream":
          md.push(mdOutputStream(output as JupyterOutputStream));
          break;
        case "error":
          md.push(mdOutputError(output as JupyterOutputError));
          break;
        case "display_data":
          md.push(mdOutputDisplayData(output as JupyterOutputDisplayData));
          break;
        case "execute_result":
          md.push(mdOutputExecuteResult(output as JupyterOutputExecuteResult));
          break;
        default:
          throw new Error("Unexpected output type " + output.output_type);
      }

      // terminate div
      md.push(`:::\n`);
    }
  }

  // end div
  md.push(":::\n");

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

function mdOutputStream(output: JupyterOutputStream) {
  return mdCodeOutput(output.text.join());
}

function mdOutputError(output: JupyterOutputError) {
  return mdCodeOutput(output.ename + ": " + output.evalue);
}

function mdOutputDisplayData(output: JupyterOutputDisplayData) {
  const md: string[] = [];

  return md.join("") + "\n";
}

function mdOutputExecuteResult(output: JupyterOutputExecuteResult) {
  const md: string[] = [];

  return md.join("") + "\n";
}

function mdCodeOutput(code: string) {
  const md: string[] = [
    "```\n",
    code + "\n",
    "```\n",
  ];
  return md.join("");
}
