/*
 * defaults.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { extname } from "path/mod.ts";
import { stringify } from "yaml/mod.ts";

import * as ld from "../../core/lodash.ts";

import { FormatPandoc, QuartoFilter } from "../../config/types.ts";
import { isLatexOutput } from "../../config/format.ts";

import {
  kEmbedResources,
  kFilters,
  kFrom,
  kIncludeAfterBody,
  kIncludeBeforeBody,
  kIncludeInHeader,
  kNumberDepth,
  kOutputFile,
  kQuartoFilters,
  kSelfContained,
  kStandalone,
  kTemplate,
  kTo,
} from "../../config/constants.ts";

import { kPatchedTemplateExt } from "./template.ts";
import { PandocOptions } from "./types.ts";
import { quartoMainFilter, resolveFilters } from "./filters.ts";
import { TempContext } from "../../core/temp.ts";

export async function generateDefaults(
  options: PandocOptions,
): Promise<FormatPandoc | undefined> {
  let allDefaults: FormatPandoc | undefined;

  if (options.format.pandoc) {
    allDefaults = (options.format.pandoc
      ? ld.cloneDeep(options.format.pandoc)
      : {}) as FormatPandoc;

    // resolve filters
    const resolvedFilters = await resolveFilters(
      [
        ...(allDefaults[kFilters] || []),
      ],
      options,
      allDefaults,
    );
    if (resolvedFilters) {
      allDefaults[kFilters] = resolvedFilters.quartoFilters;
      // forward the filter spec with everything to pandoc via metadata
      options.format.metadata[kQuartoFilters] = resolvedFilters;
    }

    // If we're rendering Latex, forward the number-depth to pandoc (it handles numbering)
    if (isLatexOutput(options.format.pandoc)) {
      if (options.format.metadata[kNumberDepth] !== undefined) {
        allDefaults.variables = allDefaults.variables || {};
        allDefaults.variables["secnumdepth"] =
          options.format.metadata[kNumberDepth];
      }
    }

    return allDefaults;
  } else {
    return undefined;
  }
}

export async function writeDefaultsFile(
  defaults: FormatPandoc,
  temp: TempContext,
) {
  const defaultsStr = "---\n" +
    stringify(defaults as Record<string, unknown>, {
      indent: 2,
      lineWidth: -1,
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
    kEmbedResources,
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

  const filtersContains = (filters: QuartoFilter[], filter: QuartoFilter) => {
    return filters.find((sysFilter) => {
      const sysPath = typeof (sysFilter) === "string"
        ? sysFilter
        : sysFilter.path;
      const filterPath = typeof (filter) === "string" ? filter : filter.path;
      return sysPath === filterPath;
    });
  };

  // simplify crossref filter
  if (defaults.filters?.length) {
    defaults.filters = defaults.filters
      .filter((filter) => {
        return filter !== quartoMainFilter() &&
          filtersContains(sysFilters, filter);
      });
    if (defaults.filters?.length === 0) {
      delete defaults.filters;
    }
  }

  // remove template if it's patched
  if (defaults.template && extname(defaults.template) === kPatchedTemplateExt) {
    delete defaults.template;
  }

  // TODO / HACK: suppress writer if it is coming from an extension
  if (defaults.writer) {
    if (
      defaults.writer.match(/(?:^|[\\/])_extensions[\\/]/) ||
      defaults.writer.match(/(?:^|[\\/])extensions[\\/]quarto[\\/]/)
    ) {
      delete defaults.writer;
    }
  }

  return stringify(defaults as Record<string, unknown>);
}
