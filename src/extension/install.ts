/*
* extension.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { existsSync } from "fs/mod.ts";
import { Confirm } from "cliffy/prompt/mod.ts";
import { Table } from "cliffy/table/mod.ts";
import { writeAllSync } from "streams/mod.ts";
import { dirname, join } from "path/mod.ts";

import { projectContext } from "../project/project-context.ts";
import { TempContext } from "../core/temp-types.ts";
import { unzip } from "../core/zip.ts";
import { copyMinimal, copyTo } from "../core/copy.ts";
import { Extension, kExtensionDir } from "./extension-shared.ts";
import { withSpinner } from "../core/console.ts";
import { downloadWithProgress } from "../core/download.ts";
import { readExtensions } from "./extension.ts";
import { compareVersions, prettyVersion } from "./extension-version.ts";

// dragonstyle/test-ext           test-ext-main
// dragonstyle/test-ext@latest    test-ext-main
// dragonstyle/test-ext@v0.1      test-ext-0.1

export interface ExtensionSource {
  type: "remote" | "local";
}
const kUnversioned = "  (?)  ";

// Core Installation
export async function installExtension(target: string, temp: TempContext) {
  // Is this local or remote?
  const source = extensionSource(target);

  // Does the user trust the extension?
  const trusted = await isTrusted(source);
  if (!trusted) {
    // Not trusted, cancel
    cancelInstallation();
  } else {
    // Compute the installation directory
    const currentDir = Deno.cwd();
    const installDir = await determineInstallDir(currentDir);

    // Stage the extension locally
    const extensionDir = await stageExtension(target, source, temp.createDir());

    // Validate the extension in in the staging dir
    const stagedExtensions = validateExtension(extensionDir);

    // Confirm that the user would like to take this action
    const confirmed = await confirmInstallation(stagedExtensions, installDir);

    if (confirmed) {
      // Complete the installation
      await completeInstallation(extensionDir, installDir);
    } else {
      // Not confirmed, cancel the installation
      cancelInstallation();
    }
  }
}

// Cancels the installation, providing user feedback that the installation is canceled
function cancelInstallation() {
  writeAllSync(
    Deno.stdout,
    new TextEncoder().encode("Installation canceled\n"),
  );
}

// Determines whether the user trusts the extension
async function isTrusted(
  source: ExtensionSource,
): Promise<boolean> {
  if (source.type === "remote") {
    // Write the preamble
    const preamble =
      `\nQuarto extensions may execute code when documents are rendered. If you do not \ntrust the authors of the extension, we recommend that you do not install or \nuse the extension.\n\n`;
    writeAllSync(Deno.stdout, new TextEncoder().encode(preamble));

    // Ask for trust
    const question = "Do you trust the authors of this extension";
    const confirmed: boolean = await Confirm.prompt(question);

    return confirmed;
  } else {
    return true;
  }
}

// If the installation is happening in a project
// we should offer to install the extension into the project
async function determineInstallDir(dir: string) {
  const project = await projectContext(dir);
  if (project) {
    const question = "Install extension into project?";
    const useProject = await Confirm.prompt(question);
    if (useProject) {
      return project.dir;
    } else {
      return dir;
    }
  } else {
    return dir;
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
  target: string,
  source: ExtensionSource,
  workingDir: string,
) {
  if (source.type === "remote") {
    // Stages a remote file by downloading and unzipping it
    const toFile = join(workingDir, "extension.tar.gz");

    // Download the file
    await downloadWithProgress(target, `Downloading`, toFile);

    // Unzip the file
    await withSpinner(
      { message: "Unzipping" },
      async () => {
        // Unzip the archive
        await unzip(toFile);

        // Remove the tar ball itself
        await Deno.remove(toFile);

        return Promise.resolve();
      },
    );

    // Use any subdirectory inside, if appropriate
    const subdir = extensionSubdirectory(target);
    if (subdir) {
      return join(workingDir, subdir);
    } else {
      return workingDir;
    }
  } else {
    if (Deno.statSync(target).isDirectory) {
      // Copy the extension dir only
      const srcDir = extensionDir(target);
      if (srcDir) {
        // If there is something to stage, go for it, otherwise
        // just leave the directory empty
        const destDir = join(workingDir, kExtensionDir);
        copyMinimal(srcDir, destDir);
      }
    } else {
      copyTo(target, workingDir);
      unzip(target);
      Deno.removeSync(target);
    }
    return workingDir;
  }
}

// Validates that a path on disk is a valid path to extensions
// Currently just ensures there is an _extensions directory
// and that the directory contains readable extensions
function validateExtension(path: string) {
  const extensionsFolder = extensionDir(path);
  if (!extensionsFolder) {
    throw new Error(
      `Invalid extension\nThe extension staged at ${path} is missing an '_extensions' folder.`,
    );
  }

  const extensions = readExtensions(extensionsFolder);
  if (extensions.length === 0) {
    throw new Error(
      `Invalidate extension\nThe extension staged at ${path} does not provide any valid extensions.`,
    );
  }
  return extensions;
}

// Confirm that the user would like to proceed with the installation
async function confirmInstallation(
  extensions: Extension[],
  installDir: string,
) {
  const readExisting = () => {
    try {
      const existingExtensionsDir = join(installDir, kExtensionDir);
      if (Deno.statSync(existingExtensionsDir).isDirectory) {
        const existingExtensions = readExtensions(
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

  const existingExtensions = readExisting();
  const existing = (extension: Extension) => {
    return existingExtensions.find((existing) => {
      return existing.id.name === extension.id.name &&
        existing.id.organization === extension.id.organization;
    });
  };

  const versionMessage = (to: Extension, from?: Extension) => {
    if (to && !from) {
      const versionStr = prettyVersion(to.version);
      // New Install
      return {
        action: "Install",
        from: "",
        to: versionStr,
      };
    } else {
      if (to.version && from?.version) {
        // From version to version
        const comparison = compareVersions(to.version, from?.version);
        if (comparison === 0) {
          return {
            action: "No Change",
            from: "",
            to: "",
          };
        } else if (comparison > 0) {
          return {
            action: "Update ",
            from: prettyVersion(from.version),
            to: prettyVersion(to.version),
          };
        } else {
          return {
            action: "Revert ",
            from: prettyVersion(from.version),
            to: prettyVersion(to.version),
          };
        }
      } else if (to.version && !from?.version) {
        // From unversioned to versioned
        return {
          action: "Update ",
          from: kUnversioned,
          to: prettyVersion(to.version),
        };
      } else if (!to.version && from?.version) {
        // From versioned to unversioned
        return {
          action: "Update ",
          from: prettyVersion(from.version),
          to: kUnversioned,
        };
      } else {
        // Both unversioned
        return {
          action: "Update ",
          from: kUnversioned,
          to: kUnversioned,
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
    if (message) {
      extensionRows.push([
        name(stagedExtension) + "  ",
        `[${message.action}]`,
        message.from || "",
        message.to && message.from ? "->" : "",
        message.to || "",
      ]);
    }
  }

  if (extensionRows.length > 0) {
    const table = new Table(...extensionRows);
    writeAllSync(
      Deno.stdout,
      new TextEncoder().encode(
        `\nThe following changes will be made:\n${table.toString()}\n\n`,
      ),
    );

    const question = "Would you like to continue";
    return await Confirm.prompt(question);
  } else {
    writeAllSync(
      Deno.stdout,
      new TextEncoder().encode(
        `\nNo changes required - extensions already installed.\n\n`,
      ),
    );
    return true;
  }
}

// Copy the extension files into place
async function completeInstallation(downloadDir: string, installDir: string) {
  await withSpinner({
    message: `Copying`,
    doneMessage: `Complete`,
  }, () => {
    copyTo(downloadDir, installDir, { overwrite: true });
    return Promise.resolve();
  });
}

// Is this _extensions or does this contain _extensions?
const extensionDir = (path: string) => {
  if (dirname(path) === kExtensionDir) {
    return path;
  } else {
    const extDir = join(path, kExtensionDir);
    if (existsSync(extDir) && Deno.statSync(extDir).isDirectory) {
      return extDir;
    } else {
      return undefined;
    }
  }
};

function extensionSubdirectory(url: string) {
  const tagMatch = url.match(githubTagRegexp);
  if (tagMatch) {
    return tagMatch[2] + "-" + tagMatch[3];
  } else {
    const latestMatch = url.match(githubLatestRegexp);
    if (latestMatch) {
      return latestMatch[2] + "-" + latestMatch[3];
    } else {
      return undefined;
    }
  }
}
const githubTagRegexp =
  /^http(?:s?):\/\/github.com\/(.*?)\/(.*?)\/archive\/refs\/tags\/(?:v?)(.*)(\.tar\.gz|\.zip)$/;
const githubLatestRegexp =
  /^http(?:s?):\/\/github.com\/(.*?)\/(.*?)\/archive\/refs\/heads\/(?:v?)(.*)(\.tar\.gz|\.zip)$/;

function extensionSource(target: string): ExtensionSource {
  if (existsSync(target)) {
    return { type: "local" };
  } else {
    return { type: "remote" };
  }
}
