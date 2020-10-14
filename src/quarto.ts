import { Command, CompletionsCommand } from "cliffy/command/mod.ts";

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
    .command("completions", new CompletionsCommand())
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
