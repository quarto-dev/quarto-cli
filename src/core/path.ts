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
  join,
  relative,
} from "path/mod.ts";

import { copySync } from "fs/copy.ts";
import { ensureDirSync, walkSync } from "fs/mod.ts";
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

export function sysPaths() {
  if (Deno.build.os === "windows") {
    const pathStr = Deno.env.get("Path");
    return pathStr?.split(";");
  } else {
    const pathStr = Deno.env.get("PATH");
    const paths = pathStr?.split(":");
    return paths?.map(expandPath);
  }
}

export function suggestBinPath() {
  const systemPaths = sysPaths();
  if (systemPaths) {
    return suggestedBinPaths().find((binPath) => {
      return systemPaths.includes(binPath);
    });
  } else {
    return undefined;
  }
}

export function suggestedBinPaths() {
  return [
    "~/.local/bin",
    "/usr/local/bin",
    "~/bin",
  ];
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
    return result.stdout?.trim();
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

export function resolvePathGlobs(
  root: string,
  globs: string[],
  exclude: string[],
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
  return resolveGlobs(root, globs, expandGlobs);
}

export function pathWithForwardSlashes(path: string) {
  return path.replace(/\\/g, "/");
}

export function copyMinimal(
  srcDir: string,
  destDir: string,
  skip?: RegExp[],
  filter?: (path: string) => boolean,
) {
  // 2022-02-16: 0.125.0 walkSync appears to throw in the presence of .DS_Store
  skip = [...(skip || []), /\.DS_Store/];

  // build list of src files
  const srcFiles: string[] = [];
  for (
    const walk of walkSync(
      srcDir,
      {
        includeDirs: false,
        followSymlinks: false,
        skip,
      },
    )
  ) {
    // alias source file
    const srcFile = walk.path;

    // apply filter
    if (filter && !filter(srcFile)) {
      continue;
    }

    // add to src files
    srcFiles.push(srcFile);
  }

  // copy src files
  for (const srcFile of srcFiles) {
    if (!existsSync(srcFile)) {
      continue;
    }
    const destFile = join(destDir, relative(srcDir, srcFile));
    copyFileIfNewer(srcFile, destFile);
  }
}

export function copyFileIfNewer(srcFile: string, destFile: string) {
  ensureDirSync(dirname(destFile));
  if (existsSync(destFile)) {
    const srcInfo = Deno.statSync(srcFile);
    const destInfo = Deno.statSync(destFile);
    if (!srcInfo.mtime || !destInfo.mtime || destInfo.mtime < srcInfo.mtime) {
      copySync(srcFile, destFile, {
        overwrite: true,
        preserveTimestamps: true,
      });
    }
  } else {
    copySync(srcFile, destFile, {
      overwrite: true,
      preserveTimestamps: true,
    });
  }
}
export function resolveGlobs(
  root: string,
  globs: string[],
  expandGlobs: (targetGlobs: string[]) => string[],
): ResolvedPathGlobs {
  // preprocess the globs for **, negation -> exclude, etc
  const includeGlobs: string[] = [];
  const excludeGlobs: string[] = [];

  // deal with implicit ** syntax and ability to escape negation (!)
  const asFullGlob = (glob: string) => {
    // handle negation
    if (glob.startsWith("\\!")) {
      glob = glob.slice(1);
    }
    // ending w/ a slash means everything in the dir
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

    if (!glob.startsWith("/")) {
      return "**/" + glob;
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
