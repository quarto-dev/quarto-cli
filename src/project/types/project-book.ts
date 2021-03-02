/*
* proejct-book.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import { join } from "path/mod.ts";
import { kIncludeInHeader } from "../../config/constants.ts";
import {
  kLibDir,
  kOutputDir,
  kResources,
  ProjectContext,
  ProjectMetadata,
} from "../project-context.ts";
import { resourcePath } from "../../core/resources.ts";

import { projectWebResources } from "../project-resources.ts";

import { ProjectCreate, ProjectType } from "./project-types.ts";

export const bookProjectType: ProjectType = {
  type: "book",
  create: (_title: string, outputDir = "_book"): ProjectCreate => {
    const supportingDir = resourcePath(join("projects", "book"));

    return {
      metadata: {
        format: {
          html: {
            css: "styles.css",
          },
          epub: {
            css: "styles.css",
          },
          pdf: {
            documentclass: "book",
            [kIncludeInHeader]: "preamble.tex",
          },
        },
        project: {
          [kOutputDir]: outputDir,
        },
        bibliography: "references.bib",
      },

      scaffold: [
        {
          name: "01-intro",
          content: "# Introduction",
        },
        {
          name: "02-summary",
          content: "# Summary",
        },
        {
          name: "03-references",
          content: "# References {-}",
        },
      ],

      supporting: [
        "references.bib",
        "styles.css",
        "preamble.tex",
      ].map((path) => join(supportingDir, path)),
    };
  },

  config: (config?: ProjectMetadata) => {
    config = config || {};
    return {
      [kLibDir]: "libs",
      [kOutputDir]: "_book",
      [kResources]: [
        ...projectWebResources(),
        ...(config?.[kResources] || []),
      ],
      ...config,
    };
  },

  preRender: (_context: ProjectContext) => {
    return {
      pandoc: {},
    };
  },
};
