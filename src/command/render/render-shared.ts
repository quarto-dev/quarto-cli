/*
 * render-shared.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { dirname } from "path/mod.ts";

import { info } from "log/mod.ts";
import * as colors from "fmt/colors.ts";

import {
  projectContext,
  projectContextForDirectory,
} from "../../project/project-context.ts";

import { renderProject } from "./project.ts";
import { renderFiles } from "./render-files.ts";
import { resourceFilesFromRenderedFile } from "./resources.ts";
import { RenderFlags, RenderOptions, RenderResult } from "./types.ts";
import {
  fileExecutionEngine,
  fileExecutionEngineAndTarget,
} from "../../execute/engine.ts";

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

export async function render(
  path: string,
  options: RenderOptions,
): Promise<RenderResult> {
  // one time initialization of yaml validators
  setInitializer(initYamlIntelligenceResourcesFromFilesystem);
  await initState();

  const nbContext = notebookContext();

  // determine target context/files
  let context = await projectContext(path, nbContext, options.flags);

  // if there is no project parent and an output-dir was passed, then force a project
  if (!context && options.flags?.outputDir) {
    // recompute context
    context = await projectContextForDirectory(path, nbContext, options.flags);

    // force clean as --output-dir implies fully overwrite the target
    options.forceClean = options.flags.clean !== false;
  }

  // set env var if requested
  if (context && options.setProjectDir) {
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

  // NB: singleFileProjectContext is currently not fully-featured
  context = singleFileProjectContext(path, nbContext, options.flags);

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
      await engine.postRender(file, renderResult.context);
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
