/*
* website.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { join } from "path/mod.ts";
import {
  kLibDir,
  kOutputDir,
  kResources,
  ProjectMetadata,
} from "../../project-context.ts";
import { resourcePath } from "../../../core/resources.ts";

import { projectWebResources } from "../../project-resources.ts";

import { ProjectCreate, ProjectType } from "../project-types.ts";
import { Format, FormatExtras } from "../../../config/format.ts";
import { formatHasBootstrap } from "../../../format/format-html.ts";

import { websiteNavigation } from "./navigation.ts";

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

  config: (config?: ProjectMetadata) => {
    config = config || {};
    return {
      [kLibDir]: "libs",
      [kOutputDir]: "_site",
      [kResources]: [
        ...projectWebResources(),
        ...(config?.[kResources] || []),
      ],
      ...config,
    };
  },

  formatExtras: (format: Format): FormatExtras => {
    if (formatHasBootstrap(format)) {
      if (format.metadata["navbar"]) {
        return websiteNavigation(format.metadata["navbar"]);
      }
    }
    return {};
  },
};
