/*
 * inspect.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { existsSync } from "../deno_ral/fs.ts";
import { dirname, join, relative } from "../deno_ral/path.ts";

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

import { cssFileResourceReferences } from "../core/css.ts";
import {
  projectExcludeDirs,
  projectFileMetadata,
  projectResolveCodeCellsForFile,
} from "../project/project-shared.ts";
import { normalizePath, safeExistsSync } from "../core/path.ts";
import { kExtensionDir } from "../extension/constants.ts";
import { extensionFilesFromDirs } from "../extension/extension.ts";
import { withRenderServices } from "../command/render/render-services.ts";
import { notebookContext } from "../render/notebook/notebook-context.ts";
import { RenderServices } from "../command/render/types.ts";
import { singleFileProjectContext } from "../project/types/single-file/single-file.ts";

import {
  InspectedConfig,
  InspectedDocumentConfig,
  InspectedFile,
  InspectedProjectConfig,
} from "./inspect-types.ts";
import { readAndValidateYamlFromFile } from "../core/schema/validated-yaml.ts";
import { validateDocumentFromSource } from "../core/schema/validate-document.ts";
import { error } from "../deno_ral/log.ts";

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

export async function inspectConfig(path?: string): Promise<InspectedConfig> {
  path = path || Deno.cwd();

  if (!existsSync(path)) {
    throw new Error(`${path} not found`);
  }

  // get quarto version
  let version = quartoConfig.version();
  if (version === kLocalDevelopment) {
    version = "99.9.9";
  }

  const nbContext = notebookContext();
  // get project context (if any)
  const context = await projectContext(path, nbContext);

  const inspectedProjectConfig = async () => {
    if (context?.config) {
      const fileInformation: Record<string, InspectedFile> = {};
      for (const file of context.files.input) {
        const engine = await fileExecutionEngine(file, undefined, context);
        const src = await context.resolveFullMarkdownForFile(engine, file);
        if (engine) {
          const errors = await validateDocumentFromSource(
            src,
            engine.name,
            error,
          );
          if (errors.length) {
            throw new Error(`${path} is not a valid Quarto input document`);
          }
        }

        await projectResolveCodeCellsForFile(context, engine, file);
        await projectFileMetadata(context, file);
        fileInformation[file] = {
          includeMap: context.fileInformationCache.get(file)?.includeMap ?? [],
          codeCells: context.fileInformationCache.get(file)?.codeCells ?? [],
          metadata: context.fileInformationCache.get(file)?.metadata ?? {},
        };
      }
      const config: InspectedProjectConfig = {
        quarto: {
          version,
        },
        dir: context.dir,
        engines: context.engines,
        config: context.config,
        files: context.files,
        fileInformation,
      };
      return config;
    } else {
      return undefined;
    }
  };

  const stat = Deno.statSync(path);
  if (stat.isDirectory) {
    const config = await inspectedProjectConfig();
    if (config) {
      return config;
    } else {
      throw new Error(`${path} is not a Quarto project.`);
    }
  } else {
    const project = await projectContext(path, nbContext) ||
      singleFileProjectContext(path, nbContext);
    const engine = await fileExecutionEngine(path, undefined, project);
    if (engine) {
      // partition markdown
      const partitioned = await engine.partitionedMarkdown(path);

      // get formats
      const context = (await projectContext(path, nbContext)) ||
        singleFileProjectContext(path, nbContext);
      const src = await context.resolveFullMarkdownForFile(engine, path);
      if (engine) {
        const errors = await validateDocumentFromSource(
          src,
          engine.name,
          error,
        );
        if (errors.length) {
          throw new Error(`${path} is not a valid Quarto input document`);
        }
      }
      const formats = await withRenderServices(
        nbContext,
        (services: RenderServices) =>
          renderFormats(path!, services, "all", context),
      );

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

      await context.resolveFullMarkdownForFile(engine, path);
      await projectResolveCodeCellsForFile(context, engine, path);
      await projectFileMetadata(context, path);
      const fileInformation = context.fileInformationCache.get(path);

      // data to write
      const config: InspectedDocumentConfig = {
        quarto: {
          version,
        },
        engines: [engine.name],
        formats,
        resources,
        fileInformation: {
          [path]: {
            includeMap: fileInformation?.includeMap ?? [],
            codeCells: fileInformation?.codeCells ?? [],
            metadata: fileInformation?.metadata ?? {},
          },
        },
      };

      // if there is a project then add it
      if (context?.config) {
        config.project = await inspectedProjectConfig();
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
