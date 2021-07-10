/*
* serve.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import * as colors from "fmt/colors.ts";
import { error, info } from "log/mod.ts";
import { existsSync } from "fs/mod.ts";
import { basename, join, relative } from "path/mod.ts";

import { serve, ServerRequest } from "http/server.ts";

import { openUrl } from "../../core/shell.ts";
import { isHtmlContent } from "../../core/mime.ts";
import { pathWithForwardSlashes } from "../../core/path.ts";
import { logError } from "../../core/log.ts";
import { PromiseQueue } from "../../core/promise.ts";

import { kProject404File, ProjectContext } from "../../project/types.ts";
import { projectOutputDir } from "../../project/project-shared.ts";
import { projectContext } from "../../project/project-context.ts";
import { inputFileForOutputFile } from "../../project/project-index.ts";

import { websitePath } from "../../project/types/website/website-config.ts";

import { renderProject } from "../render/project.ts";
import { renderResultFinalOutput } from "../render/render.ts";

import { kLocalhost } from "../../core/port.ts";
import { httpFileRequestHandler } from "../../core/http.ts";
import { ServeOptions } from "./types.ts";
import { copyProjectForServe } from "./serve-shared.ts";
import { watchProject } from "./watch.ts";

export const kRenderNone = "none";
export const kRenderDefault = "default";

export async function serveProject(
  project: ProjectContext,
  options: ServeOptions,
) {
  // provide defaults
  options = {
    browse: true,
    watch: true,
    navigate: true,
    ...options,
  };

  // show progress indicating what we are doing to prepare for serving
  const render = options.render !== kRenderNone;
  if (render) {
    info("Rendering:");
  } else {
    info("Preparing to serve:");
  }

  // render in the main directory
  const renderResult = await renderProject(
    project,
    {
      useFreezer: !render,
      flags: (render && options.render !== kRenderDefault)
        ? { to: options.render }
        : {},
    },
  );

  // exit if there was an error
  if (renderResult.error) {
    throw error;
  }

  // create mirror of project for serving
  const serveDir = copyProjectForServe(project, true);
  const serveProject = (await projectContext(serveDir, false, true))!;

  // create project watcher
  const watcher = await watchProject(
    project,
    serveProject,
    renderResult,
    options,
  );

  // create a promise queue so we only do one renderProject at a time
  const renderQueue = new PromiseQueue();

  // file request handler
  const serveOutputDir = projectOutputDir(serveProject);
  const handler = httpFileRequestHandler({
    //  base dir
    baseDir: serveOutputDir,

    // print all urls
    printUrls: "all",

    // handle websocket upgrade requests
    onRequest: async (req: ServerRequest) => {
      if (watcher.handle(req)) {
        await watcher.connect(req);
        return true;
      } else {
        return false;
      }
    },

    // handle html file requests w/ re-renders
    onFile: async (file: string) => {
      // if this is an html file then re-render (using the freezer)
      if (isHtmlContent(file)) {
        // find the input file associated with this output and render it
        // if we can't find an input file for this .html file it may have
        // been an input added after the server started running, to catch
        // this case run a refresh on the watcher then try again
        const serveDir = projectOutputDir(watcher.serveProject());
        const filePathRelative = relative(serveDir, file);
        let inputFile = await inputFileForOutputFile(
          watcher.serveProject(),
          filePathRelative,
        );
        if (!inputFile || !existsSync(inputFile)) {
          inputFile = await inputFileForOutputFile(
            await watcher.refreshProject(),
            filePathRelative,
          );
        }
        if (inputFile) {
          try {
            await renderQueue.enqueue(() =>
              renderProject(
                watcher.serveProject(),
                {
                  useFreezer: true,
                  devServerReload: true,
                  flags: { quiet: true },
                },
                [inputFile!],
              )
            );
          } catch (e) {
            logError(e);
          }
        }

        const fileContents = Deno.readFileSync(file);
        return watcher.injectClient(fileContents);
      } else {
        return undefined;
      }
    },

    // handle 404 by returing site custom 404 page
    on404: (url: string) => {
      const print = !basename(url).startsWith("jupyter-");
      let body: Uint8Array | undefined;
      const custom404 = join(serveOutputDir, kProject404File);
      if (existsSync(custom404)) {
        let content404 = Deno.readTextFileSync(custom404);
        // replace site-path references with / so they work in dev server mode
        const sitePath = websitePath(project.config);
        if (sitePath !== "/") {
          content404 = content404.replaceAll(
            new RegExp('((?:content|ref|src)=")(' + sitePath + ")", "g"),
            "$1/",
          );
        }
        body = new TextEncoder().encode(content404);
      }
      return {
        print,
        body,
      };
    },
  });

  // serve project
  const server = serve({ port: options.port, hostname: kLocalhost });

  // compute site url
  const siteUrl = `http://localhost:${options.port}/`;

  // print status
  if (options.watch) {
    info("Watching project for reload on changes");
  }
  info(`Browse preview at `, {
    newline: false,
  });
  info(`${siteUrl}`, { format: colors.underline });

  // open browser if requested
  if (options.browse) {
    if (renderResult.baseDir && renderResult.outputDir) {
      const finalOutput = renderResultFinalOutput(renderResult);
      if (finalOutput) {
        const targetPath = pathWithForwardSlashes(relative(
          join(renderResult.baseDir, renderResult.outputDir),
          finalOutput,
        ));
        openUrl(targetPath === "index.html" ? siteUrl : siteUrl + targetPath);
      }
    } else {
      openUrl(siteUrl);
    }
  }

  // wait for requests
  for await (const req of server) {
    handler(req);
  }
}
