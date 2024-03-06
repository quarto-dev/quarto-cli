/*
 * flags.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */
import { existsSync } from "fs/mod.ts";

import { readYaml, readYamlFromString } from "../../core/yaml.ts";

import { mergeConfigs } from "../../core/config.ts";

import {
  kAuthor,
  kDate,
  kEmbedResources,
  kListings,
  kNumberOffset,
  kNumberSections,
  kReferenceLocation,
  kSelfContained,
  kShiftHeadingLevelBy,
  kStandalone,
  kTableOfContents,
  kToc,
  kTopLevelDivision,
} from "../../config/constants.ts";
import { isQuartoMetadata } from "../../config/metadata.ts";
import { RenderFlags, RenderOptions } from "./types.ts";

import * as ld from "../../core/lodash.ts";

import { isAbsolute, SEP_PATTERN } from "../../deno_ral/path.ts";
import { normalizePath } from "../../core/path.ts";
import { removeFlags } from "../../core/flags.ts";

export const kStdOut = "-";

export async function parseRenderFlags(args: string[]) {
  const flags: RenderFlags = {};

  const argsStack = [...args];
  let arg = argsStack.shift();
  while (arg !== undefined) {
    // we need to handle equals signs here,
    // because of the way pandoc handles optional arguments
    // see #7868 and #7908.
    const equalSignIndex = arg.indexOf("=");
    if (arg.startsWith("--") && equalSignIndex > 0) {
      argsStack.unshift(arg.slice(equalSignIndex + 1));
      arg = arg.slice(0, equalSignIndex);
    }
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
          // https://github.com/quarto-dev/quarto-cli/issues/2440
          if (arg.match(SEP_PATTERN)) {
            throw new Error(
              "--output option cannot specify a relative or absolute path",
            );
          }
          flags.output = arg;
        }
        break;

      case "--output-dir":
        arg = argsStack.shift();
        flags.outputDir = arg;
        break;

      case "--site-url":
        arg = argsStack.shift();
        flags.siteUrl = arg;
        break;

      case "--standalone":
        flags[kStandalone] = true;
        arg = argsStack.shift();
        break;

      case "--self-contained":
        flags[kSelfContained] = true;
        arg = argsStack.shift();
        break;

      case "--embed-resources":
        flags[kEmbedResources] = true;
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

      case "--latex-makeindex-opt":
        arg = argsStack.shift();
        if (arg) {
          flags.makeIndexOpts = flags.makeIndexOpts || [];
          flags.makeIndexOpts.push(arg);
        }
        break;

      case "--latex-tlmgr-opt":
        arg = argsStack.shift();
        if (arg) {
          flags.tlmgrOpts = flags.tlmgrOpts || [];
          flags.tlmgrOpts.push(arg);
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

      case `--${kToc}`:
      case `--${kTableOfContents}`:
        arg = argsStack.shift();
        flags.toc = true;
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

      case "--shift-heading-level-by":
        arg = argsStack.shift();
        flags[kShiftHeadingLevelBy] = arg;
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

      case "--mathjax":
        flags.mathjax = true;
        arg = argsStack.shift();
        break;

      case "--katex":
        flags.katex = true;
        arg = argsStack.shift();
        break;

      case "--mathml":
        flags.mathml = true;
        arg = argsStack.shift();
        break;

      case "--gladtex":
        flags.gladtex = true;
        arg = argsStack.shift();
        break;

      case "--webtex":
        flags.webtex = true;
        arg = argsStack.shift();
        break;

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
        flags.paramsFile = arg;
        break;

      case "--execute-dir":
        arg = argsStack.shift();
        if (arg) {
          if (isAbsolute(arg)) {
            flags.executeDir = arg;
          } else {
            flags.executeDir = normalizePath(arg);
          }
        }

        break;

      case "--execute-daemon":
        arg = argsStack.shift();
        flags.executeDaemon = parseInt(arg!, 10);
        if (isNaN(flags.executeDaemon)) {
          delete flags.executeDaemon;
        }
        break;

      case "--no-execute-daemon":
        arg = argsStack.shift();
        flags.executeDaemon = 0;
        break;

      case "--execute-daemon-restart":
        arg = argsStack.shift();
        flags.executeDaemonRestart = true;
        break;

      case "--execute-debug":
        arg = argsStack.shift();
        flags.executeDebug = true;
        break;

      case "--use-freezer":
        arg = argsStack.shift();
        flags.useFreezer = true;
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

      case "--clean":
        arg = argsStack.shift();
        flags.clean = true;
        break;

      case "--no-clean":
        arg = argsStack.shift();
        flags.clean = false;
        break;

      case "--debug":
        flags.debug = true;
        arg = argsStack.shift();
        break;

      case "-P":
      case "--execute-param":
        arg = argsStack.shift();
        if (arg) {
          const param = parseMetadataFlagValue(arg);
          if (param) {
            if (param.value !== undefined) {
              flags.params = flags.params || {};
              flags.params[param.name] = param.value;
            }
          }
        }
        break;

      case "-M":
      case "--metadata":
        arg = argsStack.shift();
        if (arg) {
          const metadata = parseMetadataFlagValue(arg);
          if (metadata) {
            if (metadata.value !== undefined) {
              if (isQuartoMetadata(metadata.name)) {
                flags.metadata = flags.metadata || {};
                flags.metadata[metadata.name] = metadata.value;
              } else {
                flags.pandocMetadata = flags.pandocMetadata || {};
                flags.pandocMetadata[metadata.name] = metadata.value;
              }
            }
          }
        }
        break;

      case "--metadata-file":
        arg = argsStack.shift();
        if (arg) {
          if (existsSync(arg)) {
            const metadata =
              (await readYamlFromString(Deno.readTextFileSync(arg))) as Record<
                string,
                unknown
              >;
            flags.metadata = { ...flags.metadata, ...metadata };
            // flags.metadata = mergeConfigs(flags.metadata, metadata); // { ...flags.metadata, ...metadata };
          }
        }
        break;

      case "--reference-location":
        arg = argsStack.shift();
        if (arg) {
          flags[kReferenceLocation] = arg;
        }
        break;

      default:
        arg = argsStack.shift();
        break;
    }
  }

  // re-inject implicit true args (e.g. clean)
  if (flags.clean === undefined) {
    flags.clean = true;
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

export function getPandocArg(
  pandocArgs: string[],
  arg: string,
) {
  const argIndex = pandocArgs.indexOf(arg);
  if (argIndex !== -1 && argIndex + 1 < pandocArgs.length) {
    return pandocArgs[argIndex + 1];
  } else {
    return undefined;
  }
}

export function replacePandocOutputArg(pandocArgs: string[], output: string) {
  if (havePandocArg(pandocArgs, "--output")) {
    return replacePandocArg(pandocArgs, "--output", output);
  } else if (havePandocArg(pandocArgs, "-o")) {
    return replacePandocArg(pandocArgs, "-o", output);
  } else {
    return pandocArgs;
  }
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
  removeArgs.set("--output-dir", true);
  removeArgs.set("--site-url", true);
  removeArgs.set("--execute", false);
  removeArgs.set("--no-execute", false);
  removeArgs.set("-P", true);
  removeArgs.set("--execute-param", true);
  removeArgs.set("--execute-params", true);
  removeArgs.set("--execute-dir", true);
  removeArgs.set("--execute-daemon", true);
  removeArgs.set("--no-execute-daemon", false);
  removeArgs.set("--execute-daemon-restart", false);
  removeArgs.set("--execute-debug", false);
  removeArgs.set("--use-freezer", false);
  removeArgs.set("--cache", false);
  removeArgs.set("--no-cache", false);
  removeArgs.set("--cache-refresh", false);
  removeArgs.set("--clean", false);
  removeArgs.set("--no-clean", false);
  removeArgs.set("--debug", false);
  removeArgs.set("--metadata-file", true);
  removeArgs.set("--latex-makeindex-opt", true);
  removeArgs.set("--latex-tlmgr-opt", true);
  removeArgs.set("--log", true);
  removeArgs.set("--l", true);
  removeArgs.set("--log-level", true);
  removeArgs.set("--ll", true);
  removeArgs.set("--log-format", true);
  removeArgs.set("--lf", true);
  removeArgs.set("--quiet", false);
  removeArgs.set("--q", false);
  removeArgs.set("--profile", true);

  // Remove un-needed pandoc args (including -M/--metadata as appropriate)
  pandocArgs = removePandocArgs(pandocArgs, removeArgs);
  return removeQuartoMetadataFlags(pandocArgs);
}

export function removePandocArgs(
  pandocArgs: string[],
  removeArgs: Map<string, boolean>,
) {
  return removeFlags(pandocArgs, removeArgs);
}

export function removePandocToArg(args: string[]) {
  const removeArgs = new Map<string, boolean>();
  removeArgs.set("--to", true);
  removeArgs.set("-t", true);
  return removePandocArgs(args, removeArgs);
}

export function removePandocTo(renderOptions: RenderOptions) {
  renderOptions = ld.cloneDeep(renderOptions);
  delete renderOptions.flags?.to;
  if (renderOptions.pandocArgs) {
    renderOptions.pandocArgs = removePandocToArg(renderOptions.pandocArgs);
  }
  return renderOptions;
}

function removeQuartoMetadataFlags(pandocArgs: string[]) {
  const args: string[] = [];
  for (let i = 0; i < pandocArgs.length; i++) {
    const arg = pandocArgs[i];
    if (arg === "--metadata" || arg === "-M") {
      const flagValue = parseMetadataFlagValue(pandocArgs[i + 1] || "");
      if (
        flagValue !== undefined && (isQuartoMetadata(flagValue.name) ||
          kQuartoForwardedMetadataFields.includes(flagValue.name))
      ) {
        i++;
      } else {
        args.push(arg);
      }
    } else {
      args.push(arg);
    }
  }
  return args;
}
export const kQuartoForwardedMetadataFields = [kAuthor, kDate];

function parseMetadataFlagValue(
  arg: string,
): { name: string; value: unknown } | undefined {
  const match = arg.match(/^([^=:]+)[=:](.*)$/);
  if (match) {
    return { name: match[1], value: readYamlFromString(match[2]) };
  }
  return undefined;
}

// resolve parameters (if any)
export function resolveParams(
  params?: { [key: string]: unknown },
  paramsFile?: string,
) {
  if (params || paramsFile) {
    params = params || {};
    if (paramsFile) {
      params = mergeConfigs(
        readYaml(paramsFile) as { [key: string]: unknown },
        params,
      );
    }
    return params;
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
