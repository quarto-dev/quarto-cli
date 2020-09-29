import { commands } from "../command/command.ts";

import { Command, CompletionsCommand } from "cliffy/command/mod.ts";

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
