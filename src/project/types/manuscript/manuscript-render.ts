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
  RenderType,
} from "../../../render/notebook/notebook-types.ts";

import { join } from "path/mod.ts";
import { InternalError } from "../../../core/lib/error.ts";
import { logProgress } from "../../../core/log.ts";
import { kNotebookViewStyle, kOutputFile } from "../../../config/constants.ts";
import { dirAndStem } from "../../../core/path.ts";

export const manuscriptRenderer = (
  options: RenderOptions,
  context: ProjectContext,
): PandocRenderer => {
  const renderCompletions: PandocRenderCompletion[] = [];
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
  ) => {
    if (isJatsOutput(executedFile.context.format.pandoc)) {
      const [_dir, articleBase] = dirAndStem(input);
      // TODO: Compute or forward inset?
      logProgress(`      | jats subarticle`);
      const resolvedExecutedFile = await nbContext.resolve(
        input,
        parentOutputFiles["jats"] || `${articleBase}.xml`,
        kJatsSubarticle,
        executedFile,
      );
      return [await renderPandoc(resolvedExecutedFile, true)];
    } else if (isHtmlOutput(executedFile.context.format.pandoc, true)) {
      const result = [];

      // Use the executed file to render the output ipynb
      const notebook = nbContext.get(input);
      if (!notebook || !notebook[kRenderedIPynb]) {
        logProgress(`      | output notebook`);
        const ipynbExecutedFile = await nbContext.resolve(
          input,
          input,
          kRenderedIPynb,
          executedFile,
        );
        result.push(await renderPandoc(ipynbExecutedFile, true));
      }

      logProgress(`      | html preview`);
      const resolvedExecutedFile = await nbContext.resolve(
        input,
        parentOutputFiles["html"] || "index.html",
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
      if (isArticle(target.input, context, manuscriptConfig)) {
        // Handle subarticle rendering, if any is needed
        if (await hasComputations(target.input)) {
          const renderedNb = await pandocRenderNb(
            target.input,
            articleOutputFiles,
            executedFile,
          );
          if (renderedNb) {
            renderCompletions.push(...renderedNb);
          }
        }
        // Perform the core article rendering
        renderCompletions.push(await renderPandoc(executedFile, quiet));
      } else {
        const renderedNb = await pandocRenderNb(
          target.input,
          articleOutputFiles,
          executedFile,
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
      let completion = renderCompletions.shift();
      while (completion) {
        const renderedFile = await completion.complete(renderedFormats);

        const contributeNotebook = (
          renderedFile: RenderedFile,
          renderType: RenderType,
        ) => {
          const nbAbsPath = join(projectContext.dir, renderedFile.input);
          nbContext.contribute(
            nbAbsPath,
            renderType,
            renderedFile,
          );
        };

        if (
          isJatsOutput(renderedFile.format.pandoc) &&
          renderedFile.format.metadata[kJatsSubarticle]
        ) {
          contributeNotebook(renderedFile, kJatsSubarticle);
          // Since JATS subarticles are transient and will end up self contained,
          // don't include them as rendered files
        } else if (
          isHtmlOutput(renderedFile.format.pandoc, true) &&
          renderedFile.format.render[kNotebookViewStyle] === "notebook"
        ) {
          contributeNotebook(renderedFile, kHtmlPreview);
          renderedFiles.unshift(renderedFile);
        } else if (isIpynbOutput(renderedFile.format.pandoc)) {
          contributeNotebook(renderedFile, kRenderedIPynb);
          renderedFiles.unshift(renderedFile);
        } else {
          renderedFiles.unshift(renderedFile);
        }

        completion = renderCompletions.shift();
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
