/*
* pandoc.ts
*
* Copyright (C) 2020-2024 Posit Software, PBC
*
*/

import { Command, Option } from "npm:clipanion";
import { execProcess } from "../../core/process.ts";
import { pandocBinaryPath } from "../../core/resources.ts";

export class PandocCommand extends Command {
  static name = 'pandoc';
  static paths = [[PandocCommand.name]];

  static usage = Command.Usage({
    description: "Run the version of Pandoc embedded within Quarto.\n" +
        "You can pass arbitrary command line arguments to quarto pandoc\n" +
        "(they will be passed through unmodified to Pandoc)",
  })

  args = Option.Proxy();

  async execute() {
    const { env } = this.context;
    const result = await execProcess(
      {
        cmd: [pandocBinaryPath(), ...this.args],
        env: (env as Record<string, string>),
      },
      undefined,
      undefined,
      undefined,
      true,
    );
    Deno.exit(result.code);
  }
}
