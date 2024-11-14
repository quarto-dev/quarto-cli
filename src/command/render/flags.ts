/*
 * flags.ts
 *
 * Copyright (C) 2020-2024 Posit Software, PBC
 */
import { readYaml, readYamlFromString } from "../../core/yaml.ts";

import { mergeConfigs } from "../../core/config.ts";

import {
  kAuthor,
  kDate,
} from "../../config/constants.ts";
import { RenderOptions } from "./types.ts";

import * as ld from "../../core/lodash.ts";

import { removeFlags } from "../../core/flags.ts";

export const kStdOut = "-";


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

export const kQuartoForwardedMetadataFields = [kAuthor, kDate];

export function parseMetadataFlagValue(
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
