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
  OutputRecipe,
  PandocOptions,
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
import {
  kNotebookSubarticles,
  kOutputFile,
} from "../../../config/constants.ts";
import { cloneDeep } from "../../../core/lodash.ts";
import { basename, relative } from "path/mod.ts";

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
  const renderCleanup: string[] = [];

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
          const jatsNotebooks = renderedFiles.filter((file) => {
            return isJatsOutput(file.format.pandoc);
          }).map((file) => {
            return {
              input: file.input,
              output: file.file,
              supporting: file.supporting || [],
              resources: file.resourceFiles.files,
            };
          });

          // If the core article is in the list of notebooks to be included
          // as subarticles, we need to perform a separate render of the
          // article as a subarticle notebook and embed that within the article

          // Create our own executedFile based upon the existing one plus cloning
          if (
            manuscriptConfig.notebooks.find((nb) => {
              return nb.notebook ===
                relative(context.dir, executedFile.context.target.input);
            })
          ) {
            const format = cloneDeep(executedFile.recipe.format);
            resolveJatsSubarticleMetadata(format, "nb-article-");

            // Reset the output file
            const base = basename(format.pandoc[kOutputFile]);
            const outputFile = `${base}.subarticle.xml`;
            format.pandoc[kOutputFile] = outputFile;

            // Subarticle output recipe
            const subarticleRecipe: OutputRecipe = {
              output: outputFile,
              format,
              keepYaml: false,
              args: [],
              complete: (_options: PandocOptions): Promise<string | void> => {
                return Promise.resolve();
              },
            };

            // executed file
            const subarticleExecutedfile: ExecutedFile = {
              context: executedFile.context,
              executeResult: {
                markdown: executedFile.executeResult.markdown,
                supporting: [],
                filters: [],
              },
              recipe: subarticleRecipe,
              resourceFiles: [],
            };

            // run pandoc for the executed file
            const subarticleCompletion = await renderPandoc(
              subarticleExecutedfile,
              quiet,
            );
            const subarticleResult = await subarticleCompletion.complete([]);

            // Add the notebook to the subarticles list
            jatsNotebooks.push({
              input: subarticleResult.input,
              output: subarticleResult.file,
              supporting: subarticleResult.supporting || [],
              resources: subarticleResult.resourceFiles.files,
            });

            // Clean this file up once rendering is copmlete as it is transient
            renderCleanup.push(subarticleResult.file);
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
      renderCleanup.forEach((file) => {
        Deno.removeSync(file);
      });
      return {
        files: await Promise.resolve(renderedFiles),
      };
    },
  };
};
