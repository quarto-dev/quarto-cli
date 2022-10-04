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

import { info } from "log/mod.ts";

export const addCommand = new Command()
  .name("add")
  .arguments("<extension:string>")
  .option(
    "--no-prompt",
    "Do not prompt to confirm actions",
  )
  .option(
    "--embed <extensionId>",
    "Embed this extension within another extension (used when authoring extensions).",
  )
  .description(
    "Add an extension to this folder or project",
  )
  .example(
    "Install extension (Github)",
    "quarto install extension <gh-org>/<gh-repo>",
  )
  .example(
    "Install extension (file)",
    "quarto install extension <path-to-zip>",
  )
  .example(
    "Install extension (url)",
    "quarto install extension <url>",
  )
  .action(
    async (
      options: { prompt?: boolean; embed?: string; updatePath?: boolean },
      extension: string,
    ) => {
      await initYamlIntelligenceResourcesFromFilesystem();
      const temp = createTempContext();
      try {
        // Install an extension
        if (extension) {
          await installExtension(
            extension,
            temp,
            options.prompt !== false,
            options.embed,
          );
        } else {
          info("Please provide an extension name, url, or path.");
        }
      } finally {
        temp.cleanup();
      }
    },
  );
