/*
* path.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import {
  basename,
  dirname,
  extname,
  globToRegExp,
  isGlob,
  join,
} from "path/mod.ts";

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

export function removeIfEmptyDir(dir: string) {
  if (existsSync(dir)) {
    let empty = true;
    for (const _entry of Deno.readDirSync(dir)) {
      empty = false;
      break;
    }
    if (empty) {
      Deno.removeSync(dir, { recursive: true });
    }
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
): ResolvedPathGlobs {
  // filter the list of globs
  // using the paths
  const expandGlobs = (targetGlobs: string[]) => {
    const expanded: string[] = [];
    for (const glob of targetGlobs) {
      const regex = globToRegExp(`${root}/${glob}`);
      const matchingFiles = paths.filter((path) => {
        return regex.test(path);
      });
      expanded.push(...matchingFiles);
    }
    return ld.uniq(expanded);
  };
  return resolveGlobs(root, globs, expandGlobs);
}

export interface GlobOptions {
  mode: "strict" | "auto" | "always";
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
  const asFullGlob = (glob: string) => {
    const preventSmartGlobs = options?.mode === "strict" ||
      (options?.mode === "auto" && !isGlob(glob));

    // handle negation
    if (glob.startsWith("\\!")) {
      glob = glob.slice(1);
    }
    // ending w/ a slash means everything in the dir
    if (!preventSmartGlobs) {
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
      if (!preventSmartGlobs) {
        return "**/" + glob;
      } else {
        return glob;
      }
    } else {
      return join(root, glob.slice(1));
    }
  };

  // divide globs into include and exclude
  for (const glob of globs) {
    if (glob.startsWith("!")) {
      excludeGlobs.push(asFullGlob(glob.slice(1)));
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
