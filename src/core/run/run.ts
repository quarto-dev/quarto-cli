/*
* run.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { ProcessResult } from "../../core/process.ts";
import { denoRunHandler } from "./deno.ts";
import { luaRunHandler } from "./lua.ts";
import { pythonRunHandler } from "./python.ts";
import { rRunHandler } from "./r.ts";

export interface RunHandlerOptions {
  cwd?: string;
  env?: {
    [key: string]: string;
  };
  stdout?: "inherit" | "piped" | "null" | number;
}

export interface RunHandler {
  canHandle: (script: string) => boolean;
  run: (
    script: string,
    args: string[],
    options?: RunHandlerOptions,
  ) => Promise<ProcessResult>;
}

export const kRunHandlers = [
  denoRunHandler,
  luaRunHandler,
  pythonRunHandler,
  rRunHandler,
];

export function handlerForScript(script: string) {
  return kRunHandlers.find((handler) => handler.canHandle(script));
}
