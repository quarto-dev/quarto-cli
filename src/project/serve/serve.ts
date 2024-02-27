/*
 * serve.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { info, warning } from "../../deno_ral/log.ts";
import { existsSync } from "fs/mod.ts";
import { basename, dirname, extname, join, relative } from "../../deno_ral/path.ts";
import * as colors from "fmt/colors.ts";

import * as ld from "../../core/lodash.ts";

import { DOMParser, initDenoDom } from "../../core/deno-dom.ts";

import { openUrl } from "../../core/shell.ts";
import {
  contentType,
  isDocxContent,
  isHtmlContent,
  isPdfContent,
  isTextContent,
} from "../../core/mime.ts";
import { dirAndStem, isModifiedAfter } from "../../core/path.ts";
import { logError } from "../../core/log.ts";

import {
  kProject404File,
  kProjectType,
  ProjectContext,
} from "../../project/types.ts";
import { resolvePreviewOptions } from "../../command/preview/preview.ts";

import {
  isProjectInputFile,
  projectExcludeDirs,
  projectOutputDir,
  projectPreviewServe,
} from "../../project/project-shared.ts";
import { projectContext } from "../../project/project-context.ts";
import { partitionedMarkdownForInput } from "../../project/project-config.ts";

import {
  clearProjectIndex,
  inputFileForOutputFile,
  resolveInputTarget,
} from "../../project/project-index.ts";

import { websitePath } from "../../project/types/website/website-config.ts";

import { renderProject } from "../../command/render/project.ts";
import {
  renderResultFinalOutput,
  renderResultUrlPath,
} from "../../command/render/render.ts";

import {
  httpContentResponse,
  httpFileRequestHandler,
  isBrowserPreviewable,
} from "../../core/http.ts";
import { HttpFileRequestOptions } from "../../core/http-types.ts";
import { ProjectWatcher, ServeOptions } from "./types.ts";
import { watchProject } from "./watch.ts";
import {
  isPreviewRenderRequest,
  isPreviewTerminateRequest,
  previewRenderRequest,
  previewRenderRequestIsCompatible,
} from "../../command/preview/preview.ts";
import {
  previewUnableToRenderResponse,
  printWatchingForChangesMessage,
  render,
  renderToken,
} from "../../command/render/render-shared.ts";
import { renderServices } from "../../command/render/render-services.ts";
import { renderProgress } from "../../command/render/render-info.ts";
import { resourceFilesFromFile } from "../../command/render/resources.ts";
import { projectType } from "../../project/types/project-types.ts";
import { htmlResourceResolverPostprocessor } from "../../project/types/website/website-resources.ts";
import { inputFilesDir } from "../../core/render.ts";
import { kResources, kTargetFormat } from "../../config/constants.ts";
import { resourcesFromMetadata } from "../../command/render/resources.ts";
import {
  RenderFlags,
  RenderOptions,
  RenderResult,
} from "../../command/render/types.ts";
import {
  kPdfJsInitialPath,
  pdfJsBaseDir,
  pdfJsFileHandler,
} from "../../core/pdfjs.ts";
import { isPdfOutput } from "../../config/format.ts";
import { bookOutputStem } from "../../project/types/book/book-shared.ts";
import { removePandocToArg } from "../../command/render/flags.ts";
import { isRStudioServer, isServerSession } from "../../core/platform.ts";
import { ServeRenderManager } from "./render.ts";
import { projectScratchPath } from "../project-scratch.ts";
import {
  previewEnsureResources,
  previewMonitorResources,
} from "../../core/quarto.ts";
import { exitWithCleanup, onCleanup } from "../../core/cleanup.ts";
import { projectExtensionDirs } from "../../extension/extension.ts";
import { findOpenPort } from "../../core/port.ts";
import { kLocalhost } from "../../core/port-consts.ts";
import { ProjectServe } from "../../resources/types/schema-types.ts";
import { handleHttpRequests } from "../../core/http-server.ts";
import { touch } from "../../core/file.ts";
import { staticResource } from "../../preview/preview-static.ts";
import { previewTextContent } from "../../preview/preview-text.ts";
import { kManuscriptType } from "../types/manuscript/manuscript-types.ts";
import {
  previewURL,
  printBrowsePreviewMessage,
} from "../../core/previewurl.ts";
import {
  noPreviewServer,
  PreviewServer,
  runExternalPreviewServer,
} from "../../preview/preview-server.ts";
import { notebookContext } from "../../render/notebook/notebook-context.ts";

export const kRenderNone = "none";
export const kRenderDefault = "default";

export async function serveProject(
  target: string | ProjectContext,
  renderOptions: RenderOptions,
  pandocArgs: string[],
  options: ServeOptions,
  noServe: boolean,
) {
  let project: ProjectContext | undefined;
  let flags = renderOptions.flags;
  const nbContext = renderOptions.services.notebook;
  if (typeof target === "string") {
    if (target === ".") {
      target = Deno.cwd();
    }
    project = await projectContext(
      target,
      nbContext,
      renderOptions,
    );
    if (!project || !project?.config) {
      throw new Error(`${target} is not a project`);
    }

    const isDocusaurusMd = (
      format?: string | Record<string, unknown> | unknown,
    ) => {
      if (!format) {
        return false;
      }

      if (typeof format === "string") {
        return format === "docusaurus-md";
      } else if (typeof format === "object") {
        const formats = Object.keys(format);
        if (formats.length > 0) {
          const firstFormat = Object.keys(format)[0];
          return firstFormat === "docusaurus-md";
        } else {
          return false;
        }
      } else {
        return false;
      }
    };

    // Default project types can't be served
    const projType = projectType(project?.config?.project?.[kProjectType]);
    if (
      projType.type === "default" && !isDocusaurusMd(project?.config?.format)
    ) {
      const hasIndex = project.files.input.some((file) => {
        let relPath = file;
        if (project) {
          relPath = relative(project.dir, file);
        }
        const [dir, stem] = dirAndStem(relPath);
        return dir === "." && stem === "index";
      });

      if (!hasIndex && options.browser !== false) {
        throw new Error(
          `The project '${
            project.config.project.title || ""
          }' is a default type project which doesn't support project wide previewing unless there is an 'index' file present.\n\nPlease preview an individual file within this project instead.`,
        );
      }
    }
  } else {
    project = target;
  }

  // acquire the preview lock
  acquirePreviewLock(project);

  // monitor the src dir
  previewEnsureResources();
  previewMonitorResources();

  // clear the project index
  clearProjectIndex(project.dir);

  // set QUARTO_PROJECT_DIR
  Deno.env.set("QUARTO_PROJECT_DIR", project.dir);

  // resolve options
  options = {
    ...options,
    ...(await resolvePreviewOptions(options, project)),
  };

  // are we rendering?
  const renderBefore = options.render !== kRenderNone;
  if (renderBefore) {
    renderProgress("Rendering:");
  } else {
    renderProgress("Preparing to preview");
  }

  // get 'to' from --render
  flags = {
    ...flags,
    ...(renderBefore && options.render !== kRenderDefault)
      ? { to: options.render }
      : {},
  };

  // if there is no flags 'to' then set 'to' to the default format
  if (flags.to === undefined) {
    flags.to = kRenderDefault;
  }

  // are we targeting pdf output?
  const pdfOutput = isPdfOutput(flags.to || "");

  // Configure render services
  const services = renderServices(nbContext);

  // determines files to render and resourceFiles to monitor
  // if we are in render 'none' mode then only render files whose output
  // isn't up to date. for those files we aren't rendering, compute their
  // resource files so we can watch them for changes
  let files: string[] | undefined;
  let resourceFiles: string[] = [];
  if (!renderBefore) {
    // if this is pdf output then we need to render all of the files
    // so that the latex compiler can build the entire book
    if (pdfOutput) {
      files = project.files.input;
    } else {
      const srvFiles = await serveFiles(project);
      files = srvFiles.files;
      resourceFiles = srvFiles.resourceFiles;
    }
  }

  let renderResult;
  try {
    renderResult = await renderProject(
      project,
      {
        services,
        progress: true,
        useFreezer: !renderBefore,
        flags,
        pandocArgs,
        previewServer: true,
      },
      files,
    );
  } finally {
    services.cleanup();
  }

  // exit if there was an error
  if (renderResult.error) {
    throw renderResult.error;
  }

  // append resource files from render results
  resourceFiles.push(...ld.uniq(
    renderResult.files.flatMap((file) => file.resourceFiles),
  ) as string[]);

  // scan for extension dirs
  const extensionDirs = projectExtensionDirs(project);

  // render manager for tracking need to re-render outputs
  // (record any files we just rendered)
  const renderManager = new ServeRenderManager();
  renderManager.onRenderResult(
    renderResult,
    extensionDirs,
    resourceFiles,
    project,
  );

  // stop server function (will be reset if there is a serve action)
  let stopServer = () => {};

  // create project watcher. later we'll figure out if it should provide renderOutput
  const watcher = await watchProject(
    project,
    extensionDirs,
    resourceFiles,
    { ...renderOptions, flags },
    pandocArgs,
    options,
    !pdfOutput, // we don't render on reload for pdf output
    renderManager,
    stopServer,
  );

  // print status
  printWatchingForChangesMessage();

  // are we serving? are we using a custom serve command?
  const serve = noServe ? false : projectPreviewServe(project) || true;
  const previewServer = serve === false
    ? await noPreviewServer()
    : serve === true
    ? await internalPreviewServer(
      project,
      renderResult,
      renderManager,
      pdfOutput,
      watcher,
      extensionDirs,
      resourceFiles,
      flags,
      pandocArgs,
      options,
    )
    : await externalPreviewServer(
      project,
      serve,
      options,
      renderManager,
      watcher,
      extensionDirs,
      resourceFiles,
      flags,
      pandocArgs,
    );

  // set stopServer hook
  stopServer = previewServer.stop;

  // start server (launch browser if a path is returned)
  const path = await previewServer.start();

  if (path !== undefined) {
    printBrowsePreviewMessage(
      options.host!,
      options.port!,
      path,
    );

    if (options.browser && !isServerSession()) {
      await openUrl(previewURL(options.host!, options.port!, path));
    }
  }

  // register the stopServer function as a cleanup handler
  onCleanup(stopServer);

  // if there is a touchPath then touch
  if (options.touchPath) {
    await touch(options.touchPath);
  }

  // run the server
  await previewServer.serve();
}

function externalPreviewServer(
  project: ProjectContext,
  serve: ProjectServe,
  options: ServeOptions,
  renderManager: ServeRenderManager,
  watcher: ProjectWatcher,
  extensionDirs: string[],
  resourceFiles: string[],
  flags: RenderFlags,
  pandocArgs: string[],
): Promise<PreviewServer> {
  // run a control channel server for handling render requests
  // if there was a renderToken() passed
  let controlListener: Deno.Listener | undefined;
  if (renderToken()) {
    const outputDir = projectOutputDir(project);
    const handlerOptions: HttpFileRequestOptions = {
      //  base dir
      baseDir: outputDir,

      // handle websocket upgrade and render requests
      onRequest: previewControlChannelRequestHandler(
        project,
        renderManager,
        watcher,
        extensionDirs,
        resourceFiles,
        flags,
        pandocArgs,
        false,
      ),
    };

    const handler = httpFileRequestHandler(handlerOptions);
    const port = findOpenPort();
    controlListener = Deno.listen({ port, hostname: kLocalhost });
    handleHttpRequests(controlListener, handler).then(() => {
      // terminanted
    }).catch((_error) => {
      // ignore errors
    });
    info(`Preview service running (${port})`);
  }

  // parse command line args and interpolate host and port
  const cmd = serve.cmd.split(/[\t ]/).map((arg, index) => {
    if (Deno.build.os === "windows" && index === 0 && arg === "npm") {
      return "npm.cmd";
    } else if (arg === "{host}") {
      return options.host || kLocalhost;
    } else if (arg === "{port}") {
      return String(options.port);
    } else {
      return arg;
    }
  });
  // add custom args
  if (serve.args) {
    cmd.push(...serve.args);
  }

  const readyPattern = new RegExp(serve.ready);
  const server = runExternalPreviewServer({
    cmd,
    readyPattern,
    env: serve.env,
    cwd: projectOutputDir(project),
  });

  return Promise.resolve({
    start: async () => {
      return server.start();
    },
    serve: async () => {
      return server.serve();
    },
    stop: () => {
      if (controlListener) {
        controlListener.close();
      }
      return server.stop();
    },
  });
}

async function internalPreviewServer(
  project: ProjectContext,
  renderResult: RenderResult,
  renderManager: ServeRenderManager,
  pdfOutput: boolean,
  watcher: ProjectWatcher,
  extensionDirs: string[],
  resourceFiles: string[],
  flags: RenderFlags,
  pandocArgs: string[],
  options: ServeOptions,
): Promise<PreviewServer> {
  const projType = projectType(project?.config?.project?.[kProjectType]);

  const outputDir = projectOutputDir(project);

  const finalOutput = renderResultFinalOutput(renderResult);

  // function that can return the current target pdf output file
  const pdfOutputFile = (finalOutput && pdfOutput)
    ? (): string => {
      const project = watcher.project();
      if (projType.type == kManuscriptType) {
        // For manuscripts, just use the final output as is
        return finalOutput;
      } else {
        const outputFile = join(
          dirname(finalOutput),
          bookOutputStem(project.dir, project.config) + ".pdf",
        );
        return outputFile;
      }
    }
    : undefined;

  const handlerOptions: HttpFileRequestOptions = {
    //  base dir
    baseDir: outputDir,

    // print all urls
    printUrls: "all",

    // handle websocket upgrade and render requests
    onRequest: previewControlChannelRequestHandler(
      project,
      renderManager,
      watcher,
      extensionDirs,
      resourceFiles,
      flags,
      pandocArgs,
      isBrowserPreviewable(finalOutput),
    ),

    // handle html file requests w/ re-renders
    onFile: async (file: string, req: Request) => {
      // check for static response
      const baseDir = projectOutputDir(project);

      const staticResponse = await staticResource(baseDir, file);
      if (staticResponse) {
        const resolveBody = () => {
          if (staticResponse.injectClient) {
            const contents = new TextDecoder().decode(staticResponse.contents);
            return staticResponse.injectClient(
              contents,
              watcher.clientHtml(req),
            );
          } else {
            return staticResponse.contents;
          }
        };
        const body = resolveBody();
        const response = {
          body,
          contentType: staticResponse.contentType,
        };
        return response;
      } else if (
        isHtmlContent(file) || isPdfContent(file) || isDocxContent(file) ||
        isTextContent(file)
      ) {
        // find the input file associated with this output and render it
        // if we can't find an input file for this .html file it may have
        // been an input added after the server started running, to catch
        // this case run a refresh on the watcher then try again
        const serveDir = projectOutputDir(watcher.project());
        const filePathRelative = relative(serveDir, file);
        let inputFile = await inputFileForOutputFile(
          watcher.project(),
          filePathRelative,
        );
        if (!inputFile || !existsSync(inputFile.file)) {
          inputFile = await inputFileForOutputFile(
            await watcher.refreshProject(),
            filePathRelative,
          );
        }
        let result: RenderResult | undefined;
        let renderError: Error | undefined;
        if (inputFile) {
          // render the file if we haven't already done a render for the current input state
          if (
            renderManager.fileRequiresReRender(
              file,
              inputFile.file,
              extensionDirs,
              resourceFiles,
              watcher.project(),
            )
          ) {
            const renderFlags = { ...flags, quiet: true };
            // remove 'to' argument to allow the file to be rendered in it's default format
            // (only if we are in a project type e.g. websites that allows multiple formats)
            const renderPandocArgs = projType.projectFormatsOnly
              ? pandocArgs
              : removePandocToArg(pandocArgs);
            if (!projType.projectFormatsOnly) {
              delete renderFlags?.to;
            }
            // if to is 'all' then choose html
            if (renderFlags?.to == "all") {
              renderFlags.to = isHtmlContent(file) ? "html" : "pdf";
            }

            // When previewing, the project type can request that the format that produced
            // the output that is being requested should always be used to render the file
            if (projType.incrementalFormatPreviewing) {
              renderFlags.to = inputFile.format.identifier[kTargetFormat];
              delete renderFlags?.clean;
            }

            const services = renderServices(notebookContext());
            try {
              result = await renderManager.submitRender(() =>
                renderProject(
                  watcher.project(),
                  {
                    services,
                    useFreezer: true,
                    devServerReload: true,
                    flags: renderFlags,
                    pandocArgs: renderPandocArgs,
                  },
                  [inputFile!.file],
                )
              );
              if (result.error) {
                renderManager.onRenderError(result.error);
                renderError = result.error;
              } else {
                renderManager.onRenderResult(
                  result,
                  extensionDirs,
                  resourceFiles,
                  project!,
                );
              }
            } catch (e) {
              logError(e);
              renderError = e;
            } finally {
              services.cleanup();
            }
          }
        }

        // read the output file
        const fileContents = renderError
          ? renderErrorPage(renderError)
          : Deno.readFileSync(file);

        // inject watcher client for html
        if (isHtmlContent(file) && inputFile) {
          const projInputFile = join(
            project!.dir,
            relative(watcher.project().dir, inputFile.file),
          );
          return watcher.injectClient(
            req,
            fileContents,
            projInputFile,
          );
        } else if (isTextContent(file) && inputFile) {
          return previewTextContent(
            file,
            inputFile.file,
            inputFile.format,
            req,
            watcher.injectClient,
          );
        } else {
          return { contentType: contentType(file), body: fileContents };
        }
      } else {
        return undefined;
      }
    },

    // handle 404 by returing site custom 404 page
    on404: (url: string, req: Request) => {
      const print = !basename(url).startsWith("jupyter-");
      let body = new TextEncoder().encode("Not Found");
      const custom404 = join(outputDir, kProject404File);
      if (existsSync(custom404)) {
        let content404 = Deno.readTextFileSync(custom404);
        // replace site-path references with / so they work in dev server mode
        const sitePath = websitePath(project?.config);
        if (sitePath !== "/" || isRStudioServer()) {
          // if we are in rstudio server port proxied mode then replace
          // including the port proxy
          let replacePath = "/";
          const referer = req.headers.get("referer");
          if (isRStudioServer() && referer) {
            const match = referer.match(/\/p\/.*?\//);
            if (match) {
              replacePath = match[0];
            }
          }

          content404 = content404.replaceAll(
            new RegExp('((?:content|ref|src)=")(' + sitePath + ")", "g"),
            "$1" + replacePath,
          );
        }
        body = new TextEncoder().encode(content404);
      }
      return {
        print,
        response: watcher.injectClient(req, body),
      };
    },
  };

  // if this is a pdf then we tweak the options to correctly handle pdfjs
  if (finalOutput && pdfOutput) {
    // change the baseDir to the pdfjs directory
    handlerOptions.baseDir = pdfJsBaseDir();

    // install custom handler for pdfjs
    handlerOptions.onFile = pdfJsFileHandler(
      pdfOutputFile!,
      async (file: string, req: Request) => {
        // inject watcher client for html
        if (isHtmlContent(file)) {
          const fileContents = await Deno.readFile(file);
          return watcher.injectClient(req, fileContents);
        } else {
          return undefined;
        }
      },
    );
  }

  // create the handler
  const handler = httpFileRequestHandler(handlerOptions);

  // if we are passed a browser path, resolve the output file if its an input
  let browserPath = options.browserPath
    ? options.browserPath.replace(/^\//, "")
    : undefined;
  if (browserPath) {
    const browserPathTarget = await resolveInputTarget(
      project,
      browserPath,
      false,
    );
    if (browserPathTarget) {
      browserPath = browserPathTarget.outputHref;
    }
  }

  // compute browse url
  const targetPath = browserPath
    ? browserPath
    : pdfOutput
    ? kPdfJsInitialPath
    : renderResultUrlPath(renderResult);

  // print browse url and open browser if requested
  const path = (targetPath && targetPath !== "index.html") ? targetPath : "";

  // start listening
  const listener = Deno.listen({ port: options.port!, hostname: options.host });

  return {
    start: () => Promise.resolve(path),
    serve: async () => {
      await handleHttpRequests(listener, handler);
    },
    stop: () => {
      listener.close();
      return Promise.resolve();
    },
  };
}

function previewControlChannelRequestHandler(
  project: ProjectContext,
  renderManager: ServeRenderManager,
  watcher: ProjectWatcher,
  extensionDirs: string[],
  resourceFiles: string[],
  flags: RenderFlags,
  pandocArgs: string[],
  requireActiveClient: boolean,
): (req: Request) => Promise<Response | undefined> {
  return async (req: Request) => {
    if (watcher.handle(req)) {
      return await watcher.request(req);
    } else if (isPreviewTerminateRequest(req)) {
      exitWithCleanup(0);
    } else if (isPreviewRenderRequest(req)) {
      const prevReq = previewRenderRequest(
        req,
        requireActiveClient ? watcher.hasClients() : true,
        project!.dir,
      );
      if (
        prevReq &&
        (await previewRenderRequestIsCompatible(prevReq, flags.to, project))
      ) {
        if (isProjectInputFile(prevReq.path, project!)) {
          const services = renderServices(notebookContext());
          // if there is no specific format requested then 'all' needs
          // to become 'html' so we don't render all formats
          const to = flags.to === "all" ? (prevReq.format || "html") : flags.to;
          renderManager.submitRender(() =>
            render(prevReq.path, {
              services,
              flags: { ...flags, to },
              pandocArgs,
              previewServer: true,
            })
          ).then((result) => {
            if (result.error) {
              renderManager.onRenderError(result.error);
            } else {
              // print output created
              const finalOutput = renderResultFinalOutput(
                result,
                dirname(prevReq.path),
              );
              if (!finalOutput) {
                throw new Error(
                  "No output created by quarto render " +
                    basename(prevReq.path),
                );
              }

              renderManager.onRenderResult(
                result,
                extensionDirs,
                resourceFiles,
                watcher.project(),
              );

              info("Output created: " + finalOutput + "\n");

              // notify user we are watching for reload
              printWatchingForChangesMessage();

              watcher.reloadClients(
                true,
                !isPdfContent(finalOutput)
                  ? join(dirname(prevReq.path), finalOutput)
                  : undefined,
              );
            }
          }).finally(() => {
            services.cleanup();
          });
          return httpContentResponse("rendered");
          // if this is a plain markdown file w/ an external preview server
          // then just return success (it's already been saved as a
          // precursor to the render)
        } else if (
          extname(prevReq.path) === ".md" && projectPreviewServe(project)
        ) {
          return httpContentResponse("rendered");
        } else {
          return previewUnableToRenderResponse();
        }
      } else {
        return previewUnableToRenderResponse();
      }
    } else {
      return undefined;
    }
  };
}

// https://deno.com/blog/v1.23#remove-unstable-denosleepsync-api
function sleepSync(timeout: number) {
  const sab = new SharedArrayBuffer(1024);
  const int32 = new Int32Array(sab);
  Atomics.wait(int32, 0, 0, timeout);
}

function acquirePreviewLock(project: ProjectContext) {
  // get lockfile
  const lockfile = previewLockFile(project);

  // if there is a lockfile send a kill signal to the pid therin
  if (existsSync(lockfile)) {
    const pid = parseInt(Deno.readTextFileSync(lockfile)) || undefined;
    if (pid) {
      info(
        colors.bold(colors.blue("Terminating existing preview server....")),
        { newline: false },
      );
      try {
        Deno.kill(pid, "SIGTERM");
        sleepSync(3000);
      } catch {
        //
      } finally {
        info(colors.bold(colors.blue("DONE\n")));
      }
    }
  }

  // write our pid to the lockfile
  Deno.writeTextFileSync(lockfile, String(Deno.pid));

  // rmeove the lockfile when we exit
  onCleanup(() => releasePreviewLock(project));
}

function releasePreviewLock(project: ProjectContext) {
  try {
    Deno.removeSync(previewLockFile(project));
  } catch {
    //
  }
}

function previewLockFile(project: ProjectContext) {
  return projectScratchPath(project.dir, join("preview", "lock"));
}

function renderErrorPage(e: Error) {
  const content = `
<!doctype html>
<html lang=en>
<head>
<meta charset=utf-8>
<title>Quarto Render Error</title>
<script id="quarto-render-error" type="text/plain">${e.message}</script>
</head>
<body>
</body>
</html>
`;
  return new TextEncoder().encode(content);
}

async function serveFiles(
  project: ProjectContext,
): Promise<{ files: string[]; resourceFiles: string[] }> {
  const projType = projectType(project.config?.project?.[kProjectType]);

  // one time denoDom init
  await initDenoDom();

  const files: string[] = [];
  const resourceFiles: string[] = [];
  for (let i = 0; i < project.files.input.length; i++) {
    const inputFile = project.files.input[i];
    const projRelative = relative(project.dir, inputFile);
    const target = await resolveInputTarget(project, projRelative, false);
    if (target) {
      const outputFile = join(projectOutputDir(project), target?.outputHref);
      if (
        isModifiedAfter(inputFile, outputFile) ||
        projType.previewSkipUnmodified === false // Project types can force not skipping the rendering of files
      ) {
        // render this file
        files.push(inputFile);
      } else {
        // we aren't rendering this file, so we need to compute it's resource files
        // for monitoring during serve

        // resource files referenced in html
        const outputResources: string[] = [];
        if (isHtmlContent(outputFile)) {
          const htmlInput = Deno.readTextFileSync(outputFile);
          const doc = new DOMParser().parseFromString(htmlInput, "text/html")!;
          const resolver = htmlResourceResolverPostprocessor(
            inputFile,
            project,
          );
          outputResources.push(...(await resolver(doc)).resources);
        }

        // partition markdown and read globs
        const partitioned = await partitionedMarkdownForInput(
          project,
          projRelative,
        );
        const globs: string[] = [];
        if (partitioned?.yaml) {
          const metadata = partitioned.yaml;
          globs.push(...resourcesFromMetadata(metadata[kResources]));
        }

        // compute resource refs and add them
        resourceFiles.push(
          ...(await resourceFilesFromFile(
            project.dir,
            projectExcludeDirs(project),
            projRelative,
            { files: outputResources, globs },
            false, // selfContained,
            [join(dirname(projRelative), inputFilesDir(projRelative))],
            partitioned,
          )),
        );
      }
    } else {
      warning("Unabled to resolve output target for " + inputFile);
    }
  }

  return { files, resourceFiles: ld.uniq(resourceFiles) as string[] };
}
