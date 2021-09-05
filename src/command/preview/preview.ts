/*
* preview.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { info } from "log/mod.ts";
import { basename, dirname, join } from "path/mod.ts";

import { serve, ServerRequest } from "http/server.ts";

import { ld } from "lodash/mod.ts";

import { kOutputFile } from "../../config/constants.ts";

import { cssFileResourceReferences } from "../../core/css.ts";
import { logError } from "../../core/log.ts";
import { openUrl } from "../../core/shell.ts";
import {
  httpContentResponse,
  httpFileRequestHandler,
  HttpFileRequestOptions,
} from "../../core/http.ts";
import { HttpReloader, httpReloader } from "../../core/http-reload.ts";
import { isHtmlContent, isPdfContent } from "../../core/mime.ts";
import { PromiseQueue } from "../../core/promise.ts";
import { inputFilesDir } from "../../core/render.ts";

import {
  printBrowsePreviewMessage,
  printWatchingForChangesMessage,
  render,
} from "../render/render-shared.ts";
import { RenderFlags, RenderResultFile } from "../render/types.ts";
import {
  renderFormats,
  renderResultFinalOutput,
  renderResultUrlPath,
} from "../render/render.ts";
import { replacePandocArg } from "../render/flags.ts";
import { formatResourcePath } from "../../core/resources.ts";
import {
  projectContext,
  projectIsWebsite,
} from "../../project/project-context.ts";
import { pathWithForwardSlashes } from "../../core/path.ts";
import { normalizeNewlines } from "../../core/text.ts";
import { md5Hash } from "../../core/hash.ts";
import { isProjectInputFile } from "../../project/project-shared.ts";
import { renderProject } from "../render/project.ts";
import { kRenderNone, serveProject } from "../serve/serve.ts";

interface PreviewOptions {
  port: number;
  host: string;
  browse: boolean;
  watch: boolean;
}

export async function preview(
  file: string,
  flags: RenderFlags,
  pandocArgs: string[],
  options: PreviewOptions,
) {
  // see if this is in a project that should be previewed w/ serve
  const project = await projectContext(file, false, true);
  if (project && projectIsWebsite(project)) {
    if (isProjectInputFile(file, project)) {
      const result = await renderProject(project, { flags, pandocArgs }, [
        file,
      ]);
      if (result.error) {
        throw result.error;
      }
      const targetPath = renderResultUrlPath(result);
      await serveProject(project, flags, pandocArgs, {
        port: options.port,
        host: options.host,
        render: kRenderNone,
        browse: options.browse ? targetPath || true : false,
        watch: options.watch,
        navigate: true,
      });
      return;
    }
  }

  // determine the target format if there isn't one in the command line args
  // (current we force the use of an html or pdf based format)
  await resolvePreviewFormat(file, flags, pandocArgs);

  // render for preview (create function we can pass to watcher then call it)
  const render = async () => {
    return await renderForPreview(file, flags, pandocArgs);
  };
  const result = await render();

  // create client reloader
  const reloader = httpReloader(options.port);

  // watch for changes and re-render / re-load as necessary
  const changeHandler = createChangeHandler(
    result,
    reloader,
    render,
    options.watch,
  );

  // create file request handler (hook clients up to reloader, provide
  // function to be used if a render request comes in)
  const handler = isPdfContent(result.outputFile)
    ? pdfFileRequestHandler(result.outputFile, reloader, changeHandler.render)
    : htmlFileRequestHandler(result.outputFile, reloader, changeHandler.render);

  // serve project
  const server = serve({ port: options.port, hostname: options.host });

  // open browser if requested
  const initialPath = isPdfContent(result.outputFile) ? kPdfJsInitialPath : "";
  const url = `http://localhost:${options.port}/${initialPath}`;
  if (options.browse) {
    openUrl(url);
  }

  // print status
  printBrowsePreviewMessage(url);

  // handle requests
  for await (const req of server) {
    await handler(req);
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
  outputFile: string;
  resourceFiles: string[];
}

async function renderForPreview(
  file: string,
  flags: RenderFlags,
  pandocArgs: string[],
): Promise<RenderForPreviewResult> {
  // render
  const renderResult = await render(file, {
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
    outputFile: join(dirname(file), finalOutput),
    resourceFiles,
  };
}

interface ChangeHandler {
  render: () => Promise<void>;
}

function createChangeHandler(
  result: RenderForPreviewResult,
  reloader: HttpReloader,
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
        logError(e);
      }
    }
  }, 50);

  const sync = (result: RenderForPreviewResult) => {
    const requiresSync = !watcher || !lastResult ||
      !ld.isEqual(result, lastResult);
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
      files: watch.files.map((file) => {
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
      } finally {
        watchForChanges();
      }
    }
  };

  return {
    start: watchForChanges,
    stop: () => fsWatcher.close(),
  };
}

function htmlFileRequestHandler(
  htmlFile: string,
  reloader: HttpReloader,
  renderHandler: () => Promise<void>,
) {
  return httpFileRequestHandler(
    htmlFileRequestHandlerOptions(htmlFile, reloader, renderHandler),
  );
}

function htmlFileRequestHandlerOptions(
  htmlFile: string,
  reloader: HttpReloader,
  renderHandler: () => Promise<void>,
): HttpFileRequestOptions {
  return {
    baseDir: dirname(htmlFile),
    defaultFile: basename(htmlFile),
    printUrls: "404",
    onRequest: async (req: ServerRequest) => {
      if (reloader.handle(req)) {
        await reloader.connect(req);
        return true;
      } else if (req.url.startsWith("/quarto-render/")) {
        await req.respond(httpContentResponse("rendered"));
        await renderHandler();
        return true;
      } else {
        return false;
      }
    },
    onFile: async (file: string) => {
      if (isHtmlContent(file)) {
        const fileContents = await Deno.readFile(file);
        return reloader.injectClient(fileContents);
      }
    },
  };
}

function htmlReloadFiles(result: RenderForPreviewResult) {
  return [result.outputFile].concat(result.resourceFiles);
}

const kPdfJsInitialPath = "web/viewer.html";
const kPdfJsDefaultFile = "compressed.tracemonkey-pldi-09.pdf";
const kPdfJsViewerToolbarButtonSelector = `.toolbarButton,
.dropdownToolbarButton,
.secondaryToolbarButton,
.overlayButton {`;

// NOTE: pdfjs uses the \pdftrailerid{} (if defined, and this macro only works for pdflatex)
// as the context for persisting user prefs. this is read in the "fingerprint" method of
// PDFDocument (on ~ line 12100 of pdf.worker.js). if we want to preserve the user's prefs
// (e.g. zoom level, sidebar, etc.) we need to provide this either by injecting \pdftrailerid
// into rendered pdfs or by patching PDFDocument to always return the same fingerprint
// (which is what we do below)

function pdfFileRequestHandler(
  pdfFile: string,
  reloader: HttpReloader,
  renderHandler: () => Promise<void>,
) {
  // start w/ the html handler (as we still need it's http reload injection)
  const pdfOptions = htmlFileRequestHandlerOptions(
    pdfFile,
    reloader,
    renderHandler,
  );

  // change the baseDir to the pdfjs directory
  pdfOptions.baseDir = formatResourcePath("pdf", "pdfjs");

  // leave the default file alone for now (not currently relevant
  // since we are currently sending users directly to web/viewer.html)

  // tweak the file handler to substitute our pdf for the default one
  const htmlOnFile = pdfOptions.onFile;
  pdfOptions.onFile = async (file: string, req: ServerRequest) => {
    // base behavior (injects the reloader into html files)
    const contents = await htmlOnFile!(file, req);
    if (contents) {
      return contents;
    }
    const previewPath = (dir: string, file: string) => {
      return pathWithForwardSlashes(join(pdfOptions.baseDir, dir, file));
    };

    // tweak viewer.js to point to our pdf and force the sidebar off
    if (file === previewPath("web", "viewer.js")) {
      let viewerJs = Deno.readTextFileSync(file)
        .replace(
          kPdfJsDefaultFile,
          basename(pdfFile),
        );
      // always hide the sidebar in the viewer pane
      const referrer = req.headers.get("Referer");
      const isViewer = referrer && referrer.includes("viewer_pane=1");
      if (isViewer) {
        viewerJs = viewerJs.replace(
          "sidebarView: sidebarView",
          "sidebarView: _ui_utils.SidebarView.NONE",
        );
      }

      return new TextEncoder().encode(viewerJs);
    } else if (file == previewPath("web", "viewer.css")) {
      const viewerCss = normalizeNewlines(Deno.readTextFileSync(file))
        .replace(
          kPdfJsViewerToolbarButtonSelector,
          kPdfJsViewerToolbarButtonSelector + "\n  z-index: 199;",
        );
      return new TextEncoder().encode(viewerCss);

      // tweak pdf.worker.js to always return the same fingerprint
      // (preserve user viewer prefs across reloads)
    } else if (file === previewPath("build", "pdf.worker.js")) {
      const filePathHash = "quarto-preview-pdf-" +
        md5Hash(pdfFile);
      const workerJs = Deno.readTextFileSync(file).replace(
        /(key: "fingerprint",\s+get: function get\(\) {\s+)(var hash;)/,
        `$1return "${filePathHash}"; $2`,
      );
      return new TextEncoder().encode(workerJs);
    } // read requests for our pdf for the pdfFile
    else if (file === previewPath("web", basename(pdfFile))) {
      return Deno.readFileSync(pdfFile);
    }
  };

  return httpFileRequestHandler(pdfOptions);
}

function pdfReloadFiles(result: RenderForPreviewResult) {
  return [result.outputFile];
}
