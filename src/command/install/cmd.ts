/*
* cmd.ts
*
* Copyright (C) 2021 by RStudio, PBC
*
*/
import { Command } from "cliffy/command/mod.ts";
import { Select } from "cliffy/prompt/select.ts";
import { initYamlIntelligenceResourcesFromFilesystem } from "../../core/schema/utils.ts";
import { createTempContext } from "../../core/temp.ts";
import { installExtension } from "../../extension/install.ts";
import {
  allTools,
  installableTool,
  installableTools,
  installTool,
  toolSummary,
} from "../tools/tools.ts";

import { info } from "log/mod.ts";
import { withSpinner } from "../../core/console.ts";
import { InstallableTool } from "../tools/types.ts";

export const installCommand = new Command()
  .hidden()
  .name("install")
  .arguments("[target:string]")
  .arguments("<type:string> [target:string]")
  .option(
    "--no-prompt",
    "Do not prompt to confirm actions during installation",
  )
  .description(
    "Installs an extension or global dependency.",
  )
  .example(
    "Install extension from Github",
    "quarto install extension <gh-organization>/<gh-repo>",
  )
  .example(
    "Install extension from file",
    "quarto install extension tools/my-extension.tar.gz",
  )
  .example(
    "Install extension from url",
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
            await installTool(target);
          } else {
            // Present a list of tools
            const toolsToInstall = await notInstalledTools();
            if (toolsToInstall.length === 0) {
              info("All tools already installed.");
              const summaries = [];
              for (const tool of installableTools()) {
                const summary = await toolSummary(tool);
                summaries.push(summary);
              }
            } else {
              const toolsWithSummary = [];
              for (const tool of toolsToInstall) {
                const summary = await toolSummary(tool.name);
                toolsWithSummary.push({ tool, summary });
              }

              const toolTarget: string = await Select.prompt({
                message: "Select a tool to install",
                options: toolsWithSummary.map((toolWithSummary) => {
                  return {
                    name: `${toolWithSummary.tool.name}${
                      toolWithSummary.summary?.latestRelease.version
                        ? " (" +
                          toolWithSummary.summary?.latestRelease.version + ")"
                        : ""
                    }`,
                    value: toolWithSummary.tool.name,
                  };
                }),
              });
              if (toolTarget) {
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

async function notInstalledTools() {
  const toolsToInstall: InstallableTool[] = [];
  await withSpinner({ message: "Inspecting tools" }, async () => {
    const all = await allTools();
    toolsToInstall.push(...all.notInstalled);
  });
  return toolsToInstall;
}
