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
import { quartoConfig } from "../core/quarto.ts";

import { cssFileResourceReferences } from "../core/css.ts";
import {
  projectExcludeDirs,
  projectFileMetadata,
  projectResolveCodeCellsForFile,
  withProjectCleanup,
} from "../project/project-shared.ts";
import { normalizePath, safeExistsSync } from "../core/path.ts";
import { kExtensionDir } from "../extension/constants.ts";
import {
  createExtensionContext,
  extensionFilesFromDirs,
} from "../extension/extension.ts";
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
import { validateDocumentFromSource } from "../core/schema/validate-document.ts";
import { error } from "../deno_ral/log.ts";
import { ProjectContext } from "../project/types.ts";

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

  const stat = Deno.statSync(path);
  if (stat.isDirectory) {
    const nbContext = notebookContext();
    const ctx = await projectContext(path, nbContext);
    if (!ctx) {
      throw new Error(`${path} is not a Quarto project.`);
    }
    const config = await withProjectCleanup(ctx, inspectProjectConfig);
    if (!config) {
      throw new Error(`${path} is not a Quarto project.`);
    }
    return config;
  } else {
    return await inspectDocumentConfig(path);
  }
}

const inspectProjectConfig = async (context: ProjectContext) => {
  if (!context.config) {
    return undefined;
  }
  const fileInformation: Record<string, InspectedFile> = {};
  for (const file of context.files.input) {
    await populateFileInformation(context, fileInformation, file);
  }
  const extensions = await populateExtensionInformation(context);
  const config: InspectedProjectConfig = {
    quarto: {
      version: quartoConfig.version(),
    },
    dir: context.dir,
    engines: context.engines,
    config: context.config,
    files: context.files,
    fileInformation,
    extensions: extensions,
  };
  return config;
};

const populateExtensionInformation = async (
  context: ProjectContext,
) => {
  const extensionContext = createExtensionContext();
  return await extensionContext.extensions(
    context.dir,
    context.config,
    context.dir,
    { builtIn: false },
  );
};

const populateFileInformation = async (
  context: ProjectContext,
  fileInformation: Record<string, InspectedFile>,
  file: string,
) => {
  const normalizedFile = normalizePath(file);
  const engine = await fileExecutionEngine(file, undefined, context);
  const src = await context.resolveFullMarkdownForFile(engine, file);
  if (engine) {
    const errors = await validateDocumentFromSource(
      src,
      engine.name,
      error,
    );
    if (errors.length) {
      throw new Error(`${file} is not a valid Quarto input document`);
    }
  }
  await projectResolveCodeCellsForFile(context, engine, file);
  await projectFileMetadata(context, file);
  const cacheEntry = context.fileInformationCache.get(normalizedFile);
  // Output key: project-relative for portability
  const outputKey = relative(context.dir, normalizedFile);
  fileInformation[outputKey] = {
    includeMap: cacheEntry?.includeMap ?? [],
    codeCells: cacheEntry?.codeCells ?? [],
    metadata: cacheEntry?.metadata ?? {},
  };
};

const inspectDocumentConfig = async (path: string) => {
  const nbContext = notebookContext();
  const project = await projectContext(path, nbContext) ||
    (await singleFileProjectContext(path, nbContext));
  return withProjectCleanup(project, async (project) => {
    const engine = await fileExecutionEngine(path, undefined, project);
    if (!engine) {
      throw new Error(`${path} is not a valid Quarto input document`);
    }
    // partition markdown
    const partitioned = await engine.partitionedMarkdown(path);
    const context = project;
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
    const normalizedPath = normalizePath(path);
    const fileInformation = context.fileInformationCache.get(normalizedPath);

    // data to write
    const config: InspectedDocumentConfig = {
      quarto: {
        version: quartoConfig.version(),
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
      config.project = await inspectProjectConfig(context);
    }
    return config;
  });
};

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
