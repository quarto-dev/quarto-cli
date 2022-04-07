/*
* jupyter-filters.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { dirname } from "path/mod.ts";
import { pythonExec } from "../../core/jupyter/exec.ts";

import { execProcess } from "../../core/process.ts";
import { parseShellRunCommand } from "../../core/run/shell.ts";

export async function jupyterNotebookFiltered(
  file: string,
  filters?: string[],
) {
  let json = Deno.readTextFileSync(file);
  if (filters && filters.length > 0) {
    // run each of the filters in turn
    for (const filter of filters) {
      const args = parseShellRunCommand(filter);
      const script = args[0];
      const result = await execProcess({
        cmd: [
          ...(await pythonExec()),
          script,
          ...args,
        ],
        cwd: dirname(file),
        stdout: "piped",
      }, json);

      if (!result.success) {
        throw new Error();
      }
      json = result.stdout || json;
    }

    return json;
  } else {
    return json;
  }
}
