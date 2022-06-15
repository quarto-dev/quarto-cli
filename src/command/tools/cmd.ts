/*
* cmd.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { Command } from "cliffy/command/mod.ts";
import { Confirm } from "cliffy/prompt/mod.ts";
import { info } from "log/mod.ts";
import { outputTools } from "../../tools/tools-console.ts";
import {
  installableTools,
  installTool,
  printToolInfo,
  toolSummary,
  uninstallTool,
  updateTool,
} from "../../tools/tools.ts";
import { ToolSummaryData } from "../../tools/types.ts";

// quarto tools install tinytex
// quarto tools uninstall tinytex
// quarto tools update tinytex

// The quarto install command
export const toolsCommand = new Command()
  .name("tools")
  .arguments("<command:string> [tool:string]")
  .description(
    `Installation and update of ancillary tools.
    
  tools:\n  ${installableTools().map((name: string) => "  " + name).join("\n")}

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
  .action(async (_options: any, command: string, tool?: string) => {
    switch (command) {
      case "info":
        if (tool) {
          await printToolInfo(tool);
        }
        break;
      case "install":
        if (tool) {
          await installTool(tool);
        }
        break;
      case "uninstall":
        if (tool) {
          await confirmDestructiveAction(
            tool,
            `This will remove ${tool} and all of its files. Are you sure?`,
            async () => {
              await uninstallTool(tool);
            },
            false,
            await toolSummary(tool),
          );
        }
        break;
      case "update":
        if (tool) {
          const summary = await toolSummary(tool);
          await confirmDestructiveAction(
            tool,
            `This will update ${tool} from ${summary?.installedVersion} to ${
              summary?.latestRelease.version
            }. Are you sure?`,
            async () => {
              await updateTool(tool);
            },
            true,
            summary,
          );
        }
        break;
      default:
      case "list":
        await outputTools();
        break;
    }
  });

async function confirmDestructiveAction(
  name: string,
  prompt: string,
  action: () => Promise<void>,
  update: boolean,
  summary?: ToolSummaryData,
) {
  if (summary) {
    if (summary.installed) {
      if (
        summary.installedVersion === summary.latestRelease.version && update
      ) {
        info(`${name} is already up to date.`);
      } else if (summary.installedVersion !== undefined) {
        const confirmed: boolean = await Confirm.prompt(prompt);
        if (confirmed) {
          await action();
        }
      } else {
        info(
          `${name} was not installed using Quarto. Please use the tool that you used to install ${name} instead.`,
        );
      }
    } else {
      info(
        `${name} isn't installed. Please use 'quarto tools install ${name}' to install it.`,
      );
    }
  } else {
    info(
      `${name} isn't a supported tool. Use 'quarto tools help' for more information.`,
    );
  }
}
