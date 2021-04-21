/*
* book-render.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { stringify } from "encoding/yaml.ts";

import {
  partitionYamlFrontMatter,
  readYamlFromString,
} from "../../../core/yaml.ts";

import { kTitle } from "../../../config/constants.ts";

import {
  ExecutedFile,
  RenderedFile,
  RenderOptions,
  renderPandoc,
} from "../../../command/render/render.ts";

import { ProjectContext } from "../../project-context.ts";

import { BookExtension } from "./book-extension.ts";

export function bookPandocRenderer(
  options: RenderOptions,
  project?: ProjectContext,
) {
  // accumulate executed files for all formats
  const files: Record<string, ExecutedFile[]> = {};

  return {
    onRender: (format: string, file: ExecutedFile) => {
      files[format] = files[format] || [];
      files[format].push(file);
      return Promise.resolve();
    },
    onComplete: async () => {
      // rendered files to return
      const renderedFiles: RenderedFile[] = [];

      // some formats need to end up returning all of the individual renderedFiles
      // (e.g. html or asciidoc) and some formats will consolidate all of their
      // files into a single one (e.g. pdf or epub)
      for (const executedFiles of Object.values(files)) {
        // determine the format from the first file
        if (executedFiles.length > 0) {
          const format = executedFiles[0].context.format;

          // get the book extension
          const extension = format.extensions?.book as BookExtension;

          // if it has a renderFile method then just do a file at a time
          if (extension.renderFile) {
            for (const executedFile of executedFiles) {
              renderedFiles.push(await extension.renderFile(executedFile));
            }
            // otherwise render the entire book
          } else {
            renderedFiles.push(
              await renderSelfContainedBook(
                project!,
                options,
                extension,
                executedFiles,
              ),
            );
          }
        }
      }

      return renderedFiles;
    },
    onError: () => {
      // TODO: We can probably clean up files_dirs here
    },
  };
}

async function renderSelfContainedBook(
  _project: ProjectContext,
  _options: RenderOptions,
  _extension: BookExtension,
  files: ExecutedFile[],
): Promise<RenderedFile> {
  // we are going to compose a single ExecutedFile from the array we have been passed
  const executedFile = await mergeExecutedFiles(files);

  return renderPandoc(executedFile);
}

function mergeExecutedFiles(files: ExecutedFile[]): Promise<ExecutedFile> {
  // naive implemetnation -- merge all markdown
  const markdown = files.reduce((markdown: string, file: ExecutedFile) => {
    return markdown + file.executeResult.markdown + "\n\n";
  }, "");

  return Promise.resolve({
    ...files[0],
    executeResult: {
      ...files[0].executeResult,
      markdown,
    },
  });
}
