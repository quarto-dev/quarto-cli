/*
* jupyter-shared.ts
*
* Copyright (C) 2020-2023 Posit Software, PBC
*
*/

import { JupyterNotebook, JupyterToMarkdownOptions } from "./types.ts";

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
        throw new Error(
          "Internal Error: Unknown data types " +
            JSON.stringify(Object.keys(data)),
        );
      };

      cell.outputs = [{
        metadata: {},
        output_type: "display_data",
        data: {
          "text/html": (cell.outputs ?? []).map((output) =>
            asTextHtml(output.data ?? {})
          ).flat(),
        },
      }];
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
