import { Command } from "cliffy/command/mod.ts";
import { engineCommand } from "./engine-cmd.ts";
import { buildTsExtensionCommand } from "./build-ts-extension/cmd.ts";
import { typstGatherCommand } from "./typst-gather/cmd.ts";
import { axeCommand } from "./axe/cmd.ts";

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
  .command("build-ts-extension", buildTsExtensionCommand)
  .command("typst-gather", typstGatherCommand)
  // hidden while experimental: invocable, not advertised in `quarto call` help
  .command("axe", axeCommand);
