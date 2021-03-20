/*
* website-server.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { ProjectContext } from "../../project-context.ts";
import { ProjectServe } from "../project-types.ts";
import { initWebsiteNavigation } from "./website-navigation.ts";

export const websiteServe: ProjectServe = {
  init: async (project: ProjectContext) => {
    await initWebsiteNavigation(project);
  },
};
