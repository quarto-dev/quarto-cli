/*
* proejct-default.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import { ProjectMetadata } from "../project-context.ts";
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

  config: (config?: ProjectMetadata) => {
    return config;
  },
};
