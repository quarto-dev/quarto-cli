/*
 * manuscript.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { resourcePath } from "../../../core/resources.ts";
import { ProjectCreate, ProjectOutputFile, ProjectType } from "../types.ts";

import { basename, join, relative } from "path/mod.ts";
import {
  Format,
  FormatExtras,
  FormatLanguage,
  FormatLink,
  kDependencies,
  kHtmlPostprocessors,
  Metadata,
  NotebookPreviewDescriptor,
  OtherLink,
  PandocFlags,
} from "../../../config/types.ts";
import { ProjectConfig, ProjectContext } from "../../types.ts";
import {
  kArticleNotebookLabel,
  kClearHiddenClasses,
  kEcho,
  kExtensionName,
  kFormatLinks,
  kIpynbProduceSourceNotebook,
  kKeepHidden,
  kLanguageDefaults,
  kManuscriptMecaBundle,
  kNotebookLinks,
  kNotebookPreserveCells,
  kNotebookPreviewOptions,
  kNotebooks,
  kOtherLinks,
  kOutputFile,
  kQuartoInternal,
  kRemoveHidden,
  kResources,
  kToc,
  kUnrollMarkdownCells,
  kWarning,
} from "../../../config/constants.ts";
import { projectOutputDir } from "../../project-shared.ts";
import { isHtmlOutput } from "../../../config/format.ts";
import {
  PandocInputTraits,
  PandocOptions,
  RenderedFormat,
  RenderFlags,
  RenderResult,
  RenderResultFile,
  RenderServices,
} from "../../../command/render/types.ts";
import { gitHubContext } from "../../../core/github.ts";
import { projectInputFiles } from "../../project-context.ts";
import { kGoogleScholar } from "../../../format/html/format-html-meta.ts";
import { resolveInputTarget } from "../../project-index.ts";
import {
  kEnvironmentFiles,
  kManuscriptType,
  kManuscriptUrl,
  ManuscriptConfig,
  ResolvedManuscriptConfig,
} from "./manuscript-types.ts";
import {
  createMecaBundle,
  mecaFileName,
  shouldMakeMecaBundle,
} from "./manuscript-meca.ts";
import { readLines } from "io/mod.ts";
import { isOutputFile } from "../../../command/render/output.ts";
import {
  computeProjectArticleFile,
  isArticle,
  isArticleManuscript,
} from "./manuscript-config.ts";
import { InternalError } from "../../../core/lib/error.ts";

import {
  JatsRenderSubArticle,
  kSubArticles,
} from "../../../format/jats/format-jats-types.ts";
import { logProgress } from "../../../core/log.ts";
import { formatLanguage } from "../../../core/language.ts";
import { manuscriptRenderer } from "./manuscript-render.ts";
import { isRStudioPreview } from "../../../core/platform.ts";
import { outputFile } from "../../../render/notebook/notebook-contributor-html.ts";
import { Document } from "../../../core/deno-dom.ts";
import { kHtmlEmptyPostProcessResult } from "../../../command/render/constants.ts";
import { resolveProjectInputLinks } from "../project-utilities.ts";
import { isQmdFile } from "../../../execute/qmd.ts";

import * as ld from "../../../core/lodash.ts";

const kMecaIcon = "archive";
const kOutputDir = "_manuscript";

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
  libDir: "site_libs",
  filterOutputFile: (file: string) => {
    if (isRStudioPreview()) {
      // HACK: RStudio doesn't know about the `_manuscript` directory
      // so this hack hides it specifically from RStudio
      return basename(file);
    } else {
      return file;
    }
  },
  config: async (
    projectDir: string,
    config: ProjectConfig,
    flags?: RenderFlags,
  ): Promise<ProjectConfig> => {
    const manuscriptConfig =
      (config[kManuscriptType] || {}) as ManuscriptConfig;

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

    // resolve language
    const language = await formatLanguage(
      config,
      config[kLanguageDefaults] as FormatLanguage,
      flags,
    );

    const inputs = projectInputFiles(projectDir, config);

    // Compute the article path
    const article = computeProjectArticleFile(projectDir, manuscriptConfig);

    // Go through project inputs and use any of these as notebooks
    const notebooks: Record<string, NotebookPreviewDescriptor> = {};

    const explicitNotebooks = manuscriptConfig[kNotebooks];
    if (explicitNotebooks) {
      resolveNotebookDescriptors(explicitNotebooks).forEach((nb) => {
        notebooks[nb.notebook] = nb;
      });
    } else {
      const inputNotebooks = inputs.files.map((input) => {
        return relative(projectDir, input);
      }).filter((file) => {
        // Filter the article
        if (file === article) {
          return false;
        }

        // Filter output notebooks
        if (isOutputFile(file, "ipynb")) {
          return false;
        }
        return true;
      });

      if (inputNotebooks) {
        resolveNotebookDescriptors(inputNotebooks).forEach((nb) => {
          notebooks[nb.notebook] = nb;
        });
      }
    }

    // Build the final render list, ensuring that the article is last in the list
    config.project.render = [
      ...Object.values(notebooks).map((nb) => (nb.notebook)),
      article,
    ];

    let count = 0;

    // Generate a summary of jats subnotebooks. The JATS
    // subnotebooks are used to configure the JATS format with
    // additional notebooks that should be included within the
    // rendered JATS article
    const jatsNotebooks = Object.values(notebooks).map((notebookDesc) => {
      return {
        input: join(projectDir, notebookDesc.notebook),
        token: `nb-${++count}`,
        render: true,
      } as JatsRenderSubArticle;
    });

    // If there are computations in the main article, the add
    // it as a notebook to be rendered with computations intact
    if (await hasComputations(join(projectDir, article))) {
      notebooks[article] = {
        notebook: article,
        title: language[kArticleNotebookLabel],
      };
      jatsNotebooks.unshift({
        input: join(projectDir, article),
        token: `nb-article`,
        render: true,
      });
    }

    // Determine the notebooks that are being declared explicitly in
    // in the manuscript configuration
    if (manuscriptConfig.notebooks !== undefined) {
      const specifiedNotebooks = Array.isArray(manuscriptConfig.notebooks)
        ? manuscriptConfig.notebooks
        : [manuscriptConfig.notebooks];
      resolveNotebookDescriptors(specifiedNotebooks).forEach((nb) => {
        notebooks[nb.notebook] = nb;
      });
    }

    // Note JATS subarticles for the JATS format
    config[kQuartoInternal] = {
      [kSubArticles]: jatsNotebooks,
    };

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
      notebooks: Object.values(notebooks),
      mecaFile: mecaFileOutput,
      [kEnvironmentFiles]: environmentFiles,
    };
    config[kManuscriptType] = resolvedManuscriptOptions;

    // Disable echo, by default
    config[kEcho] = false;
    config[kWarning] = false;

    // By default, notebook previews enable the back button
    const previewOptions = { back: true };
    config[kNotebookPreviewOptions] = previewOptions;

    return config;
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
            `authors:`,
            `  - name: Norah Jones`,
            `    affiliation: The University`,
            `    roles: writing`,
            `    corresponding: true`,
            `bibliography: references.bib`,
            "---",
            "",
            "## Section",
            "This is a simple placeholder for the manuscript's main document [@knuth84].",
          ].join("\n"),
        },
      ],
      supporting: [
        "references.bib",
      ],
    };
  },
  pandocRenderer: manuscriptRenderer,
  outputDir: kOutputDir,
  outputFile: (input: string, format: Format, project: ProjectContext) => {
    const manuscriptConfig = project.config
      ?.[kManuscriptType] as ResolvedManuscriptConfig;

    // Enable this stuff only if this is not the notebook view of an article
    if (
      !isArticleManuscript(input, format, project, manuscriptConfig) &&
      isHtmlOutput(format.pandoc)
    ) {
      return outputFile(input);
    } else {
      return undefined;
    }
  },
  cleanOutputDir: true,
  incrementalFormatPreviewing: true,
  filterParams: async (options: PandocOptions) => {
    if (options.project) {
      const filterParams: Record<string, unknown> = {};

      // See if there is an explicit manuscript URL and if
      // there isn't try resolving it using Github information
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

      // Forward along notebook link data
      if (options.format.render[kNotebookLinks] !== undefined) {
        filterParams[kNotebookLinks] = options.format.render[kNotebookLinks];
      }

      return filterParams;
    } else {
      throw new InternalError(
        "Filters params being requested for project without providing a project.",
      );
    }
  },
  filterFormat: (
    source: string,
    format: Format,
    project?: ProjectContext,
  ) => {
    if (project) {
      const manuscriptConfig = project.config
        ?.[kManuscriptType] as ResolvedManuscriptConfig;

      const formats = project.config?.format
        ? Object.keys(project.config?.format)
        : [];

      // Enable this stuff only if this is not the notebook view of an article
      if (isArticleManuscript(source, format, project, manuscriptConfig)) {
        if (shouldMakeMecaBundle(formats, manuscriptConfig)) {
          // Add an alternate link to a MECA bundle
          if (format.render[kFormatLinks] !== false) {
            const links: Array<string | FormatLink> = [];
            if (typeof (format.render[kFormatLinks]) !== "boolean") {
              links.push(...format.render[kFormatLinks] || []);
            }
            links.push({
              text: format.language[kManuscriptMecaBundle] || "MECA Bundle",
              href: mecaFileName(source, manuscriptConfig),
              icon: kMecaIcon,
              attr: { "data-meca-link": "true" },
              order: 1000,
            });
            format.render[kFormatLinks] = links;
          }
        }

        // Enable google scholar, by default
        if (format.metadata[kGoogleScholar] !== false) {
          format.metadata[kGoogleScholar] = true;
        }

        // Manage HTML output
        if (isHtmlOutput(format.pandoc, true)) {
          // Enable the TOC for HTML output
          if (format.pandoc[kToc] !== false) {
            format.pandoc[kToc] = true;
          }

          if (format.pandoc[kOutputFile] === undefined) {
            // Target index.html as its output
            format.pandoc[kOutputFile] = "index.html";
          }
        }
      }

      // Implement manuscript echo handling using
      // keep hidden (echo the code and remove hidden code)
      const userEcho = format.execute.echo;
      const userWarning = format.execute.warning;

      const clearVal: string[] = [];
      const removeVal: string[] = [];

      // If the user enables echo, just remove the hidden classes
      // If the user doesn't enable echo, just remove the hidden output
      format.execute.echo = false;
      format.execute.warning = false;
      format.render[kKeepHidden] = true;

      if (!isArticle(source, project, manuscriptConfig) && isQmdFile(source)) {
        format.render[kIpynbProduceSourceNotebook] = true;
      }

      if (userEcho === true) {
        clearVal.push("code");
      } else {
        removeVal.push("code");
      }

      if (userWarning === true) {
        clearVal.push("warning");
      } else {
        removeVal.push("warning");
      }

      const resolveValue = (vals: string[]) => {
        if (vals.length === 0) {
          return "none";
        } else if (vals.length === 1) {
          return vals[0];
        } else {
          return "all";
        }
      };
      format.metadata[kClearHiddenClasses] = resolveValue(clearVal);
      format.metadata[kRemoveHidden] = resolveValue(removeVal);

      // Implement manuscript markdown cell affordances ourselves
      // Turn on cell preservation and
      format.render[kNotebookPreserveCells] = true;
      format.metadata[kUnrollMarkdownCells] = true;

      return format;
    } else {
      throw new InternalError(
        "Filter format being called for project without providing a project.",
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
    const manuscriptConfig = context.config
      ?.[kManuscriptType] as ResolvedManuscriptConfig;

    // defaults for all formats
    const extras: FormatExtras = {};
    extras.metadata = {};

    // Only do all this for the main article
    const isArticle = isArticleManuscript(
      source,
      format,
      context,
      manuscriptConfig,
    );
    if (isArticle) {
      // Add the github repo as a metadata link
      const ghContext = await gitHubContext(context.dir);
      if (ghContext) {
        const repoUrl = ghContext.repoUrl;
        if (repoUrl) {
          const repoLink: OtherLink = {
            icon: "github",
            text: "GitHub Repo",
            href: repoUrl,
          };
          extras.metadata[kOtherLinks] = [repoLink];
        }
      }

      // If the user isn't explicitly providing a notebook list
      // then automatically create notebooks for the other items in
      // the project
      const outputNbs: Record<string, NotebookPreviewDescriptor> = {};
      const notebooks = manuscriptConfig.notebooks || [];
      for (const notebook of notebooks) {
        // Use the input to create a title for the notebook
        // if needed
        const createTitle = async () => {
          const target = await resolveInputTarget(
            context,
            relative(context.dir, notebook.notebook),
            false,
          );
          if (target) {
            return target.title;
          }
        };

        outputNbs[notebook.notebook] = {
          ...notebook,
          title: notebook.title || await createTitle(),
        };
      }
      extras[kNotebooks] = Object.values(outputNbs);
    }

    // Resolve input links
    extras.html = extras.html || {};
    extras.html[kHtmlPostprocessors] = [async (
      doc: Document,
      _options: {
        inputMetadata: Metadata;
        inputTraits: PandocInputTraits;
        renderedFormats: RenderedFormat[];
        quiet?: boolean;
      },
    ) => {
      await resolveProjectInputLinks(source, context, doc);
      return Promise.resolve(kHtmlEmptyPostProcessResult);
    }];

    // If this is a notebook, include headroom
    if (!isArticle) {
      extras.html[kDependencies] = [{
        name: "manuscript-notebook",
        scripts: [
          {
            name: "headroom.min.js",
            path: resourcePath(`projects/website/navigation/headroom.min.js`),
          },
        ],
      }];
    }

    return Promise.resolve(extras);
  },
  previewSkipUnmodified: true,
  renderResultFinalOutput: (
    renderResults: RenderResult,
  ) => {
    if (renderResults.context) {
      const manuscriptConfig = renderResults.context.config
        ?.[kManuscriptType] as ResolvedManuscriptConfig;

      // Find any of the article inputs
      const articleResults = renderResults.files.filter((file) => {
        return file.input === manuscriptConfig.article;
      });

      if (articleResults.length === 1) {
        return articleResults[0];
      } else if (articleResults.length > 1) {
        // Try to find an output that is great for previewing
        const preferredFormats = ["html", "pdf", "docx"];
        const sorted = ld.orderBy(articleResults, (item: RenderResultFile) => {
          const formatStr = item.format.identifier["base-format"];
          if (formatStr) {
            const index = preferredFormats.indexOf(formatStr);
            if (index > -1) {
              // Prefer the custom forms of formats when possible
              if (item.format.identifier[kExtensionName]) {
                return index * 2;
              } else {
                return (index * 2) + 1;
              }
            }
          }
          return Number.MAX_SAFE_INTEGER;
        }, "asc");
        return sorted[0];
      }
      return undefined;
    }
  },
  postRender: async (
    context: ProjectContext,
    _incremental: boolean,
    outputFiles: ProjectOutputFile[],
  ) => {
    const manuscriptConfig = context.config
      ?.[kManuscriptType] as ResolvedManuscriptConfig;
    if (
      shouldMakeMecaBundle(
        outputFiles.map((file) => file.format),
        manuscriptConfig,
      ) && outputFiles.length > 0
    ) {
      const language = outputFiles[0].format.language;

      logProgress(`Creating ${language[kManuscriptMecaBundle]}`);
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

const codeHintRegexes = [/`+{[^\.]+.*}/, /.*"cell_type"\s*:\s*"code".*/];
const hasComputations = async (file: string) => {
  const reader = await Deno.open(file);
  try {
    for await (const line of readLines(reader)) {
      if (line) {
        if (
          codeHintRegexes.find((regex) => {
            return regex.exec(line);
          })
        ) {
          return true;
        }
      }
    }
    return false;
  } finally {
    reader.close();
  }
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
