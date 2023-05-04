/*
 * cmd.ts
 *
 * Copyright (C) 2021-2022 Posit Software, PBC
 */

import { Command } from "cliffy/command/mod.ts";
import { Checkbox } from "cliffy/prompt/mod.ts";
import { initYamlIntelligenceResourcesFromFilesystem } from "../../core/schema/utils.ts";
import { createTempContext } from "../../core/temp.ts";

import { info } from "log/mod.ts";
import { removeExtension } from "../../extension/remove.ts";
import { createExtensionContext } from "../../extension/extension.ts";
import { extensionIdString } from "../../extension/extension-shared.ts";
import { Extension } from "../../extension/types.ts";
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
  .arguments("[target...]")
  .option(
    "--no-prompt",
    "Do not prompt to confirm actions",
  )
  .option(
    "--embed <extensionId>",
    "Remove this extension from within another extension (used when authoring extensions).",
  )
  .option(
    "--update-path",
    "Update system path when a tool is installed",
    {
      hidden: true,
    },
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
      options: { prompt?: boolean; embed?: string; updatePath?: boolean },
      ...target: string[]
    ) => {
      await initYamlIntelligenceResourcesFromFilesystem();
      const temp = createTempContext();
      const extensionContext = createExtensionContext();

      // -- update path
      try {
        const resolved = resolveCompatibleArgs(target || [], "extension");
        if (resolved.action === "tool") {
          if (resolved.name) {
            // Explicitly provided
            await removeTool(resolved.name, options.prompt, options.updatePath);
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
          // Not provided, give the user a list to select from
          const workingDir = Deno.cwd();

          const resolveTargetDir = async () => {
            if (options.embed) {
              // We're removing an embedded extension, lookup the extension
              // and use its path
              const context = createExtensionContext();
              const extension = await context.extension(
                options.embed,
                workingDir,
              );
              if (extension) {
                return extension?.path;
              } else {
                throw new Error(`Unable to find extension '${options.embed}.`);
              }
            } else {
              // Just use the current directory
              return workingDir;
            }
          };
          const targetDir = await resolveTargetDir();

          // Process extension
          if (resolved.name) {
            // explicitly provided
            const extensions = await extensionContext.find(
              resolved.name,
              targetDir,
              undefined,
              undefined,
              undefined,
              { builtIn: false },
            );
            if (extensions.length > 0) {
              await removeExtensions(extensions.slice(), options.prompt);
            } else {
              info("No matching extension found.");
            }
          } else {
            // Provide the with with a list
            const project = await projectContext(targetDir);
            const extensions = await extensionContext.extensions(
              targetDir,
              project?.config,
              project?.dir,
              { builtIn: false },
            );

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
        }
      } finally {
        temp.cleanup();
      }
    },
  );

// note that we're using variadic arguments here to preserve backware compatibility.
export const resolveCompatibleArgs = (
  args: string[],
  defaultAction: "extension" | "tool",
): {
  action: string;
  name?: string;
} => {
  if (args.length === 1) {
    // tool
    // extension
    // quarto-ext/lightbox
    const extname = args[0];
    if (extname === "tool") {
      return {
        action: "tool",
      };
    } else if (extname === "extension") {
      return {
        action: "extension",
      };
    } else if (extname === "tinytex" || extname === "chromium") {
      return {
        action: "tool",
        name: args[0],
      };
    } else {
      return {
        action: defaultAction,
        name: args[0],
      };
    }
  } else if (args.length > 1) {
    // tool chromium
    // tool tinytex
    // extension quarto-ext/lightbox
    const action = args[0];
    const name = args[1];

    if (action === "tool") {
      return {
        action,
        name,
      };
    } else if (action === "extension") {
      return {
        action: "extension",
        name,
      };
    } else {
      return {
        action: defaultAction,
        name,
      };
    }
  } else {
    return {
      action: defaultAction,
    };
  }
};

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
      `Use the arrow keys and spacebar to specify extensions you'd like to remove.\n` +
      "   Press Enter to confirm the list of accounts you wish to remain available.",
  });

  return extensions.filter((extension) => {
    return !extsToKeep.includes(extensionIdString(extension.id));
  });
}
