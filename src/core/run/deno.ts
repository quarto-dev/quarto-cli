/*
* deno.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { extname } from "path/mod.ts";
import { execProcess } from "../process.ts";
import { binaryPath } from "../resources.ts";
import { RunHandler, RunHandlerOptions } from "./run.ts";

export const denoRunHandler: RunHandler = {
  canHandle: (script: string) => {
    return [".js", ".ts"].includes(extname(script).toLowerCase());
  },
  run: async (script: string, args: string[], options?: RunHandlerOptions) => {
    return await execProcess({
      cmd: [
        binaryPath("deno"),
        "run",
        "--allow-all",
        script,
        ...args,
      ],
      ...options,
    });
  },
};
