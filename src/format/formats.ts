/*
 * formats.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import {
  kBaseFormat,
  kDefaultImageExtension,
  kEcho,
  kFigHeight,
  kFigWidth,
  kOutputDivs,
  kPageWidth,
  kTargetFormat,
  kVariant,
  kWarning,
} from "../config/constants.ts";

import { Format } from "../config/types.ts";

// these have been moved to imports.ts and imported from top-level quarto.ts
// to avoid circular dependencies
//
// import { htmlFormat } from "./html/format-html.ts";
// import { revealjsFormat } from "./reveal/format-reveal.ts";
// import { asciidocFormat } from "./asciidoc/format-asciidoc.ts";

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
import { ipynbFormat } from "./ipynb/format-ipynb.ts";
import { parseFormatString } from "../core/pandoc/pandoc-formats.ts";
import {
  commonmarkFormat,
  gfmFormat,
  markdownFormat,
  markdownWithCommonmarkExtensionsFormat,
  pandocMarkdownFormat,
} from "./markdown/format-markdown.ts";
import { jatsFormat } from "./jats/format-jats.ts";
import { typstFormat } from "./typst/format-typst.ts";
import { mergePandocVariant } from "../config/metadata.ts";
import { writerFormatHandlers } from "./format-handlers.ts";

export function defaultWriterFormat(to: string): Format {
  // to can sometimes have a variant, don't include that in the lookup here
  const formatDescriptor = parseFormatString(to);
  let lookupTo = formatDescriptor.baseFormat;
  let pandocTo = lookupTo;

  // get defaults for writer
  let writerFormat: Format | undefined;

  let handled = false;
  for (const handler of writerFormatHandlers) {
    const result = handler(lookupTo);
    if (result) {
      handled = true;
      if (result.pandocTo) {
        pandocTo = result.pandocTo;
      }
      writerFormat = result.format;
      break;
    }
  }

  if (!handled) {
    switch (lookupTo) {
      // these have been moved to imports.ts and imported from top-level quarto.ts
      // to avoid circular dependencies
      //
      // case "html":
      // case "html4":
      // case "html5":
      //   writerFormat = htmlFormat(7, 5);
      //   break;
      // case "revealjs":
      //   writerFormat = revealjsFormat();
      //   break;
      // case "asciidoc":
      // case "asciidoctor":
      //   writerFormat = asciidocFormat();
      //   break;

      case "pdf":
        writerFormat = pdfFormat();
        break;

      case "beamer":
        writerFormat = beamerFormat();
        break;

      case "latex":
        writerFormat = latexFormat("LaTeX");
        break;

      case "context":
        writerFormat = latexFormat("ConTeXt");
        break;

      case "s5":
        writerFormat = createHtmlPresentationFormat("S5", 9.5, 6.5);
        break;
      case "dzslides":
        writerFormat = createHtmlPresentationFormat("DZSlides", 9.5, 6.5);
        break;
      case "slidy":
        writerFormat = createHtmlPresentationFormat("Slidy", 9.5, 6.5);
        break;
      case "slideous":
        writerFormat = createHtmlPresentationFormat("Slideous", 9.5, 6.5);
        break;

      case "markdown":
        writerFormat = pandocMarkdownFormat();
        pandocTo = to;
        break;

      case "markdown_phpextra":
      case "markdown_github":
      case "markdown_mmd":
      case "markdown_strict":
        writerFormat = markdownFormat("Markdown");
        pandocTo = to;
        break;

      case "markua":
        writerFormat = markdownFormat("Markua");
        pandocTo = to;
        break;

      case "md":
        writerFormat = markdownWithCommonmarkExtensionsFormat();
        lookupTo = "commonmark";
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

      case "docbook":
      case "docbook4":
      case "docbook5":
        writerFormat = plaintextFormat("DocBook", "xml");
        break;

      case "docx":
        writerFormat = docxFormat();
        break;

      case "pptx":
        writerFormat = powerpointFormat();
        break;

      case "odt":
        writerFormat = createWordprocessorFormat("OpenOffice", "odt");
        break;

      case "opendocument":
        writerFormat = createWordprocessorFormat("OpenDocument", "xml");
        break;

      case "rtf":
        writerFormat = rtfFormat();
        break;

      case "plain":
        writerFormat = plaintextFormat("Text", "txt");
        break;

      case "epub":
      case "epub2":
      case "epub3":
        writerFormat = epubFormat(lookupTo);
        break;

      case "fb2":
        writerFormat = createEbookFormat("FictionBook", "fb2");
        break;

      case "zimwiki":
        writerFormat = plaintextFormat("Zim Wiki", "zim");
        break;

      case "jats":
        writerFormat = jatsFormat("JATS", "xml");
        break;
      case "jats_archiving":
        writerFormat = jatsFormat("JATS Archiving", "xml");
        break;
      case "jats_articleauthoring":
        writerFormat = jatsFormat("JATS Authoring", "xml");
        break;
      case "jats_publishing":
        writerFormat = jatsFormat("JATS Publising", "xml");
        break;

      case "ipynb":
        writerFormat = ipynbFormat();
        break;

      case "biblatex":
        writerFormat = bibliographyFormat("BibLaTeX", "bib");
        break;
      case "bibtex":
        writerFormat = bibliographyFormat("BibTeX", "bib");
        break;
      case "csljson":
        writerFormat = bibliographyFormat("CSL-JSON", "csl");
        break;

      case "typst":
        writerFormat = typstFormat();
        break;

      case "texttile":
        writerFormat = plaintextFormat("Textile", to);
        break;
      case "texinfo":
        writerFormat = plaintextFormat("GNU TexInfo", to);
        break;
      case "tei":
        writerFormat = plaintextFormat("TEI Simple", to);
        break;
      case "rst":
        writerFormat = plaintextFormat("reST", to);
        break;
      case "org":
        writerFormat = plaintextFormat("Org-Mode", to);
        break;
      case "opml":
        writerFormat = plaintextFormat("OPML", to);
        break;
      case "muse":
        writerFormat = plaintextFormat("Muse", to);
        break;
      case "ms":
        writerFormat = plaintextFormat("Groff Manuscript", to);
        break;
      case "native":
        writerFormat = plaintextFormat("Native", to);
        break;
      case "man":
        writerFormat = plaintextFormat("Groff Man Page", to);
        break;
      case "dokuwiki":
        writerFormat = plaintextFormat("DocuWiki", to);
        break;
      case "haddock":
        writerFormat = plaintextFormat("Haddock markup", to);
        break;
      case "json":
        writerFormat = plaintextFormat("JSON", to);
        break;
      case "icml":
        writerFormat = plaintextFormat("InDesign", to);
        break;
      case "jira":
        writerFormat = plaintextFormat("Jira Wiki", to);
        break;
      case "mediawiki":
        writerFormat = plaintextFormat("MediaWiki", to);
        break;
      case "xwiki":
        writerFormat = plaintextFormat("XWiki", to);
        break;

      default:
        writerFormat = unknownFormat("txt");
    }
  }

  if (writerFormat === undefined) {
    throw new Error(
      "Should never get here, but TypeScript's analysis doesn't know.",
    );
  }

  // set the writer
  writerFormat.pandoc = writerFormat.pandoc || {};
  if (!writerFormat.pandoc.to) {
    writerFormat.pandoc.to = pandocTo;
  }

  // Set the originating to
  writerFormat.identifier[kTargetFormat] = to;
  writerFormat.identifier[kBaseFormat] = lookupTo;

  // Merge any explicitly provided variants
  writerFormat.render[kVariant] = mergePandocVariant(
    writerFormat.render[kVariant],
    formatDescriptor.variants.join(""),
  );

  // return the createFormat
  return writerFormat;
}

function powerpointFormat(): Format {
  return createFormat("Powerpoint", "pptx", {
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
  return createFormat("RTF", "rtf", createWordprocessorFormat("RTF", "rtf"), {
    pandoc: {
      standalone: true,
    },
  });
}

function unknownFormat(ext: string): Format {
  return createFormat("Unknown", ext);
}

function bibliographyFormat(displayName: string, ext: string): Format {
  return createFormat(displayName, ext);
}
