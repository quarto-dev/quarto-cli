/*
 * formats-shared.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
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
  kDisplayName,
  kEcho,
  kError,
  kEval,
  kExecuteDaemon,
  kExecuteDaemonRestart,
  kExecuteDebug,
  kExecuteEnabled,
  kExecuteIpynb,
  kFigAlign,
  kFigAsp,
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
  kInlineIncludes,
  kIpynbFilters,
  kKeepHidden,
  kKeepIpynb,
  kKeepMd,
  kKeepSource,
  kKeepTex,
  kKeepTyp,
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
  kPreserveYaml,
  kQuartoVersion,
  kSelfContainedMath,
  kStandalone,
  kTblColwidths,
  kVariant,
  kWarning,
  kWrap,
} from "../config/constants.ts";

import { Format } from "../config/types.ts";

import { formatResourcePath } from "../core/resources.ts";
import { quartoConfig } from "../core/quarto.ts";

export function createFormat(
  displayName: string,
  ext: string,
  ...formats: Array<unknown>
): Format {
  return mergeConfigs(
    defaultFormat(displayName),
    ...formats,
    {
      render: {
        [kOutputExt]: ext,
      },
    },
  );
}

export function createHtmlFormat(
  displayName: string,
  figwidth: number,
  figheight: number,
) {
  return createFormat(displayName, "html", {
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
  displayName: string,
  figwidth: number,
  figheight: number,
): Format {
  return mergeConfigs(
    createHtmlFormat(displayName, figwidth, figheight),
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

export function createEbookFormat(displayName: string, ext: string): Format {
  return createFormat(displayName, ext, {
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

export function createWordprocessorFormat(
  displayName: string,
  ext: string,
): Format {
  return createFormat(displayName, ext, {
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

export function plaintextFormat(displayName: string, ext: string): Format {
  return createFormat(displayName, ext, {
    pandoc: {
      standalone: true,
      [kDefaultImageExtension]: "png",
    },
  });
}

function defaultFormat(displayName: string): Format {
  return {
    identifier: {
      [kDisplayName]: displayName,
    },
    execute: {
      [kFigWidth]: 7,
      [kFigHeight]: 5,
      [kFigFormat]: "png",
      [kFigDpi]: 96,
      [kFigAsp]: undefined,
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
      [kKeepTyp]: false,
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
      [kInlineIncludes]: false,
      [kPreserveYaml]: false,
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
      [kVariant]: "",
    },
    pandoc: {},
    language: {},
    metadata: {},
  };
}
