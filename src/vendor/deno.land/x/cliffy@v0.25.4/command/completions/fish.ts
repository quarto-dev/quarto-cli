import { Command } from "../command.ts";
import { dim, italic } from "../deps.ts";
import { FishCompletionsGenerator } from "./_fish_completions_generator.ts";

/** Generates fish completions script. */
export class FishCompletionsCommand extends Command {
  #cmd?: Command;
  public constructor(cmd?: Command) {
    super();
    this.#cmd = cmd;
    return this
      .description(() => {
        const baseCmd = this.#cmd || this.getMainCommand();
        return `Generate shell completions for fish.

To enable fish completions for this program add following line to your ${
          dim(italic("~/.config/fish/config.fish"))
        }:

    ${dim(italic(`source (${baseCmd.getPath()} completions fish | psub)`))}`;
      })
      .noGlobals()
      .action(() => {
        const baseCmd = this.#cmd || this.getMainCommand();
        console.log(FishCompletionsGenerator.generate(baseCmd));
      });
  }
}
