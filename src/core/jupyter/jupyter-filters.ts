/*
* jupyter-filters.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { existsSync } from "fs/exists.ts";
import { basename, dirname, isAbsolute, join } from "path/mod.ts";
import { kIpynbFilters } from "../../config/constants.ts";
import { Format } from "../../config/types.ts";

import { execProcess } from "../../core/process.ts";
import { handlerForScript } from "../../core/run/run.ts";
import { parseShellRunCommand } from "../../core/run/shell.ts";
import { which } from "../path.ts";
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
    const invalidation = await notebookInvalidation(file, filters);
    const cached = filteredNotebookFromCache(file, invalidation);
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
    cacheFilteredNotebook(file, invalidation, json);
    return json;
  } else {
    return json;
  }
}

// cache of filtered notebooks
const filteredNotebooks = new Map<
  string,
  { invalidation: string; json: string }
>();

// get cached copy of filtered notebook
function filteredNotebookFromCache(file: string, invalidation: string) {
  const notebook = filteredNotebooks.get(file);
  if (notebook?.invalidation === invalidation) {
    return notebook.json;
  } else {
    return undefined;
  }
}

// cache a filtered notebook
function cacheFilteredNotebook(
  file: string,
  invalidation: string,
  json: string,
) {
  filteredNotebooks.set(file, { invalidation, json });
}

// generate a notebook invalidation key
async function notebookInvalidation(file: string, filters: string[]) {
  return [file, ...(await filterScriptPaths(file, filters || []))].reduce(
    (hash, file) => {
      try {
        return hash + Deno.statSync(file).mtime?.toUTCString();
      } catch {
        return hash;
      }
    },
    "",
  );
}

// get filesystem paths of filters
async function filterScriptPaths(file: string, filters: string[]) {
  const filterPaths: string[] = [];
  for (const filter of filters) {
    const args = parseShellRunCommand(filter);
    const script = args[0];
    const scriptPath = join(dirname(file), script);
    if (existsSync(scriptPath)) {
      filterPaths.push(scriptPath);
    } else if (isAbsolute(script) && existsSync(script)) {
      filterPaths.push(script);
    } else {
      const scriptPath = await which(script);
      if (scriptPath && existsSync(scriptPath)) {
        filterPaths.push(scriptPath);
      }
    }
  }
  return filterPaths;
}
