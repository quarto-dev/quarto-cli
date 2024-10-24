/*
 * command.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import type { Command } from "cliffy/command/mod.ts";

import { renderCommand } from "./render/cmd.ts";
import { serveCommand } from "./serve/cmd.ts";
import { CreateProjectCommand } from "./create-project/cmd.ts";
import { toolsCommand } from "./tools/cmd.ts";
import { previewCommand } from "./preview/cmd.ts";
import { ConvertCommand } from "./convert/cmd.ts";
import { runCommand } from "./run/run.ts";
import { PandocCommand } from "./pandoc/cmd.ts";
import { typstCommand } from "./typst/cmd.ts";
import { CapabilitiesCommand } from "./capabilities/cmd.ts";
import { CheckCommand } from "./check/cmd.ts";
import { InspectCommand } from "./inspect/cmd.ts";
import { BuildJsCommand } from "./build-js/cmd.ts";
import { InstallCommand } from "./install/cmd.ts";
import { updateCommand } from "./update/cmd.ts";
import { publishCommand } from "./publish/cmd.ts";
import { removeCommand } from "./remove/cmd.ts";
import { listCommands } from "./list/cmd.ts";
import { makeUseCommand } from "./use/cmd.ts";
import { AddCommand } from "./add/cmd.ts";
import { uninstallCommand } from "./uninstall/cmd.ts";
import { CreateCommand } from "./create/cmd.ts";
import { editorSupportCommands } from "./editor-support/cmd.ts";

// deno-lint-ignore no-explicit-any
export function commands(): Command<any>[] {
  return [
    // deno-lint-ignore no-explicit-any
    renderCommand as any,
    previewCommand,
    serveCommand,
    CreateCommand,
    makeUseCommand(),
    AddCommand,
    updateCommand,
    removeCommand,
    CreateProjectCommand,
    ConvertCommand,
    PandocCommand,
    typstCommand,
    runCommand,
    ...listCommands,
    InstallCommand,
    uninstallCommand,
    toolsCommand,
    publishCommand,
    CapabilitiesCommand,
    InspectCommand,
    CheckCommand,
    BuildJsCommand,
    ...editorSupportCommands,
  ];
}
