/*
 * brand.ts
 *
 * Copyright (C) 2021-2025 Posit Software, PBC
 */

import {
  ExtensionSource,
  extensionSource,
} from "../../../extension/extension-host.ts";
import { info } from "../../../deno_ral/log.ts";
import { Confirm } from "cliffy/prompt/mod.ts";
import { basename, dirname, join, relative } from "../../../deno_ral/path.ts";
import { ensureDir, ensureDirSync, existsSync } from "../../../deno_ral/fs.ts";
import { TempContext } from "../../../core/temp-types.ts";
import { downloadWithProgress } from "../../../core/download.ts";
import { withSpinner } from "../../../core/console.ts";
import { unzip } from "../../../core/zip.ts";
import { Command } from "cliffy/command/mod.ts";
import { initYamlIntelligenceResourcesFromFilesystem } from "../../../core/schema/utils.ts";
import { createTempContext } from "../../../core/temp.ts";
import { InternalError } from "../../../core/lib/error.ts";
import { notebookContext } from "../../../render/notebook/notebook-context.ts";
import { projectContext } from "../../../project/project-context.ts";
import { afterConfirm } from "../../../tools/tools-console.ts";
import { readYaml } from "../../../core/yaml.ts";
import { Metadata } from "../../../config/types.ts";

const kRootTemplateName = "template.qmd";

// Brand extension detection result
interface BrandExtensionInfo {
  isBrandExtension: boolean;
  extensionDir?: string; // Directory containing the brand extension
  brandFileName?: string; // The original brand file name (e.g., "brand.yml")
}

// Check if a directory contains a brand extension
function checkForBrandExtension(dir: string): BrandExtensionInfo {
  const extensionFiles = ["_extension.yml", "_extension.yaml"];

  for (const file of extensionFiles) {
    const path = join(dir, file);
    if (existsSync(path)) {
      try {
        const yaml = readYaml(path) as Metadata;
        // Check for contributes.metadata.project.brand
        const contributes = yaml?.contributes as Metadata | undefined;
        const metadata = contributes?.metadata as Metadata | undefined;
        const project = metadata?.project as Metadata | undefined;
        const brandFile = project?.brand as string | undefined;

        if (brandFile && typeof brandFile === "string") {
          return {
            isBrandExtension: true,
            extensionDir: dir,
            brandFileName: brandFile,
          };
        }
      } catch {
        // If we can't read/parse the extension file, continue searching
      }
    }
  }

  return { isBrandExtension: false };
}

// Search for a brand extension in the staged directory
// Searches: root, _extensions/*, _extensions/*/*
function findBrandExtension(stagedDir: string): BrandExtensionInfo {
  // First check the root directory
  const rootCheck = checkForBrandExtension(stagedDir);
  if (rootCheck.isBrandExtension) {
    return rootCheck;
  }

  // Check _extensions directory
  const extensionsDir = join(stagedDir, "_extensions");
  if (!existsSync(extensionsDir)) {
    return { isBrandExtension: false };
  }

  try {
    // Check direct children: _extensions/extension-name/
    for (const entry of Deno.readDirSync(extensionsDir)) {
      if (!entry.isDirectory) continue;

      const extPath = join(extensionsDir, entry.name);
      const check = checkForBrandExtension(extPath);
      if (check.isBrandExtension) {
        return check;
      }

      // Check nested: _extensions/org/extension-name/
      for (const nested of Deno.readDirSync(extPath)) {
        if (!nested.isDirectory) continue;
        const nestedPath = join(extPath, nested.name);
        const nestedCheck = checkForBrandExtension(nestedPath);
        if (nestedCheck.isBrandExtension) {
          return nestedCheck;
        }
      }
    }
  } catch {
    // Directory read error, return not found
  }

  return { isBrandExtension: false };
}

// Extract a path string from various formats:
// - string: "path/to/file"
// - object with path: { path: "path/to/file", alt: "..." }
function extractPath(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value;
  }
  if (value && typeof value === "object" && "path" in value) {
    const pathValue = (value as Record<string, unknown>).path;
    if (typeof pathValue === "string") {
      return pathValue;
    }
  }
  return undefined;
}

// Check if a path is a local file (not a URL)
function isLocalPath(path: string): boolean {
  return !path.startsWith("http://") && !path.startsWith("https://");
}

// Extract all referenced file paths from a brand YAML file
function extractBrandFilePaths(brandYamlPath: string): string[] {
  const paths: string[] = [];

  try {
    const yaml = readYaml(brandYamlPath) as Metadata;
    if (!yaml) return paths;

    // Extract logo paths
    const logo = yaml.logo as Metadata | undefined;
    if (logo) {
      // Handle logo.images (named resources)
      // Format: logo.images.<name> can be string or { path, alt }
      const images = logo.images as Metadata | undefined;
      if (images && typeof images === "object") {
        for (const value of Object.values(images)) {
          const path = extractPath(value);
          if (path && isLocalPath(path)) {
            paths.push(path);
          }
        }
      }

      // Handle logo.small, logo.medium, logo.large
      // Format: string or { light: string, dark: string }
      for (const size of ["small", "medium", "large"]) {
        const sizeValue = logo[size];
        if (!sizeValue) continue;

        if (typeof sizeValue === "string") {
          if (isLocalPath(sizeValue)) {
            paths.push(sizeValue);
          }
        } else if (typeof sizeValue === "object") {
          // Handle { light: "...", dark: "..." }
          const lightDark = sizeValue as Record<string, unknown>;
          if (
            typeof lightDark.light === "string" && isLocalPath(lightDark.light)
          ) {
            paths.push(lightDark.light);
          }
          if (
            typeof lightDark.dark === "string" && isLocalPath(lightDark.dark)
          ) {
            paths.push(lightDark.dark);
          }
        }
      }
    }

    // Extract typography font file paths
    const typography = yaml.typography as Metadata | undefined;
    if (typography) {
      const fonts = typography.fonts as unknown[] | undefined;
      if (Array.isArray(fonts)) {
        for (const font of fonts) {
          if (!font || typeof font !== "object") continue;
          const fontObj = font as Record<string, unknown>;

          // Only process fonts with source: "file"
          if (fontObj.source !== "file") continue;

          const files = fontObj.files as unknown[] | undefined;
          if (Array.isArray(files)) {
            for (const file of files) {
              const path = extractPath(file);
              if (path && isLocalPath(path)) {
                paths.push(path);
              }
            }
          }
        }
      }
    }
  } catch {
    // If we can't read/parse the brand file, return empty list
  }

  return paths;
}

export const useBrandCommand = new Command()
  .name("brand")
  .arguments("<target:string>")
  .description(
    "Use a brand for this project.",
  )
  .option(
    "--force",
    "Skip all prompts and confirmations",
  )
  .option(
    "--dry-run",
    "Show what would happen without making changes",
  )
  .example(
    "Use a brand from Github",
    "quarto use brand <gh-org>/<gh-repo>",
  )
  .action(
    async (
      options: { force?: boolean; dryRun?: boolean },
      target: string,
    ) => {
      if (options.force && options.dryRun) {
        throw new Error("Cannot use --force and --dry-run together");
      }
      await initYamlIntelligenceResourcesFromFilesystem();
      const temp = createTempContext();
      try {
        await useBrand(options, target, temp);
      } finally {
        temp.cleanup();
      }
    },
  );

async function useBrand(
  options: { force?: boolean; dryRun?: boolean },
  target: string,
  tempContext: TempContext,
) {
  // Print header for dry-run
  if (options.dryRun) {
    info("\nDry run - no changes will be made.");
  }

  // Resolve brand host and trust
  const source = await extensionSource(target);
  // Is this source valid?
  if (!source) {
    info(
      `Brand not found in local or remote sources`,
    );
    return;
  }

  // Check trust (skip for dry-run or force)
  if (!options.dryRun && !options.force) {
    const trusted = await isTrusted(source);
    if (!trusted) {
      return;
    }
  }

  // Resolve brand directory
  const brandDir = await ensureBrandDirectory(
    options.force === true,
    options.dryRun === true,
  );

  // Extract and move the template into place
  const stagedDir = await stageBrand(source, tempContext);

  // Check if this is a brand extension
  const brandExtInfo = findBrandExtension(stagedDir);

  // Determine the actual source directory and file mapping
  const sourceDir = brandExtInfo.isBrandExtension
    ? brandExtInfo.extensionDir!
    : stagedDir;

  // Find the brand file
  const brandFileName = brandExtInfo.isBrandExtension
    ? brandExtInfo.brandFileName!
    : existsSync(join(sourceDir, "_brand.yml"))
    ? "_brand.yml"
    : existsSync(join(sourceDir, "_brand.yaml"))
    ? "_brand.yaml"
    : undefined;

  if (!brandFileName) {
    info("No brand file (_brand.yml or _brand.yaml) found in source");
    return;
  }

  const brandFilePath = join(sourceDir, brandFileName);

  // Extract referenced file paths from the brand YAML
  const referencedPaths = extractBrandFilePaths(brandFilePath);

  // Build list of files to copy: brand file + referenced files
  const filesToCopy: string[] = [brandFilePath];
  for (const refPath of referencedPaths) {
    const fullPath = join(sourceDir, refPath);
    if (existsSync(fullPath)) {
      filesToCopy.push(fullPath);
    }
  }

  // Confirm changes to brand directory (skip for dry-run or force)
  if (!options.dryRun && !options.force) {
    const filename = (typeof (source.resolvedTarget) === "string"
      ? source.resolvedTarget
      : source.resolvedFile) || "brand.zip";

    const allowUse = await Confirm.prompt({
      message: `Proceed with using brand ${filename}?`,
      default: true,
    });
    if (!allowUse) {
      return;
    }
  }

  if (!options.dryRun) {
    info(
      `\nPreparing brand files...`,
    );
  }

  // Build set of source file paths for comparison
  // For brand extensions, we need to account for the brand file rename
  const sourceFiles = new Set(
    filesToCopy
      .filter((f) => !Deno.statSync(f).isDirectory)
      .map((f) => {
        const rel = relative(sourceDir, f);
        // If this is a brand extension and this is the brand file, it will become _brand.yml
        if (
          brandExtInfo.isBrandExtension && rel === brandExtInfo.brandFileName
        ) {
          return "_brand.yml";
        }
        return rel;
      }),
  );

  // Find extra files in target that aren't in source
  const extraFiles = findExtraFiles(brandDir, sourceFiles);

  // Track files by action type
  const wouldOverwrite: string[] = [];
  const wouldCreate: string[] = [];
  const wouldRemove: string[] = [];
  const copyActions: Array<{
    file: string;
    action: "create" | "overwrite";
    copy: () => Promise<void>;
  }> = [];
  let removed: string[] = [];

  for (const fileToCopy of filesToCopy) {
    const isDir = Deno.statSync(fileToCopy).isDirectory;
    const rel = relative(sourceDir, fileToCopy);
    if (isDir) {
      continue;
    }

    // For brand extensions, rename the brand file to _brand.yml
    let targetRel = rel;
    if (brandExtInfo.isBrandExtension && rel === brandExtInfo.brandFileName) {
      targetRel = "_brand.yml";
    }

    // Compute the paths
    const targetPath = join(brandDir, targetRel);
    const displayName = targetRel;
    const targetDir = dirname(targetPath);
    const copyAction = {
      file: displayName,
      copy: async () => {
        // Ensure the directory exists
        await ensureDir(targetDir);

        // Copy the file into place
        await Deno.copyFile(fileToCopy, targetPath);
      },
    };

    if (existsSync(targetPath)) {
      // File exists - will be overwritten
      if (options.dryRun) {
        wouldOverwrite.push(displayName);
      } else if (!options.force) {
        // Prompt for overwrite
        const proceed = await Confirm.prompt({
          message: `Overwrite file ${displayName}?`,
          default: true,
        });
        if (proceed) {
          copyActions.push({ ...copyAction, action: "overwrite" });
        } else {
          throw new Error(
            `The file ${displayName} already exists and would be overwritten by this action.`,
          );
        }
      } else {
        // Force mode - overwrite without prompting
        copyActions.push({ ...copyAction, action: "overwrite" });
      }
    } else {
      // File doesn't exist - will be created
      if (options.dryRun) {
        wouldCreate.push(displayName);
      } else {
        copyActions.push({ ...copyAction, action: "create" });
      }
    }
  }

  // Output dry-run summary and return
  if (options.dryRun) {
    if (wouldOverwrite.length > 0) {
      info(`\nWould overwrite:`);
      for (const file of wouldOverwrite) {
        info(` - ${file}`);
      }
    }
    if (wouldCreate.length > 0) {
      info(`\nWould create:`);
      for (const file of wouldCreate) {
        info(` - ${file}`);
      }
    }
    if (extraFiles.length > 0) {
      info(`\nWould remove:`);
      for (const file of extraFiles) {
        info(` - ${file}`);
      }
    }
    return;
  }

  // Copy the files
  if (copyActions.length > 0) {
    await withSpinner({ message: "Copying files..." }, async () => {
      for (const copyAction of copyActions) {
        await copyAction.copy();
      }
    });
  }

  // Handle extra files in target (not in source)
  if (extraFiles.length > 0) {
    const removeExtras = async () => {
      for (const file of extraFiles) {
        await Deno.remove(join(brandDir, file));
      }
      // Clean up empty directories
      cleanupEmptyDirs(brandDir);
      removed = extraFiles;
    };

    if (options.force) {
      await removeExtras();
    } else {
      // Show the files that would be removed
      info(`\nExtra files not in source brand:`);
      for (const file of extraFiles) {
        info(` - ${file}`);
      }
      // Use afterConfirm pattern - declining doesn't cancel command
      await afterConfirm(
        `Remove these ${extraFiles.length} file(s)?`,
        removeExtras,
      );
    }
  }

  // Output summary of changes
  const overwritten = copyActions.filter((a) => a.action === "overwrite");
  const created = copyActions.filter((a) => a.action === "create");
  if (overwritten.length > 0) {
    info(`\nOverwritten:`);
    for (const a of overwritten) {
      info(` - ${a.file}`);
    }
  }
  if (created.length > 0) {
    info(`\nCreated:`);
    for (const a of created) {
      info(` - ${a.file}`);
    }
  }
  if (removed.length > 0) {
    info(`\nRemoved:`);
    for (const file of removed) {
      info(` - ${file}`);
    }
  }
}

async function stageBrand(
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
      : source.resolvedFile) || "brand.zip";

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

// Determines whether the user trusts the brand
async function isTrusted(
  source: ExtensionSource,
): Promise<boolean> {
  if (source.type === "remote") {
    // Write the preamble
    const preamble =
      `\nIf you do not trust the authors of the brand, we recommend that you do not install or use the brand.`;
    info(preamble);

    // Ask for trust
    const question = "Do you trust the authors of this brand";
    const confirmed: boolean = await Confirm.prompt({
      message: question,
      default: true,
    });
    return confirmed;
  } else {
    return true;
  }
}

async function ensureBrandDirectory(force: boolean, dryRun: boolean) {
  const currentDir = Deno.cwd();
  const nbContext = notebookContext();
  const project = await projectContext(currentDir, nbContext);
  // Use project directory if available, otherwise fall back to current directory
  // (single-file mode without _quarto.yml)
  const baseDir = project?.dir ?? currentDir;
  const brandDir = join(baseDir, "_brand");
  if (!existsSync(brandDir)) {
    if (dryRun) {
      info(`  Would create directory: _brand/`);
    } else if (!force) {
      // Prompt for confirmation
      if (
        !await Confirm.prompt({
          message: `Create brand directory ${brandDir}?`,
          default: true,
        })
      ) {
        throw new Error(`Could not create brand directory ${brandDir}`);
      }
      ensureDirSync(brandDir);
    } else {
      // Force mode - create without prompting
      ensureDirSync(brandDir);
    }
  }
  return brandDir;
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
        throw new Error("Failed to unzip brand.\n" + result.stderr);
      }

      // Remove the tar ball itself
      await Deno.remove(zipFile);

      return Promise.resolve();
    },
  );
}

// Find files in target directory that aren't in source
function findExtraFiles(
  targetDir: string,
  sourceFiles: Set<string>,
): string[] {
  const extraFiles: string[] = [];

  function walkDir(dir: string, baseRel: string = "") {
    if (!existsSync(dir)) return;
    for (const entry of Deno.readDirSync(dir)) {
      // Use join() for cross-platform path separator compatibility
      // This matches the behavior of relative() used to build sourceFiles
      const rel = baseRel ? join(baseRel, entry.name) : entry.name;
      if (entry.isDirectory) {
        walkDir(join(dir, entry.name), rel);
      } else if (!sourceFiles.has(rel)) {
        extraFiles.push(rel);
      }
    }
  }

  walkDir(targetDir);
  return extraFiles;
}

// Clean up empty directories after file removal
function cleanupEmptyDirs(dir: string) {
  if (!existsSync(dir)) return;
  for (const entry of Deno.readDirSync(dir)) {
    if (entry.isDirectory) {
      const subdir = join(dir, entry.name);
      cleanupEmptyDirs(subdir);
      // Check if now empty
      const contents = [...Deno.readDirSync(subdir)];
      if (contents.length === 0) {
        Deno.removeSync(subdir);
      }
    }
  }
}
