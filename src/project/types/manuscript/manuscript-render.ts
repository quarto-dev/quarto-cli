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
import { isArticle } from "./manuscript-config.ts";
import { isHtmlOutput, isJatsOutput } from "../../../config/format.ts";
import { kJatsSubarticle } from "../../../render/notebook/notebook-types.ts";

import { join } from "path/mod.ts";
import { InternalError } from "../../../core/lib/error.ts";
import { notebookContext } from "../../../render/notebook/notebook-context.ts";

export const manuscriptRenderer = (
  _options: RenderOptions,
  context: ProjectContext,
): PandocRenderer => {
  const renderCompletions: PandocRenderCompletion[] = [];
  const renderedFiles: RenderedFile[] = [];
  const nbContext = notebookContext();

  const manuscriptConfig =
    (context.config?.[kManuscriptType] || {}) as ResolvedManuscriptConfig;

  const isNotebook = (path: string) => {
    return !isArticle(path, context, manuscriptConfig);
  };

  return {
    onFilterContexts: (
      file: string,
      contexts: Record<string, RenderContext>,
      files: RenderFile[],
      options: RenderOptions,
    ) => {
      const isValidNotebookOutput = (to: string) => {
        return [isJatsOutput, (format: string) => {
          return isHtmlOutput(format, true);
        }].find((fn) => {
          return fn(to);
        });
      };

      // if the render file list doesn't contain any article, and there is a custom too
      // (so this is an attemp to render only manuscript notebooks), throw error
      if (
        options.flags?.to && !isValidNotebookOutput(options.flags.to) &&
        !files.find((renderFile) => {
          return isArticle(renderFile.path, context, manuscriptConfig);
        })
      ) {
        throw new Error(
          "Notebooks within manuscript projects can only be rendered as a part of rendering the article or as an HTML or JATS preview.",
        );
      }

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
      // TODO: Remove hack
      executedFile.context.options.services.notebook = nbContext;
      const target = executedFile.context.target;
      const isArt = isArticle(target.input, context, manuscriptConfig);

      // TODO: Deal with HTML and PDF requests for notebooks
      let targetExecutedFile = executedFile;
      if (!isArt && isJatsOutput(executedFile.context.format.pandoc)) {
        const resolvedExecutedFile = nbContext.resolve(
          target.input,
          kJatsSubarticle,
          executedFile,
        );
        if (resolvedExecutedFile) {
          targetExecutedFile = resolvedExecutedFile;
        }
      }

      // Configure Subnotebooks to produce subarticle JATS
      renderCompletions.push(await renderPandoc(targetExecutedFile, quiet));

      // If this is an article with computations, do any special work
      // required to resolve a version of it as a subarticle, preview, etc...
      if (isArt && isJatsOutput(executedFile.context.format.pandoc)) {
        const subArticleExecutedFile = nbContext.resolve(
          target.input,
          kJatsSubarticle,
          executedFile,
        );
        if (subArticleExecutedFile) {
          const result = await renderPandoc(subArticleExecutedFile, true);
          const renderedFile = await result.complete([{
            path: target.input,
            format: subArticleExecutedFile.context.format,
          }]);
          const nbAbsPath = join(context.dir, renderedFile.input);
          nbContext.contribute(
            nbAbsPath,
            kJatsSubarticle,
            renderedFile,
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

      let completion = renderCompletions.pop();
      while (completion) {
        const renderedFile = await completion.complete(renderedFormats);
        renderedFiles.push(renderedFile);

        const isArt = isArticle(renderedFile.input, context, manuscriptConfig);

        if (
          !isArt && isJatsOutput(renderedFile.format.pandoc)
        ) {
          const nbAbsPath = join(projectContext.dir, renderedFile.input);
          nbContext.contribute(
            nbAbsPath,
            kJatsSubarticle,
            renderedFile,
          );
        }

        completion = renderCompletions.pop();
      }
    },
    onComplete: async () => {
      //nbContext.cleanup();
      const files = await Promise.resolve(renderedFiles);
      return {
        files,
      };
    },
  };
};
