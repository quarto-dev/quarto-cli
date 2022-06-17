/*
* cmd.ts
*
* Copyright (C) 2021 by RStudio, PBC
*
*/
import { Command } from "cliffy/command/mod.ts";

import { useTemplateCommand } from "./commands/template.ts";

export const useCommand = new Command()
  .hidden()
  .name("use")
  .arguments("<type:string> [target:string]")
  .option(
    "--no-prompt",
    "Do not prompt to confirm actions",
  )
  .description(
    "Automate document or project setup tasks.",
  )
  .command(useTemplateCommand.getName(), useTemplateCommand);
