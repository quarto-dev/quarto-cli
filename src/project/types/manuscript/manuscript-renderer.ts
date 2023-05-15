/*
 * manuscript-renderer.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { Format } from "../../../config/types.ts";
import { ProjectContext } from "../../types.ts";
import { isJatsOutput } from "../../../config/format.ts";
import {
  ExecutedFile,
  PandocRenderCompletion,
  PandocRenderer,
  RenderedFile,
  RenderedFormat,
  RenderOptions,
} from "../../../command/render/types.ts";
import {
  kManuscriptType,
  ResolvedManuscriptConfig,
} from "./manuscript-types.ts";
import { renderPandoc } from "../../../command/render/render.ts";
import {
  resolveEmbeddedSubarticles,
  resolveJatsSubarticleMetadata,
} from "../../../format/jats/format-jats.ts";
import { isArticle } from "./manuscript-config.ts";
import { kNotebookSubarticles } from "../../../config/constants.ts";
import { relative } from "path/mod.ts";
import {
  JatsRenderSubArticle,
  JatsSubArticle,
} from "../../../format/jats/format-jats-types.ts";

// The manuscript renderer coordinates the rendering of the main article
// and the notebooks.
//
// It depends upon the article always being rendered last-  it will allow the
// notebooks to be rendered (configuring them along the way, if needed) and
// then use the rendered notebooks as appropriate, injecting them as subarticles
// in JATS, for example.
export const manuscriptRenderer = (
  _options: RenderOptions,
  context: ProjectContext,
): PandocRenderer => {
  // Accumulate completions and files
  const renderCompletions: PandocRenderCompletion[] = [];
  const renderedFiles: RenderedFile[] = [];

  // Increment a notebook counter
  let nbCount = 1;
  return {
    onBeforeExecute: (_format: Format) => ({}),
    onRender: async (
      _format: string,
      executedFile: ExecutedFile,
      quiet: boolean,
    ) => {
      // Configure Subnotebooks to produce subarticle JATS (if enabled)
      if (
        isJatsOutput(executedFile.recipe.format.pandoc) &&
        executedFile.recipe.format.render[kNotebookSubarticles] !== false
      ) {
        const manuscriptConfig = context.config
          ?.[kManuscriptType] as ResolvedManuscriptConfig;

        if (
          isArticle(
            executedFile.context.target.input,
            context,
            manuscriptConfig,
          )
        ) {
          // For the core article, provide the subarticles to be bundled
          const jatsNotebooks: Array<JatsSubArticle | JatsRenderSubArticle> =
            renderedFiles.filter((file) => {
              return isJatsOutput(file.format.pandoc);
            }).map((file) => {
              return {
                render: false,
                input: file.input,
                output: file.file,
                supporting: file.supporting || [],
                resources: file.resourceFiles.files,
              };
            });

          // If the core article is in the list of notebooks to be included
          // as subarticles, we need to perform a separate render of the
          // article as a subarticle notebook and embed that within the article
          if (
            manuscriptConfig.notebooks.find((nb) => {
              return nb.notebook ===
                relative(context.dir, executedFile.context.target.input);
            })
          ) {
            // Add a notebook to render here
            jatsNotebooks.push({
              render: true,
              input: executedFile.context.target.input,
              token: "nb-article",
            });
          }

          resolveEmbeddedSubarticles(
            executedFile.recipe.format,
            jatsNotebooks,
          );
        } else {
          // For a notebook, configure rendering as a subarticle
          resolveJatsSubarticleMetadata(
            executedFile.recipe.format,
            `nb-${nbCount++}`,
          );
        }
      }
      renderCompletions.push(await renderPandoc(executedFile, quiet));
    },
    onPostProcess: async (renderedFormats: RenderedFormat[]) => {
      let completion = renderCompletions.pop();
      while (completion) {
        renderedFiles.push(await completion.complete(renderedFormats));
        completion = renderCompletions.pop();
      }
    },
    onComplete: async () => {
      return {
        files: await Promise.resolve(renderedFiles),
      };
    },
  };
};
