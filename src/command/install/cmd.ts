/*
* cmd.ts
*
* Copyright (C) 2021 by RStudio, PBC
*
*/
import { Command } from "cliffy/command/mod.ts";
import { initYamlIntelligenceResourcesFromFilesystem } from "../../core/schema/utils.ts";
import { createTempContext } from "../../core/temp.ts";
import { installExtension } from "../../extension/install.ts";
import { installTool } from "../tools/tools.ts";

import { info } from "log/mod.ts";

export const installCommand = new Command()
  .hidden()
  .name("install")
  .arguments("[target:string]")
  .arguments("<type:string> <target:string>")
  .option(
    "--no-prompt",
    "Do not prompt to confirm actions during installation",
  )
  .description(
    "Installs an extension or global dependency.",
  )
  .example(
    "Install extension from Github",
    "quarto install extension <gh-organization>/<gh-repo>",
  )
  .example(
    "Install extension from file",
    "quarto install extension tools/my-extension.tar.gz",
  )
  .example(
    "Install extension from url",
    "quarto install extension <url>",
  )
  .example(
    "Install TinyTeX",
    "quarto install tool tinytex",
  )
  .example(
    "Install Chromium",
    "quarto install tool chromium",
  )
  .action(
    async (options: { prompt?: boolean }, type: string, target: string) => {
      await initYamlIntelligenceResourcesFromFilesystem();
      const temp = createTempContext();
      try {
        if (type.toLowerCase() === "extension") {
          // Install an extension
          await installExtension(target, temp, options.prompt !== false);
        } else if (type.toLowerCase() === "tool") {
          // Install a tool
          await installTool(target);
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
