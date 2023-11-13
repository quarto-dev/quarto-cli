/*
 * path.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import {
  basename,
  dirname,
  extname,
  fromFileUrl,
  isAbsolute,
  isGlob,
  join,
  normalize,
} from "path/mod.ts";

import { globToRegExp } from "https://deno.land/std@0.204.0/path/glob.ts";

import { warning } from "log/mod.ts";

import { existsSync } from "fs/exists.ts";
import { expandGlobSync } from "fs/expand_glob.ts";

import * as ld from "./lodash.ts";

import { getenv } from "./env.ts";
import { execProcess } from "./process.ts";

export const kSkipHidden = /[/\\][\.]/;

export function removeIfExists(file: string) {
  if (existsSync(file)) {
    Deno.removeSync(file, { recursive: true });
  }
}

export function safeRemoveIfExists(file: string) {
  try {
    removeIfExists(file);
  } catch (error) {
    warning(`Error removing file ${file}: ${error.message}`);
  }
}

export function removeIfEmptyDir(dir: string): boolean {
  if (existsSync(dir)) {
    let empty = true;
    for (const _entry of Deno.readDirSync(dir)) {
      empty = false;
      break;
    }
    if (empty) {
      Deno.removeSync(dir, { recursive: true });
      return true;
    }
    return false;
  } else {
    return false;
  }
}

export function isModifiedAfter(file: string, otherFile: string) {
  // handle paths that don't exist
  if (!existsSync(file)) {
    throw new Error(`${file} does not exist`);
  }
  if (!existsSync(otherFile)) {
    return true;
  }

  // stat
  const fileInfo = Deno.statSync(file);
  const otherfileInfo = Deno.statSync(otherFile);

  // if there is no mtime for either then return true
  if (fileInfo.mtime === null || otherfileInfo.mtime === null) {
    return true;
  } else {
    return fileInfo.mtime > otherfileInfo.mtime;
  }
}

export function dirAndStem(file: string) {
  return [
    dirname(file),
    basename(file, extname(file)),
  ];
}

export function expandPath(path: string) {
  if (path === "~") {
    return getenv("HOME", "~");
  } else {
    return path.replace(/^~\//, getenv("HOME", "~") + "/");
  }
}

export function safeExistsSync(path: string) {
  try {
    return existsSync(path);
  } catch {
    return false;
  }
}

export async function which(cmd: string) {
  const args = Deno.build.os === "windows"
    ? ["CMD", "/C", "where", cmd]
    : ["which", cmd];
  const result = await execProcess(
    { cmd: args, stderr: "piped", stdout: "piped" },
  );
  if (result.code === 0) {
    return Deno.build.os === "windows"
      // WHERE return all files found, only first is kept
      ? result.stdout?.split("\n")[0].trim()
      : result.stdout?.trim();
  } else {
    return undefined;
  }
}

export interface ResolvedPathGlobs {
  include: string[];
  exclude: string[];
}

export function filterPaths(
  root: string,
  paths: string[],
  globs: string[],
  options?: GlobOptions,
): ResolvedPathGlobs {
  // filter the list of globs
  // using the paths
  const expandGlobs = (targetGlobs: string[]) => {
    const expanded: string[] = [];
    for (const glob of targetGlobs) {
      const needSlash = !root.endsWith("/") && !glob.startsWith("/");
      const regex = globToRegExp(`${root}${needSlash ? "/" : ""}${glob}`);
      const matchingFiles = paths.filter((path) => {
        return regex.test(path);
      });
      expanded.push(...matchingFiles);
    }
    return ld.uniq(expanded);
  };
  return resolveGlobs(root, globs, expandGlobs, options);
}

export interface GlobOptions {
  mode: "strict" | "auto" | "always";
  explicitSubfolderSearch?: boolean; // set this to true to never prepend `**/` to globs to create nested directory searching
}

export function resolvePathGlobs(
  root: string,
  globs: string[],
  exclude: string[],
  options?: GlobOptions,
): ResolvedPathGlobs {
  // expand a set of globs
  const expandGlobs = (targetGlobs: string[]) => {
    const expanded: string[] = [];
    for (const glob of targetGlobs) {
      for (
        const file of expandGlobSync(
          glob,
          { root, exclude, includeDirs: true, extended: true, globstar: true },
        )
      ) {
        expanded.push(file.path);
      }
    }
    return ld.uniq(expanded);
  };
  return resolveGlobs(root, globs, expandGlobs, options);
}

export function pathWithForwardSlashes(path: string) {
  return path.replace(/\\/g, "/");
}

export function ensureTrailingSlash(path: string) {
  if (path && !path.endsWith("/")) {
    return path + "/";
  } else {
    return path;
  }
}

export function removeTrailingSlash(path: string) {
  if (path && path.endsWith("/")) {
    return path.slice(0, path.length - 1);
  } else {
    return path;
  }
}

export function resolveGlobs(
  root: string,
  globs: string[],
  expandGlobs: (targetGlobs: string[]) => string[],
  options?: GlobOptions,
): ResolvedPathGlobs {
  // preprocess the globs for **, negation -> exclude, etc
  const includeGlobs: string[] = [];
  const excludeGlobs: string[] = [];

  // deal with implicit ** syntax and ability to escape negation (!)
  const asFullGlob = (glob: string, preferSmart?: boolean) => {
    const useSmartGlobs = () => {
      if (options?.mode === "strict") {
        return false;
      } else if (options?.mode === "always") {
        return true;
      } else if (options?.mode === "auto") {
        if (preferSmart) {
          return true;
        } else {
          return isGlob(glob);
        }
      } else {
        return true;
      }
    };
    const smartGlob = useSmartGlobs();

    // handle negation
    if (glob.startsWith("\\!")) {
      glob = glob.slice(1);
    }

    // ending w/ a slash means everything in the dir
    if (smartGlob) {
      // beginning with a '.' is redundant, remove
      glob = glob.replace(/^\.([\/\\])+/, "$1");

      if (glob.endsWith("/")) {
        glob = glob + "**/*";
      } else {
        // literal relative reference to any directory means everything in the dir
        const fullPath = join(root, glob);
        try {
          if (Deno.statSync(fullPath).isDirectory) {
            glob = glob + "/**/*";
          }
        } catch {
          // Leave the glob alone, this must not be a directory
        }
      }
    }

    if (!glob.startsWith("/")) {
      if (smartGlob && (!options || !options.explicitSubfolderSearch)) {
        return "**/" + glob;
      } else {
        return glob;
      }
    } else {
      return glob.slice(1);
    }
  };

  // divide globs into include and exclude
  for (const glob of globs) {
    if (glob.startsWith("!")) {
      // We should always force smart globs in the event
      // of excludes since these would normally qualify
      excludeGlobs.push(asFullGlob(glob.slice(1), true));
    } else {
      includeGlobs.push(asFullGlob(glob));
    }
  }

  // run the globs
  const includeFiles = expandGlobs(includeGlobs);
  const excludeFiles = expandGlobs(excludeGlobs);

  // return lists
  return {
    include: includeFiles,
    exclude: excludeFiles,
  };
}

// Window UNC paths can be mishandled by realPathSync
// (see https://github.com/quarto-dev/quarto-vscode/issues/67)
// so we implement the absolute path and normalize
// parts of realPathSync (we aren't interested in the symlink
// resolution, and certainly not on windows that has no symlinks!)
export function normalizePath(path: string | URL): string {
  let file = path instanceof URL ? fromFileUrl(path) : path;
  if (!isAbsolute(file)) {
    file = join(Deno.cwd(), file);
  }
  file = normalize(file);
  // some runtimes (e.g. nodejs) create paths w/ lowercase drive
  // letters, make those uppercase
  return file.replace(/^\w:\\/, (m) => m[0].toUpperCase() + ":\\");
}

// Moved here from env.ts to avoid circular dependency
export function suggestUserBinPaths() {
  if (Deno.build.os !== "windows") {
    // List of paths that we consider bin paths
    // in priority order (expanded and not)
    const possiblePaths = [
      "/usr/local/bin",
      "~/.local/bin",
      "~/bin",
    ];

    // Read the user path
    const pathRaw = Deno.env.get("PATH");
    const paths: string[] = pathRaw ? pathRaw.split(":") : [];

    // Filter the above list by what is in the user path
    return possiblePaths.filter((path) => {
      return paths.includes(path) || paths.includes(expandPath(path));
    });
  } else {
    throw new Error("suggestUserBinPaths not currently supported on Windows");
  }
}
