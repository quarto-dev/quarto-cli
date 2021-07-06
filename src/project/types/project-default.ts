/*
* proejct-default.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { join } from "path/mod.ts";

import { resourcePath } from "../../core/resources.ts";

import { ProjectCreate, ProjectType } from "./types.ts";

export const defaultProjectType: ProjectType = {
  type: "default",

  create: (title: string): ProjectCreate => {
    const resourceDir = resourcePath(join("projects", "default"));
    return {
      configTemplate: join(resourceDir, "templates", "_quarto.ejs.yml"),
      resourceDir,
      scaffold: [{
        name: title,
        content:
          "This is a Quarto document. To learn more about Quarto visit <https://quarto.org>.",
        title,
      }],
    };
  },
};
