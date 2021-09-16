/*
* types.ts
*
* JSON Schema for the objects in src/config/types.ts
*
* FIXME this will go to src/resources/schema
*
* Copyright (C) 2021 by RStudio, PBC
*
*/

// FIXME: this is more imports than needed
import {
  kAtxHeaders,
  kCache,
  kCiteMethod,
  kCiteproc,
  kCodeFold,
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
} from "../../config/constants.ts";

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
} from "../../config/constants.ts";

import {
  NumberSchema as Number_,
  BooleanSchema as Boolean_,
  NullSchema as Null_,
  StringSchema as String_,
  enumSchema as enum_,
  oneOfSchema as oneOf_,
  objectSchema as object_,
  arraySchema as array_,
} from "./common.ts";

export const metadataSchema = object_();

export const dependencyFileSchema = object_({
  name: String_,
  path: String_,
  attribs: object_()
}, ["name", "path"]);
  
export const formatDependencySchema = object_({
  name: String_,
  version: String_,
  meta: object_(),
  links: array_(object_({ rel: String_, href: String_ })),
  scripts: array_(dependencyFileSchema),
  stylesheets: array_(dependencyFileSchema),
  resources: array_(dependencyFileSchema)
}, ["name"]);

export const bodyEnvelopeSchema = object_({
  header: String_,
  before: String_,
  after: String_
});

export const sassLayerSchema = object_({
  use: array_(String_),
  defaults: String_,
  functions: String_,
  mixins: String_,
  rules: String_
}, ["defaults", "functions", "mixins", "rules"]);

export const sassBundleSchema = object_({
  key: String_,
  dependency: String_,
  user: sassLayerSchema,
  quarto: sassLayerSchema,
  framework: sassLayerSchema,
  loadPath: String_,
  dark: object_({
    user: sassLayerSchema,
    quarto: sassLayerSchema,
    framework: sassLayerSchema,
    "default": Boolean_
  }),
  attribs: object_({}, [], String_)
}, ["key", "dependency"]);

export const formatRenderOptionsSchema =
  object_({
    [kKeepTex]: Boolean_,
    [kKeepYaml]: Boolean_,
    [kKeepSource]: Boolean_,
    [kKeepHidden]: Boolean_,
    [kPreferHtml]: Boolean_,
    [kOutputDivs]: Boolean_,
    [kVariant]: String_,
    [kOutputExt]: String_,
    [kPageWidth]: Number_,
    [kFigAlign]: enum_("left", "right", "center", "default"),
    [kCodeFold]: oneOf_(enum_("none", "show", "hide"), Boolean_),
    [kCodeSummary]: String_,
    [kCodeOverflow]: enum_("wrap", "scroll"),
    [kCodeLink]: Boolean_,
    [kCodeTools]: oneOf_(Boolean_, object_({
      source: Boolean_,
      toggle: Boolean_,
      caption: String_,
    })),
    [kMergeIncludes]: Boolean_,
    [kSelfContainedMath]: Boolean_,
    [kLatexAutoMk]: Boolean_,
    [kLatexAutoInstall]: Boolean_,
    [kLatexMinRuns]: Number_,
    [kLatexMaxRuns]: Number_,
    [kLatexClean]: Boolean_,
    [kLatexMakeIndex]: String_,
    [kLatexMakeIndexOpts]: array_(String_),
    [kLatexTlmgrOpts]: array_(String_),
    [kLatexOutputDir]: oneOf_(String_, Null_),
    [kLinkExternalIcon]: oneOf_(String_, Boolean_),
    [kLinkExternalNewwindow]: Boolean_,
  });

export const formatExecuteOptionsSchema =
  object_({
    [kFigWidth]: Number_, // FIXME Minimum? other validation?
    [kFigHeight]: Number_, // FIXME Minimum? other validation?
    [kFigFormat]: enum_("retina", "png", "jpeg", "svg", "pdf"),
    [kFigDpi]: Number_, // FIXME Minimum? other validation?
    [kCache]: oneOf_(Boolean_, Null_, enum_("refresh")),
    [kFreeze]: oneOf_(Boolean_, enum_("auto")),
    [kExecuteEnabled]: oneOf_(Boolean_, Null_),
    [kExecuteIpynb]: oneOf_(Boolean_, Null_),
    [kExecuteDaemon]: oneOf_(Number_, Boolean_, Null_),
    [kExecuteDaemonRestart]: Boolean_,
    [kExecuteDebug]: Boolean_,
    [kEngine]: String_,
    [kEval]: oneOf_(Boolean_, Null_),
    [kError]: Boolean_,
    [kEcho]: oneOf_(Boolean_, enum_("fenced")),
    [kOutput]: oneOf_(Boolean_, enum_("all", "asis")),
    [kWarning]: Boolean_,
    [kInclude]: Boolean_,
    [kKeepMd]: Boolean_,
    [kKeepIpynb]: Boolean_
  });

export const formatPandocOptionsSchema =
  object_({
    "from": String_,
    "to": String_,
    "writer": String_,
    [kTemplate]: String_,
    [kOutputFile]: String_,
    "standalone": Boolean_,
    [kSelfContained]: Boolean_,
    [kVariables]: object_(),
    [kAtxHeaders]: Boolean_,
    [kMarkdownHeadings]: Boolean_,
    [kIncludeBeforeBody]: array_(String_),
    [kIncludeAfterBody]: array_(String_),
    [kIncludeInHeader]: array_(String_),
    [kCiteproc]: Boolean_,
    [kCiteMethod]: String_,
    [kFilters]: array_(String_),
    [kPdfEngine]: String_,
    [kPdfEngineOpts]: array_(String_),
    [kPdfEngineOpt]: String_,
    [kEPubCoverImage]: String_,
    [kCss]: oneOf_(String_, array_(String_)),
    [kToc]: Boolean_,
    [kTableOfContents]: Boolean_,
    [kListings]: Boolean_,
    [kNumberSections]: Boolean_,
    [kNumberOffset]: array_(Number_),
    [kHighlightStyle]: String_,
    [kSectionDivs]: Boolean_,
    [kHtmlMathMethod]: oneOf_(String_, object_({ method: String_, url: String_ }, ["method", "url"])),
    [kTopLevelDivision]: String_,
    [kShiftHeadingLevelBy]: Number_,
    [kTitlePrefix]: String_,
  });

export const pandocFlagsSchema = object_({
  to: String_,
  output: String_,
  [kSelfContained]: Boolean_,
  pdfEngine: String_,
  pdfEngineOpts: array_(String_),
  makeIndexOpts: array_(String_),
  tlmgrOpts: array_(String_),
  natbib: Boolean_,
  biblatex: Boolean_,
  [kToc]: Boolean_,
  [kTocTitle]: String_,
  [kListings]: Boolean_,
  [kNumberSections]: Boolean_,
  [kNumberOffset]: array_(Number_),
  [kTopLevelDivision]: String_,
  [kShiftHeadingLevelBy]: String_,
  [kIncludeInHeader]: String_,
  [kIncludeBeforeBody]: String_,
  [kIncludeAfterBody]: String_,
  [kMathjax]: Boolean_,
  [kKatex]: Boolean_,
  [kMathml]: Boolean_,
  [kGladtex]: Boolean_,
  [kWebtex]: Boolean_,
});

export const pdfEngineSchema = object_({
  pdfEngine: String_,
  pdfEngineOpts: array_(String_),
  bibEngine: enum_("natbib", "biblatex"),
  indexEngine: String_,
  indexEngineOpts: array_(String_),
  tlmgrOpts: array_(String_),
}, ["pdfEngine"]);


