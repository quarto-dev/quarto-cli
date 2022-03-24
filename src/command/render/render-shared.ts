/*
* render-shared.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { dirname, join } from "path/mod.ts";
import { existsSync } from "fs/mod.ts";

import { info } from "log/mod.ts";
import * as colors from "fmt/colors.ts";

import { pathWithForwardSlashes } from "../../core/path.ts";
import {
  projectContext,
  projectContextForDirectory,
} from "../../project/project-context.ts";

import { renderProject } from "./project.ts";
import { renderFiles } from "./render.ts";
import { resolveFileResources } from "./resources.ts";
import {
  RenderedFile,
  RenderFlags,
  RenderOptions,
  RenderResourceFiles,
  RenderResult,
} from "./types.ts";
import { PartitionedMarkdown } from "../../core/pandoc/types.ts";
import { fileExecutionEngine } from "../../execute/engine.ts";
import {
  isJupyterHubServer,
  isRStudioServer,
  jupyterHubHttpReferrer,
  jupyterHubUser,
} from "../../core/platform.ts";
import { isProjectInputFile } from "../../project/project-shared.ts";

import {
  initState,
  setInitializer,
} from "../../core/lib/yaml-validation/state.ts";
import { initYamlIntelligenceResourcesFromFilesystem } from "../../core/schema/utils.ts";
import { kTextPlain } from "../../core/mime.ts";
import { previewFormat } from "../preview/preview.ts";
import { ProjectContext } from "../../project/types.ts";

export async function render(
  path: string,
  options: RenderOptions,
): Promise<RenderResult> {
  // one time initialization of yaml validators
  setInitializer(initYamlIntelligenceResourcesFromFilesystem);
  await initState();

  // determine target context/files
  const context = await projectContext(path, options.flags);

  if (Deno.statSync(path).isDirectory) {
    // if the path is a sub-directory of the project, then create
    // a files list that is only those files in the subdirectory
    let files: string[] | undefined;
    if (context) {
      const renderDir = Deno.realPathSync(path);
      const projectDir = Deno.realPathSync(context.dir);
      if (renderDir !== projectDir) {
        files = context.files.input.filter((file) =>
          file.startsWith(renderDir)
        );
      }
      return renderProject(
        context || await projectContextForDirectory(path, options.flags),
        options,
        files,
      );
    } else {
      throw new Error(
        "The specified directory ('" + path + "') is not a Quarto project",
      );
    }
  } else if (context?.config) {
    // if there is a project file then treat this as a project render
    // if the passed file is in the render list
    if (isProjectInputFile(path, context)) {
      return renderProject(context, options, [path]);
    }
  }

  // otherwise it's just a file render
  const result = await renderFiles([{ path }], options);

  // get partitioned markdown if we had result files
  const engine = fileExecutionEngine(path);
  const partitioned = (engine && result.files.length > 0)
    ? await engine.partitionedMarkdown(path)
    : undefined;

  // return files
  return {
    files: await Promise.all(result.files.map(async (file) => {
      const resourceFiles = await resourceFilesFromRenderedFile(
        dirname(path),
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
  };
}

export function renderProgress(message: string) {
  info(colors.bold(colors.blue(message)));
}

export function pandocMetadataPath(path: string) {
  return pathWithForwardSlashes(path);
}

export function resourceFilesFromRenderedFile(
  baseDir: string,
  renderedFile: RenderedFile,
  partitioned?: PartitionedMarkdown,
) {
  return resourceFilesFromFile(
    baseDir,
    renderedFile.file,
    renderedFile.resourceFiles,
    renderedFile.selfContained,
    renderedFile.supporting,
    partitioned,
  );
}

export async function resourceFilesFromFile(
  baseDir: string,
  file: string,
  resources: RenderResourceFiles,
  selfContained: boolean,
  supporting?: string[],
  partitioned?: PartitionedMarkdown,
) {
  const resourceDir = join(baseDir, dirname(file));
  const markdown = partitioned ? partitioned.markdown : "";
  const globs = resources.globs;
  const fileResourceFiles = await resolveFileResources(
    baseDir,
    resourceDir,
    markdown,
    globs,
  );

  // add the explicitly discovered files (if they exist and
  // the output isn't self-contained)
  if (!selfContained) {
    const resultFiles = resources.files
      .map((file) => join(resourceDir, file))
      .filter(existsSync)
      .map(Deno.realPathSync);
    fileResourceFiles.include.push(...resultFiles);
  }

  // apply removes and filter files dir
  const resourceFiles = fileResourceFiles.include.filter(
    (file: string) => {
      if (fileResourceFiles.exclude.includes(file)) {
        return false;
      } else if (
        supporting &&
        supporting.some((support) => file.startsWith(join(baseDir, support)))
      ) {
        return false;
      } else {
        return true;
      }
    },
  );
  return resourceFiles;
}

export function printWatchingForChangesMessage() {
  info("Watching files for changes", { format: colors.green });
}

export function printBrowsePreviewMessage(port: number, path: string) {
  if (isJupyterHubServer()) {
    const httpReferrer = `${
      jupyterHubHttpReferrer() || "<jupyterhub-server-url>/"
    }user/${jupyterHubUser()}/`;
    info(
      `\nBrowse at ${httpReferrer}proxy/${port}/${path}`,
      {
        format: colors.green,
      },
    );
  } else {
    const url = `http://localhost:${port}/${path}`;
    if (!isRStudioServer()) {
      info(`Browse at `, {
        newline: false,
        format: colors.green,
      });
    }
    info(url, { format: (str: string) => colors.underline(colors.green(str)) });
  }
}

const kQuartoRenderCommand = "90B3C9E8-0DBC-4BC0-B164-AA2D5C031B28";
const kQuartoRenderCommandv2 = "B4AA6EED-A702-4ED2-9734-A20C6FDC4071";

export interface PreviewRenderRequest {
  path: string;
  format?: string;
}

export function isPreviewRenderRequest(req: Request) {
  return req.url.includes(kQuartoRenderCommand) ||
    req.url.includes(kQuartoRenderCommandv2);
}

export function previewRenderRequest(
  req: Request,
  hasClients: boolean,
  baseDir?: string,
): PreviewRenderRequest | undefined {
  // look for v1 rstudio format (requires baseDir b/c its a relative path)
  const match = req.url.match(
    new RegExp(`/${kQuartoRenderCommand}/(.*)$`),
  );
  if (match && baseDir) {
    return {
      path: join(baseDir, match[1]),
    };
  } else if (hasClients && req.url.includes(kQuartoRenderCommandv2)) {
    const url = new URL(req.url);
    const path = url.searchParams.get("path");
    if (path) {
      return {
        path,
        format: url.searchParams.get("format") || undefined,
      };
    }
  }
}

export async function previewRenderRequestIsCompatible(
  request: PreviewRenderRequest,
  flags: RenderFlags,
  project?: ProjectContext,
) {
  const format = await previewFormat(request.path, request.format, project);
  return format === flags.to;
}

export function previewUnableToRenderResponse() {
  return new Response("not found", {
    status: 404,
    headers: {
      "Content-Type": kTextPlain,
    },
  });
}
