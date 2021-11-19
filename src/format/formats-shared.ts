/*
* formats-shared.ts
*
* Copyright (C) 2020 by RStudio, PBC
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
  kFigFormat,
  kFigHeight,
  kFigResponsive,
  kFigWidth,
  kFreeze,
  kInclude,
  kIncludeInHeader,
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
  kLatexOutputDir,
  kLatexTlmgrOpts,
  kLinkExternalIcon,
  kLinkExternalNewwindow,
  kMergeIncludes,
  kOutput,
  kOutputDivs,
  kOutputExt,
  kPageWidth,
  kPreferHtml,
  kSelfContainedMath,
  kStandalone,
  kWarning,
} from "../config/constants.ts";

import { Format } from "../config/types.ts";

import { formatResourcePath } from "../core/resources.ts";

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
      [kFigResponsive]: true,
    },
    execute: {
      [kFigFormat]: "retina",
      [kFigWidth]: figwidth,
      [kFigHeight]: figheight,
    },
    pandoc: {
      [kStandalone]: true,
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
        [kIncludeInHeader]: [formatResourcePath("epub", "styles.html")],
      };
    },
    render: {
      [kMergeIncludes]: false,
    },
    execute: {
      [kFigWidth]: 5,
      [kFigHeight]: 4,
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
  });
}

function defaultFormat(): Format {
  return {
    execute: {
      [kFigWidth]: 7,
      [kFigHeight]: 5,
      [kFigFormat]: "png",
      [kFigDpi]: 96,
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
    },
    render: {
      [kKeepTex]: false,
      [kKeepYaml]: false,
      [kKeepSource]: false,
      [kKeepHidden]: false,
      [kPreferHtml]: false,
      [kOutputDivs]: true,
      [kOutputExt]: "html",
      [kFigAlign]: "default",
      [kCodeFold]: "none",
      [kCodeOverflow]: "scroll",
      [kCodeLink]: false,
      [kCodeLineNumbers]: false,
      [kCodeTools]: false,
      [kMergeIncludes]: true,
      [kSelfContainedMath]: false,
      [kLatexAutoMk]: true,
      [kLatexAutoInstall]: true,
      [kLatexClean]: true,
      [kLatexMaxRuns]: 1,
      [kLatexMaxRuns]: 10,
      [kLatexMakeIndex]: "makeindex",
      [kLatexMakeIndexOpts]: [],
      [kLatexTlmgrOpts]: [],
      [kLatexOutputDir]: null,
      [kLinkExternalIcon]: false,
      [kLinkExternalNewwindow]: false,
    },
    pandoc: {},
    language: {},
    metadata: {},
  };
}
