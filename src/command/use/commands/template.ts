/*
 * template.ts
 *
 * Copyright (C) 2021-2022 Posit Software, PBC
 */

import {
  ExtensionSource,
  extensionSource,
} from "../../../extension/extension-host.ts";
import { info } from "../../../deno_ral/log.ts";
import { Confirm, Input } from "cliffy/prompt/mod.ts";
import { basename, dirname, join, relative } from "../../../deno_ral/path.ts";
import { ensureDir, ensureDirSync, existsSync } from "fs/mod.ts";
import { TempContext } from "../../../core/temp-types.ts";
import { downloadWithProgress } from "../../../core/download.ts";
import { withSpinner } from "../../../core/console.ts";
import { unzip } from "../../../core/zip.ts";
import { templateFiles } from "../../../extension/template.ts";
import { Command } from "cliffy/command/mod.ts";
import { initYamlIntelligenceResourcesFromFilesystem } from "../../../core/schema/utils.ts";
import { createTempContext } from "../../../core/temp.ts";
import {
  completeInstallation,
  confirmInstallation,
  copyExtensions,
} from "../../../extension/install.ts";
import { kExtensionDir } from "../../../extension/constants.ts";
import { InternalError } from "../../../core/lib/error.ts";
import { readExtensions } from "../../../extension/extension.ts";

const kRootTemplateName = "template.qmd";

export const useTemplateCommand = new Command()
  .name("template")
  .arguments("<target:string>")
  .description(
    "Use a Quarto template for this directory or project.",
  )
  .option(
    "--no-prompt",
    "Do not prompt to confirm actions",
  )
  .example(
    "Use a template from Github",
    "quarto use template <gh-org>/<gh-repo>",
  )
  .action(async (options: { prompt?: boolean }, target: string) => {
    await initYamlIntelligenceResourcesFromFilesystem();
    const temp = createTempContext();
    try {
      await useTemplate(options, target, temp);
    } finally {
      temp.cleanup();
    }
  });

async function useTemplate(
  options: { prompt?: boolean },
  target: string,
  tempContext: TempContext,
) {
  // Resolve extension host and trust
  const source = await extensionSource(target);
  // Is this source valid?
  if (!source) {
    info(
      `Extension not found in local or remote sources`,
    );
    return;
  }
  const trusted = await isTrusted(source, options.prompt !== false);
  if (trusted) {
    // Resolve target directory
    const outputDirectory = await determineDirectory(options.prompt !== false);

    // Extract and move the template into place
    const stagedDir = await stageTemplate(source, tempContext);

    // Filter the list to template files
    const filesToCopy = templateFiles(stagedDir);

    // Compute extensions that need to be installed (and confirm any)
    // changes
    const extDir = join(stagedDir, kExtensionDir);

    // Determine whether we can update extensions
    const templateExtensions = await readExtensions(extDir);
    const installedExtensions = [];
    let installExtensions = false;
    if (templateExtensions.length > 0) {
      installExtensions = await confirmInstallation(
        templateExtensions,
        outputDirectory,
        {
          allowPrompt: options.prompt !== false,
          throw: true,
          message: "The template requires the following changes to extensions:",
        },
      );
      if (!installExtensions) {
        return;
      }
    }

    // Confirm any overwrites
    info(
      `\nPreparing template files...`,
    );

    const copyActions: Array<{ file: string; copy: () => Promise<void> }> = [];
    for (const fileToCopy of filesToCopy) {
      const isDir = Deno.statSync(fileToCopy).isDirectory;
      const rel = relative(stagedDir, fileToCopy);
      if (!isDir) {
        // Compute the paths
        let target = join(outputDirectory, rel);
        let displayName = rel;
        const targetDir = dirname(target);
        if (rel === kRootTemplateName) {
          displayName = `${basename(targetDir)}.qmd`;
          target = join(targetDir, displayName);
        }
        const copyAction = {
          file: displayName,
          copy: async () => {
            // Ensure the directory exists
            await ensureDir(targetDir);

            // Copy the file into place
            await Deno.copyFile(fileToCopy, target);
          },
        };

        if (existsSync(target)) {
          if (options.prompt) {
            const proceed = await Confirm.prompt({
              message: `Overwrite file ${displayName}?`,
            });
            if (proceed) {
              copyActions.push(copyAction);
            }
          } else {
            throw new Error(
              `The file ${displayName} already exists and would be overwritten by this action.`,
            );
          }
        } else {
          copyActions.push(copyAction);
        }
      }
    }

    if (installExtensions) {
      installedExtensions.push(...templateExtensions);
      await withSpinner({ message: "Installing extensions..." }, async () => {
        // Copy the extensions into a substaging directory
        // this will ensure that they are namespaced properly
        const subStagedDir = tempContext.createDir();
        await copyExtensions(source, stagedDir, subStagedDir);

        // Now complete installation from this sub-staged directory
        await completeInstallation(subStagedDir, outputDirectory);
      });
    }

    // Copy the files
    if (copyActions.length > 0) {
      await withSpinner({ message: "Copying files..." }, async () => {
        for (const copyAction of copyActions) {
          await copyAction.copy();
        }
      });
    }

    if (installedExtensions.length > 0) {
      info(
        `\nExtensions installed:`,
      );
      for (const extension of installedExtensions) {
        info(` - ${extension.title}`);
      }
    }

    if (copyActions.length > 0) {
      info(
        `\nFiles created:`,
      );
      for (const copyAction of copyActions) {
        info(` - ${copyAction.file}`);
      }
    }
  } else {
    return Promise.resolve();
  }
}

async function stageTemplate(
  source: ExtensionSource,
  tempContext: TempContext,
) {
  if (source.type === "remote") {
    // A temporary working directory
    const workingDir = tempContext.createDir();

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

    // Unzip and remove zip
    await unzipInPlace(toFile);

    // Try to find the correct sub directory
    if (source.targetSubdir) {
      const sourceSubDir = join(archiveDir, source.targetSubdir);
      if (existsSync(sourceSubDir)) {
        return sourceSubDir;
      }
    }

    // Couldn't find a source sub dir, see if there is only a single
    // subfolder and if so use that
    const dirEntries = Deno.readDirSync(archiveDir);
    let count = 0;
    let name;
    let hasFiles = false;
    for (const dirEntry of dirEntries) {
      // ignore any files
      if (dirEntry.isDirectory) {
        name = dirEntry.name;
        count++;
      } else {
        hasFiles = true;
      }
    }
    // there is a lone subfolder - use that.
    if (!hasFiles && count === 1 && name) {
      return join(archiveDir, name);
    }

    return archiveDir;
  } else {
    if (typeof source.resolvedTarget !== "string") {
      throw new InternalError(
        "Local resolved extension should always have a string target.",
      );
    }

    if (Deno.statSync(source.resolvedTarget).isDirectory) {
      // copy the contents of the directory, filtered by quartoignore
      return source.resolvedTarget;
    } else {
      // A temporary working directory
      const workingDir = tempContext.createDir();
      const targetFile = join(workingDir, basename(source.resolvedTarget));

      // Copy the zip to the working dir
      Deno.copyFileSync(
        source.resolvedTarget,
        targetFile,
      );

      await unzipInPlace(targetFile);
      return workingDir;
    }
  }
}

// Determines whether the user trusts the template
async function isTrusted(
  source: ExtensionSource,
  allowPrompt: boolean,
): Promise<boolean> {
  if (allowPrompt && source.type === "remote") {
    // Write the preamble
    const preamble =
      `\nQuarto templates may execute code when documents are rendered. If you do not \ntrust the authors of the template, we recommend that you do not install or \nuse the template.`;
    info(preamble);

    // Ask for trust
    const question = "Do you trust the authors of this template";
    const confirmed: boolean = await Confirm.prompt({
      message: question,
      default: true,
    });
    return confirmed;
  } else {
    return true;
  }
}

async function determineDirectory(allowPrompt: boolean) {
  const currentDir = Deno.cwd();
  if (!allowPrompt) {
    // If we can't prompt, we'll use either the current directory (if empty), or throw
    if (!directoryEmpty(currentDir)) {
      throw new Error(
        `Unable to install in ${currentDir} as the directory isn't empty.`,
      );
    } else {
      return currentDir;
    }
  } else {
    return promptForDirectory(currentDir, directoryEmpty(currentDir));
  }
}

async function promptForDirectory(root: string, isEmpty: boolean) {
  // Try to short directory creation
  const useSubDir = await Confirm.prompt({
    message: "Create a subdirectory for template?",
    default: !isEmpty,
    hint:
      "Use a subdirectory for the template rather than the current directory.",
  });
  if (!useSubDir) {
    return root;
  }

  const dirName = await Input.prompt({
    message: "Directory name:",
    validate: (input) => {
      if (input.length === 0 || input === ".") {
        return true;
      }

      const dir = join(root, input);
      if (!existsSync(dir)) {
        ensureDirSync(dir);
      }
      return true;
    },
  });
  if (dirName.length === 0 || dirName === ".") {
    return root;
  } else {
    return join(root, dirName);
  }
}

// Unpack and stage a zipped file
async function unzipInPlace(zipFile: string) {
  // Unzip the file
  await withSpinner(
    { message: "Unzipping" },
    async () => {
      // Unzip the archive
      const result = await unzip(zipFile);
      if (!result.success) {
        throw new Error("Failed to unzip template.\n" + result.stderr);
      }

      // Remove the tar ball itself
      await Deno.remove(zipFile);

      return Promise.resolve();
    },
  );
}

function directoryEmpty(path: string) {
  const dirContents = Deno.readDirSync(path);
  for (const _content of dirContents) {
    return false;
  }
  return true;
}
