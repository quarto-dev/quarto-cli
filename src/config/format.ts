/*
* format.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { mergeConfigs } from "../core/config.ts";

import {
  kAtxHeaders,
  kCache,
  kCiteMethod,
  kCiteproc,
  kCodeFold,
  kCodeSummary,
  kExecute,
  kFigAlign,
  kFigDpi,
  kFilters,
  kHeaderIncludes,
  kIncludeAfter,
  kIncludeAfterBody,
  kIncludeBefore,
  kIncludeBeforeBody,
  kIncludeInHeader,
  kKeepHidden,
  kKeepIpynb,
  kKeepYaml,
  kKernelDebug,
  kKernelKeepalive,
  kKernelRestart,
  kLatexAutoInstall,
  kLatexAutoMk,
  kLatexClean,
  kLatexMakeIndex,
  kLatexMakeIndexOpts,
  kLatexMaxRuns,
  kLatexMinRuns,
  kLatexOutputDir,
  kLatexTlmgrOpts,
  kListings,
  kMarkdownHeadings,
  kNumberSections,
  kOutputFile,
  kPdfEngine,
  kPdfEngineOpt,
  kPdfEngineOpts,
  kPreferHtml,
  kSelfContained,
  kShowCode,
  kShowOutput,
  kShowWarnings,
  kTemplate,
  kVariables,
  kVariant,
} from "../config/constants.ts";

import { Metadata } from "./metadata.ts";

import {
  kAllowErrors,
  kFigFormat,
  kFigHeight,
  kFigWidth,
  kKeepMd,
  kKeepSource,
  kKeepTex,
  kOutputDivs,
  kOutputExt,
  kPageWidth,
} from "./constants.ts";

export interface FormatExtras {
  [kVariables]?: Record<string, unknown>;
  [kIncludeInHeader]?: string[];
  [kIncludeBeforeBody]?: string[];
  [kIncludeAfterBody]?: string[];
  [kFilters]?: {
    pre?: string[];
    post?: string[];
  };
}

// pandoc output format
export interface Format {
  render: FormatRender;
  execution: FormatExecution;
  pandoc: FormatPandoc;
  metadata: Metadata;
  preprocess?: (format: Format) => FormatExtras;
}

export interface FormatRender {
  [kKeepMd]?: boolean;
  [kKeepTex]?: boolean;
  [kKeepYaml]?: boolean;
  [kKeepIpynb]?: boolean;
  [kKeepSource]?: boolean;
  [kPreferHtml]?: boolean;
  [kOutputDivs]?: boolean;
  [kVariant]?: string;
  [kOutputExt]?: string;
  [kPageWidth]?: number;
  [kFigAlign]?: "left" | "right" | "center" | "default";
  [kCodeFold]?: "none" | "show" | "hide" | boolean;
  [kCodeSummary]?: string;
  [kLatexAutoMk]?: boolean;
  [kLatexAutoInstall]?: boolean;
  [kLatexMinRuns]?: number;
  [kLatexMaxRuns]?: number;
  [kLatexClean]?: boolean;
  [kLatexMakeIndex]?: string;
  [kLatexMakeIndexOpts]?: string[];
  [kLatexTlmgrOpts]?: string[];
  [kLatexOutputDir]?: string | null;
}

export interface FormatExecution {
  [kFigWidth]?: number;
  [kFigHeight]?: number;
  [kFigFormat]?: "retina" | "png" | "jpeg" | "svg" | "pdf";
  [kFigDpi]?: number;
  [kAllowErrors]?: boolean;
  [kExecute]?: true | false | null;
  [kCache]?: true | false | "refresh" | null;
  [kShowCode]?: boolean;
  [kShowOutput]?: boolean;
  [kShowWarnings]?: boolean;
  [kKeepHidden]?: boolean;
  [kKernelKeepalive]?: number;
  [kKernelRestart]?: boolean;
  [kKernelDebug]?: boolean;
}

export interface FormatPandoc {
  from?: string;
  to?: string;
  writer?: string;
  [kTemplate]?: string;
  [kOutputFile]?: string;
  standalone?: boolean;
  [kSelfContained]?: boolean;
  [kVariables]?: { [key: string]: unknown };
  [kAtxHeaders]?: boolean;
  [kMarkdownHeadings]?: boolean;
  [kIncludeBeforeBody]?: string[];
  [kIncludeAfterBody]?: string[];
  [kIncludeInHeader]?: string[];
  [kCiteproc]?: boolean;
  [kCiteMethod]?: string;
  [kFilters]?: string[];
  [kPdfEngine]?: string;
  [kPdfEngineOpts]?: string[];
  [kPdfEngineOpt]?: string;
  [kListings]?: boolean;
  [kNumberSections]?: boolean;
}

export function isLatexOutput(format: FormatPandoc) {
  return ["pdf", "latex", "beamer"].includes(format.to || "");
}

export function isHtmlOutput(format: FormatPandoc) {
  return [
    "html",
    "html4",
    "html5",
    "s5",
    "dzslides",
    "slidy",
    "slideous",
    "revealjs",
    "epub",
    "epub2",
    "epub3",
  ].includes(format.to || "html");
}

export function isMarkdownOutput(format: FormatPandoc) {
  const to = (format.to || "").replace(/[\+\-_].*$/, "");
  return ["markdown", "gfm", "commonmark"].includes(to);
}
