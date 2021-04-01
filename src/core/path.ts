/*
* path.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { basename, dirname, extname, join } from "path/mod.ts";

import { copySync, ensureDirSync } from "fs/mod.ts";
import { existsSync } from "fs/exists.ts";
import { expandGlobSync } from "fs/expand_glob.ts";

import { ld } from "lodash/mod.ts";

import { getenv } from "./env.ts";
import { execProcess } from "./process.ts";

export function removeIfExists(file: string) {
  if (existsSync(file)) {
    Deno.removeSync(file, { recursive: true });
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
      return glob.slice(1);
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

export function moveDir(
  srcDir: string,
  destDir: string,
  incremental = false,
) {
  relocateDir(srcDir, destDir, true, incremental);
}

export function copyDir(
  srcDir: string,
  destDir: string,
  incremental = false,
) {
  relocateDir(srcDir, destDir, false, incremental);
}

export function relocateDir(
  srcDir: string,
  destDir: string,
  move = false,
  incremental = false,
) {
  if (!incremental) {
    if (existsSync(destDir)) {
      Deno.removeSync(destDir, { recursive: true });
    }
    ensureDirSync(dirname(destDir));
    if (move) {
      Deno.renameSync(srcDir, destDir);
    } else {
      copySync(srcDir, destDir, { overwrite: true, preserveTimestamps: true });
    }
  } else {
    for (const path of Deno.readDirSync(srcDir)) {
      if (path.isDirectory) {
        const src = join(srcDir, basename(path.name));
        relocateDir(src, join(destDir, basename(src)), move);
      }
    }
  }
}
