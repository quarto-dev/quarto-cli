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
import { resolveCompatibleArgs } from "../remove/cmd.ts";


export class UpdateCommand extends Command {
  static name = 'update';
  static paths = [[UpdateCommand.name]];

  static usage = Command.Usage({
    description: "Updates an extension or global dependency.",
    examples: [
      [
        "Update extension (Github)",
        `$0 ${UpdateCommand.name} extension <gh-org>/<gh-repo>`,
      ],
      [
        "Update extension (file)",
        `$0 ${UpdateCommand.name} extension <path-to-zip>`,
      ],
      [
        "Update extension (url)",
        `$0 ${UpdateCommand.name} extension <url>`,
      ],
      [
        "Update TinyTeX",
        `$0 ${UpdateCommand.name} tool tinytex`,
      ],
      [
        "Update Chromium",
        `$0 ${UpdateCommand.name} tool chromium`,
      ],
      [
        "Choose tool to update",
        `$0 ${UpdateCommand.name} tool`,
      ]
    ]
  });

  targets = Option.Rest();

  embed = Option.String('--embed', {description: "Embed this extension within another extension (used when authoring extensions)." });
  noPrompt = Option.Boolean('--no-prompt', { description: "Do not prompt to confirm actions" });

  async execute() {
    const { embed, targets } = this;
    const prompt = !this.noPrompt
    await initYamlIntelligenceResourcesFromFilesystem();
    const temp = createTempContext();
    try {
      const resolved = resolveCompatibleArgs(targets, "extension");

      if (resolved.action === "extension") {
        // Install an extension
        if (resolved.name) {
          await installExtension(
              resolved.name,
              temp,
              prompt,
              embed,
          );
        } else {
          info("Please provide an extension name, url, or path.");
        }
      } else if (resolved.action === "tool") {
        // Install a tool
        if (resolved.name) {
          // Use the tool name
          await updateOrInstallTool(resolved.name, "update", prompt);
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
            `Unrecognized option '${resolved.action}' - please choose 'tool' or 'extension'.`,
        );
      }
    } finally {
      temp.cleanup();
    }
  }
}
