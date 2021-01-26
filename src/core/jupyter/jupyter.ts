/*
* jupyter.ts
*
* Copyright (C) 2020 by RStudio, PBC
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
  hideCell,
  hideCode,
  hideOutput,
  hideWarnings,
  includeCell,
  includeCode,
  includeOutput,
  includeWarnings,
} from "./tags.ts";
import {
  cellLabel,
  cellLabelValidator,
  isFigureLabel,
  resolveCaptions,
  shouldLabelCellContainer,
  shouldLabelOutputContainer,
} from "./labels.ts";
import {
  displayDataIsHtml,
  displayDataIsImage,
  displayDataIsJavascript,
  displayDataIsJson,
  displayDataIsLatex,
  displayDataIsMarkdown,
  displayDataMimeType,
  isCaptionableData,
  isDisplayData,
} from "./display_data.ts";
import {
  extractJupyterWidgetDependencies,
  JupyterWidgetDependencies,
} from "./widgets.ts";
import { removeAndPreserveHtml } from "./preserve.ts";
import { FormatExecution } from "../../config/format.ts";
import { pandocAutoIdentifier } from "../pandoc/pandoc-id.ts";
import { Metadata } from "../../config/metadata.ts";
import { JupyterKernelspec } from "./kernels.ts";

export const kCellCollapsed = "collapsed";
export const kCellAutoscroll = "autoscroll";
export const kCellDeletable = "deletable";
export const kCellFormat = "format";
export const kCellName = "name";
export const kCellTags = "tags";
export const kCellLinesToNext = "lines_to_next_cell";
export const kRawMimeType = "raw_mimetype";

export const kCellLabel = "label";
export const kCellFigCap = "fig.cap";
export const kCellFigSubCap = "fig.subcap";
export const kCellFigScap = "fig.scap";
export const kCellFigLink = "fig.link";
export const kCellFigAlign = "fig.align";
export const kCellFigEnv = "fig.env";
export const kCellFigPos = "fig.pos";
export const kCellLstLabel = "lst.label";
export const kCellLstCap = "lst.cap";
export const kCellClasses = "classes";
export const kCellWidth = "width";
export const kCellHeight = "height";
export const kCellAlt = "alt";

export interface JupyterNotebook {
  metadata: {
    kernelspec: JupyterKernelspec;
    widgets?: Record<string, unknown>;
    [key: string]: unknown;
  };
  cells: JupyterCell[];
  nbformat: number;
  nbformat_minor: number;
}

export interface JupyterCell {
  cell_type: "markdown" | "code" | "raw";
  execution_count?: null | number;
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
    [kCellFigCap]?: string | string[];
    [kCellFigSubCap]?: string[];
    [kCellFigScap]?: string;
    [kCellFigLink]?: string;
    [kCellFigEnv]?: string;
    [kCellFigPos]?: string;
    [kCellFigAlign]?: string;
    [kCellLstLabel]?: string;
    [kCellLstCap]?: string;
    [kCellClasses]?: string;

    // used by jupytext to preserve line spacing
    [kCellLinesToNext]?: number;

    // other metadata
    [key: string]: unknown;
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
  noCaption?: boolean;
}

export interface JupyterOutputFigureOptions {
  [kCellFigScap]?: string;
  [kCellFigLink]?: string;
  [kCellFigAlign]?: string;
  [kCellFigEnv]?: string;
  [kCellFigPos]?: string;
}

export interface JupyterOutputExecuteResult extends JupyterOutputDisplayData {
  execution_count: number;
}

export interface JupyterOutputError extends JupyterOutput {
  ename: string;
  evalue: string;
  traceback: string[];
}

export function jupyterMdToJupyter(
  input: string,
  kernelspec: JupyterKernelspec,
  metadata: Metadata,
): JupyterNotebook {
  // notebook to return
  const nb: JupyterNotebook = {
    metadata: {
      kernelspec,
      ...metadata,
    },
    cells: [],
    nbformat: 4,
    nbformat_minor: 4,
  };

  // regexes
  const yamlRegEx = /^---\s*$/;
  const startCodeCellRegEx = new RegExp(
    "^```" + kernelspec.language + "\s*(.*)$",
  );
  const startCodeRegEx = /^```/;
  const endCodeRegEx = /^```\s*$/;

  // read the file into lines
  const lines = Deno.readTextFileSync(input).split(/\r?\n/);

  // line buffer
  const lineBuffer: string[] = [];
  const flushLineBuffer = (
    cell_type: "markdown" | "code" | "raw",
    metadata?: Record<string, unknown>,
  ) => {
    if (lineBuffer.length) {
      const cell: JupyterCell = {
        cell_type,
        metadata: metadata || {},
        source: lineBuffer.map((line, index) => {
          return line + (index < (lineBuffer.length - 1) ? "\n" : "");
        }),
      };
      if (cell_type === "code") {
        cell.execution_count = null;
        cell.outputs = [];
      }
      nb.cells.push(cell);
      lineBuffer.splice(0, lineBuffer.length);
    }
  };

  // loop through lines and create cells based on state transitions
  let cellMetadata: Record<string, unknown> | undefined;
  let inYaml = false, inCodeCell = false, inCode = false;
  for (const line of lines) {
    // yaml front matter
    if (yamlRegEx.test(line) && !inCodeCell && !inCode) {
      if (inYaml) {
        lineBuffer.push(line);
        flushLineBuffer("raw");
        inYaml = false;
      } else {
        flushLineBuffer("markdown");
        lineBuffer.push(line);
        inYaml = true;
      }
    } // begin code cell: ^```python
    else if (startCodeCellRegEx.test(line)) {
      flushLineBuffer("markdown");
      inCodeCell = true;
      const match = line.match(startCodeCellRegEx);
      if (match && match[1]) {
        cellMetadata = parseCellMetadata(match[1]);
      }

      // end code block: ^``` (tolerate trailing ws)
    } else if (endCodeRegEx.test(line)) {
      // in a code cell, flush it
      if (inCodeCell) {
        inCodeCell = false;
        flushLineBuffer("code", cellMetadata);

        // otherwise this flips the state of in-code
      } else {
        inCode = !inCode;
        lineBuffer.push(line);
      }

      // begin code block: ^```
    } else if (startCodeRegEx.test(line)) {
      inCode = true;
      lineBuffer.push(line);
    } else {
      lineBuffer.push(line);
    }
  }

  // if there is still a line buffer then make it a markdown cell
  flushLineBuffer("markdown");

  return nb;
}

function parseCellMetadata(metadata: string): Record<string, unknown> {
  const cellMetadata: Record<string, unknown> = {};

  const kKeyRegEx = /\s*([^\s=]+)\s*=\s*/;
  let nextLoc = 0;
  while (nextLoc < metadata.length) {
    const match = metadata.slice(nextLoc).match(kKeyRegEx);
    if (!match) {
      break;
    }
    const key = match[1];
    let value = "";
    const remaining = metadata.slice(nextLoc + match[0].length);
    const nextMatch = remaining.match(kKeyRegEx);
    if (nextMatch) {
      value = remaining.slice(0, nextMatch.index);
      nextLoc = nextLoc + match[0].length + (nextMatch.index || 0);
    } else {
      value = remaining;
      nextLoc = metadata.length;
    }

    cellMetadata[key] = JSON.parse(value);
  }

  return cellMetadata;
}

export function jupyterFromFile(input: string): JupyterNotebook {
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
  execution: FormatExecution;
  toHtml?: boolean;
  toLatex?: boolean;
  toMarkdown?: boolean;
  figFormat?: string;
  figDpi?: number;
}

export interface JupyterToMarkdownResult {
  markdown: string;
  dependencies?: JupyterWidgetDependencies;
  htmlPreserve?: Record<string, string>;
}

export function jupyterToMarkdown(
  nb: JupyterNotebook,
  options: JupyterToMarkdownOptions,
): JupyterToMarkdownResult {
  // optional content injection / html preservation for html output
  const dependencies = options.toHtml
    ? extractJupyterWidgetDependencies(nb)
    : undefined;
  const htmlPreserve = options.toHtml ? removeAndPreserveHtml(nb) : undefined;

  // generate markdown
  const md: string[] = [];

  // validate unique cell labels as we go
  const validateCellLabel = cellLabelValidator();

  // track current code cell index (for progress)
  let codeCellIndex = 0;

  for (let i = 0; i < nb.cells.length; i++) {
    // get cell
    const cell = nb.cells[i];

    // validate unique cell labels
    validateCellLabel(cell);

    // markdown from cell
    switch (cell.cell_type) {
      case "markdown":
        md.push(...mdFromContentCell(cell));
        break;
      case "raw":
        md.push(...mdFromRawCell(cell, i === 0));
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
    dependencies,
    htmlPreserve,
  };
}

function mdFromContentCell(cell: JupyterCell) {
  return [...cell.source, "\n\n"];
}

function mdFromRawCell(cell: JupyterCell, firstCell: boolean) {
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

  // if it's the first cell then it may be the yaml block, do some
  // special handling to remove any "jupyter" metadata so that if
  // the file is run through "quarto render" it's treated as a plain
  // markdown file
  if (firstCell) {
    return mdFromContentCell({
      ...cell,
      source: cell.source.filter((line) => {
        return !/^jupyter:\s+true\s*$/.test(line);
      }),
    });
  } else {
    return mdFromContentCell(cell);
  }
}

// https://ipython.org/ipython-doc/dev/notebook/nbformat.html
// https://github.com/mwouts/jupytext/blob/master/jupytext/cell_to_text.py
function mdFromCodeCell(
  cell: JupyterCell,
  cellIndex: number,
  options: JupyterToMarkdownOptions,
) {
  // bail if we aren't including this cell
  if (!includeCell(cell, options.execution)) {
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

  // metadata to exclude from cell div attributes
  const kCellMetadataFilter = [
    kCellCollapsed,
    kCellAutoscroll,
    kCellDeletable,
    kCellFormat,
    kCellName,
    kCellLabel,
    kCellFigCap,
    kCellFigSubCap,
    kCellFigScap,
    kCellFigLink,
    kCellFigAlign,
    kCellFigEnv,
    kCellFigPos,
    kCellClasses,
    kCellWidth,
    kCellHeight,
    kCellAlt,
    kCellLinesToNext,
  ];

  // determine label -- this will be forwarded to the output (e.g. a figure)
  // if there is a single output. otherwise it will included on the enclosing
  // div and used as a prefix for the individual outputs
  const label = cellLabel(cell);
  const labelCellContainer = shouldLabelCellContainer(cell, options);
  if (label && labelCellContainer) {
    divMd.push(`${label} `);
  }

  // resolve caption (main vs. sub)
  const { cellCaption, outputCaptions } = resolveCaptions(cell);

  // cell_type classes
  divMd.push(`.cell `);

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

  // forward other attributes we don't know about
  for (const key of Object.keys(cell.metadata)) {
    if (!kCellMetadataFilter.includes(key.toLowerCase())) {
      // deno-lint-ignore no-explicit-any
      const value = (cell.metadata as any)[key];
      if (value) {
        divMd.push(`${key}="${value}" `);
      }
    }
  }

  // create string for div enclosure (we'll use it later but
  // only if there is actually content in the div)
  const divBeginMd = divMd.join("").replace(/ $/, "").concat("}\n");

  // write code if appropriate
  if (includeCode(cell, options.execution)) {
    md.push("``` {");
    if (typeof cell.metadata[kCellLstLabel] === "string") {
      let label = cell.metadata[kCellLstLabel]!;
      if (!label.startsWith("#")) {
        label = "#" + label;
      }
      md.push(label + " ");
    }
    md.push("." + options.language);
    md.push(" .cell-code");
    if (hideCode(cell, options.execution)) {
      md.push(" .hidden");
    }
    if (typeof cell.metadata[kCellLstCap] === "string") {
      md.push(` caption=\"${cell.metadata[kCellLstCap]}\"`);
    }
    md.push("}\n");
    md.push(...cell.source, "\n");
    md.push("```\n");
  }

  // write output if approproate
  if (includeOutput(cell, options.execution)) {
    // compute label prefix for output (in case we need it for files, etc.)
    const labelName = label
      ? label.replace(/^#/, "").replaceAll(":", "-")
      : ("cell-" + (cellIndex + 1));

    // strip spaces, special characters, etc. for latex friendly paths
    const outputName = pandocAutoIdentifier(labelName, true) + "-output";

    let nextOutputSuffix = 1;
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
        !includeWarnings(cell, options.execution)
      ) {
        continue;
      }

      // leading newline and beginning of div
      md.push("\n::: {");

      // include label/id if appropriate
      const outputLabel = label && labelCellContainer && isDisplayData(output)
        ? (label + "-" + nextOutputSuffix++)
        : label;
      if (outputLabel && shouldLabelOutputContainer(output, options)) {
        md.push(outputLabel + " ");
      }

      // add output class name
      if (output.output_type === "stream") {
        const stream = output as JupyterOutputStream;
        md.push(`.cell-output-${stream.name}`);
      } else {
        md.push(`.${outputTypeCssClass(output.output_type)}`);
      }

      // add hidden if necessary
      if (
        hideOutput(cell, options.execution) ||
        (isWarningOutput(output) && hideWarnings(cell, options.execution))
      ) {
        md.push(` .hidden`);
      }

      md.push("}\n");

      // broadcast figure options
      const figureOptions: JupyterOutputFigureOptions = {};
      const broadcastFigureOption = (
        name: "fig.link" | "fig.env" | "fig.pos" | "fig.scap",
      ) => {
        const value = cell.metadata[name];
        if (value) {
          if (Array.isArray(value)) {
            return value[index];
          } else {
            return value;
          }
        } else {
          return null;
        }
      };
      figureOptions[kCellFigScap] = broadcastFigureOption(kCellFigScap);
      figureOptions[kCellFigLink] = broadcastFigureOption(kCellFigLink);
      figureOptions[kCellFigEnv] = broadcastFigureOption(kCellFigEnv);
      figureOptions[kCellFigPos] = broadcastFigureOption(kCellFigPos);

      // produce output
      if (output.output_type === "stream") {
        md.push(mdOutputStream(output as JupyterOutputStream));
      } else if (output.output_type === "error") {
        md.push(mdOutputError(output as JupyterOutputError));
      } else if (isDisplayData(output)) {
        const caption = isCaptionableData(output)
          ? (outputCaptions.shift() || null)
          : null;
        md.push(mdOutputDisplayData(
          outputLabel,
          caption,
          outputName + "-" + (index + 1),
          output as JupyterOutputDisplayData,
          options,
          figureOptions,
        ));
        // if this isn't an image and we have a caption, place it at the bottom of the div
        if (caption && !isImage(output, options)) {
          md.push(`\n${caption}\n`);
        }
      } else {
        throw new Error("Unexpected output type " + output.output_type);
      }

      // terminate div
      md.push(`:::\n`);
    }
  }

  // write md w/ div enclosure (if there is any md to write)
  if (md.length > 0) {
    // begin
    md.unshift(divBeginMd);

    // see if there is a cell caption
    if (cellCaption) {
      md.push("\n" + cellCaption + "\n");
    }

    // end div
    md.push(":::\n");

    // lines to next cell
    md.push("\n".repeat((cell.metadata.lines_to_next_cell || 1)));
  }

  return md;
}

function isImage(output: JupyterOutput, options: JupyterToMarkdownOptions) {
  if (isDisplayData(output)) {
    const mimeType = displayDataMimeType(
      output as JupyterOutputDisplayData,
      options,
    );
    if (mimeType) {
      if (displayDataIsImage(mimeType)) {
        return true;
      }
    }
  }
  return false;
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
  figureOptions: JupyterOutputFigureOptions,
) {
  const mimeType = displayDataMimeType(output, options);
  if (mimeType) {
    if (displayDataIsImage(mimeType)) {
      return mdImageOutput(
        label,
        caption,
        filename,
        mimeType,
        output,
        options,
        figureOptions,
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
  output: JupyterOutputDisplayData,
  options: JupyterToMarkdownOptions,
  figureOptions: JupyterOutputFigureOptions,
) {
  // alias output properties
  const data = output.data[mimeType] as string[];
  const metadata = output.metadata[mimeType];

  // attributes (e.g. width/height/alt)
  function metadataValue<T>(key: string, defaultValue: T) {
    return metadata && metadata[key] ? metadata["key"] as T : defaultValue;
  }
  let width = metadataValue(kCellWidth, 0);
  let height = metadataValue(kCellHeight, 0);
  const alt = caption || metadataValue(kCellAlt, "");

  // calculate output file name
  const ext = extensionForMimeImageType(mimeType);
  const imageFile = join(options.assets.figures_dir, filename + "." + ext);

  // get the data
  const imageText = Array.isArray(data)
    ? (data as string[]).join("")
    : data as string;

  // base64 decode if it's not svg
  const outputFile = join(options.assets.base_dir, imageFile);
  if (mimeType !== kImageSvg) {
    const imageData = base64decode(imageText);

    // if we are in retina mode, then derive width and height from the image
    if (
      mimeType === kImagePng && options.figFormat === "retina" && options.figDpi
    ) {
      const png = new PngImage(imageData);
      if (
        png.dpiX === (options.figDpi * 2) && png.dpiY === (options.figDpi * 2)
      ) {
        width = Math.round(png.width / 2);
        height = Math.round(png.height / 2);
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
      image += `${label} `;
    }
    if (width) {
      image += `width=${width} `;
    }
    if (height) {
      image += `height=${height} `;
    }
    [kCellFigAlign, kCellFigEnv, kCellFigPos, kCellFigScap].forEach(
      (attrib) => {
        // deno-lint-ignore no-explicit-any
        const value = (figureOptions as any)[attrib];
        if (value) {
          image += `${attrib}='${value}' `;
        }
      },
    );

    image = image.trimRight() + "}";
  }

  // surround with link if we have one
  if (figureOptions[kCellFigLink]) {
    image = `[${image}](${figureOptions[kCellFigLink]})`;
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
  const output = text.join("");
  const md: string[] = [
    begin + "\n",
    output + (output.endsWith("\n") ? "" : "\n"),
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

function outputTypeCssClass(output_type: string) {
  if (["display_data", "execute_result"].includes(output_type)) {
    output_type = "display";
  }
  return `cell-output-${output_type}`;
}
