/*
* filters.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import {
  kBibliography,
  kCitationLocation,
  kCiteMethod,
  kCodeFold,
  kCodeLineNumbers,
  kCodeSummary,
  kFigAlign,
  kFigResponsive,
  kHeaderIncludes,
  kIncludeAfter,
  kIncludeAfterBody,
  kIncludeBefore,
  kIncludeBeforeBody,
  kIncludeInHeader,
  kKeepHidden,
  kMergeIncludes,
  kOutputDivs,
  kReferenceLocation,
  kTblColwidths,
  kTocTitleDocument,
} from "../../config/constants.ts";
import { PandocOptions } from "./types.ts";
import { Format, FormatLanguage, FormatPandoc } from "../../config/types.ts";
import { Metadata } from "../../config/types.ts";
import { kProjectType } from "../../project/types.ts";
import { bibEngine } from "../../config/pdf.ts";
import { resourcePath } from "../../core/resources.ts";
import {
  crossrefFilter,
  crossrefFilterActive,
  crossrefFilterParams,
} from "./crossref.ts";
import { layoutFilter, layoutFilterParams } from "./layout.ts";
import { pandocMetadataPath } from "./render-shared.ts";
import { removePandocArgs } from "./flags.ts";
import * as ld from "../../core/lodash.ts";
import { mergeConfigs } from "../../core/config.ts";
import { projectType } from "../../project/types/project-types.ts";
import { isWindows } from "../../core/platform.ts";

const kQuartoParams = "quarto-params";

const kProjectOffset = "project-offset";

const kResultsFile = "results-file";

export function filterParamsJson(
  args: string[],
  options: PandocOptions,
  defaults: FormatPandoc | undefined,
  filterParams: Record<string, unknown>,
  resultsFile: string,
) {
  // extract include params (possibly mutating it's arguments)
  const includes = options.format.render[kMergeIncludes] !== false
    ? extractIncludeParams(
      args,
      options.format.metadata,
      defaults || {},
    )
    : {};

  // Extract any column params
  const quartoColumnParams = extractColumnParams(
    args,
    options.format.metadata,
    defaults,
  );

  const params: Metadata = {
    ...includes,
    ...projectFilterParams(options),
    ...quartoColumnParams,
    ...quartoFilterParams(options.format),
    ...crossrefFilterParams(options, defaults),
    ...layoutFilterParams(options.format),
    ...languageFilterParams(options.format.language),
    ...filterParams,
    [kResultsFile]: pandocMetadataPath(resultsFile),
  };

  return JSON.stringify(params);
}

export function removeFilterParmas(metadata: Metadata) {
  delete metadata[kQuartoParams];
}

export function quartoInitFilter() {
  return resourcePath("filters/init/init.lua");
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
  removePandocArgsInPlace(args, removeArgs);
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

export function extractColumnParams(
  args: string[],
  metadata: Metadata,
  defaults?: FormatPandoc,
) {
  const quartoColumnParams: Metadata = {};
  if (
    defaults?.[kReferenceLocation] === "margin" ||
    referenceLocationArg(args) === "margin"
  ) {
    // Forward the values to our params
    quartoColumnParams[kReferenceLocation] = "margin";

    // Remove from flags
    const removeArgs = new Map<string, boolean>();
    removeArgs.set(`--${kReferenceLocation}`, true);
    removePandocArgsInPlace(args, removeArgs);
    // Remove from pandoc defaults
    if (defaults) {
      delete defaults[kReferenceLocation];
    }
  }
  // Foreward the cite method as well
  if (defaults?.[kCiteMethod]) {
    quartoColumnParams[kCiteMethod] = defaults[kCiteMethod];
  }
  // Forward citation location
  if (metadata[kCitationLocation]) {
    quartoColumnParams[kCitationLocation] = metadata[kCitationLocation];
  }

  return quartoColumnParams;
}

function removePandocArgsInPlace(
  args: string[],
  removeArgs: Map<string, boolean>,
) {
  const cleanedArgs = removePandocArgs(args, removeArgs);
  if (cleanedArgs.length !== args.length) {
    args.splice(0, args.length);
    args.push(...cleanedArgs);
  }
}

function referenceLocationArg(args: string[]) {
  const argIndex = args.findIndex((arg) => {
    return arg === `--${kReferenceLocation}`;
  });
  if (argIndex > -1 && args.length > argIndex + 1) {
    const referenceLocation = args[argIndex + 1];
    return referenceLocation;
  } else {
    return undefined;
  }
}

function languageFilterParams(language: FormatLanguage) {
  const params: Metadata = {
    [kCodeSummary]: language[kCodeSummary],
    [kTocTitleDocument]: language[kTocTitleDocument],
  };
  Object.keys(language).forEach((key) => {
    if (
      key.startsWith("callout-") || key.startsWith("crossref-")
    ) {
      params[key] = language[key];
    }
  });
  // default prefixes based on titles
  [
    "fig",
    "tbl",
    "lst",
    "thm",
    "lem",
    "cor",
    "prp",
    "cnj",
    "def",
    "exm",
    "exr",
  ].forEach((type) => {
    params[`crossref-${type}-prefix`] = language[`crossref-${type}-title`];
  });
  return params;
}

function projectFilterParams(options: PandocOptions) {
  // see if the project wants to provide any filter params
  const projType = projectType(
    options.project?.config?.project?.[kProjectType],
  );
  const params =
    ((projType.filterParams ? projType.filterParams(options) : undefined) ||
      {}) as Metadata;

  if (options.offset) {
    return {
      ...params,
      [kProjectOffset]: options.offset,
    };
  } else {
    return params;
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
  const tblColwidths = format.render[kTblColwidths];
  if (tblColwidths !== undefined) {
    params[kTblColwidths] = tblColwidths;
  }
  const figResponsive = format.metadata[kFigResponsive] === true;
  if (figResponsive) {
    params[kFigResponsive] = figResponsive;
  }
  const lineNumbers = format.render[kCodeLineNumbers];
  if (lineNumbers) {
    params[kCodeLineNumbers] = lineNumbers;
  }
  const keepHidden = format.render[kKeepHidden];
  if (keepHidden) {
    params[kKeepHidden] = kKeepHidden;
  }
  return params;
}

export function resolveFilters(filters: string[], options: PandocOptions) {
  // build list of quarto filters
  const quartoFilters: string[] = [];
  // windows needs the init filter to patch utf8 filename handling
  if (isWindows()) {
    quartoFilters.push(quartoInitFilter());
  }
  quartoFilters.push(quartoPreFilter());
  if (crossrefFilterActive(options)) {
    quartoFilters.push(crossrefFilter());
  }
  quartoFilters.push(layoutFilter());
  quartoFilters.push(quartoPostFilter());

  // if 'quarto' is in the filters, inject our filters at that spot,
  // otherwise inject them at the beginning so user filters can take
  // advantage of e.g. resourceeRef resolution (note that citeproc
  // will in all cases run last)
  const quartoLoc = filters.findIndex((filter) => filter === "quarto");
  if (quartoLoc !== -1) {
    filters = [
      ...filters.slice(0, quartoLoc),
      ...quartoFilters,
      ...filters.slice(quartoLoc + 1),
    ];
  } else {
    filters.unshift(...quartoFilters);
  }

  // citeproc at the very end so all other filters can interact with citations
  filters = filters.filter((filter) => filter !== "citeproc");
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
