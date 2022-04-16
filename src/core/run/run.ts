/*
* run.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { RunHandler } from "./types.ts";

//import { denoRunHandler } from "./deno.ts";
//import { luaRunHandler } from "./lua.ts";
//import { pythonRunHandler } from "./python.ts";
//import { rRunHandler } from "./r.ts";

const kRunHandlers: RunHandler[] = [
  //  denoRunHandler,
  //  luaRunHandler,
  //  pythonRunHandler,
  //  rRunHandler,
];

export function installRunHandler(handler: RunHandler) {
  kRunHandlers.push(handler);
}

export function handlerForScript(script: string) {
  return kRunHandlers.find((handler) => handler.canHandle(script));
}
