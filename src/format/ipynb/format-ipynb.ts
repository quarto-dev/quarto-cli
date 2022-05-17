/*
* format-ipynb.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { basename, join } from "path/mod.ts";
import { readPartials } from "../../command/render/template.ts";
import {
  kCellFormat,
  kCellRawMimeType,
  kDefaultImageExtension,
  kIPynbTitleBlockTemplate,
} from "../../config/constants.ts";
import { Format, PandocFlags } from "../../config/types.ts";
import { jupyterFromFile } from "../../core/jupyter/jupyter.ts";
import {
  kApplicationRtf,
  kRestructuredText,
  kTextHtml,
  kTextLatex,
} from "../../core/mime.ts";
import { formatResourcePath } from "../../core/resources.ts";
import { createFormat } from "../formats-shared.ts";

export function ipynbFormat(): Format {
  return createFormat("ipynb", {
    pandoc: {
      standalone: true,
      [kDefaultImageExtension]: "png",
    },
    formatExtras: (_input: string, _flags: PandocFlags, format: Format) => {
      // Snag the p

      const resolveTemplate = () => {
        // iPynbs have a special title-block template partial that they can provide
        // to permit the customization of the title block
        const titleTemplate = formatResourcePath(
          "ipynb",
          join("templates", "title-block.md"),
        );

        const partials = readPartials(format.metadata);
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
            return cell;
          });
          Deno.writeTextFileSync(output, JSON.stringify(nb, null, 2));
          return Promise.resolve();
        }],
      };
    },
  });
}
