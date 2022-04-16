/*
* preview.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { info, warning } from "log/mod.ts";
import { basename, dirname, extname, join, relative } from "path/mod.ts";
import { existsSync } from "fs/mod.ts";

import * as ld from "../../core/lodash.ts";

import { cssFileResourceReferences } from "../../core/css.ts";
import { logError } from "../../core/log.ts";
import { openUrl } from "../../core/shell.ts";
import {
  httpContentResponse,
  httpFileRequestHandler,
  HttpFileRequestOptions,
  isBrowserPreviewable,
} from "../../core/http.ts";
import { HttpDevServer, httpDevServer } from "../../core/http-devserver.ts";
import { isHtmlContent, isPdfContent, isTextContent } from "../../core/mime.ts";
import { PromiseQueue } from "../../core/promise.ts";
import { inputFilesDir } from "../../core/render.ts";

import {
  kQuartoRenderCommand,
  previewUnableToRenderResponse,
  printBrowsePreviewMessage,
  printWatchingForChangesMessage,
  render,
  renderToken,
} from "../render/render-shared.ts";
import {
  RenderFlags,
  RenderResult,
  RenderResultFile,
} from "../render/types.ts";
import { renderFormats } from "../render/render-contexts.ts";
import { renderResultFinalOutput } from "../render/render.ts";
import { replacePandocArg } from "../render/flags.ts";

import { Format } from "../../config/types.ts";
import {
  kPdfJsInitialPath,
  pdfJsBaseDir,
  pdfJsFileHandler,
} from "../../core/pdfjs.ts";
import {
  kProjectWatchInputs,
  ProjectContext,
  resolvePreviewOptions,
} from "../../project/types.ts";
import { projectOutputDir } from "../../project/project-shared.ts";
import { projectContext } from "../../project/project-context.ts";
import { pathWithForwardSlashes } from "../../core/path.ts";
import { isJupyterHubServer, isRStudioServer } from "../../core/platform.ts";
import { createTempContext, TempContext } from "../../core/temp.ts";
import { isJupyterNotebook } from "../../core/jupyter/jupyter.ts";
import { watchForFileChanges } from "../../core/watch.ts";
import {
  pandocBinaryPath,
  textHighlightThemePath,
} from "../../core/resources.ts";
import { execProcess } from "../../core/process.ts";

interface PreviewOptions {
  port?: number;
  host?: string;
  browser?: boolean;
  [kProjectWatchInputs]?: boolean;
  timeout?: number;
  presentation: boolean;
}

export async function preview(
  file: string,
  flags: RenderFlags,
  pandocArgs: string[],
  options: PreviewOptions,
) {
  // determine the target format if there isn't one in the command line args
  // (current we force the use of an html or pdf based format)
  const format = await previewFormat(file, flags.to);
  setPreviewFormat(format, flags, pandocArgs);

  // render for preview (create function we can pass to watcher then call it)
  let isRendering = false;
  const render = async () => {
    const temp = createTempContext();
    try {
      isRendering = true;
      return await renderForPreview(file, temp, flags, pandocArgs);
    } finally {
      isRendering = false;
      temp.cleanup();
    }
  };
  const result = await render();

  // see if this is project file
  const project = await projectContext(file);

  // resolve options (don't look at the project context b/c we
  // don't want overlapping ports within the same project)
  options = {
    ...options,
    ...(await resolvePreviewOptions(options)),
  };

  // create listener and callback to stop the server
  const listener = Deno.listen({ port: options.port!, hostname: options.host });
  const stopServer = () => listener.close();

  // create client reloader
  const reloader = httpDevServer(
    options.port!,
    options.timeout!,
    () => isRendering,
    stopServer,
    options.presentation || format === "revealjs",
  );

  // watch for changes and re-render / re-load as necessary
  const changeHandler = createChangeHandler(
    result,
    reloader,
    render,
    options[kProjectWatchInputs]!,
  );

  // create file request handler (hook clients up to reloader, provide
  // function to be used if a render request comes in)
  const handler = isPdfContent(result.outputFile)
    ? pdfFileRequestHandler(
      result.outputFile,
      Deno.realPathSync(file),
      flags,
      result.format,
      reloader,
      changeHandler.render,
    )
    : project
    ? projectHtmlFileRequestHandler(
      project,
      Deno.realPathSync(file),
      flags,
      result.format,
      reloader,
      changeHandler.render,
    )
    : htmlFileRequestHandler(
      result.outputFile,
      Deno.realPathSync(file),
      flags,
      result.format,
      reloader,
      changeHandler.render,
    );

  // open browser if this is a browseable format
  const initialPath = isPdfContent(result.outputFile)
    ? kPdfJsInitialPath
    : project
    ? pathWithForwardSlashes(
      relative(projectOutputDir(project), result.outputFile),
    )
    : "";
  const url = `http://localhost:${options.port}/${initialPath}`;
  if (
    options.browser &&
    !isRStudioServer() && !isJupyterHubServer() &&
    isBrowserPreviewable(result.outputFile)
  ) {
    await openUrl(url);
  }

  // print status
  printBrowsePreviewMessage(options.port!, initialPath);

  // serve project
  for await (const conn of listener) {
    (async () => {
      for await (const { request, respondWith } of Deno.serveHttp(conn)) {
        try {
          await respondWith(handler(request));
        } catch (err) {
          warning(err.message);
        }
      }
    })();
  }
}
export interface PreviewRenderRequest {
  version: 1 | 2;
  path: string;
  format?: string;
}

export function isPreviewRenderRequest(req: Request) {
  if (req.url.includes(kQuartoRenderCommand)) {
    return true;
  } else {
    const token = renderToken();
    if (token) {
      return req.url.includes(token);
    } else {
      return false;
    }
  }
}

export function previewRenderRequest(
  req: Request,
  baseDir?: string,
): PreviewRenderRequest | undefined {
  // look for v1 rstudio format (requires baseDir b/c its a relative path)
  const match = req.url.match(
    new RegExp(`/${kQuartoRenderCommand}/(.*)$`),
  );
  if (match && baseDir) {
    return {
      version: 1,
      path: join(baseDir, match[1]),
    };
  } else {
    const token = renderToken();
    if (token && req.url.includes(token)) {
      const url = new URL(req.url);
      const path = url.searchParams.get("path");
      if (path) {
        return {
          version: 2,
          path,
          format: url.searchParams.get("format") || undefined,
        };
      }
    }
  }
}

export async function previewRenderRequestIsCompatible(
  request: PreviewRenderRequest,
  flags: RenderFlags,
  project?: ProjectContext,
) {
  if (request.version === 1) {
    return true; // rstudio manages its own request compatibility state
  } else if (flags.to !== "all") {
    const format = await previewFormat(request.path, request.format, project);
    return format === flags.to;
  } else {
    return true;
  }
}

// determine the format to preview
export async function previewFormat(
  file: string,
  format?: string,
  project?: ProjectContext,
) {
  format = format ||
    Object.keys(await renderFormats(file, "all", project))[0] ||
    "html";
  return format;
}

export function setPreviewFormat(
  format: string,
  flags: RenderFlags,
  pandocArgs: string[],
) {
  flags.to = format;
  replacePandocArg(pandocArgs, "--to", format);
}

export function handleRenderResult(file: string, renderResult: RenderResult) {
  // print output created
  const finalOutput = renderResultFinalOutput(renderResult, dirname(file));
  if (!finalOutput) {
    throw new Error("No output created by quarto render " + basename(file));
  }
  info("Output created: " + finalOutput + "\n");
  return finalOutput;
}

interface RenderForPreviewResult {
  file: string;
  format: Format;
  outputFile: string;
  resourceFiles: string[];
}

async function renderForPreview(
  file: string,
  temp: TempContext,
  flags: RenderFlags,
  pandocArgs: string[],
): Promise<RenderForPreviewResult> {
  // render
  const renderResult = await render(file, {
    temp,
    flags,
    pandocArgs: pandocArgs,
  });
  if (renderResult.error) {
    throw renderResult.error;
  }

  // print output created
  const finalOutput = handleRenderResult(file, renderResult);

  // notify user we are watching for reload
  printWatchingForChangesMessage();

  // determine files to watch for reload -- take the resource
  // files detected during render, chase down additional references
  // in css files, then fitler out the _files dir
  file = Deno.realPathSync(file);
  const filesDir = join(dirname(file), inputFilesDir(file));
  const resourceFiles = renderResult.files.reduce(
    (resourceFiles: string[], file: RenderResultFile) => {
      const resources = file.resourceFiles.concat(
        cssFileResourceReferences(file.resourceFiles),
      );
      return resourceFiles.concat(
        resources.filter((resFile) => !resFile.startsWith(filesDir)),
      );
    },
    [],
  );
  return {
    file,
    format: renderResult.files[0].format,
    outputFile: join(dirname(file), finalOutput),
    resourceFiles,
  };
}

interface ChangeHandler {
  render: () => Promise<void>;
}

function createChangeHandler(
  result: RenderForPreviewResult,
  reloader: HttpDevServer,
  render: () => Promise<RenderForPreviewResult>,
  renderOnChange: boolean,
): ChangeHandler {
  const renderQueue = new PromiseQueue();
  let watcher: Watcher | undefined;
  let lastResult = result;

  // render handler
  const renderHandler = ld.debounce(async () => {
    try {
      await renderQueue.enqueue(async () => {
        const result = await render();
        sync(result);
      }, true);
    } catch (e) {
      if (e.message) {
        // jupyter notebooks being edited in juptyerlab sometimes get an
        // "Unexpected end of JSON input" error that remedies itself (so we ignore).
        // this may be a result of an intermediate save result?
        if (
          isJupyterNotebook(result.file) &&
          e.message.indexOf("Unexpected end of JSON input") !== -1
        ) {
          return;
        }

        logError(e);
      }
    }
  }, 50);

  const sync = (result: RenderForPreviewResult) => {
    const requiresSync = !watcher || resultRequiresSync(result, lastResult);
    lastResult = result;
    if (requiresSync) {
      if (watcher) {
        watcher.stop();
      }

      const watches: Watch[] = [];
      if (renderOnChange) {
        watches.push({
          files: [result.file],
          handler: renderHandler,
        });
      }

      // reload on output or resource changed (but wait for
      // the render queue to finish, as sometimes pdfs are
      // modified and even removed by pdflatex during render)
      const reloadFiles = isPdfContent(result.outputFile)
        ? pdfReloadFiles(result)
        : resultReloadFiles(result);
      const reloadTarget = isPdfContent(result.outputFile)
        ? "/" + kPdfJsInitialPath
        : "";

      watches.push({
        files: reloadFiles,
        handler: ld.debounce(async () => {
          await renderQueue.enqueue(async () => {
            await reloader.reloadClients(reloadTarget);
          });
        }, 50),
      });

      watcher = previewWatcher(watches);
      watcher.start();
    }
  };
  sync(result);
  return {
    render: renderHandler,
  };
}

interface Watch {
  files: string[];
  handler: () => Promise<void>;
}

interface Watcher {
  start: VoidFunction;
  stop: VoidFunction;
}

function previewWatcher(watches: Watch[]): Watcher {
  watches = watches.map((watch) => {
    return {
      ...watch,
      files: watch.files.filter(existsSync).map((file) => {
        return Deno.realPathSync(file);
      }),
    };
  });
  const handlerForFile = (file: string) => {
    const watch = watches.find((watch) => watch.files.includes(file));
    return watch?.handler;
  };

  // create the watcher
  const files = watches.flatMap((watch) => watch.files);
  const fsWatcher = watchForFileChanges(files);
  const watchForChanges = async () => {
    for await (const event of fsWatcher) {
      try {
        if (event.kind === "modify") {
          const handlers = new Set<() => Promise<void>>();
          event.paths.forEach((path) => {
            const handler = handlerForFile(path);
            if (handler && !handlers.has(handler)) {
              handlers.add(handler);
            }
          });
          for (const handler of handlers) {
            await handler();
          }
        }
      } catch (e) {
        logError(e);
      }
    }
  };

  return {
    start: watchForChanges,
    stop: () => fsWatcher.close(),
  };
}

function projectHtmlFileRequestHandler(
  context: ProjectContext,
  inputFile: string,
  flags: RenderFlags,
  format: Format,
  reloader: HttpDevServer,
  renderHandler: () => Promise<void>,
) {
  return httpFileRequestHandler(
    htmlFileRequestHandlerOptions(
      projectOutputDir(context),
      "index.html",
      inputFile,
      flags,
      format,
      reloader,
      renderHandler,
    ),
  );
}

function htmlFileRequestHandler(
  htmlFile: string,
  inputFile: string,
  flags: RenderFlags,
  format: Format,
  reloader: HttpDevServer,
  renderHandler: () => Promise<void>,
) {
  return httpFileRequestHandler(
    htmlFileRequestHandlerOptions(
      dirname(htmlFile),
      basename(htmlFile),
      inputFile,
      flags,
      format,
      reloader,
      renderHandler,
    ),
  );
}

function htmlFileRequestHandlerOptions(
  baseDir: string,
  defaultFile: string,
  inputFile: string,
  flags: RenderFlags,
  format: Format,
  reloader: HttpDevServer,
  renderHandler: () => Promise<void>,
): HttpFileRequestOptions {
  return {
    baseDir,
    defaultFile,
    printUrls: "404",
    onRequest: async (req: Request) => {
      if (reloader.handle(req)) {
        return Promise.resolve(reloader.connect(req));
      } else if (req.url.endsWith("/quarto-render/")) {
        // don't wait for the promise so the
        // caller gets an immediate reply
        renderHandler();
        return Promise.resolve(httpContentResponse("rendered"));
      } else if (isPreviewRenderRequest(req)) {
        const prevReq = previewRenderRequest(req);
        if (
          prevReq &&
          existsSync(prevReq.path) &&
          Deno.realPathSync(prevReq.path) === inputFile &&
          await previewRenderRequestIsCompatible(prevReq, flags)
        ) {
          // don't wait for the promise so the
          // caller gets an immediate reply
          renderHandler();
          return Promise.resolve(httpContentResponse("rendered"));
        } else {
          return Promise.resolve(previewUnableToRenderResponse());
        }
      } else {
        return Promise.resolve(undefined);
      }
    },
    onFile: async (file: string, req: Request) => {
      if (isHtmlContent(file)) {
        // does the provide an alternate preview file?
        if (format.formatPreviewFile) {
          file = format.formatPreviewFile(file, format);
        }
        const fileContents = await Deno.readFile(file);
        return reloader.injectClient(fileContents, inputFile);
      } else if (isTextContent(file)) {
        const html = await textPreviewHtml(file, req);
        const fileContents = new TextEncoder().encode(html);
        return reloader.injectClient(fileContents, inputFile);
      }
    },
  };
}

function resultReloadFiles(result: RenderForPreviewResult) {
  return [result.outputFile].concat(result.resourceFiles);
}

function pdfFileRequestHandler(
  pdfFile: string,
  inputFile: string,
  flags: RenderFlags,
  format: Format,
  reloader: HttpDevServer,
  renderHandler: () => Promise<void>,
) {
  // start w/ the html handler (as we still need it's http reload injection)
  const pdfOptions = htmlFileRequestHandlerOptions(
    dirname(pdfFile),
    basename(pdfFile),
    inputFile,
    flags,
    format,
    reloader,
    renderHandler,
  );

  // pdf customizations
  pdfOptions.baseDir = pdfJsBaseDir();
  pdfOptions.onFile = pdfJsFileHandler(() => pdfFile, pdfOptions.onFile);

  return httpFileRequestHandler(pdfOptions);
}

function pdfReloadFiles(result: RenderForPreviewResult) {
  return [result.outputFile];
}

function resultRequiresSync(
  result: RenderForPreviewResult,
  lastResult?: RenderForPreviewResult,
) {
  if (!lastResult) {
    return true;
  }
  return result.file !== lastResult.file ||
    result.outputFile !== lastResult.outputFile ||
    !ld.isEqual(result.resourceFiles, lastResult.resourceFiles);
}

// run pandoc and its syntax highlighter over the passed file
// (use the file's extension as its language)
async function textPreviewHtml(file: string, req: Request) {
  // see if we are in dark mode
  const kQuartoPreviewThemeCategory = "quartoPreviewThemeCategory";
  const themeCategory = new URL(req.url).searchParams.get(
    kQuartoPreviewThemeCategory,
  );
  const darkHighlightStyle = themeCategory && themeCategory !== "light";
  const backgroundColor = darkHighlightStyle ? "rgb(30,30,30)" : "#FFFFFF";

  // generate the markdown
  const frontMatter = ["---"];
  frontMatter.push(`pagetitle: "Quarto Preview"`);
  frontMatter.push(`document-css: false`);
  frontMatter.push("---");

  const styles = [
    "```{=html}",
    `<style type="text/css">`,
    `body { margin: 8px 12px; background-color: ${backgroundColor} }`,
    `div.sourceCode { background-color: transparent; }`,
    `</style>`,
    "```",
  ];

  const lang = (extname(file) || ".default").slice(1).toLowerCase();
  const kFence = "````````````````";
  const markdown = frontMatter.join("\n") + "\n\n" +
    styles.join("\n") + "\n\n" +
    kFence + lang + "\n" +
    Deno.readTextFileSync(file) + "\n" +
    kFence;

  // build the pandoc command (we'll feed it the input on stdin)
  const cmd = [pandocBinaryPath()];
  cmd.push("--to", "html");
  cmd.push(
    "--highlight-style",
    textHighlightThemePath("atom-one", darkHighlightStyle ? "dark" : "light")!,
  );
  cmd.push("--standalone");
  const result = await execProcess({
    cmd,
    stdout: "piped",
  }, markdown);
  if (result.success) {
    return result.stdout;
  } else {
    throw new Error();
  }
}
