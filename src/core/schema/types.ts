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
  kTblColwidths,
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
  kKeepMd,
  kKeepSource,
  kKeepTex,
  kOutputDivs,
  kOutputExt,
  kPageWidth,
} from "../../config/constants.ts";

import {
  anyOfSchema as anyOfS,
  arraySchema as arrayS,
  BooleanSchema as BooleanS,
  enumSchema as enumS,
  NullSchema as NullS,
  NumberSchema as NumberS,
  objectSchema as objectS,
  oneOfSchema as oneOfS,
  StringSchema as StringS,
} from "./common.ts";

export const metadataSchema = objectS();

export const dependencyFileSchema = objectS({
  properties: {
    name: StringS,
    path: StringS,
    attribs: objectS(),
  },
  required: ["name", "path"],
});

export const formatDependencySchema = objectS({
  properties: {
    name: StringS,
    version: StringS,
    meta: objectS(),
    links: arrayS(objectS({
      properties: { rel: StringS, href: StringS },
      description: "be an object with 'rel' and 'href' keys with string values",
    })),
    scripts: arrayS(dependencyFileSchema),
    stylesheets: arrayS(dependencyFileSchema),
    resources: arrayS(dependencyFileSchema),
  },
  required: ["name"],
});

export const bodyEnvelopeSchema = objectS({
  properties: {
    header: StringS,
    before: StringS,
    after: StringS,
  },
});

export const sassLayerSchema = objectS({
  properties: {
    use: arrayS(StringS),
    defaults: StringS,
    functions: StringS,
    mixins: StringS,
    rules: StringS,
  },
  required: ["defaults", "functions", "mixins", "rules"],
});

export const sassBundleSchema = objectS({
  properties: {
    key: StringS,
    dependency: StringS,
    user: sassLayerSchema,
    quarto: sassLayerSchema,
    framework: sassLayerSchema,
    loadPath: StringS,
    dark: objectS({
      properties: {
        user: sassLayerSchema,
        quarto: sassLayerSchema,
        framework: sassLayerSchema,
        "default": BooleanS,
      },
    }),
    attribs: objectS({
      additionalProperties: StringS,
    }),
  },
  required: ["key", "dependency"],
});

export const formatRenderOptionsSchema = objectS({
  properties: {
    [kKeepTex]: BooleanS,
    [kKeepYaml]: BooleanS,
    [kKeepSource]: BooleanS,
    [kKeepHidden]: BooleanS,
    [kPreferHtml]: BooleanS,
    [kOutputDivs]: BooleanS,
    [kVariant]: StringS,
    [kOutputExt]: StringS,
    [kPageWidth]: NumberS,
    [kFigAlign]: enumS("left", "right", "center", "default"),
    [kCodeFold]: oneOfS(enumS("none", "show", "hide"), BooleanS),
    [kCodeSummary]: StringS,
    [kCodeOverflow]: enumS("wrap", "scroll"),
    [kCodeLink]: BooleanS,
    [kCodeTools]: oneOfS(
      BooleanS,
      objectS({
        properties: {
          source: BooleanS,
          toggle: BooleanS,
          caption: StringS,
        },
      }),
    ),
    [kTblColwidths]: anyOfS(BooleanS, enumS("auto"), arrayS(NumberS)),
    [kMergeIncludes]: BooleanS,
    [kSelfContainedMath]: BooleanS,
    [kLatexAutoMk]: BooleanS,
    [kLatexAutoInstall]: BooleanS,
    [kLatexMinRuns]: NumberS,
    [kLatexMaxRuns]: NumberS,
    [kLatexClean]: BooleanS,
    [kLatexMakeIndex]: StringS,
    [kLatexMakeIndexOpts]: arrayS(StringS),
    [kLatexTlmgrOpts]: arrayS(StringS),
    [kLatexOutputDir]: oneOfS(StringS, NullS),
    [kLinkExternalIcon]: oneOfS(StringS, BooleanS),
    [kLinkExternalNewwindow]: BooleanS,
  },
});

export const formatExecuteOptionsSchema = objectS({
  properties: {
    "fig-width": NumberS, // FIXME Minimum? other validation?
    "fig-height": NumberS, // FIXME Minimum? other validation?
    "fig-format": enumS("retina", "png", "jpeg", "svg", "pdf"),
    "fig-dpi": NumberS, // FIXME Minimum? other validation?
    [kCache]: oneOfS(BooleanS, NullS, enumS("refresh")),
    [kFreeze]: oneOfS(BooleanS, enumS("auto")),
    [kExecuteEnabled]: oneOfS(BooleanS, NullS),
    [kExecuteIpynb]: oneOfS(BooleanS, NullS),
    [kExecuteDaemon]: oneOfS(NumberS, BooleanS, NullS),
    [kExecuteDaemonRestart]: BooleanS,
    [kExecuteDebug]: BooleanS,
    [kEngine]: StringS,
    [kEval]: oneOfS(BooleanS, NullS),
    [kError]: BooleanS,
    [kEcho]: oneOfS(BooleanS, enumS("fenced")),
    [kOutput]: oneOfS(BooleanS, enumS("all", "asis")),
    [kWarning]: BooleanS,
    [kInclude]: BooleanS,
    [kKeepMd]: BooleanS,
    [kKeepIpynb]: BooleanS,
  },
});

export const formatPandocOptionsSchema = objectS({
  properties: {
    "from": StringS,
    "to": StringS,
    "writer": StringS,
    [kTemplate]: StringS,
    [kOutputFile]: StringS,
    "standalone": BooleanS,
    [kSelfContained]: BooleanS,
    [kVariables]: objectS(),
    [kAtxHeaders]: BooleanS,
    [kMarkdownHeadings]: BooleanS,
    [kIncludeBeforeBody]: arrayS(StringS),
    [kIncludeAfterBody]: arrayS(StringS),
    [kIncludeInHeader]: arrayS(StringS),
    [kCiteproc]: BooleanS,
    [kCiteMethod]: StringS,
    [kFilters]: arrayS(StringS),
    [kPdfEngine]: StringS,
    [kPdfEngineOpts]: arrayS(StringS),
    [kPdfEngineOpt]: StringS,
    [kEPubCoverImage]: StringS,
    [kCss]: oneOfS(StringS, arrayS(StringS)),
    [kToc]: BooleanS,
    [kTableOfContents]: BooleanS,
    [kListings]: BooleanS,
    [kNumberSections]: BooleanS,
    [kNumberOffset]: arrayS(NumberS),
    [kHighlightStyle]: StringS,
    [kSectionDivs]: BooleanS,
    [kHtmlMathMethod]: oneOfS(
      StringS,
      objectS({
        properties: { method: StringS, url: StringS },
        required: ["method", "url"],
      }),
    ),
    [kTopLevelDivision]: StringS,
    [kShiftHeadingLevelBy]: NumberS,
    [kTitlePrefix]: StringS,
  },
});

export const pandocFlagsSchema = objectS({
  properties: {
    to: StringS,
    output: StringS,
    [kSelfContained]: BooleanS,
    pdfEngine: StringS,
    pdfEngineOpts: arrayS(StringS),
    makeIndexOpts: arrayS(StringS),
    tlmgrOpts: arrayS(StringS),
    natbib: BooleanS,
    biblatex: BooleanS,
    [kToc]: BooleanS,
    [kTocTitle]: StringS,
    [kListings]: BooleanS,
    [kNumberSections]: BooleanS,
    [kNumberOffset]: arrayS(NumberS),
    [kTopLevelDivision]: StringS,
    [kShiftHeadingLevelBy]: StringS,
    [kIncludeInHeader]: StringS,
    [kIncludeBeforeBody]: StringS,
    [kIncludeAfterBody]: StringS,
    [kMathjax]: BooleanS,
    [kKatex]: BooleanS,
    [kMathml]: BooleanS,
    [kGladtex]: BooleanS,
    [kWebtex]: BooleanS,
  },
});

export const pdfEngineSchema = objectS({
  properties: {
    pdfEngine: StringS,
    pdfEngineOpts: arrayS(StringS),
    bibEngine: enumS("natbib", "biblatex"),
    indexEngine: StringS,
    indexEngineOpts: arrayS(StringS),
    tlmgrOpts: arrayS(StringS),
  },
  required: ["pdfEngine"],
});
