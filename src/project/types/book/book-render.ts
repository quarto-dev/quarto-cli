/*
 * book-render.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { dirname, isAbsolute, join, relative } from "path/mod.ts";

import { encode as base64Encode } from "encoding/base64.ts";

import * as ld from "../../../core/lodash.ts";

import {
  parsePandocTitle,
  partitionMarkdown,
} from "../../../core/pandoc/pandoc-partition.ts";

import {
  kAbstract,
  kAuthor,
  kDate,
  kDescription,
  kDoi,
  kFormatLinks,
  kHideDescription,
  kKeepTex,
  kNumberSections,
  kOutputExt,
  kOutputFile,
  kSubtitle,
  kTitle,
  kToc,
} from "../../../config/constants.ts";
import { Format, Metadata } from "../../../config/types.ts";
import { isHtmlOutput } from "../../../config/format.ts";

import { renderPandoc } from "../../../command/render/render.ts";
import { PandocRenderCompletion } from "../../../command/render/types.ts";

import { renderContexts } from "../../../command/render/render-contexts.ts";

import {
  ExecutedFile,
  RenderContext,
  RenderedFile,
  RenderedFormat,
  RenderOptions,
} from "../../../command/render/types.ts";
import { outputRecipe } from "../../../command/render/output.ts";
import { renderCleanup } from "../../../command/render/cleanup.ts";

import { ProjectConfig, ProjectContext } from "../../types.ts";
import { ProjectOutputFile } from "../types.ts";

import { executionEngineKeepMd } from "../../../execute/engine.ts";

import { websiteOutputFiles, websitePostRender } from "../website/website.ts";

import {
  onSingleFileBookPostRender,
  onSingleFileBookPreRender,
} from "./book-extension.ts";
import { bookConfigRenderItems } from "./book-config.ts";
import { BookRenderItem } from "./book-types.ts";
import { bookOutputStem } from "./book-shared.ts";
import { kBookItemAppendix, kBookItemPart } from "./book-constants.ts";
import {
  chapterInfoForInput,
  isListedChapter,
  withChapterMetadata,
} from "./book-chapters.ts";
import {
  bookConfig,
  BookConfigKey,
  BookExtension,
  isBookIndexPage,
  isMultiFileBookFormat,
  isNumberedChapter,
  kBookCoverImage,
  kBookCoverImageAlt,
} from "./book-shared.ts";
import { bookCrossrefsPostRender } from "./book-crossrefs.ts";
import { bookBibliographyPostRender } from "./book-bibliography.ts";
import { partitionYamlFrontMatter } from "../../../core/yaml.ts";
import { pathWithForwardSlashes } from "../../../core/path.ts";
import { kDateFormat } from "../website/listing/website-listing-template.ts";
import { removePandocTo } from "../../../command/render/flags.ts";
import { resourcePath } from "../../../core/resources.ts";
import { PandocAttr, PartitionedMarkdown } from "../../../core/pandoc/types.ts";
import { stringify } from "yaml/mod.ts";
import { waitUntilNamedLifetime } from "../../../core/lifetimes.ts";

export function bookPandocRenderer(
  options: RenderOptions,
  project: ProjectContext,
) {
  // rendered files to return. some formats need to end up returning all of the individual
  // renderedFiles (e.g. html or asciidoc) and some formats will consolidate all of their
  // files into a single one (e.g. pdf or epub)
  const renderCompletions: PandocRenderCompletion[] = [];
  const renderedFiles: RenderedFile[] = [];

  // accumulate executed files for formats that need deferred rendering
  const executedFiles: Record<string, ExecutedFile[]> = {};

  // function to cleanup any files that haven't gone all the way
  // through the rendering pipeline
  const cleanupExecutedFiles = () => {
    for (const format of Object.keys(executedFiles)) {
      executedFiles[format].forEach((executedFile) => {
        cleanupExecutedFile(
          executedFile,
          executedFile.recipe.output,
        );
      });
    }
  };

  return {
    onFilterContexts: (
      _file: string,
      contexts: Record<string, RenderContext>,
      _project?: ProjectContext,
    ) => {
      return contexts;
    },
    onBeforeExecute: (format: Format) => {
      return {
        // if we render a file at a time then resolve dependencies immediately
        resolveDependencies: isMultiFileBookFormat(format),
      };
    },

    onRender: async (format: string, file: ExecutedFile, quiet: boolean) => {
      // render immediately for multi-file book formats (with appropriate
      // handling of titles, headings, etc.)
      if (isMultiFileBookFormat(file.context.format)) {
        const partitioned = partitionMarkdown(file.executeResult.markdown);
        const fileRelative = pathWithForwardSlashes(
          relative(project.dir, file.context.target.source),
        );

        // index file
        const isIndex = isBookIndexPage(fileRelative);
        if (isIndex) {
          file.recipe.format = withBookTitleMetadata(
            file.recipe.format,
            project.config,
          );
          if (!isNumberedChapter(partitioned)) {
            file.recipe.format.pandoc[kNumberSections] = false;
          }
          if (!isListedChapter(partitioned.headingAttr)) {
            file.recipe.format.pandoc[kToc] = false;
          }

          // prepend any cover image
          const coverImage = (file.recipe.format.metadata[kBookCoverImage] ||
            bookConfig(kBookCoverImage, project.config)) as
              | string
              | undefined;

          if (coverImage) {
            const coverImageAlt =
              (file.recipe.format.metadata[kBookCoverImageAlt] ||
                bookConfig(kBookCoverImageAlt, project.config)) as
                  | string
                  | undefined;
            const title = file.recipe.format.metadata[kTitle] || "";
            const alt = coverImageAlt ? ` fig-alt="${coverImageAlt}"` : "";
            file.executeResult.markdown =
              `![](${coverImage} "${title}"){.quarto-cover-image${alt}}\n\n` +
              file.executeResult.markdown;
          }

          // other files
        } else {
          // since this could be an incremental render we need to compute the chapter number
          const chapterInfo = isHtmlOutput(file.recipe.format.pandoc)
            ? chapterInfoForInput(project, fileRelative)
            : undefined;

          // Since this is a book page, we need to suppress rendering of the description
          file.recipe.format.metadata[kHideDescription] = true;

          // see if there is a 'title' in the yaml, if there isn't one, then we
          // try to extract via partitioned.headingText
          const titleInMetadata = frontMatterTitle(partitioned.yaml);
          if (titleInMetadata) {
            const parsedHeading = parsePandocTitle(titleInMetadata);
            file.recipe.format = withChapterMetadata(
              file.recipe.format,
              parsedHeading.heading,
              parsedHeading.attr,
              chapterInfo,
              project.config,
            );
          } else {
            // provide title metadata
            if (partitioned.headingText) {
              file.recipe.format = withChapterMetadata(
                file.recipe.format,
                partitioned.headingText,
                partitioned.headingAttr,
                chapterInfo,
                project.config,
              );
            }

            // provide markdown
            const executeMarkdownPartitioned = partitionYamlFrontMatter(
              file.executeResult.markdown,
            );
            if (executeMarkdownPartitioned) {
              file.executeResult.markdown = executeMarkdownPartitioned.yaml +
                "\n\n" + partitioned.markdown;
            } else {
              file.executeResult.markdown = partitioned.markdown;
            }
          }
        }

        // Use the pre-render hook to allow formats to customize
        // the format before it is rendered.
        if (file.recipe.format.extensions?.book) {
          const bookExtension = file.recipe.format.extensions
            ?.book as BookExtension;
          if (bookExtension.onMultiFilePrePrender) {
            const result = await bookExtension.onMultiFilePrePrender(
              isIndex,
              file.recipe.format,
              file.executeResult.markdown,
              project,
            );
            if (result.format) {
              file.recipe.format = result.format;
            }
            if (result.markdown) {
              file.executeResult.markdown = result.markdown;
            }
          }
        }

        // Since this is a book page, don't include other format links
        file.recipe.format.render[kFormatLinks] = false;

        // perform the render
        const renderCompletion = await renderPandoc(file, quiet);
        renderCompletions.push(renderCompletion);
        // accumulate executed files for single file formats
      } else {
        executedFiles[format] = executedFiles[format] || [];
        executedFiles[format].push(file);
      }
    },
    onPostProcess: async (
      renderedFormats: RenderedFormat[],
    ) => {
      let completion = renderCompletions.pop();
      while (completion) {
        renderedFiles.push(await completion.complete(renderedFormats));
        completion = renderCompletions.pop();
      }
    },
    onComplete: async (error?: boolean, quiet?: boolean) => {
      // if there was an error during execution then cleanup any
      // executed files we've accumulated and return no rendered files
      if (error) {
        cleanupExecutedFiles();
        return {
          files: renderedFiles,
        };
      }

      // handle executed files
      try {
        const renderFormats = Object.keys(executedFiles);
        for (const renderFormat of renderFormats) {
          // get files
          const files = executedFiles[renderFormat];

          // determine the format from the first file
          if (files.length > 0) {
            const format = files[0].context.format;

            // if it's not a multi-file book then we need to render from the
            // accumulated exected files
            if (!isMultiFileBookFormat(format)) {
              renderedFiles.push(
                await renderSingleFileBook(
                  project!,
                  options,
                  files,
                  !!quiet,
                ),
              );
            }
          }

          // remove the rendered files (indicating they have already been cleaned up)
          delete executedFiles[renderFormat];
        }

        return {
          files: renderedFiles,
        };
      } catch (error) {
        cleanupExecutedFiles();
        return {
          files: renderedFiles,
          error: error
            ? typeof (error) === "string" ? new Error(error) : error
            : new Error(),
        };
      }
    },
  };
}

async function renderSingleFileBook(
  project: ProjectContext,
  options: RenderOptions,
  files: ExecutedFile[],
  quiet: boolean,
): Promise<RenderedFile> {
  const fileLifetime = await waitUntilNamedLifetime("render-file");
  try {
    // we are going to compose a single ExecutedFile from the array we have been passed
    const executedFile = await mergeExecutedFiles(
      project,
      options,
      files,
    );

    // set book title metadata
    executedFile.recipe.format = withBookTitleMetadata(
      executedFile.recipe.format,
      project.config,
    );

    // call book extension if applicable
    executedFile.recipe.format = onSingleFileBookPreRender(
      executedFile.recipe.format,
      project.config,
    );

    // do pandoc render
    const renderCompletion = await renderPandoc(executedFile, quiet);
    const renderedFormats: RenderedFormat[] = [];
    const renderedFile = await renderCompletion.complete(renderedFormats);

    // cleanup step for each executed file
    files.forEach((file) => {
      // Forward render cleanup options from parent format
      file.recipe.format.render[kKeepTex] =
        executedFile.recipe.format.render[kKeepTex];

      cleanupExecutedFile(
        file,
        join(project.dir, renderedFile.file),
      );
    });

    // call book extension if applicable
    onSingleFileBookPostRender(project, renderedFile);

    // return rendered file
    return renderedFile;
  } finally {
    fileLifetime.cleanup();
  }
}

async function mergeExecutedFiles(
  project: ProjectContext,
  options: RenderOptions,
  files: ExecutedFile[],
): Promise<ExecutedFile> {
  // base context on the first file (which has to be index.md in the root)
  const context = ld.cloneDeep(files[0].context) as RenderContext;

  // use global render options
  context.options = removePandocTo(options);

  // set output file based on book outputFile (or explicit config if provided)
  const outputStem = bookOutputStem(project.dir, project.config);
  context.format.pandoc[kOutputFile] = `${outputStem}.${
    context.format.render[kOutputExt]
  }`;

  // create output recipe (tweak output file)
  const recipe = await outputRecipe(context);

  // make output relative to the project dir (where the command will be run)
  if (isAbsolute(recipe.output)) {
    recipe.output = relative(project.dir, recipe.output);
    recipe.format.pandoc[kOutputFile] = recipe.output;
  }

  const renderItems = bookConfigRenderItems(project.config);

  // merge markdown, writing a metadata comment into each file
  const markdown = renderItems.reduce(
    (markdown: string, item: BookRenderItem) => {
      // item markdown
      let itemMarkdown = "";

      // get executed file for book item
      if (item.file) {
        const itemInputPath = join(project.dir, item.file);
        const file = files.find((file) =>
          file.context.target.source === itemInputPath
        );
        if (file) {
          const partitioned = partitionMarkdown(file.executeResult.markdown);

          // Will always provide the title markdown whether the title was provided by
          // front matter or by the first heading. Note that this will
          // prefer to use the title that appears in the front matter, and if
          // there is no front matter title it will promote the first heading to
          // level 1 heading
          const resolveTitleMarkdown = (partitioned: PartitionedMarkdown) => {
            // Creates a markdown title, dealing with attributes, if present
            const createMarkdownTitle = (text: string, attr?: PandocAttr) => {
              let attrStr = "";
              if (attr) {
                const idStr = attr.id !== "" ? `#${attr.id} ` : "";
                const clzStr = attr.classes.map((clz) => {
                  return `.${clz} `;
                }).join("");
                const keyValueStr = attr.keyvalue.map((kv) => {
                  const escapedValue = kv[1].replaceAll(/"/gm, '\\"');
                  return `${kv[0]}="${escapedValue}" `;
                }).join("");
                const attrContents = `${idStr}${clzStr}${keyValueStr}`.trim();
                attrStr = `{${attrContents}}`;
              }

              return `# ${text} ${attrStr}\n\n`;
            };

            let titleText;
            let titleAttr;
            if (partitioned.yaml) {
              const frontTitle = frontMatterTitle(partitioned.yaml);
              if (frontTitle) {
                titleText = frontTitle;
              } else {
                titleText = partitioned.headingText;
                titleAttr = partitioned.headingAttr;
              }
            } else {
              titleText = partitioned.headingText;
              titleAttr = partitioned.headingAttr;
            }

            if (titleText === undefined) {
              titleText = "";
            }
            return createMarkdownTitle(titleText, titleAttr);
          };

          // If there is front matter for this chapter, this will generate a code
          // cell that will be rendered a LUA filter (the code cell will provide the
          // path to the template that should be used as well as the front matter
          // to use when rendering)
          const resolveTitleBlockMarkdown = (yaml?: Metadata) => {
            if (yaml) {
              const titleBlockPath = resourcePath(
                "projects/book/pandoc/title-block.md",
              );

              const titleAttr = `template='${titleBlockPath}'`;
              const frontMatter = `---\n${
                stringify(yaml, { indent: 2 })
              }\n---\n`;

              const titleBlockMd = "```````{.quarto-title-block " +
                titleAttr + "}\n" +
                frontMatter +
                "\n```````\n\n";

              return titleBlockMd;
            } else {
              return "";
            }
          };

          // Compose the markdown for this chapter
          const titleMarkdown = resolveTitleMarkdown(partitioned);
          const titleBlockMarkdown = resolveTitleBlockMarkdown(
            partitioned.yaml,
          );
          const bodyMarkdown = partitioned.yaml?.title
            ? partitioned.srcMarkdownNoYaml
            : partitioned.markdown;

          itemMarkdown = bookItemMetadata(project, item, file) +
            titleMarkdown +
            titleBlockMarkdown +
            bodyMarkdown;
        } else {
          throw new Error(
            "Executed file not found for book item: " + item.file,
          );
        }
        // if there is no file then this must be a part
      } else if (
        item.type === kBookItemPart || item.type === kBookItemAppendix
      ) {
        itemMarkdown = bookPartMarkdown(project, item);
      }

      // if this is part divider, then surround it in a special div so we
      // can discard it in formats that don't support parts
      if (
        (item.type === kBookItemPart || item.type === kBookItemAppendix) &&
        itemMarkdown.length > 0
      ) {
        itemMarkdown = `\n\n::: {.quarto-book-part}\n${itemMarkdown}\n:::\n\n`;
      }

      // fallthrough
      return markdown + itemMarkdown;
    },
    "",
  );

  // merge supporting
  const supporting = files.reduce(
    (supporting: string[], file: ExecutedFile) => {
      return ld.uniq(
        supporting.concat(
          file.executeResult.supporting.map((f) => relative(project.dir, f)),
        ),
      );
    },
    [] as string[],
  );

  // merge filters
  const filters = ld.uniq(files.flatMap((file) => file.executeResult.filters));

  // merge engine dependencies
  const engineDependencies = files.reduce(
    (
      engineDependencies: Record<string, Array<unknown>>,
      file: ExecutedFile,
    ) => {
      const fileEngineDependencies = file.executeResult.engineDependencies;
      if (fileEngineDependencies) {
        for (const engineName of Object.keys(fileEngineDependencies)) {
          engineDependencies[engineName] =
            (engineDependencies[engineName] || []).concat(
              fileEngineDependencies[engineName],
            );
        }
      }
      return engineDependencies;
    },
    {} as Record<string, Array<unknown>>,
  );

  // merge preserves
  const preserve = files.reduce(
    (preserve: Record<string, string>, file: ExecutedFile) => {
      return {
        ...preserve,
        ...file.executeResult.preserve,
      };
    },
    {} as Record<string, string>,
  );

  // merge postProcess
  const postProcess = files.reduce(
    (postProcess: boolean, file: ExecutedFile) => {
      return postProcess || !!file.executeResult.postProcess;
    },
    false,
  );

  // merge resourceFiles
  const resourceFiles = ld.uniq(files.flatMap((file) => file.resourceFiles));

  return Promise.resolve({
    context,
    recipe,
    executeResult: {
      markdown,
      supporting,
      filters,
      engineDependencies,
      preserve,
      postProcess,
    },
    resourceFiles,
  });
}

export async function bookPostRender(
  context: ProjectContext,
  incremental: boolean,
  outputFiles: ProjectOutputFile[],
) {
  // get web output contained in the outputFiles passed to us
  const websiteFiles = websiteOutputFiles(outputFiles);
  if (websiteFiles.length > 0) {
    // fixup crossrefs and bibliography for web output
    await bookBibliographyPostRender(context, incremental, websiteFiles);
    await bookCrossrefsPostRender(context, websiteFiles);

    // website files are now already written on a per-file basis
    // websiteFiles.forEach((websiteFile) => {
    //   const doctype = websiteFile.doctype;
    //   const htmlOutput = (doctype ? doctype + "\n" : "") +
    //     websiteFile.doc.documentElement?.outerHTML!;
    //   Deno.writeTextFileSync(websiteFile.file, htmlOutput);
    // });

    // run standard website stuff (search, etc.)
    await websitePostRender(context, incremental, outputFiles);
  }

  // Process any post rendering
  const outputFormats: Record<string, Format> = {};
  outputFiles.forEach((file) => {
    if (file.format.pandoc.to) {
      outputFormats[file.format.pandoc.to] =
        outputFormats[file.format.pandoc.to] || file.format;
    }
  });
  for (const outputFormat of Object.values(outputFormats)) {
    const bookExt = outputFormat.extensions?.book as BookExtension;
    if (bookExt.bookPostRender) {
      await bookExt.bookPostRender(
        outputFormat,
        context,
        incremental,
        outputFiles,
      );
    }
  }
}

export async function bookIncrementalRenderAll(
  context: ProjectContext,
  options: RenderOptions,
  files: string[],
) {
  for (let i = 0; i < files.length; i++) {
    // get contexts (formats)
    const contexts = await renderContexts(
      { path: files[i] },
      options,
      false,
      context,
    );

    // do any of them have a single-file book extension?
    for (const context of Object.values(contexts)) {
      if (context.active && !isMultiFileBookFormat(context.format)) {
        return true;
      }
    }
  }
  // no single-file book extensions found
  return false;
}

function cleanupExecutedFile(
  file: ExecutedFile,
  finalOutput: string,
) {
  renderCleanup(
    file.context.target.input,
    finalOutput,
    file.recipe.format,
    file.executeResult.supporting,
    executionEngineKeepMd(file.context.target.input),
  );
}

function bookItemMetadata(
  project: ProjectContext,
  item: BookRenderItem,
  file?: ExecutedFile,
) {
  const resourceDir = file
    ? relative(project.dir, dirname(file.context.target.input))
    : undefined;
  const inlineMetadata = {
    resourceDir: resourceDir || ".",
  };
  const blockMetadata = {
    ...inlineMetadata,
    bookItemType: item.type,
    bookItemNumber: item.number ? item.number : null,
    bookItemFile: item.file,
    bookItemDepth: item.depth,
  };

  const inlineMetadataEncoded = base64Encode(JSON.stringify(inlineMetadata));
  const blockMetadataEncoded = base64Encode(JSON.stringify(blockMetadata));
  return `\n\n\`<!-- quarto-file-metadata: ${inlineMetadataEncoded} -->\`{=html}\n\n\`\`\`{=html}\n<!-- quarto-file-metadata: ${blockMetadataEncoded} -->\n\`\`\`\n\n`;
}

function bookPartMarkdown(project: ProjectContext, item: BookRenderItem) {
  const metadata = bookItemMetadata(project, item);
  return `${metadata}# ${item.text ? item.text : ""}\n\n`;
}

function withBookTitleMetadata(format: Format, config?: ProjectConfig): Format {
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
    setMetadata(kDateFormat);
    setMetadata(kAbstract);
    setMetadata(kDescription);
    setMetadata(kDoi);
  }
  return format;
}

function frontMatterTitle(yaml?: Metadata): string | undefined {
  if (yaml) {
    return yaml[kTitle] as string | undefined;
  } else {
    return undefined;
  }
}
