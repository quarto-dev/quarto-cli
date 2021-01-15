/*
* flags.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { parse } from "encoding/yaml.ts";
import { readYaml } from "../../core/yaml.ts";

import {
  kExecutionDefaultsKeys,
  kListings,
  kMetadataFormat,
  kNumberOffset,
  kNumberSections,
  kPandocDefaultsKeys,
  kRenderDefaultsKeys,
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
  kernelKeepalive?: number;
  kernelRestart?: boolean;
  kernelDebug?: boolean;
  metadata?: { [key: string]: unknown };
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

      case "--kernel-keepalive":
        arg = argsStack.shift();
        flags.kernelKeepalive = parseInt(arg!, 10);
        if (isNaN(flags.kernelKeepalive)) {
          delete flags.kernelKeepalive;
        }
        break;

      case "--no-kernel-keepalive":
        arg = argsStack.shift();
        flags.kernelKeepalive = 0;
        break;

      case "--kernel-restart":
        arg = argsStack.shift();
        flags.kernelRestart = true;
        break;

      case "--kernel-debug":
        arg = argsStack.shift();
        flags.kernelDebug = true;
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

      case "-M":
      case "--metadata":
        arg = argsStack.shift();
        if (arg) {
          const metadata = parseMetadataFlagValue(arg);
          if (metadata) {
            if (isQuartoArg(metadata.name) && metadata.value !== undefined) {
              flags.metadata = flags.metadata || {};
              flags.metadata[metadata.name] = metadata.value;
            }
          }
        }
        break;

      default:
        arg = argsStack.shift();
        break;
    }
  }

  // provide some defaults if necessary (based on environment and/or config)

  // kernel keepalive of 5 mintues for interactive sessions
  if (flags.kernelKeepalive === undefined) {
    const isInteractive = Deno.isatty(Deno.stderr.rid) ||
      !!Deno.env.get("RSTUDIO_VERSION");
    if (isInteractive) {
      flags.kernelKeepalive = 300;
    } else {
      flags.kernelKeepalive = 0;
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
  removeArgs.set("--kernel-keepalive", true);
  removeArgs.set("--no-kernel-keepalive", false);
  removeArgs.set("--kernel-restart", false);
  removeArgs.set("--kernel-debug", false);
  removeArgs.set("--cache", false);
  removeArgs.set("--no-cache", false);
  removeArgs.set("--cache-refresh", false);
  removeArgs.set("--debug", false);

  // Remove un-needed pandoc args (including -M/--metadata as appropriate)
  pandocArgs = removePandocArgs(pandocArgs, removeArgs);
  return removeQuartoMetadataFlags(pandocArgs);
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

function removeQuartoMetadataFlags(pandocArgs: string[]) {
  let metadataFlag: string | undefined = undefined;
  return pandocArgs.reduce((args, arg) => {
    // If this is a metadata flag, capture it and continue to read its value
    // we can determine whether to remove it
    if (arg === "--metadata" || arg === "-M") {
      metadataFlag = arg;
    }

    // We're reading the value of the metadata flag
    if (metadataFlag) {
      const flagValue = parseMetadataFlagValue(arg);
      if (flagValue !== undefined) {
        if (!isQuartoArg(flagValue.name)) {
          // Allow this value through since it isn't Quarto specific
          args.push(metadataFlag);
          args.push(arg);
        }
      }
    }
    return args;
  }, new Array<string>());
}

function isQuartoArg(arg: string) {
  return kRenderDefaultsKeys.includes(arg) ||
    kExecutionDefaultsKeys.includes(arg) ||
    kPandocDefaultsKeys.includes(arg);
}

function parseMetadataFlagValue(
  arg: string,
): { name: string; value: unknown } | undefined {
  const match = arg.match(/^([^=:]+)[=:](.*)$/);
  if (match) {
    return { name: match[1], value: parse(match[2]) };
  }
  return undefined;
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
