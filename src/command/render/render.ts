/*
* render.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { existsSync } from "fs/mod.ts";

import { basename, dirname, isAbsolute, join, relative } from "path/mod.ts";

import * as ld from "../../core/lodash.ts";

import { Document, DOMParser, initDenoDom } from "../../core/deno-dom.ts";

import { error, info } from "log/mod.ts";

import { mergeConfigs } from "../../core/config.ts";
import { resourcePath } from "../../core/resources.ts";
import { figuresDir, inputFilesDir } from "../../core/render.ts";
import {
  pathWithForwardSlashes,
  removeIfEmptyDir,
  removeIfExists,
} from "../../core/path.ts";
import {
  kExecuteEnabled,
  kFreeze,
  kIncludeInHeader,
  kKeepMd,
  kLang,
} from "../../config/constants.ts";
import { Format, FormatPandoc } from "../../config/types.ts";
import {
  executionEngine,
  executionEngineKeepMd,
  fileExecutionEngineAndTarget,
} from "../../execute/engine.ts";

import { renderContexts } from "./render-contexts.ts";

import {
  HtmlPostProcessResult,
  PandocOptions,
  RenderFile,
  RenderFlags,
} from "./types.ts";
import { resolveDependencies, runPandoc } from "./pandoc.ts";
import { resolveParams } from "./flags.ts";
import { renderCleanup } from "./cleanup.ts";
import { outputRecipe } from "./output.ts";
import { kProjectLibDir, ProjectContext } from "../../project/types.ts";
import { projectOffset } from "../../project/project-shared.ts";

import {
  copyFromProjectFreezer,
  copyToProjectFreezer,
  defrostExecuteResult,
  freezeExecuteResult,
  freezerFigsDir,
  freezerFreezeFile,
  kProjectFreezeDir,
  removeFreezeResults,
} from "./freeze.ts";
import { ojsExecuteResult } from "../../execute/ojs/compile.ts";
import { annotateOjsLineNumbers } from "../../execute/ojs/annotate-source.ts";
import {
  ExecutedFile,
  PandocRenderer,
  RenderContext,
  RenderedFile,
  RenderExecuteOptions,
  RenderFilesResult,
  RenderOptions,
  RenderResult,
} from "./types.ts";
import {
  ExecuteResult,
  MappedExecuteResult,
  PandocIncludes,
} from "../../execute/types.ts";
import { Metadata } from "../../config/types.ts";
import { isHtmlCompatible, isHtmlFileOutput } from "../../config/format.ts";

import {
  validateDocument,
  validateDocumentFromSource,
} from "../../core/schema/validate-document.ts";

import { renderProgress } from "./render-shared.ts";
import { createTempContext } from "../../core/temp.ts";
import { YAMLValidationError } from "../../core/yaml.ts";

import { handleLanguageCells, languages } from "../../core/handlers/base.ts";

// installs language handlers
import "../../core/handlers/handlers.ts";
import { LanguageCellHandlerOptions } from "../../core/handlers/types.ts";
import { asMappedString } from "../../core/lib/mapped-text.ts";
import { mappedDiff } from "../../core/mapped-text.ts";
import { setDateLocale } from "../../core/date.ts";
import { isSelfContainedOutput } from "./render-info.ts";

export async function renderFiles(
  files: RenderFile[],
  options: RenderOptions,
  alwaysExecuteFiles?: string[],
  pandocRenderer?: PandocRenderer,
  project?: ProjectContext,
): Promise<RenderFilesResult> {
  // provide default renderer
  pandocRenderer = pandocRenderer || defaultPandocRenderer(options, project);

  // create temp context
  const tempContext = createTempContext();

  try {
    // make a copy of options so we don't mutate caller context
    options = ld.cloneDeep(options);

    // see if we should be using file-by-file progress
    const progress = options.progress ||
      (project && (files.length > 1) && !options.flags?.quiet);

    // quiet pandoc output if we are doing file by file progress
    const pandocQuiet = !!progress;

    // calculate num width
    const numWidth = String(files.length).length;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      if (progress) {
        renderProgress(
          `[${String(i + 1).padStart(numWidth)}/${files.length}] ${
            relative(project!.dir, file.path)
          }`,
        );
      }

      // get contexts
      let contexts: Record<string, RenderContext> | undefined;
      try {
        contexts = await renderContexts(
          file,
          options,
          true,
          project,
        );
      } catch (e) {
        // bad YAML can cause failure before validation. We
        // reconstruct the context as best we can and try to validate.
        // note that this ignores "validate-yaml: false"
        const { engine, target } = await fileExecutionEngineAndTarget(
          file.path,
          options.flags?.quiet,
        );
        const validationResult = await validateDocumentFromSource(
          target.markdown,
          engine.name,
          error,
          file.path,
        );
        if (validationResult.length) {
          throw new RenderInvalidYAMLError();
        } else {
          // rethrow if no validation error happened.
          throw e;
        }
      }

      for (const format of Object.keys(contexts)) {
        const context = contexts[format];

        // Set the date locale for this render
        // Used for date formatting
        await setDateLocale(context.format.metadata[kLang] as string);

        // one time denoDom init for html compatible formats
        if (isHtmlCompatible(context.format)) {
          await initDenoDom();
        }

        // get output recipe
        const recipe = await outputRecipe(context);

        // determine execute options
        const executeOptions = mergeConfigs(
          {
            alwaysExecute: alwaysExecuteFiles?.includes(file.path),
          },
          pandocRenderer.onBeforeExecute(recipe.format),
        );

        const validate = context.format.metadata?.["validate-yaml"];
        if (validate !== false) {
          const validationResult = await validateDocument(context);
          if (validationResult.length) {
            throw new RenderInvalidYAMLError();
          }
        }

        // FIXME it should be possible to infer this directly now
        // based on the information in the mapped strings.
        //
        // collect line numbers to facilitate runtime error reporting
        const { ojsBlockLineNumbers } = annotateOjsLineNumbers(context);

        // execute
        const baseExecuteResult = await renderExecute(
          context,
          recipe.output,
          executeOptions,
        );

        // recover source map from diff and create a mappedExecuteResult
        // for markdown processing pre-pandoc with mapped strings
        const source = Deno.readTextFileSync(context.target.source);
        const mappedMarkdown = mappedDiff(
          asMappedString(source),
          baseExecuteResult.markdown,
        );

        const resourceFiles: string[] = [];
        if (baseExecuteResult.resourceFiles) {
          resourceFiles.push(...baseExecuteResult.resourceFiles);
        }

        const mappedExecuteResult: MappedExecuteResult = {
          ...baseExecuteResult,
          markdown: mappedMarkdown,
        };

        const languageCellHandlerOptions: LanguageCellHandlerOptions = {
          temp: tempContext,
          name: "",
          format: recipe.format,
          markdown: mappedMarkdown,
          source: context.target.source,
          libDir: context.libDir,
          project: context.project,
        };

        // handle language cells
        const { markdown, results } = await handleLanguageCells(
          mappedExecuteResult,
          languageCellHandlerOptions,
        );
        // merge cell language results
        mappedExecuteResult.markdown = markdown;

        if (results) {
          if (mappedExecuteResult.includes) {
            mappedExecuteResult.includes = mergeConfigs(
              mappedExecuteResult.includes,
              results.includes,
            );
          } else {
            mappedExecuteResult.includes = results.includes;
          }
          const extras = resolveDependencies(
            results.extras,
            dirname(context.target.source),
            context.libDir,
            tempContext,
          );
          if (extras[kIncludeInHeader]) {
            mappedExecuteResult.includes[kIncludeInHeader] = [
              ...(mappedExecuteResult.includes[kIncludeInHeader] || []),
              ...(extras[kIncludeInHeader] || []),
            ];
          }
        }

        // process ojs
        const { executeResult, resourceFiles: ojsResourceFiles } =
          await ojsExecuteResult(
            context,
            mappedExecuteResult,
            ojsBlockLineNumbers,
          );
        resourceFiles.push(...ojsResourceFiles);

        // keep md if requested
        const keepMd = executionEngineKeepMd(context.target.input);
        if (keepMd && context.format.execute[kKeepMd]) {
          Deno.writeTextFileSync(keepMd, executeResult.markdown.value);
        }

        // now get "unmapped" execute result back to send to pandoc
        const unmappedExecuteResult: ExecuteResult = {
          ...executeResult,
          markdown: executeResult.markdown.value,
        };

        // callback
        await pandocRenderer.onRender(format, {
          context,
          recipe,
          executeResult: unmappedExecuteResult,
          resourceFiles,
        }, pandocQuiet);
      }
    }

    if (progress) {
      info("");
    }

    return await pandocRenderer.onComplete(false, options.flags?.quiet);
  } catch (error) {
    return {
      files: (await pandocRenderer.onComplete(true)).files,
      error: error || new Error(),
    };
  } finally {
    tempContext.cleanup();
  }
}

export async function renderExecute(
  context: RenderContext,
  output: string,
  options: RenderExecuteOptions,
): Promise<ExecuteResult> {
  // alias options
  const { resolveDependencies = true, alwaysExecute = false } = options;

  // alias flags
  const flags = context.options.flags || {};

  // compute filesDir
  const filesDir = inputFilesDir(context.target.source);

  // compute project relative files dir (if we are in a project)
  let projRelativeFilesDir: string | undefined;
  if (context.project) {
    const inputDir = relative(
      context.project.dir,
      dirname(context.target.source),
    );
    projRelativeFilesDir = join(inputDir, filesDir);
  }

  // are we eligible to freeze?
  const canFreeze = context.engine.canFreeze &&
    (context.format.execute[kExecuteEnabled] !== false);

  // use previous frozen results if they are available
  if (context.project && !alwaysExecute) {
    // check if we are using the freezer

    const thaw = canFreeze &&
      (context.format.execute[kFreeze] ||
        (context.options.useFreezer ? "auto" : false));

    if (thaw) {
      // copy from project freezer
      const hidden = context.format.execute[kFreeze] === false;
      copyFromProjectFreezer(
        context.project,
        projRelativeFilesDir!,
        hidden,
      );

      const thawedResult = defrostExecuteResult(
        context.target.source,
        output,
        context.options.temp,
        thaw === true,
      );
      if (thawedResult) {
        // copy the site_libs dir from the freezer
        const libDir = context.project?.config?.project[kProjectLibDir];
        if (libDir) {
          copyFromProjectFreezer(context.project, libDir, hidden);
        }

        // remove the results dir
        removeFreezeResults(join(context.project.dir, projRelativeFilesDir!));

        // notify engine that we skipped execute
        if (context.engine.executeTargetSkipped) {
          context.engine.executeTargetSkipped(context.target, context.format);
        }

        // return results
        return thawedResult;
      }
    }
  }

  // calculate figsDir
  const figsDir = join(filesDir, figuresDir(context.format.pandoc.to));

  // execute computations
  const executeResult = await context.engine.execute({
    target: context.target,
    resourceDir: resourcePath(),
    tempDir: context.options.temp.createDir(),
    dependencies: resolveDependencies,
    libDir: context.libDir,
    format: context.format,
    cwd: flags.executeDir,
    params: resolveParams(flags.params, flags.paramsFile),
    quiet: flags.quiet,
    handledLanguages: languages(),
  });

  // write the freeze file if we are in a project
  if (context.project && canFreeze) {
    // write the freezer file
    const freezeFile = freezeExecuteResult(
      context.target.source,
      output,
      executeResult,
    );

    // always copy to the hidden freezer
    copyToProjectFreezer(context.project, projRelativeFilesDir!, true, true);

    // copy to the _freeze dir if explicit _freeze is requested
    if (context.format.execute[kFreeze] !== false) {
      copyToProjectFreezer(context.project, projRelativeFilesDir!, false, true);
    } else {
      // otherwise cleanup the _freeze subdir b/c we aren't explicitly freezing anymore

      // figs dir for this target format
      const freezeFigsDir = freezerFigsDir(
        context.project,
        projRelativeFilesDir!,
        basename(figsDir),
      );
      removeIfExists(freezeFigsDir);

      // freezer file
      const projRelativeFreezeFile = relative(context.project.dir, freezeFile);
      const freezerFile = freezerFreezeFile(
        context.project,
        projRelativeFreezeFile,
      );
      removeIfExists(freezerFile);

      // remove empty directories
      removeIfEmptyDir(dirname(freezerFile));
      removeIfEmptyDir(dirname(freezeFigsDir));
      removeIfEmptyDir(join(context.project.dir, kProjectFreezeDir));
    }

    // remove the freeze results file (now that it's safely in the freezer)
    removeFreezeResults(join(context.project.dir, projRelativeFilesDir!));
  }

  // return result
  return executeResult;
}

export async function renderPandoc(
  file: ExecutedFile,
  quiet: boolean,
): Promise<RenderedFile> {
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
        tempDir: context.options.temp.createDir(),
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

  // pandoc options
  const pandocOptions: PandocOptions = {
    markdown: executeResult.markdown,
    source: context.target.source,
    output: recipe.output,
    libDir: context.libDir,
    format,
    project: context.project,
    args: recipe.args,
    temp: context.options.temp,
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

  // run optional post-processor (e.g. to restore html-preserve regions)
  if (executeResult.postProcess) {
    await context.engine.postprocess({
      engine: context.engine,
      target: context.target,
      format,
      output: recipe.output,
      tempDir: context.options.temp.createDir(),
      preserve: executeResult.preserve,
      quiet: context.options.flags?.quiet,
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
    pandocOptions,
    htmlPostProcessors,
    htmlFinalizers,
  );

  // run generic postprocessors
  if (pandocResult.postprocessors) {
    const outputFile = isAbsolute(pandocOptions.output)
      ? pandocOptions.output
      : join(dirname(pandocOptions.source), pandocOptions.output);
    for (const postprocessor of pandocResult.postprocessors) {
      await postprocessor(outputFile);
    }
  }

  // ensure flags
  const flags = context.options.flags || {};

  // call complete handler (might e.g. run latexmk to complete the render)
  const finalOutput = await recipe.complete(pandocOptions) || recipe.output;

  // determine whether this is self-contained output
  const selfContained = isSelfContainedOutput(
    flags,
    format,
    finalOutput,
  );

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
      const filesLibs = join(dirname(context.target.source), context.libDir);
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

  renderCleanup(
    context.target.input,
    finalOutput,
    format,
    selfContained ? supporting : undefined,
    executionEngineKeepMd(context.target.input),
  );

  // if there is a project context then return paths relative to the project
  const projectPath = (path: string) => {
    if (context.project) {
      if (isAbsolute(path)) {
        return relative(
          Deno.realPathSync(context.project.dir),
          Deno.realPathSync(path),
        );
      } else {
        return relative(
          Deno.realPathSync(context.project.dir),
          Deno.realPathSync(join(dirname(context.target.source), path)),
        );
      }
    } else {
      return path;
    }
  };

  return {
    input: projectPath(context.target.source),
    markdown: executeResult.markdown,
    format,
    supporting: supporting
      ? supporting.filter(existsSync).map((file: string) =>
        context.project ? relative(context.project.dir, file) : file
      )
      : undefined,
    file: projectPath(finalOutput),
    resourceFiles: {
      globs: pandocResult.resources,
      files: resourceFiles.concat(htmlPostProcessResult.resources),
    },
    selfContained: selfContained,
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
  if (!existsSync(finalOutput)) {
    return undefined;
  }

  // return a path relative to the input file
  if (relativeToInputDir) {
    const inputRealPath = Deno.realPathSync(relativeToInputDir);
    const outputRealPath = Deno.realPathSync(finalOutput);
    return relative(inputRealPath, outputRealPath);
  } else {
    return finalOutput;
  }
}

export function renderResultUrlPath(renderResult: RenderResult) {
  if (renderResult.baseDir && renderResult.outputDir) {
    const finalOutput = renderResultFinalOutput(renderResult);
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

// default pandoc renderer immediately renders each execute result
function defaultPandocRenderer(
  _options: RenderOptions,
  _project?: ProjectContext,
): PandocRenderer {
  const renderedFiles: RenderedFile[] = [];

  return {
    onBeforeExecute: (_format: Format) => ({}),

    onRender: async (
      _format: string,
      executedFile: ExecutedFile,
      quiet: boolean,
    ) => {
      renderedFiles.push(await renderPandoc(executedFile, quiet));
    },
    onComplete: async () => {
      return {
        files: await Promise.resolve(renderedFiles),
      };
    },
  };
}

function mergePandocIncludes(
  format: FormatPandoc,
  pandocIncludes: PandocIncludes,
) {
  return mergeConfigs(format, pandocIncludes);
}

async function runHtmlPostprocessors(
  inputMetadata: Metadata,
  options: PandocOptions,
  htmlPostprocessors: Array<
    (doc: Document, inputMetadata: Metadata) => Promise<HtmlPostProcessResult>
  >,
  htmlFinalizers: Array<(doc: Document) => Promise<void>>,
): Promise<HtmlPostProcessResult> {
  const postProcessResult: HtmlPostProcessResult = {
    resources: [],
    supporting: [],
  };
  if (htmlPostprocessors.length > 0 || htmlFinalizers.length > 0) {
    const outputFile = isAbsolute(options.output)
      ? options.output
      : join(dirname(options.source), options.output);
    const htmlInput = Deno.readTextFileSync(outputFile);
    const doctypeMatch = htmlInput.match(/^<!DOCTYPE.*?>/);
    const doc = new DOMParser().parseFromString(htmlInput, "text/html")!;
    for (let i = 0; i < htmlPostprocessors.length; i++) {
      const postprocessor = htmlPostprocessors[i];
      const result = await postprocessor(doc, inputMetadata);

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
  }
  return postProcessResult;
}

class RenderInvalidYAMLError extends YAMLValidationError {
  constructor() {
    super("Render failed due to invalid YAML.");
  }
}
