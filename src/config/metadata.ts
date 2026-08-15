/*
 * config.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import * as ld from "../core/lodash.ts";

import { existsSync } from "../deno_ral/fs.ts";
import { join } from "../deno_ral/path.ts";
import { error } from "../deno_ral/log.ts";

import {
  readAndValidateYamlFromFile,
  readAndValidateYamlFromString,
} from "../core/schema/validated-yaml.ts";
import { mergeArrayCustomizer } from "../core/config.ts";
import { Schema } from "../core/lib/yaml-schema/types.ts";
import { execProcess } from "../core/process.ts";
import { handlerForScript } from "../core/run/run.ts";
import { RunHandlerOptions } from "../core/run/types.ts";
import { parseShellRunCommand } from "../core/run/shell.ts";

import {
  kCodeLinks,
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
  kOtherLinks,
  kPandocDefaults,
  kPandocDefaultsKeys,
  kPandocMetadata,
  kRenderDefaults,
  kRenderDefaultsKeys,
  kServer,
  kTblColwidths,
  kVariant,
} from "./constants.ts";
import { Format, Metadata } from "./types.ts";
import { kGfmCommonmarkVariant } from "../format/markdown/format-markdown-consts.ts";
import { kJupyterEngine, kKnitrEngine } from "../execute/types.ts";

// A `metadata-files`/`metadata-file` entry is either a plain path string, or
// a custom-tagged value (e.g. `!exec foo`). We normalize both shapes to a
// uniform `{ tag, value }` pair, mirroring the `{ tag, value }` shape that
// the js-yaml schema constructs for any custom tag (see core/yaml.ts's
// QuartoJSONSchema). Plain paths get the sentinel tag `kMetadataFilePathTag`
// so callers can dispatch on `spec.tag` alone.
const kMetadataFilePathTag = "path";

interface MetadataFileSpec {
  tag: string;
  value: string;
}

// Detects any custom YAML tag value (e.g. `!exec foo`, `!expr foo`), which
// the js-yaml schema always constructs as `{ tag, value }` (see
// core/yaml.ts's QuartoJSONSchema).
function isTagged(
  value: unknown,
): value is { tag: string; value: string } {
  return typeof value === "object" && value !== null &&
    typeof (value as Record<string, unknown>).tag === "string" &&
    typeof (value as Record<string, unknown>).value === "string";
}

function metadataFileSpec(dir: string, entry: unknown): MetadataFileSpec {
  if (isTagged(entry)) {
    return { tag: entry.tag, value: entry.value };
  } else {
    return { tag: kMetadataFilePathTag, value: join(dir, entry as string) };
  }
}

export async function includedMetadata(
  dir: string,
  baseMetadata: Metadata,
  schema: Schema,
): Promise<{ metadata: Metadata; files: string[] }> {
  // Read any metadata files (or !exec commands) that are defined in the
  // metadata itself
  const specs: MetadataFileSpec[] = [];
  const metadataFile = baseMetadata[kMetadataFile];
  if (metadataFile) {
    specs.push(metadataFileSpec(dir, metadataFile));
  }

  const metadataFiles = baseMetadata[kMetadataFiles];
  if (metadataFiles && Array.isArray(metadataFiles)) {
    metadataFiles.forEach((metadataFile) =>
      specs.push(metadataFileSpec(dir, metadataFile))
    );
  }

  const files: string[] = [];

  // Read the yaml
  const filesMetadata = await Promise.all(specs.map(async (spec) => {
    if (spec.tag === kMetadataFilePathTag) {
      const yamlFile = spec.value;
      files.push(yamlFile);
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
    }

    if (spec.tag === "!exec") {
      return await metadataFromCommand(dir, spec.value, schema, files);
    }

    error(`\nUnsupported tag '${spec.tag}' in metadata-file(s) entry.\n`);
    throw new Error(
      `metadata-file(s) entries only support plain paths or '!exec' commands, ` +
        `got tag '${spec.tag}'.`,
    );
  })) as Array<Metadata>;

  // merge the result
  return {
    metadata: mergeFormatMetadata({}, ...filesMetadata),
    files,
  };
}

// Executes a `!exec` metadata-file command and parses/validates its stdout
// as YAML, the same way a metadata file's contents would be validated.
async function metadataFromCommand(
  dir: string,
  command: string,
  schema: Schema,
  files: string[],
): Promise<Metadata> {
  const args = parseShellRunCommand(command);
  const script = args[0];

  // track the script so callers can treat it like any other metadata
  // dependency (e.g. for preview file-watching)
  files.push(join(dir, script));

  const handler = handlerForScript(script) ?? {
    run: async (
      script: string,
      args: string[],
      _stdin?: string,
      options?: RunHandlerOptions,
    ) => {
      return await execProcess({
        cmd: script,
        args,
        cwd: options?.cwd,
        stdout: options?.stdout,
      });
    },
  };

  let result;
  try {
    result = await handler.run(script, args.slice(1), undefined, {
      cwd: dir,
      stdout: "piped",
    });
  } catch (e) {
    error(`\nError executing metadata command '${command}'\n`);
    throw e;
  }

  if (!result.success) {
    error(
      `\nError executing metadata command '${command}' (exit code ${result.code})\n` +
        (result.stderr || ""),
    );
    throw new Error(`Metadata command failed: ${command}`);
  }

  try {
    return await readAndValidateYamlFromString(
      result.stdout || "",
      command,
      schema,
      `Validation of metadata produced by command '${command}' failed.`,
    ) as Metadata;
  } catch (e) {
    error(
      "\nError reading metadata produced by command '" + command + "'\n",
    );
    throw e;
  }
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
      } else {
        format.metadata[key] = metadata[key];
      }
    }
  });

  // normalize server type
  if (typeof (format.metadata[kServer]) === "string") {
    format.metadata[kServer] = {
      type: format.metadata[kServer],
    };
  }

  // coalese ipynb-filter to ipynb-filters
  const filter = format.execute[kIpynbFilter];
  if (typeof filter === "string") {
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

  // These boolean keys will disable array values
  const kBooleanDisableArrays = [kCodeLinks, kOtherLinks];

  return mergeConfigsCustomized<T>(
    (objValue: unknown, srcValue: unknown, key: string) => {
      if (kUnmergeableKeys.includes(key)) {
        return srcValue;
      } else if (key === kVariant) {
        return mergePandocVariant(objValue, srcValue);
      } else if (kBooleanDisableArrays.includes(key)) {
        return mergeDisablableArray(objValue, srcValue);
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
        kExandableStringKeys.includes(key) && typeof objValue === "string"
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

export function mergeDisablableArray(objValue: unknown, srcValue: unknown) {
  if (Array.isArray(objValue) && Array.isArray(srcValue)) {
    return mergeArrayCustomizer(objValue, srcValue);
  } else {
    if (srcValue === false) {
      return [];
    } else {
      const srcArr = srcValue !== undefined
        ? Array.isArray(srcValue) ? srcValue : [srcValue]
        : [];
      const objArr = objValue !== undefined
        ? Array.isArray(objValue) ? objValue : [objValue]
        : [];
      return mergeArrayCustomizer(objArr, srcArr);
    }
  }
}

export function mergePandocVariant(objValue: unknown, srcValue: unknown) {
  if (
    typeof objValue === "string" && typeof srcValue === "string" &&
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
