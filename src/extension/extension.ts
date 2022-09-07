/*
* extension.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { existsSync, expandGlobSync, walkSync } from "fs/mod.ts";
import { warning } from "log/mod.ts";
import { coerce, Range, satisfies } from "semver/mod.ts";

import {
  kProjectType,
  ProjectConfig,
  ProjectContext,
} from "../project/types.ts";
import { isSubdir } from "fs/_util.ts";

import { dirname, isAbsolute, join, normalize, relative } from "path/mod.ts";
import { Metadata, QuartoFilter } from "../config/types.ts";
import { kSkipHidden, resolvePathGlobs } from "../core/path.ts";
import { toInputRelativePaths } from "../project/project-shared.ts";
import { projectType } from "../project/types/project-types.ts";
import { mergeConfigs } from "../core/config.ts";
import { quartoConfig } from "../core/quarto.ts";

import {
  Extension,
  ExtensionContext,
  ExtensionId,
  extensionIdString,
  kAuthor,
  kCommon,
  kExtensionDir,
  kQuartoRequired,
  kTitle,
  kVersion,
} from "./extension-shared.ts";
import { cloneDeep } from "../core/lodash.ts";
import { readAndValidateYamlFromFile } from "../core/schema/validated-yaml.ts";
import { getExtensionConfigSchema } from "../core/lib/yaml-schema/project-config.ts";
import { projectIgnoreGlobs } from "../project/project-context.ts";

// Create an extension context that can be used to load extensions
// Provides caching such that directories will not be rescanned
// pmore than once for an extension context.
export function createExtensionContext(): ExtensionContext {
  const extensionCache: Record<string, Extension[]> = {};

  // Reads all extensions available to an input
  const extensions = async (
    input: string,
    config?: ProjectConfig,
    projectDir?: string,
  ): Promise<Extension[]> => {
    // Load the extensions and resolve extension paths
    const extensions = await loadExtensions(
      input,
      extensionCache,
      projectDir,
    );
    return Object.values(extensions).map((extension) =>
      resolveExtensionPaths(extension, input, config)
    );
  };

  // Reads a specific extension avialable to an input
  const extension = async (
    name: string,
    input: string,
    config?: ProjectConfig,
    projectDir?: string,
  ): Promise<Extension | undefined> => {
    // Load the extension and resolve any paths
    const unresolved = await loadExtension(name, input, projectDir);
    return resolveExtensionPaths(unresolved, input, config);
  };

  const find = async (
    name: string,
    input: string,
    contributes?: "shortcodes" | "filters" | "formats",
    config?: ProjectConfig,
    projectDir?: string,
  ): Promise<Extension[]> => {
    const extId = toExtensionId(name);
    return findExtensions(
      await extensions(input, config, projectDir),
      extId,
      contributes,
    );
  };

  return {
    extension,
    extensions,
    find,
  };
}

// Loads all extensions for a given input
// (note this needs to be sure to return copies from
// the cache in the event that the objects are mutated)
const loadExtensions = async (
  input: string,
  cache: Record<string, Extension[]>,
  projectDir?: string,
) => {
  const extensionPath = inputExtensionDirs(input, projectDir);
  const allExtensions: Record<string, Extension> = {};

  for (const extensionDir of extensionPath) {
    if (cache[extensionDir]) {
      cache[extensionDir].forEach((ext) => {
        allExtensions[extensionIdString(ext.id)] = cloneDeep(ext);
      });
    } else {
      const extensions = await readExtensions(extensionDir);
      extensions.forEach((extension) => {
        allExtensions[extensionIdString(extension.id)] = cloneDeep(extension);
      });
      cache[extensionDir] = extensions;
    }
  }

  return allExtensions;
};

// Loads a single extension using a name (e.g. elsevier or quarto-journals/elsevier)
const loadExtension = async (
  extension: string,
  input: string,
  projectDir?: string,
): Promise<Extension> => {
  const extensionId = toExtensionId(extension);
  const extensionPath = discoverExtensionPath(input, extensionId, projectDir);

  if (extensionPath) {
    // Find the metadata file, if any
    const file = extensionFile(extensionPath);
    if (file) {
      const extension = await readExtension(extensionId, file);
      validateExtension(extension);
      return extension;
    } else {
      // This extension doesn't have an _extension file
      throw new Error(
        `The extension '${extension}' is missing the expected '_extension.yml' file.`,
      );
    }
  } else {
    // There is no extension with this name!
    throw new Error(
      `Unable to read the extension '${extension}'.\nPlease ensure that you provided the correct id and that the extension is installed.`,
    );
  }
};

// Searches extensions for an extension(s) with a specified
// Id and which optionally contributes specific extension elements
function findExtensions(
  extensions: Extension[],
  extensionId: ExtensionId,
  contributes?: "shortcodes" | "filters" | "formats",
) {
  // Filter the extension based upon what they contribute
  const exts = extensions.filter((ext) => {
    if (contributes === "shortcodes" && ext.contributes.shortcodes) {
      return true;
    } else if (contributes === "filters" && ext.contributes.filters) {
      return true;
    } else if (contributes === "formats" && ext.contributes.formats) {
      return true;
    } else {
      return contributes === undefined;
    }
  });

  // First try an exact match
  if (extensionId.organization) {
    const exact = exts.filter((ext) => {
      return (ext.id.name === extensionId.name &&
        ext.id.organization === extensionId.organization);
    });
    if (exact.length > 0) {
      return exact;
    }
  }

  // If there wasn't an exact match, try just using the name
  const nameMatches = exts.filter((ext) => {
    return extensionId.name === ext.id.name;
  });

  // Sort to make the unowned version first
  const sortedMatches = nameMatches.sort((ext1, _ext2) => {
    return ext1.id.organization === undefined ? -1 : 1;
  });

  return sortedMatches;
}

// Fixes up paths for metatadata provided by an extension
function resolveExtensionPaths(
  extension: Extension,
  input: string,
  config?: ProjectConfig,
) {
  const inputDir = Deno.statSync(input).isDirectory ? input : dirname(input);
  return toInputRelativePaths(
    projectType(config?.project?.[kProjectType]),
    extension.path,
    inputDir,
    extension,
    [kExtensionIgnoreFields],
  ) as unknown as Extension;
}

const kExtensionIgnoreFields = "biblio-style";

// Read the raw extension information out of a directory
// (e.g. read all the extensions from _extensions)
export async function readExtensions(
  extensionsDirectory: string,
  organization?: string,
) {
  const extensions: Extension[] = [];
  const extensionDirs = Deno.readDirSync(extensionsDirectory);
  for (const extensionDir of extensionDirs) {
    if (extensionDir.isDirectory) {
      const extFile = extensionFile(
        join(extensionsDirectory, extensionDir.name),
      );
      if (extFile) {
        // This is a directory that contains an extension
        // This represents an 'anonymous' extension that doesn't
        // have an owner
        const extensionId = { name: extensionDir.name, organization };
        const extension = await readExtension(
          extensionId,
          extFile,
        );
        extensions.push(extension);
      } else if (!organization) {
        // If we're at the root level and this folder is an extension folder
        // treat it as an 'owner' and look inside this folder to see if
        // there are extensions in subfolders. Only read 1 level.
        const ownedExtensions = await readExtensions(
          join(extensionsDirectory, extensionDir.name),
          extensionDir.name,
        );
        if (ownedExtensions) {
          extensions.push(...ownedExtensions);
        }
      }
    }
  }

  return extensions;
}

export function projectExtensionDirs(project: ProjectContext) {
  const extensionDirs: string[] = [];
  for (
    const walk of expandGlobSync(join(project.dir, "**/_extensions"), {
      exclude: [...projectIgnoreGlobs(project.dir), "**/.*", "**/.*/**"],
    })
  ) {
    extensionDirs.push(walk.path);
  }
  return extensionDirs;
}

export function extensionFilesFromDirs(dirs: string[]) {
  const files: string[] = [];
  for (const dir of dirs) {
    for (
      const walk of walkSync(
        dir,
        {
          includeDirs: false,
          followSymlinks: false,
          skip: [kSkipHidden],
        },
      )
    ) {
      files.push(walk.path);
    }
  }
  return files;
}

// Find all the extension directories available for a given input and project
// This will recursively search valid extension directories
export function inputExtensionDirs(input: string, projectDir?: string) {
  const extensionsDirPath = (path: string) => {
    const extPath = join(path, kExtensionDir);
    try {
      if (Deno.statSync(extPath).isDirectory) {
        return extPath;
      } else {
        return undefined;
      }
    } catch {
      return undefined;
    }
  };

  const inputDirName = (inputOrDir: string) => {
    if (Deno.statSync(inputOrDir).isDirectory) {
      return inputOrDir;
    } else {
      return dirname(inputOrDir);
    }
  };

  const extensionDirectories: string[] = [];
  if (projectDir) {
    let currentDir = Deno.realPathSync(inputDirName(input));
    do {
      const extensionPath = extensionsDirPath(currentDir);
      if (extensionPath) {
        extensionDirectories.push(extensionPath);
      }
      currentDir = dirname(currentDir);
    } while (isSubdir(projectDir, currentDir) || projectDir === currentDir);
    return extensionDirectories;
  } else {
    const dir = extensionsDirPath(inputDirName(input));
    if (dir) {
      extensionDirectories.push(dir);
    }
  }
  return extensionDirectories;
}

// Finds the path to a specific extension by name/id
export function discoverExtensionPath(
  input: string,
  extensionId: ExtensionId,
  projectDir?: string,
) {
  const extensionDirGlobs = [];
  if (extensionId.organization) {
    // If there is an organization, always match that exactly
    extensionDirGlobs.push(
      `${extensionId.organization}/${extensionId.name}/`,
    );
  } else {
    // Otherwise, match either the exact string (e.g. acm or a wildcard org */acm/)
    extensionDirGlobs.push(`${extensionId.name}/`);
    extensionDirGlobs.push(`*/${extensionId.name}/`);
  }

  const findExtensionDir = (dir: string, globs: string[]) => {
    // The `_extensions` directory
    const extDir = join(dir, kExtensionDir);

    // Find the matching extension for this name
    const paths = resolvePathGlobs(extDir, globs, [], { mode: "strict" });

    if (paths.include.length > 0) {
      if (paths.include.length > 1) {
        warning(
          `More than one extension is available for ${extensionId.name} in the directory ${extDir}.\nExtensions that match:\n${
            paths.include.join("\n")
          }`,
        );
      }
      return relative(Deno.cwd(), paths.include[0]);
    } else {
      return undefined;
    }
  };

  // Start in the source directory
  const sourceDir = Deno.statSync(input).isDirectory ? input : dirname(input);
  const sourceDirAbs = Deno.realPathSync(sourceDir);

  if (projectDir && isSubdir(projectDir, sourceDirAbs)) {
    let extensionDir;
    let currentDir = normalize(sourceDirAbs);
    const projDir = normalize(projectDir);
    while (!extensionDir) {
      extensionDir = findExtensionDir(currentDir, extensionDirGlobs);
      if (currentDir == projDir) {
        break;
      }
      currentDir = dirname(currentDir);
    }
    return extensionDir;
  } else {
    return findExtensionDir(sourceDirAbs, extensionDirGlobs);
  }
}

// Validate the extension
function validateExtension(extension: Extension) {
  let contribCount = 0;
  const contribs = [
    extension.contributes.filters,
    extension.contributes.shortcodes,
    extension.contributes.formats,
  ];
  contribs.forEach((contrib) => {
    if (contrib) {
      if (Array.isArray(contrib)) {
        contribCount = contribCount + contrib.length;
      } else if (typeof (contrib) === "object") {
        contribCount = contribCount + Object.keys(contrib).length;
      }
    }
  });

  if (contribCount === 0) {
    throw new Error(
      `The extension ${
        extension.title || extension.id.name
      } is not valid- it does not contribute anything.`,
    );
  }
  if (
    extension.quartoVersion &&
    !satisfies(quartoConfig.version(), extension.quartoVersion)
  ) {
    throw new Error(
      `The extension ${
        extension.title || extension.id.name
      } is incompatible with this quarto version.

Extension requires: ${extension.quartoVersion.raw}
Quarto version: ${quartoConfig.version()}`,
    );
  }
}

// Reads raw extension data
async function readExtension(
  extensionId: ExtensionId,
  extensionFile: string,
): Promise<Extension> {
  const extensionSchema = await getExtensionConfigSchema();
  const yaml = (await readAndValidateYamlFromFile(
    extensionFile,
    extensionSchema,
    "YAML Validation Failed",
  )) as Metadata;

  const readVersionRange = (str: string): Range => {
    return new Range(str);
  };

  const contributes = yaml.contributes as Metadata | undefined;

  const title = yaml[kTitle] as string;
  const author = yaml[kAuthor] as string;
  const versionRaw = yaml[kVersion] as string | undefined;
  const quartoVersionRaw = yaml[kQuartoRequired] as string | undefined;
  const versionParsed = versionRaw ? coerce(versionRaw) : undefined;
  const quartoVersion = quartoVersionRaw
    ? readVersionRange(quartoVersionRaw)
    : undefined;
  const version = versionParsed ? versionParsed : undefined;

  // The directory containing this extension
  // Paths used should be considered relative to this dir
  const extensionDirRaw = dirname(extensionFile);
  const extensionDir = isAbsolute(extensionDirRaw)
    ? extensionDirRaw
    : join(Deno.cwd(), extensionDirRaw);

  // The formats that are being contributed
  const formats = contributes?.formats as Metadata ||
    contributes?.format as Metadata || {};

  // Read any embedded extension
  const embeddedExtensions = existsSync(join(extensionDir, kExtensionDir))
    ? await readExtensions(join(extensionDir, kExtensionDir))
    : [];

  // Process the special 'common' key by merging it
  // into any key that isn't 'common' and then removing it
  Object.keys(formats).filter((key) => {
    return key !== kCommon;
  }).forEach((key) => {
    formats[key] = mergeConfigs(
      formats[kCommon] || {},
      formats[key],
    );

    const formatMeta = formats[key] as Metadata;

    // Resolve shortcodes and filters (these might come from embedded extension)
    // Note that resolving will throw if the extension cannot be resolved
    formatMeta.shortcodes = (formatMeta.shortcodes as string[] || []).flatMap((
      shortcode,
    ) => {
      return resolveShortcode(embeddedExtensions, extensionDir, shortcode);
    });
    formatMeta.filters = (formatMeta.filters as QuartoFilter[] || []).flatMap(
      (filter) => {
        return resolveFilter(embeddedExtensions, extensionDir, filter);
      },
    );
  });
  delete formats[kCommon];

  // Alias the contributions
  const shortcodes = (contributes?.shortcodes || []) as string[];
  const filters = (contributes?.filters || {}) as QuartoFilter[];

  // Create the extension data structure
  const result = {
    title,
    author,
    version,
    quartoVersion,
    id: extensionId,
    path: extensionDir,
    contributes: {
      shortcodes,
      filters,
      formats,
    },
  };
  validateExtension(result);
  return result;
}

// This will resolve a shortcode contributed by this extension
// loading embedded extensions and replacing the extension name
// with the contributed shortcode paths
function resolveShortcode(
  embeddedExtensions: Extension[],
  dir: string,
  shortcode: string,
) {
  // First attempt to load this shortcode from an embedded extension
  const extensionId = toExtensionId(shortcode);
  const extensions = findExtensions(
    embeddedExtensions,
    extensionId,
    "shortcodes",
  );

  // If there are embedded extensions, return their shortcodes
  if (extensions.length > 0) {
    const shortcodes: string[] = [];
    for (const shortcode of extensions[0].contributes.shortcodes || []) {
      // Shortcodes are expected to be extension relative paths
      shortcodes.push(relative(dir, join(extensions[0].path, shortcode)));
    }
    return shortcodes;
  } else {
    // There are no embedded extensions for this, validate the path
    validateExtensionPath("shortcode", dir, shortcode);
    return shortcode;
  }
}

// This will replace the given QuartoFilter with one more resolved filters,
// loading embedded extensions (if referenced) and replacing the extension
// name with any filters that the embedded extension provides.
function resolveFilter(
  embeddedExtensions: Extension[],
  dir: string,
  filter: QuartoFilter,
) {
  if (typeof (filter) === "string") {
    // First attempt to load this shortcode from an embedded extension
    const extensionId = toExtensionId(filter);
    const extensions = findExtensions(
      embeddedExtensions,
      extensionId,
      "filters",
    );
    if (extensions.length > 0) {
      const filters: QuartoFilter[] = [];
      for (const filter of extensions[0].contributes.filters || []) {
        // Filters are expected to be extension relative paths
        if (typeof (filter) === "string") {
          filters.push(relative(dir, join(extensions[0].path, filter)));
        } else {
          filters.push({
            type: filter.type,
            path: relative(dir, join(extensions[0].path, filter.path)),
          });
        }
      }
      return filters;
    } else {
      validateExtensionPath("filter", dir, filter);
      return filter;
    }
  } else {
    validateExtensionPath("filter", dir, filter.path);
    return filter.path;
  }
}

// Validates that the path exists. For filters and short codes used in extensions,
// either the item should resolve using an embedded extension, or the path
// should exist. You cannot reference a non-existent file in an extension
function validateExtensionPath(
  type: "filter" | "shortcode",
  dir: string,
  path: string,
) {
  const resolves = existsSync(join(dir, path));
  if (!resolves) {
    throw Error(
      `Failed to resolve referenced ${type} ${path} - path does not exist.\nIf you attempting to use another extension within this extension, please install the extension using the 'quarto install --embedded' command.`,
    );
  }
  return resolves;
}

// Parses string into extension Id
// <organization>/<name>
// <name>
function toExtensionId(extension: string) {
  if (extension.indexOf("/") > -1) {
    const extParts = extension.split("/");
    // Names with organization have exactly 1 slash
    if (extParts.length === 2) {
      return {
        name: extParts[1],
        organization: extParts[0],
      };
    } else {
      return {
        name: extension,
      };
    }
  } else {
    return {
      name: extension,
    };
  }
}

export const extensionFile = (dir: string) => {
  return ["_extension.yml", "_extension.yaml"]
    .map((file) => join(dir, file))
    .find(existsSync);
};
