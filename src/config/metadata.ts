/*
* config.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { dirname, extname, join } from "path/mod.ts";
import { existsSync } from "fs/exists.ts";

import { readYaml } from "../core/yaml.ts";
import { mergeConfigs } from "../core/config.ts";
import { message } from "../core/console.ts";

import {
  kExecutionDefaults,
  kExecutionDefaultsKeys,
  kKeepMd,
  kKeepTex,
  kMetadataFormat,
  kPandocDefaults,
  kPandocDefaultsKeys,
  kPandocMetadata,
  kRenderDefaults,
  kRenderDefaultsKeys,
} from "./constants.ts";
import { defaultWriterFormat, Format } from "./format.ts";

export type Metadata = {
  [key: string]: unknown;
};

export function projectMetadata(file: string): Metadata {
  file = Deno.realPathSync(file);
  let dir: string | undefined;
  while (true) {
    // determine next directory to inspect (terminate if we can't go any higher)
    if (!dir) {
      dir = dirname(file);
    } else {
      const nextDir = dirname(dir);
      if (nextDir === dir) {
        return {};
      } else {
        dir = nextDir;
      }
    }

    // Read metadata from the quarto directory
    const quartoDir = join(dir, "_quarto");
    if (existsSync(quartoDir)) {
      return readQuartoYaml(quartoDir);
    }
  }
}

export function formatFromMetadata(
  baseFormat: Format,
  to: string,
  debug?: boolean,
): Format {
  // user format options (allow any b/c this is just untyped yaml)
  const typedFormat: Format = {
    render: {},
    execution: {},
    pandoc: {},
    metadata: {},
  };
  // deno-lint-ignore no-explicit-any
  let format = typedFormat as any;

  // see if there is user config for this writer that we need to merge in
  const configFormats = baseFormat.metadata[kMetadataFormat];
  if (configFormats instanceof Object) {
    // deno-lint-ignore no-explicit-any
    const configFormat = (configFormats as any)[to];
    if (configFormat === "default") {
      format = metadataAsFormat({});
    } else if (configFormat instanceof Object) {
      format = metadataAsFormat(configFormat);
    }
  }

  // merge user config into default config
  const mergedFormat = mergeConfigs(
    defaultWriterFormat(to),
    baseFormat,
    format,
  );

  // force keep_md and keep_tex if we are in debug mode
  if (debug) {
    mergedFormat.render[kKeepMd] = true;
    mergedFormat.render[kKeepTex] = true;
  }

  return mergedFormat;
}

export function metadataAsFormat(metadata: Metadata): Format {
  const typedFormat: Format = {
    render: {},
    execution: {},
    pandoc: {},
    metadata: {},
  };
  // deno-lint-ignore no-explicit-any
  const format = typedFormat as { [key: string]: any };
  Object.keys(metadata).forEach((key) => {
    // allow stuff already sorted into a top level key through unmodified
    if (
      [
        kRenderDefaults,
        kExecutionDefaults,
        kPandocDefaults,
        kPandocMetadata,
      ]
        .includes(key)
    ) {
      format[key] = metadata[key];
    } else {
      // move the key into the appropriate top level key
      if (kRenderDefaultsKeys.includes(key)) {
        format.render[key] = metadata[key];
      } else if (kExecutionDefaultsKeys.includes(key)) {
        format.execution[key] = metadata[key];
      } else if (kPandocDefaultsKeys.includes(key)) {
        format.pandoc[key] = metadata[key];
      } else {
        format.metadata[key] = metadata[key];
      }
    }
  });
  return typedFormat;
}

function readQuartoYaml(directory: string) {
  // Reads all the metadata files from the directory
  // and merges them in the order in which they are read

  let lastFile: string | undefined = undefined;
  try {
    // Read the metadata files from the directory
    const yamls = [];
    for (const entry of Deno.readDirSync(directory)) {
      if (entry.isFile && extname(entry.name) === ".yml") {
        const yamlFilePath = join(directory, entry.name);

        // Hang onto the last file we read in the event we need it for error message
        lastFile = yamlFilePath;
        console.log(yamlFilePath);

        // Read the metadata for this file
        yamls.push(readYaml(yamlFilePath) as Metadata);
      }
    }

    // Return the merged metadata
    return mergeConfigs({}, ...yamls);
  } catch (e) {
    message("\nError reading quarto configuration at " + lastFile + "\n");
    throw e;
  }
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
