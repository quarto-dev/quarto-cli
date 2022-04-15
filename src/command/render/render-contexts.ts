/*
* render-info.ts
*
* Copyright (C) 2022 by RStudio, PBC
*
*/

import { Format, Metadata } from "../../config/types.ts";
import {
  RenderContext,
  RenderFile,
  RenderFlags,
  RenderOptions,
} from "./types.ts";

import { dirname, join, relative } from "path/mod.ts";

import * as ld from "../../core/lodash.ts";
import { projectType } from "../../project/types/project-types.ts";

import { getFrontMatterSchema } from "../../core/lib/yaml-schema/front-matter.ts";
import {
  formatFromMetadata,
  formatKeys,
  includedMetadata,
  mergeFormatMetadata,
  metadataAsFormat,
} from "../../config/metadata.ts";

import {
  kBibliography,
  kCache,
  kCss,
  kEcho,
  kEngine,
  kExecuteDaemon,
  kExecuteDaemonRestart,
  kExecuteDebug,
  kExecuteEnabled,
  kHeaderIncludes,
  kIncludeAfter,
  kIncludeAfterBody,
  kIncludeBefore,
  kIncludeBeforeBody,
  kIncludeInHeader,
  kMetadataFormat,
  kOutputExt,
  kOutputFile,
  kServer,
  kTheme,
} from "../../config/constants.ts";
import { resolveLanguageMetadata } from "../../core/language.ts";
import { defaultWriterFormat } from "../../format/formats.ts";
import { mergeConfigs } from "../../core/config.ts";
import { ExecutionEngine, ExecutionTarget } from "../../execute/types.ts";
import {
  deleteProjectMetadata,
  directoryMetadataForInputFile,
  projectMetadataForInputFile,
  projectTypeIsWebsite,
} from "../../project/project-context.ts";
import {
  kProjectLibDir,
  kProjectType,
  ProjectContext,
} from "../../project/types.ts";
import { isHtmlOutput } from "../../config/format.ts";
import { formatHasBootstrap } from "../../format/html/format-html-info.ts";
import { warnOnce } from "../../core/log.ts";
import { dirAndStem } from "../../core/path.ts";
import { createTempContext } from "../../core/temp.ts";
import { fileExecutionEngineAndTarget } from "../../execute/engine.ts";
import { removePandocTo } from "./flags.ts";
import { filesDirLibDir } from "./render-paths.ts";

export async function resolveFormatsFromMetadata(
  metadata: Metadata,
  input: string,
  formats: string[],
  flags?: RenderFlags,
): Promise<Record<string, Format>> {
  const includeDir = dirname(input);

  // Read any included metadata files and merge in and metadata from the command
  const frontMatterSchema = await getFrontMatterSchema();
  const included = await includedMetadata(
    includeDir,
    metadata,
    frontMatterSchema,
  );
  const allMetadata = mergeQuartoConfigs(
    metadata,
    included.metadata,
    flags?.metadata || {},
  );

  // resolve any language file references
  await resolveLanguageMetadata(allMetadata, includeDir);

  // divide allMetadata into format buckets
  const baseFormat = metadataAsFormat(allMetadata);

  if (formats === undefined) {
    formats = formatKeys(allMetadata);
  }

  // provide a default format
  if (formats.length === 0) {
    formats.push(baseFormat.pandoc.to || baseFormat.pandoc.writer || "html");
  }

  // determine render formats
  const renderFormats: string[] = [];
  if (flags?.to === undefined || flags?.to === "all") {
    renderFormats.push(...formats);
  } else if (flags?.to === "default") {
    renderFormats.push(formats[0]);
  } else {
    renderFormats.push(...flags.to.split(","));
  }

  const resolved: Record<string, Format> = {};

  renderFormats.forEach((to) => {
    // determine the target format
    const format = formatFromMetadata(
      baseFormat,
      to,
      flags?.debug,
    );

    // merge configs
    const config = mergeFormatMetadata(baseFormat, format);

    // apply any metadata filter
    const resolveFormat = defaultWriterFormat(to).resolveFormat;
    if (resolveFormat) {
      resolveFormat(config);
    }

    // apply command line arguments

    // --no-execute-code
    if (flags?.execute !== undefined) {
      config.execute[kExecuteEnabled] = flags?.execute;
    }

    // --cache
    if (flags?.executeCache !== undefined) {
      config.execute[kCache] = flags?.executeCache;
    }

    // --execute-daemon
    if (flags?.executeDaemon !== undefined) {
      config.execute[kExecuteDaemon] = flags.executeDaemon;
    }

    // --execute-daemon-restart
    if (flags?.executeDaemonRestart !== undefined) {
      config.execute[kExecuteDaemonRestart] = flags.executeDaemonRestart;
    }

    // --execute-debug
    if (flags?.executeDebug !== undefined) {
      config.execute[kExecuteDebug] = flags.executeDebug;
    }

    resolved[to] = config;
  });

  return resolved;
}

export async function renderContexts(
  file: RenderFile,
  options: RenderOptions,
  forExecute: boolean,
  project?: ProjectContext,
): Promise<Record<string, RenderContext>> {
  // clone options (b/c we will modify them)
  options = ld.cloneDeep(options) as RenderOptions;

  const { engine, target } = await fileExecutionEngineAndTarget(
    file.path,
    options.flags?.quiet,
  );

  // resolve render target
  const formats = await resolveFormats(file, target, engine, options, project);

  // remove --to (it's been resolved into contexts)
  options = removePandocTo(options);

  // see if there is a libDir
  let libDir = project?.config?.project[kProjectLibDir];
  if (project && libDir) {
    libDir = relative(dirname(file.path), join(project.dir, libDir));
  } else {
    libDir = filesDirLibDir(file.path);
  }

  // return contexts
  const contexts: Record<string, RenderContext> = {};
  Object.keys(formats).forEach((format: string) => {
    // set format
    contexts[format] = {
      target,
      options,
      engine,
      format: formats[format],
      project,
      libDir: libDir!,
    };
    // if this isn't for execute then cleanup context
    if (!forExecute && engine.executeTargetSkipped) {
      engine.executeTargetSkipped(target, formats[format]);
    }
  });
  return contexts;
}

export async function renderFormats(
  file: string,
  to = "all",
  project?: ProjectContext,
): Promise<Record<string, Format>> {
  const tempContext = createTempContext();
  try {
    const contexts = await renderContexts(
      { path: file },
      { temp: tempContext, flags: { to } },
      false,
      project,
    );
    const formats: Record<string, Format> = {};
    Object.keys(contexts).forEach((formatName) => {
      // get the format
      const context = contexts[formatName];
      const format = context.format;
      // remove other formats
      delete format.metadata.format;
      // remove project level metadata
      deleteProjectMetadata(format.metadata);
      // resolve output-file
      if (!format.pandoc[kOutputFile]) {
        const [_dir, stem] = dirAndStem(file);
        format.pandoc[kOutputFile] = `${stem}.${format.render[kOutputExt]}`;
      }
      // provide engine
      format.execute[kEngine] = context.engine.name;
      formats[formatName] = format;
    });
    return formats;
  } finally {
    tempContext.cleanup();
  }
}

function mergeQuartoConfigs(
  config: Metadata,
  ...configs: Array<Metadata>
): Metadata {
  // copy all configs so we don't mutate them
  config = ld.cloneDeep(config);
  configs = ld.cloneDeep(configs);

  // bibliography needs to always be an array so it can be merged
  const fixupMergeableScalars = (metadata: Metadata) => {
    [
      kBibliography,
      kCss,
      kHeaderIncludes,
      kIncludeBefore,
      kIncludeAfter,
      kIncludeInHeader,
      kIncludeBeforeBody,
      kIncludeAfterBody,
    ]
      .forEach((key) => {
        if (typeof (metadata[key]) === "string") {
          metadata[key] = [metadata[key]];
        }
      });
  };

  // formats need to always be objects
  const fixupFormat = (config: Record<string, unknown>) => {
    const format = config[kMetadataFormat];
    if (typeof (format) === "string") {
      config.format = { [format]: {} };
    } else if (format instanceof Object) {
      Object.keys(format).forEach((key) => {
        if (typeof (Reflect.get(format, key)) !== "object") {
          Reflect.set(format, key, {});
        }
        fixupMergeableScalars(Reflect.get(format, key) as Metadata);
      });
    }
    fixupMergeableScalars(config);
    return config;
  };

  return mergeConfigs(
    fixupFormat(config),
    ...configs.map((c) => fixupFormat(c)),
  );
}

async function resolveFormats(
  file: RenderFile,
  target: ExecutionTarget,
  engine: ExecutionEngine,
  options: RenderOptions,
  project?: ProjectContext,
): Promise<Record<string, Format>> {
  // input level metadata
  const inputMetadata = target.metadata;

  // directory level metadata
  const directoryMetadata = project?.dir
    ? await directoryMetadataForInputFile(
      project,
      dirname(target.input),
    )
    : {};

  // project level metadata
  const projMetadata = await projectMetadataForInputFile(
    target.input,
    options.flags,
    project,
  );

  // determine formats (treat dir format keys as part of 'input' format keys)
  let formats: string[] = [];
  const projFormatKeys = formatKeys(projMetadata);
  const dirFormatKeys = formatKeys(directoryMetadata);
  const inputFormatKeys = ld.uniq(
    formatKeys(inputMetadata).concat(dirFormatKeys),
  );
  const projType = projectType(project?.config?.project?.[kProjectType]);
  if (projType.projectFormatsOnly) {
    // if the project specifies that only project formats are
    // valid then use the project formats
    formats = projFormatKeys;
  } else if (inputFormatKeys.length > 0) {
    // if the input metadata has a format then this is an override
    // of the project so use its keys (and ignore the project)
    formats = inputFormatKeys;
    // otherwise use the project formats
  } else {
    formats = projFormatKeys;
  }

  // If the file itself has specified permissible
  // formats, filter the list of formats to only
  // include those formats
  if (file.formats) {
    formats = formats.filter((format) => {
      return file.formats?.includes(format);
    });

    // Remove any 'to' information that will force the
    // rnedering to a particular format
    options = ld.cloneDeep(options);
    delete options.flags?.to;
  }

  // resolve formats for each type of metadata
  const projFormats = await resolveFormatsFromMetadata(
    projMetadata,
    target.input,
    formats,
    options.flags,
  );

  const directoryFormats = await resolveFormatsFromMetadata(
    directoryMetadata,
    target.input,
    formats,
    options.flags,
  );

  const inputFormats = await resolveFormatsFromMetadata(
    inputMetadata,
    target.input,
    formats,
    options.flags,
  );

  // merge the formats
  const targetFormats = ld.uniq(
    Object.keys(projFormats).concat(Object.keys(directoryFormats)).concat(
      Object.keys(inputFormats),
    ),
  );

  const mergedFormats: Record<string, Format> = {};
  targetFormats.forEach((format: string) => {
    // alias formats
    const projFormat = projFormats[format];
    const directoryFormat = directoryFormats[format];
    const inputFormat = inputFormats[format];

    // resolve theme (project-level bootstrap theme always wins for web drived output)
    if (
      project && isHtmlOutput(format, true) && formatHasBootstrap(projFormat) &&
      projectTypeIsWebsite(projType)
    ) {
      if (formatHasBootstrap(inputFormat)) {
        delete inputFormat.metadata[kTheme];
      }
      if (formatHasBootstrap(directoryFormat)) {
        delete directoryFormat.metadata[kTheme];
      }
    }

    // combine user formats
    const userFormat = mergeFormatMetadata(
      projFormat || {},
      directoryFormat || {},
      inputFormat || {},
    );

    // if there is no "echo" set by the user then default
    // to false for documents with a server
    if (userFormat.execute[kEcho] === undefined) {
      if (userFormat.metadata[kServer] !== undefined) {
        userFormat.execute[kEcho] = false;
      }
    }

    // do the merge
    mergedFormats[format] = mergeFormatMetadata(
      defaultWriterFormat(format),
      userFormat,
    );
  });

  // filter on formats supported by this project
  for (const formatName of Object.keys(mergedFormats)) {
    const format: Format = mergedFormats[formatName];
    if (projType.isSupportedFormat) {
      if (!projType.isSupportedFormat(format)) {
        delete mergedFormats[formatName];
        warnOnce(
          `The ${formatName} format is not supported by ${projType.type} projects`,
        );
      }
    }
  }

  // apply engine format filters
  if (engine.filterFormat) {
    for (const format of Object.keys(mergedFormats)) {
      mergedFormats[format] = engine.filterFormat(
        target.source,
        options,
        mergedFormats[format],
      );
    }
  }

  return mergedFormats;
}
