/*
* quarto.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import {
  Command,
  CompletionsCommand,
  HelpCommand,
} from "cliffy/command/mod.ts";

import { commands } from "./command/command.ts";
import { logError } from "./core/log.ts";
import { cleanupSessionTempDir, initSessionTempDir } from "./core/temp.ts";
import { quartoConfig } from "./core/quarto.ts";

export async function quarto(args: string[]) {
  const quartoCommand = new Command()
    .name("quarto")
    .version(quartoConfig.version())
    .description("Quarto CLI")
    .throwErrors();

  commands().forEach((command) => {
    quartoCommand.command(command.getName(), command);
  });

  await quartoCommand
    .command("help", new HelpCommand().global())
    .command("completions", new CompletionsCommand()).hidden()
    .parse(args);
}

if (import.meta.main) {
  try {
    initSessionTempDir();
    await quarto(Deno.args);
    cleanupSessionTempDir();
  } catch (error) {
    if (error) {
      logError(error);
    }
    cleanupSessionTempDir();
    Deno.exit(1);
  }
}
