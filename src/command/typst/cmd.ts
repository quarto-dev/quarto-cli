/*
 * typst.ts
 *
 * Copyright (C) 2020-2024 Posit Software, PBC
 */

import { Builtins, Command, Option } from "npm:clipanion";
import { error } from "../../deno_ral/log.ts";
import { execProcess } from "../../core/process.ts";
import { typstBinaryPath } from "../../core/typst.ts";

export class TypstCommand extends Command {
  static name = 'typst';
  static paths = [[TypstCommand.name]];

  static usage = Command.Usage({
    description:
        "Run the version of Typst embedded within Quarto.\n\n" +
        "You can pass arbitrary command line arguments to quarto typst (they will\n" +
        "be passed through unmodified to Typst)",
    examples: [
      [
        "Compile Typst to PDF",
        `$0 ${TypstCommand.name} compile document.typ`,
      ],
      [
        "List all discovered fonts in system and custom font paths",
        `$0 ${TypstCommand.name} fonts`,
      ]
    ]
  });

  args = Option.Proxy();

  async execute() {
    // help command is consumed by Option.Proxy
    // see https://github.com/arcanis/clipanion/issues/88
    const helpFlags = new Set(Builtins.HelpCommand.paths.map(path => path[0]));
    const helpFlagIndex = this.args.findIndex(flag => helpFlags.has(flag));
    if (-1 < helpFlagIndex && helpFlagIndex < [...this.args, '--'].indexOf('--')) {
      this.context.stdout.write(this.cli.usage(TypstCommand, {detailed: true}));
      return;
    }

    if (this.args[0] === "update") {
      error(
          "The 'typst update' command is not supported.\n" +
          "Please install the latest version of Quarto from http://quarto.org to get the latest supported typst features.",
      );
      Deno.exit(1);
    }
    const { env } = this.context;
    const result = await execProcess({
      cmd: [typstBinaryPath(), ...this.args],
      env: env as Record<string, string>,
    });
    Deno.exit(result.code);
  }
}
