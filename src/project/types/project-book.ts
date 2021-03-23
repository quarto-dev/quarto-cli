/*
* proejct-book.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import { join } from "path/mod.ts";
import { resourcePath } from "../../core/resources.ts";

import { ProjectCreate, ProjectType } from "./project-types.ts";

export const bookProjectType: ProjectType = {
  type: "book",

  create: (): ProjectCreate => {
    const supportingDir = resourcePath(join("projects", "book"));

    return {
      configTemplate: join(supportingDir, "templates", "_quarto.ejs.yml"),
      scaffold: [
        {
          name: "01-intro",
          content: "The introduction",
          title: "Introduction",
        },
        {
          name: "02-summary",
          content: "The summary",
          title: "Summary",
        },
        {
          name: "03-references",
          content: "",
          title: "References",
        },
      ],

      supporting: [
        "references.bib",
        "styles.css",
        "preamble.tex",
      ].map((path) => join(supportingDir, path)),
    };
  },

  libDir: "libs",
  outputDir: "_book",
};
