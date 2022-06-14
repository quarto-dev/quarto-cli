/*
* cmd.ts
*
* Copyright (C) 2021 by RStudio, PBC
*
*/
import { Command } from "cliffy/command/mod.ts";
import { Checkbox, Confirm, Select } from "cliffy/prompt/mod.ts";
import { initYamlIntelligenceResourcesFromFilesystem } from "../../core/schema/utils.ts";
import { createTempContext } from "../../core/temp.ts";
import { allTools, uninstallTool } from "../tools/tools.ts";

import { info } from "log/mod.ts";
import { removeExtension } from "../../extension/remove.ts";
import { withSpinner } from "../../core/console.ts";
import { InstallableTool } from "../tools/types.ts";
import { createExtensionContext } from "../../extension/extension.ts";
import {
  Extension,
  extensionIdString,
} from "../../extension/extension-shared.ts";
import { projectContext } from "../../project/project-context.ts";
import { loadTools, selectTool } from "./tools-console.ts";

export const removeCommand = new Command()
  .hidden()
  .name("remove")
  .arguments("[target:string]")
  .arguments("<type:string> [target:string]")
  .option(
    "--no-prompt",
    "Do not prompt to confirm actions during installation",
  )
  .description(
    "Removes an extension or global dependency.",
  )
  .example(
    "Remove extension using name",
    "quarto remove extension <extension-name>",
  )
  .example(
    "Remove TinyTeX",
    "quarto remove tool tinytex",
  )
  .example(
    "Remove Chromium",
    "quarto remove tool chromium",
  )
  .action(
    async (_options: { prompt?: boolean }, type: string, target?: string) => {
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
              await removeExtensions(extensions.slice());
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
              await removeExtensions(extensionsToRemove);
            } else {
              info("No extensions installed.");
            }
          }
        } else if (type.toLowerCase() === "tool") {
          // Process tool
          if (target) {
            // Explicitly provided
            await confirmAction(
              `Are you sure you'd like to remove ${target}?`,
              () => {
                return uninstallTool(target);
              },
            );
          } else {
            // Not provided, give the user a list to choose from
            const allTools = await loadTools();
            if (allTools.filter((tool) => tool.installed).length === 0) {
              info("No tools are installed.");
            } else {
              // Select which tool should be installed
              const toolTarget = await selectTool(allTools, "remove");
              if (toolTarget) {
                await uninstallTool(toolTarget);
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

function removeExtensions(extensions: Extension[]) {
  const removeOneExtension = async (extension: Extension) => {
    // Exactly one extension
    return await confirmAction(
      `Are you sure you'd like to remove ${extension.title}?`,
      () => {
        return removeExtension(extension);
      },
    );
  };

  const removeMultipleExtensions = async (extensions: Extension[]) => {
    return await confirmAction(
      `Are you sure you'd like to remove ${extensions.length} extensions?`,
      async () => {
        for (const extensionToRemove of extensions) {
          await removeExtension(extensionToRemove);
        }
      },
    );
  };

  if (extensions.length === 1) {
    return removeOneExtension(extensions[1]);
  } else {
    return removeMultipleExtensions(extensions);
  }
}

async function confirmAction(message: string, fn: () => Promise<void>) {
  const confirmed: boolean = await Confirm.prompt(message);
  if (confirmed) {
    return fn();
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

  const extsToRemove: string[] = await Checkbox.prompt({
    message: "Select extension(s) to remove",
    options: sorted.map((ext) => {
      return {
        name: `${ext.title}${
          ext.id.organization ? " (" + ext.id.organization + ")" : ""
        }`,
        value: extensionIdString(ext.id),
      };
    }),
  });

  return extensions.filter((extension) => {
    return extsToRemove.includes(extensionIdString(extension.id));
  });
}
