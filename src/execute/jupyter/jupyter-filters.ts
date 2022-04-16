/*
* jupyter-filters.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { existsSync } from "fs/exists.ts";
import { basename, dirname, isAbsolute, join } from "path/mod.ts";

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
      const scriptPath = join(dirname(file), script);
      const handler = handlerForScript(scriptPath);
      const result = (handler && existsSync(scriptPath))
        ? await handler.run(script, args.splice(1), json, {
          cwd: dirname(file),
          env: {
            PYTHONUNBUFFERED: "1",
          },
          stdout: "piped",
        })
        : await execProcess({
          cmd: [
            isAbsolute(script) ? script : basename(script),
            ...args.slice(1),
          ],
          cwd: dirname(file),
          env: {
            PYTHONUNBUFFERED: "1",
          },
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
