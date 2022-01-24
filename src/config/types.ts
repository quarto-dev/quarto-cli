/*
* types.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import { Document } from "../core/deno-dom.ts";

import {
  kAtxHeaders,
  kCache,
  kCalloutDangerCaption,
  kCalloutImportantCaption,
  kCalloutNoteCaption,
  kCalloutTipCaption,
  kCalloutWarningCaption,
  kCiteMethod,
  kCiteproc,
  kCodeFold,
  kCodeLineNumbers,
  kCodeLink,
  kCodeOverflow,
  kCodeSummary,
  kCodeTools,
  kCodeToolsHideAllCode,
  kCodeToolsMenuCaption,
  kCodeToolsShowAllCode,
  kCodeToolsSourceCode,
  kCodeToolsViewSource,
  kCopyButtonTooltip,
  kCrossrefCnjPrefix,
  kCrossrefCnjTitle,
  kCrossrefCorPrefix,
  kCrossrefCorTitle,
  kCrossrefDefPrefix,
  kCrossrefDefTitle,
  kCrossrefEqPrefix,
  kCrossrefExmPrefix,
  kCrossrefExmTitle,
  kCrossrefExrPrefix,
  kCrossrefExrTitle,
  kCrossrefFigPrefix,
  kCrossrefFigTitle,
  kCrossrefLemPrefix,
  kCrossrefLemTitle,
  kCrossrefLofTitle,
  kCrossrefLolTitle,
  kCrossrefLotTitle,
  kCrossrefLstPrefix,
  kCrossrefLstTitle,
  kCrossrefPrfTitle,
  kCrossrefPrpPrefix,
  kCrossrefSecPrefix,
  kCrossrefTblPrefix,
  kCrossrefTblTitle,
  kCrossrefThmPrefix,
  kCrossrefThmTitle,
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
  kLinkExternalFilter,
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
  kReferenceLocation,
  kRepoActionLinksEdit,
  kRepoActionLinksIssue,
  kRepoActionLinksSource,
  kSearchClearButtonTitle,
  kSearchCopyLinkTitle,
  kSearchDetatchedCancelButtonTitle,
  kSearchHideMatchesText,
  kSearchMatchingDocumentsText,
  kSearchMoreMatchText,
  kSearchNoResultsText,
  kSearchSubmitButtonTitle,
  kSectionDivs,
  kSectionTitleAbstract,
  kSectionTitleAppendices,
  kSectionTitleFootnotes,
  kSelfContained,
  kSelfContainedMath,
  kShiftHeadingLevelBy,
  kSlideLevel,
  kSyntaxDefinitions,
  kTableOfContents,
  kTblColwidths,
  kTemplate,
  kTitlePrefix,
  kToc,
  kTocTitleDocument,
  kTocTitleWebsite,
  kTopLevelDivision,
  kVariables,
  kVariant,
  kWarning,
  kWebtex,
  kError,
  kFigFormat,
  kFigHeight,
  kFigWidth,
  kKeepMd,
  kKeepSource,
  kKeepTex,
  kOutputDivs,
  kOutputExt,
  kPageWidth
} from "./constants.ts";

import { TempContext } from "../core/temp.ts";

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
  links?: { rel: string; href: string; type?: string }[];
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
  afterPreamble?: string;
  afterPostamble?: string;
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
    [kHtmlPostprocessors]?: Array<
      (doc: Document) => Promise<string[]>
    >;
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
  language: FormatLanguage;
  metadata: Metadata;
  resolveFormat?: (format: Format) => void;
  formatExtras?: (
    input: string,
    flags: PandocFlags,
    format: Format,
    libDir: string,
    temp: TempContext,
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
  [kCodeOverflow]?: "wrap" | "scroll";
  [kCodeLink]?: boolean;
  [kCodeLineNumbers]?: boolean;
  [kCodeTools]?: boolean | {
    source?: boolean;
    toggle?: boolean;
    caption?: string;
  };
  [kTblColwidths]?: "auto" | boolean | number[];
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
  [kLinkExternalFilter]?: string;
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
  [kReferenceLocation]?: string;
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
  [kSlideLevel]?: number;
  [kSyntaxDefinitions]?: string[];
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
  [kListings]?: boolean;
  [kNumberSections]?: boolean;
  [kNumberOffset]?: number[];
  [kTopLevelDivision]?: string;
  [kShiftHeadingLevelBy]?: string;
  [kIncludeInHeader]?: string;
  [kIncludeBeforeBody]?: string;
  [kIncludeAfterBody]?: string;
  [kReferenceLocation]?: string;
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

export interface FormatLanguage {
  [kTocTitleDocument]?: string;
  [kTocTitleWebsite]?: string;
  [kCalloutTipCaption]?: string;
  [kCalloutNoteCaption]?: string;
  [kCalloutWarningCaption]?: string;
  [kCalloutImportantCaption]?: string;
  [kCalloutDangerCaption]?: string;
  [kSectionTitleAbstract]?: string;
  [kSectionTitleFootnotes]?: string;
  [kSectionTitleAppendices]?: string;
  [kCodeSummary]?: string;
  [kCodeToolsMenuCaption]?: string;
  [kCodeToolsShowAllCode]?: string;
  [kCodeToolsHideAllCode]?: string;
  [kCodeToolsViewSource]?: string;
  [kCodeToolsSourceCode]?: string;
  [kRepoActionLinksEdit]?: string;
  [kRepoActionLinksSource]?: string;
  [kRepoActionLinksIssue]?: string;
  [kSearchNoResultsText]?: string;
  [kCopyButtonTooltip]?: string;
  [kSearchMatchingDocumentsText]?: string;
  [kSearchCopyLinkTitle]?: string;
  [kSearchHideMatchesText]?: string; // FIXME duplicate?
  [kSearchMoreMatchText]?: string;
  [kSearchHideMatchesText]?: string; // FIXME duplicate?
  [kSearchClearButtonTitle]?: string;
  [kSearchDetatchedCancelButtonTitle]?: string;
  [kSearchSubmitButtonTitle]?: string;
  [kCrossrefFigTitle]?: string;
  [kCrossrefTblTitle]?: string;
  [kCrossrefLstTitle]?: string;
  [kCrossrefThmTitle]?: string;
  [kCrossrefLemTitle]?: string;
  [kCrossrefCorTitle]?: string;
  [kCrossrefPrfTitle]?: string;
  [kCrossrefCnjTitle]?: string;
  [kCrossrefDefTitle]?: string;
  [kCrossrefExmTitle]?: string;
  [kCrossrefExrTitle]?: string;
  [kCrossrefFigPrefix]?: string;
  [kCrossrefTblPrefix]?: string;
  [kCrossrefLstPrefix]?: string;
  [kCrossrefSecPrefix]?: string;
  [kCrossrefEqPrefix]?: string;
  [kCrossrefThmPrefix]?: string;
  [kCrossrefLemPrefix]?: string;
  [kCrossrefCorPrefix]?: string;
  [kCrossrefPrpPrefix]?: string;
  [kCrossrefCnjPrefix]?: string;
  [kCrossrefDefPrefix]?: string;
  [kCrossrefExmPrefix]?: string;
  [kCrossrefExrPrefix]?: string;
  [kCrossrefLofTitle]?: string;
  [kCrossrefLotTitle]?: string;
  [kCrossrefLolTitle]?: string;

  // langauge variations e.g. eg, fr, etc.
  [key: string]: unknown;
}
