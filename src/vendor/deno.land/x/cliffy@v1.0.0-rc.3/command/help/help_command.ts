import { UnknownCommandError } from "../_errors.ts";
import { Command } from "../command.ts";
import { CommandType } from "../types/command.ts";
import { checkVersion } from "../upgrade/_check_version.ts";

/** Generates well formatted and colored help output for specified command. */
export class HelpCommand
  extends Command<void, void, void, [commandName?: CommandType]> {
  public constructor(cmd?: Command) {
    super();
    return this
      .type("command", new CommandType())
      .arguments("[command:command]")
      .description("Show this help or the help of a sub-command.")
      .noGlobals()
      .action(async (_, name?: string) => {
        if (!cmd) {
          cmd = name
            ? this.getGlobalParent()?.getBaseCommand(name)
            : this.getGlobalParent();
        }
        if (!cmd) {
          const cmds = this.getGlobalParent()?.getCommands();
          throw new UnknownCommandError(name ?? "", cmds ?? [], [
            this.getName(),
            ...this.getAliases(),
          ]);
        }
        await checkVersion(cmd);
        cmd.showHelp();
        if (this.shouldExit()) {
          Deno.exit(0);
        }
      });
  }
}
