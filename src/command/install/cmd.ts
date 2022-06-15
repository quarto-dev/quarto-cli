/*
* cmd.ts
*
* Copyright (C) 2021 by RStudio, PBC
*
*/
import { Command } from "cliffy/command/mod.ts";
import { Confirm } from "cliffy/prompt/mod.ts";
import { initYamlIntelligenceResourcesFromFilesystem } from "../../core/schema/utils.ts";
import { createTempContext } from "../../core/temp.ts";
import { installExtension } from "../../extension/install.ts";
import { installTool, toolSummary, updateTool } from "../tools/tools.ts";

import { info } from "log/mod.ts";
import { loadTools, selectTool } from "../remove/tools-console.ts";

export const installCommand = new Command()
  .hidden()
  .name("install")
  .arguments("<type:string> [target:string]")
  .option(
    "--no-prompt",
    "Do not prompt to confirm actions",
  )
  .description(
    "Installs an extension or global dependency.",
  )
  .example(
    "Install extension (Github)",
    "quarto install extension <gh-org>/<gh-repo>",
  )
  .example(
    "Install extension (file)",
    "quarto install extension <path-to-zip>",
  )
  .example(
    "Install extension (url)",
    "quarto install extension <url>",
  )
  .example(
    "Install TinyTeX",
    "quarto install tool tinytex",
  )
  .example(
    "Install Chromium",
    "quarto install tool chromium",
  )
  .example(
    "Choose tool to install",
    "quarto install tool",
  )
  .action(
    async (options: { prompt?: boolean }, type: string, target?: string) => {
      await initYamlIntelligenceResourcesFromFilesystem();
      const temp = createTempContext();
      try {
        if (type.toLowerCase() === "extension") {
          // Install an extension
          if (target) {
            await installExtension(target, temp, options.prompt !== false);
          } else {
            info("Please provide an extension name, url, or path.");
          }
        } else if (type.toLowerCase() === "tool") {
          // Install a tool
          if (target) {
            // Use the tool name
            await updateOrInstallTool(target);
          } else {
            // Not provided, give the user a list to choose from
            const allTools = await loadTools();
            if (allTools.filter((tool) => !tool.installed).length === 0) {
              info("All tools are already installed.");
            } else {
              // Select which tool should be installed
              const toolTarget = await selectTool(allTools, "install");
              if (toolTarget) {
                info("");
                await installTool(toolTarget);
              }
            }
          }
        } else {
          // This is an unrecognized type option
          info(
            `Unrecognized option '${type}' - please choose 'tool' or 'extension'.`,
          );
        }
      } finally {
        temp.cleanup();
      }
    },
  );

async function updateOrInstallTool(tool: string) {
  const summary = await toolSummary(tool);
  if (summary && summary.installed) {
    if (summary.installedVersion === summary.latestRelease.version) {
      info(`${tool} is already installed and up to date.`);
    } else {
      const confirmed: boolean = await Confirm.prompt(
        {
          message:
            `${tool} is already installed. Do you want to update to ${summary.latestRelease.version}?`,
          default: true,
        },
      );
      if (confirmed) {
        return updateTool(tool);
      } else {
        return Promise.resolve();
      }
    }
  } else {
    return installTool(tool);
  }
}
