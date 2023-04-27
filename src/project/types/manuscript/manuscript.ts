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
import { ProjectContext } from "../../types.ts";
import { kFormatLinks } from "../../../config/constants.ts";
import { projectOutputDir } from "../../project-shared.ts";
import {
  isDocxOutput,
  isJatsOutput,
  isPdfOutput,
} from "../../../config/format.ts";
import { globalTempContext } from "../../../core/temp.ts";
import { ensureDirSync } from "fs/mod.ts";
import { kMecaVersion, MecaItem, MecaManifest, toXml } from "./meca.ts";
import { contentType } from "../../../core/mime.ts";
import { zip } from "../../../core/zip.ts";

const kManuscriptType = "manuscript";

const kMecaFileLabel = "MECA Archive";
const kMecaFileName = "meca.zip";

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
  filterFormat: (
    _source: string,
    format: Format,
    _project?: ProjectContext,
  ) => {
    // Add an alternate link to a MECA bundle
    if (format.render[kFormatLinks] !== false) {
      const links: Array<string | FormatLink> = [];
      if (typeof (format.render[kFormatLinks]) !== "boolean") {
        links.push(...format.render[kFormatLinks] || []);
      }
      links.push({
        title: kMecaFileLabel,
        href: kMecaFileName,
      });
      format.render[kFormatLinks] = links;
    }
    return format;
  },
  postRender: async (
    context: ProjectContext,
    _incremental: boolean,
    outputFiles: ProjectOutputFile[],
  ) => {
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
      const copyOutput = (path: string) => {
        const pathRel = relative(outputDir, path);
        const targetFile = join(workingDir, pathRel);
        const targetDir = dirname(targetFile);
        ensureDirSync(targetDir);
        Deno.copyFileSync(path, targetFile);
        return pathRel;
      };

      // Move the article renderings to the output directory
      const articleRenderingPaths = articleRenderings.map((out) => {
        return copyOutput(out.file);
      });

      // Move the JATS article to the output directory
      const articlePath = copyOutput(jatsArticle?.file);

      // TODO: Move JATS supporting files to the output directory

      // Generate a manifest
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
      const articleItem = toMecaItem(articlePath, "article-metadata");
      const renderedItems = articleRenderingPaths.map((path) => {
        return toMecaItem(path, "manuscript");
      });
      const manifest: MecaManifest = {
        version: kMecaVersion,
        items: [articleItem, ...renderedItems],
      };

      // Write the manifest
      const manifestFile = "manifest.xml";
      const manifestXML = toXml(manifest);
      Deno.writeTextFileSync(join(workingDir, manifestFile), manifestXML);

      const filesToZip: string[] = [
        manifestFile,
        articlePath,
        ...articleRenderingPaths,
      ];

      // Compress the working directory in a zip
      const zipResult = await zip(filesToZip, kMecaFileName, {
        cwd: workingDir,
      });
      if (zipResult.success) {
        // Move the meca file to the project output directory
        const target = projectOutputDir(context);
        Deno.renameSync(
          join(workingDir, kMecaFileName),
          join(target, kMecaFileName),
        );
      } else {
        throw new Error(
          `An error occurred while attempting to generate MECA bundle.\n${zipResult.stderr}`,
        );
      }
    }

    return Promise.resolve();
  },
};
