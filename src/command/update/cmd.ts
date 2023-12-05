/*
 * cmd.ts
 *
 * Copyright (C) 2021-2022 Posit Software, PBC
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
} from "../../tools/tools-console.ts";
import { resolveCompatibleArgs } from "../remove/cmd.ts";

export const updateCommand = new Command()
  .name("update")
  .arguments("[target...]")
  .option(
    "--no-prompt",
    "Do not prompt to confirm actions",
  )
  .option(
    "--embed <extensionId>",
    "Embed this extension within another extension (used when authoring extensions).",
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
    async (
      options: { prompt?: boolean; embed?: string },
      ...target: string[]
    ) => {
      await initYamlIntelligenceResourcesFromFilesystem();
      const temp = createTempContext();
      try {
        const resolved = resolveCompatibleArgs(target, "extension");

        if (resolved.action === "extension") {
          // Install an extension
          if (resolved.name) {
            await installExtension(
              resolved.name,
              temp,
              options.prompt !== false,
              options.embed,
            );
          } else {
            info("Please provide an extension name, url, or path.");
          }
        } else if (resolved.action === "tool") {
          // Install a tool
          if (resolved.name) {
            // Use the tool name
            await updateOrInstallTool(resolved.name, "update", options.prompt);
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
    },
  );
