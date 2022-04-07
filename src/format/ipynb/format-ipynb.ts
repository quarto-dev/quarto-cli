/*
* format-ipynb.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import {
  kCellFormat,
  kCellRawMimeType,
  kDefaultImageExtension,
} from "../../config/constants.ts";
import { Format } from "../../config/types.ts";
import { jupyterFromFile } from "../../core/jupyter/jupyter.ts";
import {
  kApplicationRtf,
  kRestructuredText,
  kTextHtml,
  kTextLatex,
} from "../../core/mime.ts";
import { createFormat } from "../formats-shared.ts";

export function ipynbFormat(): Format {
  return createFormat("ipynb", {
    pandoc: {
      standalone: true,
      [kDefaultImageExtension]: "png",
    },
    formatExtras: () => {
      return {
        postprocessors: [async (output: string) => {
          // convert raw cell metadata format to raw_mimetype used by jupyter
          const nb = await jupyterFromFile(output);

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
