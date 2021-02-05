/*
* cmd.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { Command } from "cliffy/command/mod.ts";
import { Confirm } from "cliffy/prompt/mod.ts";

import { installableTools, installTool, uninstallTool } from "./install.ts";

export const installCommand = new Command()
  .name("install")
  .arguments("[name:string]")
  .description(
    `Installs tools, extensions, and templates.\n\nTools that can be installed include:\n${
      installableTools().map((name) => "  " + name).join("\n")
    }`,
  )
  .example(
    "Install TinyTex",
    "quarto install tinytex",
  )
  // deno-lint-ignore no-explicit-any
  .action(async (_options: any, name: string) => {
    await installTool(name);
  });

export const uninstallCommand = new Command()
  .name("uninstall")
  .arguments("[name:string]")
  .description(
    `Uninstalls tools, extensions, and templates.\n\nTools that can be uninstalled include:\n${
      installableTools().map((name) => "  " + name).join("\n")
    }`,
  )
  .example(
    "Uninstall TinyTex",
    "quarto uninstall tinytex",
  )
  // deno-lint-ignore no-explicit-any
  .action(async (_options: any, name: string) => {
    const confirmed: boolean = await Confirm.prompt(
      `Are you sure you want to uninstall ${name}?`,
    );
    if (confirmed) {
      await uninstallTool(name);
    }
  });
