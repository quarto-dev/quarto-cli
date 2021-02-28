/*
* serve.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { acceptWebSocket, WebSocket } from "ws/mod.ts";

import { basename, extname, join, posix } from "path/mod.ts";

import { Response, serve, ServerRequest } from "http/server.ts";

import { message } from "../../core/console.ts";

import { kOutputDir, ProjectContext } from "../../project/project-context.ts";

import { watchProject } from "./watch.ts";

const kLocalhost = "127.0.0.1";

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
    if (options.watch && isWebSocket(req)) {
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
      response = serveFile(options.port, fsPath);
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

const reloadWatcherWs = async (
  req: ServerRequest,
  options: ServeOptions,
  project: ProjectContext,
): Promise<void> => {
  const handleError = (e: Error) => {
    if (!(e instanceof Deno.errors.BrokenPipe)) {
      if (options.debug) {
        console.error(e);
      }
      message((e as Error).message);
    }
  };

  let socket: WebSocket | undefined;

  try {
    const { conn, r: bufReader, w: bufWriter, headers } = req;
    socket = await acceptWebSocket({
      conn,
      bufReader,
      bufWriter,
      headers,
    });
  } catch (e) {
    handleError(e);
  } finally {
    if (socket && !socket.isClosed) {
      await socket.close(1000).catch(handleError);
    }
  }
};

function isWebSocket(req: ServerRequest): boolean {
  return req.headers.get("upgrade") === "websocket";
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

function serveFile(
  port: number,
  filePath: string,
): Response {
  // read file
  let fileContents = Deno.readFileSync(filePath);

  // if this is an html file then append websocket connection
  if ([".htm", ".html"].includes(extname(filePath).toLowerCase())) {
    const scriptContents = new TextEncoder().encode(reloadScript(port));
    const fileWithScript = new Uint8Array(
      fileContents.length + scriptContents.length,
    );
    fileWithScript.set(fileContents);
    fileWithScript.set(scriptContents, fileContents.length);
    fileContents = fileWithScript;
  }

  // content headers
  const headers = new Headers();
  headers.set("content-length", fileContents.byteLength.toString());
  const contentTypeValue = contentType(filePath);
  if (contentTypeValue) {
    headers.set("content-type", contentTypeValue);
  }

  return {
    status: 200,
    body: fileContents,
    headers,
  };
}

function reloadScript(port: number): string {
  return `
<script>
  const socket = new WebSocket('ws://${kLocalhost}:${port}');
  socket.onopen = () => {
    console.log('Socket connection open. Listening for events.');
  };
  socket.onmessage = (msg) => {
    if (msg.data === 'reload') {
      socket.close();
      location.reload(true);
    } 
  };
</script>`;
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
