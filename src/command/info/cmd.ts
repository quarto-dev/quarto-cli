/*
* cmd.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { Command } from "cliffy/command/mod.ts";
import { info } from "log/mod.ts";
import { installableTools, printToolInfo } from "../../tools/tools.ts";

// The quarto install command
export const infoCommand = new Command()
  .name("info")
  .hidden()
  .arguments("<type:string> [target:string]")
  .description(
    `Output information about quarto tools.`,
  )
  .example(
    "Show status of TinyTeX",
    "quarto info tool tinytex",
  )
  // deno-lint-ignore no-explicit-any
  .action(async (_options: any, type: string, target?: string) => {
    switch (type) {
      case "tool":
        if (target && installableTools().includes(target)) {
          await printToolInfo(target);
        } else {
          info(
            `Please provide a tool name for which you'd like the status. Use one of:\n  ${
              installableTools().join("\n  ")
            }`,
          );
        }
        break;
    }
  });
