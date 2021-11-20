/*
* project-context.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
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
import { ld } from "lodash/mod.ts";

import { ProjectType } from "./types/types.ts";
import { Metadata } from "../config/types.ts";
import {
  kProjectDefaultFormat,
  kProjectLibDir,
  kProjectOutputDir,
  kProjectRender,
  kProjectType,
  ProjectConfig,
  ProjectContext,
} from "./types.ts";

import { readYaml } from "../core/yaml.ts";
import { mergeConfigs } from "../core/config.ts";
import { kSkipHidden, pathWithForwardSlashes } from "../core/path.ts";

import { includedMetadata } from "../config/metadata.ts";
import {
  kHtmlMathMethod,
  kLanguageDefaults,
  kMetadataFile,
  kMetadataFiles,
  kQuartoVarsKey,
} from "../config/constants.ts";

import { projectType } from "./types/project-types.ts";

import { resolvePathGlobs } from "../core/path.ts";
import {
  readLanguageTranslations,
  resolveLanguageMetadata,
} from "../core/language.ts";

import {
  engineIgnoreGlobs,
  executionEngineKeepFiles,
  fileExecutionEngine,
} from "../execute/engine.ts";
import { kMarkdownEngine } from "../execute/types.ts";

import { projectResourceFiles } from "./project-resources.ts";
import { gitignoreEntries } from "./project-gitignore.ts";

import { projectConfigFile, projectVarsFile } from "./project-shared.ts";
import { RenderFlags } from "../command/render/types.ts";
import { kSite, kWebsite } from "./types/website/website-config.ts";
import { formatKeys } from "../command/render/render.ts";

export function deleteProjectMetadata(metadata: Metadata) {
  // see if the active project type wants to filter the config printed
  const projType = projectType(
    (metadata as ProjectConfig).project?.[kProjectType],
  );
  if (projType.metadataFields) {
    for (const field of projType.metadataFields().concat("project")) {
      if (typeof (field) === "string") {
        delete metadata[field];
      } else {
        for (const key of Object.keys(metadata)) {
          if (field.test(key)) {
            delete metadata[key];
          }
        }
      }
    }
  }

  // remove project config
  delete metadata.project;
}

export async function projectContext(
  path: string,
  flags?: RenderFlags,
  force = false,
  forceHtml = false,
): Promise<ProjectContext | undefined> {
  let dir = Deno.realPathSync(
    Deno.statSync(path).isDirectory ? path : dirname(path),
  );
  const originalDir = dir;

  while (true) {
    const configFile = projectConfigFile(dir);
    if (configFile) {
      // config files are the main file + any subfiles read
      const configFiles = [configFile];

      let projectConfig: ProjectConfig = readYaml(configFile) as ProjectConfig;
      projectConfig.project = projectConfig.project || {};
      const includedMeta = includedMetadata(dir, projectConfig);
      const metadata = includedMeta.metadata;
      configFiles.push(...includedMeta.files);
      projectConfig = mergeConfigs(projectConfig, metadata);
      delete projectConfig[kMetadataFile];
      delete projectConfig[kMetadataFiles];

      // migrate any legacy config
      projectConfig = migrateProjectConfig(projectConfig);

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
      const translationFiles = resolveLanguageTranslations(projectConfig, dir);
      configFiles.push(...translationFiles);

      if (projectConfig?.project) {
        // provide output-dir from command line if specfified
        if (flags?.outputDir) {
          projectConfig.project[kProjectOutputDir] = flags.outputDir;
        }

        // determine the default output format and set it
        projectConfig.project[kProjectDefaultFormat] =
          formatKeys(projectConfig)[0];

        // get project config and type
        const type = projectType(projectConfig.project?.[kProjectType]);
        if (
          projectConfig.project[kProjectLibDir] === undefined && type.libDir
        ) {
          projectConfig.project[kProjectLibDir] = type.libDir;
        }
        if (!projectConfig.project[kProjectOutputDir] && type.outputDir) {
          projectConfig.project[kProjectOutputDir] = type.outputDir;
        }
        // see if the project [kProjectType] wants to filter the project config
        if (type.config) {
          projectConfig = await type.config(dir, projectConfig, forceHtml);
        }
        const { files, engines } = projectInputFiles(dir, projectConfig);

        // if we are attemping to get the projectConext for a file and the
        // file isn't in list of input files then return undefined
        const fullPath = Deno.realPathSync(path);
        if (Deno.statSync(fullPath).isFile && !files.includes(fullPath)) {
          return undefined;
        }

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
        };
      } else {
        const { files, engines } = projectInputFiles(dir);
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
        };
      }
    } else {
      const nextDir = dirname(dir);
      if (nextDir === dir) {
        if (force) {
          const context: ProjectContext = {
            dir: originalDir,
            engines: [],
            config: { project: {} },
            files: {
              input: [],
            },
          };
          if (Deno.statSync(path).isDirectory) {
            const { files, engines } = projectInputFiles(originalDir);
            context.engines = engines;
            context.files.input = files;
          } else {
            const input = Deno.realPathSync(path);
            context.engines = [
              fileExecutionEngine(input)?.name || kMarkdownEngine,
            ];
            context.files.input = [input];
          }
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

function migrateProjectConfig(projectConfig: ProjectConfig) {
  projectConfig = ld.cloneDeep(projectConfig);

  // migrate 'site' to 'website'
  if (projectConfig.project[kProjectType] === kSite) {
    projectConfig.project[kProjectType] = kWebsite;
  }
  if (projectConfig[kSite]) {
    projectConfig[kWebsite] = ld.cloneDeep(projectConfig[kSite]);
    delete projectConfig[kSite];
  }
  return projectConfig;
}

function resolveLanguageTranslations(
  projectConfig: ProjectConfig,
  dir: string,
) {
  const files: string[] = [];

  // read any language file pointed to by the project
  files.push(...resolveLanguageMetadata(projectConfig, dir));

  // read _language.yml and merge into the project
  const translations = readLanguageTranslations(join(dir, "_language.yml"));
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

export function projectIsWebsite(context?: ProjectContext): boolean {
  if (context) {
    const projType = projectType(context.config?.project?.[kProjectType]);
    return projType.type === kWebsite || projType.inheritsType === kWebsite;
  } else {
    return false;
  }
}

export function projectIsBook(context?: ProjectContext): boolean {
  if (context) {
    const projType = projectType(context.config?.project?.[kProjectType]);
    return projType.type === "book";
  } else {
    return false;
  }
}

export function projectIgnoreGlobs(dir: string) {
  return engineIgnoreGlobs().concat(
    gitignoreEntries(dir).map((ignore) => `**/${ignore}**`),
  );
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

  const projConfig = project?.config || {};
  return toInputRelativePaths(
    project!.dir,
    dirname(input),
    projConfig,
  ) as Metadata;
}

export function directoryMetadataForInputFile(
  projectDir: string,
  inputDir: string,
) {
  // Finds a metadata file in a directory
  const metadataFile = (dir: string) => {
    return ["_metadata.yml", "_metadata.yaml"]
      .map((file) => join(dir, file))
      .find(existsSync);
  };

  // The path from the project dir to the input dir
  const relativePath = relative(projectDir, inputDir);
  const dirs = relativePath.split(SEP);

  // The config we'll ultimately return
  let config = {};

  // Walk through each directory (starting from the project and
  // walking deeper to the input)
  let currentDir = projectDir;
  dirs.forEach((dir) => {
    currentDir = join(currentDir, dir);
    const file = metadataFile(currentDir);
    if (file) {
      // There is a metadata file, read it and merge it
      // Note that we need to convert paths that are relative
      // to the metadata file to be relative to input
      const yaml = readYaml(file) as Record<string, unknown>;
      config = mergeConfigs(
        config,
        toInputRelativePaths(currentDir, inputDir, yaml),
      );
    }
  });
  return config;
}

export function toInputRelativePaths(
  baseDir: string,
  inputDir: string,
  collection: Array<unknown> | Record<string, unknown>,
  parentKey?: unknown,
) {
  ld.forEach(
    collection,
    (
      value: unknown,
      index: unknown,
      collection: Array<unknown> | Record<string, unknown>,
    ) => {
      const assign = (value: unknown) => {
        if (typeof (index) === "number") {
          (collection as Array<unknown>)[index] = value;
        } else if (typeof (index) === "string") {
          (collection as Record<string, unknown>)[index] = value;
        }
      };

      if (parentKey === kHtmlMathMethod && index === "method") {
        // don't fixup html-math-method
      } else if (Array.isArray(value)) {
        assign(toInputRelativePaths(baseDir, inputDir, value));
      } else if (typeof (value) === "object") {
        assign(
          toInputRelativePaths(
            baseDir,
            inputDir,
            value as Record<string, unknown>,
            index,
          ),
        );
      } else if (typeof (value) === "string") {
        if (!isAbsolute(value)) {
          // if this is a valid file, then transform it to be relative to the input path
          const projectPath = join(baseDir, value);

          // Paths could be invalid paths (e.g. with colons or other weird characters)
          try {
            if (existsSync(projectPath)) {
              const offset = relative(inputDir, baseDir);
              assign(pathWithForwardSlashes(join(offset, value)));
            }
          } catch {
            // Just ignore this error as the path must not be a local file path
          }
        }
      }
    },
  );
  return collection;
}

function projectInputFiles(
  dir: string,
  metadata?: ProjectConfig,
): { files: string[]; engines: string[] } {
  const files: string[] = [];
  const engines: string[] = [];
  const keepFiles: string[] = [];

  const outputDir = metadata?.project[kProjectOutputDir];

  const projIgnoreGlobs = projectIgnoreGlobs(dir) // standard ignores for all projects
    .concat(["**/_*", "**/_*/**"]) // underscore prefx
    .concat(["**/.*", "**/.*/**"]) // hidden (dot prefix)
    .concat(["**/README.?([Rrq])md"]); // README

  // map to regex
  const projectIgnores = projIgnoreGlobs.map((glob) =>
    globToRegExp(glob, { extended: true, globstar: true })
  );

  const addFile = (file: string) => {
    if (!outputDir || !file.startsWith(join(dir, outputDir))) {
      const engine = fileExecutionEngine(file);
      if (engine) {
        if (!engines.includes(engine.name)) {
          engines.push(engine.name);
        }
        files.push(file);
        const keep = executionEngineKeepFiles(engine, file);
        if (keep) {
          keepFiles.push(...keep);
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
          skip: [kSkipHidden],
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
    const resolved = resolvePathGlobs(dir, renderFiles, exclude);
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
    ld.uniq(keepFiles),
  ) as string[];

  return { files: inputFiles, engines };
}

function projectConfigResources(
  dir: string,
  metadata: Metadata,
  type?: ProjectType,
) {
  const resourceIgnoreFields = type
    ? ["project"].concat(
      type.resourceIgnoreFields ? type.resourceIgnoreFields() : [],
    )
    : [];
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
        } else if (typeof (value) === "object") {
          findResources(value as Record<string, unknown>, index);
        } else if (typeof (value) === "string") {
          const path = isAbsolute(value) ? value : join(dir, value);
          // Paths could be invalid paths (e.g. with colons or other weird characters)
          try {
            if (existsSync(path) && !Deno.statSync(path).isDirectory) {
              resources.push(Deno.realPathSync(path));
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
