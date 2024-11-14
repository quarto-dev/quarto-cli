/*
 * cmd.ts
 *
 * Copyright (C) 2021-2024 Posit Software, PBC
 */

import { Command, Option } from "npm:clipanion";
import { initYamlIntelligenceResourcesFromFilesystem } from "../../core/schema/utils.ts";

import { info } from "../../deno_ral/log.ts";
import {
  loadTools,
  removeTool,
  selectTool,
} from "../../tools/tools-console.ts";


export class UninstallCommand extends Command {
  static name = 'uninstall';
  static paths = [[UninstallCommand.name]];

  static usage = Command.Usage({
    description: "Removes an extension.",
    examples: [
      [
        "Remove extension using name",
        `$0 ${UninstallCommand.name} <extension-name>`,
      ]
    ]
  });

  tool = Option.String({ required: false });

  noPrompt = Option.Boolean('--no-prompt', {description: "Do not prompt to confirm actions"});
  updatePath = Option.Boolean('--update-path', {description: "Update system path when a tool is installed"});

  async execute() {
    const { tool, updatePath } = this;
    const prompt = !this.noPrompt

    await initYamlIntelligenceResourcesFromFilesystem();

    // -- update path
    if (tool) {
      // Explicitly provided
      await removeTool(tool, prompt, updatePath);
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
  }
}
