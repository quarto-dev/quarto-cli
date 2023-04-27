/*
* cmd.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/

import { Command } from "cliffy/command/mod.ts";
import {
  outputTools,
  removeTool,
  updateOrInstallTool,
} from "../../tools/tools-console.ts";
import { installableTools, printToolInfo } from "../../tools/tools.ts";

// quarto tools install tinytex
// quarto tools uninstall tinytex
// quarto tools update tinytex

// The quarto install command
export const toolsCommand = new Command()
  .name("tools")
  .hidden()
  .arguments("[command:string] [tool:string]")
  .description(
    `Installation and update of ancillary tools.
    
  tools:\n  ${
      installableTools().map((name: string) => "  " + name).join("\n  ")
    }

  commands:
    install
    uninstall
    update
    
Use 'quarto tools' with no arguments to show the status of all tools.`,
  )
  .example(
    "Install TinyTex",
    "quarto tools install tinytex",
  )
  .example(
    "Uninstall TinyTex",
    "quarto tools uninstall tinytex",
  )
  .example(
    "Update TinyTex",
    "quarto tools update tinytex",
  )
  .example(
    "Show tool status",
    "quarto tools list",
  )
  // deno-lint-ignore no-explicit-any
  .action(async (_options: any, command?: string, tool?: string) => {
    command = command || "list";
    switch (command) {
      case "info":
        if (tool) {
          await printToolInfo(tool);
        }
        break;
      case "install":
        if (tool) {
          await updateOrInstallTool(
            tool,
            "install",
          );
        }
        break;
      case "uninstall":
        if (tool) {
          await removeTool(tool);
        }
        break;
      case "update":
        if (tool) {
          await updateOrInstallTool(
            tool,
            "update",
          );
        }
        break;
      case "list":
        await outputTools();
        break;
    }
  });
