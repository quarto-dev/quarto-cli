/*
* website-server.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { relative } from "path/mod.ts";

import { fillPlaceholderHtml } from "../../../core/html.ts";

import { kOutputDir, ProjectContext } from "../../project-context.ts";
import { ProjectServe } from "../project-types.ts";
import {
  initWebsiteNavigation,
  navigationBodyEnvelope,
} from "./website-navigation.ts";

export const websiteServe: ProjectServe = {
  init: async (project: ProjectContext) => {
    await initWebsiteNavigation(project);
  },

  filesChanged: async (project: ProjectContext, files: string[]) => {
    for (let i = 0; i < files.length; i++) {
      const projRelative = relative(project.dir, files[i]);
      const configChanged = projRelative.startsWith("_quarto.y");
      if (configChanged) {
        await initWebsiteNavigation(project);
        return true;
      }
    }
    return false;
  },

  htmlFilter: (project: ProjectContext, file: string, doc: Uint8Array) => {
    // compute relative path to output dir
    const outputDir = project.metadata?.project?.[kOutputDir] || project.dir;
    const href = relative(outputDir, file);

    // read html
    let html = new TextDecoder().decode(doc);

    // do we have a toc?
    const toc = html.indexOf(`id="quarto-toc-sidebar"`) !== -1;

    // get body envelope and make substitutions
    const bodyEnvelope = navigationBodyEnvelope(href, toc);

    if (bodyEnvelope.header) {
      html = fillPlaceholderHtml(
        html,
        "envelope-include-in-header",
        bodyEnvelope.header,
      );
    }
    if (bodyEnvelope.before) {
      html = fillPlaceholderHtml(
        html,
        "envelope-include-before-body",
        bodyEnvelope.before,
      );
    }
    if (bodyEnvelope.after) {
      html = fillPlaceholderHtml(
        html,
        "envelope-include-after-body",
        bodyEnvelope.after,
      );
    }

    return new TextEncoder().encode(html);
  },
};
