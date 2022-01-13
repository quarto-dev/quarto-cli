/*
* serve.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { info, warning } from "log/mod.ts";
import { existsSync } from "fs/mod.ts";
import { basename, dirname, join, relative } from "path/mod.ts";

import { ld } from "lodash/mod.ts";
import { DOMParser, initDenoDom } from "../../core/deno-dom.ts";

import { openUrl } from "../../core/shell.ts";
import { isHtmlContent, isPdfContent } from "../../core/mime.ts";
import { isModifiedAfter } from "../../core/path.ts";
import { logError } from "../../core/log.ts";
import { PromiseQueue } from "../../core/promise.ts";

import {
  kProject404File,
  kProjectType,
  ProjectContext,
} from "../../project/types.ts";
import { projectOutputDir } from "../../project/project-shared.ts";
import {
  projectContext,
  projectIsWebsite,
} from "../../project/project-context.ts";
import { partitionedMarkdownForInput } from "../../project/project-config.ts";

import {
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
  HttpFileRequestOptions,
} from "../../core/http.ts";
import { ServeOptions } from "./types.ts";
import { copyProjectForServe } from "./serve-shared.ts";
import { watchProject } from "./watch.ts";
import {
  printBrowsePreviewMessage,
  printWatchingForChangesMessage,
  render,
  renderProgress,
  resourceFilesFromFile,
} from "../../command/render/render-shared.ts";
import { projectType } from "../../project/types/project-types.ts";
import { htmlResourceResolverPostprocessor } from "../../project/types/website/website-resources.ts";
import { inputFilesDir } from "../../core/render.ts";
import { kResources } from "../../config/constants.ts";
import { resourcesFromMetadata } from "../../command/render/resources.ts";
import { readYamlFromMarkdown } from "../../core/yaml.ts";
import { RenderFlags, RenderResult } from "../../command/render/types.ts";
import {
  kPdfJsInitialPath,
  pdfJsBaseDir,
  pdfJsFileHandler,
} from "../../core/pdfjs.ts";
import { isPdfOutput } from "../../config/format.ts";
import { bookOutputStem } from "../../project/types/book/book-config.ts";
import { removePandocToArg } from "../../command/render/flags.ts";
import { isJupyterHubServer, isRStudioServer } from "../../core/platform.ts";

const kQuartoRenderCommand = "90B3C9E8-0DBC-4BC0-B164-AA2D5C031B28";

export const kRenderNone = "none";
export const kRenderDefault = "default";

export async function serveProject(
  target: string | ProjectContext,
  flags: RenderFlags,
  pandocArgs: string[],
  options: ServeOptions,
) {
  let project: ProjectContext | undefined;
  if (typeof (target) === "string") {
    if (target === ".") {
      target = Deno.cwd();
    }
    project = await projectContext(target, flags, false, true);
    if (!project || !project?.config) {
      throw new Error(`${target} is not a website or book project`);
    }
  } else {
    project = target;
  }

  // confirm that it's a project type that can be served
  if (!projectIsWebsite(project)) {
    throw new Error(
      `Cannot serve project of type '${
        project?.config?.project[kProjectType] ||
        "default"
      }' (try using project type 'site').`,
    );
  }

  // get type
  const projType = projectType(project?.config?.project?.[kProjectType]);

  // provide defaults
  options = {
    browse: true,
    watchInputs: true,
    navigate: true,
    ...options,
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

  const renderResult = await renderProject(
    project,
    {
      progress: true,
      useFreezer: !renderBefore,
      flags,
      pandocArgs,
    },
    files,
  );

  // exit if there was an error
  if (renderResult.error) {
    throw renderResult.error;
  }

  const finalOutput = renderResultFinalOutput(renderResult);

  // create mirror of project for serving
  const serveDir = copyProjectForServe(project, true);
  const serveProject = (await projectContext(serveDir, flags, false, true))!;

  // append resource files from render results
  resourceFiles.push(...ld.uniq(
    renderResult.files.flatMap((file) => file.resourceFiles),
  ) as string[]);

  // create a promise queue so we only do one renderProject at a time
  const renderQueue = new PromiseQueue<RenderResult>();

  // function that can return the current target pdf output file
  const pdfOutputFile = (finalOutput && pdfOutput)
    ? (): string => {
      const project = watcher.project();
      return join(
        dirname(finalOutput),
        bookOutputStem(project.dir, project.config) + ".pdf",
      );
    }
    : undefined;

  // create project watcher. later we'll figure out if it should provide renderOutput
  const watcher = await watchProject(
    project,
    serveProject,
    resourceFiles,
    flags,
    pandocArgs,
    options,
    !pdfOutput, // we don't render on reload for pdf output
    renderQueue,
    pdfOutputFile,
  );

  // serve output dir
  const serveOutputDir = projectOutputDir(serveProject);

  const handlerOptions: HttpFileRequestOptions = {
    //  base dir
    baseDir: serveOutputDir,

    // print all urls
    printUrls: "all",

    // handle websocket upgrade and render requests
    onRequest: async (req: Request) => {
      if (watcher.handle(req)) {
        return await watcher.connect(req);
      } else if (req.url.includes(kQuartoRenderCommand)) {
        const match = req.url.match(
          new RegExp(`/${kQuartoRenderCommand}/(.*)$`),
        );
        if (match) {
          const path = join(project!.dir, match[1]);
          render(path, {
            flags,
            pandocArgs,
          }).then((result) => {
            if (result.error) {
              if (result.error?.message) {
                logError(result.error);
              }
            } else {
              // print output created
              const finalOutput = renderResultFinalOutput(result, project!.dir);
              if (!finalOutput) {
                throw new Error(
                  "No output created by quarto render " + basename(path),
                );
              }
              info("Output created: " + finalOutput + "\n");
            }
          });
        }
        return httpContentResponse("rendered");
      } else {
        return undefined;
      }
    },

    // handle html file requests w/ re-renders
    onFile: async (file: string) => {
      // if this is an html file or a pdf then re-render (using the freezer)
      if (isHtmlContent(file) || isPdfContent(file)) {
        // find the input file associated with this output and render it
        // if we can't find an input file for this .html file it may have
        // been an input added after the server started running, to catch
        // this case run a refresh on the watcher then try again
        const serveDir = projectOutputDir(watcher.serveProject());
        const filePathRelative = relative(serveDir, file);
        let inputFile = await inputFileForOutputFile(
          watcher.serveProject(),
          filePathRelative,
        );
        if (!inputFile || !existsSync(inputFile)) {
          inputFile = await inputFileForOutputFile(
            await watcher.refreshProject(),
            filePathRelative,
          );
        }
        let result: RenderResult | undefined;
        let renderError: Error | undefined;
        if (inputFile) {
          const renderFlags = { ...flags, quiet: true };
          // remove 'to' argument to allow the file to be rendered in it's default format
          // (only if we are in a project type e.g. websites that allows multiple formats)
          const renderPandocArgs = projType.projectFormatsOnly
            ? pandocArgs
            : removePandocToArg(pandocArgs);
          if (!projType.projectFormatsOnly) {
            delete renderFlags?.to;
          }
          try {
            result = await renderQueue.enqueue(() =>
              renderProject(
                watcher.serveProject(),
                {
                  useFreezer: true,
                  devServerReload: true,
                  flags: renderFlags,
                  pandocArgs: renderPandocArgs,
                },
                [inputFile!],
              )
            );
            if (result.error) {
              logError(result.error);
              renderError = result.error;
            }
          } catch (e) {
            logError(e);
            renderError = e;
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
            relative(watcher.serveProject().dir, inputFile),
          );
          return watcher.injectClient(
            fileContents,
            projInputFile,
          );
        } else {
          return fileContents;
        }
      } else {
        return undefined;
      }
    },

    // handle 404 by returing site custom 404 page
    on404: (url: string, req: Request) => {
      const print = !basename(url).startsWith("jupyter-");
      let body = new TextEncoder().encode("Not Found");
      const custom404 = join(serveOutputDir, kProject404File);
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
        body: watcher.injectClient(body),
      };
    },
  };

  // compute site url
  const siteUrl = `http://localhost:${options.port}/`;

  // print status
  printWatchingForChangesMessage();

  // compute browse url
  const targetPath = typeof (options.browse) === "string"
    ? options.browse
    : pdfOutput
    ? kPdfJsInitialPath
    : renderResultUrlPath(renderResult);

  // print browse url and open browser if requested
  printBrowsePreviewMessage(
    options.port,
    (targetPath && targetPath !== "index.html") ? targetPath : "",
  );

  if (options.browse && !isRStudioServer() && !isJupyterHubServer()) {
    const browseUrl = targetPath
      ? (targetPath === "index.html" ? siteUrl : siteUrl + targetPath)
      : siteUrl;
    await openUrl(browseUrl);
  }

  // if this is a pdf then we tweak the options to correctly handle pdfjs
  if (finalOutput && pdfOutput) {
    // change the baseDir to the pdfjs directory
    handlerOptions.baseDir = pdfJsBaseDir();

    // install custom handler for pdfjs
    handlerOptions.onFile = pdfJsFileHandler(
      pdfOutputFile!,
      async (file: string) => {
        // inject watcher client for html
        if (isHtmlContent(file)) {
          const fileContents = await Deno.readFile(file);
          return watcher.injectClient(fileContents);
        } else {
          return undefined;
        }
      },
    );
  }

  // serve project
  const handler = httpFileRequestHandler(handlerOptions);
  for await (
    const conn of Deno.listen({ port: options.port, hostname: options.host })
  ) {
    (async () => {
      for await (const { request, respondWith } of Deno.serveHttp(conn)) {
        respondWith(handler(request));
      }
    })();
  }
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
      if (isModifiedAfter(inputFile, outputFile)) {
        // render this file
        files.push(inputFile);
      } else {
        // we aren't rendering this file, so we need to compute it's resource files
        // for monitoring during serve

        // resource files referenced in html
        const files: string[] = [];
        if (isHtmlContent(outputFile)) {
          const htmlInput = Deno.readTextFileSync(outputFile);
          const doc = new DOMParser().parseFromString(htmlInput, "text/html")!;
          const resolver = htmlResourceResolverPostprocessor(
            inputFile,
            project,
          );
          files.push(...await resolver(doc));
        }

        // partition markdown and read globs
        const partitioned = await partitionedMarkdownForInput(
          project.dir,
          projRelative,
        );
        const globs: string[] = [];
        if (partitioned?.yaml) {
          const metadata = readYamlFromMarkdown(partitioned.yaml);
          globs.push(...resourcesFromMetadata(metadata[kResources]));
        }

        // compute resource refs and add them
        resourceFiles.push(
          ...(await resourceFilesFromFile(
            project.dir,
            projRelative,
            { files, globs },
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
