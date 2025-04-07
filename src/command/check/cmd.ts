/*
 * cmd.ts
 *
 * Copyright (C) 2021-2022 Posit Software, PBC
 */

import { Command } from "cliffy/command/mod.ts";
import { check, enforceTargetType } from "./check.ts";

export const checkCommand = new Command()
  .name("check")
  .option("--output <path>", "Output as JSON to a file")
  .option(
    "--no-strict",
    "When set, will not fail if dependency versions don't match precisely",
  )
  .arguments("[target:string]")
  .description(
    "Verify correct functioning of Quarto installation.\n\n" +
      "Check specific functionality with argument install, jupyter, knitr, or all.",
  )
  .example("Check Quarto installation", "quarto check install")
  .example("Check Jupyter engine", "quarto check jupyter")
  .example("Check Knitr engine", "quarto check knitr")
  .example("Check installation and all engines", "quarto check all")
  // deno-lint-ignore no-explicit-any
  .action(async (options: any, targetStr?: string) => {
    targetStr = targetStr || "all";
    await check(
      enforceTargetType(targetStr),
      options.strict,
      options.output,
    );
  });
