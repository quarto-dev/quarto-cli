/*
 * render-shared.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { dirname } from "../../deno_ral/path.ts";

import { info } from "../../deno_ral/log.ts";
import * as colors from "fmt/colors";

import {
  projectContext,
  projectContextForDirectory,
} from "../../project/project-context.ts";

import { renderProject } from "./project.ts";
import { renderFiles } from "./render-files.ts";
import { resourceFilesFromRenderedFile } from "./resources.ts";
import { RenderFlags, RenderOptions, RenderResult } from "./types.ts";

import {
  isProjectInputFile,
  projectExcludeDirs,
} from "../../project/project-shared.ts";

import {
  initState,
  setInitializer,
} from "../../core/lib/yaml-validation/state.ts";
import { initYamlIntelligenceResourcesFromFilesystem } from "../../core/schema/utils.ts";
import { kTextPlain } from "../../core/mime.ts";
import { normalizePath } from "../../core/path.ts";
import { notebookContext } from "../../render/notebook/notebook-context.ts";
import { singleFileProjectContext } from "../../project/types/single-file/single-file.ts";
import { ProjectContext } from "../../project/types.ts";

export async function render(
  path: string,
  options: RenderOptions,
  pContext?: ProjectContext,
): Promise<RenderResult> {
  // one time initialization of yaml validators
  setInitializer(initYamlIntelligenceResourcesFromFilesystem);
  await initState();

  const nbContext = pContext?.notebookContext || notebookContext();

  // determine target context/files
  // let context = await projectContext(path, nbContext, options);
  let context = pContext || (await projectContext(path, nbContext, options)) ||
    (await singleFileProjectContext(path, nbContext, options));

  // Create a synthetic project when --output-dir is used without a project file
  // This creates a temporary .quarto directory to manage the render, which must
  // be fully cleaned up afterward to avoid leaving debris (see #9745)
  if (!context && options.flags?.outputDir) {
    context = await projectContextForDirectory(path, nbContext, options);

    // forceClean signals this is a synthetic project that needs full cleanup
    // including removing the .quarto scratch directory after rendering (#13625)
    options.forceClean = options.flags.clean !== false;
  }

  // set env var if requested
  if (context && options.setProjectDir) {
    // FIXME we can't set environment variables like this with asyncs flying around
    Deno.env.set("QUARTO_PROJECT_DIR", context.dir);
  }

  if (Deno.statSync(path).isDirectory) {
    // if the path is a sub-directory of the project, then create
    // a files list that is only those files in the subdirectory
    let files: string[] | undefined;
    if (context) {
      const renderDir = normalizePath(path);
      const projectDir = normalizePath(context.dir);
      if (renderDir !== projectDir) {
        files = context.files.input.filter((file) =>
          file.startsWith(renderDir)
        );
      }
      return renderProject(
        context,
        options,
        files,
      );
    } else {
      throw new Error(
        "The specified directory ('" + path +
          "') is not a Quarto project.\n(If you have not specified a path, quarto will attempt to render the entire current directory as a project.)",
      );
    }
  } else if (context?.config) {
    // if there is a project file then treat this as a project render
    // if the passed file is in the render list
    if (isProjectInputFile(path, context)) {
      return renderProject(context, options, [path]);
    }
  }

  // validate that we didn't get any project-only options
  validateDocumentRenderFlags(options.flags);

  // otherwise it's just a file render
  const result = await renderFiles(
    [{ path }],
    options,
    nbContext,
    undefined,
    undefined,
    context,
  );

  // get partitioned markdown if we had result files
  const { engine } = await context.fileExecutionEngineAndTarget(
    path,
  );
  const partitioned = (engine && result.files.length > 0)
    ? await engine.partitionedMarkdown(path)
    : undefined;

  const excludeDirs = context ? projectExcludeDirs(context) : [];

  // compute render result
  const renderResult = {
    context,
    files: await Promise.all(result.files.map(async (file) => {
      const resourceFiles = await resourceFilesFromRenderedFile(
        dirname(path),
        excludeDirs,
        file,
        partitioned,
      );
      return {
        input: file.input,
        markdown: file.markdown,
        format: file.format,
        file: file.file,
        supporting: file.supporting,
        resourceFiles,
      };
    })),
    error: result.error,
    baseDir: normalizePath(dirname(path)),
  };

  if (!renderResult.error && engine?.postRender) {
    for (const file of renderResult.files) {
      await engine.postRender(file);
    }
  }

  // return
  return renderResult;
}

export function printWatchingForChangesMessage() {
  info("Watching files for changes", { format: colors.green });
}

export function previewUnableToRenderResponse() {
  return new Response("not found", {
    status: 404,
    headers: {
      "Content-Type": kTextPlain,
    },
  });
}

// QUARTO_RENDER_TOKEN
let quartoRenderToken: string | null | undefined;
export function renderToken(): string | null {
  const kQuartoRenderToken = "QUARTO_RENDER_TOKEN";
  if (quartoRenderToken === undefined) {
    quartoRenderToken = Deno.env.get(kQuartoRenderToken) || null;
    Deno.env.delete(kQuartoRenderToken);
  }
  return quartoRenderToken;
}

function validateDocumentRenderFlags(flags?: RenderFlags) {
  if (flags) {
    const projectOnly: { [key: string]: string | undefined } = {
      ["--output-dir"]: flags.outputDir,
      ["--site-url"]: flags.siteUrl,
    };
    for (const arg of Object.keys(projectOnly)) {
      if (projectOnly[arg]) {
        throw new Error(
          `The ${arg} flag can only be used when rendering projects.`,
        );
      }
    }
  }
}
