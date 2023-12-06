/*
 * install.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { ensureDirSync, existsSync } from "fs/mod.ts";
import { Confirm } from "cliffy/prompt/mod.ts";
import { Table } from "cliffy/table/mod.ts";
import { basename, dirname, join, relative } from "path/mod.ts";

import { projectContext } from "../project/project-context.ts";
import { TempContext } from "../core/temp-types.ts";
import { unzip } from "../core/zip.ts";
import { copyTo } from "../core/copy.ts";
import { Extension } from "./types.ts";
import { kExtensionDir } from "./constants.ts";
import { withSpinner } from "../core/console.ts";
import { downloadWithProgress } from "../core/download.ts";
import { createExtensionContext, readExtensions } from "./extension.ts";
import { info } from "log/mod.ts";
import { ExtensionSource, extensionSource } from "./extension-host.ts";
import { safeExistsSync } from "../core/path.ts";
import { InternalError } from "../core/lib/error.ts";
import { notebookContext } from "../render/notebook/notebook-context.ts";
import { openUrl } from "../core/shell.ts";

const kUnversionedFrom = "  (?)";
const kUnversionedTo = "(?)  ";

// Core Installation
export async function installExtension(
  target: string,
  temp: TempContext,
  allowPrompt: boolean,
  embed?: string,
) {
  // Is this local or remote?
  const source = await extensionSource(target);

  // Is this source valid?
  if (!source) {
    info(
      `Extension not found in local or remote sources`,
    );
    return;
  }

  // Does the user trust the extension?
  const trusted = await isTrusted(source, allowPrompt);
  if (!trusted) {
    // Not trusted, cancel
    cancelInstallation();
  } else {
    // Compute the installation directory
    const currentDir = Deno.cwd();
    const installDir = await determineInstallDir(
      currentDir,
      allowPrompt,
      embed,
    );

    // Stage the extension locally
    const extensionDir = await stageExtension(source, temp.createDir());

    // Validate the extension in in the staging dir
    const stagedExtensions = await validateExtension(extensionDir);

    // Confirm that the user would like to take this action
    const confirmed = await confirmInstallation(
      stagedExtensions,
      installDir,
      allowPrompt,
    );

    if (confirmed) {
      // Complete the installation
      await completeInstallation(extensionDir, installDir);

      await withSpinner(
        { message: "Extension installation complete" },
        () => {
          return Promise.resolve();
        },
      );

      if (source.learnMoreUrl) {
        info("");
        if (allowPrompt) {
          const open = await Confirm.prompt({
            message: "View documentation using default browser?",
            default: true,
          });
          if (open) {
            await openUrl(source.learnMoreUrl);
          }
        } else {
          info(
            `\nLearn more about this extension at:\n${source.learnMoreUrl}\n`,
          );
        }
      }
    } else {
      // Not confirmed, cancel the installation
      cancelInstallation();
    }
  }
}

// Cancels the installation, providing user feedback that the installation is canceled
function cancelInstallation() {
  info("Installation canceled\n");
}

// Determines whether the user trusts the extension
async function isTrusted(
  source: ExtensionSource,
  allowPrompt: boolean,
): Promise<boolean> {
  if (allowPrompt && source.type === "remote") {
    // Write the preamble
    const preamble =
      `\nQuarto extensions may execute code when documents are rendered. If you do not \ntrust the authors of the extension, we recommend that you do not install or \nuse the extension.`;
    info(preamble);

    // Ask for trust
    const question = "Do you trust the authors of this extension";
    const confirmed: boolean = await Confirm.prompt({
      message: question,
      default: true,
    });
    return confirmed;
  } else {
    return true;
  }
}

// If the installation is happening in a project
// we should offer to install the extension into the project
async function determineInstallDir(
  dir: string,
  allowPrompt: boolean,
  embed?: string,
) {
  if (embed) {
    // We're embeddeding this within an extension
    const extensionName = embed;
    const context = createExtensionContext();

    // Load the extension to be sure it exists and then
    // use its path as the target for installation
    const extension = await context.extension(extensionName, dir);
    if (extension) {
      if (Object.keys(extension?.contributes.formats || {}).length > 0) {
        return extension?.path;
      } else {
        throw new Error(
          `The extension ${embed} does not contribute a format.\nYou can only embed extensions within an extension which itself contributes a format.`,
        );
      }
    } else {
      throw new Error(
        `Unable to locate the extension '${embed}' that you'd like to embed this within.`,
      );
    }
  } else {
    // We're not embeddeding, check if we're in a project
    // and offer to use that directory if we are
    const nbContext = notebookContext();
    const project = await projectContext(dir, nbContext);
    if (project && project.dir !== dir) {
      const question = "Install extension into project?";
      if (allowPrompt) {
        const useProject = await Confirm.prompt(question);
        if (useProject) {
          return project.dir;
        } else {
          return dir;
        }
      } else {
        return dir;
      }
    } else {
      return dir;
    }
  }
}

// This downloads or copies the extension files into a temporary working
// directory that we can use to enumerate, compare, etc... when deciding
// whether to proceed with installation
//
// Currently supports
// - Remote Paths
// - Local files (tarballs / zips)
// - Local folders (either the path to the _extensions directory or its parent)
async function stageExtension(
  source: ExtensionSource,
  workingDir: string,
) {
  if (source.type === "remote") {
    // Stages a remote file by downloading and unzipping it
    const archiveDir = join(workingDir, "archive");
    ensureDirSync(archiveDir);

    // The filename
    const filename = (typeof (source.resolvedTarget) === "string"
      ? source.resolvedTarget
      : source.resolvedFile) || "extension.zip";

    // The tarball path
    const toFile = join(archiveDir, filename);

    // Download the file
    await downloadWithProgress(source.resolvedTarget, `Downloading`, toFile);

    return unzipAndStage(toFile, source);
  } else {
    if (typeof source.resolvedTarget !== "string") {
      throw new InternalError(
        "local resolved extension should always have a string target.",
      );
    }
    if (Deno.statSync(source.resolvedTarget).isDirectory) {
      // Copy the extension dir only
      const srcDir = extensionDir(source.resolvedTarget);
      if (srcDir) {
        const destDir = join(workingDir, kExtensionDir);
        // If there is something to stage, go for it, otherwise
        // just leave the directory empty
        await readAndCopyExtensions(srcDir, destDir);
      }
      return workingDir;
    } else {
      const filename = basename(source.resolvedTarget);

      // A local copy of a zip file
      const toFile = join(workingDir, filename);
      copyTo(source.resolvedTarget, toFile);
      return unzipAndStage(toFile, source);
    }
  }
}

// Unpack and stage a zipped file
async function unzipAndStage(
  zipFile: string,
  source: ExtensionSource,
) {
  // Unzip the file
  await withSpinner(
    { message: "Unzipping" },
    async () => {
      // Unzip the archive
      const result = await unzip(zipFile);
      if (!result.success) {
        throw new Error("Failed to unzip extension.\n" + result.stderr);
      }

      // Remove the tar ball itself
      await Deno.remove(zipFile);

      return Promise.resolve();
    },
  );

  // Use any subdirectory inside, if appropriate
  const archiveDir = dirname(zipFile);

  const findExtensionDir = () => {
    if (source.targetSubdir) {
      // If the source provides a subdirectory, just use that
      return join(archiveDir, source.targetSubdir);
    } else {
      // Otherwise, we should inspect the directory either:
      // - use the directory itself it has an _extensions dir
      // - use a subdirectory if there is a single subdirectory and it has an
      // _extensions dir
      if (safeExistsSync(join(archiveDir, kExtensionDir))) {
        return archiveDir;
      } else {
        const dirEntries = Deno.readDirSync(archiveDir);
        let count = 0;
        let name;
        for (const dirEntry of dirEntries) {
          // ignore any files
          if (dirEntry.isDirectory) {
            name = dirEntry.name;
            count++;
          }
        }

        if (count === 1 && name && name !== kExtensionDir) {
          if (safeExistsSync(join(archiveDir, name, kExtensionDir))) {
            return join(archiveDir, name);
          } else {
            return archiveDir;
          }
        } else {
          return archiveDir;
        }
      }
    }
  };
  // Use a subdirectory if the source provides one
  const extensionsDir = join(findExtensionDir(), kExtensionDir);

  // Make the final directory we're staging into
  const finalDir = join(archiveDir, "staged");
  await copyExtensions(source, extensionsDir, finalDir);

  return finalDir;
}

export async function copyExtensions(
  source: ExtensionSource,
  srcDir: string,
  targetDir: string,
) {
  const finalExtensionsDir = join(targetDir, kExtensionDir);
  const finalExtensionTargetDir = source.owner
    ? join(finalExtensionsDir, source.owner)
    : finalExtensionsDir;
  ensureDirSync(finalExtensionTargetDir);

  // Move extensions into the target directory (root or owner)
  await readAndCopyExtensions(srcDir, finalExtensionTargetDir);
}

// Reads the extensions from an extensions directory and copies
// them to a destination directory
async function readAndCopyExtensions(
  extensionsDir: string,
  targetDir: string,
) {
  const extensions = await readExtensions(extensionsDir);
  info(
    `    Found ${extensions.length} ${
      extensions.length === 1 ? "extension" : "extensions"
    }.`,
  );

  for (const extension of extensions) {
    copyTo(
      extension.path,
      join(targetDir, extension.id.name),
    );
  }
}

// Validates that a path on disk is a valid path to extensions
// Currently just ensures there is an _extensions directory
// and that the directory contains readable extensions
async function validateExtension(path: string) {
  const extensionsFolder = extensionDir(path);
  if (!extensionsFolder) {
    throw new Error(
      `Invalid extension\nThe extension staged at ${path} is missing an '_extensions' folder.`,
    );
  }

  const extensions = await readExtensions(extensionsFolder);
  if (extensions.length === 0) {
    throw new Error(
      `Invalid extension\nThe extension staged at ${path} does not provide any valid extensions.`,
    );
  }
  return extensions;
}

// Confirm that the user would like to proceed with the installation
async function confirmInstallation(
  extensions: Extension[],
  installDir: string,
  allowPrompt: boolean,
) {
  const readExisting = async () => {
    try {
      const existingExtensionsDir = join(installDir, kExtensionDir);
      if (Deno.statSync(existingExtensionsDir).isDirectory) {
        const existingExtensions = await readExtensions(
          join(installDir, kExtensionDir),
        );
        return existingExtensions;
      } else {
        return [];
      }
    } catch {
      return [];
    }
  };

  const name = (extension: Extension) => {
    const idStr = extension.id.organization
      ? `${extension.id.organization}/${extension.id.name}`
      : extension.id.name;
    return extension.title || idStr;
  };

  const existingExtensions = await readExisting();
  const existing = (extension: Extension) => {
    return existingExtensions.find((existing) => {
      return existing.id.name === extension.id.name &&
        existing.id.organization === extension.id.organization;
    });
  };

  const typeStr = (to: Extension) => {
    const contributes = to.contributes;
    const extTypes: string[] = [];
    if (
      contributes.formats &&
      Object.keys(contributes.formats).length > 0
    ) {
      Object.keys(contributes.formats).length === 1
        ? extTypes.push("format")
        : extTypes.push("formats");
    }

    if (
      contributes.shortcodes &&
      contributes.shortcodes.length > 0
    ) {
      contributes.shortcodes.length === 1
        ? extTypes.push("shortcode")
        : extTypes.push("shortcodes");
    }

    if (contributes.filters && contributes.filters.length > 0) {
      contributes.filters.length === 1
        ? extTypes.push("filter")
        : extTypes.push("filters");
    }

    if (extTypes.length > 0) {
      return `(${extTypes.join(",")})`;
    } else {
      return "";
    }
  };

  const versionMessage = (to: Extension, from?: Extension) => {
    if (to && !from) {
      const versionStr = to.version?.format();
      // New Install
      return {
        action: "Install",
        from: "",
        to: versionStr,
      };
    } else {
      if (to.version && from?.version) {
        // From version to version
        const comparison = to.version.compare(from.version);
        if (comparison === 0) {
          return {
            action: "No Change",
            from: "",
            to: "",
          };
        } else if (comparison > 0) {
          return {
            action: "Update",
            from: from.version.format(),
            to: to.version.format(),
          };
        } else {
          return {
            action: "Revert",
            from: from.version.format(),
            to: to.version.format(),
          };
        }
      } else if (to.version && !from?.version) {
        // From unversioned to versioned
        return {
          action: "Update",
          from: kUnversionedFrom,
          to: to.version.format(),
        };
      } else if (!to.version && from?.version) {
        // From versioned to unversioned
        return {
          action: "Update",
          from: from.version.format(),
          to: kUnversionedTo,
        };
      } else {
        // Both unversioned
        return {
          action: "Update",
          from: kUnversionedFrom,
          to: kUnversionedTo,
        };
      }
    }
  };

  const extensionRows: string[][] = [];
  for (const stagedExtension of extensions) {
    const installedExtension = existing(stagedExtension);
    const message = versionMessage(
      stagedExtension,
      installedExtension,
    );

    const types = typeStr(stagedExtension);
    if (message) {
      extensionRows.push([
        name(stagedExtension) + "  ",
        `[${message.action}]`,
        message.from || "",
        message.to && message.from ? "->" : "",
        message.to || "",
        types,
      ]);
    }
  }

  if (extensionRows.length > 0) {
    const table = new Table(...extensionRows);
    info(
      `\nThe following changes will be made:\n${table.toString()}`,
    );
    const question = "Would you like to continue";
    return !allowPrompt ||
      await Confirm.prompt({ message: question, default: true });
  } else {
    info(`\nNo changes required - extensions already installed.`);
    return true;
  }
}

// Copy the extension files into place
async function completeInstallation(
  downloadDir: string,
  installDir: string,
) {
  info("");

  await withSpinner({
    message: `Copying`,
  }, async () => {
    // Determine a staging location in the installDir
    // (to ensure we can use move without fear of spanning volumes)
    const stagingDir = join(installDir, "._extensions.staging");
    try {
      // For each 'extension' in the install dir, perform a move
      const downloadedExtDir = join(downloadDir, kExtensionDir);

      // We'll stage the extension in a directory within the install dir
      // then move it to the install dir when ready
      const stagingExtDir = join(stagingDir, kExtensionDir);
      ensureDirSync(stagingExtDir);

      // The final installation target
      const installExtDir = join(installDir, kExtensionDir);
      ensureDirSync(installExtDir);

      // Read the extensions that have been downloaded and install them
      // one by bone
      const extensions = await readExtensions(downloadedExtDir);
      extensions.forEach((extension) => {
        const extensionRelativeDir = relative(downloadedExtDir, extension.path);
        // Copy to the staging path
        const stagingPath = join(stagingExtDir, extensionRelativeDir);
        copyTo(extension.path, stagingPath);

        // Move from the staging path to the install dir
        const installPath = join(installExtDir, extensionRelativeDir);
        if (existsSync(installPath)) {
          Deno.removeSync(installPath, { recursive: true });
        }

        // Ensure the parent directory exists
        ensureDirSync(dirname(installPath));
        Deno.renameSync(stagingPath, installPath);
      });
    } finally {
      // Clean up the staging directory
      Deno.removeSync(stagingDir, { recursive: true });
    }
    return Promise.resolve();
  });
}

// Is this _extensions or does this contain _extensions?
const extensionDir = (path: string) => {
  if (basename(path) === kExtensionDir) {
    // If this is pointing to an _extensions dir, use that
    return path;
  } else {
    // Otherwise, add _extensions to this and use that
    const extDir = join(path, kExtensionDir);
    if (existsSync(extDir) && Deno.statSync(extDir).isDirectory) {
      return extDir;
    } else {
      return path;
    }
  }
};
