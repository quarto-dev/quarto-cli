/*
* cmd.ts
*
* Copyright (C) 2021 by RStudio, PBC
*
*/
import { Command } from "cliffy/command/mod.ts";
import { initYamlIntelligenceResourcesFromFilesystem } from "../../core/schema/utils.ts";
import { createTempContext } from "../../core/temp.ts";
import { uninstallTool } from "../tools/tools.ts";

import { info } from "log/mod.ts";

export const removeCommand = new Command()
  .hidden()
  .name("remove")
  .arguments("[target:string]")
  .arguments("<type:string> <target:string>")
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
    async (options: { prompt?: boolean }, type: string, target: string) => {
      await initYamlIntelligenceResourcesFromFilesystem();
      const temp = createTempContext();
      try {
        if (type.toLowerCase() === "extension") {
          // Install an extension
          // TODO: Remove extension
        } else if (type.toLowerCase() === "tool") {
          // Install a tool
          await uninstallTool(target);
        } else {
          // This is an unrecognized type option
          info(
            `Unrecorgnized option '${type}' - please choose 'tool' or 'extension'.`,
          );
        }
      } finally {
        temp.cleanup();
      }
    },
  );
