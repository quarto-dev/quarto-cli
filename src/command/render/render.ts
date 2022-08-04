/*
* render.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { ensureDirSync, existsSync } from "fs/mod.ts";

import { basename, dirname, isAbsolute, join, relative } from "path/mod.ts";

import { Document, parseHtml } from "../../core/deno-dom.ts";

import { mergeConfigs } from "../../core/config.ts";
import {
  formatResourcePath,
  pandocBinaryPath,
  resourcePath,
} from "../../core/resources.ts";
import { inputFilesDir } from "../../core/render.ts";
import { pathWithForwardSlashes } from "../../core/path.ts";

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
} from "./types.ts";
import { runPandoc } from "./pandoc.ts";
import { renderCleanup } from "./cleanup.ts";
import { projectOffset } from "../../project/project-shared.ts";

import { ExecutedFile, RenderedFile, RenderResult } from "./types.ts";
import { PandocIncludes } from "../../execute/types.ts";
import { Metadata } from "../../config/types.ts";
import { isHtmlFileOutput } from "../../config/format.ts";

import { isSelfContainedOutput } from "./render-info.ts";
import { execProcess } from "../../core/process.ts";
import {
  pop as popTiming,
  push as pushTiming,
  withTiming,
  withTimingAsync,
} from "../../core/timing.ts";
import { filesDirMediabagDir } from "./render-paths.ts";

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

  // pandoc options
  const pandocOptions: PandocOptions = {
    markdown: executeResult.markdown,
    source: context.target.source,
    output: recipe.output,
    mediabagDir,
    libDir: context.libDir,
    format,
    project: context.project,
    args: recipe.args,
    temp: context.options.services.temp,
    metadata: executeResult.metadata,
    extension: context.options.services.extension,
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
  );

  // Compute the path to the output file
  const outputFile = isAbsolute(pandocOptions.output)
    ? pandocOptions.output
    : join(dirname(pandocOptions.source), pandocOptions.output);

  // run generic postprocessors
  if (pandocResult.postprocessors) {
    for (const postprocessor of pandocResult.postprocessors) {
      await postprocessor(outputFile);
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
      await pandocIngestSelfContainedContent(outputFile);
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

  withTiming("render-cleanup", () =>
    renderCleanup(
      context.target.input,
      finalOutput!,
      format,
      selfContained! ? supporting : undefined,
      executionEngineKeepMd(context.target.input),
    ));

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
  popTiming();

  return {
    input: projectPath(context.target.source),
    markdown: executeResult.markdown,
    format,
    supporting: supporting
      ? supporting.filter(existsSync).map((file: string) =>
        context.project ? relative(context.project.dir, file) : file
      )
      : undefined,
    file: projectPath(finalOutput!),
    resourceFiles: {
      globs: pandocResult.resources,
      files: resourceFiles.concat(htmlPostProcessResult.resources),
    },
    selfContained: selfContained!,
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
        const result = await postprocessor(doc, inputMetadata, inputTraits);

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

export const pandocIngestSelfContainedContent = async (file: string) => {
  const filename = basename(file);
  const workingDir = dirname(file);

  // The template
  const template = formatResourcePath(
    "html",
    "pandoc-selfcontained/selfcontained.html",
  );

  // The raw html contents
  const contents = Deno.readTextFileSync(file);
  const input: string[] = [];
  input.push("````````{=html}");
  input.push(contents);
  input.push("````````");

  // Run pandoc to suck in dependencies
  const cmd = [pandocBinaryPath()];
  cmd.push("--to", "html");
  cmd.push("--from", "markdown");
  cmd.push("--template", template);
  cmd.push("--output", filename);
  cmd.push("--metadata", "title=placeholder");
  cmd.push("--self-contained");
  const result = await execProcess({
    cmd,
    stdout: "piped",
    cwd: workingDir,
  }, input.join("\n"));

  if (result.success) {
    return result.stdout;
  } else {
    throw new Error();
  }
};
