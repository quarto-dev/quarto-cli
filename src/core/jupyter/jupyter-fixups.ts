/*
* jupyter-shared.ts
*
* Copyright (C) 2020-2023 Posit Software, PBC
*
*/

import { warning } from "log/mod.ts";
import {
  JupyterNotebook,
  JupyterOutput,
  JupyterToMarkdownOptions,
} from "./types.ts";

function fixupBokehCells(
  nb: JupyterNotebook,
  _options: JupyterToMarkdownOptions,
): JupyterNotebook {
  for (const cell of nb.cells) {
    if (cell.cell_type === "code") {
      let needsFixup = false;
      for (const output of cell?.outputs ?? []) {
        if (output.data === undefined) {
          continue;
        }
        if (output.data["application/vnd.bokehjs_load.v0+json"]) {
          needsFixup = true;
        }
      }

      if (!needsFixup) {
        continue;
      }
      const asTextHtml = (data: Record<string, unknown>) => {
        if (data["text/html"]) {
          return data["text/html"];
        }
        if (data["application/javascript"]) {
          return [
            "<script>",
            ...data["application/javascript"] as string[],
            "</script>",
          ];
        }
        warning(
          "jupyter-fixups: unknown data types " +
            JSON.stringify(Object.keys(data)),
        );
        warning("will not fixup this bokeh cell.");
        throw new Error("");
      };

      // bokeh emits one 'initialization' cell once per notebook,
      // and then two cells per plot. So we merge the three first cells into
      // one, and then merge every two cells after that.
      //
      // Some .ipynb files in the wild have application/vnd.bokehjs_load.v0+json type
      // but cells with no outputs, so we need to check
      // and only do this fixup if these outputs exist
      //
      // We'll just be extra defensive and only do this if it runs with
      // no errors.

      try {
        const oldOutputs = cell.outputs!;

        const newOutputs: JupyterOutput[] = [
          {
            metadata: {},
            output_type: "display_data",
            data: {
              "text/html": [
                asTextHtml(oldOutputs[0].data!),
                asTextHtml(oldOutputs[1].data!),
                asTextHtml(oldOutputs[2].data!),
              ].flat(),
            },
          },
        ];
        for (let i = 3; i < oldOutputs.length; i += 2) {
          newOutputs.push({
            metadata: {},
            output_type: "display_data",
            data: {
              "text/html": [
                asTextHtml(oldOutputs[i].data!),
                asTextHtml(oldOutputs[i + 1].data!),
              ].flat(),
            },
          });
        }
        cell.outputs = newOutputs;
      } catch {
        warning(
          "jupyter-fixup: cells without output data. Will not fixup bokeh cell",
        );
      }
    }
  }

  return nb;
}

const fixups: ((
  nb: JupyterNotebook,
  options: JupyterToMarkdownOptions,
) => JupyterNotebook)[] = [
  fixupBokehCells,
];

export function fixupJupyterNotebook(
  nb: JupyterNotebook,
  options: JupyterToMarkdownOptions,
): JupyterNotebook {
  for (const fixup of fixups) {
    nb = fixup(nb, options);
  }
  return nb;
}
