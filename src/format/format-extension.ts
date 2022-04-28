/*
* format-extension.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { existsSync } from "fs/mod.ts";
import { warning } from "log/mod.ts";
import { ProjectContext } from "../project/types.ts";
import { isSubdir } from "fs/_util.ts";

import { dirname, join, normalize } from "path/mod.ts";
import { Metadata } from "../config/types.ts";
import { resolvePathGlobs } from "../core/path.ts";
import { readAndValidateYamlFromFile } from "../core/schema/validated-yaml.ts";
import { getFrontMatterSchema } from "../core/lib/yaml-schema/front-matter.ts";
import { normalizeFormatYaml } from "../project/project-context.ts";

export interface FormatExtensionName {
  name: string;
  organization?: string;
}

export interface ExtensionMetadata {
  path: string;
  metadata: Metadata;
}

const kExtensionDir = "_extensions";

export async function formatExtensionYaml(
  input: string,
  extension: string,
  project?: ProjectContext,
): Promise<ExtensionMetadata | undefined> {
  // Find the format extension directory for this extension
  const extDir = formatExtensionDirectory(input, extension, project);
  if (extDir) {
    // Find the metadata file, if any
    const file = metadataFile(extDir);
    if (file) {
      const frontMatterSchema = await getFrontMatterSchema();

      // There is a metadata file, read it and validate it
      const errMsg = "Directory metadata validation failed.";
      const yaml = ((await readAndValidateYamlFromFile(
        file,
        frontMatterSchema,
        errMsg,
      )) || {}) as Record<string, unknown>;

      // resolve format into expected structure
      if (yaml.format) {
        yaml.format = normalizeFormatYaml(yaml.format);
      }

      return {
        path: file,
        metadata: yaml,
      };
    } else {
      throw new Error(
        `Extension ${extension} does not provide any format information.`,
      );
    }
  } else {
    throw new Error(
      `Extension ${extension} was not found. Please ensure that you have installed this extension.`,
    );
  }
}

export function formatExtensionDirectory(
  input: string,
  extension: string,
  project?: ProjectContext,
) {
  // prase the format extension name to get the name and org
  const formatExtName = parseFormatExtensionName(extension);
  const extensionDirGlobs = [];
  if (formatExtName.organization) {
    // If there is an organization, always match that exactly
    extensionDirGlobs.push(
      `${formatExtName.name}@${formatExtName.organization}/`,
    );
  } else {
    // Otherwise, match either the exact string (e.g. acm or a wildcard org acm@*)
    extensionDirGlobs.push(`${formatExtName.name}/`);
    extensionDirGlobs.push(`${formatExtName.name}@*/`);
  }

  const findExtensionDir = (dir: string, globs: string[]) => {
    // The `_extensions` directory
    const extDir = join(dir, kExtensionDir);

    // Find the matching extension for this name
    const paths = resolvePathGlobs(extDir, globs, [], true);

    if (paths.include.length > 0) {
      if (paths.include.length > 1) {
        warning(
          `More than one extension is available for ${extension} in the directory ${extDir}.\nExtensions that match:\n${
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

function parseFormatExtensionName(extension: string) {
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

const metadataFile = (dir: string) => {
  return ["_metadata.yml", "_metadata.yaml"]
    .map((file) => join(dir, file))
    .find(existsSync);
};
