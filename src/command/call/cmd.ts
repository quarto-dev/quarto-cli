import { Command } from "cliffy/command/mod.ts";
import { engineCommand } from "../../execute/engine.ts";
import { buildTsExtensionCommand } from "./build-ts-extension/cmd.ts";

export const callCommand = new Command()
  .name("call")
  .description(
    "Access functions of Quarto subsystems such as its rendering engines.",
  )
  .action(() => {
    callCommand.showHelp();
    Deno.exit(1);
  })
  .command("engine", engineCommand)
  .command("build-ts-extension", buildTsExtensionCommand);
