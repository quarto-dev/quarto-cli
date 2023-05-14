/*
 * config.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import * as ld from "../core/lodash.ts";

import { existsSync } from "fs/mod.ts";
import { join } from "path/mod.ts";
import { error } from "log/mod.ts";

import { readAndValidateYamlFromFile } from "../core/schema/validated-yaml.ts";
import { mergeArrayCustomizer } from "../core/config.ts";
import { Schema } from "../core/lib/yaml-schema/types.ts";

import {
  kExecuteDefaults,
  kExecuteDefaultsKeys,
  kExecuteEnabled,
  kHeaderIncludes,
  kIdentifierDefaults,
  kIdentifierDefaultsKeys,
  kIncludeAfter,
  kIncludeBefore,
  kIpynbFilter,
  kIpynbFilters,
  kKeepMd,
  kKeepTex,
  kKeepTyp,
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
  kVariant,
} from "./constants.ts";
import { Format, Metadata } from "./types.ts";
import { kGfmCommonmarkVariant } from "../format/markdown/format-markdown-consts.ts";
import { kJupyterEngine, kKnitrEngine } from "../execute/types.ts";

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
    if (existsSync(yamlFile)) {
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
    identifier: {},
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
    mergedFormat.render[kKeepTyp] = true;
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
    kLanguageDefaultsKeys.includes(key) ||
    [kKnitrEngine, kJupyterEngine].includes(key);
}

export function isIncludeMetadata(key: string) {
  return [kHeaderIncludes, kIncludeBefore, kIncludeAfter].includes(key);
}

export function metadataAsFormat(metadata: Metadata): Format {
  const typedFormat: Format = {
    identifier: {},
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
        kIdentifierDefaults,
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
      if (kIdentifierDefaultsKeys.includes(key)) {
        format.identifier[key] = metadata[key];
      } else if (kRenderDefaultsKeys.includes(key)) {
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

  // expand gfm alias in variant
  if (typeof (typedFormat.render.variant) === "string") {
    typedFormat.render.variant = typedFormat.render.variant.replace(
      /^gfm/,
      kGfmCommonmarkVariant,
    );
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

export function mergeFormatMetadata<T>(
  config: T,
  ...configs: Array<T>
) {
  // certain keys are unmergeable (e.g. because they are an array type
  // that should not be combined with other types)
  const kUnmergeableKeys = [kTblColwidths];

  return mergeConfigsCustomized<T>(
    (objValue: unknown, srcValue: unknown, key: string) => {
      if (kUnmergeableKeys.includes(key)) {
        return srcValue;
      } else if (key === kVariant) {
        return mergePandocVariant(objValue, srcValue);
      } else {
        return undefined;
      }
    },
    config,
    ...configs,
  );
}

export function mergeProjectMetadata<T>(
  config: T,
  ...configs: Array<T>
) {
  // certain keys that expand into arrays should be overriden if they
  // are just a string
  const kExandableStringKeys = ["contents"];

  return mergeConfigsCustomized<T>(
    (objValue: unknown, srcValue: unknown, key: string) => {
      if (
        kExandableStringKeys.includes(key) && typeof (objValue) === "string"
      ) {
        return srcValue;
      } else {
        return undefined;
      }
    },
    config,
    ...configs,
  );
}

export function mergeConfigsCustomized<T>(
  customizer: (
    objValue: unknown,
    srcValue: unknown,
    key: string,
  ) => unknown | undefined,
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
      const custom = customizer(objValue, srcValue, key);
      if (custom !== undefined) {
        return custom;
      } else {
        return mergeArrayCustomizer(objValue, srcValue);
      }
    },
  );
}

export function mergePandocVariant(objValue: unknown, srcValue: unknown) {
  if (
    typeof (objValue) === "string" && typeof (srcValue) === "string" &&
    (objValue !== srcValue)
  ) {
    // merge srcValue into objValue
    const extensions: { [key: string]: boolean } = {};
    [...parsePandocVariant(objValue), ...parsePandocVariant(srcValue)]
      .forEach((extension) => {
        extensions[extension.name] = extension.enabled;
      });
    return Object.keys(extensions).map((name) =>
      `${extensions[name] ? "+" : "-"}${name}`
    ).join("");
  } else {
    return undefined;
  }
}

function parsePandocVariant(variant: string) {
  // remove any linebreaks
  variant = variant.split("\n").join();

  // parse into separate entries
  const extensions: Array<{ name: string; enabled: boolean }> = [];
  const re = /([+-])([a-z_]+)/g;
  let match = re.exec(variant);
  while (match) {
    extensions.push({ name: match[2], enabled: match[1] === "+" });
    match = re.exec(variant);
  }

  return extensions;
}
