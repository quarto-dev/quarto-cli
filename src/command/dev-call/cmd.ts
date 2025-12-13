import { Command } from "cliffy/command/mod.ts";
import { quartoConfig } from "../../core/quarto.ts";
import { commands } from "../command.ts";
import { buildJsCommand } from "./build-artifacts/cmd.ts";
import { validateYamlCommand } from "./validate-yaml/cmd.ts";
import { showAstTraceCommand } from "./show-ast-trace/cmd.ts";
import { makeAstDiagramCommand } from "./make-ast-diagram/cmd.ts";
import { pullGitSubtreeCommand } from "./pull-git-subtree/cmd.ts";

type CommandOptionInfo = {
  name: string;
  description: string;
  args: [];
  flags: string[];
  equalsSign: boolean;
  typeDefinition: string;
};

type CommandInfo = {
  hidden: boolean;
  name: string;
  description: string;
  options: CommandOptionInfo[];
  // arguments: string[];
  // subcommands: CommandInfo[];
  // aliases: string[];
  examples: { name: string; description: string }[];
  // flags: string[];
  usage: string;
  commands: CommandInfo[];
};

const generateCliInfoCommand = new Command()
  .name("cli-info")
  .description("Generate JSON information about the Quarto CLI.")
  .action(async () => {
    const output: Record<string, unknown> = {};
    output["version"] = quartoConfig.version();
    const commandsInfo: CommandInfo[] = [];
    output["commands"] = commandsInfo;

    // Cliffy doesn't export the "hidden" property, so we maintain our own list
    // here
    const hiddenCommands = [
      "dev-call",
      "editor-support",
      "create-project",
    ];
    // deno-lint-ignore no-explicit-any
    const cmdAsJson = (cmd: any): CommandInfo => {
      return {
        name: cmd.getName(),
        hidden: hiddenCommands.includes(cmd.getName()),
        description: cmd.getDescription(),
        options: cmd.getOptions(),
        usage: cmd.getUsage(),
        examples: cmd.getExamples(),
        commands: cmd.getCommands().map(cmdAsJson),
      };
    };
    output["commands"] = commands().map(cmdAsJson);
    console.log(JSON.stringify(output, null, 2));
  });

export const devCallCommand = new Command()
  .name("dev-call")
  .hidden()
  .description(
    "Access internals of Quarto - this command is not intended for general use.",
  )
  .action(() => {
    devCallCommand.showHelp();
    Deno.exit(1);
  })
  .command("cli-info", generateCliInfoCommand)
  .command("validate-yaml", validateYamlCommand)
  .command("build-artifacts", buildJsCommand)
  .command("show-ast-trace", showAstTraceCommand)
  .command("make-ast-diagram", makeAstDiagramCommand)
  .command("pull-git-subtree", pullGitSubtreeCommand);
