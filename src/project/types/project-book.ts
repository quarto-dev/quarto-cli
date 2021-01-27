/*
* proejct-book.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import { ProjectCreate, ProjectType } from "./project-types.ts";

export const bookProjectType: ProjectType = {
  type: "book",
  create: (): ProjectCreate => {
    return {
      metadata: {
        format: {
          html: "default",
          epub: "default",
          pdf: {
            documentclass: "book",
          },
        },
      },

      scaffold: [
        {
          name: "01-intro",
          content: "# Introduction {#sec:introduction}",
        },
        {
          name: "02-summary",
          content: "# Summary {#sec:summary}",
        },
      ],
    };
  },
};
