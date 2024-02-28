/*
* filtered-notebook-cache.ts
*
* Copyright (C) 2022 Posit Software, PBC
*
*/

import { existsSync } from "fs/exists.ts";
import { ensureDirSync } from "fs/mod.ts";
import { dirname, isAbsolute, join } from "../../deno_ral/path.ts";

import { parseShellRunCommand } from "../../core/run/shell.ts";
import { quartoCacheDir } from "../appdirs.ts";
import { which } from "../path.ts";

// get cached copy of filtered notebook
export async function filteredNotebookFromCache(
  file: string,
  filters: string[],
) {
  file = normalizeNotebookPath(file);
  const invalidation = await notebookInvalidation(file, filters);
  const notebook = getCachedNotebook(file);
  if (notebook?.invalidation === invalidation) {
    return Deno.readTextFileSync(notebook.fullPath);
  } else {
    return undefined;
  }
}

// cache a filtered notebook
export async function cacheFilteredNotebook(
  file: string,
  filters: string[],
  json: string,
) {
  file = normalizeNotebookPath(file);
  const invalidation = await notebookInvalidation(file, filters);
  cacheNotebook(file, { invalidation, json });
}

function normalizeNotebookPath(file: string) {
  return isAbsolute(file) ? file : join(Deno.cwd(), file);
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

type CachedNotebookContents = {
  invalidation: string;
  json: string;
};

function getCachedNotebook(
  file: string,
): { invalidation: string; fullPath: string } | undefined {
  const contents = readNotebookIndex()[file];
  if (contents) {
    return {
      invalidation: contents.invalidation,
      fullPath: notebookCachePath(contents.path),
    };
  }
}

function cacheNotebook(file: string, contents: CachedNotebookContents) {
  // either use existing path or create a new (unique) one
  const index = readNotebookIndex();
  const path = index[file]?.path || globalThis.crypto.randomUUID();

  // write the notebook json to the cache
  Deno.writeTextFileSync(notebookCachePath(path), contents.json);

  // update the index
  index[file] = { invalidation: contents.invalidation, path };
  writeNotebookIndex(index);
}

function readNotebookIndex(): Record<
  string,
  { invalidation: string; path: string }
> {
  const index = notebookIndexFile();
  if (existsSync(index)) {
    return JSON.parse(Deno.readTextFileSync(index));
  }

  return {};
}

function writeNotebookIndex(
  index: Record<string, { invalidation: string; path: string }>,
) {
  Deno.writeTextFileSync(
    notebookIndexFile(),
    JSON.stringify(index, undefined, 2),
  );
}

const notebookIndexFile = () => notebookCachePath("INDEX");

function notebookCachePath(file?: string) {
  const cacheDir = join(quartoCacheDir(), "filtered-notebooks");
  ensureDirSync(cacheDir);
  return file ? join(cacheDir, file) : cacheDir;
}
