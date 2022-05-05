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

export const installCommand = new Command()
  .hidden() // TODO: unhide when ready
  .name("install")
  .arguments("[target:string]")
  .description(
    "Installs a Quarto Extension into the current directory or Project directory.",
  )
  .example(
    "Install extension from file",
    "quarto install /Users/catmemes/tools/my-extension.tar.gz",
  )
  .example(
    "Install extension from folder",
    "quarto install /Users/catmemes/tools/my-extension/",
  )
  .example(
    "Install extension from url",
    "quarto install https://github.com/quarto-dev/quarto-extensions/releases/download/latest/my-extension.tar.gz",
  )
  .action(async (_options: unknown, target?: string) => {
    await initYamlIntelligenceResourcesFromFilesystem();
    const temp = createTempContext();
    try {
      if (target) {
        await installExtension(target, temp);
      }
    } finally {
      temp.cleanup();
    }
  });
