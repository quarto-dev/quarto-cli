/*
* cmd.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { Command } from "cliffy/command/mod.ts";
import { Confirm } from "cliffy/prompt/mod.ts";
import { info } from "log/mod.ts";

import { formatLine, withSpinner } from "../../core/console.ts";

import {
  installableTools,
  installTool,
  toolSummary,
  ToolSummaryData,
  uninstallTool,
  updateTool,
} from "./tools.ts";

// quarto tools install tinytex
// quarto tools uninstall tinytex
// quarto tools update tinytex

// The quarto install command
export const toolsCommand = new Command()
  .name("tools")
  .arguments("[command:string] [name:string]")
  .description(
    `Manages quarto tools.\n\nTools that can be installed include:\n${
      installableTools().map((name: string) => "  " + name).join("\n")
    }`,
  )
  .example(
    "Install TinyTex",
    "quarto tools install tinytex",
  )
  // deno-lint-ignore no-explicit-any
  .action(async (options: any, command: string, name?: string) => {
    switch (command) {
      case "install":
        if (name) {
          await installTool(name);
        }
        break;
      case "uninstall":
        if (name) {
          await confirmDestructiveAction(
            name,
            `This will remove ${name} and all of its files. Are you sure?`,
            async () => {
              await uninstallTool(name);
            },
            false,
            await toolSummary(name),
          );
        }
        break;
      case "update":
        if (name) {
          const summary = await toolSummary(name);
          await confirmDestructiveAction(
            name,
            `This will update ${name} from ${summary?.installedVersion} to ${
              summary?.latestRelease.version
            }. Are you sure?`,
            async () => {
              await updateTool(name);
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
        `${name} isn't installed. Please use 'quarto install ${name} to install it.`,
      );
    }
  } else {
    info(
      `${name} isn't a supported tool. Use 'quarto install help' for more information.`,
    );
  }
}

async function outputTools() {
  const toolRows: string[] = [];
  const cols = [20, 32, 14, 14];
  await withSpinner({
    message: "Reading Tool Data",
  }, async () => {
    // Reads the status
    const installStatus = (summary: ToolSummaryData): string => {
      if (summary.installed) {
        if (summary.installedVersion) {
          if (summary.installedVersion === summary.latestRelease.version) {
            return "Up to date";
          } else {
            return "Update available";
          }
        } else {
          return "Present - ext. managed";
        }
      } else {
        return "Not installed";
      }
    };

    // The column widths for output (in chars)

    for (const tool of installableTools()) {
      const summary = await toolSummary(tool);
      if (summary) {
        toolRows.push(
          formatLine(
            [
              tool,
              installStatus(summary),
              summary.installedVersion || "----",
              summary.latestRelease.version,
            ],
            cols,
          ),
        );
      }
    }
  });
  // Write the output
  info(
    formatLine(["Tool", "Status", "Installed", "Latest"], cols),
    { bold: true },
  );
  if (toolRows.length === 0) {
    info("nothing installed", { indent: 2 });
  } else {
    toolRows.forEach((row) => info(row));
  }
}
