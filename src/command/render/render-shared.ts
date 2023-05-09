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
import { fileExecutionEngine } from "../../execute/engine.ts";
import {
  isJupyterHubServer,
  isJupyterServer,
  isRStudioServer,
  isRStudioWorkbench,
  isVSCodeServer,
  isVSCodeTerminal,
  jupyterHubHttpReferrer,
  jupyterHubUser,
  vsCodeServerProxyUri,
} from "../../core/platform.ts";
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
import { execProcess } from "../../core/process.ts";
import { normalizePath } from "../../core/path.ts";

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
      const renderDir = normalizePath(path);
      const projectDir = normalizePath(context.dir);
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

  // validate that we didn't get any project-only options
  validateDocumentRenderFlags(options.flags);

  // otherwise it's just a file render
  const result = await renderFiles([{ path }], options);

  // get partitioned markdown if we had result files
  const engine = fileExecutionEngine(path);
  const partitioned = (engine && result.files.length > 0)
    ? await engine.partitionedMarkdown(path)
    : undefined;

  const excludeDirs = context ? projectExcludeDirs(context) : [];

  // return files
  return {
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
  };
}

export function printWatchingForChangesMessage() {
  info("Watching files for changes", { format: colors.green });
}

export function previewURL(host: string, port: number, path: string) {
  // render 127.0.0.1 as localhost as not to break existing unit tests (see #947)
  const showHost = host == "127.0.0.1" ? "localhost" : host;
  const url = `http://${showHost}:${port}/${path}`;
  return url;
}

export async function printBrowsePreviewMessage(
  host: string,
  port: number,
  path: string,
) {
  if (
    (isJupyterServer() || isVSCodeTerminal()) && isRStudioWorkbench()
  ) {
    const url = await rswURL(port, path);
    info(`\nPreview server: ${previewURL(host, port, path = "")}`);
    info(`\nBrowse at ${url}`, { format: colors.green });
  } else if (isVSCodeTerminal() && isVSCodeServer()) {
    const proxyUrl = vsCodeServerProxyUri()!;
    if (proxyUrl.endsWith("/")) {
      path = path.startsWith("/") ? path.slice(1) : path;
    } else {
      path = path.startsWith("/") ? path : "/" + path;
    }
    const browseUrl = proxyUrl.replace("{{port}}", `${port}`) +
      path;
    info(`\nBrowse at ${browseUrl}`, { format: colors.green });
  } else if (isJupyterHubServer()) {
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
    const url = previewURL(host, port, path);
    if (!isRStudioServer()) {
      info(`Browse at `, {
        newline: false,
        format: colors.green,
      });
    }
    info(url, { format: (str: string) => colors.underline(colors.green(str)) });
  }
}

export async function rswURL(port: number, path: string) {
  const server = Deno.env.get("RS_SERVER_URL")!;
  const session = Deno.env.get("RS_SESSION_URL")!;
  const portToken = await rswPortToken(port);
  const url = `${server}${session.slice(1)}p/${portToken}/${path}`;
  return url;
}

async function rswPortToken(port: number) {
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
