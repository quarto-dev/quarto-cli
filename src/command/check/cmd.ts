/*
 * cmd.ts
 *
 * Copyright (C) 2021-2024 Posit Software, PBC
 */

import { error } from "../../deno_ral/log.ts";

import { Command, Option } from "npm:clipanion";
import { check, Target } from "./check.ts";

const kTargets = ["install", "jupyter", "knitr", "versions", "all"];

export class CheckCommand extends Command {
  static name = 'check';
  static paths = [[CheckCommand.name]];

  static usage = Command.Usage({
    description: "Verify correct functioning of Quarto installation.\n\n" +
        "Check specific functionality with argument install, jupyter, knitr, or all.",
    examples: [
      [
        "Check Quarto installation",
        `$0 ${CheckCommand.name} install`,
      ], [
        "Check Jupyter engine",
        `$0 ${CheckCommand.name} jupyter`,
      ], [
        "Check Knitr engine",
        `$0 ${CheckCommand.name} knitr`,
      ], [
        "Check installation and all engines",
        `$0 ${CheckCommand.name} all`,
      ]
    ]
  })

  target = Option.String({ required: false });

  async execute() {
    const target = this.target || "all";
    if (!kTargets.includes(target)) {
      error(
          "Invalid target '" + target + "' (valid targets are " +
          kTargets.join(", ") + ").",
      );
    }
    await check(target as Target);
  }
}
