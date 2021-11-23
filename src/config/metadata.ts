/*
* config.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { ld } from "lodash/mod.ts";

import { exists } from "fs/exists.ts";
import { join } from "path/mod.ts";
import { error } from "log/mod.ts";

import { readAndValidateYAML } from "../core/schema/annotated-yaml.ts";
import { mergeConfigs } from "../core/config.ts";
import { frontMatterSchema } from "../core/schema/front-matter.ts";

import {
  kExecuteDefaults,
  kExecuteDefaultsKeys,
  kExecuteEnabled,
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
} from "./constants.ts";
import { Format, Metadata } from "./types.ts";

export async function includedMetadata(
  dir: string,
  baseMetadata: Metadata,
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
    if (exists(yamlFile)) {
      try {
        // FIXME: Confirm. I think this is front-matter, not project config implied by the prev comment (_quarto.yml)
        const {
          yaml,
          yamlValidationErrors
        } = await readAndValidateYAML(yamlFile, frontMatterSchema, `Validation of metadata file ${yamlFile} failed.`);
        
        if (yamlValidationErrors.length) {
          throw new Error(`Validation of metadata file ${yamlFile} failed.`);
        }
        return yaml;
      } catch (e) {
        error("\nError reading metadata file from " + yamlFile + "\n");
        throw e;
      }
    } else {
      return undefined;
    }
  }));

  // merge the result
  return {
    metadata: mergeConfigs({}, ...filesMetadata),
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
  const mergedFormat = mergeConfigs(
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

export function isQuartoMetadata(key: string) {
  return kRenderDefaultsKeys.includes(key) ||
    kExecuteDefaultsKeys.includes(key) ||
    kPandocDefaultsKeys.includes(key) ||
    kLanguageDefaultsKeys.includes(key);
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
