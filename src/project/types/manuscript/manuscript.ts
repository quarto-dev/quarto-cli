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

const kManuscriptType = "manuscript";

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
    if (
      format.render[kFormatLinks] !== undefined &&
      format.render[kFormatLinks] !== false
    ) {
      const links: Array<string | FormatLink> = [];
      if (typeof (format.render[kFormatLinks]) !== "boolean") {
        links.push(...format.render[kFormatLinks]);
      }
      links.push({
        title: "MECA XML",
        href: "meca.xml",
      });
      format.render[kFormatLinks] = links;
    }
    return format;
  },
  postRender: (
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
    if (!jatsArticle) {
      throw new Error(
        "The manuscript format requires that a JATS XML file be produced.",
      );
    }

    // Move the output to the working directory
    const copyOutput = (path: string) => {
      const pathRel = relative(outputDir, path);
      const targetFile = join(workingDir, pathRel);
      const targetDir = dirname(targetFile);
      ensureDirSync(targetDir);
      Deno.copyFileSync(path, targetFile);
      return pathRel;
    };

    const articleRenderingPaths = articleRenderings.map((out) => {
      return copyOutput(out.file);
    });

    const articlePath = copyOutput(jatsArticle?.file);

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

    const meca: MecaManifest = {
      version: kMecaVersion,
      items: [articleItem, ...renderedItems],
    };
    const mecaXml = toXml(meca);
    console.log(mecaXml);

    // Import zip utility
    // UUID-meca.zip

    // Move the outputs to the workingDir

    // Grab these file and move to staging area

    // Grab jats and jats-figures

    // Get the list of files
    // Make a manifest XML file
    //

    return Promise.resolve();
  },
};
