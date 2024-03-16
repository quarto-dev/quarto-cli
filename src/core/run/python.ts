/*
* python.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/

import { extname } from "../../deno_ral/path.ts";
import { pythonExec } from "../jupyter/exec.ts";

import { execProcess } from "../process.ts";
import { RunHandler, RunHandlerOptions } from "./types.ts";

export const pythonRunHandler: RunHandler = {
  canHandle: (script: string) => {
    return [".py"].includes(extname(script).toLowerCase());
  },
  run: async (
    script: string,
    args: string[],
    stdin?: string,
    options?: RunHandlerOptions,
  ) => {
    return await execProcess({
      cmd: [
        ...(await pythonExec()),
        script,
        ...args,
      ],
      ...options,
    }, stdin);
  },
};
