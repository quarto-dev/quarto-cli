/*
* flags.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
* Unless you have received this program directly from RStudio pursuant
* to the terms of a commercial license agreement with RStudio, then
* this program is licensed to you under the terms of version 3 of the
* GNU General Public License. This program is distributed WITHOUT
* ANY EXPRESS OR IMPLIED WARRANTY, INCLUDING THOSE OF NON-INFRINGEMENT,
* MERCHANTABILITY OR FITNESS FOR A PARTICULAR PURPOSE. Please refer to the
* GPL (http://www.gnu.org/licenses/gpl-3.0.txt) for more details.
*
*/

import { readYaml } from "../../core/yaml.ts";

import { kSelfContained } from "../../config/constants.ts";
import { PandocFlags } from "../../config/flags.ts";

export const kStdOut = "-";

// command line flags that we need to inspect
export interface RenderFlags extends PandocFlags {
  // quarto flags
  executeCache?: string;
  executeCacheDir?: string;
  executeParams?: string;
  executeDir?: string;
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

      case "--execute-cache":
        arg = argsStack.shift();
        flags.executeCache = arg;
        break;

      case "--execute-cache-dir":
        arg = argsStack.shift();
        flags.executeCacheDir = arg;
        break;

      case "--execute-params":
        arg = argsStack.shift();
        flags.executeParams = arg;
        break;

      case "--execute-root-dir":
        arg = argsStack.shift();
        flags.executeDir = arg;
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
  removeArgs.set("--execute-cache", true);
  removeArgs.set("--execute-cache-dir", true);
  removeArgs.set("--execute-params", true);
  removeArgs.set("--execute-root-dir", true);
  removeArgs.set("--metadata-override", true);
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
