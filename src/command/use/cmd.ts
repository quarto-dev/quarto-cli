/*
* cmd.ts
*
* Copyright (C) 2021-2022 Posit Software, PBC
*
*/
import { Command, ValidationError } from "cliffy/command/mod.ts";
import { greet } from "../greet.ts";

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
  .action((_options, type, _target) => {
    greet();
    if (type !== useTemplateCommand.getName()) {
      throw new ValidationError(
        `Unknown type '${type}'- did you mean 'template'?`,
      );
    }
  })
  .command(useTemplateCommand.getName(), useTemplateCommand);
