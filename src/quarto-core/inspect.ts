/*
 * inspect.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { existsSync } from "fs/mod.ts";
import { dirname, join, relative } from "path/mod.ts";

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
import { projectExcludeDirs } from "../project/project-shared.ts";
import { normalizePath, safeExistsSync } from "../core/path.ts";
import { kExtensionDir } from "../extension/constants.ts";
import { extensionFilesFromDirs } from "../extension/extension.ts";

export interface InspectedConfig {
  quarto: {
    version: string;
  };
  engines: string[];
}

export interface InspectedProjectConfig extends InspectedConfig {
  dir: string;
  config: ProjectConfig;
  files: ProjectFiles;
}

export interface InspectedDocumentConfig extends InspectedConfig {
  formats: Record<string, Format>;
  resources: string[];
  project?: InspectedProjectConfig;
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

  const inspectedProjectConfig = () => {
    if (context?.config) {
      const config: InspectedProjectConfig = {
        quarto: {
          version,
        },
        dir: context.dir,
        engines: context.engines,
        config: context.config,
        files: context.files,
      };
      return config;
    } else {
      return undefined;
    }
  };

  const stat = Deno.statSync(path);
  if (stat.isDirectory) {
    const config = inspectedProjectConfig();
    if (config) {
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
      const context = await projectContext(path);
      const formats = await renderFormats(path, "all", context);

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

      const fileDir = normalizePath(dirname(path));

      const excludeDirs = context ? projectExcludeDirs(context) : [];

      const resources = await resolveResources(
        context ? context.dir : fileDir,
        fileDir,
        excludeDirs,
        partitioned.markdown,
        resourceConfig,
      );

      // if there is an _extensions dir then add it
      const extensions = join(fileDir, kExtensionDir);
      if (safeExistsSync(extensions)) {
        resources.push(
          ...extensionFilesFromDirs([extensions]).map((file) =>
            relative(fileDir, file)
          ),
        );
      }

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
      if (context?.config) {
        config.project = inspectedProjectConfig();
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
  excludeDirs: string[],
  markdown: string,
  globs: string[],
): Promise<string[]> {
  const resolved = await resolveFileResources(
    rootDir,
    fileDir,
    excludeDirs,
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
