/*
* types.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import { Document } from "../core/deno-dom.ts";

import {
  kAppendixAttributionBibTex,
  kAppendixAttributionCiteAs,
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
  kCrossrefCnjTitle,
  kCrossrefCorTitle,
  kCrossrefDefTitle,
  kCrossrefEqPrefix,
  kCrossrefExmTitle,
  kCrossrefExrTitle,
  kCrossrefFigTitle,
  kCrossrefLemTitle,
  kCrossrefLstTitle,
  kCrossrefPrfTitle,
  kCrossrefSecPrefix,
  kCrossrefTblTitle,
  kCrossrefThmTitle,
  kCss,
  kEcho,
  kEngine,
  kEnvironmentProofTitle,
  kEnvironmentRemarkTitle,
  kEnvironmentSolutionTitle,
  kEPubCoverImage,
  kError,
  kEval,
  kExecuteDaemon,
  kExecuteDaemonRestart,
  kExecuteDebug,
  kExecuteEnabled,
  kExecuteIpynb,
  kFigAlign,
  kFigDpi,
  kFigEnv,
  kFigFormat,
  kFigHeight,
  kFigPos,
  kFigWidth,
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
  kIpynbFilters,
  kKatex,
  kKeepHidden,
  kKeepIpynb,
  kKeepMd,
  kKeepSource,
  kKeepTex,
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
  kListingPageCategoryAll,
  kListingPageFieldAuthor,
  kListingPageFieldCategories,
  kListingPageFieldDate,
  kListingPageFieldDescription,
  kListingPageFieldFileModified,
  kListingPageFieldFileName,
  kListingPageFieldReadingTime,
  kListingPageFieldSubtitle,
  kListingPageFieldTitle,
  kListingPageMinutesCompact,
  kListingPageNoMatches,
  kListingPageOrderBy,
  kListingPageOrderByDateAsc,
  kListingPageOrderByDateDesc,
  kListingPageOrderByDefault,
  kListingPageOrderByNumberAsc,
  kListingPageOrderByNumberDesc,
  kListings,
  kMarkdownHeadings,
  kMathjax,
  kMathml,
  kMergeIncludes,
  kNumberOffset,
  kNumberSections,
  kOutput,
  kOutputDivs,
  kOutputExt,
  kOutputFile,
  kPageWidth,
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
  kSectionTitleCitation,
  kSectionTitleFootnotes,
  kSectionTitleReferences,
  kSectionTitleReuse,
  kSelfContained,
  kSelfContainedMath,
  kShiftHeadingLevelBy,
  kSlideLevel,
  kSyntaxDefinitions,
  kTableOfContents,
  kTblColwidths,
  kTemplate,
  kTitleBlockAffiliationPlural,
  kTitleBlockAffiliationSingle,
  kTitleBlockAuthorPlural,
  kTitleBlockAuthorSingle,
  kTitleBlockPublished,
  kTitlePrefix,
  kToc,
  kTocTitleDocument,
  kTocTitleWebsite,
  kTopLevelDivision,
  kVariables,
  kVariant,
  kWarning,
  kWebtex,
} from "./constants.ts";

import { TempContext } from "../core/temp.ts";
import { HtmlPostProcessor } from "../command/render/types.ts";

export const kDependencies = "dependencies";
export const kSassBundles = "sass-bundles";
export const kHtmlPostprocessors = "html-postprocessors";
export const kHtmlFinalizers = "html-finalizers";
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
  uses: string;
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
  templateContext?: FormatTemplateContext;
  html?: {
    [kDependencies]?: FormatDependency[];
    [kSassBundles]?: SassBundle[];
    [kBodyEnvelope]?: BodyEnvelope;
    [kTemplatePatches]?: Array<(template: string) => string>;
    [kHtmlPostprocessors]?: Array<HtmlPostProcessor>;
    [kHtmlFinalizers]?: Array<
      (doc: Document) => Promise<void>
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
    offset?: string,
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
  [kFigPos]?: string | null;
  [kFigEnv]?: string | null;
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
  [kIpynbFilters]?: string[];
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
  [kHighlightStyle]?: string | Record<string, string>;
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
  [kSectionTitleCitation]?: string;
  [kAppendixAttributionBibTex]?: string;
  [kAppendixAttributionCiteAs]?: string;
  [kTitleBlockAffiliationPlural]?: string;
  [kTitleBlockAffiliationSingle]?: string;
  [kTitleBlockAuthorSingle]?: string;
  [kTitleBlockAuthorPlural]?: string;
  [kTitleBlockPublished]?: string;
  [kSectionTitleFootnotes]?: string;
  [kSectionTitleReferences]?: string;
  [kSectionTitleAppendices]?: string;
  [kSectionTitleReuse]?: string;
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
  [kCrossrefSecPrefix]?: string;
  [kCrossrefEqPrefix]?: string;
  [kEnvironmentProofTitle]?: string;
  [kEnvironmentRemarkTitle]?: string;
  [kEnvironmentSolutionTitle]?: string;
  [kListingPageOrderBy]?: string;
  [kListingPageOrderByDateAsc]?: string;
  [kListingPageOrderByDefault]?: string;
  [kListingPageOrderByDateDesc]?: string;
  [kListingPageOrderByNumberAsc]?: string;
  [kListingPageOrderByNumberDesc]?: string;
  [kListingPageFieldDate]?: string;
  [kListingPageFieldTitle]?: string;
  [kListingPageFieldDescription]?: string;
  [kListingPageFieldAuthor]?: string;
  [kListingPageFieldFileName]?: string;
  [kListingPageFieldFileModified]?: string;
  [kListingPageFieldSubtitle]?: string;
  [kListingPageFieldReadingTime]?: string;
  [kListingPageFieldCategories]?: string;
  [kListingPageMinutesCompact]?: string;
  [kListingPageCategoryAll]?: string;
  [kListingPageNoMatches]?: string;

  // langauge variations e.g. eg, fr, etc.
  [key: string]: unknown;
}

export interface FormatTemplateContext {
  template?: string;
  partials?: string[];
}
