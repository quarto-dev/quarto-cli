/*
 * manuscript.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { resourcePath } from "../../../core/resources.ts";
import { ProjectCreate, ProjectOutputFile, ProjectType } from "../types.ts";

import { dirAndStem } from "../../../core/path.ts";
import { join, relative } from "path/mod.ts";
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
} from "../../../config/constants.ts";
import { projectOutputDir } from "../../project-shared.ts";
import { isJatsOutput } from "../../../config/format.ts";
import { existsSync } from "fs/mod.ts";
import { isAbsolute } from "path/mod.ts";
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
  kEnvironmentFiles,
  kManuscriptType,
  kManuscriptUrl,
  kMecaArchive,
  ManuscriptConfig,
  ResolvedManuscriptConfig,
} from "./manuscript-types.ts";
import { createMecaBundle } from "./manuscript-meca.ts";

// TODO: Localize
const kMecaFileLabel = "MECA Archive";
const kMecaSuffix = "-meca.zip";
const kMecaIcon = "archive";

// Manscript projects are a multi file project that is composed into:
// - a root article file
//   by default index.ipynb/index.qmd unless specified in the project
// - notebooks files
//   All other executable files in the project directory are considered notebooks.
//   The 'notebooks' can serve as sources for embeds or can accompany the main article
//   as supplementary material
//
//   The notebooks will have a preview rendered and will also be download-able in the
//   HTML preview in their source form.

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

    // Process any environment files
    const userConfig = manuscriptConfig[kEnvironmentFiles] as
      | string
      | string[]
      | undefined;
    const environmentFiles = userConfig !== undefined
      ? Array.isArray(userConfig) ? userConfig : [userConfig]
      : undefined;

    // The name of the MECA file that will be produced (if enabled)
    const mecaFileOutput = mecaFileName(article, manuscriptConfig);

    // Resolve into a ResolvedManuscriptConfig (once this has executed
    // downstream code may use the resolved form of the config safely)
    const resolvedManuscriptOptions: ResolvedManuscriptConfig = {
      ...manuscriptConfig,
      article,
      notebooks,
      mecaFile: mecaFileOutput,
      [kEnvironmentFiles]: environmentFiles,
    };
    config[kManuscriptType] = resolvedManuscriptOptions;

    return Promise.resolve(config);
  },
  create: (title: string): ProjectCreate => {
    const resourceDir = resourcePath(join("projects", "manuscript"));
    return {
      configTemplate: join(resourceDir, "templates", "_quarto.ejs.yml"),
      resourceDir,
      scaffold: () => [
        {
          name: "index",
          content: [
            "---",
            `title: ${title}`,
            "---",
            "",
            "## Section",
            "This is a simple placeholder for the manuscript's main document.",
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
      if (isArticle(file.path, project, manuscriptConfig)) {
        return formats;
      } else {
        return ["ipynb"];
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
              icon: kMecaIcon,
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
    _format: Format,
    _services: RenderServices,
  ): Promise<FormatExtras> => {
    // defaults for all formats
    const extras: FormatExtras = {};

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
          let title = notebook.title;
          if (title === undefined) {
            const target = await resolveInputTarget(
              context,
              relative(context.dir, notebook.notebook),
              false,
            );
            if (target) {
              title = target.title;
            }
          }

          outputNbs.push({
            title,
            notebook: notebook.notebook,
          });
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
      const mecaFileName = manuscriptConfig.mecaFile;
      const mecaBundle = await createMecaBundle(
        mecaFileName,
        context,
        projectOutputDir(context),
        outputFiles,
        manuscriptConfig,
      );
      if (mecaBundle) {
        const target = projectOutputDir(context);
        Deno.renameSync(
          mecaBundle,
          join(target, mecaFileName),
        );
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

const mecaFileName = (file: string, config: ManuscriptConfig) => {
  if (typeof (config[kMecaArchive]) === "string") {
    return config[kMecaArchive];
  } else {
    const [_, stem] = dirAndStem(file);
    return `${stem}${kMecaSuffix}`;
  }
};
