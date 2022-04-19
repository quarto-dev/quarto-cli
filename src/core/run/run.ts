/*
* run.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { RunHandler } from "./types.ts";

const kRunHandlers: RunHandler[] = [];

export function installRunHandler(handler: RunHandler) {
  kRunHandlers.push(handler);
}

export function handlerForScript(script: string) {
  return kRunHandlers.find((handler) => handler.canHandle(script));
}
