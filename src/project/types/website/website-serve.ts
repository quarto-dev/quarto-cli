/*
* website-server.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { dirname, join, relative } from "path/mod.ts";
import { ensureDirSync } from "fs/mod.ts";

import { fillPlaceholderHtml } from "../../../core/html.ts";

import { DependencyFile } from "../../../config/format.ts";

import {
  bootstrapFormatDependency,
  formatHasBootstrap,
} from "../../../format/format-html.ts";

import { resolveFormatsFromMetadata } from "../../../command/render/render.ts";

import {
  kLibDir,
  kOutputDir,
  ProjectContext,
  projectContext,
  projectOutputDir,
} from "../../project-context.ts";
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
        // re-read the config
        project = projectContext(project.dir);

        // rebuild nav structure
        await initWebsiteNavigation(project);

        // copy bootstrap dependency (theme or vars could have changed)
        copyBootstrapDepenency(project);

        // request reload
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

    // do we have a page layout?
    const layout = html.indexOf(`id="quarto-content"`) !== -1;

    // get body envelope and make substitutions
    const bodyEnvelope = navigationBodyEnvelope(href, toc, layout);

    if (bodyEnvelope.before?.dynamic) {
      html = fillPlaceholderHtml(
        html,
        "envelope-include-before-body",
        bodyEnvelope.before.content,
      );
    }
    if (bodyEnvelope.after?.dynamic) {
      html = fillPlaceholderHtml(
        html,
        "envelope-include-after-body",
        bodyEnvelope.after.content,
      );
    }

    return new TextEncoder().encode(html);
  },
};

function copyBootstrapDepenency(project: ProjectContext) {
  // only proceed if we have a lib dir
  const libDir = project?.metadata?.project?.[kLibDir];
  if (!libDir) {
    return;
  }

  // get formats
  const formats = resolveFormatsFromMetadata(
    project.metadata || {},
    project.dir,
  );

  // find a bootstrap format
  const bsFormat = Object.keys(formats).find((format) => {
    return formatHasBootstrap(formats[format]);
  });

  if (bsFormat) {
    const dependency = bootstrapFormatDependency(formats[bsFormat]);
    const dir = `${dependency.name}-${dependency.version}`;
    const targetDir = join(projectOutputDir(project), libDir, dir);
    const copyDeps = (files?: DependencyFile[]) => {
      if (files) {
        for (const file of files) {
          const targetPath = join(targetDir, file.name);
          ensureDirSync(dirname(targetPath));
          Deno.copyFileSync(file.path, targetPath);
        }
      }
    };
    copyDeps(dependency.scripts);
    copyDeps(dependency.stylesheets);
    copyDeps(dependency.resources);
  }
}
