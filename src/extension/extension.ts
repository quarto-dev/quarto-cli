/*
* extension.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { existsSync } from "fs/mod.ts";
import { warning } from "log/mod.ts";
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
  ExtensionId,
  kAuthor,
  kCommon,
  kContributes,
  kExtensionDir,
  kTitle,
  kVersion,
} from "./extension-shared.ts";
import { parseVersion } from "./extension-version.ts";

export function readExtensions(path: string) {
  const extensions: Extension[] = [];
  const extensionDirs = Deno.readDirSync(path);
  for (const extensionDir of extensionDirs) {
    if (extensionDir.isDirectory) {
      const extFile = extensionFile(join(path, extensionDir.name));
      if (extFile) {
        const extensionId = toExtensionId(extensionDir.name);
        const extension = readExtension(extensionId, extFile);
        extensions.push(extension);
      }
    }
  }
  return extensions;
}

export function loadExtension(
  extension: string,
  input: string,
  project?: ProjectContext,
): Extension {
  const extensionId = toExtensionId(extension);
  const extensionPath = discoverExtensionPath(input, extensionId, project);

  if (extensionPath) {
    // Find the metadata file, if any
    const file = extensionFile(extensionPath);
    if (file) {
      const extension = readExtension(extensionId, file);
      validateExtension(extension);

      // Resolve paths in the extension relative to the extension
      // metadata file
      const path = dirname(input);
      return toInputRelativePaths(
        projectType(project?.config?.project?.[kProjectType]),
        extensionPath,
        path,
        extension,
      ) as unknown as Extension;
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
}

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
    const paths = resolvePathGlobs(extDir, globs, [], true);

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

function readExtension(
  extensionId: ExtensionId,
  extensionFile: string,
): Extension {
  const yaml = readYaml(extensionFile) as Metadata;
  const contributes = yaml[kContributes] as Metadata | undefined;

  const title = yaml[kTitle] as string;
  const author = yaml[kAuthor] as string;
  const version = parseVersion(yaml[kVersion] as string | undefined);

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

  // Create the extension data structure
  return {
    title,
    author,
    version,
    id: extensionId,
    path: dirname(extensionFile),
    [kContributes]: {
      shortcodes,
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
