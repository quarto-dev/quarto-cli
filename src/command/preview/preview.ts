/*
* preview.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { info, warning } from "log/mod.ts";
import { basename, dirname, join, relative } from "path/mod.ts";
import { existsSync } from "fs/mod.ts";

import * as ld from "../../core/lodash.ts";

import { kOutputFile } from "../../config/constants.ts";

import { cssFileResourceReferences } from "../../core/css.ts";
import { logError } from "../../core/log.ts";
import { openUrl } from "../../core/shell.ts";
import {
  httpContentResponse,
  httpFileRequestHandler,
  HttpFileRequestOptions,
} from "../../core/http.ts";
import { HttpDevServer, httpDevServer } from "../../core/http-devserver.ts";
import { isHtmlContent, isPdfContent } from "../../core/mime.ts";
import { PromiseQueue } from "../../core/promise.ts";
import { inputFilesDir } from "../../core/render.ts";

import {
  printBrowsePreviewMessage,
  printWatchingForChangesMessage,
  render,
} from "../render/render-shared.ts";
import { RenderFlags, RenderResultFile } from "../render/types.ts";
import { renderFormats, renderResultFinalOutput } from "../render/render.ts";
import { replacePandocArg } from "../render/flags.ts";

import { Format } from "../../config/types.ts";
import {
  kPdfJsInitialPath,
  pdfJsBaseDir,
  pdfJsFileHandler,
} from "../../core/pdfjs.ts";
import { ProjectContext } from "../../project/types.ts";
import { projectOutputDir } from "../../project/project-shared.ts";
import { projectContext } from "../../project/project-context.ts";
import { pathWithForwardSlashes } from "../../core/path.ts";
import { isJupyterHubServer, isRStudioServer } from "../../core/platform.ts";
import { createTempContext, TempContext } from "../../core/temp.ts";
import { isJupyterNotebook } from "../../core/jupyter/jupyter.ts";

interface PreviewOptions {
  port: number;
  host: string;
  browse: boolean;
  presentation: boolean;
  watchInputs: boolean;
}

export async function preview(
  file: string,
  flags: RenderFlags,
  pandocArgs: string[],
  options: PreviewOptions,
) {
  // determine the target format if there isn't one in the command line args
  // (current we force the use of an html or pdf based format)
  await resolvePreviewFormat(file, flags, pandocArgs);

  // render for preview (create function we can pass to watcher then call it)
  const render = async () => {
    const temp = createTempContext();
    try {
      return await renderForPreview(file, temp, flags, pandocArgs);
    } finally {
      temp.cleanup();
    }
  };
  const result = await render();

  // see if this is project file
  const project = await projectContext(file);

  // create client reloader
  const reloader = httpDevServer(options.port, options.presentation);

  // watch for changes and re-render / re-load as necessary
  const changeHandler = createChangeHandler(
    result,
    reloader,
    render,
    options.watchInputs,
  );

  // create file request handler (hook clients up to reloader, provide
  // function to be used if a render request comes in)
  const handler = isPdfContent(result.outputFile)
    ? pdfFileRequestHandler(
      result.outputFile,
      Deno.realPathSync(file),
      result.format,
      reloader,
      changeHandler.render,
    )
    : project
    ? projectHtmlFileRequestHandler(
      project,
      Deno.realPathSync(file),
      result.format,
      reloader,
      changeHandler.render,
    )
    : htmlFileRequestHandler(
      result.outputFile,
      Deno.realPathSync(file),
      result.format,
      reloader,
      changeHandler.render,
    );

  // open browser if requested
  const initialPath = isPdfContent(result.outputFile)
    ? kPdfJsInitialPath
    : project
    ? pathWithForwardSlashes(
      relative(projectOutputDir(project), result.outputFile),
    )
    : "";
  const url = `http://localhost:${options.port}/${initialPath}`;
  if (options.browse && !isRStudioServer() && !isJupyterHubServer()) {
    await openUrl(url);
  }

  // print status
  printBrowsePreviewMessage(options.port, initialPath);

  // serve project
  for await (
    const conn of Deno.listen({ port: options.port, hostname: options.host })
  ) {
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

// determine the format to preview (modifies flags and pandocArgs in place)
async function resolvePreviewFormat(
  file: string,
  flags: RenderFlags,
  pandocArgs: string[],
) {
  const formats = await renderFormats(file);
  const format = flags.to || Object.keys(formats).find((name) => {
    const format = formats[name];
    const outputFile = format.pandoc[kOutputFile];
    return isHtmlContent(outputFile) || isPdfContent(outputFile);
  }) || "html";
  flags.to = format;
  replacePandocArg(pandocArgs, "--to", format);
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
  const finalOutput = renderResultFinalOutput(renderResult, dirname(file));
  if (!finalOutput) {
    throw new Error("No output created by quarto render " + basename(file));
  }
  info("Output created: " + finalOutput + "\n");

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
      const reloadFiles = isHtmlContent(result.outputFile)
        ? htmlReloadFiles(result)
        : pdfReloadFiles(result);
      const reloadTarget = isHtmlContent(result.outputFile)
        ? ""
        : "/" + kPdfJsInitialPath;

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
  const fsWatcher = Deno.watchFs(files);
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
  format: Format,
  reloader: HttpDevServer,
  renderHandler: () => Promise<void>,
) {
  return httpFileRequestHandler(
    htmlFileRequestHandlerOptions(
      projectOutputDir(context),
      "index.html",
      inputFile,
      format,
      reloader,
      renderHandler,
    ),
  );
}

function htmlFileRequestHandler(
  htmlFile: string,
  inputFile: string,
  format: Format,
  reloader: HttpDevServer,
  renderHandler: () => Promise<void>,
) {
  return httpFileRequestHandler(
    htmlFileRequestHandlerOptions(
      dirname(htmlFile),
      basename(htmlFile),
      inputFile,
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
  format: Format,
  reloader: HttpDevServer,
  renderHandler: () => Promise<void>,
): HttpFileRequestOptions {
  return {
    baseDir,
    defaultFile,
    printUrls: "404",
    onRequest: (req: Request) => {
      if (reloader.handle(req)) {
        return Promise.resolve(reloader.connect(req));
      } else if (req.url.endsWith("/quarto-render/")) {
        // don't wait for the promise so the
        // caller gets an immediate reply
        renderHandler();
        return Promise.resolve(httpContentResponse("rendered"));
      } else {
        return Promise.resolve(undefined);
      }
    },
    onFile: async (file: string) => {
      if (isHtmlContent(file)) {
        // does the provide an alternate preview file?
        if (format.formatPreviewFile) {
          file = format.formatPreviewFile(file, format);
        }
        const fileContents = await Deno.readFile(file);
        return reloader.injectClient(fileContents, inputFile);
      }
    },
  };
}

function htmlReloadFiles(result: RenderForPreviewResult) {
  return [result.outputFile].concat(result.resourceFiles);
}

function pdfFileRequestHandler(
  pdfFile: string,
  inputFile: string,
  format: Format,
  reloader: HttpDevServer,
  renderHandler: () => Promise<void>,
) {
  // start w/ the html handler (as we still need it's http reload injection)
  const pdfOptions = htmlFileRequestHandlerOptions(
    dirname(pdfFile),
    basename(pdfFile),
    inputFile,
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
