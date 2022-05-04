/*
* render-shared.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
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
import { RenderOptions, RenderResult } from "./types.ts";
import { fileExecutionEngine } from "../../execute/engine.ts";
import {
  isJupyterHubServer,
  isRStudioServer,
  isRStudioWorkbench,
  isVSCodeTerminal,
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
import { execProcess } from "../../core/process.ts";

export async function render(
  path: string,
  options: RenderOptions,
): Promise<RenderResult> {
  // one time initialization of yaml validators
  setInitializer(initYamlIntelligenceResourcesFromFilesystem);
  await initState();

  // determine target context/files
  const context = await projectContext(path, options.flags);

  // set env var if requested
  if (context && options.setProjectDir) {
    Deno.env.set("QUARTO_PROJECT_DIR", context.dir);
  }

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

export function printWatchingForChangesMessage() {
  info("Watching files for changes", { format: colors.green });
}

export async function printBrowsePreviewMessage(port: number, path: string) {
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
  } else if (isVSCodeTerminal() && isRStudioWorkbench()) {
    const server = Deno.env.get("RS_SERVER_URL")!;
    const session = Deno.env.get("RS_SESSION_URL")!;
    const portToken = await mapRSWPortToken(port);
    const url = `${server}${session.slice(1)}p/${portToken}/${path}`;
    info(`\nPreview server: http://localhost:${port}/`);
    info(`\nBrowse at ${url}`, { format: colors.green });
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

async function mapRSWPortToken(port: number) {
  const result = await execProcess(
    {
      cmd: ["/usr/lib/rstudio-server/bin/rserver-url", String(port)],
      stdout: "piped",
      stderr: "piped",
    },
  );
  if (result.success) {
    return result.stdout;
  } else {
    throw new Error(
      `Failed to map RSW port token (status ${result.code})\n${result.stderr}`,
    );
  }
}

export const kQuartoRenderCommand = "90B3C9E8-0DBC-4BC0-B164-AA2D5C031B28";

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
