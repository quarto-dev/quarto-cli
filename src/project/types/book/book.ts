/*
 * book.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
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
  kDate,
  kDocumentClass,
  kNumberSections,
  kPaperSize,
  kToc,
  kTopLevelDivision,
} from "../../../config/constants.ts";

import {
  HtmlPostProcessResult,
  PandocOptions,
  RenderServices,
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

import { chapterInfoForInput, numberChapterHtmlNav } from "./book-chapters.ts";
import {
  bookConfig,
  BookExtension,
  isMultiFileBookFormat,
  kBook,
  setBookConfig,
} from "./book-shared.ts";
import { kBootstrapDependencyName } from "../../../format/html/format-html-shared.ts";
import { formatHasBootstrap } from "../../../format/html/format-html-info.ts";
import { isSpecialDate, parseSpecialDate } from "../../../core/date.ts";
import { kHtmlEmptyPostProcessResult } from "../../../command/render/constants.ts";

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
  cleanOutputDir: true,
  filterFormat: (source: string, format: Format, project?: ProjectContext) => {
    if (format.extensions?.book) {
      const bookExt = format.extensions?.book as BookExtension;
      if (bookExt.filterFormat) {
        return bookExt.filterFormat(source, format, project);
      } else {
        return format;
      }
    } else {
      return format;
    }
  },
  formatOutputDirectory: (format: Format) => {
    if (format.extensions?.book) {
      const bookExt = format.extensions?.book as BookExtension;
      if (bookExt.formatOutputDirectory) {
        return bookExt.formatOutputDirectory();
      } else {
        return undefined;
      }
    } else {
      return undefined;
    }
  },

  selfContainedOutput: (format: Format) => {
    const bookExtension = format.extensions?.book as BookExtension | undefined;
    return bookExtension?.selfContainedOutput || false;
  },

  config: bookProjectConfig,

  projectFormatsOnly: true,

  isSupportedFormat: (format: Format) => {
    return !!format.extensions?.book;
  },

  filterParams: async (options: PandocOptions) => {
    if (options.format.extensions?.book) {
      const bookExt = options.format.extensions?.book as BookExtension;
      const filterParams = bookExt.filterParams
        ? bookExt.filterParams(options)
        : {};
      if (isMultiFileBookFormat(options.format)) {
        return {
          ...filterParams,
          [kCrossrefResolveRefs]: false,
        };
      } else {
        return {
          ...filterParams,
          [kSingleFileBook]: true,
        };
      }
    }
  },
  pandocRenderer: bookPandocRenderer,

  navItemText: (
    context: ProjectContext,
    input: string,
    text: string,
    number: boolean,
  ) => {
    const chapterInfo = chapterInfoForInput(context, input);
    if (chapterInfo && number) {
      return Promise.resolve(
        numberChapterHtmlNav(text, chapterInfo),
      );
    } else {
      return Promise.resolve(text);
    }
  },

  incrementalRenderAll: bookIncrementalRenderAll,

  // inherit a bunch of behavior from website projects
  preRender: bookPreRender,
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
    services: RenderServices,
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
        services,
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

function bookPreRender(context: ProjectContext): Promise<void> {
  // If the book date is a special date, resolve it
  const date = bookConfig(kDate, context.config);
  if (context.config && isSpecialDate(date)) {
    setBookConfig(
      kDate,
      parseSpecialDate(context.files.input, date),
      context.config,
    );
  }

  if (websiteProjectType.preRender) {
    return websiteProjectType.preRender(context);
  } else {
    return Promise.resolve();
  }
}

function bookHtmlPostprocessor() {
  return (doc: Document): Promise<HtmlPostProcessResult> => {
    // find the cover image
    const coverImage = doc.querySelector(".quarto-cover-image");
    // if the very next element is a section, move it into the section below the header
    const nextEl = (coverImage?.parentNode as Element)?.nextElementSibling;
    if (nextEl && nextEl.tagName === "SECTION" && coverImage?.parentNode) {
      coverImage?.parentElement?.remove();
      nextEl.firstElementChild?.after(coverImage?.parentNode);
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
