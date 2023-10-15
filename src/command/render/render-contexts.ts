/*
 * render-info.ts
 *
 * Copyright (C) 2022 Posit Software, PBC
 */

import { Format, FormatExecute, Metadata } from "../../config/types.ts";
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
  kExtensionName,
  kHeaderIncludes,
  kIncludeAfter,
  kIncludeAfterBody,
  kIncludeBefore,
  kIncludeBeforeBody,
  kIncludeInHeader,
  kIpynbFilters,
  kIpynbShellInteractivity,
  kMetadataFormat,
  kOutputExt,
  kOutputFile,
  kServer,
  kTargetFormat,
  kTheme,
  kWarning,
} from "../../config/constants.ts";
import {
  formatLanguage,
  resolveLanguageMetadata,
} from "../../core/language.ts";
import { defaultWriterFormat } from "../../format/formats.ts";
import { mergeConfigs } from "../../core/config.ts";
import { ExecutionEngine, ExecutionTarget } from "../../execute/types.ts";
import { projectMetadataForInputFile } from "../../project/project-context.ts";
import {
  deleteProjectMetadata,
  directoryMetadataForInputFile,
  projectTypeIsWebsite,
} from "../../project/project-shared.ts";
import {
  kProjectLibDir,
  kProjectType,
  ProjectContext,
} from "../../project/types.ts";
import { isHtmlOutput } from "../../config/format.ts";
import { formatHasBootstrap } from "../../format/html/format-html-info.ts";
import { warnOnce } from "../../core/log.ts";
import { dirAndStem } from "../../core/path.ts";
import {
  fileEngineClaimReason,
  fileExecutionEngine,
  fileExecutionEngineAndTarget,
} from "../../execute/engine.ts";
import { removePandocTo } from "./flags.ts";
import { filesDirLibDir } from "./render-paths.ts";
import { isJupyterNotebook } from "../../core/jupyter/jupyter.ts";
import { LanguageCellHandlerOptions } from "../../core/handlers/types.ts";
import { handleLanguageCells } from "../../core/handlers/base.ts";
import {
  FormatDescriptor,
  isValidFormat,
  parseFormatString,
} from "../../core/pandoc/pandoc-formats.ts";
import { ExtensionContext } from "../../extension/types.ts";
import { renderServices } from "./render-services.ts";

export async function resolveFormatsFromMetadata(
  metadata: Metadata,
  input: string,
  formats: string[],
  flags?: RenderFlags,
): Promise<Record<string, { format: Format; active: boolean }>> {
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
  if (flags?.to === undefined) {
    renderFormats.push(...formats);
  } else if (flags?.to === "default") {
    renderFormats.push(formats[0]);
  } else {
    const toFormats = flags.to.split(",").flatMap((to) => {
      if (to === "all") {
        return formats;
      } else {
        return [to];
      }
    });
    renderFormats.push(...toFormats);
  }

  // get a list of _all_ formats
  formats = ld.uniq(formats.concat(renderFormats));

  const resolved: Record<string, { format: Format; active: boolean }> = {};

  formats.forEach((to) => {
    // determine the target format
    const format = formatFromMetadata(
      baseFormat,
      to,
      flags?.debug,
    );

    // merge configs
    const config = mergeFormatMetadata(baseFormat, format);

    // apply any metadata filter
    const defaultFormat = defaultWriterFormat(to);
    const resolveFormat = defaultFormat.resolveFormat;
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

    resolved[to] = {
      format: config,
      active: renderFormats.includes(to),
    };
  });

  return resolved;
}

export async function renderContexts(
  file: RenderFile,
  options: RenderOptions,
  forExecute: boolean,
  project?: ProjectContext,
  cloneOptions: boolean = true,
): Promise<Record<string, RenderContext>> {
  if (cloneOptions) {
    // clone options (b/c we will modify them)
    // we make it optional because some of the callers have
    // actually just cloned it themselves and don't need to preserve
    // the original
    options = ld.cloneDeep(options) as RenderOptions;
  }

  const { engine, target } = await fileExecutionEngineAndTarget(
    file.path,
    options.flags,
    undefined,
    project,
  );

  const engineClaimReason = fileEngineClaimReason(file.path);

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
  for (const formatKey of Object.keys(formats)) {
    formats[formatKey].format.language = await formatLanguage(
      formats[formatKey].format.metadata,
      formats[formatKey].format.language,
      options.flags,
    );

    // set format
    const context: RenderContext = {
      target,
      options,
      engine,
      format: formats[formatKey].format,
      active: formats[formatKey].active,
      project,
      libDir: libDir!,
    };
    contexts[formatKey] = context;

    // at this point we have enough to fix up the target and engine
    // in case that's needed.

    if (!isJupyterNotebook(context.target.source)) {
      // this is not a jupyter notebook input,
      // so we can run pre-engine handlers

      const preEngineCellHandlerOptions: LanguageCellHandlerOptions = {
        name: "", // this gets filled out by handleLanguageCells later.
        temp: options.services.temp,
        format: context.format,
        markdown: context.target.markdown,
        context,
        flags: options.flags || {} as RenderFlags,
        stage: "pre-engine",
      };

      const { markdown, results } = await handleLanguageCells(
        preEngineCellHandlerOptions,
      );

      context.target.markdown = markdown;

      if (results) {
        context.target.preEngineExecuteResults = results;
      }

      // if a markdown detected engine changed then re-scan
      if (engineClaimReason === "markdown") {
        const detectedEngine = fileExecutionEngine(file.path, options.flags, markdown);
        if (detectedEngine && (context.engine.name !== detectedEngine.name)) {
          context.engine = detectedEngine;
          const target = await detectedEngine.target(file.path, options.flags?.quiet, markdown, project);
          if (!target) {
            throw new Error("Unable to render " + file);
          }
          context.target = target;
        }
      }
    }

    // if this isn't for execute then cleanup context
    if (!forExecute && engine.executeTargetSkipped) {
      engine.executeTargetSkipped(target, formats[formatKey].format);
    }
  }
  return contexts;
}

export async function renderFormats(
  file: string,
  to = "all",
  project?: ProjectContext,
): Promise<Record<string, Format>> {
  const services = renderServices();
  try {
    const contexts = await renderContexts(
      { path: file },
      { services, flags: { to } },
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
    services.cleanup();
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
): Promise<Record<string, { format: Format; active: boolean }>> {
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

  const activeKeys = (
    formats: Record<string, { format: Format; active: boolean }>,
  ) => {
    return Object.keys(formats).filter((key) => {
      return formats[key].active;
    });
  };

  // A list of all the active format keys
  const activeFormatKeys = ld.uniq(
    activeKeys(projFormats).concat(activeKeys(directoryFormats)).concat(
      activeKeys(inputFormats),
    ),
  );
  // A list of all the format keys included
  const allFormatKeys = ld.uniq(
    Object.keys(projFormats).concat(Object.keys(directoryFormats)).concat(
      Object.keys(inputFormats),
    ),
  );

  const mergedFormats: Record<string, Format> = {};
  for (const format of allFormatKeys) {
    // alias formats
    const projFormat = projFormats[format].format;
    const directoryFormat = directoryFormats[format].format;
    const inputFormat = inputFormats[format].format;

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

    // default 'echo' and 'ipynb-shell-interactivity'
    // for documents with a server
    if (userFormat.metadata[kServer] !== undefined) {
      // default echo
      if (userFormat.execute[kEcho] === undefined) {
        userFormat.execute[kEcho] = false;
      }
      // default shell interactivity
      if (userFormat.execute[kIpynbShellInteractivity] === undefined) {
        userFormat.execute[kIpynbShellInteractivity] = "all";
      }
    }

    // If options request, force echo
    if (options.echo) {
      userFormat.execute[kEcho] = true;
    }

    // If options request, force warning
    if (options.warning) {
      userFormat.execute[kWarning] = true;
    }

    // The format description
    const formatDesc = parseFormatString(format);

    // Read any extension metadata and merge it into the
    // format metadata
    const extensionMetadata = await readExtensionFormat(
      target.source,
      formatDesc,
      options.services.extension,
      project,
    );

    // do the merge of the writer format into this format
    mergedFormats[format] = mergeFormatMetadata(
      defaultWriterFormat(formatDesc.formatWithVariants),
      extensionMetadata[formatDesc.baseFormat]
        ? extensionMetadata[formatDesc.baseFormat].format
        : {},
      userFormat,
    );
    // Insist that the target format reflect the correct value.
    mergedFormats[format].identifier[kTargetFormat] = format;

    //deno-lint-ignore no-explicit-any
    mergedFormats[format].mergeAdditionalFormats = (...configs: any[]) => {
      return mergeFormatMetadata(
        defaultWriterFormat(formatDesc.formatWithVariants),
        extensionMetadata[formatDesc.baseFormat]
          ? extensionMetadata[formatDesc.baseFormat].format
          : {},
        ...configs,
        userFormat,
      );
    };

    // ensure that we have a valid forma
    const formatIsValid = isValidFormat(
      formatDesc,
      mergedFormats[format].pandoc,
    );
    if (!formatIsValid) {
      throw new Error(`Unknown format ${format}`);
    }
  }

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

  // apply some others
  for (const formatName of Object.keys(mergedFormats)) {
    let format = mergedFormats[formatName];

    // run any ipynb-filters to discover generated metadata, then merge it back in
    if (hasIpynbFilters(format.execute)) {
      // read markdown w/ filter
      const markdown = await engine.partitionedMarkdown(target.source, format);
      // merge back metadata
      if (markdown.yaml) {
        const nbFormats = await resolveFormatsFromMetadata(
          markdown.yaml,
          target.source,
          [formatName],
          { ...options.flags, to: undefined },
        );
        format = mergeConfigs(format, nbFormats[formatName]);
      }
    }

    // apply engine format filters
    if (engine.filterFormat) {
      format = engine.filterFormat(
        target.source,
        options,
        format,
      );
    }

    // Allow the project type to filter the format
    if (projType.filterFormat) {
      format = projType.filterFormat(target.source, format, project);
    }

    mergedFormats[formatName] = format;
  }

  const finalFormats: Record<string, { format: Format; active: boolean }> = {};
  for (const key of Object.keys(mergedFormats)) {
    const active = activeFormatKeys.includes(key);
    finalFormats[key] = {
      format: mergedFormats[key],
      active,
    };
  }
  return finalFormats;
}

const readExtensionFormat = async (
  file: string,
  formatDesc: FormatDescriptor,
  extensionContext: ExtensionContext,
  project?: ProjectContext,
) => {
  // Read the format file and populate this
  if (formatDesc.extension) {
    // Find the yaml file
    const extension = await extensionContext.extension(
      formatDesc.extension,
      file,
      project?.config,
      project?.dir,
    );

    // Read the yaml file and resolve / bucketize
    const extensionFormat = extension?.contributes.formats;
    if (extensionFormat) {
      const fmtTarget = formatDesc.modifiers
        ? `${formatDesc.baseFormat}${formatDesc.modifiers.join("")}`
        : formatDesc.baseFormat;
      const extensionMetadata =
        (extensionFormat[fmtTarget] || extensionFormat[formatDesc.baseFormat] ||
          {}) as Metadata;
      extensionMetadata[kExtensionName] = extensionMetadata[kExtensionName] ||
        formatDesc.extension;

      const formats = await resolveFormatsFromMetadata(
        extensionMetadata,
        extension.path,
        [formatDesc.baseFormat],
      );

      return formats;
    } else {
      throw new Error(
        `No valid format ${formatDesc.baseFormat} is provided by the extension ${formatDesc.extension}`,
      );
    }
  } else {
    return {};
  }
};

function hasIpynbFilters(execute: FormatExecute) {
  return execute[kIpynbFilters] && execute[kIpynbFilters]?.length;
}
