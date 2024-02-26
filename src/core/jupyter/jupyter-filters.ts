/*
 * jupyter-filters.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { existsSync } from "fs/exists.ts";
import { basename, dirname, isAbsolute, join } from "path/mod.ts";
import { kIpynbFilters } from "../../config/constants.ts";
import { Format } from "../../config/types.ts";

import { execProcess } from "../../core/process.ts";
import { handlerForScript } from "../../core/run/run.ts";
import { parseShellRunCommand } from "../../core/run/shell.ts";
import {
  cacheFilteredNotebook,
  filteredNotebookFromCache,
} from "./filtered-notebook-cache.ts";
import { fixupFrontMatter } from "./jupyter-fixups.ts";
import { JupyterNotebook } from "./types.ts";

export async function markdownFromNotebookFile(file: string, format?: Format) {
  // read file with any filters
  const nbContents = await jupyterNotebookFiltered(
    file,
    format?.execute[kIpynbFilters],
  );
  const nb = JSON.parse(nbContents);
  return markdownFromNotebookJSON(nb);
}

export function markdownFromNotebookJSON(nb: JupyterNotebook) {
  // run the front matter fixup
  nb = fixupFrontMatter(nb);

  const markdown = nb.cells.reduce((md, cell) => {
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
    // see if we can satisfy the request from the cache
    const cached = await filteredNotebookFromCache(file, filters);
    if (cached) {
      return cached;
    }

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
        : await execProcess(isAbsolute(script) ? script : basename(script), {
          args: args.slice(1),
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
    await cacheFilteredNotebook(file, filters, json);
    return json;
  } else {
    return json;
  }
}
