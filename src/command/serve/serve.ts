/*
* serve.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { basename, extname, join, posix, relative } from "path/mod.ts";

import { listenAndServe, Response, ServerRequest } from "http/server.ts";
import { serveFile } from "http/file_server.ts";

import { message } from "../../core/console.ts";

import { kOutputDir, ProjectContext } from "../../project/project-context.ts";

export type ServeOptions = {
  port: number;
  watch?: boolean;
  quiet?: boolean;
  debug?: boolean;
};

export function serveProject(project: ProjectContext, options: ServeOptions) {
  const {
    port,
    watch = true,
    quiet = false,
    debug = false,
  } = options;

  // determine site dir
  const outputDir = project.metadata?.project?.[kOutputDir];
  const siteDir = outputDir ? join(project.dir, outputDir) : project.dir;

  // serve project
  listenAndServe(
    { port, hostname: "127.0.0.1" },
    async (req: ServerRequest): Promise<void> => {
      let response: Response | undefined;
      let fsPath: string | undefined;
      try {
        const normalizedUrl = normalizeURL(req.url);
        fsPath = posix.join(siteDir, normalizedUrl);
        if (fsPath.indexOf(siteDir) !== 0) {
          fsPath = siteDir;
        }
        const fileInfo = await Deno.stat(fsPath);
        if (fileInfo.isDirectory) {
          fsPath = join(fsPath, "index.html");
        }
        response = await serveFile(req, fsPath);
      } catch (e) {
        response = await serveFallback(req, e);
      } finally {
        try {
          await req.respond(response!);
        } catch (e) {
          console.error(e.message);
        }
      }
    },
  );
}

function serveFallback(req: ServerRequest, e: Error): Promise<Response> {
  const encoder = new TextEncoder();
  if (e instanceof URIError) {
    return Promise.resolve({
      status: 400,
      body: encoder.encode("Bad Request"),
    });
  } else if (e instanceof Deno.errors.NotFound) {
    const url = normalizeURL(req.url);
    if (basename(url) !== "favicon.ico" || extname(url) !== ".map") {
      message(`404 (Not Found): ${url}`, { bold: true });
    }
    return Promise.resolve({
      status: 404,
      body: encoder.encode("Not Found"),
    });
  } else {
    console.log(e);
    return Promise.resolve({
      status: 500,
      body: encoder.encode("Internal server error"),
    });
  }
}

function normalizeURL(url: string): string {
  let normalizedUrl = url;
  try {
    normalizedUrl = decodeURI(normalizedUrl);
  } catch (e) {
    if (!(e instanceof URIError)) {
      throw e;
    }
  }

  try {
    //allowed per https://www.w3.org/Protocols/rfc2616/rfc2616-sec5.html
    const absoluteURI = new URL(normalizedUrl);
    normalizedUrl = absoluteURI.pathname;
  } catch (e) { //wasn't an absoluteURI
    if (!(e instanceof TypeError)) {
      throw e;
    }
  }

  if (normalizedUrl[0] !== "/") {
    throw new URIError("The request URI is malformed.");
  }

  normalizedUrl = posix.normalize(normalizedUrl);
  const startOfParams = normalizedUrl.indexOf("?");
  return startOfParams > -1
    ? normalizedUrl.slice(0, startOfParams)
    : normalizedUrl;
}
