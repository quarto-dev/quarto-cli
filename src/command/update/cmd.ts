/*
* cmd.ts
*
* Copyright (C) 2021 by RStudio, PBC
*
*/
import { Command } from "cliffy/command/mod.ts";
import { initYamlIntelligenceResourcesFromFilesystem } from "../../core/schema/utils.ts";
import { createTempContext } from "../../core/temp.ts";
import { installExtension } from "../../extension/install.ts";

import { info } from "log/mod.ts";
import {
  loadTools,
  selectTool,
  updateOrInstallTool,
} from "../remove/tools-console.ts";

export const updateCommand = new Command()
  .hidden()
  .name("update")
  .arguments("<type:string> [target:string]")
  .option(
    "--no-prompt",
    "Do not prompt to confirm actions",
  )
  .description(
    "Updates an extension or global dependency.",
  )
  .example(
    "Update extension (Github)",
    "quarto update extension <gh-org>/<gh-repo>",
  )
  .example(
    "Update extension (file)",
    "quarto update extension <path-to-zip>",
  )
  .example(
    "Update extension (url)",
    "quarto update extension <url>",
  )
  .example(
    "Update TinyTeX",
    "quarto update tool tinytex",
  )
  .example(
    "Update Chromium",
    "quarto update tool chromium",
  )
  .example(
    "Choose tool to update",
    "quarto update tool",
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
            await updateOrInstallTool(target, "update");
          } else {
            // Not provided, give the user a list to choose from
            const allTools = await loadTools();
            if (allTools.filter((tool) => !tool.installed).length === 0) {
              info("All tools are already installed.");
            } else {
              // Select which tool should be installed
              const toolTarget = await selectTool(allTools, "update");
              if (toolTarget) {
                info("");
                await updateOrInstallTool(toolTarget, "update");
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
