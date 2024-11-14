/*
 * cmd.ts
 *
 * Copyright (C) 2021-2024 Posit Software, PBC
 */
import { Command, Option } from "npm:clipanion";

import { initYamlIntelligenceResourcesFromFilesystem } from "../../core/schema/utils.ts";
import { createTempContext } from "../../core/temp.ts";
import { installExtension } from "../../extension/install.ts";

import { info } from "../../deno_ral/log.ts";

export class AddCommand extends Command {
  static name = 'add';
  static paths = [[AddCommand.name]];

  static usage = Command.Usage({
    description: "Add an extension to this folder or project",
    examples: [
      [
        "Install extension (Github)",
        `$0 ${AddCommand.name} <gh-org>/<gh-repo>`,
      ], [
        "Install extension (file)",
        `$0 ${AddCommand.name} <path-to-zip>`,
      ], [
        "Install extension (url)",
        `$0 ${AddCommand.name} <url>`,
      ]
    ]
  });

  extension = Option.String({ required: true });

  embed = Option.String('--embed', {description: "Embed this extension within another extension (used when authoring extensions)."});
  noPrompt = Option.Boolean('--no-prompt', {description: "Do not prompt to confirm actions"});

  async execute() {
    await initYamlIntelligenceResourcesFromFilesystem();
    const temp = createTempContext();
    try {
      if (this.extension) {
        await installExtension(
            this.extension,
            temp,
            !this.noPrompt,
            this.embed,
        );
      } else {
        info("Please provide an extension name, url, or path.");
      }
    } finally {
      temp.cleanup();
    }
  }
}
