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

// things we need to know to implement hot-reload:
//
//
//   - the last modified time of _quarto.yml (and any file referenced from it, including recursively)
//     (modulo the inputFiles -- consider include or exclude list
//
//
//
