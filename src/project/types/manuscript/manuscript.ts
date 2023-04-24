/*
* manuscript.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/

import { resourcePath } from "../../../core/resources.ts";
import { ProjectCreate, ProjectType } from "../types.ts";

import { join } from "path/mod.ts";

const kManuscriptType = "manuscript";

export const manuscriptProjectType: ProjectType = {
  type: kManuscriptType,

  create: (_title: string): ProjectCreate => {
    const resourceDir = resourcePath(join("projects", "manuscript"));
    return {
      configTemplate: join(resourceDir, "templates", "_quarto.ejs.yml"),
      resourceDir,
      scaffold: () => [
        {
          name: "manuscript",
          content: [
            "---",
            "title: My Manscript",
            "---",
            "",
            "## Section 1",
            "This is a section of my manuscript what up.",
          ].join("\n"),
        },
      ],
      supporting: [],
    };
  },
};
