/*
* formats.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { mergeConfigs } from "../core/config.ts";

import {
  kAllowErrors,
  kCache,
  kCodeFold,
  kCodeSummary,
  kExecute,
  kFigAlign,
  kFigDpi,
  kFigFormat,
  kFigHeight,
  kFigWidth,
  kFreeze,
  kKeepHidden,
  kKeepIpynb,
  kKeepMd,
  kKeepTex,
  kKeepYaml,
  kKernelDebug,
  kKernelKeepalive,
  kKernelRestart,
  kLatexAutoInstall,
  kLatexAutoMk,
  kLatexClean,
  kLatexMakeIndex,
  kLatexMakeIndexOpts,
  kLatexMaxRuns,
  kLatexOutputDir,
  kLatexTlmgrOpts,
  kOutputDivs,
  kOutputExt,
  kOutputFile,
  kPageWidth,
  kPreferHtml,
  kShowCode,
  kShowOutput,
  kShowWarnings,
  kStandalone,
  kVariant,
} from "../config/constants.ts";

import { Format } from "../config/format.ts";

import { htmlFormat } from "./html/format-html.ts";

export function defaultWriterFormat(to: string): Format {
  // to can sometimes have a variant, don't include that in the lookup here
  const lookupTo = to.split("+")[0];
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
    writerFormat.pandoc.to = pandocTo;
  }

  // return the format
  return writerFormat;
}

export function baseHtmlFormat(
  figwidth: number,
  figheight: number,
) {
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
    baseHtmlFormat(figwidth, figheight),
    {
      execution: {
        [kShowCode]: false,
        [kShowWarnings]: false,
      },
    },
  );
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
      [kExecute]: null,
      [kCache]: null,
      [kFreeze]: false,
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
      [kCodeFold]: "none",
      [kCodeSummary]: "Code",
      [kLatexAutoMk]: true,
      [kLatexAutoInstall]: true,
      [kLatexClean]: true,
      [kLatexMaxRuns]: 1,
      [kLatexMaxRuns]: 10,
      [kLatexMakeIndex]: "makeindex",
      [kLatexMakeIndexOpts]: [],
      [kLatexTlmgrOpts]: [],
      [kLatexOutputDir]: null,
    },
    pandoc: {
      from: "markdown",
    },
    metadata: {},
  };
}
