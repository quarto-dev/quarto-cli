/*
 * freeze.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import {
  basename,
  dirname,
  extname,
  isAbsolute,
  join,
  relative,
} from "../../deno_ral/path.ts";
import { ensureDirSync, EOL, existsSync, format, LF } from "fs/mod.ts";

import { cloneDeep } from "../../core/lodash.ts";

import { inputFilesDir } from "../../core/render.ts";
import { TempContext } from "../../core/temp.ts";
import { md5Hash } from "../../core/hash.ts";
import {
  normalizePath,
  removeIfEmptyDir,
  removeIfExists,
  safeRemoveIfExists,
} from "../../core/path.ts";

import {
  kIncludeAfterBody,
  kIncludeBeforeBody,
  kIncludeInHeader,
} from "../../config/constants.ts";

import { ExecuteResult } from "../../execute/types.ts";

import { kProjectLibDir, ProjectContext } from "../../project/types.ts";
import { projectScratchPath } from "../../project/project-scratch.ts";
import { copyMinimal, copyTo } from "../../core/copy.ts";
import { warning } from "../../deno_ral/log.ts";

export const kProjectFreezeDir = "_freeze";
export const kOldFreezeExecuteResults = "execute";
export const kFreezeExecuteResults = "execute-results";

export function freezeExecuteResult(
  input: string,
  output: string,
  result: ExecuteResult,
) {
  // resolve includes within executeResult
  result = cloneDeep(result) as ExecuteResult;
  const resolveIncludes = (
    name: "include-in-header" | "include-before-body" | "include-after-body",
  ) => {
    if (result.includes) {
      if (result.includes[name]) {
        result.includes[name] = result.includes[name]!.map((file) =>
          // Storing file content using LF line ending
          format(Deno.readTextFileSync(file), LF)
        );
      }
    }
  };
  resolveIncludes(kIncludeInHeader);
  resolveIncludes(kIncludeBeforeBody);
  resolveIncludes(kIncludeAfterBody);

  // make the supporting dirs relative to the input file dir
  result.supporting = result.supporting.map((file) => {
    if (isAbsolute(file)) {
      return relative(normalizePath(dirname(input)), file);
    } else {
      return file;
    }
  });

  // save both the result and a hash of the input file
  const hash = freezeInputHash(input);

  // write the freeze json
  const freezeJsonFile = freezeResultFile(input, output, true);
  Deno.writeTextFileSync(
    freezeJsonFile,
    JSON.stringify({ hash, result }, undefined, 2),
  );

  // return the file
  return freezeJsonFile;
}

export function defrostExecuteResult(
  source: string,
  output: string,
  temp: TempContext,
  force = false,
) {
  const resultFile = freezeResultFile(source, output);
  if (existsSync(resultFile)) {
    // parse result
    let hash: string;
    let result: ExecuteResult;
    const contents = Deno.readTextFileSync(resultFile);
    try {
      const inp = JSON.parse(contents) as {
        hash: string;
        result: ExecuteResult;
      };
      hash = inp.hash;
      result = inp.result;
    } catch (_e) {
      if (
        contents.match("<<<<<<<") && contents.match(">>>>>>>") &&
        contents.match("=======")
      ) {
        warning(
          `Error parsing ${resultFile}; it looks possibly like a git merge conflict.`,
        );
      } else {
        warning(`Error parsing ${resultFile}; it may be corrupt.`);
      }
      return;
    }

    // use frozen version for force or equivalent source hash
    if (force || hash === freezeInputHash(source)) {
      // full path to supporting
      result.supporting = result.supporting.map((file) =>
        join(normalizePath(dirname(source)), file)
      );

      // convert includes to files
      const resolveIncludes = (
        name:
          | "include-in-header"
          | "include-before-body"
          | "include-after-body",
      ) => {
        if (result.includes) {
          if (result.includes[name]) {
            result.includes[name] = result.includes[name]!.map((content) => {
              const includeFile = temp.createFile();
              // Restoring content in file using the OS line ending character
              content = format(content, EOL);
              Deno.writeTextFileSync(includeFile, content);
              return includeFile;
            });
          }
        }
      };
      resolveIncludes(kIncludeInHeader);
      resolveIncludes(kIncludeBeforeBody);
      resolveIncludes(kIncludeAfterBody);

      return result;
    }
  }
}

export function projectFreezerDir(dir: string, hidden: boolean) {
  const freezeDir = hidden
    ? projectScratchPath(dir, kProjectFreezeDir)
    : join(dir, kProjectFreezeDir);
  ensureDirSync(freezeDir);
  return normalizePath(freezeDir);
}

export function copyToProjectFreezer(
  project: ProjectContext,
  file: string,
  hidden: boolean,
  incremental: boolean,
) {
  const freezerDir = projectFreezerDir(project.dir, hidden);
  const srcFilesDir = join(project.dir, file);
  const destFilesDir = join(freezerDir, asFreezerDir(file));
  if (incremental) {
    for (const dir of Deno.readDirSync(srcFilesDir)) {
      if (dir.name === kFreezeExecuteResults) {
        const resultsDir = join(srcFilesDir, dir.name);
        const destResultsDir = join(destFilesDir, kFreezeExecuteResults);
        ensureDirSync(destResultsDir);
        for (const json of Deno.readDirSync(resultsDir)) {
          if (json.isFile) {
            copyTo(
              join(resultsDir, json.name),
              join(destResultsDir, json.name),
            );
          }
        }
      } else {
        copyMinimal(
          join(srcFilesDir, dir.name),
          join(destFilesDir, dir.name),
        );
      }
    }
  } else {
    copyMinimal(srcFilesDir, destFilesDir);
  }
}

export function copyFromProjectFreezer(
  project: ProjectContext,
  file: string,
  hidden: boolean,
) {
  const freezerDir = projectFreezerDir(project.dir, hidden);
  const srcFilesDir = join(
    freezerDir,
    asFreezerDir(file),
  );
  const destFilesDir = join(project.dir, file);
  if (existsSync(srcFilesDir)) {
    copyMinimal(srcFilesDir, destFilesDir);
  }
}

export function pruneProjectFreezerDir(
  project: ProjectContext,
  dir: string,
  files: string[],
  hidden: boolean,
) {
  const freezerDir = projectFreezerDir(project.dir, hidden);
  // on some network drives removeSync w/ recursive: true doesn't seem to work
  // (see https://github.com/quarto-dev/quarto-cli/issues/188)
  // TODO: this prevents the error but we will want to eventually
  // find a way to do force this
  files.map((file) => {
    const filePath = join(freezerDir, dir, file);
    safeRemoveIfExists(filePath);
  });
  removeIfEmptyDir(join(freezerDir, dir));
}

export function pruneProjectFreezer(project: ProjectContext, hidden: boolean) {
  const freezerDir = projectFreezerDir(project.dir, hidden);
  const libDir = project.config?.project[kProjectLibDir];
  if (libDir) {
    let remove = true;
    for (const entry of Deno.readDirSync(freezerDir)) {
      if (entry.isFile || entry.name !== libDir) {
        remove = false;
        break;
      }
    }
    if (remove) {
      removeIfExists(freezerDir);
    }
  } else {
    removeIfEmptyDir(freezerDir);
  }
}

export function freezerFreezeFile(project: ProjectContext, freezeFile: string) {
  const filesDir = asFreezerDir(dirname(dirname(freezeFile)));
  return join(
    project.dir,
    kProjectFreezeDir,
    filesDir,
    kFreezeExecuteResults,
    basename(freezeFile),
  );
}

export function freezerFigsDir(
  project: ProjectContext,
  filesDir: string,
  figsDir: string,
) {
  return join(
    project.dir,
    kProjectFreezeDir,
    asFreezerDir(filesDir),
    figsDir,
  );
}

export function freezeResultFile(
  input: string,
  output: string,
  ensureDir = false,
) {
  const filesDir = join(dirname(input), inputFilesDir(input));
  const freezeDir = join(filesDir, kFreezeExecuteResults);
  if (ensureDir) {
    ensureDirSync(freezeDir);
  }

  return join(freezeDir, extname(output).slice(1) + ".json");
}

export function removeFreezeResults(filesDir: string) {
  const freezeDir = join(filesDir, kFreezeExecuteResults);
  removeIfExists(freezeDir);
  const oldFreezeDir = join(filesDir, kOldFreezeExecuteResults);
  removeIfExists(oldFreezeDir);
  if (existsSync(filesDir)) {
    removeIfEmptyDir(filesDir);
  }
}

function freezeInputHash(input: string) {
  // Calculate the hash on a content with LF line ending to avoid
  // different hash on different OS (#3599)
  return md5Hash(format(Deno.readTextFileSync(input), LF));
}

// don't use _files suffix in freezer
function asFreezerDir(dir: string) {
  return dir.replace(/_files$/, "");
}
