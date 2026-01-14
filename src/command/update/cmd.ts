/*
 * cmd.ts
 *
 * Copyright (C) 2021-2022 Posit Software, PBC
 */
import { Command } from "cliffy/command/mod.ts";
import { initYamlIntelligenceResourcesFromFilesystem } from "../../core/schema/utils.ts";
import { createTempContext } from "../../core/temp.ts";
import { installExtension } from "../../extension/install.ts";
import { findExtensionSource } from "../../extension/extension.ts";
import { join } from "../../deno_ral/path.ts";

import { info } from "../../deno_ral/log.ts";
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
    "Update extension (by installed directory)",
    "quarto update extension <gh-org>/<extension-name>",
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
          // Update an extension
          if (resolved.name) {
            let sourceToUpdate = resolved.name;

            // Try to find the extension in the current directory's _extensions
            // by treating the name as a directory path (e.g., "org/extension-name")
            const extensionPath = join(Deno.cwd(), "_extensions", resolved.name);
            const source = await findExtensionSource(extensionPath);
            if (source) {
              // Found an installed extension, use its source for update
              info(
                `Found installed extension at _extensions/${resolved.name}`,
              );
              // Normalize the source by trimming @TAG for GitHub-style sources
              // (GitHub refs are like "org/repo" or "org/repo/subdir" with optional @tag)
              const githubExtensionRegex = /^[a-zA-Z0-9-_.]+\/[a-zA-Z0-9-_.]+(?:\/[^@]*)?(?:@.+)?$/;
              if (source.match(githubExtensionRegex)) {
                // GitHub-style source, trim @TAG if present
                sourceToUpdate = source.replace(/@.+$/, "");
              } else {
                // URL or local path, use as-is
                sourceToUpdate = source;
              }
              info(
                `Using installation source: ${sourceToUpdate}`,
              );
            } else {
              // Extension not found locally, use the provided target
              // This works for GitHub repos (org/repo), URLs, and file paths
              info(
                `Using provided target: ${resolved.name}`,
              );
            }

            await installExtension(
              sourceToUpdate,
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
