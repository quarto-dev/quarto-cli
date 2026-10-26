/*
 * defaults.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { extname } from "../../deno_ral/path.ts";
import { stringify } from "../../core/yaml.ts";

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
import { buildQuartoTemplateVariables } from "./quarto-template-variables.ts";
import { mergeConfigs } from "../../core/config.ts";
import { TempContext } from "../../core/temp.ts";

export async function generateDefaults(
  options: PandocOptions,
): Promise<FormatPandoc | undefined> {
  let allDefaults: FormatPandoc | undefined;

  if (options.format.pandoc) {
    allDefaults = {
      ...(options.format.pandoc || {}),
      variables: {
        ...(options.format.pandoc?.variables || {}),
      },
    } as FormatPandoc;

    const quartoVars = buildQuartoTemplateVariables(options);
    if (quartoVars) {
      // `variables.quarto.*` is an internal namespace populated by
      // Quarto; the user-facing override path for localized strings is
      // the top-level `language:` YAML key (resolved by formatLanguage
      // and already merged into options.format.language). Still, if a
      // user explicitly sets `variables: { quarto: ... }` in YAML, we
      // honor their value on collision instead of silently clobbering
      // it. mergeConfigs (src/core/config.ts) gives leaf-key precedence
      // at any nesting depth, so a user override of e.g.
      // variables.quarto.language.crossref-ch-prefix wins on that key
      // without dropping the rest of the localized language table.
      // (Same helper is used in src/core/language.ts:formatLanguage to
      // merge user-supplied `language:` onto _language.yml defaults.)
      // Anything in `variables.quarto` that is not a plain object is
      // ignored defensively — mergeConfigs on a non-object src would
      // iterate characters of a string or array indices.
      const existing = allDefaults.variables!.quarto;
      const existingQuarto = ld.isPlainObject(existing)
        ? existing as Record<string, unknown>
        : {};
      allDefaults.variables!.quarto = mergeConfigs(
        quartoVars,
        existingQuarto,
      );
    }

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
      const sysPath = typeof sysFilter === "string"
        ? sysFilter
        : sysFilter.path;
      const filterPath = typeof filter === "string" ? filter : filter.path;
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

  // suppress the internal `quarto.*` template-variable namespace. It is
  // populated by Quarto (e.g. the full localized language table, see
  // quarto-template-variables.ts) and would otherwise flood the render
  // message. This is print-only: the defaults file actually written for
  // pandoc (writeDefaultsFile) keeps the namespace intact. Clone before
  // the nested delete — defaults.variables aliases the caller's object.
  if (defaults.variables && "quarto" in defaults.variables) {
    defaults.variables = { ...defaults.variables };
    delete defaults.variables.quarto;
    if (Object.keys(defaults.variables).length === 0) {
      delete defaults.variables;
    }
  }

  return stringify(defaults as Record<string, unknown>);
}
