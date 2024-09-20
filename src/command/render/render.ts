/*
 * render.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { ensureDirSync, existsSync } from "fs/mod.ts";

import { dirname, isAbsolute, join, relative } from "../../deno_ral/path.ts";

import { Document, parseHtml } from "../../core/deno-dom.ts";

import { mergeConfigs } from "../../core/config.ts";
import { resourcePath } from "../../core/resources.ts";
import { inputFilesDir } from "../../core/render.ts";
import {
  normalizePath,
  pathWithForwardSlashes,
  safeExistsSync,
} from "../../core/path.ts";

import { FormatPandoc } from "../../config/types.ts";
import {
  executionEngine,
  executionEngineKeepMd,
} from "../../execute/engine.ts";

import {
  HtmlPostProcessor,
  HtmlPostProcessResult,
  PandocInputTraits,
  PandocOptions,
  PandocRenderCompletion,
  RenderedFormat,
} from "./types.ts";
import { runPandoc } from "./pandoc.ts";
import { renderCleanup } from "./cleanup.ts";
import { projectOffset } from "../../project/project-shared.ts";

import { ExecutedFile, RenderedFile, RenderResult } from "./types.ts";
import { PandocIncludes } from "../../execute/types.ts";
import { Metadata } from "../../config/types.ts";
import { isHtmlFileOutput } from "../../config/format.ts";

import { isSelfContainedOutput } from "./render-info.ts";
import {
  pop as popTiming,
  push as pushTiming,
  withTiming,
  withTimingAsync,
} from "../../core/timing.ts";
import { filesDirMediabagDir } from "./render-paths.ts";
import { replaceNotebookPlaceholders } from "../../core/jupyter/jupyter-embed.ts";
import {
  kIncludeAfterBody,
  kIncludeBeforeBody,
  kIncludeInHeader,
  kInlineIncludes,
  kResourcePath,
} from "../../config/constants.ts";
import { pandocIngestSelfContainedContent } from "../../core/pandoc/self-contained.ts";
import { existsSync1 } from "../../core/file.ts";
import { projectType } from "../../project/types/project-types.ts";

export async function renderPandoc(
  file: ExecutedFile,
  quiet: boolean,
): Promise<PandocRenderCompletion> {
  // alias options
  const { context, recipe, executeResult, resourceFiles } = file;

  // alias format
  const format = recipe.format;

  // merge any pandoc options provided by the computation
  if (executeResult.includes) {
    format.pandoc = mergePandocIncludes(
      format.pandoc || {},
      executeResult.includes,
    );
  }
  if (executeResult.pandoc) {
    format.pandoc = mergeConfigs(
      format.pandoc || {},
      executeResult.pandoc,
    );
  }

  // run the dependencies step if we didn't do it during execute
  if (executeResult.engineDependencies) {
    for (const engineName of Object.keys(executeResult.engineDependencies)) {
      const engine = executionEngine(engineName)!;
      const dependenciesResult = await engine.dependencies({
        target: context.target,
        format,
        output: recipe.output,
        resourceDir: resourcePath(),
        tempDir: context.options.services.temp.createDir(),
        projectDir: context.project?.dir,
        libDir: context.libDir,
        dependencies: executeResult.engineDependencies[engineName],
        quiet: context.options.flags?.quiet,
      });
      format.pandoc = mergePandocIncludes(
        format.pandoc,
        dependenciesResult.includes,
      );
    }
  }

  // the mediabag dir should be created here based on the context
  // (it could be in the _files dir). if its a single file book
  // though it can even be in a temp dir
  const mediabagDir = filesDirMediabagDir(context.target.source);
  ensureDirSync(join(dirname(context.target.source), mediabagDir));

  // Process any placeholder for notebooks that have been injected
  const notebookResult = await replaceNotebookPlaceholders(
    format.pandoc.to || "html",
    context,
    context.options.flags || {},
    executeResult.markdown,
    context.options.services,
  );

  const embedSupporting: string[] = [];
  if (notebookResult.supporting.length) {
    embedSupporting.push(...notebookResult.supporting);
  }

  // Map notebook includes to pandoc includes
  const pandocIncludes: PandocIncludes = {
    [kIncludeAfterBody]: notebookResult.includes?.afterBody
      ? [notebookResult.includes?.afterBody]
      : undefined,
    [kIncludeInHeader]: notebookResult.includes?.inHeader
      ? [notebookResult.includes?.inHeader]
      : undefined,
  };

  // Inject dependencies
  format.pandoc = mergePandocIncludes(
    format.pandoc,
    pandocIncludes,
  );

  // resolve markdown. for [  ] output type we collect up
  // the includes so they can be proccessed by Lua
  let markdownInput = notebookResult.markdown
    ? notebookResult.markdown
    : executeResult.markdown;
  if (format.render[kInlineIncludes]) {
    const collectIncludes = (
      location:
        | "include-in-header"
        | "include-before-body"
        | "include-after-body",
    ) => {
      const includes = format.pandoc[location];
      if (includes) {
        const append = location === "include-after-body";
        for (const include of includes) {
          const includeMd = Deno.readTextFileSync(include);
          if (append) {
            markdownInput = `${markdownInput}\n\n${includeMd}`;
          } else {
            markdownInput = `${includeMd}\n\n${markdownInput}`;
          }
        }
        delete format.pandoc[location];
      }
    };
    collectIncludes(kIncludeInHeader);
    collectIncludes(kIncludeBeforeBody);
    collectIncludes(kIncludeAfterBody);
  }

  // pandoc options
  const pandocOptions: PandocOptions = {
    markdown: markdownInput,
    source: context.target.source,
    output: recipe.output,
    keepYaml: recipe.keepYaml,
    mediabagDir,
    libDir: context.libDir,
    format,
    executionEngine: executeResult.engine,
    project: context.project,
    args: recipe.args,
    services: context.options.services,
    metadata: executeResult.metadata,
    quiet,
    flags: context.options.flags,
  };

  // add offset if we are in a project
  if (context.project) {
    pandocOptions.offset = projectOffset(context.project, context.target.input);
  }

  // run pandoc conversion (exit on failure)
  const pandocResult = await runPandoc(pandocOptions, executeResult.filters);
  if (!pandocResult) {
    return Promise.reject();
  }

  return {
    complete: async (renderedFormats: RenderedFormat[], cleanup?: boolean) => {
      pushTiming("render-postprocessor");
      // run optional post-processor (e.g. to restore html-preserve regions)
      if (executeResult.postProcess) {
        await withTimingAsync("engine-postprocess", async () => {
          return await context.engine.postprocess({
            engine: context.engine,
            target: context.target,
            format,
            output: recipe.output,
            tempDir: context.options.services.temp.createDir(),
            projectDir: context.project?.dir,
            preserve: executeResult.preserve,
            quiet: context.options.flags?.quiet,
          });
        });
      }

      // run html postprocessors if we have them
      const canHtmlPostProcess = isHtmlFileOutput(format.pandoc);
      if (!canHtmlPostProcess && pandocResult.htmlPostprocessors.length > 0) {
        const postProcessorNames = pandocResult.htmlPostprocessors.map((p) =>
          p.name
        ).join(", ");
        const msg =
          `Attempt to HTML post process non HTML output using: ${postProcessorNames}`;
        throw new Error(msg);
      }
      const htmlPostProcessors = canHtmlPostProcess
        ? pandocResult.htmlPostprocessors
        : [];
      const htmlFinalizers = canHtmlPostProcess
        ? pandocResult.htmlFinalizers || []
        : [];

      const htmlPostProcessResult = await runHtmlPostprocessors(
        pandocResult.inputMetadata,
        pandocResult.inputTraits,
        pandocOptions,
        htmlPostProcessors,
        htmlFinalizers,
        renderedFormats,
        quiet,
      );

      // Compute the path to the output file
      const outputFile = isAbsolute(pandocOptions.output)
        ? pandocOptions.output
        : join(dirname(pandocOptions.source), pandocOptions.output);

      // run generic postprocessors
      const postProcessSupporting: string[] = [];
      const postProcessResources: string[] = [];
      if (pandocResult.postprocessors) {
        for (const postprocessor of pandocResult.postprocessors) {
          const result = await postprocessor(outputFile);
          if (result && result.supporting) {
            postProcessSupporting.push(...result.supporting);
          }
          if (result && result.resources) {
            postProcessResources.push(...result.resources);
          }
        }
      }

      let finalOutput: string;
      let selfContained: boolean;

      await withTimingAsync("postprocess-selfcontained", async () => {
        // ensure flags
        const flags = context.options.flags || {};

        // call complete handler (might e.g. run latexmk to complete the render)
        finalOutput = await recipe.complete(pandocOptions) || recipe.output;

        // determine whether this is self-contained output
        selfContained = isSelfContainedOutput(
          flags,
          format,
          finalOutput,
        );

        // If this is self-contained, run pandoc to 'suck in' the dependencies
        // which may have been added in the post processor
        if (selfContained && isHtmlFileOutput(format.pandoc)) {
          await pandocIngestSelfContainedContent(
            outputFile,
            format.pandoc[kResourcePath],
          );
        }
      });

      // compute the relative path to the files dir
      let filesDir: string | undefined = inputFilesDir(context.target.source);
      // undefine it if it doesn't exist
      filesDir = existsSync(join(dirname(context.target.source), filesDir))
        ? filesDir
        : undefined;

      // add any injected libs to supporting
      let supporting = filesDir ? executeResult.supporting : undefined;
      if (filesDir && isHtmlFileOutput(format.pandoc)) {
        const filesDirAbsolute = join(dirname(context.target.source), filesDir);
        if (
          existsSync(filesDirAbsolute) &&
          (!supporting || !supporting.includes(filesDirAbsolute))
        ) {
          const filesLibs = join(
            dirname(context.target.source),
            context.libDir,
          );
          if (
            existsSync(filesLibs) &&
            (!supporting || !supporting.includes(filesLibs))
          ) {
            supporting = supporting || [];
            supporting.push(filesLibs);
          }
        }
      }
      if (
        htmlPostProcessResult.supporting &&
        htmlPostProcessResult.supporting.length > 0
      ) {
        supporting = supporting || [];
        supporting.push(...htmlPostProcessResult.supporting);
      }
      if (embedSupporting && embedSupporting.length > 0) {
        supporting = supporting || [];
        supporting.push(...embedSupporting);
      }
      if (postProcessSupporting && postProcessSupporting.length > 0) {
        supporting = supporting || [];
        supporting.push(...postProcessSupporting);
      }

      // Deal with self contained by passing them to be cleaned up
      // but if this is a project, instead make sure that we're not
      // including the lib dir
      let cleanupSelfContained: string[] | undefined = undefined;
      if (selfContained! && supporting) {
        cleanupSelfContained = [...supporting];
        if (context.project!) {
          const libDir = context.project?.config?.project["lib-dir"];
          if (libDir) {
            const absLibDir = join(context.project.dir, libDir);
            cleanupSelfContained = cleanupSelfContained.filter((file) =>
              !file.startsWith(absLibDir)
            );
          }
        }
      }

      if (cleanup !== false) {
        withTiming("render-cleanup", () =>
          renderCleanup(
            context.target.input,
            finalOutput!,
            format,
            cleanupSelfContained,
            executionEngineKeepMd(context),
          ));
      }

      // if there is a project context then return paths relative to the project
      const projectPath = (path: string) => {
        if (context.project) {
          if (isAbsolute(path)) {
            return relative(
              normalizePath(context.project.dir),
              normalizePath(path),
            );
          } else {
            return relative(
              normalizePath(context.project.dir),
              normalizePath(join(dirname(context.target.source), path)),
            );
          }
        } else {
          return path;
        }
      };
      popTiming();

      // Forward along any specific resources
      const files = resourceFiles.concat(htmlPostProcessResult.resources)
        .concat(postProcessResources);

      const result: RenderedFile = {
        isTransient: recipe.isOutputTransient,
        input: projectPath(context.target.source),
        markdown: executeResult.markdown,
        format,
        supporting: supporting
          ? supporting.filter(existsSync1).map((file: string) =>
            context.project ? relative(context.project.dir, file) : file
          )
          : undefined,
        file: recipe.isOutputTransient
          ? finalOutput!
          : projectPath(finalOutput!),
        resourceFiles: {
          globs: pandocResult.resources,
          files,
        },
        selfContained: selfContained!,
      };
      return result;
    },
  };
}

export function renderResultFinalOutput(
  renderResults: RenderResult,
  relativeToInputDir?: string,
) {
  // final output defaults to the first output of the first result
  // that isn't a supplemental render file (a file that wasn't explicitly
  // rendered but that was a side effect of rendering some other file)
  let result = renderResults.files.find((file) => {
    return !file.supplemental;
  });
  if (!result) {
    return undefined;
  }

  // see if we can find an index.html instead
  for (const fileResult of renderResults.files) {
    if (fileResult.file === "index.html" && !fileResult.supplemental) {
      result = fileResult;
      break;
    }
  }

  // Allow project types to provide this
  if (renderResults.context) {
    const projType = projectType(renderResults.context.config?.project.type);
    if (projType && projType.renderResultFinalOutput) {
      const projectResult = projType.renderResultFinalOutput(
        renderResults,
        relativeToInputDir,
      );
      if (projectResult) {
        result = projectResult;
      }
    }
  }

  // determine final output
  let finalInput = result.input;
  let finalOutput = result.file;

  if (renderResults.baseDir) {
    finalInput = join(renderResults.baseDir, finalInput);
    if (renderResults.outputDir) {
      finalOutput = join(
        renderResults.baseDir,
        renderResults.outputDir,
        finalOutput,
      );
    } else {
      finalOutput = join(renderResults.baseDir, finalOutput);
    }
  } else {
    finalOutput = join(dirname(finalInput), finalOutput);
  }

  // if the final output doesn't exist then we must have been targetin stdout,
  // so return undefined
  if (!safeExistsSync(finalOutput)) {
    return undefined;
  }

  // return a path relative to the input file
  if (relativeToInputDir) {
    const inputRealPath = normalizePath(relativeToInputDir);
    const outputRealPath = normalizePath(finalOutput);
    return relative(inputRealPath, outputRealPath);
  } else {
    return finalOutput;
  }
}

export function renderResultUrlPath(
  renderResult: RenderResult,
) {
  if (renderResult.baseDir && renderResult.outputDir) {
    const finalOutput = renderResultFinalOutput(
      renderResult,
    );
    if (finalOutput) {
      const targetPath = pathWithForwardSlashes(relative(
        join(renderResult.baseDir, renderResult.outputDir),
        finalOutput,
      ));
      return targetPath;
    }
  }
  return undefined;
}

function mergePandocIncludes(
  format: FormatPandoc,
  pandocIncludes: PandocIncludes,
) {
  return mergeConfigs(format, pandocIncludes);
}

async function runHtmlPostprocessors(
  inputMetadata: Metadata,
  inputTraits: PandocInputTraits,
  options: PandocOptions,
  htmlPostprocessors: Array<HtmlPostProcessor>,
  htmlFinalizers: Array<(doc: Document) => Promise<void>>,
  renderedFormats: RenderedFormat[],
  quiet?: boolean,
): Promise<HtmlPostProcessResult> {
  const postProcessResult: HtmlPostProcessResult = {
    resources: [],
    supporting: [],
  };
  if (htmlPostprocessors.length > 0 || htmlFinalizers.length > 0) {
    await withTimingAsync("htmlPostprocessors", async () => {
      const outputFile = isAbsolute(options.output)
        ? options.output
        : join(dirname(options.source), options.output);
      const htmlInput = Deno.readTextFileSync(outputFile);
      const doctypeMatch = htmlInput.match(/^<!DOCTYPE.*?>/);
      const doc = await parseHtml(htmlInput);
      for (let i = 0; i < htmlPostprocessors.length; i++) {
        const postprocessor = htmlPostprocessors[i];
        const result = await postprocessor(
          doc,
          {
            inputMetadata,
            inputTraits,
            renderedFormats,
            quiet,
          },
        );

        postProcessResult.resources.push(...result.resources);
        postProcessResult.supporting.push(...result.supporting);
      }

      // After the post processing is complete, allow any finalizers
      // an opportunity at the document
      for (let i = 0; i < htmlFinalizers.length; i++) {
        const finalizer = htmlFinalizers[i];
        await finalizer(doc);
      }

      const htmlOutput = (doctypeMatch ? doctypeMatch[0] + "\n" : "") +
        doc.documentElement?.outerHTML!;
      Deno.writeTextFileSync(outputFile, htmlOutput);
    });
  }
  return postProcessResult;
}
