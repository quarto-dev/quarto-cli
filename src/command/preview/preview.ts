/*
 * preview.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { info, warning } from "log/mod.ts";
import { basename, dirname, isAbsolute, join, relative } from "path/mod.ts";
import { existsSync } from "fs/mod.ts";

import * as ld from "../../core/lodash.ts";

import { cssFileResourceReferences } from "../../core/css.ts";
import { logError } from "../../core/log.ts";
import { openUrl } from "../../core/shell.ts";
import {
  httpContentResponse,
  httpFileRequestHandler,
  isBrowserPreviewable,
  serveRedirect,
} from "../../core/http.ts";
import { HttpFileRequestOptions } from "../../core/http-types.ts";
import {
  HttpDevServer,
  httpDevServer,
  HttpDevServerRenderMonitor,
} from "../../core/http-devserver.ts";
import { isHtmlContent, isPdfContent, isTextContent } from "../../core/mime.ts";
import { PromiseQueue } from "../../core/promise.ts";
import { inputFilesDir } from "../../core/render.ts";

import { kQuartoRenderCommand } from "../render/constants.ts";

import {
  previewUnableToRenderResponse,
  printWatchingForChangesMessage,
  render,
  renderToken,
} from "../render/render-shared.ts";
import { renderServices } from "../render/render-services.ts";
import {
  RenderFlags,
  RenderResult,
  RenderResultFile,
  RenderServices,
} from "../render/types.ts";
import { renderFormats } from "../render/render-contexts.ts";
import { renderResultFinalOutput } from "../render/render.ts";
import { replacePandocArg } from "../render/flags.ts";

import { Format, isPandocFilter } from "../../config/types.ts";
import {
  kPdfJsInitialPath,
  pdfJsBaseDir,
  pdfJsFileHandler,
} from "../../core/pdfjs.ts";
import {
  kProjectType,
  kProjectWatchInputs,
  ProjectContext,
  ProjectPreview,
} from "../../project/types.ts";
import { projectOutputDir } from "../../project/project-shared.ts";
import { projectContext } from "../../project/project-context.ts";
import {
  normalizePath,
  pathWithForwardSlashes,
  safeExistsSync,
} from "../../core/path.ts";
import {
  isRStudio,
  isRStudioWorkbench,
  isServerSession,
  isVSCodeServer,
  vsCodeServerProxyUri,
} from "../../core/platform.ts";
import { isJupyterNotebook } from "../../core/jupyter/jupyter.ts";
import { watchForFileChanges } from "../../core/watch.ts";
import {
  previewEnsureResources,
  previewMonitorResources,
} from "../../core/quarto.ts";
import { exitWithCleanup } from "../../core/cleanup.ts";
import {
  extensionFilesFromDirs,
  inputExtensionDirs,
} from "../../extension/extension.ts";
import { kOutputFile, kTargetFormat } from "../../config/constants.ts";
import { mergeConfigs } from "../../core/config.ts";
import { kLocalhost } from "../../core/port-consts.ts";
import { findOpenPort, waitForPort } from "../../core/port.ts";
import { inputFileForOutputFile } from "../../project/project-index.ts";
import { staticResource } from "../../preview/preview-static.ts";
import { previewTextContent } from "../../preview/preview-text.ts";
import { projectType } from "../../project/types/project-types.ts";
import {
  previewURL,
  printBrowsePreviewMessage,
  rswURL,
} from "../../core/previewurl.ts";

export async function resolvePreviewOptions(
  options: ProjectPreview,
  project?: ProjectContext,
): Promise<ProjectPreview> {
  // start with project options if we have them
  if (project?.config?.project.preview) {
    options = mergeConfigs(project.config.project.preview, options);
  }
  // provide defaults
  const resolved = mergeConfigs({
    host: kLocalhost,
    browser: true,
    [kProjectWatchInputs]: !isRStudio(),
    timeout: 0,
    navigate: true,
  }, options) as ProjectPreview;

  // if a specific port is requested then wait for it up to 5 seconds
  if (resolved.port) {
    if (!await waitForPort({ port: resolved.port, hostname: resolved.host })) {
      throw new Error(`Requested port ${options.port} is already in use.`);
    }
  } else {
    resolved.port = findOpenPort();
  }

  return resolved;
}

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
  // see if this is project file
  const project = await projectContext(file);

  // determine the target format if there isn't one in the command line args
  // (current we force the use of an html or pdf based format)
  const format = await previewFormat(file, flags.to, project);
  setPreviewFormat(format, flags, pandocArgs);

  // render for preview (create function we can pass to watcher then call it)
  let isRendering = false;
  const render = async (to?: string) => {
    const renderFlags = { ...flags, to: to || flags.to };
    const services = renderServices();
    try {
      HttpDevServerRenderMonitor.onRenderStart();
      isRendering = true;
      const result = await renderForPreview(
        file,
        services,
        renderFlags,
        pandocArgs,
        project,
      );
      HttpDevServerRenderMonitor.onRenderStop(true);
      return result;
    } catch (error) {
      HttpDevServerRenderMonitor.onRenderStop(false);
      throw error;
    } finally {
      isRendering = false;
      services.cleanup();
    }
  };
  const result = await render();

  // resolve options (don't look at the project context b/c we
  // don't want overlapping ports within the same project)
  options = {
    ...options,
    ...(await resolvePreviewOptions(options)),
  };

  // create listener and callback to stop the server
  const listener = Deno.listen({ port: options.port!, hostname: options.host });
  const stopServer = () => listener.close();

  // ensure resources
  previewEnsureResources(stopServer);

  // create client reloader
  const reloader = httpDevServer(
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
      normalizePath(file),
      flags,
      result.format,
      options.port!,
      reloader,
      changeHandler.render,
    )
    : project
    ? projectHtmlFileRequestHandler(
      project,
      normalizePath(file),
      flags,
      result.format,
      reloader,
      changeHandler.render,
    )
    : htmlFileRequestHandler(
      result.outputFile,
      normalizePath(file),
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
  if (
    options.browser &&
    !isServerSession() &&
    isBrowserPreviewable(result.outputFile)
  ) {
    await openUrl(previewURL(options.host!, options.port!, initialPath));
  }

  // print status
  await printBrowsePreviewMessage(options.host!, options.port!, initialPath);

  // watch for src changes in dev mode
  previewMonitorResources(stopServer);

  // serve project
  for await (const conn of listener) {
    (async () => {
      try {
        for await (const { request, respondWith } of Deno.serveHttp(conn)) {
          await respondWith(handler(request));
        }
      } catch (err) {
        warning(err.message);
        try {
          conn.close();
        } catch {
          //
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

export function isPreviewTerminateRequest(req: Request) {
  const kTerminateToken = "4231F431-58D3-4320-9713-994558E4CC45";
  return req.url.includes(kTerminateToken);
}

export function previewRenderRequest(
  req: Request,
  hasClients: boolean,
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
        if (hasClients) {
          return {
            version: 2,
            path,
            format: url.searchParams.get("format") || undefined,
          };
        }
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
  } else {
    const format = await previewFormat(request.path, request.format, project);
    return format === flags.to;
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

export function handleRenderResult(
  file: string,
  renderResult: RenderResult,
  project?: ProjectContext,
) {
  // print output created
  const finalOutput = renderResultFinalOutput(
    renderResult,
    dirname(file),
  );
  if (!finalOutput) {
    throw new Error("No output created by quarto render " + basename(file));
  }
  const projType = project
    ? projectType(
      project.config?.project?.[kProjectType],
    )
    : undefined;

  if (projType && projType.filterOutputFile) {
    info(
      "Output created: " + projType.filterOutputFile(finalOutput) +
        "\n",
    );
  } else {
    info("Output created: " + finalOutput + "\n");
  }

  return finalOutput;
}

interface RenderForPreviewResult {
  file: string;
  format: Format;
  outputFile: string;
  extensionFiles: string[];
  resourceFiles: string[];
}

async function renderForPreview(
  file: string,
  services: RenderServices,
  flags: RenderFlags,
  pandocArgs: string[],
  project?: ProjectContext,
): Promise<RenderForPreviewResult> {
  // render
  const renderResult = await render(file, {
    services,
    flags,
    pandocArgs: pandocArgs,
    previewServer: true,
    setProjectDir: project !== undefined,
  });
  if (renderResult.error) {
    throw renderResult.error;
  }

  // print output created
  const finalOutput = handleRenderResult(file, renderResult, project);

  // notify user we are watching for reload
  printWatchingForChangesMessage();

  // determine files to watch for reload -- take the resource
  // files detected during render, chase down additional references
  // in css files, then filter out the _files dir
  file = normalizePath(file);
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

  // extension files
  const extensionFiles = extensionFilesFromDirs(
    inputExtensionDirs(file, project?.dir),
  );
  // shortcodes and filters (treat as extension files)
  extensionFiles.push(...renderResult.files.reduce(
    (extensionFiles: string[], file: RenderResultFile) => {
      const shortcodes = file.format.render.shortcodes || [];
      const filters = (file.format.pandoc.filters || []).map((filter) =>
        isPandocFilter(filter) ? filter.path : filter
      );
      const ipynbFilters = file.format.execute["ipynb-filters"] || [];
      [...shortcodes, ...filters.map((filter) => filter), ...ipynbFilters]
        .forEach((extensionFile) => {
          if (!isAbsolute(extensionFile)) {
            const extensionFullPath = join(dirname(file.input), extensionFile);
            if (existsSync(extensionFullPath)) {
              extensionFiles.push(normalizePath(extensionFullPath));
            }
          }
        });
      return extensionFiles;
    },
    [],
  ));

  return {
    file,
    format: renderResult.files[0].format,
    outputFile: join(dirname(file), finalOutput),
    extensionFiles,
    resourceFiles,
  };
}

interface ChangeHandler {
  render: () => Promise<RenderForPreviewResult | undefined>;
}

function createChangeHandler(
  result: RenderForPreviewResult,
  reloader: HttpDevServer,
  render: (to?: string) => Promise<RenderForPreviewResult | undefined>,
  renderOnChange: boolean,
): ChangeHandler {
  const renderQueue = new PromiseQueue<RenderForPreviewResult | undefined>();
  let watcher: Watcher | undefined;
  let lastResult = result;

  // render handler
  const renderHandler = async (to?: string) => {
    try {
      // if we have an alternate format then stop the watcher (as the alternate
      // output format will be one of the watched resource files!)
      if (to && watcher) {
        watcher.stop();
      }
      // render
      const result = await renderQueue.enqueue(async () => {
        return render(to);
      }, true);
      if (result) {
        sync(result);
      }

      return result;
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
  };

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
          handler: ld.debounce(renderHandler, 50),
        });
      }

      // re-render on extension change (as a mere reload won't reflect
      // the changes as they do w/ e.g. css files)
      watches.push({
        files: result.extensionFiles,
        handler: ld.debounce(renderHandler, 50),
      });

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
            return undefined;
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
  existsSync;
  watches = watches.map((watch) => {
    return {
      ...watch,
      files: watch.files.filter((s) => existsSync(s)).map((file) => {
        return normalizePath(file);
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
  renderHandler: (to?: string) => Promise<RenderForPreviewResult | undefined>,
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
      context,
    ),
  );
}

function htmlFileRequestHandler(
  htmlFile: string,
  inputFile: string,
  flags: RenderFlags,
  format: Format,
  reloader: HttpDevServer,
  renderHandler: (to?: string) => Promise<RenderForPreviewResult | undefined>,
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
  devserver: HttpDevServer,
  renderHandler: (to?: string) => Promise<RenderForPreviewResult | undefined>,
  project?: ProjectContext,
): HttpFileRequestOptions {
  // if we an alternate format on the fly we need to do a full re-render
  // to get the correct state back. this flag will be set whenever
  // we render an alternate format
  let invalidateDevServerReRender = false;
  return {
    baseDir,
    defaultFile,
    printUrls: "404",
    onRequest: async (req: Request) => {
      if (devserver.handle(req)) {
        return Promise.resolve(devserver.request(req));
      } else if (isPreviewTerminateRequest(req)) {
        exitWithCleanup(0);
      } else if (req.url.endsWith("/quarto-render/")) {
        // don't wait for the promise so the
        // caller gets an immediate reply
        renderHandler();
        return Promise.resolve(httpContentResponse("rendered"));
      } else if (isPreviewRenderRequest(req)) {
        const outputFile = format.pandoc[kOutputFile];
        const prevReq = previewRenderRequest(
          req,
          !isBrowserPreviewable(outputFile) || devserver.hasClients(),
        );
        if (
          !invalidateDevServerReRender &&
          prevReq &&
          existsSync(prevReq.path) &&
          normalizePath(prevReq.path) === normalizePath(inputFile) &&
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
      // check for static response
      const staticResponse = await staticResource(baseDir, file);
      if (staticResponse) {
        const resolveBody = () => {
          if (staticResponse.injectClient) {
            const client = devserver.clientHtml(
              req,
              inputFile,
            );
            const contents = new TextDecoder().decode(
              staticResponse.contents,
            );
            return staticResponse.injectClient(contents, client);
          } else {
            return staticResponse.contents;
          }
        };
        const body = resolveBody();

        return {
          body,
          contentType: staticResponse.contentType,
        };
      }

      // the 'format' passed to this function is for the default
      // render target, however this could be a request for another
      // render target (e.g. a link in the 'More Formats' section)
      // some of these formats might require rendering and/or may
      // have extended preview behavior (e.g. preview-type: raw)
      // in this case try to lookup the format and perform a render
      let renderFormat = format;
      if (project) {
        const input = await inputFileForOutputFile(
          project,
          relative(baseDir, file),
        );
        if (input) {
          renderFormat = input.format;
          if (renderFormat !== format && fileRequiresRender(input.file, file)) {
            invalidateDevServerReRender = true;
            await renderHandler(renderFormat.identifier[kTargetFormat]);
          }
        }
      }

      // https://github.com/quarto-dev/quarto-cli/issues/5215
      // return CORS requests as plain text so that OJS requests do
      // not have formatting
      if (
        req.headers.get("sec-fetch-dest") === "empty" &&
        req.headers.get("sec-fetch-mode") === "cors"
      ) {
        return;
      }

      if (isHtmlContent(file)) {
        // does the provide an alternate preview file?
        if (renderFormat.formatPreviewFile) {
          file = renderFormat.formatPreviewFile(file, renderFormat);
        }
        const fileContents = await Deno.readFile(file);
        return devserver.injectClient(req, fileContents, inputFile);
      } else if (isTextContent(file)) {
        return previewTextContent(
          file,
          inputFile,
          format,
          req,
          devserver.injectClient,
        );
      }
    },
  };
}

function fileRequiresRender(inputFile: string, outputFile: string) {
  if (safeExistsSync(outputFile)) {
    return (Deno.statSync(inputFile).mtime?.valueOf() || 0) >
      (Deno.statSync(outputFile).mtime?.valueOf() || 0);
  } else {
    return true;
  }
}

function resultReloadFiles(result: RenderForPreviewResult) {
  return [result.outputFile].concat(result.resourceFiles);
}

function pdfFileRequestHandler(
  pdfFile: string,
  inputFile: string,
  flags: RenderFlags,
  format: Format,
  port: number,
  reloader: HttpDevServer,
  renderHandler: () => Promise<RenderForPreviewResult | undefined>,
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

  if (pdfOptions.onRequest) {
    const onRequest = pdfOptions.onRequest;
    pdfOptions.onRequest = async (req: Request) => {
      if (new URL(req.url).pathname === "/") {
        const url = isRStudioWorkbench()
          ? await rswURL(port, kPdfJsInitialPath)
          : isVSCodeServer()
          ? vsCodeServerProxyUri()!.replace("{{port}}", `${port}`) +
            kPdfJsInitialPath
          : "/" + kPdfJsInitialPath;
        return Promise.resolve(serveRedirect(url));
      } else {
        return Promise.resolve(onRequest(req));
      }
    };
  }

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
    !ld.isEqual(result.extensionFiles, lastResult.extensionFiles) ||
    !ld.isEqual(result.resourceFiles, lastResult.resourceFiles);
}
