/*
* formats.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import {
  kDefaultImageExtension,
  kEcho,
  kFigHeight,
  kFigWidth,
  kOutputDivs,
  kPageWidth,
  kWarning,
} from "../config/constants.ts";

import { Format } from "../config/types.ts";

import { htmlFormat } from "./html/format-html.ts";
import { beamerFormat, latexFormat, pdfFormat } from "./pdf/format-pdf.ts";
import { epubFormat } from "./epub/format-epub.ts";
import { docxFormat } from "./docx/format-docx.ts";
import {
  createEbookFormat,
  createFormat,
  createHtmlPresentationFormat,
  createWordprocessorFormat,
  plaintextFormat,
} from "./formats-shared.ts";
import { revealjsFormat } from "./reveal/format-reveal.ts";
import { ipynbFormat } from "./ipynb/format-ipynb.ts";
import { parseFormatString } from "../core/pandoc/pandoc-formats.ts";
import {
  commonmarkFormat,
  gfmFormat,
  markdownFormat,
  markdownWithCommonmarkExtensionsFormat,
  pandocMarkdownFormat,
} from "./markdown/format-markdown.ts";

export function defaultWriterFormat(to: string): Format {
  // to can sometimes have a variant, don't include that in the lookup here
  const lookupTo = parseFormatString(to).baseFormat;
  let pandocTo = lookupTo;

  // get defaults for writer
  let writerFormat: Format;
  switch (lookupTo) {
    case "html":
    case "html4":
    case "html5":
      writerFormat = htmlFormat(7, 5);
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
      writerFormat = createHtmlPresentationFormat(9.5, 6.5);
      break;
    case "revealjs":
      writerFormat = revealjsFormat();
      break;

    case "markdown":
      writerFormat = pandocMarkdownFormat();
      pandocTo = to;
      break;

    case "markdown_phpextra":
    case "markdown_github":
    case "markdown_mmd":
    case "markdown_strict":
    case "markua":
      writerFormat = markdownFormat();
      pandocTo = to;
      break;

    case "md":
      writerFormat = markdownWithCommonmarkExtensionsFormat();
      pandocTo = "markdown_strict";
      break;

    case "commonmark":
    case "commonmark_x":
      writerFormat = commonmarkFormat(to);
      pandocTo = to;
      break;

    case "gfm":
      writerFormat = gfmFormat();
      pandocTo = to;
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
      writerFormat = docxFormat();
      break;

    case "pptx":
      writerFormat = powerpointFormat();
      break;

    case "odt":
      writerFormat = createWordprocessorFormat("odt");
      break;

    case "opendocument":
      writerFormat = createWordprocessorFormat("xml");
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
      writerFormat = epubFormat();
      break;

    case "fb2":
      writerFormat = createEbookFormat("fb2");
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

    case "biblatex":
    case "bibtex":
      writerFormat = bibliographyFormat("bib");
      break;

    case "csljson":
      writerFormat = bibliographyFormat("csl");
      break;

    case "texttile":
    case "texinfo":
    case "tei":
    case "rst":
    case "org":
    case "opml":
    case "muse":
    case "ms":
    case "native":
    case "man":
    case "dokuwiki":
    case "haddock":
    case "json":
    case "icml":
    case "jira":
    case "mediawiki":
    case "xwiki":
      writerFormat = plaintextFormat(to);
      break;

    default:
      writerFormat = unknownFormat("txt");
  }

  // set the writer
  writerFormat.pandoc = writerFormat.pandoc || {};
  if (!writerFormat.pandoc.to) {
    writerFormat.pandoc.to = pandocTo;
  }

  // return the createFormat
  return writerFormat;
}

function powerpointFormat(): Format {
  return createFormat("pptx", {
    render: {
      [kPageWidth]: 10,
      [kOutputDivs]: false,
    },
    execute: {
      [kFigWidth]: 11,
      [kFigHeight]: 5.5,
      [kEcho]: false,
      [kWarning]: false,
    },
    pandoc: {
      [kDefaultImageExtension]: "png",
    },
  });
}

function rtfFormat(): Format {
  return createFormat("rtf", createWordprocessorFormat("rtf"), {
    pandoc: {
      standalone: true,
    },
  });
}

function unknownFormat(ext: string): Format {
  return createFormat(ext);
}

function bibliographyFormat(ext: string): Format {
  return createFormat(ext);
}
