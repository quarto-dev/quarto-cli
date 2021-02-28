/*
* serve.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { basename, extname, join, posix } from "path/mod.ts";

import { Response, serve, ServerRequest } from "http/server.ts";

import { message } from "../../core/console.ts";

import { kOutputDir, ProjectContext } from "../../project/project-context.ts";

import { ProjectWatcher, watchProject } from "./watch.ts";

export const kLocalhost = "127.0.0.1";

export type ServeOptions = {
  port: number;
  watch?: boolean;
  quiet?: boolean;
  debug?: boolean;
};

export async function serveProject(
  project: ProjectContext,
  options: ServeOptions,
) {
  // provide defaults
  options = {
    watch: true,
    quiet: true,
    debug: false,
    ...options,
  };

  // determine site dir
  const outputDir = project.metadata?.project?.[kOutputDir];
  const siteDir = outputDir ? join(project.dir, outputDir) : project.dir;

  // create project watcher
  const watcher = watchProject(project, options);

  // main request handler
  const handler = async (req: ServerRequest): Promise<void> => {
    // handle watcher request
    if (watcher.handle(req)) {
      return await watcher.connect(req);
    }

    // handle file requests
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
      response = serveFile(fsPath, watcher);
      if (!options.quiet) {
        message(normalizedUrl);
      }
    } catch (e) {
      response = await serveFallback(req, e, fsPath!, options);
    } finally {
      try {
        await req.respond(response!);
      } catch (e) {
        console.error(e);
      }
    }
  };

  // serve project
  const server = serve({ port: options.port, hostname: kLocalhost });
  for await (const req of server) {
    handler(req);
  }
}

function serveFallback(
  req: ServerRequest,
  e: Error,
  fsPath: string,
  options: ServeOptions,
): Promise<Response> {
  const encoder = new TextEncoder();
  if (e instanceof URIError) {
    return Promise.resolve({
      status: 400,
      body: encoder.encode("Bad Request"),
    });
  } else if (e instanceof Deno.errors.NotFound) {
    const url = normalizeURL(req.url);
    if (basename(fsPath) !== "favicon.ico" && extname(fsPath) !== ".map") {
      if (!options.quiet) {
        message(`404 (Not Found): ${url}`, { bold: true });
      }
    }
    return Promise.resolve({
      status: 404,
      body: encoder.encode("Not Found"),
    });
  } else {
    if (!options.quiet) {
      message(`500 (Internal Error): ${(e as Error).message}`, { bold: true });
    }
    if (options.debug) {
      console.error(e);
    }
    return Promise.resolve({
      status: 500,
      body: encoder.encode("Internal server error"),
    });
  }
}

function serveFile(filePath: string, watcher: ProjectWatcher): Response {
  // read file
  let fileContents = Deno.readFileSync(filePath);

  // if this is an html file then append watch script
  if ([".htm", ".html"].includes(extname(filePath).toLowerCase())) {
    fileContents = watcher.injectClient(fileContents);
  }

  // content headers
  const headers = new Headers();
  headers.set("Content-Length", fileContents.byteLength.toString());
  const contentTypeValue = contentType(filePath);
  if (contentTypeValue) {
    headers.set("Content-Type", contentTypeValue);
  }
  headers.set("Cache-Control", "no-store, max-age=0");

  return {
    status: 200,
    body: fileContents,
    headers,
  };
}

const MEDIA_TYPES: Record<string, string> = {
  ".md": "text/markdown",
  ".html": "text/html",
  ".htm": "text/html",
  ".json": "application/json",
  ".map": "application/json",
  ".txt": "text/plain",
  ".ts": "text/typescript",
  ".tsx": "text/tsx",
  ".js": "application/javascript",
  ".jsx": "text/jsx",
  ".gz": "application/gzip",
  ".css": "text/css",
  ".wasm": "application/wasm",
  ".mjs": "application/javascript",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".wav": "audio/wav",
  ".mp4": "video/mp4",
  ".woff": "application/font-woff",
  ".ttf": "application/font-ttf",
  ".eot": "application/vnd.ms-fontobject",
  ".otf": "application/font-otf",
};
/** Returns the content-type based on the extension of a path. */
function contentType(path: string): string | undefined {
  return MEDIA_TYPES[extname(path)];
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
