/*
 * project-context.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import {
  dirname,
  globToRegExp,
  isAbsolute,
  join,
  relative,
  resolve,
  SEP,
} from "../deno_ral/path.ts";

import { existsSync, walk, walkSync } from "../deno_ral/fs.ts";
import * as ld from "../core/lodash.ts";

import { ProjectType } from "./types/types.ts";
import { Format, Metadata, PandocFlags } from "../config/types.ts";
import {
  kProjectLibDir,
  kProjectOutputDir,
  kProjectPostRender,
  kProjectPreRender,
  kProjectRender,
  kProjectType,
  ProjectConfig,
  ProjectContext,
} from "./types.ts";

import { isYamlPath, readYaml } from "../core/yaml.ts";
import { mergeConfigs } from "../core/config.ts";
import {
  ensureTrailingSlash,
  kSkipHidden,
  normalizePath,
  pathWithForwardSlashes,
  safeExistsSync,
} from "../core/path.ts";

import { includedMetadata, mergeProjectMetadata } from "../config/metadata.ts";
import {
  kHtmlMathMethod,
  kLanguageDefaults,
  kMetadataFile,
  kMetadataFiles,
  kMetadataFormat,
  kQuartoVarsKey,
} from "../config/constants.ts";

import { projectType, projectTypes } from "./types/project-types.ts";

import { resolvePathGlobs } from "../core/path.ts";
import {
  readLanguageTranslations,
  resolveLanguageMetadata,
} from "../core/language.ts";

import {
  engineIgnoreDirs,
  executionEngineIntermediateFiles,
  fileExecutionEngine,
  fileExecutionEngineAndTarget,
  projectIgnoreGlobs,
  resolveEngines,
} from "../execute/engine.ts";
import { ExecutionEngineInstance, kMarkdownEngine } from "../execute/types.ts";

import { projectResourceFiles } from "./project-resources.ts";

import {
  cleanupFileInformationCache,
  FileInformationCacheMap,
  ignoreFieldsForProjectType,
  normalizeFormatYaml,
  projectConfigFile,
  projectFileMetadata,
  projectResolveBrand,
  projectResolveFullMarkdownForFile,
  projectVarsFile,
} from "./project-shared.ts";
import { RenderOptions, RenderServices } from "../command/render/types.ts";
import { kWebsite } from "./types/website/website-constants.ts";

import { readAndValidateYamlFromFile } from "../core/schema/validated-yaml.ts";

import { getProjectConfigSchema } from "../core/lib/yaml-schema/project-config.ts";
import { kDefaultProjectFileContents } from "./types/project-default.ts";
import {
  createExtensionContext,
  filterExtensions,
} from "../extension/extension.ts";
import { initializeProfileConfig } from "./project-profile.ts";
import { dotenvSetVariables } from "../quarto-core/dotenv.ts";
import { ConcreteSchema } from "../core/lib/yaml-schema/types.ts";
import { ExtensionContext } from "../extension/types.ts";
import { asArray } from "../core/array.ts";
import { renderFormats } from "../command/render/render-contexts.ts";
import { computeProjectEnvironment } from "./project-environment.ts";
import { ProjectEnvironment } from "./project-environment-types.ts";
import { NotebookContext } from "../render/notebook/notebook-types.ts";
import { MappedString } from "../core/mapped-text.ts";
import { makeTimedFunctionAsync } from "../core/performance/function-times.ts";
import { createProjectCache } from "../core/cache/cache.ts";
import { createTempContext } from "../core/temp.ts";

import { onCleanup } from "../core/cleanup.ts";
import { Zod } from "../resources/types/zod/schema-types.ts";
import { ExternalEngine } from "../resources/types/schema-types.ts";

export const mergeExtensionMetadata = async (
  context: ProjectContext,
  pOptions: RenderOptions,
) => {
  // this will mutate context.config.project to merge
  // in any project metadata from extensions
  if (context.config) {
    const extensions = await pOptions.services.extension.extensions(
      undefined,
      context.config,
      context.dir,
      { builtIn: false },
    );
    // Handle project metadata extensions
    const projectMetadata = extensions.filter((extension) =>
      extension.contributes.metadata?.project
    ).map((extension) => {
      return Zod.ProjectConfig.parse(extension.contributes.metadata!.project);
    });
    context.config.project = mergeProjectMetadata(
      context.config.project,
      ...projectMetadata,
    );
  }
};

export async function projectContext(
  path: string,
  notebookContext: NotebookContext,
  renderOptions?: RenderOptions,
  force = false,
): Promise<ProjectContext | undefined> {
  const flags = renderOptions?.flags;
  let dir = normalizePath(
    Deno.statSync(path).isDirectory ? path : dirname(path),
  );
  const originalDir = dir;

  // create an extension context if one doesn't exist
  const extensionContext = renderOptions?.services.extension ||
    createExtensionContext();

  // first pass uses the config file resolve
  const configSchema = await getProjectConfigSchema();
  const configResolvers = [
    quartoYamlProjectConfigResolver(configSchema),
    await projectExtensionsConfigResolver(extensionContext, dir),
  ];

  // Compute this on demand and only a single time per
  // project context
  let cachedEnv: ProjectEnvironment | undefined = undefined;
  const environment = async (
    project: ProjectContext,
  ) => {
    if (cachedEnv) {
      return Promise.resolve(cachedEnv);
    } else {
      cachedEnv = await computeProjectEnvironment(notebookContext, project);
      return cachedEnv;
    }
  };

  const returnResult = async (
    context: ProjectContext,
  ) => {
    if (renderOptions) {
      await mergeExtensionMetadata(context, renderOptions);
    }
    onCleanup(context.cleanup);
    return context;
  };

  while (true) {
    // use the current resolver
    const resolver = configResolvers[0];
    const resolved = await resolver(dir);
    if (resolved) {
      let projectConfig = resolved.config;
      const configFiles = resolved.files;

      // migrate any legacy config
      projectConfig = migrateProjectConfig(projectConfig);

      // Look for project extension and load it
      const projType = projectConfig.project[kProjectType];
      if (projType && !(projectTypes().includes(projType))) {
        projectConfig = await resolveProjectExtension(
          extensionContext,
          projType,
          projectConfig,
          dir,
        );

        // resolve includes
        const configSchema = await getProjectConfigSchema();
        const includedMeta = await includedMetadata(
          dir,
          projectConfig,
          configSchema,
        );
        const metadata = includedMeta.metadata;
        projectConfig = mergeProjectMetadata(projectConfig, metadata);
      }

      // Process engine extensions
      if (extensionContext) {
        projectConfig = await resolveEngineExtensions(
          extensionContext,
          projectConfig,
          dir,
        );
      }

      // collect then merge configuration profiles
      const result = await initializeProfileConfig(
        dir,
        projectConfig,
        configSchema,
      );
      projectConfig = result.config;
      configFiles.push(...result.files);

      // process dotenv files
      const dotenvFiles = await dotenvSetVariables(dir);
      configFiles.push(...dotenvFiles);

      // read vars and merge into the project
      const varsFile = projectVarsFile(dir);
      if (varsFile) {
        configFiles.push(varsFile);
        const vars = readYaml(varsFile) as Metadata;
        projectConfig[kQuartoVarsKey] = mergeConfigs(
          projectConfig[kQuartoVarsKey] || {},
          vars,
        );
      }

      // resolve translations
      const translationFiles = await resolveLanguageTranslations(
        projectConfig,
        dir,
      );
      configFiles.push(...translationFiles);

      // inject format if specified in --to
      if (flags?.to && flags?.to !== "all" && flags?.to !== "default") {
        const projectFormats = normalizeFormatYaml(
          projectConfig[kMetadataFormat],
        );
        const toFormat = projectFormats[flags?.to] || {};
        delete projectFormats[flags?.to];
        const formats = {
          [flags?.to]: toFormat,
        };
        Object.keys(projectFormats).forEach((format) => {
          formats[format] = projectFormats[format] as Record<never, never>;
        });
        projectConfig[kMetadataFormat] = formats;
      }

      if (projectConfig?.project) {
        // provide output-dir from command line if specfified
        if (flags?.outputDir) {
          projectConfig.project[kProjectOutputDir] = flags.outputDir;
        }

        // convert pre and post render to array
        if (typeof (projectConfig.project[kProjectPreRender]) === "string") {
          projectConfig.project[kProjectPreRender] = [
            projectConfig.project[kProjectPreRender] as unknown as string,
          ];
        }
        if (typeof (projectConfig.project[kProjectPostRender]) === "string") {
          projectConfig.project[kProjectPostRender] = [
            projectConfig.project[kProjectPostRender] as unknown as string,
          ];
        }

        // get project config and type-specific defaults for libDir and outputDir
        const type = projectType(projectConfig.project?.[kProjectType]);
        if (
          projectConfig.project[kProjectLibDir] === undefined && type.libDir
        ) {
          projectConfig.project[kProjectLibDir] = type.libDir;
        }
        if (!projectConfig.project[kProjectOutputDir] && type.outputDir) {
          projectConfig.project[kProjectOutputDir] = type.outputDir;
        }

        // if the output-dir resolves to the project directory, that's equivalent to
        // no output dir so make that conversion now (this allows code downstream to
        // just check for no output dir rather than checking for ".", "./", etc.)
        // Fixes issue #13892: output-dir: ./ would delete the entire project
        const outputDir = projectConfig.project[kProjectOutputDir];
        if (outputDir) {
          const resolvedOutputDir = resolve(dir, outputDir);
          const resolvedDir = resolve(dir);
          if (resolvedOutputDir === resolvedDir) {
            delete projectConfig.project[kProjectOutputDir];
          }
        }

        // if the output-dir is absolute then make it project dir relative
        const projOutputDir = projectConfig.project[kProjectOutputDir];
        if (projOutputDir && isAbsolute(projOutputDir)) {
          projectConfig.project[kProjectOutputDir] = relative(
            dir,
            projOutputDir,
          );
        }

        const temp = createTempContext({
          dir: join(dir, ".quarto"),
          prefix: "quarto-session-temp",
        });
        const fileInformationCache = new FileInformationCacheMap();
        const result: ProjectContext = {
          clone: () => result,
          resolveBrand: async (fileName?: string) =>
            projectResolveBrand(result, fileName),
          resolveFullMarkdownForFile: (
            engine: ExecutionEngineInstance | undefined,
            file: string,
            markdown?: MappedString,
            force?: boolean,
          ) => {
            return projectResolveFullMarkdownForFile(
              result,
              engine,
              file,
              markdown,
              force,
            );
          },
          dir,
          engines: [],
          fileInformationCache,
          files: {
            input: [],
          },
          config: projectConfig,
          // this is a relatively ugly hack to avoid a circular import chain
          // that causes a deno bundler bug;
          renderFormats,
          environment: () => environment(result),
          notebookContext,
          fileExecutionEngineAndTarget: (
            file: string,
          ) => {
            return fileExecutionEngineAndTarget(
              file,
              flags,
              result,
            );
          },
          fileMetadata: async (file: string, force?: boolean) => {
            return projectFileMetadata(result, file, force);
          },
          isSingleFile: false,
          previewServer: renderOptions?.previewServer,
          diskCache: await createProjectCache(join(dir, ".quarto")),
          temp,
          cleanup: () => {
            cleanupFileInformationCache(result);
            result.diskCache.close();
            temp.cleanup();
          },
        };

        // see if the project [kProjectType] wants to filter the project config
        if (type.config) {
          result.config = await type.config(
            result,
            projectConfig,
            flags,
          );
        }
        const { files, engines } = await projectInputFiles(
          result,
          projectConfig,
        );
        // if we are attemping to get the projectConext for a file and the
        // file isn't in list of input files then return a single-file project
        const fullPath = normalizePath(path);
        if (Deno.statSync(fullPath).isFile && !files.includes(fullPath)) {
          return undefined;
        }

        if (type.formatExtras) {
          result.formatExtras = async (
            source: string,
            flags: PandocFlags,
            format: Format,
            services: RenderServices,
          ) => type.formatExtras!(result, source, flags, format, services);
        }
        result.engines = engines;
        result.files = {
          input: files,
          resources: projectResourceFiles(dir, projectConfig),
          config: configFiles,
          configResources: projectConfigResources(dir, projectConfig, type),
        };
        return await returnResult(result);
      } else {
        const temp = createTempContext({
          dir: join(dir, ".quarto"),
          prefix: "quarto-session-temp",
        });
        const fileInformationCache = new FileInformationCacheMap();
        const result: ProjectContext = {
          clone: () => result,
          resolveBrand: async (fileName?: string) =>
            projectResolveBrand(result, fileName),
          resolveFullMarkdownForFile: (
            engine: ExecutionEngineInstance | undefined,
            file: string,
            markdown?: MappedString,
            force?: boolean,
          ) => {
            return projectResolveFullMarkdownForFile(
              result,
              engine,
              file,
              markdown,
              force,
            );
          },
          dir,
          config: projectConfig,
          engines: [],
          fileInformationCache,
          files: {
            input: [],
          },
          renderFormats,
          environment: () => environment(result),
          fileExecutionEngineAndTarget: (
            file: string,
          ) => {
            return fileExecutionEngineAndTarget(
              file,
              flags,
              result,
            );
          },
          fileMetadata: async (file: string, force?: boolean) => {
            return projectFileMetadata(result, file, force);
          },
          notebookContext,
          isSingleFile: false,
          previewServer: renderOptions?.previewServer,
          diskCache: await createProjectCache(join(dir, ".quarto")),
          temp,
          cleanup: () => {
            cleanupFileInformationCache(result);
            result.diskCache.close();
            temp.cleanup();
          },
        };
        const { files, engines } = await projectInputFiles(
          result,
          projectConfig,
        );
        result.engines = engines;
        result.files = {
          input: files,
          resources: projectResourceFiles(dir, projectConfig),
          config: configFiles,
          configResources: projectConfigResources(dir, projectConfig),
        };
        return await returnResult(result);
      }
    } else {
      const nextDir = dirname(dir);
      if (nextDir === dir) {
        if (configResolvers.length > 1) {
          // reset dir and proceed to next resolver
          dir = originalDir;
          configResolvers.shift();
        } else if (force) {
          const temp = createTempContext({
            dir: join(originalDir, ".quarto"),
            prefix: "quarto-session-temp",
          });
          const fileInformationCache = new FileInformationCacheMap();
          const context: ProjectContext = {
            clone: () => context,
            resolveBrand: async (fileName?: string) =>
              projectResolveBrand(context, fileName),
            resolveFullMarkdownForFile: (
              engine: ExecutionEngineInstance | undefined,
              file: string,
              markdown?: MappedString,
              force?: boolean,
            ) => {
              return projectResolveFullMarkdownForFile(
                context,
                engine,
                file,
                markdown,
                force,
              );
            },
            dir: originalDir,
            engines: [],
            config: {
              project: {
                [kProjectOutputDir]: flags?.outputDir,
              },
            },
            fileInformationCache,
            files: {
              input: [],
            },
            renderFormats,
            environment: () => environment(context),
            notebookContext,
            fileExecutionEngineAndTarget: (
              file: string,
            ) => {
              return fileExecutionEngineAndTarget(
                file,
                flags,
                context,
              );
            },
            fileMetadata: async (file: string, force?: boolean) => {
              return projectFileMetadata(context, file, force);
            },
            isSingleFile: false,
            previewServer: renderOptions?.previewServer,
            diskCache: await createProjectCache(join(temp.baseDir, ".quarto")),
            temp,
            cleanup: () => {
              cleanupFileInformationCache(context);
              context.diskCache.close();
              temp.cleanup();
            },
          };
          if (Deno.statSync(path).isDirectory) {
            const { files, engines } = await projectInputFiles(context);
            context.engines = engines;
            context.files.input = files;
          } else {
            const input = normalizePath(path);
            const engine = await fileExecutionEngine(input, undefined, context);
            context.engines = [engine?.name ?? kMarkdownEngine];
            context.files.input = [input];
          }
          return await returnResult(context);
        } else {
          return undefined;
        }
      } else {
        dir = nextDir;
      }
    }
  }
}

type ResolvedProjectConfig = {
  config: ProjectConfig;
  files: string[];
};

function quartoYamlProjectConfigResolver(
  configSchema: ConcreteSchema,
) {
  return async (dir: string): Promise<ResolvedProjectConfig | undefined> => {
    let configFile: string | undefined = undefined;
    try {
      configFile = projectConfigFile(dir);
    } catch (e) {
      if (e instanceof Deno.errors.PermissionDenied) {
        // ignore permission denied errors
      } else {
        throw e;
      }
    }
    if (configFile) {
      // read config file
      const files = [configFile];
      const errMsg = `Project ${configFile} validation failed.`;
      let config = (await readAndValidateYamlFromFile(
        configFile,
        configSchema,
        errMsg,
        kDefaultProjectFileContents,
      )) as ProjectConfig;
      config.project = config.project || {};

      // resolve includes
      const includedMeta = await includedMetadata(
        dir,
        config,
        configSchema,
      );
      const metadata = includedMeta.metadata;
      files.push(...includedMeta.files);
      config = mergeProjectMetadata(config, metadata);
      delete config[kMetadataFile];
      delete config[kMetadataFiles];
      return { config, files };
    } else {
      return undefined;
    }
  };
}

type ProjectTypeDetector = {
  type: string;
  detect: string[][];
};

async function projectExtensionsConfigResolver(
  context: ExtensionContext,
  dir: string,
) {
  // load built-in project types and see if they have detectors
  const projectTypeDetectors: ProjectTypeDetector[] =
    (await context.extensions(dir)).reduce(
      (projectTypeDetectors, extension) => {
        if (extension.contributes.project) {
          const project = extension.contributes.project as
            | ProjectConfig
            | undefined;
          if (project?.project?.detect) {
            const detect = asArray<string[]>(project?.project.detect);
            projectTypeDetectors.push({
              type: extension.id.name,
              detect,
            });
          }
        }

        return projectTypeDetectors;
      },
      [] as ProjectTypeDetector[],
    );

  // function that will run the detectors on a directory
  return (dir: string): Promise<ResolvedProjectConfig | undefined> => {
    // look for the detector files
    for (const detector of projectTypeDetectors) {
      if (
        detector.detect.some((files) =>
          files.every((file) => safeExistsSync(join(dir, file)))
        )
      ) {
        return Promise.resolve({
          config: {
            project: {
              type: detector.type,
            },
          },
          files: [],
        });
      }
    }
    return Promise.resolve(undefined);
  };
}

async function resolveProjectExtension(
  context: ExtensionContext,
  projectType: string,
  projectConfig: ProjectConfig,
  dir: string,
) {
  // Find extensions
  const extensions = await context.find(
    projectType,
    dir,
    "project",
    projectConfig,
    dir,
  );

  // filter the extensions to resolve duplication
  const filtered = filterExtensions(extensions, projectType, "project");

  if (filtered.length > 0) {
    const extension = filtered[0];
    const projectExt = extension.contributes.project;

    if (projectExt) {
      // alias and clone (as we may  mutate)
      const projectExtConfig = ld.cloneDeep(projectExt) as ProjectConfig;

      // remove the 'detect' field from the ext as that's just for bootstrapping
      delete projectExtConfig.project.detect;

      // user render config should fully override the extension config
      if (projectConfig.project.render) {
        delete projectExtConfig.project.render;
      }

      // Ensure that we replace the project type with a
      // system supported project type (rather than the extension name)
      const extProjType = () => {
        const projectMeta = projectExt.project;
        if (projectMeta && typeof projectMeta === "object") {
          const extType = (projectMeta as Record<string, unknown>).type;
          if (typeof extType === "string") {
            return extType;
          } else {
            return "default";
          }
        } else {
          return "default";
        }
      };
      projectConfig.project[kProjectType] = extProjType();

      // Merge config
      projectConfig = mergeProjectMetadata(
        projectExtConfig,
        projectConfig,
      );
    }
  }
  return projectConfig;
}

export async function resolveEngineExtensions(
  context: ExtensionContext,
  projectConfig: ProjectConfig,
  dir: string,
) {
  // First, resolve any relative paths in existing project engines
  if (projectConfig.engines) {
    projectConfig.engines =
      (projectConfig.engines as (string | ExternalEngine)[]).map(
        (engine) => {
          if (
            typeof engine === "object" && engine.path &&
            !isAbsolute(engine.path)
          ) {
            // Convert relative path to absolute path based on project directory
            return {
              ...engine,
              path: join(dir, engine.path),
            };
          }
          return engine;
        },
      );
  }

  // Find all extensions that contribute engines
  const extensions = await context.extensions(
    undefined,
    projectConfig,
    dir,
  );

  // Filter to only those with engines
  const engineExtensions = extensions.filter((extension) =>
    extension.contributes.engines !== undefined &&
    extension.contributes.engines.length > 0
  );

  if (engineExtensions.length > 0) {
    // Initialize engines array if needed
    if (!projectConfig.engines) {
      projectConfig.engines = [];
    }

    const existingEngines = projectConfig
      .engines as (string | ExternalEngine)[];

    // Extract and merge engines
    const extensionEngines = engineExtensions
      .map((extension) => extension.contributes.engines)
      .flat();

    projectConfig.engines = [...existingEngines, ...extensionEngines];
  }

  return projectConfig;
}

// migrate 'site' to 'website'
// TODO make this a deprecation warning
function migrateProjectConfig(projectConfig: ProjectConfig) {
  const kSite = "site";
  if (
    projectConfig.project[kProjectType] !== kSite &&
    projectConfig[kSite] === undefined
  ) {
    return projectConfig;
  }

  projectConfig = ld.cloneDeep(projectConfig);
  if (projectConfig.project[kProjectType] === kSite) {
    projectConfig.project[kProjectType] = kWebsite;
  }
  if (projectConfig[kSite]) {
    projectConfig[kWebsite] = ld.cloneDeep(projectConfig[kSite]);
    delete projectConfig[kSite];
  }
  return projectConfig;
}

async function resolveLanguageTranslations(
  projectConfig: ProjectConfig,
  dir: string,
) {
  const files: string[] = [];

  // read any language file pointed to by the project
  files.push(...(await resolveLanguageMetadata(projectConfig, dir)));

  // read _language.yml and merge into the project
  const translations = await readLanguageTranslations(
    join(dir, "_language.yml"),
  );
  projectConfig[kLanguageDefaults] = mergeConfigs(
    translations.language,
    projectConfig[kLanguageDefaults],
  );
  files.push(...translations.files);
  return files;
}

// read project context (if there is no project config file then still create
// a context (i.e. implicitly treat directory as a project)
export function projectContextForDirectory(
  path: string,
  notebookContext: NotebookContext,
  renderOptions?: RenderOptions,
): Promise<ProjectContext> {
  return projectContext(path, notebookContext, renderOptions, true) as Promise<
    ProjectContext
  >;
}

export function projectYamlFiles(dir: string): string[] {
  const files: string[] = [];

  // Be sure to ignore directory and paths that we shouldn't inspect
  const projIgnoreGlobs = projectHiddenIgnoreGlob(dir);

  // Walk through the directory discovering YAML files
  for (
    const walk of walkSync(dir, {
      includeDirs: true,
      // this was done b/c some directories e.g. renv/packrat and potentially python
      // virtualenvs include symblinks to R or Python libraries that are in turn
      // circular. much safer to not follow symlinks!
      followSymlinks: false,
      skip: [kSkipHidden].concat(
        projIgnoreGlobs.map((ignore) => globToRegExp(join(dir, ignore) + SEP)),
      ),
    })
  ) {
    if (walk.isFile && isYamlPath(walk.path)) {
      files.push(walk.path);
    }
  }
  return files;
}

function projectHiddenIgnoreGlob(dir: string) {
  return projectIgnoreGlobs(dir) // standard ignores for all projects
    .concat(["**/_*", "**/_*/**"]) // underscore prefix
    .concat(["**/.*", "**/.*/**"]) // hidden (dot prefix)
    .concat(["**/README.?([Rrq])md"]) // README
    .concat(["**/CLAUDE.md"]) // Anthropic claude code file
    .concat(["**/AGENTS.md"]) // https://agents.md/
    .concat(["**/*.llms.md"]); // llms.txt companion markdown files
}

export const projectInputFiles = makeTimedFunctionAsync(
  "projectInputFiles",
  projectInputFilesInternal,
);

async function projectInputFilesInternal(
  project: ProjectContext,
  metadata?: ProjectConfig,
): Promise<{ files: string[]; engines: string[] }> {
  // Resolve engines so engineIgnoreDirs() uses all engines (including external)
  await resolveEngines(project);

  const { dir } = project;

  const outputDir = metadata?.project[kProjectOutputDir];

  // Ignore project standard and hidden files
  const projIgnoreGlobs = projectHiddenIgnoreGlob(dir);

  // map to regex
  const projectIgnores = projIgnoreGlobs.map((glob) =>
    globToRegExp(glob, { extended: true, globstar: true })
  );

  type FileInclusion = {
    file: string;
    engineName: string;
    engineIntermediates: string[];
  };

  const addFile = async (file: string): Promise<FileInclusion[]> => {
    // ignore the file if it is in the output directory
    if (
      outputDir &&
      ensureTrailingSlash(dirname(file)).startsWith(
        ensureTrailingSlash(join(dir, outputDir)),
      ) &&
      ensureTrailingSlash(join(dir, outputDir)).startsWith(
        ensureTrailingSlash(dir),
      )
    ) {
      return [];
    }

    const engine = await fileExecutionEngine(file, undefined, project);
    // ignore the file if there's no engine to handle it
    if (!engine) {
      return [];
    }
    const engineIntermediates = executionEngineIntermediateFiles(
      engine,
      file,
    );
    return [{
      file,
      engineName: engine.name,
      engineIntermediates: engineIntermediates,
    }];
  };
  const addDir = async (dir: string): Promise<FileInclusion[]> => {
    const promises: Promise<FileInclusion[]>[] = [];
    for await (
      const walkEntry of walk(dir, {
        includeDirs: false,
        // this was done b/c some directories e.g. renv/packrat and potentially python
        // virtualenvs include symblinks to R or Python libraries that are in turn
        // circular. much safer to not follow symlinks!
        followSymlinks: false,
        skip: [kSkipHidden].concat(
          engineIgnoreDirs().map((ignore) =>
            globToRegExp(join(dir, ignore) + SEP)
          ),
        ),
      })
    ) {
      const pathRelative = pathWithForwardSlashes(
        relative(dir, walkEntry.path),
      );
      if (projectIgnores.some((regex) => regex.test(pathRelative))) {
        continue;
      }
      promises.push(addFile(walkEntry.path));
    }
    const inclusions = await Promise.all(promises);
    return inclusions.flat();
  };
  const addEntry = async (entry: string) => {
    if (Deno.statSync(entry).isDirectory) {
      return addDir(entry);
    } else {
      return addFile(entry);
    }
  };
  const renderFiles = metadata?.project[kProjectRender];

  let inclusions: FileInclusion[];
  if (renderFiles) {
    const exclude = projIgnoreGlobs.concat(outputDir ? [outputDir] : []);
    const resolved = resolvePathGlobs(dir, renderFiles, exclude, {
      mode: "auto",
    });
    const toInclude = ld.difference(
      resolved.include,
      resolved.exclude,
    ) as string[];
    inclusions = (await Promise.all(toInclude.map(addEntry))).flat();
  } else {
    inclusions = await addDir(dir);
  }

  const files = inclusions.map((inclusion) => inclusion.file);
  const engines = ld.uniq(inclusions.map((inclusion) => inclusion.engineName));
  const intermediateFiles = inclusions.map((inclusion) =>
    inclusion.engineIntermediates
  ).flat();

  const inputFiles = Array.from(
    new Set(files).difference(new Set(intermediateFiles)),
  );

  return { files: inputFiles, engines };
}

function projectConfigResources(
  dir: string,
  metadata: Metadata,
  type?: ProjectType,
) {
  const resourceIgnoreFields = ignoreFieldsForProjectType(type);
  const resources: string[] = [];
  const findResources = (
    collection: Array<unknown> | Record<string, unknown>,
    parentKey?: unknown,
  ) => {
    ld.forEach(
      collection,
      (value: unknown, index: unknown) => {
        if (parentKey === kHtmlMathMethod && index === "method") {
          // don't resolve html-math-method
        } else if (resourceIgnoreFields.includes(index as string)) {
          // project type specific ignore (e.g. site-navbar, site-sidebar)
        } else if (Array.isArray(value)) {
          findResources(value);
        } else if (typeof value === "object") {
          findResources(value as Record<string, unknown>, index);
        } else if (typeof value === "string") {
          const path = isAbsolute(value) ? value : join(dir, value);
          // Paths could be invalid paths (e.g. with colons or other weird characters)
          try {
            if (existsSync(path) && !Deno.statSync(path).isDirectory) {
              resources.push(normalizePath(path));
            }
          } catch {
            // Just ignore this error as the path must not be a local file path
          }
        }
      },
    );
  };

  findResources(metadata);
  return resources;
}
