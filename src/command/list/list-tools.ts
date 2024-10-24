/*
 * cmd.ts
 *
 * Copyright (C) 2021-2024 Posit Software, PBC
 */
import { Command } from "npm:clipanion";
import { initYamlIntelligenceResourcesFromFilesystem } from "../../core/schema/utils.ts";
import { createTempContext } from "../../core/temp.ts";

import { outputTools } from "../../tools/tools-console.ts";
import { namespace } from "./namespace.ts";

export class ListToolsCommand extends Command {
  static paths = [[namespace, 'tools']];

  static usage = Command.Usage({
    category: 'internal',
    description: "List global tools"
  })

  async execute() {
    await initYamlIntelligenceResourcesFromFilesystem();
    const temp = createTempContext();
    try {
      await outputTools();
    } finally {
      temp.cleanup();
    }
  }
}
