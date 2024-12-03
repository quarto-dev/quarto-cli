/*
 * cmd.ts
 *
 * Copyright (C) 2021-2022 Posit Software, PBC
 */

import { Command } from "cliffy/command/mod.ts";
import { check, enforceTargetType } from "./check.ts";

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
  .action(async (_options: unknown, targetStr?: string) => {
    targetStr = targetStr || "all";
    await check(enforceTargetType(targetStr));
  });
