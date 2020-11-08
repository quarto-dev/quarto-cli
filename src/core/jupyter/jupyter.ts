/*
* jupyter.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
* Unless you have received this program directly from RStudio pursuant
* to the terms of a commercial license agreement with RStudio, then
* this program is licensed to you under the terms of version 3 of the
* GNU General Public License. This program is distributed WITHOUT
* ANY EXPRESS OR IMPLIED WARRANTY, INCLUDING THOSE OF NON-INFRINGEMENT,
* MERCHANTABILITY OR FITNESS FOR A PARTICULAR PURPOSE. Please refer to the
* GPL (http://www.gnu.org/licenses/gpl-3.0.txt) for more details.
*
*/

import { ensureDirSync } from "fs/ensure_dir.ts";
import { join } from "path/mod.ts";
import { walkSync } from "fs/walk.ts";
import { decode as base64decode } from "encoding/base64.ts";

import {
  extensionForMimeImageType,
  kApplicationJavascript,
  kApplicationRtf,
  kImagePng,
  kImageSvg,
  kRestructuredText,
  kTextHtml,
  kTextLatex,
} from "../mime.ts";

import { dirAndStem } from "../path.ts";
import PngImage from "../png.ts";

import {
  convertVisibilityTags,
  hideCell,
  hideCode,
  hideOutput,
  hideWarnings,
  includeCell,
  includeCode,
  includeOutput,
  includeWarnings,
} from "./tags.ts";
import { cellContainerLabel, cellLabel, cellLabelValidator } from "./labels.ts";
import {
  displayDataIsHtml,
  displayDataIsImage,
  displayDataIsJavascript,
  displayDataIsJson,
  displayDataIsLatex,
  displayDataIsMarkdown,
  displayDataMimeType,
  isDisplayData,
} from "./display_data.ts";
import { widgetIncludeFiles } from "./widgets.ts";
import { removeAndPreserveHtml } from "./preserve.ts";
import { FormatCell } from "../../config/format.ts";
import { kKeepHidden } from "../../config/constants.ts";

export const kCellCollapsed = "collapsed";
export const kCellAutoscroll = "autoscroll";
export const kCellDeletable = "deletable";
export const kCellFormat = "format";
export const kCellName = "name";
export const kCellTags = "tags";
export const kCellLinesToNext = "lines_to_next_cell";
export const kRawMimeType = "raw_mimetype";

export const kCellLabel = "label";
export const kCellCaption = "caption";
export const kCellClasses = "classes";
export const kCellWidth = "width";
export const kCellHeight = "height";
export const kCellAlt = "alt";

export const kFigLabel = "fig";

export interface JupyterNotebook {
  metadata: {
    kernelspec: {
      language: string;
    };
    widgets: Record<string, unknown>;
  };
  cells: JupyterCell[];
}

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
    [kRawMimeType]?: string;

    // quarto schema (note that 'name' from nbformat is
    // automatically used as an alias for 'label')
    [kCellLabel]?: string;
    [kCellCaption]?: string | string[];
    [kCellClasses]?: string;

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
  metadata: { [mimeType: string]: Record<string, unknown> };
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
  base_dir: string;
  figures_dir: string;
  supporting_dir: string;
}

export function jupyterAssets(input: string, to?: string) {
  // calculate and create directories
  const [base_dir, stem] = dirAndStem(input);
  const files_dir = join(base_dir, stem + "_files");
  to = (to || "html").replace(/[\+\-].*$/, "");
  const figures_dir = join(files_dir, "figure-" + to);
  ensureDirSync(figures_dir);

  // determine supporting_dir (if there are no other figures dirs then it's
  // the files dir, otherwise it's just the figures dir). note that
  // supporting_dir is the directory that gets removed after a self-contained
  // or non-keeping render is complete
  let supporting_dir = files_dir;
  for (
    const walk of walkSync(join(files_dir), { maxDepth: 1 })
  ) {
    if (walk.path !== files_dir && walk.path !== figures_dir) {
      supporting_dir = figures_dir;
      break;
    }
  }

  return {
    base_dir,
    figures_dir,
    supporting_dir,
  };
}

export interface JupyterToMarkdownOptions {
  language: string;
  assets: JupyterAssets;
  formatCell: FormatCell;
  toHtml?: boolean;
  toLatex?: boolean;
  toMarkdown?: boolean;
  figFormat?: string;
  figDpi?: number;
}

export interface JupyterToMarkdownResult {
  markdown: string;
  includeFiles?: {
    inHeader?: string[];
    beforeBody?: string[];
    afterBody?: string[];
  };
  htmlPreserve?: Record<string, string>;
}

export function jupyterToMarkdown(
  nb: JupyterNotebook,
  options: JupyterToMarkdownOptions,
): JupyterToMarkdownResult {
  // optional content injection / html preservation for html output
  const includeFiles = options.toHtml ? widgetIncludeFiles(nb) : undefined;
  const htmlPreserve = options.toHtml ? removeAndPreserveHtml(nb) : undefined;

  // generate markdown
  const md: string[] = [];

  // validate unique cell labels as we go
  const validateCellLabel = cellLabelValidator();

  // track current code cell index (for progress)
  let codeCellIndex = 0;

  for (const cell of nb.cells) {
    // validate unique cell labels
    validateCellLabel(cell);

    // markdown from cell
    switch (cell.cell_type) {
      case "markdown":
        md.push(...mdFromContentCell(cell));
        break;
      case "raw":
        md.push(...mdFromRawCell(cell));
        break;
      case "code":
        md.push(...mdFromCodeCell(cell, ++codeCellIndex, options));
        break;
      default:
        throw new Error("Unexpected cell type " + cell.cell_type);
    }
  }

  // return markdown and any widget requirements
  return {
    markdown: md.join(""),
    includeFiles,
    htmlPreserve,
  };
}

function mdFromContentCell(cell: JupyterCell) {
  return [...cell.source, "\n\n"];
}

function mdFromRawCell(cell: JupyterCell) {
  const mimeType = cell.metadata?.[kRawMimeType];
  if (mimeType) {
    switch (mimeType) {
      case kTextHtml:
        return mdHtmlOutput(cell.source);
      case kTextLatex:
        return mdLatexOutput(cell.source);
      case kRestructuredText:
        return mdFormatOutput("rst", cell.source);
      case kApplicationRtf:
        return mdFormatOutput("rtf", cell.source);
      case kApplicationJavascript:
        return mdScriptOutput(mimeType, cell.source);
    }
  }

  return mdFromContentCell(cell);
}

// https://ipython.org/ipython-doc/dev/notebook/nbformat.html
// https://github.com/mwouts/jupytext/blob/master/jupytext/cell_to_text.py
function mdFromCodeCell(
  cell: JupyterCell,
  cellIndex: number,
  options: JupyterToMarkdownOptions,
) {
  // if we aren't keeping hidden, then all show/hide tags are equivalent to include/remove
  if (!options.formatCell[kKeepHidden]) {
    cell.metadata[kCellTags] = convertVisibilityTags(cell.metadata[kCellTags]);
  }

  // bail if we aren't including this cell
  if (!includeCell(cell)) {
    return [];
  }

  // redact if the cell has no source and no output
  if (!cell.source.length && !cell.outputs?.length) {
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
    kCellLabel,
    kCellCaption,
    kCellClasses,
    kCellWidth,
    kCellHeight,
    kCellAlt,
    kCellLinesToNext,
  ];

  // determine label -- this will be forwarded to the output (e.g. a figure)
  // if there is a single output. otherwise it will included on the enclosing
  // div and used as a prefix for the individual outputs
  const label = cellContainerLabel(cell, options);
  if (label) {
    divMd.push(`#${label} `);
  }

  // cell_type classes
  divMd.push(`.cell .code `);

  // add hidden if requested
  if (hideCell(cell)) {
    divMd.push(`.hidden `);
  }

  // css classes
  if (cell.metadata.classes) {
    const classes = cell.metadata.classes.trim().split(/\s+/)
      .map((clz) => clz.startsWith(".") ? clz : ("." + clz))
      .join(" ");
    divMd.push(classes + " ");
  }

  console.log(cell.metadata);
  // forward other attributes we don't know about
  for (const key of Object.keys(cell.metadata)) {
    if (!kCellMetadataFilter.includes(key.toLowerCase())) {
      // deno-lint-ignore no-explicit-any
      const value = (cell.metadata as any)[key];
      if (value) {
        const tagName = key === kCellTags ? "data-tags" : key;
        divMd.push(`${tagName}="${value}" `);
      }
    }
  }

  // strip trailing space and add terminator
  md.push(divMd.join("").replace(/ $/, "").concat("}\n"));

  // write code if appropriate
  if (includeCode(cell, options.formatCell)) {
    md.push("```{." + options.language);
    if (hideCode(cell, options.formatCell)) {
      md.push(" .hidden");
    }
    md.push("}\n");
    md.push(...cell.source, "\n");
    md.push("```\n");
  }

  // write output if approproate
  if (includeOutput(cell, options.formatCell)) {
    // compute label prefix for output (in case we need it for files, etc.)
    const labelName = label
      ? label.replaceAll(":", "-")
      : ("cell-" + (cellIndex + 1));
    const outputName = labelName + "-output";

    for (
      const { index, output } of (cell.outputs || []).map((value, index) => ({
        index,
        output: value,
      }))
    ) {
      // filter warnings if necessary
      if (
        output.output_type === "stream" &&
        (output as JupyterOutputStream).name === "stderr" &&
        !includeWarnings(cell, options.formatCell)
      ) {
        continue;
      }

      // leading newline
      md.push("\n");

      // div preamble
      md.push(`::: {.output .${output.output_type}`);

      // add stream name class if necessary
      if (output.output_type === "stream") {
        const stream = output as JupyterOutputStream;
        md.push(` .${stream.name}`);
      }

      // add hidden if necessary
      if (
        hideOutput(cell, options.formatCell) ||
        (isWarningOutput(output) && hideWarnings(cell, options.formatCell))
      ) {
        md.push(` .hidden`);
      }

      md.push("}\n");

      // produce output
      if (output.output_type === "stream") {
        md.push(mdOutputStream(output as JupyterOutputStream));
      } else if (output.output_type === "error") {
        md.push(mdOutputError(output as JupyterOutputError));
      } else if (isDisplayData(output)) {
        const outputLabel = label
          ? (label + "-" + (index + 1))
          : cellLabel(cell);
        const outputCaption = Array.isArray(cell.metadata.caption)
          ? cell.metadata.caption[index]
          : cell.metadata.caption as string;

        md.push(mdOutputDisplayData(
          outputLabel,
          outputCaption || null,
          outputName + "-" + (index + 1),
          output as JupyterOutputDisplayData,
          options,
        ));
      } else {
        throw new Error("Unexpected output type " + output.output_type);
      }

      // terminate div
      md.push(`:::\n`);
    }
  }

  // end div
  md.push(":::\n");

  // lines to next cell
  md.push("\n".repeat((cell.metadata.lines_to_next_cell || 1)));

  return md;
}

function mdOutputStream(output: JupyterOutputStream) {
  // trim off warning source line for notebook
  if (output.name === "stderr") {
    const firstLine = output.text[0];
    if (output.text[0]) {
      const firstLine = output.text[0].replace(
        /<ipython-input.*?>:\d+:\s+/,
        "",
      );
      return mdCodeOutput([firstLine, ...output.text.slice(1)]);
    }
  }

  // normal default handling
  return mdCodeOutput(output.text);
}

function mdOutputError(output: JupyterOutputError) {
  return mdCodeOutput([output.ename + ": " + output.evalue]);
}

function mdOutputDisplayData(
  label: string | null,
  caption: string | null,
  filename: string,
  output: JupyterOutputDisplayData,
  options: JupyterToMarkdownOptions,
) {
  const mimeType = displayDataMimeType(output, options);
  if (mimeType) {
    if (displayDataIsImage(mimeType)) {
      return mdImageOutput(
        label,
        caption,
        filename,
        mimeType,
        options.assets,
        output.data[mimeType] as string[],
        output.metadata[mimeType],
        options.figFormat,
        options.figDpi,
      );
    } else if (displayDataIsMarkdown(mimeType)) {
      return mdMarkdownOutput(output.data[mimeType] as string[]);
    } else if (displayDataIsLatex(mimeType)) {
      return mdLatexOutput(output.data[mimeType] as string[]);
    } else if (displayDataIsHtml(mimeType)) {
      return mdHtmlOutput(output.data[mimeType] as string[]);
    } else if (displayDataIsJson(mimeType)) {
      return mdJsonOutput(
        mimeType,
        output.data[mimeType] as Record<string, unknown>,
      );
    } else if (displayDataIsJavascript(mimeType)) {
      return mdScriptOutput(mimeType, output.data[mimeType] as string[]);
    }
  }

  // no type match found
  return mdWarningOutput(
    "Unable to display output for mime type(s): " +
      Object.keys(output.data).join(", "),
  );
}

function mdImageOutput(
  label: string | null,
  caption: string | null,
  filename: string,
  mimeType: string,
  assets: JupyterAssets,
  data: unknown,
  metadata?: Record<string, unknown>,
  figFormat?: string,
  figDpi?: number,
) {
  // attributes (e.g. width/height/alt)
  function metadataValue<T>(key: string, defaultValue: T) {
    return metadata && metadata[key] ? metadata["key"] as T : defaultValue;
  }
  let width = metadataValue(kCellWidth, 0);
  let height = metadataValue(kCellHeight, 0);
  const alt = caption || metadataValue(kCellAlt, "");

  // calculate output file name
  const ext = extensionForMimeImageType(mimeType);
  const imageFile = join(assets.figures_dir, filename + "." + ext);

  // get the data
  const imageText = Array.isArray(data)
    ? (data as string[]).join("")
    : data as string;

  // base64 decode if it's not svg
  const outputFile = join(assets.base_dir, imageFile);
  if (mimeType !== kImageSvg) {
    const imageData = base64decode(imageText);

    // if we are in retina mode, then derive width and height from the image
    if (mimeType === kImagePng && figFormat === "retina" && figDpi) {
      const png = new PngImage(imageData);
      if (png.dpiX === (figDpi * 2) && png.dpiY === (figDpi * 2)) {
        width = png.width / 2;
        height = png.height / 2;
      }
    }

    Deno.writeFileSync(outputFile, imageData);
  } else {
    Deno.writeTextFileSync(outputFile, imageText);
  }

  let image = `![${alt}](${imageFile})`;
  if (label || width || height) {
    image += "{";
    if (label) {
      image += `#${kFigLabel}:${label} `;
    }
    if (width) {
      image += `width=${width} `;
    }
    if (height) {
      image += `height=${height} `;
    }
    image = image.trimRight() + "}";
  }
  return mdMarkdownOutput([image]);
}

function mdMarkdownOutput(md: string[]) {
  return md.join("") + "\n";
}

function mdFormatOutput(format: string, source: string[]) {
  return mdEnclosedOutput("```{=" + format + "}", source, "```");
}

function mdLatexOutput(latex: string[]) {
  return mdFormatOutput("tex", latex);
}

function mdHtmlOutput(html: string[]) {
  return mdFormatOutput("html", html);
}

function mdJsonOutput(mimeType: string, json: Record<string, unknown>) {
  return mdScriptOutput(mimeType, [JSON.stringify(json)]);
}

function mdScriptOutput(mimeType: string, script: string[]) {
  const scriptTag = [
    `<script type="${mimeType}">\n`,
    ...script,
    "\n</script>",
  ];
  return mdHtmlOutput(scriptTag);
}

function mdCodeOutput(code: string[]) {
  return mdEnclosedOutput("```", code, "```");
}

function mdEnclosedOutput(begin: string, text: string[], end: string) {
  const md: string[] = [
    begin + "\n",
    text.join("") + "\n",
    end + "\n",
  ];
  return md.join("");
}

function mdWarningOutput(msg: string) {
  return mdOutputStream({
    output_type: "stream",
    name: "stderr",
    text: [msg],
  });
}

function isWarningOutput(output: JupyterOutput) {
  if (output.output_type === "stream") {
    const stream = output as JupyterOutputStream;
    return stream.name === "stderr";
  } else {
    return false;
  }
}
