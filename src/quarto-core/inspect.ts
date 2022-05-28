/*
* inspect.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { existsSync } from "fs/mod.ts";
import { dirname, relative } from "path/mod.ts";

import * as ld from "../core/lodash.ts";

import { kCss, kResources } from "../config/constants.ts";
import { Format } from "../config/types.ts";

import { projectContext } from "../project/project-context.ts";

import { fileExecutionEngine } from "../execute/engine.ts";
import { renderFormats } from "../command/render/render-contexts.ts";
import {
  resolveFileResources,
  resourcesFromMetadata,
} from "../command/render/resources.ts";
import { kLocalDevelopment, quartoConfig } from "../core/quarto.ts";

import { ProjectConfig, ProjectFiles } from "../project/types.ts";
import { cssFileResourceReferences } from "../core/css.ts";

export interface InspectedConfig {
  quarto: {
    version: string;
  };
  engines: string[];
}

export interface InspectedProjectConfig extends InspectedConfig {
  config: ProjectConfig;
  files: ProjectFiles;
}

export interface InspectedDocumentConfig extends InspectedConfig {
  formats: Record<string, Format>;
  resources: string[];
  project?: string;
}

export function isProjectConfig(
  config: InspectedConfig,
): config is InspectedProjectConfig {
  return (config as InspectedProjectConfig).files !== undefined;
}

export function isDocumentConfig(
  config: InspectedConfig,
): config is InspectedDocumentConfig {
  return (config as InspectedDocumentConfig).formats !== undefined;
}

export async function inspectConfig(path: string): Promise<InspectedConfig> {
  path = path || Deno.cwd();

  if (!existsSync(path)) {
    throw new Error(`${path} not found`);
  }

  // get quarto version
  let version = quartoConfig.version();
  if (version === kLocalDevelopment) {
    version = "99.9.9";
  }

  // get project context (if any)
  const context = await projectContext(path);

  const stat = Deno.statSync(path);
  if (stat.isDirectory) {
    if (context?.config) {
      const config: InspectedProjectConfig = {
        quarto: {
          version,
        },
        engines: context.engines,
        config: context.config,
        files: context.files,
      };
      return config;
    } else {
      throw new Error(`${path} is not a quarto project.`);
    }
  } else {
    const engine = fileExecutionEngine(path);
    if (engine) {
      // partition markdown
      const partitioned = await engine.partitionedMarkdown(path);

      // get formats
      const formats = await renderFormats(path);

      // accumulate resources from formats then resolve them
      const resourceConfig: string[] = Object.values(formats).reduce(
        (resources: string[], format: Format) => {
          resources = ld.uniq(resources.concat(
            resourcesFromMetadata(format.metadata[kResources]),
          ));
          // include css specified in metadata
          if (format.pandoc[kCss]) {
            return ld.uniq(resources.concat(
              resourcesFromMetadata(format.pandoc[kCss]),
            ));
          } else {
            return resources;
          }
        },
        [],
      );

      const context = await projectContext(path);
      const fileDir = Deno.realPathSync(dirname(path));
      const resources = await resolveResources(
        context ? context.dir : fileDir,
        fileDir,
        partitioned.markdown,
        resourceConfig,
      );

      // data to write
      const config: InspectedDocumentConfig = {
        quarto: {
          version,
        },
        engines: [engine.name],
        formats,
        resources,
      };

      // if there is a project then add it
      if (context) {
        config.project = relative(dirname(path), context.dir);
      }
      return config;
    } else {
      throw new Error(`${path} is not a valid Quarto input document`);
    }
  }
}

async function resolveResources(
  rootDir: string,
  fileDir: string,
  markdown: string,
  globs: string[],
): Promise<string[]> {
  const resolved = await resolveFileResources(
    rootDir,
    fileDir,
    markdown,
    globs,
  );
  const resources = ld.difference(
    resolved.include,
    resolved.exclude,
  ) as string[];
  const allResources = resources.concat(cssFileResourceReferences(resources));
  return allResources.map((file) => relative(rootDir, file));
}
