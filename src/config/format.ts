/*
* formats.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
* Unless you have received this program directly from RStudio pursuant
* to the terms of a commercial license agreement with RStudio, then
* this program is licensed to you under the terms of version 3 of the
* GNU General Public License. This program is distributed WITHOUT
* ANY EXPRESS OR IMPLIED WARRANTY, INCLUDING THOSE OF NON-INFRINGEMENT,
* MERCHANTABILITY OR FITNESS FOR A PARTICULAR PURPOSE. Please refer to the
* GPL (http://www.gnu.org/licenses/gpl-3.0.txt) for more details.
*
*/

import { mergeConfigs } from "../core/config.ts";

import {
  kAtxHeaders,
  kCiteMethod,
  kCiteproc,
  kFigDpi,
  kIncludeAfterBody,
  kIncludeBeforeBody,
  kIncludeInHeader,
  kKeepYaml,
  kOutputFile,
  kPdfEngine,
  kPdfEngineOpt,
  kPdfEngineOpts,
  kSelfContained,
  kStandalone,
  kTemplate,
  kVariant,
} from "../config/constants.ts";

import { Metadata } from "./metadata.ts";

import {
  kAllowErrors,
  kFigFormat,
  kFigHeight,
  kFigWidth,
  kIncludeCode,
  kIncludeOutput,
  kIncludeWarnings,
  kKeepMd,
  kKeepTex,
  kOutputExt,
} from "./constants.ts";

// pandoc output format
export interface Format {
  render: FormatRender;
  execute: FormatExecute;
  pandoc: FormatPandoc;
  metadata: Metadata;
}

export interface FormatRender {
  [kKeepMd]?: boolean;
  [kKeepYaml]?: boolean;
  [kKeepTex]?: boolean;
  [kVariant]?: string;
  [kOutputExt]?: string;
}

export interface FormatExecute {
  [kFigWidth]?: number;
  [kFigHeight]?: number;
  [kFigFormat]?: "retina" | "png" | "jpeg" | "svg" | "pdf";
  [kFigDpi]?: number;
  [kIncludeCode]?: boolean;
  [kIncludeOutput]?: boolean;
  [kIncludeWarnings]?: boolean;
  [kAllowErrors]?: boolean;
}

export interface FormatPandoc {
  from?: string;
  to?: string;
  writer?: string;
  [kTemplate]?: string;
  [kOutputFile]?: string;
  standalone?: boolean;
  [kSelfContained]?: boolean;
  variables?: { [key: string]: unknown };
  [kAtxHeaders]?: boolean;
  [kIncludeBeforeBody]?: string[];
  [kIncludeAfterBody]?: string[];
  [kIncludeInHeader]?: string[];
  [kCiteproc]?: boolean;
  [kCiteMethod]?: string;
  [kPdfEngine]?: string;
  [kPdfEngineOpts]?: string[];
  [kPdfEngineOpt]?: string;
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
      // ipynb
      // jira
      // mediawiki
      // xwiki
      writerFormat = plaintextFormat(to);
  }

  // set the writer
  writerFormat.pandoc = writerFormat.pandoc || {};
  writerFormat.pandoc.to = to;

  // return the format
  return writerFormat;
}

function pdfFormat(): Format {
  return format(
    "pdf",
    {
      execute: {
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
      execute: {
        [kFigWidth]: 10,
        [kFigHeight]: 7,
        [kIncludeCode]: false,
        [kIncludeWarnings]: false,
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
      execute: {
        [kIncludeCode]: false,
        [kIncludeWarnings]: false,
      },
    },
  );
}

function htmlFormat(figwidth = 7, figheight = 5): Format {
  return format("html", {
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

function markdownFormat(): Format {
  return format("md", plaintextFormat("md"), {
    pandoc: {
      // NOTE: this will become the default in the next
      // version of pandoc, remove this flag after that
      ["atx-headers"]: true,
    },
  });
}

function powerpointFormat(): Format {
  return format("pptx", {
    execute: {
      [kFigWidth]: 7.5,
      [kFigHeight]: 5.5,
      [kIncludeCode]: false,
      [kIncludeWarnings]: false,
    },
  });
}

function wordprocessorFormat(ext: string): Format {
  return format(ext, {
    execute: {
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

function plaintextFormat(ext: string): Format {
  return format(ext, {
    pandoc: {
      standalone: true,
    },
  });
}

function ebookFormat(ext: string): Format {
  return format(ext, {
    execute: {
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
    execute: {
      [kFigWidth]: 7,
      [kFigHeight]: 5,
      [kFigFormat]: "png",
      [kFigDpi]: 96,
      [kIncludeCode]: true,
      [kIncludeOutput]: true,
      [kIncludeWarnings]: true,
      [kAllowErrors]: false,
    },
    render: {
      [kKeepMd]: false,
      [kKeepTex]: false,
      [kKeepYaml]: false,
      [kOutputExt]: "html",
    },
    pandoc: {
      from: "markdown",
    },
    metadata: {},
  };
}
