/*
* jupyter-filters.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { basename, dirname, extname, isAbsolute, join } from "path/mod.ts";
import { kIpynbFilters } from "../../config/constants.ts";
import { Format } from "../../config/types.ts";

import { execProcess } from "../../core/process.ts";
import { parseShellRunCommand } from "../../core/run/shell.ts";
import { pythonExec } from "./exec.ts";

export async function markdownFromNotebook(file: string, format?: Format) {
  // read file with any filters
  const nbContents = await jupyterNotebookFiltered(
    file,
    format?.execute[kIpynbFilters],
  );
  const nb = JSON.parse(nbContents);
  const cells = nb.cells as Array<{ cell_type: string; source: string[] }>;
  const markdown = cells.reduce((md, cell) => {
    if (["markdown", "raw"].includes(cell.cell_type)) {
      return md + "\n" + cell.source.join("") + "\n";
    } else {
      return md;
    }
  }, "");
  return markdown;
}

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

      const result = ([".py"].includes(extname(script).toLowerCase()))
        ? await execProcess({
          cmd: [
            ...(await pythonExec()),
            scriptPath,
            ...args.slice(1),
          ],
          cwd: dirname(file),
          env: {
            PYTHONUNBUFFERED: "1",
          },
          stdout: "piped",
        }, json)
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
