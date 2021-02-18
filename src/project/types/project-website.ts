/*
* proejct-website.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import { join } from "path/mod.ts";
import { kOutputDir } from "../../config/project.ts";
import { resourcePath } from "../../core/resources.ts";

import { ProjectCreate, ProjectType } from "./project-types.ts";

export const websiteProjectType: ProjectType = {
  type: "website",
  create: (name: string, outputDir = "_site"): ProjectCreate => {
    const supportingDir = resourcePath(join("projects", "website"));

    return {
      metadata: {
        format: {
          html: {
            css: "styles.css",
          },
        },
        project: {
          [kOutputDir]: outputDir,
        },
      },

      scaffold: [
        {
          name: "index",
          content: "# Home",
        },
        {
          name: "about",
          content: "# About",
        },
      ],

      supporting: [
        "styles.css",
      ].map((path) => join(supportingDir, path)),
    };
  },
};
