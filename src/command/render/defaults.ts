/*
* defaults.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { extname } from "path/mod.ts";
import { stringify } from "encoding/yaml.ts";

import { FormatPandoc } from "../../config/types.ts";
import { isLatexOutput } from "../../config/format.ts";

import {
  kFilters,
  kFrom,
  kIncludeAfterBody,
  kIncludeBeforeBody,
  kIncludeInHeader,
  kNumberDepth,
  kOutputFile,
  kSelfContained,
  kStandalone,
  kTemplate,
  kTo,
} from "../../config/constants.ts";

import { kPatchedTemplateExt } from "./template.ts";
import { PandocOptions } from "./types.ts";
import { crossrefFilter } from "./crossref.ts";
import { layoutFilter } from "./layout.ts";
import {
  quartoFinalizeFilter,
  quartoPostFilter,
  quartoPreFilter,
  resolveFilters,
} from "./filters.ts";
import { TempContext } from "../../core/temp.ts";
import { authorsFilter } from "./authors.ts";

export function generateDefaults(
  options: PandocOptions,
): Promise<FormatPandoc | undefined> {
  let allDefaults: FormatPandoc | undefined;

  if (options.format.pandoc) {
    allDefaults = options.format.pandoc || {};

    // resolve filters
    const resolvedFilters = resolveFilters(
      [
        ...(allDefaults[kFilters] || []),
      ],
      options,
    );
    if (resolvedFilters) {
      allDefaults[kFilters] = resolvedFilters;
    }

    // If we're rendering Latex, forward the number-depth to pandoc (it handles numbering)
    if (isLatexOutput(options.format.pandoc)) {
      if (options.format.metadata[kNumberDepth] !== undefined) {
        allDefaults.variables = allDefaults.variables || {};
        allDefaults.variables["secnumdepth"] =
          options.format.metadata[kNumberDepth];
      }
    }

    return Promise.resolve(allDefaults);
  } else {
    return Promise.resolve(undefined);
  }
}

export async function writeDefaultsFile(
  defaults: FormatPandoc,
  temp: TempContext,
) {
  const defaultsStr = "---\n" +
    stringify(defaults as Record<string, unknown>, {
      indent: 2,
      sortKeys: false,
      skipInvalid: true,
    });
  const defaultsFile = temp.createFile(
    { prefix: "quarto-defaults", suffix: ".yml" },
  );
  await Deno.writeTextFile(defaultsFile, defaultsStr);
  return defaultsFile;
}

export function pandocDefaultsMessage(
  pandoc: FormatPandoc,
  sysFilters: string[],
  debug?: boolean,
) {
  const kDebugOnly = [
    kIncludeInHeader,
    kIncludeBeforeBody,
    kIncludeAfterBody,
  ];
  const kOrder = [
    kTo,
    kFrom,
    kOutputFile,
    kTemplate,
    kStandalone,
    kSelfContained,
  ];
  const defaults: FormatPandoc = {};
  kOrder.forEach((key) => {
    if (Object.keys(pandoc).includes(key)) {
      // deno-lint-ignore no-explicit-any
      (defaults as any)[key] = (pandoc as any)[key];
    }
  });
  Object.keys(pandoc).forEach((key) => {
    if (!kOrder.includes(key) && (debug || !kDebugOnly.includes(key))) {
      // deno-lint-ignore no-explicit-any
      (defaults as any)[key] = (pandoc as any)[key];
    }
  });

  // simplify crossref filter
  if (defaults.filters?.length) {
    defaults.filters = defaults.filters
      .map((filter) => {
        if (filter === crossrefFilter()) {
          return "crossref";
        } else {
          return filter;
        }
      })
      .filter((filter) => {
        return filter !== quartoPreFilter() &&
          filter !== quartoPostFilter() &&
          filter !== layoutFilter() &&
          filter !== authorsFilter() &&
          filter !== quartoFinalizeFilter() &&
          !sysFilters.includes(filter);
      });
    if (defaults.filters?.length === 0) {
      delete defaults.filters;
    }
  }

  // remove template if it's patched
  if (defaults.template && extname(defaults.template) === kPatchedTemplateExt) {
    delete defaults.template;
  }

  return stringify(defaults as Record<string, unknown>);
}
