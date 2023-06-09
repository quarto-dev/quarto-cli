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
import { hasComputations, isArticle } from "./manuscript-config.ts";
import {
  isHtmlOutput,
  isIpynbOutput,
  isJatsOutput,
} from "../../../config/format.ts";
import {
  kHtmlPreview,
  kJatsSubarticle,
  kRenderedIPynb,
} from "../../../render/notebook/notebook-types.ts";

import { join } from "path/mod.ts";
import { InternalError } from "../../../core/lib/error.ts";
import { notebookContext } from "../../../render/notebook/notebook-context.ts";
import { logProgress } from "../../../core/log.ts";

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

  const pandocRenderNb = async (input: string, executedFile: ExecutedFile) => {
    if (isJatsOutput(executedFile.context.format.pandoc)) {
      // TODO: Compute or forward inset?
      logProgress(`      | jats subarticle`);
      const resolvedExecutedFile = await nbContext.resolve(
        input,
        manuscriptConfig.article,
        kJatsSubarticle,
        executedFile,
      );
      return [await renderPandoc(resolvedExecutedFile, true)];
    } else if (isHtmlOutput(executedFile.context.format.pandoc, true)) {
      const result = [];
      // Use the executed file to render the output ipynb
      const renderedIpynb = nbContext.get(input);
      if (!renderedIpynb || !renderedIpynb[kRenderedIPynb]) {
        logProgress(`      | output notebook`);
        const ipynbExecutedFile = await nbContext.resolve(
          input,
          manuscriptConfig.article,
          kRenderedIPynb,
          executedFile,
        );
        result.push(await renderPandoc(ipynbExecutedFile, true));
      }

      logProgress(`      | html preview`);
      const resolvedExecutedFile = await nbContext.resolve(
        input,
        manuscriptConfig.article,
        kHtmlPreview,
        executedFile,
      );
      result.push(await renderPandoc(resolvedExecutedFile, true));
      return result;
    }
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
      if (isArt) {
        // Perform the core article rendering
        renderCompletions.push(await renderPandoc(executedFile, quiet));

        // Handle subarticle rendering, if any is needed
        if (await hasComputations(target.input)) {
          const renderedNb = await pandocRenderNb(target.input, executedFile);
          if (renderedNb) {
            renderCompletions.push(...renderedNb);
          }
        }
      } else {
        const renderedNb = await pandocRenderNb(target.input, executedFile);
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
        } else if (!isArt && isHtmlOutput(renderedFile.format.pandoc, true)) {
          const nbAbsPath = join(projectContext.dir, renderedFile.input);
          nbContext.contribute(
            nbAbsPath,
            kHtmlPreview,
            renderedFile,
          );
        } else if (!isArt && isIpynbOutput(renderedFile.format.pandoc)) {
          const nbAbsPath = join(context.dir, renderedFile.input);
          nbContext.contribute(
            nbAbsPath,
            kRenderedIPynb,
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
