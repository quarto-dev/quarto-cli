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
  ProjectContext,
  ProjectMetadata,
} from "../../project-context.ts";
import { resourcePath } from "../../../core/resources.ts";

import { ProjectCreate, ProjectType } from "../project-types.ts";
import { Format, FormatExtras } from "../../../config/format.ts";
import { formatHasBootstrap } from "../../../format/format-html.ts";

import { websiteNavigation } from "./navigation.ts";

const kNavbar = "navbar";
const kSidebar = "sidebar";

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
      ...config,
      [kOutputDir]: config[kOutputDir] || "_site",
    };
  },

  formatExtras: (
    inputDir: string,
    project: ProjectContext,
    format: Format,
  ): Promise<FormatExtras> => {
    if (formatHasBootstrap(format)) {
      if (format.metadata[kNavbar]) {
        return websiteNavigation(inputDir, project, format.metadata[kNavbar]);
      }
    }
    return Promise.resolve({});
  },

  metadataFields: () => [kNavbar, kSidebar],
};
