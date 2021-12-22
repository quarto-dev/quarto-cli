/*
* python.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { extname } from "path/mod.ts";
import { pythonExec } from "../jupyter/exec.ts";

import { execProcess } from "../process.ts";
import { RunHandler } from "./run.ts";

export const pythonRunHandler: RunHandler = {
  canHandle: (script: string) => {
    return [".py"].includes(extname(script).toLowerCase());
  },
  run: async (script: string, args: string[]) => {
    return await execProcess({
      cmd: [
        ...(await pythonExec()),
        script,
        ...args,
      ],
    });
  },
};
