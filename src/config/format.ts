/*
* format.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { Document } from "deno_dom/deno-dom-wasm.ts";

import {
  kAtxHeaders,
  kCache,
  kCiteMethod,
  kCiteproc,
  kCodeFold,
  kCodeLink,
  kCodeSummary,
  kCss,
  kEcho,
  kEngine,
  kEPubCoverImage,
  kEval,
  kExecuteDaemon,
  kExecuteDaemonRestart,
  kExecuteDebug,
  kExecutePreserve,
  kFigAlign,
  kFigDpi,
  kFilterParams,
  kFilters,
  kFreeze,
  kHighlightStyle,
  kHtmlMathMethod,
  kInclude,
  kIncludeAfterBody,
  kIncludeBeforeBody,
  kIncludeInHeader,
  kKeepHidden,
  kKeepIpynb,
  kKeepYaml,
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
  kMergeIncludes,
  kNumberOffset,
  kNumberSections,
  kOutput,
  kOutputFile,
  kPdfEngine,
  kPdfEngineOpt,
  kPdfEngineOpts,
  kPreferHtml,
  kSectionDivs,
  kSelfContained,
  kTableOfContents,
  kTemplate,
  kToc,
  kTocTitle,
  kVariables,
  kVariant,
  kWarning,
} from "../config/constants.ts";

import { Metadata } from "./metadata.ts";

import {
  kError,
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

import { PandocFlags } from "./flags.ts";

export const kDependencies = "dependencies";
export const kSassBundles = "saas-bundles";
export const kHtmlPostprocessors = "html-postprocessors";
export const kBodyEnvelope = "body-envelope";

export interface FormatDependency {
  name: string;
  version?: string;
  meta?: Record<string, string>;
  links?: { rel: string; href: string }[];
  scripts?: DependencyFile[];
  stylesheets?: DependencyFile[];
  resources?: DependencyFile[];
}

export interface DependencyFile {
  name: string;
  path: string;
}

export interface BodyEnvelope {
  header?: string;
  before?: string;
  after?: string;
}

export interface SassLayer {
  use?: string[];
  defaults: string;
  functions: string;
  mixins: string;
  rules: string;
}

export interface SassBundle {
  key: string;
  dependency: string;
  user?: SassLayer;
  quarto?: SassLayer;
  framework?: SassLayer;
  loadPath?: string;
}

export interface FormatExtras {
  pandoc?: FormatPandoc;
  metadata?: Metadata;
  [kTocTitle]?: string;
  [kIncludeInHeader]?: string[];
  [kIncludeBeforeBody]?: string[];
  [kIncludeAfterBody]?: string[];
  [kFilters]?: {
    pre?: string[];
    post?: string[];
  };
  [kFilterParams]?: Record<string, unknown>;
  html?: {
    [kDependencies]?: FormatDependency[];
    [kSassBundles]?: SassBundle[];
    [kBodyEnvelope]?: BodyEnvelope;
    [kHtmlPostprocessors]?: Array<(doc: Document) => Promise<string[]>>;
  };
}

// pandoc output format
export interface Format {
  render: FormatRender;
  execute: FormatExecute;
  pandoc: FormatPandoc;
  metadata: Metadata;
  formatExtras?: (flags: PandocFlags, format: Format) => Promise<FormatExtras>;
  extensions?: Record<string, unknown>;
}

export interface FormatRender {
  [kKeepMd]?: boolean;
  [kKeepTex]?: boolean;
  [kKeepYaml]?: boolean;
  [kKeepIpynb]?: boolean;
  [kKeepSource]?: boolean;
  [kKeepHidden]?: boolean;
  [kPreferHtml]?: boolean;
  [kOutputDivs]?: boolean;
  [kVariant]?: string;
  [kOutputExt]?: string;
  [kPageWidth]?: number;
  [kFigAlign]?: "left" | "right" | "center" | "default";
  [kCodeFold]?: "none" | "show" | "hide" | boolean;
  [kCodeSummary]?: string;
  [kCodeLink]?: boolean;
  [kMergeIncludes]?: boolean;
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

export interface FormatExecute {
  // done
  [kFigWidth]?: number;
  [kFigHeight]?: number;
  [kFigFormat]?: "retina" | "png" | "jpeg" | "svg" | "pdf";
  [kFigDpi]?: number;
  [kCache]?: true | false | "refresh" | null;
  [kFreeze]?: true | false | "auto";
  [kExecutePreserve]?: boolean;
  [kExecuteDaemon]?: number | boolean | null;
  [kExecuteDaemonRestart]?: boolean;
  [kExecuteDebug]?: boolean;
  [kEngine]?: string;
  [kEval]?: true | false | null;
  [kError]?: boolean;
  [kEcho]?: boolean;
  [kOutput]?: boolean;
  [kWarning]?: boolean;
  [kInclude]?: boolean;
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
  [kEPubCoverImage]?: string;
  [kCss]?: string | string[];
  [kToc]?: boolean;
  [kTableOfContents]?: boolean;
  [kListings]?: boolean;
  [kNumberSections]?: boolean;
  [kNumberOffset]?: number[];
  [kHighlightStyle]?: string;
  [kSectionDivs]?: boolean;
  [kHtmlMathMethod]?: string;
}

export function isLatexOutput(format: FormatPandoc) {
  return ["pdf", "latex", "beamer"].includes(format.to || "");
}

export function isEpubOutput(format: FormatPandoc) {
  return ["epub", "epub2", "epub3"].includes(format.to || "");
}

export function isDocxOutput(format: string): boolean;
export function isDocxOutput(format: FormatPandoc): boolean;
export function isDocxOutput(format: string | FormatPandoc): boolean {
  if (typeof (format) !== "string") {
    format = format?.to || "html";
  }
  return format === "docx";
}

export function isHtmlOutput(format: string, strict?: boolean): boolean;
export function isHtmlOutput(format: FormatPandoc, strict?: boolean): boolean;
export function isHtmlOutput(
  format?: string | FormatPandoc,
  strict?: boolean,
): boolean {
  if (typeof (format) !== "string") {
    format = format?.to;
  }
  format = format || "html";
  if (
    [
      "html",
      "html4",
      "html5",
    ].includes(format)
  ) {
    return true;
  } else if (!strict) {
    return [
      "s5",
      "dzslides",
      "slidy",
      "slideous",
      "revealjs",
      "epub",
      "epub2",
      "epub3",
    ].includes(format);
  } else {
    return false;
  }
}

export function isMarkdownOutput(format: FormatPandoc) {
  const to = (format.to || "").replace(/[\+\-_].*$/, "");
  return ["markdown", "gfm", "commonmark"].includes(to);
}
