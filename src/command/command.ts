/*
* command.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import type { Command } from "cliffy/command/mod.ts";

import { renderCommand } from "./render/cmd.ts";
import { runCommand } from "./run/cmd.ts";

export function commands(): Command[] {
  return [
    renderCommand,
    runCommand,
  ];
}
