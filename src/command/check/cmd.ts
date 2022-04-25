/*
* cmd.ts
*
* Copyright (C) 2021 by RStudio, PBC
*
*/

import { error } from "log/mod.ts";

import { Command } from "cliffy/command/mod.ts";
import { check, Target } from "./check.ts";

const kTargets = ["install", "jupyter", "knitr", "all"];

export const checkCommand = new Command()
  .name("check")
  .arguments("[target:string]")
  .description(
    "Verify correct functioning of Quarto installation.\n\n" +
      "Check specific functionality with argument install, jupyter, knitr, or all.",
  )
  .example("Check Quarto installation", "quarto check install")
  .example("Check Jupyter engine", "quarto check jupyter")
  .example("Check Knitr engine", "quarto check knitr")
  .example("Check installation and all engines", "quarto check all")
  .action(async (_options: unknown, target?: string) => {
    target = target || "all";
    if (!kTargets.includes(target)) {
      error(
        "Invalid target '" + target + "' (valid targets are " +
          kTargets.join(", ") + ").",
      );
    }
    await check(target as Target);
  });
