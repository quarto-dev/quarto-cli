/*
* book.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { Document, Element } from "../../../core/deno-dom.ts";

import { join } from "path/mod.ts";
import { resourcePath } from "../../../core/resources.ts";
import { mergeConfigs } from "../../../core/config.ts";

import {
  Format,
  FormatExtras,
  kHtmlPostprocessors,
  kSassBundles,
} from "../../../config/types.ts";
import {
  isEpubOutput,
  isHtmlOutput,
  isLatexOutput,
} from "../../../config/format.ts";
import { PandocFlags } from "../../../config/types.ts";
import {
  kCrossref,
  kCrossrefChapters,
  kDocumentClass,
  kNumberSections,
  kPaperSize,
  kToc,
  kTopLevelDivision,
} from "../../../config/constants.ts";
import { disabledTableOfContents } from "../../../config/toc.ts";

import {
  HtmlPostProcessResult,
  kHtmlEmptyPostProcessResult,
  PandocOptions,
} from "../../../command/render/types.ts";

import { ProjectCreate, ProjectType } from "../types.ts";
import { ProjectContext } from "../../types.ts";
import { kCrossrefResolveRefs } from "../../project-crossrefs.ts";

import { websiteProjectType } from "../website/website.ts";

import {
  bookIncrementalRenderAll,
  bookPandocRenderer,
  bookPostRender,
} from "./book-render.ts";
import { bookProjectConfig } from "./book-config.ts";

import { chapterInfoForInput, formatChapterHtmlNav } from "./book-chapters.ts";
import { isMultiFileBookFormat, kBook } from "./book-shared.ts";
import { kBootstrapDependencyName } from "../../../format/html/format-html-shared.ts";
import { formatHasBootstrap } from "../../../format/html/format-html-bootstrap.ts";
import { TempContext } from "../../../core/temp.ts";

const kSingleFileBook = "single-file-book";

export const bookProjectType: ProjectType = {
  type: "book",

  inheritsType: websiteProjectType.type,

  create: (_title: string): ProjectCreate => {
    const resourceDir = resourcePath(join("projects", "book"));

    return {
      configTemplate: join(resourceDir, "templates", "_quarto.ejs.yml"),
      resourceDir,
      scaffold: () => [
        {
          name: "index",
          content: "# Preface {.unnumbered}\n\n" +
            "This is a Quarto book.\n\n" +
            "To learn more about Quarto books visit <https://quarto.org/docs/books>.",
        },
        {
          name: "intro",
          content: "# Introduction\n\n" +
            "This is a book created from markdown and executable code.\n\n" +
            "See @knuth84 for additional discussion of literate programming.",
        },
        {
          name: "summary",
          content:
            "# Summary\n\nIn summary, this book has no content whatsoever.",
        },
        {
          name: "references",
          content: "# References {.unnumbered}\n\n::: {#refs}\n:::",
          noEngineContent: true,
        },
      ],

      supporting: [
        "cover.png",
        "references.bib",
      ],
    };
  },

  libDir: "site_libs",
  outputDir: "_book",

  config: bookProjectConfig,

  projectFormatsOnly: true,

  isSupportedFormat: (format: Format) => {
    return !!format.extensions?.book;
  },

  filterParams: (options: PandocOptions) => {
    if (isMultiFileBookFormat(options.format)) {
      return {
        [kCrossrefResolveRefs]: false,
      };
    } else {
      return {
        [kSingleFileBook]: true,
      };
    }
  },

  pandocRenderer: bookPandocRenderer,

  navItemText: (context: ProjectContext, input: string, text: string) => {
    const chapterInfo = chapterInfoForInput(context, input);
    if (chapterInfo) {
      return Promise.resolve(
        formatChapterHtmlNav(text, chapterInfo),
      );
    } else {
      return Promise.resolve(text);
    }
  },

  incrementalRenderAll: bookIncrementalRenderAll,

  // inherit a bunch of behavior from website projects
  preRender: websiteProjectType.preRender,
  postRender: bookPostRender,
  formatLibDirs: websiteProjectType.formatLibDirs,
  metadataFields: () => [...websiteProjectType.metadataFields!(), "book"],
  resourceIgnoreFields: () => [
    ...websiteProjectType.resourceIgnoreFields!(),
    kBook,
  ],

  // format extras
  formatExtras: async (
    context: ProjectContext,
    source: string,
    flags: PandocFlags,
    format: Format,
    temp: TempContext,
  ) => {
    // defaults for all formats
    let extras: FormatExtras = {
      pandoc: {
        [kToc]: !isEpubOutput(format.pandoc),
        [kNumberSections]: true,
      },
      metadata: {
        [kCrossref]: {
          [kCrossrefChapters]: true,
        },
      },
    };

    if (isHtmlOutput(format.pandoc, true)) {
      // include scss bundle
      if (formatHasBootstrap(format)) {
        extras.html = {
          [kSassBundles]: [bookScssBundle()],
          [kHtmlPostprocessors]: [bookHtmlPostprocessor()],
        };
      }

      const websiteExtras = await websiteProjectType.formatExtras!(
        context,
        source,
        flags,
        format,
        temp,
      );

      // merge
      extras = mergeConfigs(extras, websiteExtras);

      // documentclass report for latex output
    } else if (isLatexOutput(format.pandoc)) {
      extras = mergeConfigs(
        extras,
        {
          metadata: {
            [kDocumentClass]: "scrreprt",
            [kPaperSize]: "letter",
          },
          pandoc: {
            [kTopLevelDivision]: "chapter",
          },
        },
      );
    }

    // return
    return extras;
  },
};

function bookHtmlPostprocessor() {
  return (doc: Document): Promise<HtmlPostProcessResult> => {
    // find the cover image
    const coverImage = doc.querySelector(".quarto-cover-image");
    // if the very next element is a section, move it into the section below the header
    const nextEl = (coverImage?.parentNode as Element)?.nextElementSibling;
    if (nextEl && nextEl.tagName === "SECTION" && coverImage?.parentNode) {
      coverImage?.parentNode.remove();
      nextEl.firstChild.after(coverImage?.parentNode);
    }

    return Promise.resolve(kHtmlEmptyPostProcessResult);
  };
}

function bookScssBundle() {
  const scssPath = resourcePath("projects/book/book.scss");
  return {
    dependency: kBootstrapDependencyName,
    key: scssPath,
    quarto: {
      name: "quarto-book.css",
      uses: "",
      defaults: "",
      functions: "",
      mixins: "",
      rules: Deno.readTextFileSync(scssPath),
    },
  };
}
