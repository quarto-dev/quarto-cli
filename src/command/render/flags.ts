/*
* flags.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { readYaml } from "../../core/yaml.ts";

import {
  kListings,
  kNumberOffset,
  kNumberSections,
  kSelfContained,
  kTopLevelDivision,
} from "../../config/constants.ts";
import { PandocFlags } from "../../config/flags.ts";

export const kStdOut = "-";

// command line flags that we need to inspect
export interface RenderFlags extends PandocFlags {
  // quarto flags
  executeParams?: string;
  executeDir?: string;
  execute?: boolean;
  executeCache?: true | false | "refresh";
  debug?: boolean;
  quiet?: boolean;
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
          flags.output = kStdOut;
        } else {
          flags.output = arg;
        }
        break;

      case "--self-contained":
        flags[kSelfContained] = true;
        arg = argsStack.shift();
        break;

      case "--pdf-engine":
        arg = argsStack.shift();
        flags.pdfEngine = arg;
        break;

      case "--pdf-engine-opt":
        arg = argsStack.shift();
        if (arg) {
          flags.pdfEngineOpts = flags.pdfEngineOpts || [];
          flags.pdfEngineOpts.push(arg);
        }
        break;

      case "--natbib":
        arg = argsStack.shift();
        flags.natbib = true;
        break;

      case "--biblatex":
        arg = argsStack.shift();
        flags.biblatex = true;
        break;

      case "--listings":
        arg = argsStack.shift();
        flags[kListings] = true;
        break;

      case "--number-sections":
        arg = argsStack.shift();
        flags[kNumberSections] = true;
        break;

      case "--number-offset":
        arg = argsStack.shift();
        flags[kNumberSections] = true;
        flags[kNumberOffset] = parseNumbers("--number-offset", arg);
        break;

      case "--top-level-division":
        arg = argsStack.shift();
        flags[kTopLevelDivision] = arg;
        break;

      case "--include-in-header":
      case "--include-before-body":
      case "--include-after-body": {
        const include = arg.replace("^--", "");
        const includeFlags = flags as { [key: string]: string[] };
        includeFlags[include] = includeFlags[include] || [];
        arg = argsStack.shift() as string;
        includeFlags[include].push(arg);
        break;
      }

      case "--execute":
        flags.execute = true;
        arg = argsStack.shift();
        break;

      case "--no-execute":
        flags.execute = false;
        arg = argsStack.shift();
        break;

      case "--execute-params":
        arg = argsStack.shift();
        flags.executeParams = arg;
        break;

      case "--execute-root-dir":
        arg = argsStack.shift();
        flags.executeDir = arg;
        break;

      case "--cache":
        arg = argsStack.shift();
        flags.executeCache = true;
        break;

      case "--no-cache":
        arg = argsStack.shift();
        flags.executeCache = false;
        break;

      case "--cache-refresh":
        arg = argsStack.shift();
        flags.executeCache = "refresh";
        break;

      case "--debug":
        flags.debug = true;
        arg = argsStack.shift();
        break;

      case "--quiet":
        flags.quiet = true;
        arg = argsStack.shift();
        break;

      default:
        arg = argsStack.shift();
        break;
    }
  }

  return flags;
}

export function havePandocArg(pandocArgs: string[], arg: string) {
  return pandocArgs.indexOf(arg) !== -1;
}

export function replacePandocArg(
  pandocArgs: string[],
  arg: string,
  value: string,
) {
  const newArgs = [...pandocArgs];
  const argIndex = pandocArgs.indexOf(arg);
  if (argIndex !== -1) {
    newArgs[argIndex + 1] = value;
  } else {
    newArgs.push(arg);
    newArgs.push(value);
  }
  return newArgs;
}

// repair 'damage' done to pandoc args by cliffy (e.g. the - after --output is dropped)
export function fixupPandocArgs(pandocArgs: string[], flags: RenderFlags) {
  // --output - gets eaten by cliffy, re-inject it if necessary
  pandocArgs = pandocArgs.reduce((args, arg, index) => {
    args.push(arg);
    if (
      flags.output === kStdOut &&
      pandocArgs[index + 1] !== kStdOut &&
      (arg === "-o" || arg === "--output")
    ) {
      args.push(kStdOut);
    }
    return args;
  }, new Array<string>());

  // remove other args as needed
  const removeArgs = new Map<string, boolean>();
  removeArgs.set("--execute", false);
  removeArgs.set("--no-execute", false);
  removeArgs.set("--execute-params", true);
  removeArgs.set("--execute-root-dir", true);
  removeArgs.set("--cache", false);
  removeArgs.set("--no-cache", false);
  removeArgs.set("--cache-refresh", false);
  removeArgs.set("--debug", false);
  return removePandocArgs(pandocArgs, removeArgs);
}

export function removePandocArgs(
  pandocArgs: string[],
  removeArgs: Map<string, boolean>,
) {
  let removeNext = false;
  return pandocArgs.reduce((args, arg) => {
    if (!removeArgs.has(arg)) {
      if (!removeNext) {
        args.push(arg);
      }
      removeNext = false;
    } else {
      removeNext = removeArgs.get(arg)!;
    }
    return args;
  }, new Array<string>());
}

// resolve parameters (if any)
export function resolveParams(params?: string) {
  if (params) {
    return readYaml(params) as { [key: string]: unknown };
  } else {
    return undefined;
  }
}

function parseNumbers(flag: string, value?: string): number[] {
  if (value) {
    const numbers = value.split(/,/)
      .map((number) => parseInt(number.trim(), 10))
      .filter((number) => !isNaN(number));
    if (numbers.length > 0) {
      return numbers;
    }
  }

  // didn't parse the numbers
  throw new Error(
    `Invalid value for ${flag} (should be a comma separated list of numbers)`,
  );
}
