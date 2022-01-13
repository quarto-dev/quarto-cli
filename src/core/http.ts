/*
* http.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { existsSync } from "fs/mod.ts";
import { basename, extname, join, posix } from "path/mod.ts";
import { error, info } from "log/mod.ts";

import * as colors from "fmt/colors.ts";

import { contentType, isHtmlContent, kTextHtml } from "./mime.ts";
import { logError } from "./log.ts";
import { pathWithForwardSlashes } from "./path.ts";

export interface HttpFileRequestOptions {
  baseDir: string;
  defaultFile?: string;
  printUrls?: "all" | "404";
  onRequest?: (req: Request) => Promise<Response | undefined>;
  onFile?: (
    file: string,
    req: Request,
  ) => Promise<Uint8Array | undefined>;
  on404?: (url: string, req: Request) => { print?: boolean; body?: Uint8Array };
}

export function isFileRef(href: string) {
  return !/^\w+:/.test(href) && !href.startsWith("#");
}

export function httpFileRequestHandler(
  options: HttpFileRequestOptions,
) {
  async function serveFile(
    filePath: string,
    req: Request,
  ): Promise<Response> {
    // read file (allow custom handler first shot at html files)
    let fileContents: Uint8Array | undefined;
    if (options.onFile) {
      fileContents = await options.onFile(filePath, req);
    }
    if (!fileContents) {
      fileContents = Deno.readFileSync(filePath);
    }

    return httpContentResponse(fileContents, contentType(filePath));
  }

  function serveFallback(
    req: Request,
    e: Error,
    fsPath?: string,
  ): Promise<Response> {
    const encoder = new TextEncoder();
    if (e instanceof URIError) {
      return Promise.resolve(
        new Response(encoder.encode("BadRequest"), { status: 400 }),
      );
    } else if (e instanceof Deno.errors.NotFound) {
      const url = normalizeURL(req.url);
      const handle404 = options.on404
        ? options.on404(url, req)
        : { print: true, body: encoder.encode("Not Found") };
      handle404.print = handle404.print &&
        !!options.printUrls &&
        (!fsPath || (
          basename(fsPath) !== "favicon.ico" &&
          extname(fsPath) !== ".map"
        ));
      if (handle404.print) {
        printUrl(url, false);
      }
      return Promise.resolve(
        new Response(handle404.body, {
          status: 404,
          headers: {
            "Content-Type": kTextHtml,
          },
        }),
      );
    } else {
      error(`500 (Internal Error): ${(e as Error).message}`, { bold: true });
      return Promise.resolve(
        new Response(encoder.encode("Internal server error"), {
          status: 500,
        }),
      );
    }
  }

  return async (req: Request): Promise<Response> => {
    // custom request handler
    if (options.onRequest) {
      const response = await options.onRequest(req);
      if (response) {
        return response;
      }
    }

    // handle file requests
    let response: Response | undefined;
    let fsPath: string | undefined;
    try {
      // establish base dir and fsPath (w/ slashes normalized to /)
      const baseDir = pathWithForwardSlashes(options.baseDir);
      const normalizedUrl = normalizeURL(req.url);
      fsPath = pathWithForwardSlashes(baseDir + normalizedUrl!);

      // don't let the path escape the serveDir
      if (fsPath.indexOf(baseDir) !== 0) {
        fsPath = baseDir;
      }
      const fileInfo = existsSync(fsPath) ? Deno.statSync(fsPath) : undefined;
      if (fileInfo && fileInfo.isDirectory) {
        fsPath = join(fsPath, options.defaultFile || "index.html");
      }
      if (fileInfo?.isDirectory && !normalizedUrl.endsWith("/")) {
        response = serveRedirect(normalizedUrl + "/");
      } else {
        response = await serveFile(fsPath, req);
        if (options.printUrls === "all") {
          printUrl(normalizedUrl);
        }
      }
    } catch (e) {
      response = await serveFallback(
        req,
        e,
        fsPath,
      );
    }
    return response!;
  };
}

export function httpContentResponse(
  content: Uint8Array | string,
  contentType?: string,
): Response {
  if (typeof (content) === "string") {
    content = new TextEncoder().encode(content);
  }
  // content headers
  const headers = new Headers();
  headers.set("Content-Length", content.byteLength.toString());
  if (contentType) {
    headers.set("Content-Type", contentType);
  }
  headers.set("Cache-Control", "no-store, max-age=0");
  return new Response(content, {
    status: 200,
    headers,
  });
}

export function normalizeURL(url: string): string {
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
    normalizedUrl = decodeURI(absoluteURI.pathname);
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

export function maybeDisplaySocketError(e: unknown) {
  if (
    !(e instanceof Deno.errors.BrokenPipe) &&
    !(e instanceof Deno.errors.ConnectionAborted) &&
    !(e instanceof Deno.errors.ConnectionReset) &&
    !(e instanceof DOMException)
  ) {
    logError(e as Error);
  }
}

function serveRedirect(url: string): Response {
  const headers = new Headers();
  headers.set("Location", url);
  return new Response(null, {
    status: 301,
    headers,
  });
}

function printUrl(url: string, found = true) {
  const format = !found ? colors.red : undefined;
  const urlDisplay = url + (found ? "" : " (404: Not Found)");
  if (
    isHtmlContent(url) || url.endsWith("/") || extname(url) === ""
  ) {
    info(`GET: ${urlDisplay}`, {
      bold: false,
      format: format || colors.green,
    });
  } else if (!found) {
    info(urlDisplay, { dim: found, format, indent: 2 });
  }
}
