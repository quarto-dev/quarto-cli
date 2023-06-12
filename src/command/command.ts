/*
 * command.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import type { Command } from "cliffy/command/mod.ts";

import { renderCommand } from "./render/cmd.ts";
import { serveCommand } from "./serve/cmd.ts";
import { createProjectCommand } from "./create-project/cmd.ts";
import { toolsCommand } from "./tools/cmd.ts";
import { previewCommand } from "./preview/cmd.ts";
import { convertCommand } from "./convert/cmd.ts";
import { runCommand } from "./run/run.ts";
import { pandocCommand } from "./pandoc/cmd.ts";
import { typstCommand } from "./typst/cmd.ts";
import { capabilitiesCommand } from "./capabilities/cmd.ts";
import { checkCommand } from "./check/cmd.ts";
import { inspectCommand } from "./inspect/cmd.ts";
import { buildJsCommand } from "./build-js/cmd.ts";
import { installCommand } from "./install/cmd.ts";
import { updateCommand } from "./update/cmd.ts";
import { publishCommand } from "./publish/cmd.ts";
import { removeCommand } from "./remove/cmd.ts";
import { listCommand } from "./list/cmd.ts";
import { useCommand } from "./use/cmd.ts";
import { addCommand } from "./add/cmd.ts";
import { uninstallCommand } from "./uninstall/cmd.ts";
import { createCommand } from "./create/cmd.ts";
import { editorSupportCommand } from "./editor-support/cmd.ts";

// deno-lint-ignore no-explicit-any
export function commands(): Command<any>[] {
  return [
    // deno-lint-ignore no-explicit-any
    renderCommand as any,
    previewCommand,
    serveCommand,
    createCommand,
    createProjectCommand,
    convertCommand,
    pandocCommand,
    typstCommand,
    runCommand,
    addCommand,
    installCommand,
    uninstallCommand,
    updateCommand,
    removeCommand,
    listCommand,
    useCommand,
    publishCommand,
    capabilitiesCommand,
    inspectCommand,
    toolsCommand,
    checkCommand,
    buildJsCommand,
    editorSupportCommand,
  ];
}
