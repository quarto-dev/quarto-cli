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
  NotebookPreviewDescriptor,
  PandocFlags,
} from "../../../config/types.ts";
import { ProjectConfig, ProjectContext } from "../../types.ts";
import {
  kFormatLinks,
  kNotebookLinks,
  kNotebooks,
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
  RenderFile,
  RenderFlags,
  RenderResult,
  RenderServices,
} from "../../../command/render/types.ts";
import { gitHubContext } from "../../../core/github.ts";
import { projectInputFiles } from "../../project-context.ts";
import { kJatsSubarticle } from "../../../format/jats/format-jats-types.ts";
import { kGoogleScholar } from "../../../format/html/format-html-meta.ts";
import { resolveInputTarget } from "../../project-index.ts";
import {
  kManuscriptType,
  kManuscriptUrl,
  kMecaArchive,
  ManuscriptConfig,
  ResolvedManuscriptConfig,
} from "./manuscript-types.ts";

const kMecaFileLabel = "MECA Archive";
const kMecaSuffix = "-meca.zip";

export const manuscriptProjectType: ProjectType = {
  type: kManuscriptType,
  config: (
    projectDir: string,
    config: ProjectConfig,
    _flags?: RenderFlags,
  ): Promise<ProjectConfig> => {
    const manuscriptConfig = config[kManuscriptType] as ManuscriptConfig ||
      undefined;

    // If the manuscript has resources, add those in
    if (manuscriptConfig[kResources]) {
      config.project.resources = config.project.resources || [];
      config.project.resources = Array.isArray(config.project.resources)
        ? config.project.resources
        : [config.project.resources];
      if (Array.isArray(manuscriptConfig[kResources])) {
        config.project.resources.push(...manuscriptConfig[kResources]);
      } else {
        config.project.resources.push(manuscriptConfig[kResources]);
      }
    }

    // Ensure the article is the last file in the render list
    const inputs = projectInputFiles(projectDir, config);
    const article = articleFile(projectDir, manuscriptConfig);
    const inputNotebooks = inputs.files.map((input) => {
      return relative(projectDir, input);
    }).filter((file) => {
      return file !== article;
    });
    const renderList = [...inputNotebooks, article];
    config.project.render = renderList;

    // Compute the notebooks
    const notebooks: NotebookPreviewDescriptor[] = [];
    if (manuscriptConfig.notebooks !== undefined) {
      const specifiedNotebooks = Array.isArray(manuscriptConfig.notebooks)
        ? manuscriptConfig.notebooks
        : [manuscriptConfig.notebooks];
      notebooks.push(...resolveNotebookDescriptors(specifiedNotebooks));
    }
    if (inputNotebooks) {
      notebooks.push(...resolveNotebookDescriptors(inputNotebooks));
    }

    // Resolve into a ResolvedManuscriptConfig (once this has executed
    // downstream code may use the resolved form of the config safely)
    const resolvedManuscriptOptions: ResolvedManuscriptConfig = {
      ...manuscriptConfig,
      article,
      notebooks,
    };
    config[kManuscriptType] = resolvedManuscriptOptions;

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
      const manuscriptConfig = options.project
        .config?.[kManuscriptType] as ResolvedManuscriptConfig;
      if (manuscriptConfig) {
        // Look up the base url used when rendering
        let baseUrl = manuscriptConfig[kManuscriptUrl];
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
  formatsForFile: (
    formats: string[],
    file: RenderFile,
    project?: ProjectContext,
  ): string[] => {
    if (project && project.config) {
      const manuscriptConfig = project
        .config[kManuscriptType] as ResolvedManuscriptConfig;
      const article = join(project.dir, manuscriptConfig.article);
      const path = file.path;
      if (path !== article) {
        return ["ipynb"];
      } else {
        return formats;
      }
    }
    return formats;
  },
  filterFormat: (
    source: string,
    format: Format,
    project?: ProjectContext,
  ) => {
    if (project) {
      const manuscriptConfig = project.config
        ?.[kManuscriptType] as ResolvedManuscriptConfig;

      if (isArticle(source, project, manuscriptConfig)) {
        if (manuscriptConfig && manuscriptConfig[kMecaArchive] !== false) {
          // Add an alternate link to a MECA bundle
          if (format.render[kFormatLinks] !== false) {
            const links: Array<string | FormatLink> = [];
            if (typeof (format.render[kFormatLinks]) !== "boolean") {
              links.push(...format.render[kFormatLinks] || []);
            }
            links.push({
              title: kMecaFileLabel,
              href: mecaFileName(source, manuscriptConfig),
            });
            format.render[kFormatLinks] = links;
          }
        }

        // For JATS, default subarticles on (unless turned off explicitly)
        if (
          isJatsOutput(format.pandoc) &&
          format.metadata[kJatsSubarticle] !== false
        ) {
          format.metadata[kJatsSubarticle] = true;
        }

        // Enable google scholar, by default
        if (format.metadata[kGoogleScholar] !== false) {
          format.metadata[kGoogleScholar] = true;
        }
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
    context: ProjectContext,
    source: string,
    _flags: PandocFlags,
    format: Format,
    _services: RenderServices,
  ): Promise<FormatExtras> => {
    // defaults for all formats
    const extras: FormatExtras = {
      pandoc: {
        [kToc]: isHtmlOutput(format.pandoc),
      },
    };

    // If the user isn't explicitly providing a notebook list
    // then automatically create notebooks for the other items in
    // the project
    const manuscriptConfig = context.config
      ?.[kManuscriptType] as ResolvedManuscriptConfig;
    if (manuscriptConfig.article !== undefined) {
      // For the root article, add the discovered notebooks to
      // to the list of notebooks to show
      if (isArticle(source, context, manuscriptConfig)) {
        const outputNbs: NotebookPreviewDescriptor[] = [];
        const notebooks = manuscriptConfig.notebooks || [];
        for (const notebook of notebooks) {
          const target = await resolveInputTarget(
            context,
            relative(context.dir, notebook.notebook),
            false,
          );
          if (target) {
            outputNbs.push({
              title: target.title,
              notebook: target.outputHref,
            });
          }
        }
        extras[kNotebooks] = outputNbs;
      }
    }

    return Promise.resolve(extras);
  },
  renderResultFinalOutput: (
    renderResults: RenderResult,
  ) => {
    if (renderResults.context) {
      const manuscriptConfig = renderResults.context.config
        ?.[kManuscriptType] as ResolvedManuscriptConfig;
      const renderResult = renderResults.files.find((file) => {
        return file.input === manuscriptConfig.article;
      });
      return renderResult;
    }
  },
  postRender: async (
    context: ProjectContext,
    _incremental: boolean,
    outputFiles: ProjectOutputFile[],
  ) => {
    const manuscriptConfig = context.config
      ?.[kManuscriptType] as ResolvedManuscriptConfig;
    if (manuscriptConfig && manuscriptConfig[kMecaArchive] !== false) {
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
        const mecaName = mecaFileName(articlePath, manuscriptConfig);
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

const isArticle = (
  file: string,
  project: ProjectContext,
  manuscriptConfig: ResolvedManuscriptConfig,
) => {
  const articlePath = isAbsolute(file)
    ? join(project.dir, manuscriptConfig.article)
    : manuscriptConfig.article;
  return file === articlePath;
};

const articleFile = (projectDir: string, config: ManuscriptConfig) => {
  let defaultRenderFile: string | undefined = undefined;
  // Build the render list
  if (config.article) {
    // If there is an explicitly specified article file
    defaultRenderFile = config.article;
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
  return defaultRenderFile;
};

const resolveNotebookDescriptor = (
  nb: string | NotebookPreviewDescriptor,
): NotebookPreviewDescriptor => {
  if (typeof (nb) === "string") {
    nb = { notebook: nb };
  }
  return nb;
};

const resolveNotebookDescriptors = (
  nbs: Array<string | NotebookPreviewDescriptor>,
) => {
  const resolvedNbs: NotebookPreviewDescriptor[] = [];
  for (const nb of nbs) {
    resolvedNbs.push(resolveNotebookDescriptor(nb));
  }
  return resolvedNbs;
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

const mecaFileName = (file: string, config: ManuscriptConfig) => {
  if (typeof (config[kMecaArchive]) === "string") {
    return config[kMecaArchive];
  } else {
    const [_, stem] = dirAndStem(file);
    return `${stem}${kMecaSuffix}`;
  }
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
