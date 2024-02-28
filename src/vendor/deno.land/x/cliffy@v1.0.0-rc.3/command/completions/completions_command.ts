import { dim, italic } from "../deps.ts";
import { Command } from "../command.ts";
import { BashCompletionsCommand } from "./bash.ts";
import { CompleteCommand } from "./complete.ts";
import { FishCompletionsCommand } from "./fish.ts";
import { ZshCompletionsCommand } from "./zsh.ts";

/** Generates shell completion scripts for various shells. */
export class CompletionsCommand
  extends Command<void, void, void, [], { name: string }> {
  #cmd?: Command;

  public constructor(cmd?: Command) {
    super();
    this.#cmd = cmd;
    return this
      .description(() => {
        const baseCmd = this.#cmd || this.getMainCommand();
        return `Generate shell completions.

To enable shell completions for this program add the following line to your ${
          dim(italic("~/.bashrc"))
        } or similar:

    ${dim(italic(`source <(${baseCmd.getPath()} completions [shell])`))}

    For more information run ${
          dim(italic(`${baseCmd.getPath()} completions [shell] --help`))
        }
`;
      })
      .noGlobals()
      .action(() => this.showHelp())
      .command("bash", new BashCompletionsCommand(this.#cmd))
      .command("fish", new FishCompletionsCommand(this.#cmd))
      .command("zsh", new ZshCompletionsCommand(this.#cmd))
      .command("complete", new CompleteCommand(this.#cmd))
      .hidden()
      .reset();
  }
}
