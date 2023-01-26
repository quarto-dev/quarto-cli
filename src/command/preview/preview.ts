/*
* preview.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/

import { info, warning } from "log/mod.ts";
import {
  basename,
  dirname,
  extname,
  isAbsolute,
  join,
  relative,
} from "path/mod.ts";
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
  serveRedirect,
} from "../../core/http.ts";
import { HttpDevServer, httpDevServer } from "../../core/http-devserver.ts";
import {
  isHtmlContent,
  isPdfContent,
  isTextContent,
  kTextXml,
} from "../../core/mime.ts";
import { PromiseQueue } from "../../core/promise.ts";
import { inputFilesDir } from "../../core/render.ts";

import {
  kQuartoRenderCommand,
  previewUnableToRenderResponse,
  previewURL,
  printBrowsePreviewMessage,
  printWatchingForChangesMessage,
  render,
  renderServices,
  renderToken,
  rswURL,
} from "../render/render-shared.ts";
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
  kProjectWatchInputs,
  ProjectContext,
  resolvePreviewOptions,
} from "../../project/types.ts";
import { projectOutputDir } from "../../project/project-shared.ts";
import { projectContext } from "../../project/project-context.ts";
import { normalizePath, pathWithForwardSlashes } from "../../core/path.ts";
import {
  isJupyterHubServer,
  isRStudioServer,
  isRStudioWorkbench,
  isVSCodeServer,
  vsCodeServerProxyUri,
} from "../../core/platform.ts";
import { isJupyterNotebook } from "../../core/jupyter/jupyter.ts";
import { watchForFileChanges } from "../../core/watch.ts";
import {
  pandocBinaryPath,
  resourcePath,
  textHighlightThemePath,
} from "../../core/resources.ts";
import { execProcess } from "../../core/process.ts";
import { monitorPreviewTerminationConditions } from "../../core/quarto.ts";
import { exitWithCleanup } from "../../core/cleanup.ts";
import {
  extensionFilesFromDirs,
  inputExtensionDirs,
} from "../../extension/extension.ts";
import { kOutputFile } from "../../config/constants.ts";
import { isJatsOutput } from "../../config/format.ts";
import { kDefaultProjectFileContents } from "../../project/types/project-default.ts";

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
  const render = async () => {
    const services = renderServices();
    try {
      isRendering = true;
      return await renderForPreview(file, services, flags, pandocArgs, project);
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
    !isRStudioServer() && !isRStudioWorkbench() && !isJupyterHubServer() &&
    isBrowserPreviewable(result.outputFile)
  ) {
    await openUrl(previewURL(options.host!, options.port!, initialPath));
  }

  // print status
  await printBrowsePreviewMessage(options.host!, options.port!, initialPath);

  // watch for src changes in dev mode
  monitorPreviewTerminationConditions(stopServer);

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

      // re-render on extension change (as a mere reload won't reflect
      // the changes as they do w/ e.g. css files)
      watches.push({
        files: result.extensionFiles,
        handler: renderHandler,
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
          !isBrowserPreviewable(outputFile) || reloader.hasClients(),
        );
        if (
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
      const staticResponse = await staticResource(format, baseDir, file);
      if (staticResponse) {
        const resolveBody = () => {
          if (staticResponse.injectClient) {
            const client = reloader.clientHtml(
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
      } else if (isHtmlContent(file)) {
        // does the provide an alternate preview file?
        if (format.formatPreviewFile) {
          file = format.formatPreviewFile(file, format);
        }
        const fileContents = await Deno.readFile(file);
        return reloader.injectClient(req, fileContents, inputFile);
      } else if (isTextContent(file)) {
        if (isJatsOutput(format.pandoc)) {
          const xml = await jatsPreviewXml(file, req);
          return {
            contentType: kTextXml,
            body: new TextEncoder().encode(xml),
          };
        } else {
          const html = await textPreviewHtml(file, req);
          const fileContents = new TextEncoder().encode(html);
          return reloader.injectClient(req, fileContents, inputFile);
        }
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
  port: number,
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

// Static reources provide a list of 'special' resources that we should
// satisfy using internal resources
const kStaticResources = [
  {
    name: "quarto-jats-preview.css",
    contentType: "text/css",
    isActive: isJatsOutput,
  },
  {
    name: "quarto-jats-html.xsl",
    contentType: "text/xsl",
    isActive: isJatsOutput,
    injectClient: (contents: string, client: string) => {
      const protectedClient = client.replaceAll(
        /(<style.*?>)|(<script.*?>)/g,
        (substring: string) => {
          return `${substring}\n<![CDATA[`;
        },
      ).replaceAll(
        /(<\/style.*?>)|(<\/script.*?>)/g,
        (substring: string) => {
          return `]]>\n${substring}`;
        },
      ).replaceAll("data-micromodal-close", 'data-micromodal-close="true"');

      const bodyContents = contents.replace(
        "<!-- quarto-after-body -->",
        protectedClient,
      );
      return new TextEncoder().encode(bodyContents);
    },
  },
];

const staticResource = async (
  format: Format,
  baseDir: string,
  file: string,
) => {
  const filename = relative(baseDir, file);
  const resource = kStaticResources.find((resource) => {
    return resource.isActive(format.pandoc) && resource.name === filename;
  });

  if (resource) {
    const path = resourcePath(join("preview", "jats", filename));
    const contents = await Deno.readFile(path);
    return {
      ...resource,
      contents,
    };
  }
};

async function jatsPreviewXml(file: string, _request: Request) {
  const fileContents = await Deno.readTextFile(file);

  // Attach the stylesheet
  let xmlContents = fileContents.replace(
    /<\?xml version="1.0" encoding="utf-8"\s*\?>/,
    '<?xml version="1.0" encoding="utf-8" ?>\n<?xml-stylesheet href="quarto-jats-html.xsl" type="text/xsl" ?>',
  );

  // Strip the DTD to disable the fetching of the DTD and validation (for preview)
  xmlContents = xmlContents.replace(
    /<!DOCTYPE((.|\n)*?)>/,
    "",
  );

  return xmlContents;
}
