/*
* book-render.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { relative } from "path/mod.ts";

import { ld } from "lodash/mod.ts";

import {
  kAbstract,
  kAuthor,
  kDate,
  kNumberSections,
  kSubtitle,
  kTitle,
  kToc,
} from "../../../config/constants.ts";
import { Format } from "../../../config/format.ts";

import {
  ExecutedFile,
  RenderedFile,
  RenderOptions,
  renderPandoc,
} from "../../../command/render/render.ts";

import { ProjectConfig, ProjectContext } from "../../project-context.ts";

import { BookExtension } from "./book-extension.ts";
import { bookConfig, BookConfigKey } from "./book-config.ts";

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
      // rendered files to return. some formats need to end up returning all of the individual
      // renderedFiles (e.g. html or asciidoc) and some formats will consolidate all of their
      // files into a single one (e.g. pdf or epub)
      const renderedFiles: RenderedFile[] = [];

      for (const executedFiles of Object.values(files)) {
        // determine the format from the first file
        if (executedFiles.length > 0) {
          const format = executedFiles[0].context.format;

          // get the book extension
          const extension = format.extensions?.book as BookExtension;

          // if it has a renderFile method then just do a file at a time
          if (extension.renderFile) {
            renderedFiles.push(
              ...(await renderMultiFileBook(
                project!,
                options,
                extension,
                executedFiles,
              )),
            );
            // otherwise render the entire book
          } else {
            renderedFiles.push(
              await renderSingleFileBook(
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

async function renderMultiFileBook(
  project: ProjectContext,
  _options: RenderOptions,
  extension: BookExtension,
  files: ExecutedFile[],
): Promise<RenderedFile[]> {
  const renderedFiles: RenderedFile[] = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const fileRelative = relative(project.dir, file.context.target.source);
    if (fileRelative.startsWith("index.")) {
      // generate an H1 from any title present
      const title = file.recipe.format.metadata[kTitle];
      if (title) {
        file.executeResult.markdown = `# ${title}\n\n` +
          file.executeResult.markdown;
      }
      file.recipe.format = withBookTitleMetadata(
        file.recipe.format,
        project.config,
      );
      // turn off toc and numbering
      file.recipe.format.metadata[kToc] = false;
      file.recipe.format.pandoc[kNumberSections] = false;
    }
    renderedFiles.push(await extension.renderFile!(file));
  }

  return renderedFiles;
}

async function renderSingleFileBook(
  project: ProjectContext,
  _options: RenderOptions,
  _extension: BookExtension,
  files: ExecutedFile[],
): Promise<RenderedFile> {
  // we are going to compose a single ExecutedFile from the array we have been passed
  const executedFile = await mergeExecutedFiles(files);

  // set book title metadata
  executedFile.recipe.format = withBookTitleMetadata(
    executedFile.recipe.format,
    project.config,
  );

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

function withBookTitleMetadata(format: Format, config?: ProjectConfig) {
  format = ld.cloneDeep(format);
  if (config) {
    const setMetadata = (
      key: BookConfigKey,
    ) => {
      const value = bookConfig(key, config);
      if (value) {
        format.metadata[key] = value;
      }
    };
    setMetadata(kTitle);
    setMetadata(kSubtitle);
    setMetadata(kAuthor);
    setMetadata(kDate);
    setMetadata(kAbstract);
  }
  return format;
}
