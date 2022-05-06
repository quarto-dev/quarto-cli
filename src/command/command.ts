/*
* command.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import type { Command } from "cliffy/command/mod.ts";

import { renderCommand } from "./render/cmd.ts";
import { serveCommand } from "./serve/cmd.ts";
import { createProjectCommand } from "./create-project/cmd.ts";
import { toolsCommand } from "./tools/cmd.ts";
import { previewCommand } from "./preview/cmd.ts";
import { convertCommand } from "./convert/cmd.ts";
import { capabilitiesCommand } from "./capabilities/cmd.ts";
import { checkCommand } from "./check/cmd.ts";
import { inspectCommand } from "./inspect/cmd.ts";
import { buildJsCommand } from "./build-js/cmd.ts";
import { installCommand } from "./install/cmd.ts";

export function commands(): Command[] {
  return [
    renderCommand,
    previewCommand,
    serveCommand,
    createProjectCommand,
    convertCommand,
    checkCommand,
    installCommand,
    capabilitiesCommand,
    inspectCommand,
    toolsCommand,
    buildJsCommand,
  ];
}
