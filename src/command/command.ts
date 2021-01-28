/*
* command.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import type { Command } from "cliffy/command/mod.ts";

import { renderCommand } from "./render/cmd.ts";
import { runCommand } from "./run/cmd.ts";
import { configCommand } from "./config/cmd.ts";
import { createProjectCommand } from "./create-project/cmd.ts";
import { installCommand } from "./install/cmd.ts";

export function commands(): Command[] {
  return [
    renderCommand,
    runCommand,
    configCommand,
    createProjectCommand,
    installCommand,
  ];
}
