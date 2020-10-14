import { kSelfContained } from "../../config/constants.ts";

export interface RenderFlags {
  to?: string;
  output?: string;
  quiet?: boolean;
  [kSelfContained]?: boolean;
}

export function parseRenderFlags(args: string[]) {
  const flags: RenderFlags = {};

  const argsStack = [...args];
  let arg = argsStack.shift();
  while (arg !== undefined) {
    switch (arg) {
      case "-t":
      case "--to":
        arg = argsStack.shift();
        if (arg && !arg.startsWith("-")) {
          flags.to = arg;
        }
        break;

      case "-o":
      case "--output":
        arg = argsStack.shift();
        if (!arg || arg.startsWith("-")) {
          flags.output = "-";
        } else {
          flags.output = arg;
        }
        break;

      case "--quiet":
        flags.quiet = true;
        arg = argsStack.shift();
        break;

      case "--self-contained":
        flags[kSelfContained] = true;
        arg = argsStack.shift();
        break;

      default:
        arg = argsStack.shift();
        break;
    }
  }

  return flags;
}

// repair 'damage' done to pandoc args by cliffy (e.g. the - after --output is dropped)
export function fixupPandocArgs(pandocArgs: string[], flags: RenderFlags) {
  // --output - gets eaten by cliffy, re-inject it if necessary
  return pandocArgs.reduce((args, arg, index) => {
    args.push(arg);
    if (
      flags.output === "-" &&
      pandocArgs[index + 1] !== "-" &&
      (arg === "-o" || arg === "--output")
    ) {
      args.push("-");
    }
    return args;
  }, new Array<string>());
}
