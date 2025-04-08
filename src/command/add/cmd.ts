/*
 * cmd.ts
 *
 * Copyright (C) 2021-2022 Posit Software, PBC
 */
import { Command } from "cliffy/command/mod.ts";
import { initYamlIntelligenceResourcesFromFilesystem } from "../../core/schema/utils.ts";
import { createTempContext } from "../../core/temp.ts";
import { installExtension } from "../../extension/install.ts";

import { info } from "../../deno_ral/log.ts";
import { signalCommandFailure } from "../utils.ts";

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
    "quarto add <gh-org>/<gh-repo>",
  )
  .example(
    "Install extension (file)",
    "quarto add <path-to-zip>",
  )
  .example(
    "Install extension (url)",
    "quarto add <url>",
  )
  .action(
    async (
      options: { prompt?: boolean; embed?: string; updatePath?: boolean },
      extension: string,
    ) => {
      await initYamlIntelligenceResourcesFromFilesystem();
      const temp = createTempContext();
      try {
        if (!extension) {
          info("Please provide an extension name, url, or path.");
          signalCommandFailure();
        }
        // Install an extension
        const result = await installExtension(
          extension,
          temp,
          options.prompt !== false,
          options.embed,
        );
        if (!result) {
          signalCommandFailure();
        }
      } finally {
        temp.cleanup();
      }
    },
  );
