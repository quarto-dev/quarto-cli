import { ensureDirSync } from "fs/ensure_dir.ts";
import { join } from "path/mod.ts";
import { walkSync } from "fs/walk.ts";
import { generate as generateUuid } from "uuid/v4.ts";
import { decode as base64decode } from "encoding/base64.ts";

import { FormatPandoc } from "../config/format.ts";

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
import { kIncludeAfterBody, kIncludeInHeader } from "../config/constants.ts";

// TODO: consider "include-input" (jupytext syncing w/ Rmd)
// TODO: hide-input, hide-output, hide-cell from jupyterbook
// TODO: consider using include-input/remove-input rather than include-code

// TODO: test other mime types (e.g. latex)

// TODO: test jupyter widgets

// we need to embed jquery, requirejs, and the jupyter widgets embed bootstrapper:
/*
https://github.com/jupyter/nbconvert/blob/d88021657ff2177619d79b37fe136ef0ac759efe/share/jupyter/nbconvert/templates/classic/index.html.j2#L15-L28
https://github.com/jupyter/nbconvert/blob/master/share/jupyter/nbconvert/templates/base/jupyter_widgets.html.j2
*/
// see also ways to get the correct URLs in python: https://github.com/jupyter-widgets/ipywidgets/issues/2284

// TODO: investimate viola (deploy notebooks w/ a backend)
// widget example: ipyleaflet, need to check for metadata.widgets to see if we need the widget srcipt
// (seems like require and jquery are included unqualfied), inject those via jwidgets.html resource
// this is the output....need to figure out how to treat that in pandoc.
// may need to render the widget data from the metadata.widgets into somewhere else in the doc
/*
"data": {
      "application/vnd.jupyter.widget-view+json": {
       "model_id": "178d9687b44342a39e90b009536bbc16",
       "version_major": 2,
       "version_minor": 0
      },
      "text/plain": [
       "Map(center=[52.204793, 360.121558], controls=(ZoomControl(options=['position', 'zoom_in_text', 'zoom_in_title'…"
      ]
     },

*/

// footer gets all of the widget data (do this after cell loop)
// may want this to be a pandoc include
// note: may also need require.js, widget bootstrapper in head (also pandoc includes)
/*
  {%- block footer %}
  {% set mimetype = 'application/vnd.jupyter.widget-state+json'%} 
  {% if mimetype in nb.metadata.get("widgets",{})%}
  <script type="{{ mimetype }}">
  {{ nb.metadata.widgets[mimetype] | json_dumps }}
  </script>
  */

// TODO: see about setting dpi / retina for matplotlib

// TODO: throw error if name/id is not unique across the document

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
  figures_dir: string;
  supporting_dir: string;
}

export function jupyterAssets(input: string, format: FormatPandoc) {
  // calculate and create directories
  const [base_dir, stem] = dirAndStem(input);
  const files_dir = stem + "_files";
  const to = (format.to || "html").replace(/[\+\-].*$/, "");
  const figures_dir = join(files_dir, "figure-" + to);
  ensureDirSync(figures_dir);

  // determine supporting_dir (if there are no other figures dirs then it's
  // the files dir, otherwise it's just the figures dir). note that
  // supporting_dir is the directory that gets removed after a self-contained
  // or non-keeping render is complete
  let supporting_dir = files_dir;
  for (
    const walk of walkSync(join(base_dir, files_dir), { maxDepth: 1 })
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
}

export interface JupyterToMarkdownResult {
  markdown: string;
  pandoc: FormatPandoc;
  htmlPreserve?: Record<string, string>;
}

export function jupyterToMarkdown(
  nb: JupyterNotebook,
  options: JupyterToMarkdownOptions,
): JupyterToMarkdownResult {
  // optional content injection / html preservation for html output
  let pandoc: FormatPandoc = {};
  let htmlPreserve: Record<string, string> | undefined;
  if (options.toHtml) {
    pandoc = widgetPandocIncludes(nb);
    htmlPreserve = removeAndPreserveRawHtml(nb);
  }

  // generate markdown
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

  // return markdown and any widget requirements
  return {
    markdown: md.join(""),
    pandoc,
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
    md.push("```{." + options.language + "}\n");
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
            options,
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
  md.push("\n".repeat((cell.metadata.lines_to_next_cell || 1)));

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
  options: JupyterToMarkdownOptions,
) {
  // determine display mime type
  const displayMimeType = () => {
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
  };

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
          options.assets,
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
        return mdJsonOutput(
          mimeType,
          output.data[mimeType] as Record<string, unknown>,
        );
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

function widgetPandocIncludes(nb: JupyterNotebook): FormatPandoc {
  // a 'javascript' widget doesn't use the jupyter widgets protocol, but rather just injects
  // text/html or application/javascript directly. futhermore these 'widgets' often assume
  // that require.js and jquery are available. for example, see:
  //   - https://github.com/mwouts/itables
  //   - https://plotly.com/python/
  const haveJavascriptWidgets = nb.cells.some((cell) => {
    if (cell.cell_type === "code" && cell.outputs) {
      return cell.outputs.some((output) => {
        return ["display_data", "execute_result"].includes(
          output.output_type,
        ) && (
          !!(output as JupyterOutputDisplayData).data[kApplicationJavascript] ||
          !!(output as JupyterOutputDisplayData).data[kTextHtml]
        );
      });
    } else {
      return false;
    }
  });

  // jupyter widgets confirm to the jupyter widget embedding protocol:
  // https://ipywidgets.readthedocs.io/en/latest/embedding.html#embeddable-html-snippet
  const haveJupyterWidgets = !!nb.metadata
    .widgets?.[kApplicationJupyterWidgetState];

  //

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
  const includeInHeader = widgetTempFile(head);
  const includeAfterBody = widgetTempFile(afterBody);

  // return result
  return {
    [kIncludeInHeader]: [includeInHeader],
    [kIncludeAfterBody]: [includeAfterBody],
  };
}

function removeAndPreserveRawHtml(
  nb: JupyterNotebook,
): Record<string, string> | undefined {
  const htmlPreserve: { [key: string]: string } = {};

  nb.cells.forEach((cell) => {
    if (cell.cell_type === "code") {
      cell.outputs?.forEach((output) => {
        if (
          output.output_type === "display_data" ||
          output.output_type === "execute_result"
        ) {
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
