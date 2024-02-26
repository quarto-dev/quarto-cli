/*
 * python.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { extname } from "path/mod.ts";
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
    const cmd = [
      ...(await pythonExec()),
      script,
      ...args,
    ];
    return await execProcess(cmd[0], {
      args: cmd.slice(1),
      ...options,
    }, stdin);
  },
};
