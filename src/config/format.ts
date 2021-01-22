/*
* formats.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { mergeConfigs } from "../core/config.ts";

import {
  kAtxHeaders,
  kCache,
  kCiteMethod,
  kCiteproc,
  kExecute,
  kFigAlign,
  kFigDpi,
  kFilters,
  kFoldCode,
  kIncludeAfterBody,
  kIncludeBeforeBody,
  kIncludeInHeader,
  kKeepHidden,
  kKeepIpynb,
  kKeepYaml,
  kKernelDebug,
  kKernelKeepalive,
  kKernelRestart,
  kLatexAutoInstall,
  kLatexAutoMk,
  kLatexClean,
  kLatexMaxRuns,
  kLatexMinRuns,
  kLatexOutputDir,
  kListings,
  kMarkdownHeadings,
  kNumberOffset,
  kNumberSections,
  kOutputFile,
  kPdfEngine,
  kPdfEngineOpt,
  kPdfEngineOpts,
  kPreferHtml,
  kSelfContained,
  kShowCode,
  kShowOutput,
  kShowWarnings,
  kStandalone,
  kTemplate,
  kVariables,
  kVariant,
} from "../config/constants.ts";

import { Metadata } from "./metadata.ts";

import {
  kAllowErrors,
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
import { boolean } from "https://deno.land/x/cliffy@v0.16.0/flags/types/boolean.ts";

// pandoc output format
export interface Format {
  render: FormatRender;
  execution: FormatExecution;
  pandoc: FormatPandoc;
  metadata: Metadata;
}

export interface FormatRender {
  [kKeepMd]?: boolean;
  [kKeepTex]?: boolean;
  [kKeepYaml]?: boolean;
  [kKeepIpynb]?: boolean;
  [kKeepSource]?: boolean;
  [kPreferHtml]?: boolean;
  [kOutputDivs]?: boolean;
  [kVariant]?: string;
  [kOutputExt]?: string;
  [kPageWidth]?: number;
  [kFigAlign]?: "left" | "right" | "center" | "default";
  [kFoldCode]?: boolean | string;

  [kLatexAutoMk]?: boolean;
  [kLatexAutoInstall]?: boolean;
  [kLatexOutputDir]?: string;
  [kLatexMinRuns]?: number;
  [kLatexMaxRuns]?: number;
  [kLatexClean]?: boolean;
}

export interface FormatExecution {
  [kFigWidth]?: number;
  [kFigHeight]?: number;
  [kFigFormat]?: "retina" | "png" | "jpeg" | "svg" | "pdf";
  [kFigDpi]?: number;
  [kAllowErrors]?: boolean;
  [kExecute]?: boolean;
  [kCache]?: true | false | "refresh";
  [kShowCode]?: boolean;
  [kShowOutput]?: boolean;
  [kShowWarnings]?: boolean;
  [kKeepHidden]?: boolean;
  [kKernelKeepalive]?: number;
  [kKernelRestart]?: boolean;
  [kKernelDebug]?: boolean;
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
  [kListings]?: boolean;
  [kNumberSections]?: boolean;
}

export function isLatexFormat(format: FormatPandoc) {
  return ["pdf", "latex", "beamer"].includes(format.to || "");
}

export function isHtmlFormat(format: FormatPandoc) {
  return [
    "html",
    "html4",
    "html5",
    "s5",
    "dzslides",
    "slidy",
    "slideous",
    "revealjs",
    "epub",
    "epub2",
    "epub3",
  ].includes(format.to || "html");
}

export function isMarkdownFormat(format: FormatPandoc) {
  const to = (format.to || "").replace(/[\+\-_].*$/, "");
  return ["markdown", "gfm", "commonmark"].includes(to);
}

export function defaultWriterFormat(to: string): Format {
  // get defaults for writer
  let writerFormat: Format;
  switch (to) {
    case "html":
    case "html4":
    case "html5":
      writerFormat = htmlFormat();
      break;

    case "pdf":
      writerFormat = pdfFormat();
      break;

    case "beamer":
      writerFormat = beamerFormat();
      break;

    case "latex":
    case "context":
      writerFormat = latexFormat();
      break;

    case "s5":
    case "dzslides":
    case "slidy":
    case "slideous":
      writerFormat = htmlPresentationFormat(9.5, 6.5);
      break;
    case "revealjs":
      writerFormat = htmlPresentationFormat(9, 5);
      break;

    case "markdown":
    case "markdown_phpextra":
    case "markdown_github":
    case "markdown_mmd":
    case "markdown_strict":
    case "gfm":
    case "commonmark":
    case "commonmark_x":
      writerFormat = markdownFormat();
      break;

    case "asciidoc":
      writerFormat = plaintextFormat("txt");
      break;

    case "asciidoctor":
      writerFormat = plaintextFormat("adoc");
      break;

    case "docbook":
    case "docbook4":
    case "docbook5":
      writerFormat = plaintextFormat("xml");
      break;

    case "docx":
      writerFormat = wordprocessorFormat("docx");
      break;

    case "pptx":
      writerFormat = powerpointFormat();
      break;

    case "odt":
      writerFormat = wordprocessorFormat("odt");
      break;

    case "opendocument":
      writerFormat = wordprocessorFormat("xml");
      break;

    case "rtf":
      writerFormat = rtfFormat();
      break;

    case "plain":
      writerFormat = plaintextFormat("txt");
      break;

    case "epub":
    case "epub2":
    case "epub3":
      writerFormat = ebookFormat("epub");
      break;

    case "fb2":
      writerFormat = ebookFormat("fb2");
      break;

    case "zimwiki":
      writerFormat = plaintextFormat("zim");
      break;

    case "jats":
    case "jats_archiving":
    case "jats_articleauthoring":
    case "jats_publishing":
      writerFormat = plaintextFormat("xml");
      break;

    case "ipynb":
      writerFormat = ipynbFormat();
      break;

    // syntesized formats (TODO: move these to quarto.land)

    case "hugo":
      writerFormat = hugoFormat();
      break;

    default:
      // textile
      // texinfo
      // tei
      // rst
      // org
      // opml
      // muse
      // ms
      // native
      // man
      // dokuwiki
      // haddock
      // json
      // icml
      // jira
      // mediawiki
      // xwiki
      writerFormat = plaintextFormat(to);
  }

  // set the writer
  writerFormat.pandoc = writerFormat.pandoc || {};
  if (!writerFormat.pandoc.to) {
    writerFormat.pandoc.to = to;
  }

  // return the format
  return writerFormat;
}

function pdfFormat(): Format {
  return format(
    "pdf",
    {
      execution: {
        [kFigWidth]: 6.5,
        [kFigHeight]: 4.5,
        [kFigFormat]: "pdf",
        [kFigDpi]: 300,
      },
      pandoc: {
        standalone: true,
        variables: {
          graphics: true,
          tables: true,
        },
      },
    },
  );
}

function beamerFormat(): Format {
  return format(
    "pdf",
    pdfFormat(),
    {
      execution: {
        [kFigWidth]: 10,
        [kFigHeight]: 7,
        [kShowCode]: false,
        [kShowWarnings]: false,
      },
    },
  );
}

function latexFormat(): Format {
  return format(
    "tex",
    pdfFormat(),
  );
}

function htmlPresentationFormat(figwidth: number, figheight: number): Format {
  return mergeConfigs(
    htmlFormat(figwidth, figheight),
    {
      execution: {
        [kShowCode]: false,
        [kShowWarnings]: false,
      },
    },
  );
}

function htmlFormat(figwidth = 7, figheight = 5): Format {
  return format("html", {
    execution: {
      [kFigFormat]: "retina",
      [kFigWidth]: figwidth,
      [kFigHeight]: figheight,
    },
    pandoc: {
      [kStandalone]: true,
    },
  });
}

function hugoFormat(): Format {
  return format("md", markdownFormat(), {
    render: {
      [kKeepYaml]: true,
      [kPreferHtml]: true,
      [kVariant]: "+definition_lists+footnotes+smart",
    },
    execution: {
      [kFigFormat]: "retina",
      [kFigWidth]: 8,
      [kFigHeight]: 5,
    },
    pandoc: {
      to: "gfm",
      [kOutputFile]: "index.md",
    },
  });
}

function markdownFormat(): Format {
  return format("md", plaintextFormat("md"), {});
}

function powerpointFormat(): Format {
  return format("pptx", {
    render: {
      [kPageWidth]: 9,
      [kOutputDivs]: false,
    },
    execution: {
      [kFigWidth]: 7.5,
      [kFigHeight]: 5.5,
      [kShowCode]: false,
      [kShowWarnings]: false,
    },
  });
}

function wordprocessorFormat(ext: string): Format {
  return format(ext, {
    render: {
      [kPageWidth]: 6.5,
    },
    execution: {
      [kFigWidth]: 5,
      [kFigHeight]: 4,
    },
  });
}

function rtfFormat(): Format {
  return format("rtf", wordprocessorFormat("rtf"), {
    pandoc: {
      standalone: true,
    },
  });
}

function ipynbFormat(): Format {
  return format("ipynb", {
    pandoc: {
      standalone: true,
      "ipynb-output": "all",
    },
  });
}

function plaintextFormat(ext: string): Format {
  return format(ext, {
    pandoc: {
      standalone: true,
    },
  });
}

function ebookFormat(ext: string): Format {
  return format(ext, {
    execution: {
      [kFigWidth]: 5,
      [kFigHeight]: 4,
    },
  });
}

function format(ext: string, ...formats: Array<unknown>): Format {
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

function defaultFormat(): Format {
  return {
    execution: {
      [kFigWidth]: 7,
      [kFigHeight]: 5,
      [kFigFormat]: "png",
      [kFigDpi]: 96,
      [kAllowErrors]: false,
      [kExecute]: true,
      [kCache]: undefined,
      [kKeepHidden]: false,
      [kShowCode]: true,
      [kShowOutput]: true,
      [kShowWarnings]: true,
      [kKernelKeepalive]: 300,
      [kKernelRestart]: false,
      [kKernelDebug]: false,
    },
    render: {
      [kKeepMd]: false,
      [kKeepTex]: false,
      [kKeepYaml]: false,
      [kKeepIpynb]: false,
      [kPreferHtml]: false,
      [kOutputDivs]: true,
      [kOutputExt]: "html",
      [kFigAlign]: "center",
      [kFoldCode]: false,
      [kLatexAutoMk]: true,
      [kLatexAutoInstall]: true,
      [kLatexClean]: true,
      [kLatexMaxRuns]: 1,
      [kLatexMaxRuns]: 10,
      [kLatexOutputDir]: undefined,
    },
    pandoc: {
      from: "markdown",
    },
    metadata: {},
  };
}
