import { ensureDirSync } from "fs/ensure_dir.ts";
import { join } from "path/mod.ts";
import { decode as base64decode } from "encoding/base64.ts";
import {
  extensionForMimeImageType,
  kApplicationJavascript,
  kApplicationJupyterWidgetState,
  kApplicationJupyterWidgetView,
  kApplicationPdf,
  kApplicationRtf,
  kImageJpeg,
  kImagePng,
  kImageSvg,
  kRestructuredText,
  kTextHtml,
  kTextLatex,
  kTextMarkdown,
  kTextPlain,
} from "./mime.ts";

import { dirAndStem } from "./path.ts";

// TODO: consider "include-input" (jupytext syncing w/ Rmd)
// TODO: hide-input, hide-output, hide-cell from jupyterbook
// TODO: consider using include-input/remove-input rather than include-code

// TODO: need a concept of display_data_priority based on what the underlying
// target format is (html vs. latex for sure, perhaps others). see:
// https://github.com/jupyter/nbconvert/blob/master/nbconvert/exporters/latex.py

// TODO: JS/CSS/etc. for other mime types

// TODO: see about setting dpi / retina for matplotlib

// TODO: throw error if name/id is not unique across the document

// TODO: need to create pandoc format based figures dir and
// mirror supporting files logic from rmarkdown

// TODO: warning needs to get rid of wierd '<ipython>' artifact

// nbformat v4
// https://ipython.org/ipython-doc/dev/notebook/nbformat.html

export const kCellCollapsed = "collapsed";
export const kCellAutoscroll = "autoscroll";
export const kCellDeletable = "deletable";
export const kCellFormat = "format";
export const kCellName = "name";
export const kCellTags = "tags";
export const kCellId = "id";
export const kCellClass = "class";
export const kCellLinesToNext = "lines_to_next_cell";
export const kRawMimeType = "raw_mimetype";

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
    [kCellCollapsed]?: boolean;
    [kCellAutoscroll]?: boolean | "auto";
    [kCellDeletable]?: boolean;
    [kCellFormat]?: string; // for "raw"
    [kCellName]?: string;
    [kCellTags]?: string[];
    [kRawMimeType]?: string;

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
  files_dir: string;
  figures_dir: string;
}

export function jupyterAssets(input: string) {
  const [base_dir, stem] = dirAndStem(input);
  const files_dir = stem + "_files";
  const figures_dir = join(files_dir, "figure-ipynb");
  ensureDirSync(figures_dir);
  return {
    base_dir,
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

  let codeCellIndex = 0;
  for (const cell of nb.cells) {
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

  // return markdown
  return md.join("");
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
  cellIndex: number,
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
  const id = (cell.metadata.id || cell.metadata.name || "").replace(/^#/, "");
  if (id) {
    divMd.push(`#${id} `);
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
    // compute label prefix for output (in case we need it for files, etc.)
    const outputName = (id ? id : "cell-" + (cellIndex + 1)) + "-output";

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
        case "execute_result":
          md.push(mdOutputDisplayData(
            outputName + "-" + (index + 1),
            output as JupyterOutputDisplayData,
            options.assets,
          ));
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

function mdOutputStream(output: JupyterOutputStream) {
  return mdCodeOutput(output.text);
}

function mdOutputError(output: JupyterOutputError) {
  return mdCodeOutput([output.ename + ": " + output.evalue]);
}

function mdOutputDisplayData(
  name: string,
  output: JupyterOutputDisplayData,
  assets: JupyterAssets,
) {
  // determine display mime type
  const displayMimeType = () => {
    const kDisplayPriority = [
      kApplicationJupyterWidgetState,
      kApplicationJupyterWidgetView,
      kApplicationJavascript,
      kTextHtml,
      kTextMarkdown,
      kImageSvg,
      kTextLatex,
      kApplicationPdf,
      kImagePng,
      kImageJpeg,
      kTextPlain,
    ];
    const availDisplay = Object.keys(output.data);
    for (const display of kDisplayPriority) {
      if (availDisplay.includes(display)) {
        return display;
      }
    }
    return null;
  };

  // https://github.com/jupyter/nbconvert/blob/06f3a90f6b7b578a78efe1f17138a4fea43fcfa5/nbconvert/preprocessors/extractoutput.py#L89

  const mimeType = displayMimeType();
  if (mimeType) {
    switch (mimeType) {
      case kImagePng:
      case kImageJpeg:
      case kImageSvg:
      case kApplicationPdf:
        return mdImageOutput(
          name,
          mimeType,
          assets,
          output.data[mimeType] as string[],
          output.metadata[mimeType],
        );
      case kTextMarkdown:
      case kTextPlain:
        return mdMarkdownOutput(output.data[mimeType] as string[]);
      case kTextLatex:
        return mdLatexOutput(output.data[mimeType] as string[]);
      case kTextHtml:
        return mdHtmlOutput(output.data[mimeType] as string[]);
      case kApplicationJupyterWidgetState:
      case kApplicationJupyterWidgetView:
      case kApplicationJavascript:
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
  name: string,
  mimeType: string,
  assets: JupyterAssets,
  data: unknown,
  metadata?: Record<string, unknown>,
) {
  // attributes (e.g. width/height/alt)
  function metadataValue<T>(key: string, defaultValue: T) {
    return metadata && metadata[key] ? metadata["key"] as T : defaultValue;
  }
  const width = metadataValue("width", 0);
  const height = metadataValue("height", 0);
  const alt = metadataValue("alt", "");

  // calculate output file name
  const ext = extensionForMimeImageType(mimeType);
  const imageFile = join(assets.figures_dir, name + "." + ext);

  // get the data
  const imageText = Array.isArray(data)
    ? (data as string[]).join("")
    : data as string;

  // base64 decode if it's not svg
  const outputFile = join(assets.base_dir, imageFile);
  if (mimeType !== kImageSvg) {
    const imageData = base64decode(imageText);
    Deno.writeFileSync(outputFile, imageData);
  } else {
    Deno.writeTextFileSync(outputFile, imageText);
  }

  let image = `![${alt}](${imageFile})`;
  if (width || height) {
    image += "{";
    if (width) {
      image += `width=${width}`;
    }
    if (height) {
      if (width) {
        image += " ";
      }
      image += `height=${height}`;
    }
    image += "}";
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
