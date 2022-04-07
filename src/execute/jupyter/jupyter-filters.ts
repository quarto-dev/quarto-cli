/*
* jupyter-filters.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { dirname } from "path/mod.ts";

import { execProcess } from "../../core/process.ts";
import { handlerForScript } from "../../core/run/run.ts";
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
      const handler = handlerForScript(script);
      const result = handler
        ? await handler.run(script, args.splice(1), json, {
          cwd: dirname(file),
          stdout: "piped",
        })
        : await execProcess({
          cmd: args,
          cwd: dirname(file),
          stdout: "piped",
        });

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
