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
  SEP,
} from "path/mod.ts";
import { existsSync, walkSync } from "fs/mod.ts";
import * as ld from "../core/lodash.ts";

import { ProjectType } from "./types/types.ts";
import { Metadata } from "../config/types.ts";
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
} from "../execute/engine.ts";
import { kMarkdownEngine } from "../execute/types.ts";

import { projectResourceFiles } from "./project-resources.ts";

import {
  ignoreFieldsForProjectType,
  normalizeFormatYaml,
  projectConfigFile,
  projectIgnoreGlobs,
  projectVarsFile,
  toInputRelativePaths,
} from "./project-shared.ts";
import { RenderFlags } from "../command/render/types.ts";
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
import { debug } from "log/mod.ts";
import { computeProjectEnvironment } from "./project-environment.ts";
import { ProjectEnvironment } from "./project-environment-types.ts";

export async function projectContext(
  path: string,
  flags?: RenderFlags,
  force = false,
): Promise<ProjectContext | undefined> {
  let dir = normalizePath(
    Deno.statSync(path).isDirectory ? path : dirname(path),
  );
  const originalDir = dir;

  // create a shared extension context
  const extensionContext = createExtensionContext();

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
      cachedEnv = await computeProjectEnvironment(project);
      return cachedEnv;
    }
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
      }

      // collect then merge configuration profiles
      const configSchema = await getProjectConfigSchema();
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

        // if the output-dir is "." that's equivalent to no output dir so make that
        // conversion now (this allows code downstream to just check for no output dir
        // rather than that as well as ".")
        if (projectConfig.project[kProjectOutputDir] === ".") {
          delete projectConfig.project[kProjectOutputDir];
        }

        // if the output-dir is absolute then make it project dir relative
        const projOutputDir = projectConfig.project[kProjectOutputDir];
        if (projOutputDir && isAbsolute(projOutputDir)) {
          projectConfig.project[kProjectOutputDir] = relative(
            dir,
            projOutputDir,
          );
        }

        // see if the project [kProjectType] wants to filter the project config
        if (type.config) {
          projectConfig = await type.config(
            dir,
            projectConfig,
            flags,
          );
        }
        const { files, engines } = projectInputFiles(dir, projectConfig);

        // if we are attemping to get the projectConext for a file and the
        // file isn't in list of input files then return undefined
        const fullPath = normalizePath(path);
        if (Deno.statSync(fullPath).isFile && !files.includes(fullPath)) {
          return undefined;
        }

        debug(`projectContext: Found Quarto project in ${dir}`);
        return {
          dir,
          engines,
          files: {
            input: files,
            resources: projectResourceFiles(dir, projectConfig),
            config: configFiles,
            configResources: projectConfigResources(dir, projectConfig, type),
          },
          config: projectConfig,
          formatExtras: type.formatExtras,
          // this is a relatively ugly hack to avoid a circular import chain
          // that causes a deno bundler bug;
          renderFormats,
          environment,
        };
      } else {
        const { files, engines } = projectInputFiles(dir);
        debug(`projectContext: Found Quarto project in ${dir}`);
        return {
          dir,
          engines,
          config: projectConfig,
          files: {
            input: files,
            resources: projectResourceFiles(dir, projectConfig),
            config: configFiles,
            configResources: projectConfigResources(dir, projectConfig),
          },
          renderFormats,
          environment,
        };
      }
    } else {
      const nextDir = dirname(dir);
      if (nextDir === dir) {
        if (configResolvers.length > 1) {
          // reset dir and proceed to next resolver
          dir = originalDir;
          configResolvers.shift();
        } else if (force) {
          const context: ProjectContext = {
            dir: originalDir,
            engines: [],
            config: {
              project: {
                [kProjectOutputDir]: flags?.outputDir,
              },
            },
            files: {
              input: [],
            },
            renderFormats,
            environment,
          };
          if (Deno.statSync(path).isDirectory) {
            const { files, engines } = projectInputFiles(originalDir);
            context.engines = engines;
            context.files.input = files;
          } else {
            const input = normalizePath(path);
            context.engines = [
              fileExecutionEngine(input)?.name || kMarkdownEngine,
            ];
            context.files.input = [input];
          }
          debug(`projectContext: Found Quarto project in ${originalDir}`);
          return context;
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
    const configFile = projectConfigFile(dir);
    if (configFile) {
      // read config file
      const files = [configFile];
      const errMsg = "Project _quarto.yml validation failed.";
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

function migrateProjectConfig(projectConfig: ProjectConfig) {
  projectConfig = ld.cloneDeep(projectConfig);

  // migrate 'site' to 'website'
  const kSite = "site";
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
  flags?: RenderFlags,
): Promise<ProjectContext> {
  return projectContext(path, flags, true) as Promise<ProjectContext>;
}

export async function projectMetadataForInputFile(
  input: string,
  flags?: RenderFlags,
  project?: ProjectContext,
): Promise<Metadata> {
  if (project) {
    // don't mutate caller
    project = ld.cloneDeep(project) as ProjectContext;
  } else {
    project = await projectContext(input, flags);
  }

  if (project?.dir && project?.config) {
    // If there is directory and configuration information
    // process paths
    return toInputRelativePaths(
      projectType(project?.config?.project?.[kProjectType]),
      project.dir,
      dirname(input),
      project.config,
    ) as Metadata;
  } else {
    // Just return the config or empty metadata
    return project?.config || {};
  }
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
    .concat(["**/_*", "**/_*/**"]) // underscore prefx
    .concat(["**/.*", "**/.*/**"]) // hidden (dot prefix)
    .concat(["**/README.?([Rrq])md"]); // README
}

export function projectInputFiles(
  dir: string,
  metadata?: ProjectConfig,
): { files: string[]; engines: string[] } {
  const files: string[] = [];
  const engines: string[] = [];
  const intermediateFiles: string[] = [];

  const outputDir = metadata?.project[kProjectOutputDir];

  // Ignore project standard and hidden files
  const projIgnoreGlobs = projectHiddenIgnoreGlob(dir);

  // map to regex
  const projectIgnores = projIgnoreGlobs.map((glob) =>
    globToRegExp(glob, { extended: true, globstar: true })
  );

  const addFile = (file: string) => {
    if (
      // no output dir to worry about
      !outputDir ||
      // crawled file is not inside the output directory
      !ensureTrailingSlash(dirname(file)).startsWith(
        ensureTrailingSlash(join(dir, outputDir)),
      ) ||
      // output directory is not in the project directory
      // so we don't need to worry about crawling outputs
      !ensureTrailingSlash(join(dir, outputDir)).startsWith(
        ensureTrailingSlash(dir),
      )
    ) {
      const engine = fileExecutionEngine(file);
      if (engine) {
        if (!engines.includes(engine.name)) {
          engines.push(engine.name);
        }
        files.push(file);
        const engineIntermediates = executionEngineIntermediateFiles(
          engine,
          file,
        );
        if (engineIntermediates) {
          intermediateFiles.push(...engineIntermediates);
        }
      }
    }
  };

  const addDir = (dir: string) => {
    // ignore selected other globs

    for (
      const walk of walkSync(
        dir,
        {
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
        },
      )
    ) {
      const pathRelative = pathWithForwardSlashes(relative(dir, walk.path));
      if (!projectIgnores.some((regex) => regex.test(pathRelative))) {
        addFile(walk.path);
      }
    }
  };

  const renderFiles = metadata?.project[kProjectRender];
  if (renderFiles) {
    const exclude = projIgnoreGlobs.concat(outputDir ? [outputDir] : []);
    const resolved = resolvePathGlobs(dir, renderFiles, exclude, {
      mode: "auto",
    });
    (ld.difference(resolved.include, resolved.exclude) as string[])
      .forEach((file) => {
        if (Deno.statSync(file).isDirectory) {
          addDir(file);
        } else {
          addFile(file);
        }
      });
  } else {
    addDir(dir);
  }

  const inputFiles = ld.difference(
    ld.uniq(files),
    ld.uniq(intermediateFiles),
  ) as string[];

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
