/*
 * extension.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { existsSync, walkSync } from "fs/mod.ts";
import { expandGlobSync } from "../core/deno/expand-glob.ts";
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
import { kSkipHidden, normalizePath, resolvePathGlobs } from "../core/path.ts";
import { toInputRelativePaths } from "../project/project-shared.ts";
import { projectType } from "../project/types/project-types.ts";
import { mergeConfigs } from "../core/config.ts";
import { quartoConfig } from "../core/quarto.ts";

import {
  kAuthor,
  kBuiltInExtNames,
  kBuiltInExtOrg,
  kCommon,
  kExtensionDir,
  kQuartoRequired,
  kRevealJSPlugins,
  kTitle,
  kVersion,
} from "./constants.ts";
import { extensionIdString } from "./extension-shared.ts";
import {
  Contributes,
  Extension,
  ExtensionContext,
  ExtensionId,
  ExtensionOptions,
  RevealPluginInline,
} from "./types.ts";

import { cloneDeep } from "../core/lodash.ts";
import { readAndValidateYamlFromFile } from "../core/schema/validated-yaml.ts";
import { getExtensionConfigSchema } from "../core/lib/yaml-schema/project-config.ts";
import { projectIgnoreGlobs } from "../project/project-shared.ts";
import { ProjectType } from "../project/types/types.ts";
import { copyResourceFile } from "../project/project-resources.ts";
import {
  RevealPlugin,
  RevealPluginBundle,
  RevealPluginScript,
} from "../format/reveal/format-reveal-plugin-types.ts";
import { resourcePath } from "../core/resources.ts";
import { warnOnce } from "../core/log.ts";
import { existsSync1 } from "../core/file.ts";

// This is where we maintain a list of extensions that have been promoted
// to 'built-in' status. If we see these extensions, we will filter them
// in favor of the built in functionality
const kQuartoExtOrganization = "quarto-ext";
const kQuartoExtBuiltIn = ["code-filename", "grouped-tabsets"];

// Create an extension context that can be used to load extensions
// Provides caching such that directories will not be rescanned
// pmore than once for an extension context.
export function createExtensionContext(): ExtensionContext {
  const extensionCache: Record<string, Extension[]> = {};

  // Reads all extensions available to an input
  const extensions = async (
    input?: string,
    config?: ProjectConfig,
    projectDir?: string,
    options?: ExtensionOptions,
  ): Promise<Extension[]> => {
    // Load the extensions and resolve extension paths
    const extensions = await loadExtensions(
      extensionCache,
      input,
      projectDir,
    );

    const results = Object.values(extensions).filter((ext) =>
      options?.builtIn !== false || ext.id.organization !== kBuiltInExtOrg
    );

    return results.map((extension) => {
      if (input) {
        return resolveExtensionPaths(extension, input, config);
      } else {
        return extension;
      }
    });
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
    contributes?: Contributes,
    config?: ProjectConfig,
    projectDir?: string,
    options?: ExtensionOptions,
  ): Promise<Extension[]> => {
    const extId = toExtensionId(name);
    return findExtensions(
      await extensions(input, config, projectDir, options),
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

// Resolves resources that are provided by a project into the
// site_lib directory (for example, a logo that is referenced from)
// _extensions/confluence/logo.png
// will be copied and resolved to:
// site_lib/quarto-contrib/quarto-project/confluence/logo.png
export function projectExtensionPathResolver(libDir: string) {
  return (href: string, projectOffset: string) => {
    const projectRelativeHref = relative(projectOffset, href);

    if (projectRelativeHref.startsWith("_extensions/")) {
      const projectTargetHref = projectRelativeHref.replace(
        /^_extensions\//,
        `${libDir}/quarto-contrib/quarto-project/`,
      );

      copyResourceFile(".", projectRelativeHref, projectTargetHref);
      return join(projectOffset, projectTargetHref);
    }

    return href;
  };
}

export function filterBuiltInExtensions(
  extensions: Extension[],
) {
  // First see if there are now built it (quarto organization)
  // filters that we previously provided by quarto-ext and
  // filter those out
  const quartoExts = extensions.filter((ext) => {
    return ext.id.organization === kBuiltInExtOrg;
  });

  // quarto-ext extensions that are now built in
  const nowBuiltInExtensions = extensions?.filter((ext) => {
    return ext.id.organization === "quarto-ext" &&
      quartoExts.map((ext) => ext.id.name).includes(ext.id.name);
  });

  if (nowBuiltInExtensions.length > 0) {
    // filter out the extensions that have become built in
    extensions = filterExtensionAndWarn(extensions, nowBuiltInExtensions);
  }

  return extensions;
}

function filterExtensionAndWarn(
  extensions: Extension[],
  filterOutExtensions: Extension[],
) {
  warnToRemoveExtensions(filterOutExtensions);
  // filter out the extensions that have become built in
  return extensions.filter((ext) => {
    return !filterOutExtensions.map((ext) => ext.id.name).includes(
      ext.id.name,
    );
  });
}

function warnToRemoveExtensions(extensions: Extension[]) {
  // Warn the user
  const removeCommands = extensions.map((ext) => {
    return `quarto remove extension ${extensionIdString(ext.id)}`;
  });
  warnOnce(
    `One or more extensions have been built in to Quarto. Please use the following command to remove the unneeded extension:\n  ${
      removeCommands.join("\n  ")
    }`,
  );
}

export function filterExtensions(
  extensions: Extension[],
  extensionId: string,
  type: string,
) {
  if (extensions && extensions.length > 0) {
    // First see if there are now built it (quarto organization)
    // filters that we previously provided by quarto-ext and
    // filter those out
    extensions = filterBuiltInExtensions(extensions);

    // First see whether there are more than one 'owned' extensions
    // which match. This means that the there are two different extension, from two
    // different orgs that match this simple id - user needs to disambiguate
    const ownedExtensions = extensions.filter((ext) => {
      return ext.id.organization !== undefined;
    }).map((ext) => {
      return extensionIdString(ext.id);
    });
    if (ownedExtensions.length > 1) {
      // There are more than one extensions with owners, warn
      // user that they should disambiguate
      warnOnce(
        `The ${type} '${extensionId}' matched more than one extension. Please use a full name to disambiguate:\n  ${
          ownedExtensions.join("\n  ")
        }`,
      );
    }

    // we periodically build in features that were formerly available from
    // the quarto-ext org. filter them out here (that allows them to remain
    // referenced in the yaml so we don't break code in the wild)
    const oldBuiltInExt = extensions?.filter((ext) => {
      return (ext.id.organization === kQuartoExtOrganization &&
        (kQuartoExtBuiltIn.includes(ext.id.name) ||
          kBuiltInExtNames.includes(ext.id.name)));
    });
    if (oldBuiltInExt.length > 0) {
      return filterExtensionAndWarn(extensions, oldBuiltInExt);
    } else {
      return extensions;
    }
  } else {
    return extensions;
  }
}

// Loads all extensions for a given input
// (note this needs to be sure to return copies from
// the cache in the event that the objects are mutated)
const loadExtensions = async (
  cache: Record<string, Extension[]>,
  input?: string,
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
  contributes?: Contributes,
) {
  // Filter the extension based upon what they contribute
  const exts = extensions.filter((ext) => {
    if (contributes === "shortcodes" && ext.contributes.shortcodes) {
      return true;
    } else if (contributes === "filters" && ext.contributes.filters) {
      return true;
    } else if (contributes === "formats" && ext.contributes.formats) {
      return true;
    } else if (contributes === "project" && ext.contributes.project) {
      return true;
    } else if (
      contributes === kRevealJSPlugins && ext.contributes[kRevealJSPlugins]
    ) {
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

export function extensionProjectType(
  extension: Extension,
  config?: ProjectConfig,
): ProjectType {
  if (extension.contributes.project) {
    const projType = extension.contributes.project?.type as string || "default";
    return projectType(projType);
  } else {
    return projectType(config?.project?.[kProjectType]);
  }
}

// Fixes up paths for metatadata provided by an extension
function resolveExtensionPaths(
  extension: Extension,
  input: string,
  config?: ProjectConfig,
) {
  const inputDir = Deno.statSync(input).isDirectory ? input : dirname(input);

  return toInputRelativePaths(
    extensionProjectType(extension, config),
    extension.path,
    inputDir,
    extension,
    kExtensionIgnoreFields,
  ) as unknown as Extension;
}

const kExtensionIgnoreFields = ["biblio-style", "revealjs-plugins"];

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
export function inputExtensionDirs(input?: string, projectDir?: string) {
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

  // read extensions (start with built-in)
  const extensionDirectories: string[] = [builtinExtensions()];
  if (projectDir && input) {
    let currentDir = normalizePath(inputDirName(input));
    do {
      const extensionPath = extensionsDirPath(currentDir);
      if (extensionPath) {
        extensionDirectories.push(extensionPath);
      }
      currentDir = dirname(currentDir);
    } while (isSubdir(projectDir, currentDir) || projectDir === currentDir);
    return extensionDirectories;
  } else if (input) {
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

  const findExtensionDir = (extDir: string, globs: string[]) => {
    // Find the matching extension for this name (ensuring that an _extension.yml file is present)
    const paths = resolvePathGlobs(extDir, globs, [], { mode: "strict" })
      .include.filter((path) => {
        return extensionFile(path);
      });

    if (paths.length > 0) {
      if (paths.length > 1) {
        warning(
          `More than one extension is available for ${extensionId.name} in the directory ${extDir}.\nExtensions that match:\n${
            paths.join("\n")
          }`,
        );
      }
      return relative(Deno.cwd(), paths[0]);
    } else {
      return undefined;
    }
  };

  // check for built-in
  const builtinExtensionDir = findExtensionDir(
    builtinExtensions(),
    extensionDirGlobs,
  );
  if (builtinExtensionDir) {
    return builtinExtensionDir;
  }

  // Start in the source directory
  const sourceDir = Deno.statSync(input).isDirectory ? input : dirname(input);
  const sourceDirAbs = normalizePath(sourceDir);

  if (projectDir && isSubdir(projectDir, sourceDirAbs)) {
    let extensionDir;
    let currentDir = normalize(sourceDirAbs);
    const projDir = normalize(projectDir);
    while (!extensionDir) {
      extensionDir = findExtensionDir(
        join(currentDir, kExtensionDir),
        extensionDirGlobs,
      );
      if (currentDir == projDir) {
        break;
      }
      currentDir = dirname(currentDir);
    }
    return extensionDir;
  } else {
    return findExtensionDir(
      join(sourceDirAbs, kExtensionDir),
      extensionDirGlobs,
    );
  }
}

// Path for built-in extensions
function builtinExtensions() {
  return resourcePath("extensions");
}

// Validate the extension
function validateExtension(extension: Extension) {
  let contribCount = 0;
  const contribs = [
    extension.contributes.filters,
    extension.contributes.shortcodes,
    extension.contributes.formats,
    extension.contributes.project,
    extension.contributes[kRevealJSPlugins],
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

  // Resolve 'default' specially
  Object.keys(formats).forEach((key) => {
    if (formats[key] === "default") {
      formats[key] = {};
    }
  });

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

    // If this is a custom writer, set the writer for the format
    // using the full path to the lua file
    if (key.endsWith(".lua")) {
      const fullPath = join(extensionDir, key);
      if (existsSync(fullPath)) {
        formatMeta.writer = fullPath;
      }
    }

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
    formatMeta[kRevealJSPlugins] = (formatMeta?.[kRevealJSPlugins] as Array<
      string | RevealPluginBundle | RevealPlugin
    > ||
      [])
      .flatMap(
        (plugin) => {
          return resolveRevealJSPlugin(
            embeddedExtensions,
            extensionDir,
            plugin,
          );
        },
      );
  });
  delete formats[kCommon];

  // Alias the contributions
  const shortcodes = ((contributes?.shortcodes || []) as string[]).map(
    (shortcode) => {
      return resolveShortcodePath(extensionDir, shortcode);
    },
  );
  const filters = ((contributes?.filters || []) as QuartoFilter[]).map(
    (filter) => {
      return resolveFilterPath(extensionDir, filter);
    },
  );
  const project = (contributes?.project || {}) as Record<string, unknown>;
  const revealJSPlugins = ((contributes?.[kRevealJSPlugins] || []) as Array<
    string | RevealPluginBundle | RevealPlugin
  >).map((plugin) => {
    return resolveRevealPlugin(extensionDir, plugin);
  });

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
      project,
      [kRevealJSPlugins]: revealJSPlugins,
    },
  };
  validateExtension(result);
  return result;
}

function resolveRevealJSPlugin(
  embeddedExtensions: Extension[],
  dir: string,
  plugin: string | RevealPluginBundle | RevealPlugin,
) {
  if (typeof (plugin) === "string") {
    // First attempt to load this plugin from an embedded extension
    const extensionId = toExtensionId(plugin);
    const extensions = findExtensions(
      embeddedExtensions,
      extensionId,
      "revealjs-plugins",
    );

    // If there are embedded extensions, return their plugins
    if (extensions.length > 0) {
      const plugins: Array<string | RevealPluginBundle | RevealPlugin> = [];
      for (const plugin of extensions[0].contributes[kRevealJSPlugins] || []) {
        plugins.push(plugin);
      }
      return plugins;
    } else {
      // There are no embedded extensions for this, validate the path
      validateExtensionPath("revealjs-plugin", dir, plugin);
      return resolveRevealPlugin(dir, plugin);
    }
  } else {
    return plugin;
  }
}

export function isPluginRaw(
  plugin: RevealPluginBundle | RevealPluginInline,
): plugin is RevealPluginInline {
  return (plugin as RevealPluginBundle).plugin === undefined;
}

function resolveRevealPlugin(
  extensionDir: string,
  plugin: string | RevealPluginBundle | RevealPluginInline,
): string | RevealPluginBundle | RevealPlugin {
  // Filters are expected to be absolute
  if (typeof (plugin) === "string") {
    return join(extensionDir, plugin);
  } else if (isPluginRaw(plugin)) {
    return resolveRevealPluginInline(plugin, extensionDir);
  } else {
    plugin.plugin = join(extensionDir, plugin.plugin);
    return plugin;
  }
}

function resolveRevealPluginInline(
  plugin: RevealPluginInline,
  extensionDir: string,
): RevealPlugin {
  if (!plugin.name) {
    throw new Error(
      `Invalid revealjs-plugin in ${extensionDir} - 'name' property is required.`,
    );
  }

  // Resolve plugin raw into plugin
  const resolvedPlugin: RevealPlugin = {
    name: plugin.name,
    path: extensionDir,
    register: plugin.register,
    config: plugin.config,
  };
  if (plugin.script) {
    const pluginArr = Array.isArray(plugin.script)
      ? plugin.script
      : [plugin.script];
    resolvedPlugin.script = pluginArr.map((plug) => {
      if (typeof (plug) === "string") {
        return {
          path: plug,
        } as RevealPluginScript;
      } else {
        return plug;
      }
    });
  }

  if (plugin.stylesheet) {
    resolvedPlugin.stylesheet = Array.isArray(plugin.stylesheet)
      ? plugin.stylesheet
      : [plugin.stylesheet];
  }
  return resolvedPlugin;
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
      // Shortcodes are expected to be absolute
      shortcodes.push(resolveShortcodePath(extensions[0].path, shortcode));
    }
    return shortcodes;
  } else {
    // There are no embedded extensions for this, validate the path
    validateExtensionPath("shortcode", dir, shortcode);
    return resolveShortcodePath(dir, shortcode);
  }
}

function resolveShortcodePath(
  extensionDir: string,
  shortcode: string,
): string {
  if (isAbsolute(shortcode)) {
    return shortcode;
  } else {
    return join(extensionDir, shortcode);
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
        filters.push(resolveFilterPath(extensions[0].path, filter));
      }
      return filters;
    } else {
      validateExtensionPath("filter", dir, filter);
      return resolveFilterPath(dir, filter);
    }
  } else {
    validateExtensionPath("filter", dir, filter.path);
    return resolveFilterPath(dir, filter);
  }
}

function resolveFilterPath(
  extensionDir: string,
  filter: QuartoFilter,
): QuartoFilter {
  // Filters are expected to be absolute
  if (typeof (filter) === "string") {
    if (isAbsolute(filter)) {
      return filter;
    } else {
      return join(extensionDir, filter);
    }
  } else {
    return {
      type: filter.type,
      path: isAbsolute(filter.path)
        ? filter.path
        : join(extensionDir, filter.path),
    };
  }
}

// Validates that the path exists. For filters and short codes used in extensions,
// either the item should resolve using an embedded extension, or the path
// should exist. You cannot reference a non-existent file in an extension
function validateExtensionPath(
  type: "filter" | "shortcode" | "revealjs-plugin",
  dir: string,
  path: string,
) {
  const resolves = existsSync(join(dir, path));
  if (!resolves) {
    throw Error(
      `Failed to resolve referenced ${type} ${path} - path does not exist.\nIf you are attempting to use another extension within this extension, please install the extension using the 'quarto install --embedded' command.`,
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
    .find(existsSync1);
};
