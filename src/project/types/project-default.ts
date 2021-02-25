/*
* proejct-default.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import { ProjectCreate, ProjectType } from "./project-types.ts";

export const defaultProjectType: ProjectType = {
  type: "default",

  create: (title: string): ProjectCreate => {
    return {
      scaffold: [{
        name: title,
        content: "",
        title,
      }],
    };
  },
};
