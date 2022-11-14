import { Command } from "../command.ts";
import { dim, italic } from "../deps.ts";
import { BashCompletionsGenerator } from "./_bash_completions_generator.ts";

/** Generates bash completions script. */
export class BashCompletionsCommand extends Command {
  #cmd?: Command;
  public constructor(cmd?: Command) {
    super();
    this.#cmd = cmd;
    return this
      .description(() => {
        const baseCmd = this.#cmd || this.getMainCommand();
        return `Generate shell completions for bash.

To enable bash completions for this program add following line to your ${
          dim(italic("~/.bashrc"))
        }:

    ${dim(italic(`source <(${baseCmd.getPath()} completions bash)`))}`;
      })
      .noGlobals()
      .action(() => {
        const baseCmd = this.#cmd || this.getMainCommand();
        console.log(BashCompletionsGenerator.generate(baseCmd));
      });
  }
}
