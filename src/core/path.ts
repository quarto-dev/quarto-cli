/*
* path.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { basename, dirname, extname, join, relative } from "path/mod.ts";

import { copySync, ensureDirSync, walkSync } from "fs/mod.ts";
import { existsSync } from "fs/exists.ts";
import { expandGlobSync } from "fs/expand_glob.ts";

import { ld } from "lodash/mod.ts";

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
    return result.stdout?.trim();
  } else {
    return undefined;
  }
}

export interface ResolvedPathGlobs {
  include: string[];
  exclude: string[];
}

export function resolvePathGlobs(
  root: string,
  globs: string[],
  exclude: string[],
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
    }

    if (!glob.startsWith("/")) {
      return "**/" + glob;
    } else {
      return join(root, glob.slice(1));
    }
  };

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

export function pathWithForwardSlashes(path: string) {
  return path.replace(/\\/g, "/");
}

export function move(
  src: string,
  dest: string,
  incremental = false,
) {
  relocate(src, dest, true, incremental);
}

export function copy(
  src: string,
  dest: string,
  incremental = false,
) {
  relocate(src, dest, false, incremental);
}

export function relocate(
  src: string,
  dest: string,
  move = false,
  incremental = false,
) {
  if (!incremental) {
    if (existsSync(dest)) {
      Deno.removeSync(dest, { recursive: true });
    }
    ensureDirSync(dirname(dest));
    if (move) {
      Deno.renameSync(src, dest);
    } else {
      copySync(src, dest, { overwrite: true, preserveTimestamps: true });
    }
  } else {
    for (const path of Deno.readDirSync(src)) {
      if (path.isDirectory) {
        const srcPath = join(src, path.name);
        relocate(srcPath, join(dest, path.name), move);
      }
    }
  }
}

export function copyMinimal(
  srcDir: string,
  destDir: string,
  skip?: RegExp[],
  filter?: (path: string) => boolean,
) {
  skip = skip || [];

  // build list of src fiels
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
}
