/*
* proejct-website.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import { join } from "path/mod.ts";
import {
  kLibDir,
  kOutputDir,
  kResources,
  ProjectContext,
} from "../../config/project.ts";
import { resourcePath } from "../../core/resources.ts";
import { projectWebResources } from "../project-utils.ts";

import { ProjectCreate, ProjectType } from "./project-types.ts";

export const websiteProjectType: ProjectType = {
  type: "website",
  create: (_title: string, outputDir = "_site"): ProjectCreate => {
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
          content: "---\ntitle: Home\n---\n",
        },
        {
          name: "about",
          content: "---\ntitle: About\n---\n",
        },
      ],

      supporting: [
        "styles.css",
      ].map((path) => join(supportingDir, path)),
    };
  },

  preRender: (context: ProjectContext) => {
    return {
      project: {
        [kLibDir]: "libs",
        [kOutputDir]: "_site",
        [kResources]: [
          ...projectWebResources(),
          ...(context.metadata?.project?.[kResources] || []),
        ],
        ...context.metadata?.project,
      },
      pandoc: {},
    };
  },
};
