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
import { ProjectContext } from "../../types.ts";
import { ProjectOutputFile } from "../types.ts";

import { dirname, isAbsolute, join, relative } from "path/mod.ts";
import { copySync, ensureDirSync, existsSync } from "fs/mod.ts";
import { kMecaVersion, MecaItem, MecaManifest, toXml } from "./meca.ts";
import { zip } from "../../../core/zip.ts";
import { ResolvedManuscriptConfig } from "./manuscript-types.ts";
import { projectArtifactCreator } from "../../../command/create/artifacts/project.ts";

// REES Compatible execution files
// from https://repo2docker.readthedocs.io/en/latest/config_files.html#config-files
const kExecutionFiles = [
  "environment.yml",
  "requirements.txt",
  "renv.lock",
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

export const createMecaBundle = async (
  mecaFile: string,
  context: ProjectContext,
  outputDir: string,
  outputFiles: ProjectOutputFile[],
  _manuscriptConfig: ResolvedManuscriptConfig,
) => {
  const workingDir = globalTempContext().createDir();

  // Filter to permitted output formats
  const filters = [isPdfOutput, isDocxOutput];
  const articleRenderings = outputFiles.filter((outputFile) => {
    return filters.some((filter) => {
      return filter(outputFile.format.identifier["base-format"] || "html");
    });
  });

  const jatsArticle = outputFiles.find((output) => {
    return isJatsOutput(output.format.identifier["base-format"] || "html");
  });

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
        Deno.renameSync(input, target);
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
      jatsArticle?.file,
      relative(outputDir, jatsArticle?.file),
      false,
    );

    // Move supporting files
    const manuscriptResources: MecaItem[] = [];
    const manuscriptZipFiles: string[] = [];
    if (jatsArticle.supporting) {
      jatsArticle.supporting.forEach((file) => {
        const relPath = isAbsolute(file) ? relative(outputDir, file) : file;
        const absPath = isAbsolute(file) ? file : join(outputDir, file);
        const workingPath = toWorkingDir(absPath, relPath, false);

        // Add Supporting files to manifest
        const items = mecaItemsForPath(workingDir, workingPath);
        manuscriptResources.push(...items);

        // Note to include in zip
        manuscriptZipFiles.push(workingPath);
      });
    }

    // Find execution resources and include them in the bundle
    kExecutionFiles.forEach((file) => {
      const absPath = join(context.dir, file);
      if (existsSync(absPath)) {
        // Copy to working dir
        const workingPath = toWorkingDir(absPath, file);

        // Add to MECA bundle
        manuscriptResources.push(
          ...mecaItemsForPath(workingDir, workingPath),
        );

        // Note to include in zip
        manuscriptZipFiles.push(workingPath);
      }
    });

    // Copy resources
    const resources = [];
    resources.push(...jatsArticle.resources);
    if (context.config?.project.resources) {
      resources.push(...context.config?.project.resources);
    }

    resources.forEach((file) => {
      const relPath = isAbsolute(file) ? relative(context.dir, file) : file;
      const absPath = isAbsolute(file) ? file : join(context.dir, file);
      const workingPath = toWorkingDir(absPath, relPath, false);

      // Add resource to manifest
      manuscriptResources.push(
        ...mecaItemsForPath(workingDir, workingPath),
      );

      // Note to include in zip
      manuscriptZipFiles.push(workingPath);
    });

    // Generate a manifest
    const articleItem = toMecaItem(articlePath, "article-metadata");
    const renderedItems = articleRenderingPaths.map((path) => {
      return toMecaItem(path, "manuscript");
    });
    const manifest: MecaManifest = {
      version: kMecaVersion,
      items: [articleItem, ...renderedItems, ...manuscriptResources],
    };

    // Write the manifest
    const manifestFile = "manifest.xml";
    const manifestXML = toXml(manifest);
    Deno.writeTextFileSync(join(workingDir, manifestFile), manifestXML);

    const filesToZip: string[] = [
      manifestFile,
      articlePath,
      ...articleRenderingPaths,
      ...manuscriptZipFiles,
    ];

    // Compress the working directory in a zip
    const zipResult = await zip(filesToZip, mecaFile, {
      cwd: workingDir,
    });
    if (zipResult.success) {
      return join(workingDir, mecaFile);
    } else {
      throw new Error(
        `An error occurred while attempting to generate MECA bundle.\n${zipResult.stderr}`,
      );
    }
  }
};

const toMecaItem = (href: string, type: string): MecaItem => {
  const mediaType = contentType(href);
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
  isDir?: boolean,
): MecaItem[] => {
  const path = join(basePath, relPath);
  if (isDir === true || Deno.statSync(path).isDirectory) {
    const items: MecaItem[] = [];
    for (const subPath of Deno.readDirSync(path)) {
      if (subPath.isDirectory) {
        items.push(
          ...mecaItemsForPath(basePath, join(relPath, subPath.name), true),
        );
      } else {
        const filePath = join(relPath, subPath.name);
        items.push(toMecaItem(filePath, mecaType(filePath)));
      }
    }
    return items;
  } else {
    return [toMecaItem(relPath, mecaType(path))];
  }
};

const mecaType = (_path: string) => {
  return "manuscript_reference";
};
