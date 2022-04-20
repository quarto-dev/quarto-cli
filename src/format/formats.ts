/*
* formats.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import {
  kDefaultImageExtension,
  kEcho,
  kFigFormat,
  kFigHeight,
  kFigWidth,
  kHtmlMathMethod,
  kKeepYaml,
  kOutputDivs,
  kPageWidth,
  kPreferHtml,
  kVariant,
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
} from "./formats-shared.ts";
import { revealjsFormat } from "./reveal/format-reveal.ts";
import { ipynbFormat } from "./ipynb/format-ipynb.ts";

export function defaultWriterFormat(to: string): Format {
  // to can sometimes have a variant, don't include that in the lookup here
  const lookupTo = to.split(/[+-]/)[0];
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
    writerFormat.pandoc.to = pandocTo;
  }

  // return the createFormat
  return writerFormat;
}

function hugoFormat(): Format {
  return createFormat("md", markdownFormat(), {
    render: {
      [kKeepYaml]: true,
      [kPreferHtml]: true,
      [kVariant]: "+definition_lists+footnotes+smart+tex_math_dollars",
    },
    execute: {
      [kFigFormat]: "retina",
      [kFigWidth]: 8,
      [kFigHeight]: 5,
    },
    pandoc: {
      to: "gfm",
      [kHtmlMathMethod]: "webtex",
    },
  });
}

function gfmFormat(): Format {
  return createFormat("md", markdownFormat(), {
    pandoc: {
      to: "gfm",
      [kHtmlMathMethod]: "webtex",
    },
    render: {
      [kVariant]: "+footnotes+tex_math_dollars-yaml_metadata_block",
    },
  });
}

function commonmarkFormat(to: string) {
  return createFormat("md", markdownFormat(), {
    pandoc: {
      to,
    },
    render: {
      [kVariant]: "-yaml_metadata_block",
    },
  });
}

function pandocMarkdownFormat(): Format {
  return createFormat("md", plaintextFormat("md"), {});
}

function markdownFormat(): Format {
  return createFormat("md", plaintextFormat("md"), {
    // markdown shouldn't include cell divs (even if it
    // technically supports raw html)
    render: {
      [kOutputDivs]: false,
    },
  });
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

function plaintextFormat(ext: string): Format {
  return createFormat(ext, {
    pandoc: {
      standalone: true,
      [kDefaultImageExtension]: "png",
    },
  });
}
