/*
 * manuscript-renderer.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { Format } from "../../../config/types.ts";
import { ProjectContext } from "../../types.ts";
import {
  ExecutedFile,
  PandocRenderCompletion,
  PandocRenderer,
  RenderContext,
  RenderedFile,
  RenderedFormat,
  RenderFile,
  RenderOptions,
} from "../../../command/render/types.ts";
import { renderPandoc } from "../../../command/render/render.ts";
import {
  kManuscriptType,
  ResolvedManuscriptConfig,
} from "./manuscript-types.ts";
import {
  hasComputations,
  isArticle,
  notebookDescriptor,
} from "./manuscript-config.ts";
import { isHtmlOutput, isJatsOutput } from "../../../config/format.ts";
import {
  kHtmlPreview,
  kJatsSubarticle,
  kQmdIPynb,
  kRenderedIPynb,
  RenderType,
} from "../../../render/notebook/notebook-types.ts";

import { basename, dirname, join, relative } from "../../../deno_ral/path.ts";
import { InternalError } from "../../../core/lib/error.ts";
import { logProgress } from "../../../core/log.ts";
import { kOutputFile } from "../../../config/constants.ts";
import { readBaseInputIndex } from "../../project-index.ts";
import { outputFile } from "../../../render/notebook/notebook-contributor-ipynb.ts";
import { isQmdFile } from "../../../execute/qmd.ts";

interface ManuscriptCompletion {
  completion: PandocRenderCompletion;
  cleanup?: boolean;
  contribute?:
    | typeof kHtmlPreview
    | typeof kQmdIPynb
    | typeof kJatsSubarticle
    | typeof kRenderedIPynb;
}

export const manuscriptRenderer = (
  options: RenderOptions,
  context: ProjectContext,
): PandocRenderer => {
  const renderCompletions: ManuscriptCompletion[] = [];
  const renderedFiles: RenderedFile[] = [];
  const nbContext = options.services.notebook;

  // This is used to accumulate the output files for the various article formats
  // We need to track this for the various formats so subnotebooks can be related
  // back to their parent article
  const articleOutputFiles: Record<string, string> = {};

  const manuscriptConfig =
    (context.config?.[kManuscriptType] || {}) as ResolvedManuscriptConfig;

  const isNotebook = (path: string) => {
    return !isArticle(path, context, manuscriptConfig);
  };

  const pandocRenderNb = async (
    input: string,
    parentOutputFiles: Record<string, string>,
    executedFile: ExecutedFile,
    project: ProjectContext,
    isArticle: boolean,
    quiet: boolean,
  ): Promise<ManuscriptCompletion[] | undefined> => {
    const displayPath = relative(project.dir, input);
    const progressMessage = (msg: string) => {
      if (!quiet) {
        logProgress(`${msg} [${displayPath}]`);
      }
    };

    if (isJatsOutput(executedFile.context.format.pandoc)) {
      progressMessage("Rendering JATS embedded notebook");
      const resolvedExecutedFile = nbContext.resolve(
        input,
        kJatsSubarticle,
        executedFile,
      );
      return [{
        completion: await renderPandoc(resolvedExecutedFile, true),
        cleanup: !isArticle,
        contribute: kJatsSubarticle,
      }];
    } else if (isHtmlOutput(executedFile.context.format.pandoc, true)) {
      const result: ManuscriptCompletion[] = [];

      // Use the executed file to render the output ipynb
      const notebook = nbContext.get(input, context);

      if (isQmdFile(input) && (!notebook || !notebook[kQmdIPynb])) {
        progressMessage("Rendering qmd embeds");
        const qmdExecuted = nbContext.resolve(
          input,
          kQmdIPynb,
          executedFile,
        );

        result.push({
          completion: await renderPandoc(qmdExecuted, true),
          cleanup: true,
          contribute: kQmdIPynb,
        });
      }

      let downloadHref;
      if (!notebook || !notebook[kRenderedIPynb]) {
        progressMessage("Rendering output notebook");
        const ipynbExecutedFile = nbContext.resolve(
          input,
          kRenderedIPynb,
          executedFile,
        );
        downloadHref = outputFile(input);
        result.push({
          completion: await renderPandoc(ipynbExecutedFile, true),
          cleanup: !isArticle,
          contribute: kRenderedIPynb,
        });
      }
      progressMessage("Rendering HTML preview");

      // Find the title of this notebook
      let title;
      const nbDescriptor = notebookDescriptor(input, manuscriptConfig, context);
      if (nbDescriptor) {
        title = nbDescriptor.title;
        downloadHref = nbDescriptor["download-url"];
      }

      if (!title) {
        const inputIndex = await readBaseInputIndex(input, context);
        if (inputIndex) {
          title = inputIndex.title;
        }
      }

      // Compute the back href
      const dirOffset = relative(dirname(input), context.dir);
      const index = join(dirOffset, "index.html");

      // Compute the notebook metadata
      const notebookMetadata = {
        title: title || basename(input),
        filename: basename(input),
        backHref: parentOutputFiles["html"] || index,
        downloadHref: downloadHref || basename(input),
        downloadFile: basename(input),
      };

      const resolvedExecutedFile = nbContext.resolve(
        input,
        kHtmlPreview,
        executedFile,
        notebookMetadata,
      );

      result.push({
        completion: await renderPandoc(resolvedExecutedFile, true),
        cleanup: !isArticle,
        contribute: kHtmlPreview,
      });
      return result;
    }
  };

  return {
    onFilterContexts: (
      file: string,
      contexts: Record<string, RenderContext>,
      _files: RenderFile[],
      _options: RenderOptions,
    ) => {
      const isValidNotebookOutput = (to: string) => {
        return [isJatsOutput, (format: string) => {
          return isHtmlOutput(format, true);
        }].find((fn) => {
          return fn(to);
        });
      };

      // Articles can be any format, notebooks can only be HTML or JATS
      if (isNotebook(file)) {
        const outContexts: Record<string, RenderContext> = {};
        const allowedFormats = Object.keys(contexts).filter(
          isValidNotebookOutput,
        );

        for (const allowedFormat of allowedFormats || []) {
          outContexts[allowedFormat] = contexts[allowedFormat];
        }

        return outContexts;
      } else {
        // This is the article file, note output files
        Object.keys(contexts).forEach((fmt) => {
          const outputFile = contexts[fmt].format.pandoc[kOutputFile];
          if (outputFile) {
            articleOutputFiles[fmt] = outputFile;
          }
        });
      }
      return contexts;
    },
    onBeforeExecute: (_format: Format) => {
      return {};
    },
    onRender: async (
      _format: string,
      executedFile: ExecutedFile,
      quiet: boolean,
    ) => {
      // Process articles or notebooks
      // Note that sometimes articles may produce a notebook also
      const target = executedFile.context.target;
      if (isArticle(target.source, context, manuscriptConfig)) {
        // Handle subarticle rendering, if any is needed
        if (await hasComputations(target.source)) {
          // Render the various previews
          const renderedNb = await pandocRenderNb(
            target.source,
            articleOutputFiles,
            executedFile,
            context,
            true,
            quiet,
          );
          if (renderedNb) {
            renderCompletions.push(...renderedNb);
          }
        }

        // Perform the core article rendering
        renderCompletions.push({
          completion: await renderPandoc(executedFile, quiet),
        });
      } else {
        const renderedNb = await pandocRenderNb(
          target.source,
          articleOutputFiles,
          executedFile,
          context,
          false,
          quiet,
        );
        if (renderedNb) {
          renderCompletions.push(...renderedNb);
        } else {
          throw new InternalError(
            "Manuscript asked to render a notebook to an unsupported format.",
          );
        }
      }
    },
    onPostProcess: async (
      renderedFormats: RenderedFormat[],
      projectContext?: ProjectContext,
    ) => {
      if (projectContext === undefined) {
        throw new InternalError(
          "Manuscript pandoc rendered is being used without a project context - this is not allowed.",
        );
      }

      // Order is important here. We are completing the files from front to back,
      // allowing the notebooks to be completed before the final article
      // is completed.
      //
      // The order of the rendered files must remain the same for output purposes (e.g.
      // throw each of OnRender, onPostProcess, and then ultimately the renderedFiles that
      // are returned, the order should always be notebooks, then finally the article output(s))
      let manuscriptCompletion = renderCompletions.shift();
      while (manuscriptCompletion) {
        const renderedFile = await manuscriptCompletion.completion.complete(
          renderedFormats,
          manuscriptCompletion.cleanup,
        );

        const contributeNotebook = (
          renderedFile: RenderedFile,
          renderType: RenderType,
        ) => {
          const nbAbsPath = join(projectContext.dir, renderedFile.input);
          nbContext.addRendering(
            nbAbsPath,
            renderType,
            renderedFile,
            context,
          );
        };

        // If rendered a notebook preview / rendering, we need to
        // contribute those back to the notebook context in case
        // others need to make use of them
        if (manuscriptCompletion.contribute) {
          contributeNotebook(renderedFile, manuscriptCompletion.contribute);
          if (manuscriptCompletion.contribute !== kJatsSubarticle) {
            renderedFiles.unshift(renderedFile);
          }
        } else {
          renderedFiles.unshift(renderedFile);
        }
        manuscriptCompletion = renderCompletions.shift();
      }
    },
    onComplete: async () => {
      // TODO: Consider manually removing certain file types from manuscript directory
      // like subarticle xml files
      const files = await Promise.resolve(renderedFiles);
      return {
        files,
      };
    },
  };
};
