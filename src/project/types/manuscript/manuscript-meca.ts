/*
 * manuscript-meca.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import {
  isDocxOutput,
  isJatsOutput,
  isPdfOutput,
} from "../../../config/format.ts";
import { globalTempContext } from "../../../core/temp.ts";
import { contentType } from "../../../core/mime.ts";
import { kProjectType, ProjectContext } from "../../types.ts";
import { ProjectOutputFile } from "../types.ts";

import {
  basename,
  dirname,
  globToRegExp,
  isAbsolute,
  join,
  relative,
  SEP,
} from "path/mod.ts";
import { copySync, ensureDirSync, moveSync, walkSync } from "fs/mod.ts";
import { kMecaVersion, MecaItem, MecaManifest, toXml } from "./meca.ts";
import { zip } from "../../../core/zip.ts";
import {
  kEnvironmentFiles,
  kMecaBundle,
  ManuscriptConfig,
  ResolvedManuscriptConfig,
} from "./manuscript-types.ts";
import { Format } from "../../../config/types.ts";
import { dirAndStem, kSkipHidden } from "../../../core/path.ts";
import { inputFileForOutputFile } from "../../project-index.ts";

import * as ld from "../../../core/lodash.ts";
import { projectType } from "../project-types.ts";
import { engineIgnoreDirs } from "../../../execute/engine.ts";
import { lsFiles } from "../../../core/git.ts";
import { info } from "log/mod.ts";

const kArticleMetadata = "article-metadata";
const kArticleSupportingFile = "article-supporting-file";
const kArticleSource = "article-source";
const kArticleSourceDirectory = "article-source-directory";
const kArticleSourceEnvironment = "article-source-environment";
const kManuscript = "manuscript";
const kManuscriptSupportingFile = "manuscript-supporting-file";

const kSrcDirName = "source";

// REES Compatible execution files
// from https://repo2docker.readthedocs.io/en/latest/config_files.html#config-files
const kExecutionFiles = [
  "environment.yml",
  "requirements.txt",
  "renv.lock", // not supported by repo2docker
  "Pipfile",
  "Pipfile.lock",
  "setup.py",
  "Project.toml",
  "REQUIRE",
  "install.R",
  "apt.txt",
  "DESCRIPTION",
  "postBuild",
  "start",
  "runtime.txt",
  "default.nix",
  "Dockerfile",
];

const kMecaSuffix = "-meca.zip";

export const shouldMakeMecaBundle = (
  formats: Array<string | Format>,
  manuConfig?: ManuscriptConfig,
) => {
  if (!manuConfig || manuConfig[kMecaBundle] !== false) {
    // See if it was explicitely on
    if (manuConfig && manuConfig[kMecaBundle] === true) {
      return true;
    }

    // See if we're producing JATS, then enable it
    return formats.find((format) => {
      if (typeof (format) === "string") {
        return isJatsOutput(format);
      } else {
        return isJatsOutput(format.pandoc);
      }
    });
  } else {
    // Explicitely turned off
    return false;
  }
};

export const mecaFileName = (file: string, config: ManuscriptConfig) => {
  if (typeof (config[kMecaBundle]) === "string") {
    return config[kMecaBundle];
  } else {
    const [_, stem] = dirAndStem(file);
    return `${stem}${kMecaSuffix}`;
  }
};

export const createMecaBundle = async (
  mecaFile: string,
  context: ProjectContext,
  outputDir: string,
  outputFiles: ProjectOutputFile[],
  manuscriptConfig: ResolvedManuscriptConfig,
) => {
  const workingDir = globalTempContext().createDir();

  // Make a source directory and copy all the source files
  const srcDir = join(workingDir, kSrcDirName);
  ensureDirSync(srcDir);

  // A data structure that holds article source files, making it
  // easy to ensure that we copy each source file only once
  // (and that the first time it is added, the type is set)
  const srcFiles: Record<string, string> = {};
  const addSrcFile = (absPath: string, type: string) => {
    if (srcFiles[absPath] === undefined) {
      srcFiles[absPath] = type;
    }
  };

  // Process explicit environment files
  let hasExplicitEnvironment = false;
  if (manuscriptConfig[kEnvironmentFiles]) {
    manuscriptConfig[kEnvironmentFiles].forEach((file) => {
      const absPath = join(context.dir, file);
      addSrcFile(absPath, kArticleSourceEnvironment);
      hasExplicitEnvironment = true;
    });
  }

  const srcType = (path: string) => {
    return !hasExplicitEnvironment &&
        kExecutionFiles.includes(basename(path))
      ? kArticleSourceEnvironment
      : kArticleSource;
  };

  // Process src files
  const skip = [
    kSkipHidden,
    /\.DS_Store/,
  ];
  const projType = projectType(context.config?.project?.[kProjectType]);
  if (projType.outputDir) {
    skip.push(RegExp(`^${join(context.dir, projType.outputDir)}[\/\\\\]`));
    skip.push(RegExp(`[\/\\\\]${projType.outputDir}[\/\\\\]`));
    engineIgnoreDirs().map((ignore) =>
      skip.push(
        globToRegExp(join(context.dir, ignore) + SEP),
      )
    );
  }

  // If git is available, use the ls-files command to enumerate the
  // tracked files and use that to build the source list
  let gitFiles = await lsFiles(context.dir);
  if (gitFiles) {
    const unstagedDeletes = await (lsFiles(context.dir, ["--deleted"]));
    if (unstagedDeletes) {
      gitFiles = gitFiles.filter((file) => {
        return !unstagedDeletes.includes(file);
      });
    }

    for (const file of gitFiles) {
      // Find execution resources and include them in the bundle
      // (if they weren't explicitly assigned)
      addSrcFile(join(context.dir, file), srcType(file));
    }
  } else {
    for (const walkEntry of walkSync(context.dir, { skip })) {
      if (walkEntry.isFile) {
        // Find execution resources and include them in the bundle
        // (if they weren't explicitly assigned)
        addSrcFile(walkEntry.path, srcType(walkEntry.path));
      }
    }
  }

  // Now that we've built list of src Files, move them and turn
  // them into Meca Items
  const sourceFiles: MecaItem[] = [];
  const sourceZipFiles: string[] = [];
  const copySrcFile = (file: string, type: string) => {
    const relPath = join(kSrcDirName, relative(context.dir, file));
    const targetPath = join(workingDir, relPath);
    ensureDirSync(dirname(targetPath));
    Deno.copyFileSync(file, targetPath);
    const item = toMecaItem(relPath, type);
    sourceFiles.push(item);
    sourceZipFiles.push(relPath);
  };

  for (const path of Object.keys(srcFiles)) {
    const type = srcFiles[path];
    copySrcFile(path, type);
  }

  // Filter to permitted output formats
  const filters = [isPdfOutput, isDocxOutput];
  const articleRenderings = outputFiles.filter((outputFile) => {
    return filters.some((filter) => {
      return filter(outputFile.format.identifier["base-format"] || "html");
    });
  });

  // Find the JATS article
  // Look back to front since the article should be the last rendered file
  let jatsArticle;
  for (const outputFile of outputFiles.reverse()) {
    if (isJatsOutput(outputFile.format.pandoc)) {
      const input = await inputFileForOutputFile(context, outputFile.file);
      if (input) {
        if (relative(context.dir, input.file) === manuscriptConfig.article) {
          jatsArticle = outputFile;
          break;
        }
      }
    }
  }

  if (jatsArticle) {
    // Move the output to the working directory
    const toWorkingDir = (
      input: string,
      outputRelative: string,
      move = false,
    ) => {
      const target = join(workingDir, outputRelative);
      const targetDir = dirname(target);
      ensureDirSync(targetDir);
      if (move) {
        moveSync(input, target);
      } else {
        copySync(input, target, { overwrite: true });
      }
      return outputRelative;
    };

    // Move the article renderings to the working directory
    const articleRenderingPaths = articleRenderings.map((out) => {
      return toWorkingDir(out.file, relative(outputDir, out.file), false);
    });

    // Move the JATS article to the working directory
    const articlePath = toWorkingDir(
      jatsArticle.file,
      relative(outputDir, jatsArticle?.file),
      false,
    );

    // Move supporting files
    const manuscriptResources: MecaItem[] = [];
    const manuscriptZipFiles: string[] = [];
    if (jatsArticle.supporting) {
      ld.uniq(jatsArticle.supporting).forEach((file) => {
        const relPath = isAbsolute(file) ? relative(outputDir, file) : file;
        const absPath = isAbsolute(file) ? file : join(outputDir, file);
        const workingPath = toWorkingDir(absPath, relPath, false);

        // Add Supporting files to manifest
        const items = mecaItemsForPath(workingDir, workingPath, "manuscript");
        manuscriptResources.push(...items);

        // Note to include in zip
        manuscriptZipFiles.push(workingPath);
      });
    }

    const msg = (count: number, nameSing: string, namePlur: string) => {
      if (count === 1) {
        info(`  ${count} ${nameSing}`);
      } else if (count > 1) {
        info(`  ${count} ${namePlur}`);
      }
    };

    // +1 for the manuscript file itself
    msg(
      1 + manuscriptResources.length + articleRenderingPaths.length,
      "article file",
      "article files",
    );
    msg(Object.keys(srcFiles).length, "source file", "source files");

    // Copy resources
    const resources = [];
    resources.push(...jatsArticle.resources);
    if (context.config?.project.resources) {
      resources.push(...context.config?.project.resources);
    }

    // Add notebooks
    const notebooks = manuscriptConfig.notebooks;
    notebooks.forEach((notebook) => {
      resources.push(notebook.notebook);
    });
    msg(notebooks.length, "notebook", "notebooks");

    resources.forEach((file) => {
      const relPath = isAbsolute(file) ? relative(context.dir, file) : file;
      const absPath = isAbsolute(file) ? file : join(context.dir, file);
      const workingPath = toWorkingDir(absPath, relPath, false);

      // Add resource to manifest
      manuscriptResources.push(
        toMecaItem(
          relPath,
          kManuscriptSupportingFile,
        ),
      );

      // Note to include in zip
      manuscriptZipFiles.push(workingPath);
    });
    msg(resources.length, "other file", "other files");

    // Generate a manifest
    const articleItem = toMecaItem(articlePath, kArticleMetadata);
    const renderedItems = articleRenderingPaths.map((path) => {
      return toMecaItem(path, kManuscript);
    });
    const manifest: MecaManifest = {
      version: kMecaVersion,
      items: [
        articleItem,
        ...renderedItems,
        ...manuscriptResources,
        ...sourceFiles,
      ],
    };

    info("");

    // Write the manifest
    const manifestFile = "manifest.xml";
    const manifestXML = toXml(manifest);
    Deno.writeTextFileSync(join(workingDir, manifestFile), manifestXML);

    const filesToZip: string[] = ld.uniq([
      manifestFile,
      articlePath,
      ...articleRenderingPaths,
      ...manuscriptZipFiles,
      ...sourceZipFiles,
    ]);

    // Compress the working directory in a zip
    const zipResult = await zip(filesToZip, mecaFile, {
      cwd: workingDir,
    });
    if (zipResult.success) {
      return join(workingDir, mecaFile);
    } else {
      throw new Error(
        `An error occurred while attempting to generate MECA archive.\n${zipResult.stderr}`,
      );
    }
  }
};

const toMecaItem = (href: string, type: string): MecaItem => {
  const mediaType = contentType(href) || "application/octet-stream";
  return {
    type,
    instance: {
      href,
      mediaType,
    },
  };
};

const mecaItemsForPath = (
  basePath: string,
  relPath: string,
  type: "article" | "manuscript",
  isDir?: boolean,
): MecaItem[] => {
  const path = join(basePath, relPath);
  if (isDir === true || Deno.statSync(path).isDirectory) {
    const items: MecaItem[] = [];
    for (const subPath of Deno.readDirSync(path)) {
      if (subPath.isDirectory) {
        items.push(
          ...mecaItemsForPath(
            basePath,
            join(relPath, subPath.name),
            type,
            true,
          ),
        );
      } else {
        const filePath = join(relPath, subPath.name);
        items.push(toMecaItem(filePath, mecaType(filePath, type)));
      }
    }
    return items;
  } else {
    return [toMecaItem(relPath, mecaType(path, type))];
  }
};

const mecaType = (_path: string, type: "article" | "manuscript") => {
  if (type === "article") {
    return kArticleSupportingFile;
  } else {
    return kManuscriptSupportingFile;
  }
};
