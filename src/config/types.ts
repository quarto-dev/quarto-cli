/*
 * types.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */
import { Document } from "../core/deno-dom.ts";

import {
  kAppendixAttributionBibTex,
  kAppendixAttributionCiteAs,
  kArticleNotebookLabel,
  kBackToTop,
  kBaseFormat,
  kCache,
  kCalloutCautionCaption,
  kCalloutImportantCaption,
  kCalloutNoteCaption,
  kCalloutTipCaption,
  kCalloutWarningCaption,
  kCiteMethod,
  kCiteproc,
  kCodeFold,
  kCodeLine,
  kCodeLineNumbers,
  kCodeLines,
  kCodeLink,
  kCodeOverflow,
  kCodeSummary,
  kCodeTools,
  kCodeToolsHideAllCode,
  kCodeToolsMenuCaption,
  kCodeToolsShowAllCode,
  kCodeToolsSourceCode,
  kCodeToolsViewSource,
  kColumns,
  kCopyButtonTooltip,
  kCopyButtonTooltipSuccess,
  kCrossrefApxPrefix,
  kCrossrefChPrefix,
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
  kDfPrint,
  kDisplayName,
  kDownloadUrl,
  kEcho,
  kEmbedResources,
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
  kExtensionName,
  kFigAlign,
  kFigDpi,
  kFigEnv,
  kFigFormat,
  kFigHeight,
  kFigPos,
  kFigWidth,
  kFilterParams,
  kFilters,
  kFormatLinks,
  kFormatResources,
  kFreeze,
  kGladtex,
  kHighlightStyle,
  kHtmlMathMethod,
  kInclude,
  kIncludeAfterBody,
  kIncludeBeforeBody,
  kIncludeInHeader,
  kInlineIncludes,
  kIpynbFilters,
  kIpynbProduceSourceNotebook,
  kKatex,
  kKeepHidden,
  kKeepIpynb,
  kKeepMd,
  kKeepSource,
  kKeepTex,
  kKeepTyp,
  kLatexAutoInstall,
  kLatexAutoMk,
  kLatexClean,
  kLatexInputPaths,
  kLatexMakeIndex,
  kLatexMakeIndexOpts,
  kLatexMaxRuns,
  kLatexMinRuns,
  kLatexOutputDir,
  kLatexTinyTex,
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
  kManuscriptMecaBundle,
  kMarkdownHeadings,
  kMathjax,
  kMathml,
  kMergeIncludes,
  kMermaidFormat,
  kNotebookLinks,
  kNotebookPreserveCells,
  kNotebookPreviewBack,
  kNotebookPreviewDownload,
  kNotebookPreviewDownloadSrc,
  kNotebooks,
  kNotebookSubarticles,
  kNotebookView,
  kNotebookViewStyle,
  kNumberOffset,
  kNumberSections,
  kOtherLinksTitle,
  kOutput,
  kOutputDivs,
  kOutputExt,
  kOutputFile,
  kPageWidth,
  kPdfEngine,
  kPdfEngineOpt,
  kPdfEngineOpts,
  kPreferHtml,
  kPreserveYaml,
  kQuartoFilters,
  kReferenceLocation,
  kRelatedFormatsTitle,
  kRelatedNotebooksTitle,
  kRepoActionLinksEdit,
  kRepoActionLinksIssue,
  kRepoActionLinksSource,
  kResourcePath,
  kSearchClearButtonTitle,
  kSearchCopyLinkTitle,
  kSearchDetatchedCancelButtonTitle,
  kSearchHideMatchesText,
  kSearchLabel,
  kSearchMatchingDocumentsText,
  kSearchMoreMatchText,
  kSearchNoResultsText,
  kSearchSubmitButtonTitle,
  kSectionDivs,
  kSectionTitleAbstract,
  kSectionTitleAppendices,
  kSectionTitleCitation,
  kSectionTitleCopyright,
  kSectionTitleFootnotes,
  kSectionTitleReferences,
  kSectionTitleReuse,
  kSelfContained,
  kSelfContainedMath,
  kShiftHeadingLevelBy,
  kShortcodes,
  kSlideLevel,
  kSourceNotebookPrefix,
  kStandalone,
  kSyntaxDefinitions,
  kTableOfContents,
  kTargetFormat,
  kTblColwidths,
  kTemplate,
  kTitleBlockAffiliationPlural,
  kTitleBlockAffiliationSingle,
  kTitleBlockAuthorPlural,
  kTitleBlockAuthorSingle,
  kTitleBlockModified,
  kTitleBlockPublished,
  kTitlePrefix,
  kToc,
  kTocDepth,
  kTocTitleDocument,
  kTocTitleWebsite,
  kToggleDarkMode,
  kToggleNavigation,
  kToggleReaderMode,
  kToggleSection,
  kToggleSidebar,
  kTopLevelDivision,
  kVariables,
  kVariant,
  kWarning,
  kWebtex,
  kWrap,
} from "./constants.ts";

import { HtmlPostProcessor, RenderServices } from "../command/render/types.ts";
import { QuartoFilterSpec } from "../command/render/types.ts";
import { ProjectContext } from "../project/types.ts";

export const kDependencies = "dependencies";
export const kSassBundles = "sass-bundles";
export const kHtmlPostprocessors = "html-postprocessors";
export const kHtmlFinalizers = "html-finalizers";
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
  external?: boolean;
  meta?: Record<string, string>;
  links?: { rel: string; href: string; type?: string }[];
  scripts?: DependencyHtmlFile[];
  stylesheets?: DependencyHtmlFile[];
  serviceworkers?: DependencyServiceWorker[];
  head?: string;
  resources?: DependencyFile[];
}

export interface DependencyFile {
  name: string;
  path: string;
}

export interface DependencyServiceWorker {
  source: string;
  destination?: string;
}

export interface DependencyHtmlFile extends DependencyFile {
  attribs?: Record<string, string>;
  afterBody?: boolean;
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

export type PandocFilter = {
  type: "json" | "lua";
  path: string;
};

export type QuartoFilter = string | PandocFilter;

export function isPandocFilter(filter: QuartoFilter): filter is PandocFilter {
  return (<PandocFilter> filter).path !== undefined;
}

export interface NotebookPreviewDescriptor {
  notebook: string;
  url?: string;
  title?: string;
  [kDownloadUrl]?: string;
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
    pre?: QuartoFilter[];
    post?: QuartoFilter[];
  };
  [kFilterParams]?: Record<string, unknown>;
  [kNotebooks]?: NotebookPreviewDescriptor[];
  postprocessors?: Array<
    (
      output: string,
    ) => Promise<{ supporting?: string[]; resources?: string[] } | void>
  >;
  templateContext?: FormatTemplateContext;
  html?: {
    [kDependencies]?: FormatDependency[];
    [kSassBundles]?: SassBundle[];
    [kBodyEnvelope]?: BodyEnvelope;
    [kHtmlPostprocessors]?: Array<HtmlPostProcessor>;
    [kHtmlFinalizers]?: Array<
      (doc: Document) => Promise<void>
    >;
    [kTextHighlightingMode]?: "light" | "dark" | "none" | undefined;
    [kQuartoCssVariables]?: string[];
    [kMarkdownAfterBody]?: string[];
  };
}

export interface FormatIdentifier {
  [kBaseFormat]?: string;
  [kTargetFormat]?: string;
  [kDisplayName]?: string;
  [kExtensionName]?: string;
}

// pandoc output format
export interface Format {
  identifier: FormatIdentifier;
  render: FormatRender;
  execute: FormatExecute;
  pandoc: FormatPandoc;
  language: FormatLanguage;
  metadata: Metadata;

  /**
   * mergeAdditionalFormats is populated by render-contexts, and
   * are used to create a Format object with additional formats that
   * have "less priority" than format information from user YAML.
   *
   * Use mergeAdditionalFormats to, e.g., set up custom defaults
   * that are not driven by the output format.
   */
  //deno-lint-ignore no-explicit-any
  mergeAdditionalFormats?: (...configs: any[]) => Format;

  resolveFormat?: (format: Format) => void;
  formatExtras?: (
    input: string,
    markdown: string,
    flags: PandocFlags,
    format: Format,
    libDir: string,
    services: RenderServices,
    offset?: string,
    project?: ProjectContext,
    quiet?: boolean,
  ) => Promise<FormatExtras>;
  formatPreviewFile?: (
    file: string,
    format: Format,
  ) => string;
  extensions?: Record<string, unknown>;
}

export interface FormatRender {
  [kKeepTex]?: boolean;
  [kKeepTyp]?: boolean;
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
  [kShortcodes]?: string[];
  [kMergeIncludes]?: boolean;
  [kInlineIncludes]?: boolean;
  [kPreserveYaml]?: boolean;
  [kLatexAutoMk]?: boolean;
  [kLatexAutoInstall]?: boolean;
  [kLatexMinRuns]?: number;
  [kLatexMaxRuns]?: number;
  [kLatexClean]?: boolean;
  [kLatexInputPaths]?: string[];
  [kLatexMakeIndex]?: string;
  [kLatexMakeIndexOpts]?: string[];
  [kLatexTlmgrOpts]?: string[];
  [kLatexOutputDir]?: string | null;
  [kLatexTinyTex]?: boolean;
  [kLinkExternalIcon]?: string | boolean;
  [kLinkExternalNewwindow]?: boolean;
  [kLinkExternalFilter]?: string;
  [kSelfContainedMath]?: boolean;
  [kFormatResources]?: string[];
  [kFormatLinks]?: boolean | Array<FormatLink | string>;
  [kNotebookLinks]?: boolean | "inline" | "global";
  [kNotebookSubarticles]?: boolean;
  [kNotebookViewStyle]?: "document" | "notebook";
  [kNotebookView]?:
    | boolean
    | NotebookPreviewDescriptor
    | NotebookPreviewDescriptor[];
  [kNotebookPreserveCells]?: boolean;
  [kIpynbProduceSourceNotebook]?: boolean;
}

export interface FormatExecute {
  // done
  [kFigWidth]?: number;
  [kFigHeight]?: number;
  [kFigFormat]?: "retina" | "png" | "jpeg" | "svg" | "pdf";
  [kFigDpi]?: number;
  [kMermaidFormat]?: "png" | "svg" | "js";
  [kDfPrint]?: "default" | "kable" | "tibble" | "paged";
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
  [kEmbedResources]?: boolean;
  [kVariables]?: { [key: string]: unknown };
  [kMarkdownHeadings]?: boolean;
  [kIncludeBeforeBody]?: string[];
  [kIncludeAfterBody]?: string[];
  [kIncludeInHeader]?: string[];
  [kResourcePath]?: string[];
  [kReferenceLocation]?: string;
  [kCiteproc]?: boolean;
  [kCiteMethod]?: string;
  [kFilters]?: QuartoFilter[];
  [kQuartoFilters]?: QuartoFilterSpec;
  [kPdfEngine]?: string;
  [kPdfEngineOpts]?: string[];
  [kPdfEngineOpt]?: string;
  [kEPubCoverImage]?: string;
  [kCss]?: string | string[];
  [kToc]?: boolean;
  [kTableOfContents]?: boolean;
  [kTocDepth]?: number;
  [kListings]?: boolean;
  [kNumberSections]?: boolean;
  [kNumberOffset]?: number[];
  [kHighlightStyle]?: string | Record<string, string> | null;
  [kSectionDivs]?: boolean;
  [kHtmlMathMethod]?: string | { method: string; url: string };
  [kTopLevelDivision]?: string;
  [kShiftHeadingLevelBy]?: number;
  [kTitlePrefix]?: string;
  [kSlideLevel]?: number;
  [kSyntaxDefinitions]?: string[];
  [kColumns]?: number;
  [kWrap]?: "none" | "auto" | "preserve" | number;
}

export interface PandocFlags {
  to?: string;
  output?: string;
  [kStandalone]?: boolean;
  [kSelfContained]?: boolean;
  [kEmbedResources]?: boolean;
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
  [kRelatedFormatsTitle]?: string;
  [kOtherLinksTitle]?: string;
  [kSourceNotebookPrefix]?: string;
  [kRelatedNotebooksTitle]?: string;
  [kCalloutTipCaption]?: string;
  [kCalloutNoteCaption]?: string;
  [kCalloutWarningCaption]?: string;
  [kCalloutImportantCaption]?: string;
  [kCalloutCautionCaption]?: string;
  [kSectionTitleAbstract]?: string;
  [kSectionTitleCitation]?: string;
  [kAppendixAttributionBibTex]?: string;
  [kAppendixAttributionCiteAs]?: string;
  [kTitleBlockAffiliationPlural]?: string;
  [kTitleBlockAffiliationSingle]?: string;
  [kTitleBlockAuthorSingle]?: string;
  [kTitleBlockAuthorPlural]?: string;
  [kTitleBlockPublished]?: string;
  [kTitleBlockModified]?: string;
  [kSectionTitleFootnotes]?: string;
  [kSectionTitleReferences]?: string;
  [kSectionTitleAppendices]?: string;
  [kSectionTitleReuse]?: string;
  [kSectionTitleCopyright]?: string;
  [kCodeSummary]?: string;
  [kCodeLine]?: string;
  [kCodeLines]?: string;
  [kCodeToolsMenuCaption]?: string;
  [kCodeToolsShowAllCode]?: string;
  [kCodeToolsHideAllCode]?: string;
  [kCodeToolsViewSource]?: string;
  [kCodeToolsSourceCode]?: string;
  [kRepoActionLinksEdit]?: string;
  [kRepoActionLinksSource]?: string;
  [kRepoActionLinksIssue]?: string;
  [kSearchLabel]?: string;
  [kSearchNoResultsText]?: string;
  [kCopyButtonTooltip]?: string;
  [kCopyButtonTooltipSuccess]?: string;
  [kBackToTop]?: string;
  [kToggleDarkMode]?: string;
  [kToggleNavigation]?: string;
  [kToggleReaderMode]?: string;
  [kToggleSection]?: string;
  [kToggleSidebar]?: string;
  [kSearchMatchingDocumentsText]?: string;
  [kSearchCopyLinkTitle]?: string;
  [kSearchMoreMatchText]?: string;
  [kSearchHideMatchesText]?: string;
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
  [kCrossrefChPrefix]?: string;
  [kCrossrefApxPrefix]?: string;
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
  [kNotebookPreviewDownload]?: string;
  [kNotebookPreviewDownloadSrc]?: string;
  [kNotebookPreviewBack]?: string;
  [kArticleNotebookLabel]?: string;
  [kManuscriptMecaBundle]?: string;

  // langauge variations e.g. eg, fr, etc.
  [key: string]: unknown;
}

export interface FormatTemplateContext {
  template?: string;
  partials?: string[];
}

export interface FormatLink {
  icon?: string;
  text: string;
  href: string;
  order?: number;
  attr?: Record<string, string>;
}
