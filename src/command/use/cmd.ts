/*
 * cmd.ts
 *
 * Copyright (C) 2021-2022 Posit Software, PBC
 */
import { Command, ValidationError } from "cliffy/command/mod.ts";

import { useTemplateCommand } from "./commands/template.ts";
import { useDevContainerCommand } from "./commands/decontainer.ts";

const kUseCommands = [useTemplateCommand, useDevContainerCommand];

export const makeUseCommand = () => {
  const theCommand = new Command()
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
      const useCommand = kUseCommands.find((command) => {
        return command.getName() === type;
      });

      if (!useCommand) {
        throw new ValidationError(
          `Unknown type '${type}'- did you mean 'template'?`,
        );
      }
    });

  kUseCommands.forEach((command) => {
    theCommand.command(command.getName(), command);
  });
  return theCommand;
};
