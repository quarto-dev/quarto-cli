/*
* types.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import { Document } from "deno_dom/deno-dom-wasm-noinit.ts";

import {
  kAtxHeaders,
  kCache,
  kCiteMethod,
  kCiteproc,
  kCodeFold,
  kCodeLineNumbers,
  kCodeLink,
  kCodeOverflow,
  kCodeSummary,
  kCodeTools,
  kCss,
  kEcho,
  kEngine,
  kEPubCoverImage,
  kEval,
  kExecuteDaemon,
  kExecuteDaemonRestart,
  kExecuteDebug,
  kExecuteEnabled,
  kExecuteIpynb,
  kFigAlign,
  kFigDpi,
  kFilterParams,
  kFilters,
  kFreeze,
  kGladtex,
  kHighlightStyle,
  kHtmlMathMethod,
  kInclude,
  kIncludeAfterBody,
  kIncludeBeforeBody,
  kIncludeInHeader,
  kKatex,
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
  kLinkExternalIcon,
  kLinkExternalNewwindow,
  kListings,
  kMarkdownHeadings,
  kMathjax,
  kMathml,
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
  kSelfContainedMath,
  kShiftHeadingLevelBy,
  kTableOfContents,
  kTemplate,
  kTitlePrefix,
  kToc,
  kTocTitle,
  kTopLevelDivision,
  kVariables,
  kVariant,
  kWarning,
  kWebtex,
} from "../config/constants.ts";

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

export const kDependencies = "dependencies";
export const kSassBundles = "sass-bundles";
export const kHtmlPostprocessors = "html-postprocessors";
export const kTemplatePatches = "template-patches";
export const kBodyEnvelope = "body-envelope";
export const kTextHighlightingMode = "text-highlighting-mode";
export const kQuartoCssVariables = "css-variables";
export const kMarkdownAfterBody = "render-after-body";

export type Metadata = {
  [key: string]: unknown;
};

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
  attribs?: Record<string, string>;
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

export interface SassBundleLayers {
  key: string;
  user?: SassLayer;
  quarto?: SassLayer;
  framework?: SassLayer;
  loadPaths?: string[];
}

export interface SassBundle extends SassBundleLayers {
  dependency: string;
  dark?: {
    user?: SassLayer;
    quarto?: SassLayer;
    framework?: SassLayer;
    default?: boolean;
  };
  attribs?: Record<string, string>;
}

export interface FormatExtras {
  args?: string[];
  pandoc?: FormatPandoc;
  metadata?: Metadata;
  metadataOverride?: Metadata;
  [kTocTitle]?: string;
  [kIncludeInHeader]?: string[];
  [kIncludeBeforeBody]?: string[];
  [kIncludeAfterBody]?: string[];
  [kFilters]?: {
    pre?: string[];
    post?: string[];
  };
  [kFilterParams]?: Record<string, unknown>;
  postprocessors?: Array<(output: string) => Promise<void>>;
  html?: {
    [kDependencies]?: FormatDependency[];
    [kSassBundles]?: SassBundle[];
    [kBodyEnvelope]?: BodyEnvelope;
    [kTemplatePatches]?: Array<(template: string) => string>;
    [kHtmlPostprocessors]?: Array<(doc: Document) => Promise<string[]>>;
    [kTextHighlightingMode]?: "light" | "dark" | "none" | undefined;
    [kQuartoCssVariables]?: string[];
    [kMarkdownAfterBody]?: string[];
  };
}

// pandoc output format
export interface Format {
  render: FormatRender;
  execute: FormatExecute;
  pandoc: FormatPandoc;
  metadata: Metadata;
  metadataFilter?: (metadata: Metadata) => Metadata;
  formatExtras?: (
    input: string,
    flags: PandocFlags,
    format: Format,
    libDir: string,
  ) => Promise<FormatExtras>;
  formatPreviewFile?: (
    file: string,
    format: Format,
  ) => string;
  extensions?: Record<string, unknown>;
}

export interface FormatRender {
  [kKeepTex]?: boolean;
  [kKeepYaml]?: boolean;
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
  [kCodeOverflow]?: "wrap" | "scroll";
  [kCodeLink]?: boolean;
  [kCodeLineNumbers]?: boolean;
  [kCodeTools]?: boolean | {
    source?: boolean;
    toggle?: boolean;
    caption?: string;
  };
  [kMergeIncludes]?: boolean;
  [kSelfContainedMath]?: boolean;
  [kLatexAutoMk]?: boolean;
  [kLatexAutoInstall]?: boolean;
  [kLatexMinRuns]?: number;
  [kLatexMaxRuns]?: number;
  [kLatexClean]?: boolean;
  [kLatexMakeIndex]?: string;
  [kLatexMakeIndexOpts]?: string[];
  [kLatexTlmgrOpts]?: string[];
  [kLatexOutputDir]?: string | null;
  [kLinkExternalIcon]?: string | boolean;
  [kLinkExternalNewwindow]?: boolean;
}

export interface FormatExecute {
  // done
  [kFigWidth]?: number;
  [kFigHeight]?: number;
  [kFigFormat]?: "retina" | "png" | "jpeg" | "svg" | "pdf";
  [kFigDpi]?: number;
  [kCache]?: true | false | "refresh" | null;
  [kFreeze]?: true | false | "auto";
  [kExecuteEnabled]?: true | false | null;
  [kExecuteIpynb]?: true | false | null;
  [kExecuteDaemon]?: number | boolean | null;
  [kExecuteDaemonRestart]?: boolean;
  [kExecuteDebug]?: boolean;
  [kEngine]?: string;
  [kEval]?: true | false | null;
  [kError]?: boolean;
  [kEcho]?: boolean | "fenced";
  [kOutput]?: boolean | "all" | "asis";
  [kWarning]?: boolean;
  [kInclude]?: boolean;
  [kKeepMd]?: boolean;
  [kKeepIpynb]?: boolean;
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
  [kHtmlMathMethod]?: string | { method: string; url: string };
  [kTopLevelDivision]?: string;
  [kShiftHeadingLevelBy]?: number;
  [kTitlePrefix]?: string;
}

export interface PandocFlags {
  to?: string;
  output?: string;
  [kSelfContained]?: boolean;
  pdfEngine?: string;
  pdfEngineOpts?: string[];
  makeIndexOpts?: string[];
  tlmgrOpts?: string[];
  natbib?: boolean;
  biblatex?: boolean;
  [kToc]?: boolean;
  [kTocTitle]?: string;
  [kListings]?: boolean;
  [kNumberSections]?: boolean;
  [kNumberOffset]?: number[];
  [kTopLevelDivision]?: string;
  [kShiftHeadingLevelBy]?: string;
  [kIncludeInHeader]?: string;
  [kIncludeBeforeBody]?: string;
  [kIncludeAfterBody]?: string;
  [kMathjax]?: boolean;
  [kKatex]?: boolean;
  [kMathml]?: boolean;
  [kGladtex]?: boolean;
  [kWebtex]?: boolean;
}

// the requested pdf engine, it's options, and the bib engine
export interface PdfEngine {
  pdfEngine: string;
  pdfEngineOpts?: string[];
  bibEngine?: "natbib" | "biblatex";
  indexEngine?: string;
  indexEngineOpts?: string[];
  tlmgrOpts?: string[];
}
