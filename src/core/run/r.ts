/*
* r.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { extname } from "path/mod.ts";

import { execProcess } from "../process.ts";
import { rBinaryPath } from "../resources.ts";
import { RunHandler, RunHandlerOptions } from "./run.ts";

export const rRunHandler: RunHandler = {
  canHandle: (script: string) => {
    return [".r"].includes(extname(script).toLowerCase());
  },
  run: async (script: string, args: string[], options?: RunHandlerOptions) => {
    return await execProcess({
      cmd: [
        await rBinaryPath("Rscript"),
        script,
        ...args,
      ],
      ...options,
    });
  },
};
