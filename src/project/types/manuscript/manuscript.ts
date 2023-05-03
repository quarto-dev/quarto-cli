/*
* manuscript.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/

import { resourcePath } from "../../../core/resources.ts";
import { ProjectCreate, ProjectOutputFile, ProjectType } from "../types.ts";

import { dirname, join, relative } from "path/mod.ts";
import { Format, FormatLink } from "../../../config/types.ts";
import { ProjectConfig, ProjectContext } from "../../types.ts";
import { kFormatLinks } from "../../../config/constants.ts";
import { projectOutputDir } from "../../project-shared.ts";
import {
  isDocxOutput,
  isJatsOutput,
  isPdfOutput,
} from "../../../config/format.ts";
import { globalTempContext } from "../../../core/temp.ts";
import { copySync, ensureDirSync } from "fs/mod.ts";
import { kMecaVersion, MecaItem, MecaManifest, toXml } from "./meca.ts";
import { contentType } from "../../../core/mime.ts";
import { zip } from "../../../core/zip.ts";
import { isAbsolute } from "../../../vendor/deno.land/std@0.166.0/path/win32.ts";
import { dirAndStem } from "../../../core/path.ts";
import { PandocOptions } from "../../../command/render/types.ts";
import { gitHubContext } from "../../../core/github.ts";

const kManuscriptType = "manuscript";

const kMecaFileLabel = "MECA Archive";
const kMecaSuffix = "-meca.zip";

const kManuscriptUrl = "manuscript-url";
const kMecaArchive = "meca-archive";

const mecaFileName = (file: string, manuOpts: ManuscriptOptions) => {
  if (typeof (manuOpts[kMecaArchive]) === "string") {
    return manuOpts[kMecaArchive];
  } else {
    const [_, stem] = dirAndStem(file);
    return `${stem}${kMecaSuffix}`;
  }
};

export const manuscriptProjectType: ProjectType = {
  type: kManuscriptType,

  create: (_title: string): ProjectCreate => {
    const resourceDir = resourcePath(join("projects", "manuscript"));
    return {
      configTemplate: join(resourceDir, "templates", "_quarto.ejs.yml"),
      resourceDir,
      scaffold: () => [
        {
          name: "manuscript",
          content: [
            "---",
            "title: My Manscript",
            "---",
            "",
            "## Section 1",
            "This is a section of my manuscript what up.",
          ].join("\n"),
        },
      ],
      supporting: [],
    };
  },
  outputDir: "_manuscript",
  cleanOutputDir: true,
  filterParams: async (options: PandocOptions) => {
    if (options.project) {
      // See if there is an explicit manuscript URL
      const manuOpts = manuscriptOptions(options.project.config);
      let baseUrl = manuOpts[kManuscriptUrl];
      if (baseUrl === undefined) {
        const ghContext = await gitHubContext(options.project.dir);
        baseUrl = ghContext.siteUrl;
      }
      if (baseUrl) {
        return {
          [kManuscriptUrl]: baseUrl,
        };
      } else {
        return undefined;
      }
    } else {
      throw new Error(
        "Internal Error: Filters params being requested for project without providing a project.",
      );
    }
  },
  filterFormat: (
    source: string,
    format: Format,
    project?: ProjectContext,
  ) => {
    if (project) {
      const manuOpts = manuscriptOptions(project.config);
      if (manuOpts[kMecaArchive] !== false) {
        // Add an alternate link to a MECA bundle
        if (format.render[kFormatLinks] !== false) {
          const links: Array<string | FormatLink> = [];
          if (typeof (format.render[kFormatLinks]) !== "boolean") {
            links.push(...format.render[kFormatLinks] || []);
          }
          links.push({
            title: kMecaFileLabel,
            href: mecaFileName(source, manuOpts),
          });
          format.render[kFormatLinks] = links;
        }
      }
      return format;
    } else {
      throw new Error(
        "Internal Error: Filter format being called for project without providing a project.",
      );
    }
  },
  postRender: async (
    context: ProjectContext,
    _incremental: boolean,
    outputFiles: ProjectOutputFile[],
  ) => {
    const manuOpts = manuscriptOptions(context.config);
    if (manuOpts[kMecaArchive] !== false) {
      const workingDir = globalTempContext().createDir();

      const outputDir = projectOutputDir(context);

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

        // Copy resources
        jatsArticle.resources.forEach((file) => {
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
        const mecaName = mecaFileName(articlePath, manuOpts);
        const zipResult = await zip(filesToZip, mecaName, {
          cwd: workingDir,
        });
        if (zipResult.success) {
          // Move the meca file to the project output directory
          const target = projectOutputDir(context);
          Deno.renameSync(
            join(workingDir, mecaName),
            join(target, mecaName),
          );

          // TODO: DON'T MUTATE IN PLACE, should somehow pass this
          jatsArticle.supporting = jatsArticle.supporting || [];
          jatsArticle.supporting.push(mecaName);
        } else {
          throw new Error(
            `An error occurred while attempting to generate MECA bundle.\n${zipResult.stderr}`,
          );
        }
      }
    }

    return Promise.resolve();
  },
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

interface ManuscriptOptions {
  [kManuscriptUrl]?: string;
  [kMecaArchive]?: boolean | string;
}

const manuscriptOptions = (config?: ProjectConfig): ManuscriptOptions => {
  if (config) {
    const manuOpts = config[kManuscriptType];
    return manuOpts as ManuscriptOptions;
  } else {
    return {};
  }
};
