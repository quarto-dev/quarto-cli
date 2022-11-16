/*
* formats-shared.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/

import { mergeConfigs } from "../core/config.ts";

import {
  kCache,
  kCodeFold,
  kCodeLineNumbers,
  kCodeLink,
  kCodeOverflow,
  kCodeTools,
  kDefaultImageExtension,
  kDfPrint,
  kEcho,
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
  kFigResponsive,
  kFigWidth,
  kFormatResources,
  kFreeze,
  kInclude,
  kIncludeInHeader,
  kIpynbFilters,
  kKeepHidden,
  kKeepIpynb,
  kKeepMd,
  kKeepSource,
  kKeepTex,
  kLang,
  kLatexAutoInstall,
  kLatexAutoMk,
  kLatexClean,
  kLatexInputPaths,
  kLatexMakeIndex,
  kLatexMakeIndexOpts,
  kLatexMaxRuns,
  kLatexOutputDir,
  kLatexTlmgrOpts,
  kLinkExternalIcon,
  kLinkExternalNewwindow,
  kMergeIncludes,
  kMermaidFormat,
  kOutput,
  kOutputDivs,
  kOutputExt,
  kPageWidth,
  kPreferHtml,
  kQuartoVersion,
  kSelfContainedMath,
  kStandalone,
  kTblColwidths,
  kWarning,
  kWrap,
} from "../config/constants.ts";

import { Format } from "../config/types.ts";

import { formatResourcePath } from "../core/resources.ts";
import { quartoConfig } from "../core/quarto.ts";

export function createFormat(ext: string, ...formats: Array<unknown>): Format {
  return mergeConfigs(
    defaultFormat(),
    ...formats,
    {
      render: {
        [kOutputExt]: ext,
      },
    },
  );
}

export function createHtmlFormat(
  figwidth: number,
  figheight: number,
) {
  return createFormat("html", {
    metadata: {
      [kLang]: "en",
      [kFigResponsive]: true,
      [kQuartoVersion]: quartoConfig.version(),
    },
    execute: {
      [kFigFormat]: "retina",
      [kFigWidth]: figwidth,
      [kFigHeight]: figheight,
    },
    render: {
      [kTblColwidths]: "auto",
    },
    pandoc: {
      [kStandalone]: true,
      [kWrap]: "none",
      [kDefaultImageExtension]: "png",
    },
  });
}

export function createHtmlPresentationFormat(
  figwidth: number,
  figheight: number,
): Format {
  return mergeConfigs(
    createHtmlFormat(figwidth, figheight),
    {
      metadata: {
        [kFigResponsive]: false,
      },
      execute: {
        [kEcho]: false,
        [kWarning]: false,
      },
    },
  );
}

export function createEbookFormat(ext: string): Format {
  return createFormat(ext, {
    formatExtras: () => {
      return {
        [kIncludeInHeader]: [
          formatResourcePath("html", "styles-callout.html"),
          formatResourcePath("epub", "styles.html"),
        ],
      };
    },
    render: {
      [kMergeIncludes]: false,
    },
    execute: {
      [kFigWidth]: 5,
      [kFigHeight]: 4,
    },
    pandoc: {
      [kDefaultImageExtension]: "png",
    },
  });
}

export function createWordprocessorFormat(ext: string): Format {
  return createFormat(ext, {
    render: {
      [kPageWidth]: 6.5,
    },
    execute: {
      [kFigWidth]: 5,
      [kFigHeight]: 4,
    },
    pandoc: {
      [kDefaultImageExtension]: "png",
    },
  });
}

export function plaintextFormat(ext: string): Format {
  return createFormat(ext, {
    pandoc: {
      standalone: true,
      [kDefaultImageExtension]: "png",
    },
  });
}

function defaultFormat(): Format {
  return {
    execute: {
      [kFigWidth]: 7,
      [kFigHeight]: 5,
      [kFigFormat]: "png",
      [kFigDpi]: 96,
      [kMermaidFormat]: undefined,
      [kDfPrint]: "default",
      [kError]: false,
      [kEval]: true,
      [kCache]: null,
      [kFreeze]: false,
      [kEcho]: true,
      [kOutput]: true,
      [kWarning]: true,
      [kInclude]: true,
      [kKeepMd]: false,
      [kKeepIpynb]: false,
      [kExecuteIpynb]: null,
      [kExecuteEnabled]: null,
      [kExecuteDaemon]: null,
      [kExecuteDaemonRestart]: false,
      [kExecuteDebug]: false,
      [kIpynbFilters]: [],
    },
    render: {
      [kKeepTex]: false,
      [kKeepSource]: false,
      [kKeepHidden]: false,
      [kPreferHtml]: false,
      [kOutputDivs]: true,
      [kOutputExt]: "html",
      [kFigAlign]: "default",
      [kFigPos]: null,
      [kFigEnv]: null,
      [kCodeFold]: "none",
      [kCodeOverflow]: "scroll",
      [kCodeLink]: false,
      [kCodeLineNumbers]: false,
      [kCodeTools]: false,
      [kTblColwidths]: true,
      [kMergeIncludes]: true,
      [kLatexAutoMk]: true,
      [kLatexAutoInstall]: true,
      [kLatexClean]: true,
      [kLatexMaxRuns]: 1,
      [kLatexMaxRuns]: 10,
      [kLatexMakeIndex]: "makeindex",
      [kLatexMakeIndexOpts]: [],
      [kLatexTlmgrOpts]: [],
      [kLatexInputPaths]: [],
      [kLatexOutputDir]: null,
      [kLinkExternalIcon]: false,
      [kLinkExternalNewwindow]: false,
      [kSelfContainedMath]: false,
      [kFormatResources]: [],
    },
    pandoc: {},
    language: {},
    metadata: {},
  };
}
