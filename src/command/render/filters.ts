/*
* filters.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import {
  kBibliography,
  kCodeFold,
  kCodeSummary,
  kFigAlign,
  kHeaderIncludes,
  kIncludeAfter,
  kIncludeAfterBody,
  kIncludeBefore,
  kIncludeBeforeBody,
  kIncludeInHeader,
  kOutputDivs,
} from "../../config/constants.ts";
import { Format, FormatPandoc } from "../../config/format.ts";
import { Metadata } from "../../config/metadata.ts";
import { bibEngine } from "../../config/pdf.ts";
import { resourcePath } from "../../core/resources.ts";
import {
  crossrefFilter,
  crossrefFilterActive,
  crossrefFilterParams,
} from "./crossref.ts";
import { layoutFilter, layoutFilterParams } from "./layout.ts";
import { pandocMetadataPath, PandocOptions } from "./pandoc.ts";
import { removePandocArgs } from "./flags.ts";
import { ld } from "lodash/mod.ts";
import { mergeConfigs } from "../../core/config.ts";
import { projectConfigDir } from "../../config/project.ts";

const kQuartoParams = "quarto-params";

const kProjectOffset = "project-offset";

export function setFilterParams(
  args: string[],
  options: PandocOptions,
  defaults: FormatPandoc | undefined,
) {
  // extract include params (possibly mutating it's arguments)
  const includes = extractIncludeParams(
    args,
    options.format.metadata,
    defaults || {},
  );

  const params: Metadata = {
    ...includes,
    ...projectFilterParams(options),
    ...quartoFilterParams(options.format),
    ...crossrefFilterParams(options),
    ...layoutFilterParams(options.format),
  };

  options.format.metadata[kQuartoParams] = params;
}

export function removeFilterParmas(metadata: Metadata) {
  delete metadata[kQuartoParams];
}

export function quartoPreFilter() {
  return resourcePath("filters/quarto-pre/quarto-pre.lua");
}

export function quartoPostFilter() {
  return resourcePath("filters/quarto-post/quarto-post.lua");
}

function extractIncludeParams(
  args: string[],
  metadata: Metadata,
  defaults: FormatPandoc,
) {
  // pull out string based includes
  const includes = mergeConfigs(
    extractIncludeVariables(metadata),
    extractIncludeVariables(defaults.variables || {}),
  );
  if (defaults.variables && Object.keys(defaults.variables).length === 0) {
    delete defaults.variables;
  }

  // pull out file based includes
  const inHeaderFiles: string[] = defaults[kIncludeInHeader] || [];
  const beforeBodyFiles: string[] = defaults[kIncludeBeforeBody] ||
    [];
  const afterBodyFiles: string[] = defaults[kIncludeAfterBody] ||
    [];

  // erase from format/options
  delete defaults[kIncludeInHeader];
  delete defaults[kIncludeAfterBody];
  delete defaults[kIncludeBeforeBody];

  // pull includes out of args
  for (const arg in args) {
    switch (arg) {
      case kIncludeInHeader:
        inHeaderFiles.push(arg);
        break;
      case kIncludeBeforeBody:
        beforeBodyFiles.push(arg);
        break;
      case kIncludeAfterBody:
        afterBodyFiles.push(arg);
        break;
    }
  }

  // remove includs from args
  const removeArgs = new Map<string, boolean>();
  removeArgs.set(kIncludeInHeader, true);
  removeArgs.set(kIncludeBeforeBody, true);
  removeArgs.set(kIncludeAfterBody, true);
  removePandocArgs(args, removeArgs);

  return {
    ...includes,
    [kIncludeInHeader]: inHeaderFiles.map(pandocMetadataPath),
    [kIncludeBeforeBody]: beforeBodyFiles.map(pandocMetadataPath),
    [kIncludeAfterBody]: afterBodyFiles.map(pandocMetadataPath),
  };
}

function extractIncludeVariables(obj: { [key: string]: unknown }) {
  const extractVariable = (name: string): unknown[] => {
    const value = obj[name];
    delete obj[name];
    if (!value) {
      return [];
    } else if (ld.isArray(value)) {
      return value as unknown[];
    } else {
      return [value];
    }
  };

  return {
    [kHeaderIncludes]: extractVariable(kHeaderIncludes),
    [kIncludeBefore]: extractVariable(kIncludeBefore),
    [kIncludeAfter]: extractVariable(kIncludeAfter),
  };
}

function projectFilterParams(options: PandocOptions) {
  if (options.offset) {
    return {
      [kProjectOffset]: options.offset,
    };
  } else {
    return {};
  }
}

function quartoFilterParams(format: Format) {
  const params: Metadata = {
    [kOutputDivs]: format.render[kOutputDivs],
  };
  const figAlign = format.render[kFigAlign];
  if (figAlign) {
    params[kFigAlign] = figAlign;
  }
  const foldCode = format.render[kCodeFold];
  if (foldCode) {
    params[kCodeFold] = foldCode;
  }
  const foldSummary = format.render[kCodeSummary];
  if (foldSummary) {
    params[kCodeSummary] = foldSummary;
  }
  return params;
}

export function resolveFilters(userFilters: string[], options: PandocOptions) {
  // filter chain
  const filters: string[] = [];

  // always run quarto pre filter
  filters.push(quartoPreFilter());

  // add crossref filter if necessary
  if (crossrefFilterActive(options.format)) {
    filters.push(crossrefFilter());
  }

  // add layout filter
  filters.push(layoutFilter());

  // add quarto post filter
  filters.push(quartoPostFilter());

  // add user filters (remove citeproc if it's there)
  filters.push(...userFilters.filter((filter) => filter !== "citeproc"));

  // citeproc at the very end so all other filters can interact with citations
  const citeproc = citeMethod(options) === "citeproc";
  if (citeproc) {
    filters.push("citeproc");
  }

  // return filters
  if (filters.length > 0) {
    return filters;
  } else {
    return undefined;
  }
}

type CiteMethod = "citeproc" | "natbib" | "biblatex";

function citeMethod(options: PandocOptions): CiteMethod | null {
  // no handler if no references
  const pandoc = options.format.pandoc;
  const metadata = options.format.metadata;
  if (!metadata[kBibliography] && !metadata.references) {
    return null;
  }

  // collect config
  const engine = bibEngine(options.format.pandoc, options.flags);

  // if it's pdf-based output check for natbib or biblatex
  if (engine) {
    return engine;
  }

  // otherwise it's citeproc unless expressly disabled
  if (pandoc.citeproc !== false) {
    return "citeproc";
  } else {
    return null;
  }
}
