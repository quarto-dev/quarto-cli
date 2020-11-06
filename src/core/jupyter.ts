import { ensureDirSync } from "fs/ensure_dir.ts";
import { join } from "path/mod.ts";
import { walkSync } from "fs/walk.ts";
import { generate as generateUuid } from "uuid/v4.ts";
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

import { pandocAutoIdentifier } from "./pandoc/pandoc_id.ts";

import { dirAndStem } from "./path.ts";
import PngImage from "./png.ts";

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
  includeCode?: boolean;
  includeOutput?: boolean;
  includeWarnings?: boolean;
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
  const includeFiles = options.toHtml ? widgetPandocIncludes(nb) : undefined;
  const htmlPreserve = options.toHtml
    ? removeAndPreserveRawHtml(nb)
    : undefined;

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

// cell output control tags. also define some aliases for tags used in
// jupyterbook/runtools: https://github.com/mwouts/jupytext/issues/337
const kIncludeCodeTags = ["include-code"];
const kIncludeOutputTags = ["include-output"];
const kIncludeWarningsTags = ["include-warnings"];
const kRemoveCodeTags = ["remove-code", "remove-input", "remove_input"];
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
    kCellTags,
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
  const label = cellContainerLabel(cellLabel(cell), cell, options);
  if (label) {
    divMd.push(`#${label} `);
  }

  // cell_type classes
  divMd.push(`.cell .code `);

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
      divMd.push(`${key}="${(cell.metadata as any)[key]}" `);
    }
  }

  // strip trailing space and add terminator
  md.push(divMd.join("").replace(/ $/, "").concat("}\n"));

  // write code if appropriate
  if (includeCode(cell, options.includeCode)) {
    md.push("```{." + options.language + "}\n");
    md.push(...cell.source, "\n");
    md.push("```\n");
  }

  // write output if approproate
  if (includeOutput(cell, options.includeOutput)) {
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

function displayDataMimeType(
  output: JupyterOutputDisplayData,
  options: JupyterToMarkdownOptions,
) {
  const displayPriority = [
    kTextMarkdown,
    kImageSvg,
    kImagePng,
    kImageJpeg,
  ];
  if (options.toHtml) {
    displayPriority.push(
      kApplicationJupyterWidgetState,
      kApplicationJupyterWidgetView,
      kApplicationJavascript,
      kTextHtml,
    );
  } else if (options.toLatex) {
    displayPriority.push(
      kTextLatex,
      kApplicationPdf,
    );
  } else if (options.toMarkdown) {
    displayPriority.push(
      kTextHtml,
    );
  }
  displayPriority.push(
    kTextPlain,
  );

  const availDisplay = Object.keys(output.data);
  for (const display of displayPriority) {
    if (availDisplay.includes(display)) {
      return display;
    }
  }
  return null;
}

function displayDataIsImage(mimeType: string) {
  return [kImagePng, kImageJpeg, kImageSvg, kApplicationPdf].includes(mimeType);
}

function displayDataIsMarkdown(mimeType: string) {
  return [kTextMarkdown, kTextPlain].includes(mimeType);
}

function displayDataIsLatex(mimeType: string) {
  return [kTextLatex].includes(mimeType);
}

function displayDataIsHtml(mimeType: string) {
  return [kTextHtml].includes(mimeType);
}

function displayDataIsJson(mimeType: string) {
  return [kApplicationJupyterWidgetState, kApplicationJupyterWidgetView]
    .includes(mimeType);
}

function displayDataIsJavascript(mimeType: string) {
  return [kApplicationJavascript].includes(mimeType);
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

function isDisplayData(output: JupyterOutput) {
  return ["display_data", "execute_result"].includes(output.output_type);
}

function cellLabel(cell: JupyterCell) {
  return (cell.metadata[kCellLabel] || cell.metadata[kCellName] || "")
    .toLowerCase();
}

function cellContainerLabel(
  label: string,
  cell: JupyterCell,
  options: JupyterToMarkdownOptions,
) {
  if (label) {
    // apply pandoc auto-identifier treatment (but allow prefix)
    label = label.replace(/(^\w+\:)?(.*)$/, (str, p1, p2) => {
      return (p1 || "") + pandocAutoIdentifier(p2, true);
    });

    // no outputs
    if (!cell.outputs) {
      return label;
    }

    // not including output
    if (!includeOutput(cell, options.includeOutput)) {
      return label;
    }

    // no display data outputs
    const displayDataOutputs = cell.outputs.filter(isDisplayData);
    if (displayDataOutputs.length === 0) {
      return label;
    }

    // multiple display data outputs (apply to container then apply sub-labels to outputs)
    if (displayDataOutputs.length > 1) {
      // see if the outputs share a common label type, if they do then apply
      // that label type to the parent
      const labelTypes = displayDataOutputs.map((output) =>
        outputLabelType(output, options)
      );
      const labelType = labelTypes[0];
      if (labelType && labelTypes.every((type) => labelType === type)) {
        if (!label.startsWith(labelType + ":")) {
          return `${labelType}:${label}`;
        } else {
          return label;
        }
      } else {
        return label;
      }
    }

    // in the case of a single display data output, check to see if it is directly
    // targetable with a label (e.g. a figure). if it's not then just apply the
    // label to the container
    if (!outputLabelType(cell.outputs[0], options)) {
      return label;
    }

    // not targetable
    return null;
  } else {
    return null;
  }
}

// see if an output is one of our known types (e.g. 'fig')
function outputLabelType(
  output: JupyterOutput,
  options: JupyterToMarkdownOptions,
) {
  if (isDisplayData(output)) {
    const mimeType = displayDataMimeType(
      output as JupyterOutputDisplayData,
      options,
    );
    if (mimeType && displayDataIsImage(mimeType)) {
      return kFigLabel;
    }
  }
  return null;
}

// validate unique labels
function cellLabelValidator() {
  const cellLabels = new Set<string>();
  return function (cell: JupyterCell) {
    const label = cellLabel(cell);
    if (label) {
      if (cellLabels.has(label)) {
        throw new Error(
          "Cell label names must be unique (found duplicate '" + label + "')",
        );
      } else {
        cellLabels.add(label);
      }
    }
  };
}

function widgetPandocIncludes(nb: JupyterNotebook) {
  // a 'javascript' widget doesn't use the jupyter widgets protocol, but rather just injects
  // text/html or application/javascript directly. futhermore these 'widgets' often assume
  // that require.js and jquery are available. for example, see:
  //   - https://github.com/mwouts/itables
  //   - https://plotly.com/python/
  const haveJavascriptWidgets = haveOutputType(
    nb,
    [kApplicationJavascript, kTextHtml],
  );

  // jupyter widgets confirm to the jupyter widget embedding protocol:
  // https://ipywidgets.readthedocs.io/en/latest/embedding.html#embeddable-html-snippet
  const haveJupyterWidgets = haveOutputType(
    nb,
    [kApplicationJupyterWidgetView],
  );

  // write required dependencies into head
  const head: string[] = [];
  if (haveJavascriptWidgets || haveJupyterWidgets) {
    head.push(
      '<script src="https://cdnjs.cloudflare.com/ajax/libs/require.js/2.3.6/require.min.js" integrity="sha512-c3Nl8+7g4LMSTdrm621y7kf9v3SDPnhxLNhcjFJbKECVnmZHTdo+IRO05sNLTH/D3vA6u1X32ehoLC7WFVdheg==" crossorigin="anonymous"></script>',
    );
    head.push(
      '<script src="https://cdnjs.cloudflare.com/ajax/libs/jquery/3.5.1/jquery.min.js" integrity="sha512-bLT0Qm9VnAYZDflyKcBaQ2gg0hSYNQrJ8RilYldYQ1FxQYoCLtUjuuRuZo+fjqhx/qtq/1itJ0C2ejDxltZVFg==" crossorigin="anonymous"></script>',
    );
    head.push(
      "<script type=\"application/javascript\">define('jquery', [],function() {return window.jQuery;})</script>",
    );
  }
  if (haveJupyterWidgets) {
    head.push(
      '<script src="https://unpkg.com/@jupyter-widgets/html-manager@*/dist/embed-amd.js" crossorigin="anonymous"></script>',
    );
  }

  // write jupyter widget state after body if it exists
  const afterBody: string[] = [];
  if (haveJupyterWidgets) {
    afterBody.push(`<script type=${kApplicationJupyterWidgetState}>`);
    afterBody.push(
      JSON.stringify(nb.metadata.widgets[kApplicationJupyterWidgetState]),
    );
    afterBody.push("</script>");
  }

  // create pandoc includes for our head and afterBody
  const widgetTempFile = (lines: string[]) => {
    const tempFile = Deno.makeTempFileSync(
      { prefix: "jupyter-widgets-", suffix: ".html" },
    );
    Deno.writeTextFileSync(tempFile, lines.join("\n") + "\n");
    return tempFile;
  };
  const inHeaderFile = widgetTempFile(head);
  const afterBodyFile = widgetTempFile(afterBody);

  // return result
  return {
    inHeader: [inHeaderFile],
    afterBody: [afterBodyFile],
  };
}

function removeAndPreserveRawHtml(
  nb: JupyterNotebook,
): Record<string, string> | undefined {
  const htmlPreserve: { [key: string]: string } = {};

  nb.cells.forEach((cell) => {
    if (cell.cell_type === "code") {
      cell.outputs?.forEach((output) => {
        if (isDisplayData(output)) {
          const displayOutput = output as JupyterOutputDisplayData;
          const html = displayOutput.data[kTextHtml];
          const htmlText = Array.isArray(html) ? html.join("") : html as string;
          if (html) {
            const key = generateUuid();
            htmlPreserve[key] = htmlText;
            displayOutput.data[kTextMarkdown] = [
              "```{=html}\n" + key + "\n```\n",
            ];
            delete displayOutput.data[kTextHtml];
          }
        }
      });
    }
  });

  if (Object.keys(htmlPreserve).length > 0) {
    return htmlPreserve;
  } else {
    return undefined;
  }
}

function haveOutputType(nb: JupyterNotebook, mimeTypes: string[]) {
  return nb.cells.some((cell) => {
    if (cell.cell_type === "code" && cell.outputs) {
      return cell.outputs.some((output) => {
        if (isDisplayData(output)) {
          const outputTypes = Object.keys(
            (output as JupyterOutputDisplayData).data,
          );
          return outputTypes.some((type) => mimeTypes.includes(type));
        } else {
          return false;
        }
      });
    } else {
      return false;
    }
  });
}
