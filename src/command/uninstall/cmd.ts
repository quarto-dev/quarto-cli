/*
 * cmd.ts
 *
 * Copyright (C) 2021-2022 Posit Software, PBC
 */

import { Command } from "cliffy/command/mod.ts";
import { initYamlIntelligenceResourcesFromFilesystem } from "../../core/schema/utils.ts";

import { info } from "../../deno_ral/log.ts";
import {
  loadTools,
  removeTool,
  selectTool,
} from "../../tools/tools-console.ts";

export const uninstallCommand = new Command()
  .name("uninstall")
  .arguments("[tool]")
  .option(
    "--no-prompt",
    "Do not prompt to confirm actions",
  )
  .option(
    "--update-path",
    "Update system path when a tool is installed",
  )
  .description(
    "Removes an extension.",
  )
  .example(
    "Remove extension using name",
    "quarto remove <extension-name>",
  )
  .action(
    async (
      options: { prompt?: boolean; updatePath?: boolean },
      tool?: string,
    ) => {
      await initYamlIntelligenceResourcesFromFilesystem();

      // -- update path
      if (tool) {
        // Explicitly provided
        await removeTool(tool, options.prompt, options.updatePath);
      } else {
        // Not provided, give the user a list to choose from
        const allTools = await loadTools();
        if (allTools.filter((tool) => tool.installed).length === 0) {
          info("No tools are installed.");
        } else {
          // Select which tool should be installed
          const toolTarget = await selectTool(allTools, "remove");
          if (toolTarget) {
            info("");
            await removeTool(toolTarget);
          }
        }
      }
    },
  );
