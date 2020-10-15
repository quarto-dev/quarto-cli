import {
  Command,
  CompletionsCommand,
  HelpCommand,
} from "cliffy/command/mod.ts";

import { commands } from "./command/command.ts";
import { logError } from "./core/log.ts";

export async function quarto(args: string[]) {
  const quartoCommand = new Command()
    .name("quarto")
    .version("0.1")
    .description("Quarto CLI");

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
    await quarto(Deno.args);
  } catch (error) {
    logError(error.toString());
    Deno.exit(1);
  }
}
