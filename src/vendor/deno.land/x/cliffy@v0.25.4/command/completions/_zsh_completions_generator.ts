import { getDescription } from "../_utils.ts";
import type { Command } from "../command.ts";
import type { Argument, Option, TypeDef } from "../types.ts";
import { FileType } from "../types/file.ts";

interface ICompletionAction {
  arg: Argument;
  label: string;
  name: string;
  cmd: string;
}

/** Generates zsh completions script. */
export class ZshCompletionsGenerator {
  private actions: Map<string, ICompletionAction> = new Map();

  /** Generates zsh completions script for given command. */
  public static generate(cmd: Command) {
    return new ZshCompletionsGenerator(cmd).generate();
  }

  private constructor(protected cmd: Command) {}

  /** Generates zsh completions code. */
  private generate(): string {
    const path = this.cmd.getPath();
    const name = this.cmd.getName();
    const version: string | undefined = this.cmd.getVersion()
      ? ` v${this.cmd.getVersion()}`
      : "";

    return `#!/usr/bin/env zsh
# zsh completion support for ${path}${version}

autoload -U is-at-least

# shellcheck disable=SC2154
(( $+functions[__${replaceSpecialChars(name)}_complete] )) ||
function __${replaceSpecialChars(name)}_complete {
  local name="$1"; shift
  local action="$1"; shift
  integer ret=1
  local -a values
  local expl lines
  _tags "$name"
  while _tags; do
    if _requested "$name"; then
      # shellcheck disable=SC2034
      lines="$(${name} completions complete "\${action}" "\${@}")"
      values=("\${(ps:\\n:)lines}")
      if (( \${#values[@]} )); then
        while _next_label "$name" expl "$action"; do
          compadd -S '' "\${expl[@]}" "\${values[@]}"
        done
      fi
    fi
  done
}

${this.generateCompletions(this.cmd).trim()}

# _${replaceSpecialChars(path)} "\${@}"

compdef _${replaceSpecialChars(path)} ${path}`;
  }

  /** Generates zsh completions method for given command and child commands. */
  private generateCompletions(command: Command, path = ""): string {
    if (
      !command.hasCommands(false) && !command.hasOptions(false) &&
      !command.hasArguments()
    ) {
      return "";
    }

    path = (path ? path + " " : "") + command.getName();

    return `# shellcheck disable=SC2154
(( $+functions[_${replaceSpecialChars(path)}] )) ||
function _${replaceSpecialChars(path)}() {` +
      (!command.getParent()
        ? `
  local state`
        : "") +
      this.generateCommandCompletions(command, path) +
      this.generateSubCommandCompletions(command, path) +
      this.generateArgumentCompletions(command, path) +
      this.generateActions(command) +
      `\n}\n\n` +
      command.getCommands(false)
        .filter((subCommand: Command) => subCommand !== command)
        .map((subCommand: Command) =>
          this.generateCompletions(subCommand, path)
        )
        .join("");
  }

  private generateCommandCompletions(command: Command, path: string): string {
    const commands = command.getCommands(false);

    let completions: string = commands
      .map((subCommand: Command) =>
        `'${subCommand.getName()}:${
          subCommand.getShortDescription()
            // escape single quotes
            .replace(/'/g, "'\"'\"'")
        }'`
      )
      .join("\n      ");

    if (completions) {
      completions = `
    local -a commands
    # shellcheck disable=SC2034
    commands=(
      ${completions}
    )
    _describe 'command' commands`;
    }

    // only complete first argument, rest arguments are completed with _arguments.
    if (command.hasArguments()) {
      const completionsPath: string = path.split(" ").slice(1).join(" ");
      const arg: Argument = command.getArguments()[0];
      const action = this.addAction(arg, completionsPath);
      if (action && command.getCompletion(arg.action)) {
        completions += `\n    __${
          replaceSpecialChars(this.cmd.getName())
        }_complete ${action.arg.name} ${action.arg.action} ${action.cmd}`;
      }
    }

    if (completions) {
      completions = `\n\n  function _commands() {${completions}\n  }`;
    }

    return completions;
  }

  private generateSubCommandCompletions(
    command: Command,
    path: string,
  ): string {
    if (command.hasCommands(false)) {
      const actions: string = command
        .getCommands(false)
        .map((command: Command) =>
          `${command.getName()}) _${
            replaceSpecialChars(path + " " + command.getName())
          } ;;`
        )
        .join("\n      ");

      return `\n
  function _command_args() {
    case "\${words[1]}" in\n      ${actions}\n    esac
  }`;
    }

    return "";
  }

  private generateArgumentCompletions(command: Command, path: string): string {
    /* clear actions from previously parsed command. */
    this.actions.clear();

    const options: string[] = this.generateOptions(command, path);

    let argIndex = 0;
    // @TODO: add stop early option: -A "-*"
    // http://zsh.sourceforge.net/Doc/Release/Completion-System.html
    let argsCommand = "\n\n  _arguments -w -s -S -C";

    if (command.hasOptions()) {
      argsCommand += ` \\\n    ${options.join(" \\\n    ")}`;
    }

    if (
      command.hasCommands(false) || (
        command.getArguments()
          .filter((arg) => command.getCompletion(arg.action)).length
      )
    ) {
      argsCommand += ` \\\n    '${++argIndex}:command:_commands'`;
    }

    if (command.hasArguments() || command.hasCommands(false)) {
      const args: string[] = [];

      // first argument is completed together with commands.
      for (const arg of command.getArguments().slice(1)) {
        const type = command.getType(arg.type);
        if (type && type.handler instanceof FileType) {
          const fileCompletions = this.getFileCompletions(type);
          if (arg.variadic) {
            argIndex++;
            for (let i = 0; i < 5; i++) {
              args.push(
                `${argIndex + i}${
                  arg.optionalValue ? "::" : ":"
                }${arg.name}:${fileCompletions}`,
              );
            }
          } else {
            args.push(
              `${++argIndex}${
                arg.optionalValue ? "::" : ":"
              }${arg.name}:${fileCompletions}`,
            );
          }
        } else {
          const completionsPath: string = path.split(" ").slice(1).join(" ");
          const action = this.addAction(arg, completionsPath);
          args.push(
            `${++argIndex}${
              arg.optionalValue ? "::" : ":"
            }${arg.name}:->${action.name}`,
          );
        }
      }

      argsCommand += args.map((arg: string) => `\\\n    '${arg}'`).join("");

      if (command.hasCommands(false)) {
        argsCommand += ` \\\n    '*::sub command:->command_args'`;
      }
    }

    return argsCommand;
  }

  private generateOptions(command: Command, path: string) {
    const options: string[] = [];
    const cmdArgs: string[] = path.split(" ");
    const _baseName: string = cmdArgs.shift() as string;
    const completionsPath: string = cmdArgs.join(" ");

    const excludedFlags: string[] = command.getOptions(false)
      .map((option) => option.standalone ? option.flags : false)
      .flat()
      .filter((flag) => typeof flag === "string") as string[];

    for (const option of command.getOptions(false)) {
      options.push(
        this.generateOption(command, option, completionsPath, excludedFlags),
      );
    }

    return options;
  }

  private generateOption(
    command: Command,
    option: Option,
    completionsPath: string,
    excludedOptions: string[],
  ): string {
    let excludedFlags = option.conflicts?.length
      ? [
        ...excludedOptions,
        ...option.conflicts.map((opt) => "--" + opt.replace(/^--/, "")),
      ]
      : excludedOptions;
    excludedFlags = option.collect ? excludedFlags : [
      ...excludedFlags,
      ...option.flags,
    ];

    let args = "";
    for (const arg of option.args) {
      const type = command.getType(arg.type);
      if (type && type.handler instanceof FileType) {
        const fileCompletions = this.getFileCompletions(type);
        args += `${
          arg.optionalValue ? "::" : ":"
        }${arg.name}:${fileCompletions}`;
      } else {
        const action = this.addAction(arg, completionsPath);
        args += `${arg.optionalValue ? "::" : ":"}${arg.name}:->${action.name}`;
      }
    }

    const description: string = getDescription(option.description, true)
      // escape brackets and quotes
      .replace(/\[/g, "\\[")
      .replace(/]/g, "\\]")
      .replace(/"/g, '\\"')
      .replace(/'/g, "'\"'\"'");

    const collect: string = option.collect ? "*" : "";
    const equalsSign = option.equalsSign ? "=" : "";
    const flags = option.flags.map((flag) => `${flag}${equalsSign}`).join(",");

    if (option.standalone) {
      return `'(- *)'{${collect}${flags}}'[${description}]${args}'`;
    } else {
      const excluded: string = excludedFlags.length
        ? `'(${excludedFlags.join(" ")})'`
        : "";
      if (collect || flags.length > 1) {
        return `${excluded}{${collect}${flags}}'[${description}]${args}'`;
      } else {
        return `${excluded}${flags}'[${description}]${args}'`;
      }
    }
  }

  private getFileCompletions(type: TypeDef) {
    if (!(type.handler instanceof FileType)) {
      return "";
    }
    return "_files";
    // const fileOpts = type.handler.getOptions();
    // let fileCompletions = "_files";
    // if (fileOpts.dirsOnly) {
    //   fileCompletions += " -/";
    // }
    // if (fileOpts.pattern) {
    //   fileCompletions += ' -g "' + fileOpts.pattern + '"';
    // }
    // if (fileOpts.ignore) {
    //   fileCompletions += " -F " + fileOpts.ignore;
    // }
    // return fileCompletions;
  }

  private addAction(arg: Argument, cmd: string): ICompletionAction {
    const action = `${arg.name}-${arg.action}`;

    if (!this.actions.has(action)) {
      this.actions.set(action, {
        arg: arg,
        label: `${arg.name}: ${arg.action}`,
        name: action,
        cmd,
      });
    }

    return this.actions.get(action) as ICompletionAction;
  }

  private generateActions(command: Command): string {
    let actions: string[] = [];

    if (this.actions.size) {
      actions = Array
        .from(this.actions)
        .map(([name, action]) =>
          `${name}) __${
            replaceSpecialChars(this.cmd.getName())
          }_complete ${action.arg.name} ${action.arg.action} ${action.cmd} ;;`
        );
    }

    if (command.hasCommands(false)) {
      actions.unshift(`command_args) _command_args ;;`);
    }

    if (actions.length) {
      return `\n\n  case "$state" in\n    ${actions.join("\n    ")}\n  esac`;
    }

    return "";
  }
}

function replaceSpecialChars(str: string): string {
  return str.replace(/[^a-zA-Z0-9]/g, "_");
}
