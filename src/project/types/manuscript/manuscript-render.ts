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
import { isHtmlDocOutput, isJatsOutput } from "../../../config/format.ts";

export const manuscriptRenderer = (
  _options: RenderOptions,
  context: ProjectContext,
): PandocRenderer => {
  const renderCompletions: PandocRenderCompletion[] = [];
  const renderedFiles: RenderedFile[] = [];

  type input = string;
  type baseFormat = string;
  let notebookCount = 0;

  return {
    onBeforeExecute: (_format: Format) => {
      console.log({ "onBeforeExecute": _format.identifier["display-name"] });
      return {};
    },
    onRender: async (
      _format: string,
      executedFile: ExecutedFile,
      quiet: boolean,
    ) => {
      const manuscriptConfig =
        (context.config?.[kManuscriptType] || {}) as ResolvedManuscriptConfig;
      const target = executedFile.context.target;
      const isArt = isArticle(target.input, context, manuscriptConfig);

      console.log({ "onRender": executedFile.context.target.input });

      if (isHtmlDocOutput(executedFile.context.format.pandoc)) {
        if (isArt) {
        } else {
          // Configure this render to generate a notebook
        }
      } else if (isJatsOutput(executedFile.context.format.pandoc)) {
        if (!isArt) {
          // Render self as a subarticle

          // Rendered ipynb
          // Rendered HTML
          // Rendered JATS?
        } else {
        }
      } else {
        if (!isArt) {
          // Switch target to HTML
        }
        // WTF do we do with notebooks in this case?!
        // Render HTML preview
      }

      // Configure Subnotebooks to produce subarticle JATS
      renderCompletions.push(await renderPandoc(executedFile, quiet));
    },
    onPostProcess: async (renderedFormats: RenderedFormat[]) => {
      console.log({
        "onPostProcess": renderedFormats.map((f) => {
          return {
            format: f.format.identifier["display-name"],
            output: f.path,
          };
        }),
      });

      let completion = renderCompletions.pop();
      while (completion) {
        const renderedFile = await completion.complete(renderedFormats);
        renderedFiles.push(renderedFile);
        completion = renderCompletions.pop();
      }
    },
    onComplete: async () => {
      console.log({ "onComplete": "" });
      return {
        files: await Promise.resolve(renderedFiles),
      };
    },
  };
};
