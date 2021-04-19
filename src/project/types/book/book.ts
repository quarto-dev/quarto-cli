/*
* book.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import { join } from "path/mod.ts";
import { resourcePath } from "../../../core/resources.ts";

import { Format, isLatexOutput } from "../../../config/format.ts";
import { PandocFlags } from "../../../config/flags.ts";
import { kDocumentClass, kNumberSections } from "../../../config/constants.ts";

import { ProjectCreate, ProjectType } from "../project-types.ts";
import { ProjectContext } from "../../project-context.ts";

import { websiteProjectType } from "../website/website.ts";

import { bookPandocRenderer } from "./book-render.ts";
import { bookProjectConfig, kContents } from "./book-config.ts";

export const bookProjectType: ProjectType = {
  type: "book",

  create: (): ProjectCreate => {
    const resourceDir = resourcePath(join("projects", "book"));

    return {
      configTemplate: join(resourceDir, "templates", "_quarto.ejs.yml"),
      resourceDir,
      scaffold: [
        {
          name: "index",
          content: "The preface",
          title: "Preface {.unnumbered}",
          format: "html",
        },
        {
          name: "intro",
          content: "The introduction",
          title: "Introduction",
          format: "html",
        },
        {
          name: "summary",
          content: "The summary",
          title: "Summary",
          format: "html",
        },
        {
          name: "references",
          content: "",
          title: "References",
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

  // inherit a bunch of behavior from website projects
  preRender: websiteProjectType.preRender,
  postRender: websiteProjectType.postRender,
  formatLibDirs: websiteProjectType.formatLibDirs,
  metadataFields: () => [...websiteProjectType.metadataFields!(), kContents],
  resourceIgnoreFields:
    () => [...websiteProjectType.resourceIgnoreFields!(), kContents],

  // format extras
  formatExtras: async (
    context: ProjectContext,
    input: string,
    flags: PandocFlags,
    format: Format,
  ) => {
    // delegate to get website extras
    const websiteExtras = await websiteProjectType.formatExtras!(
      context,
      input,
      flags,
      format,
    );

    // toc by default
    websiteExtras.pandoc = websiteExtras.pandoc || {};
    websiteExtras.pandoc.toc = true;
    websiteExtras.pandoc[kNumberSections] = true;

    // documentclass book by default
    if (isLatexOutput(format.pandoc)) {
      websiteExtras.metadata = websiteExtras.metadata || {};
      websiteExtras.metadata[kDocumentClass] = "book";
    }

    // return
    return websiteExtras;
  },
};
