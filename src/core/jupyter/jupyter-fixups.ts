/*
* jupyter-shared.ts
*
* Copyright (C) 2020-2023 Posit Software, PBC
*
*/

import { JupyterNotebook } from "./types.ts";

function fixupBokehCells(nb: JupyterNotebook): JupyterNotebook {
  console.log(JSON.stringify({ nb }, null, 2));

  for (const cell of nb.cells) {
    if (cell.cell_type === "code") {
      for (const output of cell?.outputs ?? []) {
        // FINISH ME
      }
    }
  }
  return nb;
}

const fixups: ((nb: JupyterNotebook) => JupyterNotebook)[] = [
  fixupBokehCells,
];

export function fixupJupyterNotebook(nb: JupyterNotebook): JupyterNotebook {
  for (const fixup of fixups) {
    nb = fixup(nb);
  }
  return nb;
}
