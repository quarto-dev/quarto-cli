/*
* command.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import type { Command } from "cliffy/command/mod.ts";

import { renderCommand } from "./render/cmd.ts";
import { runCommand } from "./run/cmd.ts";
import { createProjectCommand } from "./create-project/cmd.ts";
import {
  installCommand,
  uninstallCommand,
  updateCommand,
} from "./install/cmd.ts";
import { serveCommand } from "./serve/cmd.ts";
import { convertCommand } from "./convert/cmd.ts";
import { capabilitiesCommand } from "./capabilities/cmd.ts";
import { checkCommand } from "./check/cmd.ts";
import { inspectCommand } from "./inspect/cmd.ts";

export function commands(): Command[] {
  return [
    renderCommand,
    runCommand,
    createProjectCommand,
    installCommand,
    updateCommand,
    uninstallCommand,
    serveCommand,
    convertCommand,
    capabilitiesCommand,
    checkCommand,
    inspectCommand,
  ];
}
