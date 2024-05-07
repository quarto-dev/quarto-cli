/*
 * cmd.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { Command } from "cliffy/command/mod.ts";
import {
  outputTools,
  removeTool,
  updateOrInstallTool,
} from "../../tools/tools-console.ts";
import { printToolInfo } from "../../tools/tools.ts";
import { info } from "../../deno_ral/log.ts";

// The quarto install command
export const toolsCommand = new Command()
  .name("tools")
  .description(
    `Display the status of Quarto installed dependencies`,
  )
  .example(
    "Show tool status",
    "quarto tools",
  )
  // deno-lint-ignore no-explicit-any
  .action(async (_options: any) => {
    await outputTools();
  })
  .command("install <tool:string>").hidden().action(
    async (_options: any, tool: string) => {
      info(
        "This command has been superseded. Please use `quarto install` instead.\n",
      );
      await updateOrInstallTool(
        tool,
        "install",
      );
    },
  )
  .command("info <tool:string>").hidden().action(
    async (_options: any, tool: string) => {
      await printToolInfo(tool);
    },
  )
  .command("uninstall <tool:string>").hidden().action(
    async (_options: any, tool: string) => {
      info(
        "This command has been superseded. Please use `quarto uninstall` instead.\n",
      );
      await removeTool(tool);
    },
  )
  .command("update <tool:string>").hidden().action(
    async (_options: any, tool: string) => {
      info(
        "This command has been superseded. Please use `quarto update` instead.\n",
      );
      await updateOrInstallTool(
        tool,
        "update",
      );
    },
  )
  .command("list").hidden().action(async () => {
    info(
      "This command has been superseded. Please use `quarto tools` with no arguments to list tools and status.\n",
    );
    await outputTools();
  });
