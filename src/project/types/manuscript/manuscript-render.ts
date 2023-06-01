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
  RenderedFile,
  RenderedFormat,
  RenderOptions,
} from "../../../command/render/types.ts";
import { renderPandoc } from "../../../command/render/render.ts";
import {
  kManuscriptType,
  ResolvedManuscriptConfig,
} from "./manuscript-types.ts";
import { isArticle } from "./manuscript-config.ts";
import { isJatsOutput } from "../../../config/format.ts";
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

  return {
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
      const manuscriptConfig =
        (context.config?.[kManuscriptType] || {}) as ResolvedManuscriptConfig;
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

        const manuscriptConfig =
          (context.config?.[kManuscriptType] || {}) as ResolvedManuscriptConfig;
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
