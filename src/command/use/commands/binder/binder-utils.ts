/*
 * binder-utils.ts
 *
 * Copyright (C) 2021-2022 Posit Software, PBC
 */

import { md5Hash } from "../../../../core/hash.ts";
import { projectScratchPath } from "../../../../project/project-scratch.ts";

import { info } from "log/mod.ts";
import { ensureDirSync, existsSync } from "fs/mod.ts";
import { join } from "path/mod.ts";

import { Confirm } from "cliffy/prompt/mod.ts";
import { dirname } from "path/mod.ts";

export const safeFileWriter = (projectDir: string) => {
  // The index file in the project scratch directory
  const idxPath = join(projectScratchPath(projectDir), "use", "binder.json");

  // Ensure directory is there
  ensureDirSync(dirname(idxPath));

  // Read the index, if it is there
  let fileIndex: Record<string, string> = {};
  if (existsSync(idxPath)) {
    fileIndex = JSON.parse(Deno.readTextFileSync(idxPath));
  }

  return async (projRelativePath: string, contents: string) => {
    const absPath = join(projectDir, projRelativePath);

    const write = () => {
      fileIndex[projRelativePath] = hash;
      Deno.writeTextFileSync(absPath, contents);
      Deno.writeTextFileSync(idxPath, JSON.stringify(fileIndex, null, 2));
      info(`[✓] ${projRelativePath}`);
    };

    const hash = md5Hash(contents);
    if (existsSync(absPath)) {
      const lastHash = fileIndex[projRelativePath];
      const currentContents = Deno.readTextFileSync(absPath);
      const currentHash = md5Hash(currentContents);

      let writeFile = true;
      if (!lastHash || lastHash !== currentHash) {
        // The file exists and wasn't generated, prompt to overwrite
        const question = lastHash
          ? `File ${projRelativePath} was modified since last generated. Overwrite?`
          : `File ${projRelativePath} wasn't created by the this command. Overwrite?`;
        writeFile = await Confirm.prompt({
          message: question,
        });
      }

      if (writeFile) {
        write();
      }
    } else {
      // the file doesn't exists, generate hash and store that, write the file
      write();
    }
  };
};
