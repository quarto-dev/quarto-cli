/*
 * cmd.ts
 *
 * Copyright (C) 2021-2024 Posit Software, PBC
 */
import { Command, Option } from "npm:clipanion";
import { initYamlIntelligenceResourcesFromFilesystem } from "../../core/schema/utils.ts";
import { createTempContext } from "../../core/temp.ts";
import { installExtension } from "../../extension/install.ts";

import { info } from "../../deno_ral/log.ts";
import { loadTools, selectTool, updateOrInstallTool, } from "../../tools/tools-console.ts";
import { installTool } from "../../tools/tools.ts";
import { resolveCompatibleArgs } from "../remove/cmd.ts";


export class InstallCommand extends Command {
  static name = 'install';
  static paths = [[InstallCommand.name]];

  static usage = Command.Usage({
    description: "Installs a global dependency (TinyTex or Chromium).",
    examples: [
      [
        "Install TinyTeX",
        `$0 ${InstallCommand.name} tinytex`,
      ], [
        "Install Chromium",
        `$0 ${InstallCommand.name} chromium`,
      ], [
        "Choose tool to install",
        `$0 ${InstallCommand.name}`,
      ]
    ]
  });

  embed = Option.String('--embed', {
    description: "Embed this extension within another extension (used when authoring extensions).",
    hidden: true,
  });

  noPrompt = Option.Boolean('--no-prompt', {description: "Do not prompt to confirm actions"});
  updatePath = Option.Boolean('--update-path', {description: "Update system path when a tool is installed"});

  targets = Option.Rest();

async execute() {
    await initYamlIntelligenceResourcesFromFilesystem();
    const temp = createTempContext();

    const resolved = resolveCompatibleArgs(this.targets || [], "tool");

    try {
      if (resolved.action === "extension") {
        // Install an extension
        if (resolved.name) {
          await installExtension(
              resolved.name,
              temp,
              !this.noPrompt,
              this.embed,
          );
        } else {
          info("Please provide an extension name, url, or path.");
        }
      } else if (resolved.action === "tool") {
        // Install a tool
        if (resolved.name) {
          // Use the tool name
          await updateOrInstallTool(
              resolved.name,
              "install",
              !this.noPrompt,
              this.updatePath,
          );
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
              await installTool(toolTarget, this.updatePath);
            }
          }
        }
      } else {
        // This is an unrecognized type option
        info(
            `Unrecognized option '${resolved.action}' - please choose 'tool' or 'extension'.`,
        );
      }
    } finally {
      temp.cleanup();
    }
  }
}
