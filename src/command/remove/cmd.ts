/*
* cmd.ts
*
* Copyright (C) 2021 by RStudio, PBC
*
*/

import { Command } from "cliffy/command/mod.ts";
import { Checkbox } from "cliffy/prompt/mod.ts";
import { initYamlIntelligenceResourcesFromFilesystem } from "../../core/schema/utils.ts";
import { createTempContext } from "../../core/temp.ts";

import { info } from "log/mod.ts";
import { removeExtension } from "../../extension/remove.ts";
import { createExtensionContext } from "../../extension/extension.ts";
import {
  Extension,
  extensionIdString,
} from "../../extension/extension-shared.ts";
import { projectContext } from "../../project/project-context.ts";
import {
  afterConfirm,
  loadTools,
  removeTool,
  selectTool,
} from "../../tools/tools-console.ts";

export const removeCommand = new Command()
  .hidden()
  .name("remove")
  .arguments("[target:string]")
  .arguments("<type:string> [target:string]")
  .option(
    "--no-prompt",
    "Do not prompt to confirm actions",
  )
  .description(
    "Removes an extension or global dependency.",
  )
  .example(
    "Remove extension using name",
    "quarto remove extension <extension-name>",
  )
  .example(
    "Choose extensions to remove",
    "quarto remove extension",
  )
  .example(
    "Remove TinyTeX",
    "quarto remove tool tinytex",
  )
  .example(
    "Remove Chromium",
    "quarto remove tool chromium",
  )
  .example(
    "Choose tools to remove",
    "quarto remove tool",
  )
  .action(
    async (options: { prompt?: boolean }, type: string, target?: string) => {
      await initYamlIntelligenceResourcesFromFilesystem();
      const temp = createTempContext();
      const extensionContext = createExtensionContext();

      try {
        if (type.toLowerCase() === "extension") {
          // Not provided, give the user a list to select from
          const targetDir = Deno.cwd();

          // Process extension
          if (target) {
            // explicitly provided
            const extensions = extensionContext.find(target, targetDir);
            if (extensions.length > 0) {
              await removeExtensions(extensions.slice(), options.prompt);
            } else {
              info("No matching extension found.");
            }
          } else {
            // Provide the with with a list
            const project = await projectContext(targetDir);
            const extensions = extensionContext.extensions(targetDir, project);

            // Show a list
            if (extensions.length > 0) {
              const extensionsToRemove = await selectExtensions(extensions);
              if (extensionsToRemove.length > 0) {
                await removeExtensions(extensionsToRemove);
              }
            } else {
              info("No extensions installed.");
            }
          }
        } else if (type.toLowerCase() === "tool") {
          // Process tool
          if (target) {
            // Explicitly provided
            await removeTool(target, options.prompt);
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

function removeExtensions(extensions: Extension[], prompt?: boolean) {
  const removeOneExtension = async (extension: Extension) => {
    // Exactly one extension
    return await afterConfirm(
      `Are you sure you'd like to remove ${extension.title}?`,
      async () => {
        await removeExtension(extension);
        info("Extension removed.");
      },
      prompt,
    );
  };

  const removeMultipleExtensions = async (extensions: Extension[]) => {
    return await afterConfirm(
      `Are you sure you'd like to remove ${extensions.length} ${
        extensions.length === 1 ? "extension" : "extensions"
      }?`,
      async () => {
        for (const extensionToRemove of extensions) {
          await removeExtension(extensionToRemove);
        }
        info(
          `${extensions.length} ${
            extensions.length === 1 ? "extension" : "extensions"
          } removed.`,
        );
      },
      prompt,
    );
  };

  info("");
  if (extensions.length === 1) {
    return removeOneExtension(extensions[0]);
  } else {
    return removeMultipleExtensions(extensions);
  }
}

async function selectExtensions(extensions: Extension[]) {
  const sorted = extensions.sort((ext1, ext2) => {
    const orgSort = (ext1.id.organization || "").localeCompare(
      ext2.id.organization || "",
    );
    if (orgSort !== 0) {
      return orgSort;
    } else {
      return ext1.title.localeCompare(ext2.title);
    }
  });

  const extsToKeep: string[] = await Checkbox.prompt({
    message: "Select extension(s) to keep",
    options: sorted.map((ext) => {
      return {
        name: `${ext.title}${
          ext.id.organization ? " (" + ext.id.organization + ")" : ""
        }`,
        value: extensionIdString(ext.id),
        checked: true,
      };
    }),
    hint:
      "Use the arrow keys and spacebar to specify extensions you'd like to remove.\n" +
      "   Press Enter to confirm the list of accounts you wish to remain available.",
  });

  return extensions.filter((extension) => {
    return !extsToKeep.includes(extensionIdString(extension.id));
  });
}
