/*
* freeze.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { dirname, isAbsolute, join, relative } from "path/mod.ts";
import { copySync, ensureDirSync, existsSync } from "fs/mod.ts";
import { createHash } from "hash/mod.ts";

import { ld } from "lodash/mod.ts";

import { inputFilesDir } from "../../core/render.ts";
import { sessionTempFile } from "../../core/temp.ts";
import { copyDir, removeIfExists } from "../../core/path.ts";

import {
  kIncludeAfterBody,
  kIncludeBeforeBody,
  kIncludeInHeader,
} from "../../config/constants.ts";

import { ExecuteResult } from "../../execute/engine.ts";

import { ProjectContext } from "../../project/project-context.ts";
import { projectScratchPath } from "../../project/project-scratch.ts";

const kFreezeSubDir = "freeze";

export function freezeExecuteResult(
  input: string,
  output: string,
  result: ExecuteResult,
) {
  // resolve includes within executeResult
  result = ld.cloneDeep(result) as ExecuteResult;
  const resolveIncludes = (
    name: "include-in-header" | "include-before-body" | "include-after-body",
  ) => {
    if (result.includes[name]) {
      result.includes[name] = Deno.readTextFileSync(result.includes[name]!);
    }
  };
  resolveIncludes(kIncludeInHeader);
  resolveIncludes(kIncludeBeforeBody);
  resolveIncludes(kIncludeAfterBody);

  // make the supporting dirs relative to the input file dir
  result.supporting = result.supporting.map((file) => {
    if (isAbsolute(file)) {
      return relative(Deno.realPathSync(dirname(input)), file);
    } else {
      return file;
    }
  });

  // save both the result and a hash of the input file
  const hash = freezeInputHash(input);

  // write the freeze json
  Deno.writeTextFileSync(
    freezeResultFile(input, output, true),
    JSON.stringify({ hash, result }, undefined, 2),
  );
}

export function defrostExecuteResult(
  input: string,
  output: string,
  force = false,
) {
  const resultFile = freezeResultFile(input, output);
  if (existsSync(resultFile)) {
    // parse result
    const { hash, result } = JSON.parse(Deno.readTextFileSync(resultFile)) as {
      hash: string;
      result: ExecuteResult;
    };

    // use frozen version for force or equivalent input hash
    if (force || hash === freezeInputHash(input)) {
      // full path to supporting
      result.supporting = result.supporting.map((file) =>
        Deno.realPathSync(join(dirname(input), file))
      );

      // convert includes to files
      const resolveIncludes = (
        name:
          | "include-in-header"
          | "include-before-body"
          | "include-after-body",
      ) => {
        if (result.includes[name]) {
          const includeFile = sessionTempFile();
          Deno.writeTextFileSync(includeFile, result.includes[name]!);
          result.includes[name] = includeFile;
        }
      };
      resolveIncludes(kIncludeInHeader);
      resolveIncludes(kIncludeBeforeBody);
      resolveIncludes(kIncludeAfterBody);

      return result;
    }
  }
}

export function removeFreezeResults(filesDir: string) {
  const freezeDir = join(filesDir, kFreezeSubDir);
  removeIfExists(freezeDir);
}

export function copyFilesToFreezer(
  project: ProjectContext,
  filesDir: string,
  incremental = false,
) {
  const freezerDir = projectScratchPath(project, kFreezeSubDir);
  const filesRelative = relative(project.dir, filesDir);
  const destFilesDir = join(freezerDir, filesRelative);
  copyDir(filesDir, destFilesDir, incremental);
}

export function copyFilesFromFreezer(
  project: ProjectContext,
  filesDir: string,
  incremental = false,
) {
  const freezerDir = projectScratchPath(project, kFreezeSubDir);
  const srcFilesDir = join(freezerDir, filesDir);
  const destFilesDir = join(project.dir, filesDir);
  if (existsSync(srcFilesDir)) {
    copyDir(srcFilesDir, destFilesDir, incremental);
  }
}

function freezeInputHash(input: string) {
  return createHash("md5").update(Deno.readTextFileSync(input)).toString();
}

function freezeResultFile(
  input: string,
  output: string,
  ensureDir = false,
) {
  const filesDir = inputFilesDir(input);
  const freezeDir = join(filesDir, kFreezeSubDir);
  if (ensureDir) {
    ensureDirSync(freezeDir);
  }

  return join(freezeDir, output + ".json");
}
