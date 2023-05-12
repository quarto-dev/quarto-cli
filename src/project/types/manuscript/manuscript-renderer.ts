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
  resolveJatsSubarticleMetadata,
} from "../../../format/jats/format-jats.ts";
import { isArticle } from "./manuscript-config.ts";

export const manuscriptRenderer = (
  _options: RenderOptions,
  context: ProjectContext,
): PandocRenderer => {
  const renderCompletions: PandocRenderCompletion[] = [];
  const renderedFiles: RenderedFile[] = [];
  let nbCount = 1;
  return {
    onBeforeExecute: (_format: Format) => ({}),
    onRender: async (
      _format: string,
      executedFile: ExecutedFile,
      quiet: boolean,
    ) => {
      // Configure Subnotebooks to produce subarticle JATS
      if (isJatsOutput(executedFile.recipe.format.pandoc)) {
        const manuscriptConfig = context.config
          ?.[kManuscriptType] as ResolvedManuscriptConfig;

        if (
          !isArticle(
            executedFile.context.target.input,
            context,
            manuscriptConfig,
          )
        ) {
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
      console.log(renderedFiles);
      return {
        files: await Promise.resolve(renderedFiles),
      };
    },
  };
};
