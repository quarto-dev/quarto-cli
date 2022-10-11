import {
  ArgumentFollowsVariadicArgument,
  RequiredArgumentFollowsOptionalArgument,
} from "../flags/_errors.ts";
import { didYouMean } from "../flags/_utils.ts";
import { OptionType } from "../flags/types.ts";
import type { Command } from "./command.ts";
import type { IArgument } from "./types.ts";

export function didYouMeanCommand(
  command: string,
  commands: Array<Command>,
  excludes: Array<string> = [],
): string {
  const commandNames = commands
    .map((command) => command.getName())
    .filter((command) => !excludes.includes(command));
  return didYouMean(" Did you mean command", command, commandNames);
}

const ARGUMENT_REGEX = /^[<\[].+[\]>]$/;
const ARGUMENT_DETAILS_REGEX = /[<\[:>\]]/;

interface SplitArgumentsResult {
  flags: string[];
  typeDefinition: string;
  equalsSign: boolean;
}

/**
 * Split options and arguments.
 * @param args Arguments definition: `--color, -c <color1:string> <color2:string>`
 *
 * For example: `-c, --color <color1:string> <color2:string>`
 *
 * Will result in:
 * ```
 * {
 *   flags: [ "-c", "--color" ],
 *   typeDefinition: "<color1:string> <color2:string>"
 * }
 * ```
 */
export function splitArguments(
  args: string,
): SplitArgumentsResult {
  const parts = args.trim().split(/[, =] */g);
  const typeParts = [];

  while (
    parts[parts.length - 1] &&
    ARGUMENT_REGEX.test(parts[parts.length - 1])
  ) {
    typeParts.unshift(parts.pop());
  }

  const typeDefinition: string = typeParts.join(" ");

  return { flags: parts, typeDefinition, equalsSign: args.includes("=") };
}

/**
 * Parse arguments string.
 * @param argsDefinition Arguments definition: `<color1:string> <color2:string>`
 */
export function parseArgumentsDefinition<T extends boolean>(
  argsDefinition: string,
  validate: boolean,
  all: true,
): Array<IArgument | string>;
export function parseArgumentsDefinition<T extends boolean>(
  argsDefinition: string,
  validate?: boolean,
  all?: false,
): Array<IArgument>;
export function parseArgumentsDefinition<T extends boolean>(
  argsDefinition: string,
  validate = true,
  all?: T,
): T extends true ? Array<IArgument | string> : Array<IArgument> {
  const argumentDetails: Array<IArgument | string> = [];

  let hasOptional = false;
  let hasVariadic = false;
  const parts: string[] = argsDefinition.split(/ +/);

  for (const arg of parts) {
    if (validate && hasVariadic) {
      throw new ArgumentFollowsVariadicArgument(arg);
    }
    const parts: string[] = arg.split(ARGUMENT_DETAILS_REGEX);

    if (!parts[1]) {
      if (all) {
        argumentDetails.push(parts[0]);
      }
      continue;
    }
    const type: string | undefined = parts[2] || OptionType.STRING;

    const details: IArgument = {
      optionalValue: arg[0] === "[",
      requiredValue: arg[0] === "<",
      name: parts[1],
      action: parts[3] || type,
      variadic: false,
      list: type ? arg.indexOf(type + "[]") !== -1 : false,
      type,
    };

    if (validate && !details.optionalValue && hasOptional) {
      throw new RequiredArgumentFollowsOptionalArgument(details.name);
    }

    if (arg[0] === "[") {
      hasOptional = true;
    }

    if (details.name.length > 3) {
      const istVariadicLeft = details.name.slice(0, 3) === "...";
      const istVariadicRight = details.name.slice(-3) === "...";

      hasVariadic = details.variadic = istVariadicLeft || istVariadicRight;

      if (istVariadicLeft) {
        details.name = details.name.slice(3);
      } else if (istVariadicRight) {
        details.name = details.name.slice(0, -3);
      }
    }

    argumentDetails.push(details);
  }

  return argumentDetails as (
    T extends true ? Array<IArgument | string> : Array<IArgument>
  );
}

export function dedent(str: string): string {
  const lines = str.split(/\r?\n|\r/g);
  let text = "";
  let indent = 0;

  for (const line of lines) {
    if (text || line.trim()) {
      if (!text) {
        text = line.trimStart();
        indent = line.length - text.length;
      } else {
        text += line.slice(indent);
      }
      text += "\n";
    }
  }

  return text.trimEnd();
}

export function getDescription(
  description: string,
  short?: boolean,
): string {
  return short ? description.trim().split("\n", 1)[0] : dedent(description);
}
