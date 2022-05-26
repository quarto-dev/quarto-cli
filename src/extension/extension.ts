/*
* extension.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { existsSync } from "fs/mod.ts";
import { warning } from "log/mod.ts";
import { coerce } from "semver/mod.ts";

import { kProjectType, ProjectContext } from "../project/types.ts";
import { isSubdir } from "fs/_util.ts";

import { dirname, join, normalize } from "path/mod.ts";
import { Metadata } from "../config/types.ts";
import { resolvePathGlobs } from "../core/path.ts";
import { toInputRelativePaths } from "../project/project-shared.ts";
import { projectType } from "../project/types/project-types.ts";
import { readYaml } from "../core/yaml.ts";
import { mergeConfigs } from "../core/config.ts";
import {
  Extension,
  ExtensionContext,
  ExtensionId,
  extensionIdString,
  kAuthor,
  kCommon,
  kContributes,
  kExtensionDir,
  kTitle,
  kVersion,
} from "./extension-shared.ts";

// Create an extension context that can be used to load extensions
// Provides caching such that directories will not be rescanned
// pmore than once for an extension context.
export function createExtensionContext(): ExtensionContext {
  const extensionCache: Record<string, Extension[]> = {};

  // Reads all extensions available to an input
  const extensions = (
    input: string,
    project?: ProjectContext,
  ): Extension[] => {
    // Load the extensions and resolve extension paths
    const extensions = loadExtensions(input, extensionCache, project);
    return Object.values(extensions).map((extension) =>
      resolveExtensionPaths(extension, input, project)
    );
  };

  // Reads a specific extension avialable to an input
  const extension = (
    name: string,
    input: string,
    project?: ProjectContext,
  ): Extension | undefined => {
    // Load the extension and resolve any paths
    const unresolved = loadExtension(name, input, project);
    return resolveExtensionPaths(unresolved, input, project);
  };

  return {
    extension,
    extensions,
  };
}

// Loads all extensions for a given input
const loadExtensions = (
  input: string,
  cache: Record<string, Extension[]>,
  project?: ProjectContext,
) => {
  const extensionPath = allExtensionDirs(input, project);
  const allExtensions: Record<string, Extension> = {};

  extensionPath.forEach((extensionDir) => {
    if (cache[extensionDir]) {
      cache[extensionDir].forEach((ext) => {
        allExtensions[extensionIdString(ext.id)] = resolveExtensionPaths(
          ext,
          input,
          project,
        );
      });
    } else {
      const extensions = readExtensions(extensionDir);
      extensions.forEach((extension) => {
        allExtensions[extensionIdString(extension.id)] = resolveExtensionPaths(
          extension,
          input,
          project,
        );
      });
      cache[extensionDir] = extensions;
    }
  });
  return allExtensions;
};

// Loads a single extension using a name (e.g. elsevier or elsevier@quarto-journals)
const loadExtension = (
  extension: string,
  input: string,
  project?: ProjectContext,
): Extension => {
  const extensionId = toExtensionId(extension);
  const extensionPath = discoverExtensionPath(input, extensionId, project);

  if (extensionPath) {
    // Find the metadata file, if any
    const file = extensionFile(extensionPath);
    if (file) {
      const extension = readExtension(extensionId, file);
      validateExtension(extension);
      return extension;
    } else {
      // This extension doesn't have an _extension file
      throw new Error(
        `Extension ${extension} is missing the expected _extensions.yml file.`,
      );
    }
  } else {
    // There is no extension with this name!
    throw new Error(
      `Unable to find extension ${extension}. Please ensure that the extension is installed.`,
    );
  }
};

// Fixes up paths for metatadata provided by an extension
function resolveExtensionPaths(
  extension: Extension,
  input: string,
  project?: ProjectContext,
) {
  const inputDir = dirname(input);
  return toInputRelativePaths(
    projectType(project?.config?.project?.[kProjectType]),
    extension.path,
    inputDir,
    extension,
  ) as unknown as Extension;
}

// Read the raw extension information out of a directory
// (e.g. read all the extensions from _extensions)
export function readExtensions(
  extensionsDirectory: string,
) {
  const extensions: Extension[] = [];
  const extensionDirs = Deno.readDirSync(extensionsDirectory);
  for (const extensionDir of extensionDirs) {
    if (extensionDir.isDirectory) {
      const extFile = extensionFile(
        join(extensionsDirectory, extensionDir.name),
      );
      if (extFile) {
        const extensionId = toExtensionId(extensionDir.name);
        const extension = readExtension(
          extensionId,
          extFile,
        );
        extensions.push(extension);
      }
    }
  }
  return extensions;
}

// Find all the extension directories available for a given input and project
// This will recursively search valid extension directories
function allExtensionDirs(input: string, project?: ProjectContext) {
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

  const extensionDirectories: string[] = [];
  if (project) {
    let currentDir = Deno.realPathSync(dirname(input));
    do {
      const extensionPath = extensionsDirPath(currentDir);
      if (extensionPath) {
        extensionDirectories.push(extensionPath);
      }
      currentDir = dirname(currentDir);
    } while (isSubdir(project.dir, currentDir) || project.dir === currentDir);
    return extensionDirectories;
  } else {
    const dir = extensionsDirPath(dirname(input));
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
  project?: ProjectContext,
) {
  const extensionDirGlobs = [];
  if (extensionId.organization) {
    // If there is an organization, always match that exactly
    extensionDirGlobs.push(
      `${extensionId.name}@${extensionId.organization}/`,
    );
  } else {
    // Otherwise, match either the exact string (e.g. acm or a wildcard org acm@*)
    extensionDirGlobs.push(`${extensionId.name}/`);
    extensionDirGlobs.push(`${extensionId.name}@*/`);
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
      return paths.include[0];
    } else {
      return undefined;
    }
  };

  // Start in the source directory
  const sourceDir = dirname(input);
  const sourceDirAbs = Deno.realPathSync(sourceDir);

  if (project && isSubdir(project.dir, sourceDirAbs)) {
    let extensionDir;
    let currentDir = normalize(sourceDirAbs);
    const projectDir = normalize(project.dir);
    while (!extensionDir) {
      extensionDir = findExtensionDir(currentDir, extensionDirGlobs);
      if (currentDir == projectDir) {
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
    extension[kContributes].filters,
    extension[kContributes].shortcodes,
    extension[kContributes].format,
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
}

// Reads raw extension data
function readExtension(
  extensionId: ExtensionId,
  extensionFile: string,
): Extension {
  const yaml = readYaml(extensionFile) as Metadata;
  const contributes = yaml[kContributes] as Metadata | undefined;

  const title = yaml[kTitle] as string;
  const author = yaml[kAuthor] as string;
  const versionRaw = yaml[kVersion] as string | undefined;
  const versionParsed = versionRaw ? coerce(versionRaw) : undefined;
  const version = versionParsed ? versionParsed : undefined;

  // The items that can be contributed
  const shortcodes = contributes?.shortcodes as string[] || [];
  const filters = contributes?.filters as string[] || [];
  const format = contributes?.format as Metadata || [];

  // Process the special 'common' key by merging it
  // into any key that isn't 'common' and then removing it
  Object.keys(format).filter((key) => {
    return key !== kCommon;
  }).forEach((key) => {
    format[key] = mergeConfigs(
      format[kCommon] || {},
      format[key],
    );
  });
  delete format[kCommon];

  // Resolve paths in the extension relative to the extension
  // metadata file
  const extensionDir = dirname(extensionFile);

  // Create the extension data structure
  return {
    title,
    author,
    version,
    id: extensionId,
    path: extensionDir,
    [kContributes]: {
      shortcodes: shortcodes.map((code) => join(extensionDir, code)),
      filters,
      format,
    },
  };
}

function toExtensionId(extension: string) {
  if (extension.indexOf("@") > -1) {
    const extParts = extension.split("@");
    return {
      name: extParts[0],
      organization: extParts.slice(1).join("@"),
    };
  } else {
    return {
      name: extension,
    };
  }
}

const extensionFile = (dir: string) => {
  return ["_extension.yml", "_extension.yaml"]
    .map((file) => join(dir, file))
    .find(existsSync);
};
