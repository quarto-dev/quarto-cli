/*
* cmd.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { Command } from "cliffy/command/mod.ts";

import { installTool } from "./install.ts";

export const installCommand = new Command()
  .name("install")
  .arguments("[name:string]")
  .description("Installs tools, extensions, and templates")
  .example(
    "Install TinyTex",
    "quarto install tinytex",
  )
  // deno-lint-ignore no-explicit-any
  .action(async (_options: any, name: string) => {
    await installTool(name);
  });
