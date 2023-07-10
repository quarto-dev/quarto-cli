/*
 * format-ipynb.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { basename, dirname, join } from "path/mod.ts";
import { readPartials } from "../../command/render/template.ts";
import {
  kCellFormat,
  kCellRawMimeType,
  kDefaultImageExtension,
  kIPynbTitleBlockTemplate,
} from "../../config/constants.ts";
import { Format, PandocFlags } from "../../config/types.ts";
import {
  jupyterFromFile,
  kQuartoMimeType,
} from "../../core/jupyter/jupyter.ts";
import {
  kApplicationRtf,
  kRestructuredText,
  kTextHtml,
  kTextLatex,
} from "../../core/mime.ts";
import { formatResourcePath } from "../../core/resources.ts";
import { createFormat } from "../formats-shared.ts";

import { decode as base64decode } from "encoding/base64.ts";
import {
  JupyterOutput,
  JupyterOutputDisplayData,
} from "../../core/jupyter/types.ts";

export function ipynbTitleTemplatePath() {
  return formatResourcePath(
    "ipynb",
    join("templates", "title-block.md"),
  );
}

export function ipynbFormat(): Format {
  return createFormat("Jupyter", "ipynb", {
    pandoc: {
      standalone: true,
      [kDefaultImageExtension]: "png",
    },
    formatExtras: (
      input: string,
      _markdown: string,
      _flags: PandocFlags,
      format: Format,
    ) => {
      // Snag the p

      const resolveTemplate = () => {
        // iPynbs have a special title-block template partial that they can provide
        // to permit the customization of the title block
        const titleTemplate = ipynbTitleTemplatePath();

        const partials = readPartials(format.metadata, dirname(input));
        if (partials.length > 0) {
          const userTitleTemplate = partials.find((part) => {
            return basename(part) === "title-block.md";
          });
          if (userTitleTemplate) {
            return userTitleTemplate;
          } else {
            return titleTemplate;
          }
        } else {
          return titleTemplate;
        }
      };

      return {
        metadata: {
          [kIPynbTitleBlockTemplate]: resolveTemplate(),
        },
        postprocessors: [(output: string) => {
          // read notebook
          const nb = jupyterFromFile(output);

          // We 'hide' widget metafrom the YAML by encoding it to
          // prevent the YAML representation from mangling it. Restore
          // it here if it is so hidden
          const widgets = nb.metadata.widgets;
          if (widgets && typeof (widgets) === "string") {
            nb.metadata.widgets = JSON.parse(
              new TextDecoder().decode(base64decode(widgets)),
            );
          }

          // convert raw cell metadata format to raw_mimetype used by jupyter
          nb.cells = nb.cells.map((cell) => {
            if (cell.cell_type == "raw") {
              if (cell.metadata[kCellFormat]) {
                const format = cell.metadata[kCellFormat];
                delete cell.metadata[kCellFormat];
                if (format === kTextHtml) {
                  cell.metadata[kCellRawMimeType] = format;
                } else if (format === "tex") {
                  cell.metadata[kCellRawMimeType] = kTextLatex;
                } else if (format === "rst") {
                  cell.metadata[kCellRawMimeType] = kRestructuredText;
                } else if (format === "rtf") {
                  cell.metadata[kCellRawMimeType] = kApplicationRtf;
                } else {
                  // restore format b/c we didn't convert it
                  cell.metadata[kCellFormat] = format;
                }
              }
            }

            // Fix up mime types that Quarto has emplaced
            cell.outputs?.forEach((output) => {
              const cellOutput = output as JupyterOutput;
              if (cellOutput.output_type === "display_data") {
                const cellDisplayOutput =
                  cellOutput as JupyterOutputDisplayData;
                if (cellDisplayOutput.data["application/json"]) {
                  const jsonData = cellDisplayOutput
                    .data["application/json"] as Record<
                      string,
                      unknown
                    >;
                  if (jsonData[kQuartoMimeType]) {
                    const realMimetype = jsonData[kQuartoMimeType] as string;
                    delete jsonData[kQuartoMimeType];

                    cellDisplayOutput.data[realMimetype] = jsonData;
                    delete cellDisplayOutput.data["application/json"];
                  }
                }
              }
            });

            return cell;
          });
          Deno.writeTextFileSync(output, JSON.stringify(nb, null, 2));
          return Promise.resolve();
        }],
      };
    },
  });
}
