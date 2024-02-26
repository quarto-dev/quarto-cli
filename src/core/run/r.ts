/*
 * r.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { extname } from "path/mod.ts";

import { execProcess } from "../process.ts";
import { rBinaryPath } from "../resources.ts";
import { RunHandler, RunHandlerOptions } from "./types.ts";

export const rRunHandler: RunHandler = {
  canHandle: (script: string) => {
    return [".r"].includes(extname(script).toLowerCase());
  },
  run: async (
    script: string,
    args: string[],
    stdin?: string,
    options?: RunHandlerOptions,
  ) => {
    return await execProcess(await rBinaryPath("Rscript"), {
      args: [
        script,
        ...args,
      ],
      ...options,
    }, stdin);
  },
};
