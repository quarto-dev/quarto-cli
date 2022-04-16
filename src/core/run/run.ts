/*
* run.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { denoRunHandler } from "./deno.ts";
import { luaRunHandler } from "./lua.ts";
import { pythonRunHandler } from "./python.ts";
import { rRunHandler } from "./r.ts";

export const kRunHandlers = [
  denoRunHandler,
  luaRunHandler,
  pythonRunHandler,
  rRunHandler,
];

export function handlerForScript(script: string) {
  return kRunHandlers.find((handler) => handler.canHandle(script));
}
