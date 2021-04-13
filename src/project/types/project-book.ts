/*
* project-book.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import { join } from "path/mod.ts";
import { ExecutedFile } from "../../command/render/render.ts";
import { resourcePath } from "../../core/resources.ts";

import { ProjectCreate, ProjectType } from "./project-types.ts";

export const bookProjectType: ProjectType = {
  type: "book",

  create: (): ProjectCreate => {
    const resourceDir = resourcePath(join("projects", "book"));

    return {
      configTemplate: join(resourceDir, "templates", "_quarto.ejs.yml"),
      resourceDir,
      scaffold: [
        {
          name: "01-intro",
          content: "The introduction",
          title: "Introduction",
          format: "html",
        },
        {
          name: "02-summary",
          content: "The summary",
          title: "Summary",
          format: "html",
        },
        {
          name: "03-references",
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

  pandocRenderer: () => {
    return {
      onRender: (file: ExecutedFile) => {
        return Promise.resolve();
      },
      onComplete: () => {
        return Promise.resolve({});
      },
      onError: () => {
      },
    };
  },
};
