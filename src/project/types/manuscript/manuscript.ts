/*
 * manuscript.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { resourcePath } from "../../../core/resources.ts";
import { ProjectCreate, ProjectOutputFile, ProjectType } from "../types.ts";

import { dirname, join, relative } from "path/mod.ts";
import {
  Format,
  FormatExtras,
  FormatLink,
  NotebookPublishOptions,
  PandocFlags,
} from "../../../config/types.ts";
import { kProjectRender, ProjectConfig, ProjectContext } from "../../types.ts";
import {
  kFormatLinks,
  kNotebookLinks,
  kNotebookView,
  kResources,
  kToc,
} from "../../../config/constants.ts";
import { projectOutputDir } from "../../project-shared.ts";
import {
  isDocxOutput,
  isHtmlOutput,
  isJatsOutput,
  isPdfOutput,
} from "../../../config/format.ts";
import { globalTempContext } from "../../../core/temp.ts";
import { copySync, ensureDirSync, existsSync } from "fs/mod.ts";
import { kMecaVersion, MecaItem, MecaManifest, toXml } from "./meca.ts";
import { contentType } from "../../../core/mime.ts";
import { zip } from "../../../core/zip.ts";
import { isAbsolute } from "path/mod.ts";
import { dirAndStem } from "../../../core/path.ts";
import {
  PandocOptions,
  RenderFlags,
  RenderServices,
} from "../../../command/render/types.ts";
import { gitHubContext } from "../../../core/github.ts";
import { projectInputFiles } from "../../project-context.ts";
import { kJatsSubarticle } from "../../../format/jats/format-jats-types.ts";

const kManuscriptType = "manuscript";

const kMecaFileLabel = "MECA Archive";
const kMecaSuffix = "-meca.zip";

const kManuscriptUrl = "manuscript-url";
const kMecaArchive = "meca-archive";
const kArticle = "article";
const kNotebooks = "notebooks";

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
  config: (
    projectDir: string,
    config: ProjectConfig,
    _flags?: RenderFlags,
  ): Promise<ProjectConfig> => {
    let defaultRenderFile: string | undefined = undefined;
    // Build the render list
    const manuOpts = manuscriptOptions(config) || {};
    if (manuOpts.article) {
      // If there is an explicitly specified article file
      defaultRenderFile = manuOpts.article;
    } else {
      // Locate a default target
      const defaultArticleFiles = ["index.qmd", "index.ipynb"];
      const defaultArticleFile = defaultArticleFiles.find((file) => {
        return existsSync(join(projectDir, file));
      });
      if (defaultArticleFile !== undefined) {
        defaultRenderFile = defaultArticleFile;
      } else {
        throw new Error(
          "Unable to determine the root input document for this manuscript. Please specify an `article` in your `_quarto.yml` file.",
        );
      }
    }

    // If the manuscript has resources, add those in
    if (manuOpts[kResources]) {
      config.project.resources = config.project.resources || [];
      config.project.resources = Array.isArray(config.project.resources)
        ? config.project.resources
        : [config.project.resources];
      if (Array.isArray(manuOpts[kResources])) {
        config.project.resources.push(...manuOpts[kResources]);
      } else {
        config.project.resources.push(manuOpts[kResources]);
      }
    }

    // If the user isn't explicitly providing a notebook list
    // then automatically create notebooks for the other items in
    // the project
    if (manuOpts[kNotebooks] === undefined) {
      // Find project inputs that are not in the render list
      // and move those over to the list of 'notebooks'
      // that will be rendered alongside this article
      const inputs = projectInputFiles(projectDir, config);
      const absRenderFile = join(projectDir, defaultRenderFile);
      const notebooks = inputs.files.filter((file) => {
        return file !== absRenderFile;
      });
      manuOpts[kNotebooks] = notebooks;
    }

    // Set the exact render file
    config.project[kProjectRender] = [defaultRenderFile];
    return Promise.resolve(config);
  },

  create: (_title: string): ProjectCreate => {
    const resourceDir = resourcePath(join("projects", "manuscript"));
    return {
      configTemplate: join(resourceDir, "templates", "_quarto.ejs.yml"),
      resourceDir,
      scaffold: () => [
        {
          name: "index",
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
      const filterParams: Record<string, unknown> = {};

      // See if there is an explicit manuscript URL
      const manuOpts = manuscriptOptions(options.project.config);
      if (manuOpts) {
        // Look up the base url used when rendering
        let baseUrl = manuOpts[kManuscriptUrl];
        if (baseUrl === undefined) {
          const ghContext = await gitHubContext(options.project.dir);
          baseUrl = ghContext.siteUrl;
        }
        if (baseUrl) {
          filterParams[kManuscriptUrl] = baseUrl;
        }
      }

      if (options.format.render[kNotebookLinks] !== undefined) {
        filterParams[kNotebookLinks] = options.format.render[kNotebookLinks];
      }
      return filterParams;
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
      if (manuOpts && manuOpts[kMecaArchive] !== false) {
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

      // Resolve any notebooks that are being provided
      if (manuOpts && manuOpts[kNotebooks] !== undefined) {
        const resolveNb = (
          nb: string | NotebookPublishOptions,
        ): NotebookPublishOptions => {
          if (typeof (nb) === "string") {
            nb = { notebook: nb };
          }
          return nb;
        };

        const resolveNbs = (
          nbs: Array<string | NotebookPublishOptions>,
        ) => {
          const resolvedNbs: NotebookPublishOptions[] = [];
          for (const nb of nbs) {
            resolvedNbs.push(resolveNb(nb));
          }
          return resolvedNbs;
        };

        // Forward the 'notebooks' key into `notebook-views` to configure
        // the notebook behavior for this project
        const notebooks = manuOpts[kNotebooks];
        if (format.render[kNotebookView] === undefined) {
          format.render[kNotebookView] = resolveNbs(notebooks);
        } else if (typeof (format.render[kNotebookView]) !== "boolean") {
          if (Array.isArray(format.render[kNotebookView])) {
            format.render[kNotebookView].push(...resolveNbs(notebooks));
          } else {
            format.render[kNotebookView] = [
              format.render[kNotebookView],
              ...resolveNbs(notebooks),
            ];
          }
        }
      }

      // For JATS, default subarticles on (unless turned off explicitly)
      if (
        isJatsOutput(format.pandoc) &&
        format.metadata[kJatsSubarticle] !== false
      ) {
        format.metadata[kJatsSubarticle] = true;
      }

      return format;
    } else {
      throw new Error(
        "Internal Error: Filter format being called for project without providing a project.",
      );
    }
  },
  // format extras
  formatExtras: async (
    _context: ProjectContext,
    _source: string,
    _flags: PandocFlags,
    format: Format,
    _services: RenderServices,
  ) => {
    // defaults for all formats
    const extras: FormatExtras = {
      pandoc: {
        [kToc]: isHtmlOutput(format.pandoc),
      },
    };
    return Promise.resolve(extras);
  },
  postRender: async (
    context: ProjectContext,
    _incremental: boolean,
    outputFiles: ProjectOutputFile[],
  ) => {
    const manuOpts = manuscriptOptions(context.config);
    if (manuOpts && manuOpts[kMecaArchive] !== false) {
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
  [kArticle]?: string;
  [kNotebooks]?: Array<string | NotebookPublishOptions>;
  [kResources]?: string | string[];
}

const manuscriptOptions = (config?: ProjectConfig): ManuscriptOptions => {
  if (config) {
    const manuOpts = config[kManuscriptType] as ManuscriptOptions || undefined;
    if (manuOpts[kNotebooks] !== undefined) {
      manuOpts[kNotebooks] = Array.isArray(manuOpts[kNotebooks])
        ? manuOpts[kNotebooks]
        : [manuOpts[kNotebooks]];
    }
    return manuOpts;
  } else {
    return {};
  }
};
