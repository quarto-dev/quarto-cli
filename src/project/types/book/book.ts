/*
* book.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import { join } from "path/mod.ts";
import { resourcePath } from "../../../core/resources.ts";
import { mergeConfigs } from "../../../core/config.ts";

import {
  Format,
  FormatExtras,
  isEpubOutput,
  isHtmlOutput,
  isLatexOutput,
} from "../../../config/format.ts";
import { PandocFlags } from "../../../config/flags.ts";
import {
  kDocumentClass,
  kNumberSections,
  kToc,
  kTocTitle,
} from "../../../config/constants.ts";
import { disabledTableOfContents } from "../../../config/toc.ts";

import { ProjectCreate, ProjectType } from "../project-types.ts";
import { ProjectContext } from "../../project-context.ts";

import { websiteProjectType } from "../website/website.ts";

import { bookIncrementalRenderAll, bookPandocRenderer } from "./book-render.ts";
import {
  bookProjectConfig,
  kBookAppendix,
  kBookContents,
} from "./book-config.ts";

import { chapterInfoForInput, formatChapterLabel } from "./book-chapters.ts";

export const bookProjectType: ProjectType = {
  type: "book",

  create: (_title: string): ProjectCreate => {
    const resourceDir = resourcePath(join("projects", "book"));

    return {
      configTemplate: join(resourceDir, "templates", "_quarto.ejs.yml"),
      resourceDir,
      scaffold: [
        {
          name: "index",
          content: "## Preface {.unnumbered}",
          format: "html",
        },
        {
          name: "intro",
          content: "# Introduction",
          format: "html",
        },
        {
          name: "summary",
          content: "# Summary",
          format: "html",
        },
        {
          name: "references",
          content: "# References",
          format: "html",
        },
      ],

      supporting: [
        "references.bib",
        "assets/epub-styles.css",
        "assets/epub-cover.png",
        "assets/html-theme.scss",
        "assets/pdf-preamble.tex",
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

  pandocRenderer: bookPandocRenderer,

  navItemText: (context: ProjectContext, input: string, text: string) => {
    const chapterInfo = chapterInfoForInput(context, input);
    if (chapterInfo) {
      return Promise.resolve(formatChapterLabel(text, chapterInfo, true));
    } else {
      return Promise.resolve(text);
    }
  },

  incrementalRenderAll: bookIncrementalRenderAll,

  // inherit a bunch of behavior from website projects
  preRender: websiteProjectType.preRender,
  postRender: websiteProjectType.postRender,
  formatLibDirs: websiteProjectType.formatLibDirs,
  metadataFields: () => [...websiteProjectType.metadataFields!(), "book"],
  resourceIgnoreFields: () => [
    ...websiteProjectType.resourceIgnoreFields!(),
    kBookContents,
    kBookAppendix,
  ],

  // format extras
  formatExtras: async (
    context: ProjectContext,
    input: string,
    flags: PandocFlags,
    format: Format,
  ) => {
    // defaults for all formats
    let extras: FormatExtras = {
      pandoc: {
        [kToc]: !isEpubOutput(format.pandoc),
        [kNumberSections]: true,
      },
    };

    if (isHtmlOutput(format.pandoc, true)) {
      // ensure toc unless explicitly disabled
      if (!disabledTableOfContents(format)) {
        flags = { ...flags, toc: true };
      }
      const websiteExtras = await websiteProjectType.formatExtras!(
        context,
        input,
        flags,
        format,
      );

      // use default toc title for books
      delete websiteExtras[kTocTitle];

      // merge
      extras = mergeConfigs(extras, websiteExtras);

      // documentclass book for latex output
    } else if (isLatexOutput(format.pandoc)) {
      extras = mergeConfigs(
        extras,
        {
          metadata: {
            [kDocumentClass]: "book",
          },
        },
      );
    }

    // return
    return extras;
  },
};
