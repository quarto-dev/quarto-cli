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
  kVariant,
} from "../config/constants.ts";

import { Metadata } from "./metadata.ts";

import {
  kFigFormat,
  kFigHeight,
  kFigWidth,
  kKeepMd,
  kKeepTex,
  kOutputExt,
  kShowCode,
  kShowWarning,
} from "./constants.ts";

// pandoc output format
export interface Format {
  render: FormatRender;
  compute: FormatCompute;
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

export interface FormatCompute {
  [kFigWidth]?: number;
  [kFigHeight]?: number;
  [kFigFormat]?: "png" | "pdf";
  [kShowCode]?: boolean;
  [kShowWarning]?: boolean;
}

export interface FormatPandoc {
  from?: string;
  to?: string;
  writer?: string;
  [kOutputFile]?: string;
  standalone?: boolean;
  [kSelfContained]?: boolean;
  variables?: { [key: string]: unknown };
  [kAtxHeaders]?: boolean;
  [kIncludeBeforeBody]?: string[];
  [kIncludeAfterBody]?: string[];
  [kIncludeInHeader]?: string[];
  [kCiteMethod]?: string;
  [kPdfEngine]?: string;
  [kPdfEngineOpts]?: string[];
  [kPdfEngineOpt]?: string;
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

    /*
 
 
    dokuwiki
    dzslides
    epub
    epub2
    epub3
    fb2
    haddock
    icml
    ipynb
    jats
    jats_archiving
    jats_articleauthoring
    jats_publishing
    jira
    json
    man
    mediawiki
    ms
    muse
    native
    opml
    org
    plain
    rst
    tei
    texinfo
    textile
    xwiki
    zimwiki
    */

    default:
      writerFormat = format(to);
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
      compute: {
        [kFigWidth]: 6.5,
        [kFigHeight]: 4.5,
        [kFigFormat]: "pdf",
      },
      pandoc: {
        standalone: true,
        variables: {
          graphics: true,
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
      compute: {
        [kFigWidth]: 10,
        [kFigHeight]: 7,
        [kShowCode]: false,
        [kShowWarning]: false,
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
      compute: {
        [kShowCode]: false,
        [kShowWarning]: false,
      },
    },
  );
}

function htmlFormat(figwidth = 7, figheight = 5): Format {
  return format("html", {
    compute: {
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
    compute: {
      [kFigWidth]: 7.5,
      [kFigHeight]: 5.5,
      [kShowCode]: false,
      [kShowWarning]: false,
    },
  });
}

function wordprocessorFormat(ext: string): Format {
  return format(ext, {
    compute: {
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
    compute: {
      [kFigWidth]: 7,
      [kFigHeight]: 5,
      [kFigFormat]: "png",
      [kShowCode]: true,
      [kShowWarning]: true,
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
