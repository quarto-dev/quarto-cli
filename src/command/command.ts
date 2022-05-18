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
import { publishCommand } from "./publish/cmd.ts";

// deno-lint-ignore no-explicit-any
export function commands(): Command<any>[] {
  return [
    renderCommand,
    previewCommand,
    serveCommand,
    createProjectCommand,
    convertCommand,
    checkCommand,
    installCommand,
    //  publishCommand,
    capabilitiesCommand,
    inspectCommand,
    toolsCommand,
    buildJsCommand,
  ];
}
