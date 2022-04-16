/*
* config.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import * as ld from "../core/lodash.ts";

import { exists } from "fs/exists.ts";
import { dirname, join } from "path/mod.ts";
import { error } from "log/mod.ts";

import { readAndValidateYamlFromFile } from "../core/schema/validated-yaml.ts";
import { mergeArrayCustomizer, mergeConfigs } from "../core/config.ts";
import { Schema } from "../core/lib/yaml-schema/types.ts";

import {
  kBibliography,
  kCache,
  kCss,
  kExecuteDaemon,
  kExecuteDaemonRestart,
  kExecuteDebug,
  kExecuteDefaults,
  kExecuteDefaultsKeys,
  kExecuteEnabled,
  kHeaderIncludes,
  kIncludeAfter,
  kIncludeAfterBody,
  kIncludeBefore,
  kIncludeBeforeBody,
  kIncludeInHeader,
  kIpynbFilter,
  kIpynbFilters,
  kKeepMd,
  kKeepTex,
  kLanguageDefaults,
  kLanguageDefaultsKeys,
  kMetadataFile,
  kMetadataFiles,
  kMetadataFormat,
  kPandocDefaults,
  kPandocDefaultsKeys,
  kPandocMetadata,
  kRenderDefaults,
  kRenderDefaultsKeys,
  kTblColwidths,
} from "./constants.ts";
import { Format, Metadata } from "./types.ts";
import { RenderFlags } from "../command/render/types.ts";
import { getFrontMatterSchema } from "../core/lib/yaml-schema/front-matter.ts";
import { defaultWriterFormat } from "../format/formats.ts";
import { resolveLanguageMetadata } from "../core/language.ts";

export async function includedMetadata(
  dir: string,
  baseMetadata: Metadata,
  schema: Schema,
): Promise<{ metadata: Metadata; files: string[] }> {
  // Read any metadata files that are defined in the metadata itself
  const yamlFiles: string[] = [];
  const metadataFile = baseMetadata[kMetadataFile];
  if (metadataFile) {
    yamlFiles.push(join(dir, metadataFile as string));
  }

  const metadataFiles = baseMetadata[kMetadataFiles];
  if (metadataFiles && Array.isArray(metadataFiles)) {
    metadataFiles.forEach((file) => yamlFiles.push(join(dir, file)));
  }

  // Read the yaml
  const filesMetadata = await Promise.all(yamlFiles.map(async (yamlFile) => {
    if (await exists(yamlFile)) {
      try {
        const yaml = await readAndValidateYamlFromFile(
          yamlFile,
          schema,
          `Validation of metadata file ${yamlFile} failed.`,
        );
        return yaml;
      } catch (e) {
        error("\nError reading metadata file from " + yamlFile + "\n");
        throw e;
      }
    } else {
      return undefined;
    }
  })) as Array<Metadata>;

  // merge the result
  return {
    metadata: mergeFormatMetadata({}, ...filesMetadata),
    files: yamlFiles,
  };
}

export function formatFromMetadata(
  baseFormat: Format,
  to: string,
  debug?: boolean,
): Format {
  // user format options (allow any b/c this is just untyped yaml)
  const typedFormat: Format = {
    render: {},
    execute: {},
    pandoc: {},
    language: {},
    metadata: {},
  };
  // deno-lint-ignore no-explicit-any
  let format = typedFormat as any;

  // see if there is user config for this writer that we need to merge in
  const configFormats = baseFormat.metadata[kMetadataFormat];
  if (configFormats instanceof Object) {
    // deno-lint-ignore no-explicit-any
    const configFormat = (configFormats as any)[to];
    if (configFormat === "default" || configFormat === true) {
      format = metadataAsFormat({});
    } else if (configFormat instanceof Object) {
      format = metadataAsFormat(configFormat);
    }
  }

  // merge user config into default config
  const mergedFormat = mergeFormatMetadata(
    baseFormat,
    format,
  );

  // force keep_md and keep_tex if we are in debug mode
  if (debug) {
    mergedFormat.execute[kKeepMd] = true;
    mergedFormat.render[kKeepTex] = true;
  }

  return mergedFormat;
}

// determine all target formats
export function formatKeys(metadata: Metadata): string[] {
  if (typeof metadata[kMetadataFormat] === "string") {
    return [metadata[kMetadataFormat] as string];
  } else if (metadata[kMetadataFormat] instanceof Object) {
    return Object.keys(metadata[kMetadataFormat] as Metadata).filter((key) => {
      const format = (metadata[kMetadataFormat] as Metadata)[key];
      return format !== null && format !== false;
    });
  } else {
    return [];
  }
}

export function isQuartoMetadata(key: string) {
  return kRenderDefaultsKeys.includes(key) ||
    kExecuteDefaultsKeys.includes(key) ||
    kPandocDefaultsKeys.includes(key) ||
    kLanguageDefaultsKeys.includes(key);
}

export function isIncludeMetadata(key: string) {
  return [kHeaderIncludes, kIncludeBefore, kIncludeAfter].includes(key);
}

export function metadataAsFormat(metadata: Metadata): Format {
  const typedFormat: Format = {
    render: {},
    execute: {},
    pandoc: {},
    language: {},
    metadata: {},
  };
  // deno-lint-ignore no-explicit-any
  const format = typedFormat as { [key: string]: any };
  Object.keys(metadata).forEach((key) => {
    // allow stuff already sorted into a top level key through unmodified
    if (
      [
        kRenderDefaults,
        kExecuteDefaults,
        kPandocDefaults,
        kLanguageDefaults,
        kPandocMetadata,
      ]
        .includes(key)
    ) {
      // special case for 'execute' as boolean
      if (typeof (metadata[key]) == "boolean") {
        if (key === kExecuteDefaults) {
          format[key] = format[key] || {};
          format[kExecuteDefaults][kExecuteEnabled] = metadata[key];
        }
      } else {
        format[key] = { ...format[key], ...(metadata[key] as Metadata) };
      }
    } else {
      // move the key into the appropriate top level key
      if (kRenderDefaultsKeys.includes(key)) {
        format.render[key] = metadata[key];
      } else if (kExecuteDefaultsKeys.includes(key)) {
        format.execute[key] = metadata[key];
      } else if (kPandocDefaultsKeys.includes(key)) {
        format.pandoc[key] = metadata[key];
      } else if (kLanguageDefaultsKeys.includes(key)) {
        format.language[key] = metadata[key];
      } else {
        format.metadata[key] = metadata[key];
      }
    }
  });

  // coalese ipynb-filter to ipynb-filters
  const filter = format.execute[kIpynbFilter];
  if (typeof (filter) === "string") {
    typedFormat.execute[kIpynbFilters] = typedFormat.execute[kIpynbFilters] ||
      [];
    typedFormat.execute[kIpynbFilters]?.push(filter);
    delete (typedFormat.execute as Record<string, unknown>)[kIpynbFilter];
  }

  return typedFormat;
}

export function setFormatMetadata(
  format: Format,
  metadata: string,
  key: string,
  value: unknown,
) {
  if (typeof format.metadata[metadata] !== "object") {
    format.metadata[metadata] = {} as Record<string, unknown>;
  }
  // deno-lint-ignore no-explicit-any
  (format.metadata[metadata] as any)[key] = value;
}

export function metadataGetDeep(metadata: Metadata, property: string) {
  let values: unknown[] = [];
  ld.each(metadata, (value: unknown, key: string) => {
    if (key === property) {
      values.push(value);
    } else if (ld.isObject(value)) {
      values = values.concat(metadataGetDeep(value as Metadata, property));
    }
  });
  return values;
}

// certain keys are unmergeable (e.g. because they are an array type
// that should not be combined with other types)
const kUnmergeableKeys = [kTblColwidths];

export function mergeFormatMetadata<T>(
  config: T,
  ...configs: Array<T>
) {
  // copy all formats so we don't mutate them
  config = ld.cloneDeep(config);
  configs = ld.cloneDeep(configs);

  return ld.mergeWith(
    config,
    ...configs,
    (objValue: unknown, srcValue: unknown, key: string) => {
      if (kUnmergeableKeys.includes(key)) {
        return srcValue;
      } else {
        return mergeArrayCustomizer(objValue, srcValue);
      }
    },
  );
}

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
