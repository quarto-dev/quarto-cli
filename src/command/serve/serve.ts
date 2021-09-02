/*
* serve.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { error, info, warning } from "log/mod.ts";
import { existsSync } from "fs/mod.ts";
import { basename, dirname, join, relative } from "path/mod.ts";

import { serve, ServerRequest } from "http/server.ts";

import { ld } from "lodash/mod.ts";
import { DOMParser } from "deno_dom/deno-dom-wasm.ts";

import { openUrl } from "../../core/shell.ts";
import { isHtmlContent } from "../../core/mime.ts";
import { isModifiedAfter, pathWithForwardSlashes } from "../../core/path.ts";
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

import { renderProject } from "../render/project.ts";
import { renderResultFinalOutput } from "../render/render.ts";

import { httpFileRequestHandler } from "../../core/http.ts";
import { ServeOptions } from "./types.ts";
import { copyProjectForServe } from "./serve-shared.ts";
import { watchProject } from "./watch.ts";
import {
  printBrowsePreviewMessage,
  printWatchingForChangesMessage,
  resourceFilesFromFile,
} from "../render/render-shared.ts";
import { htmlResourceResolverPostprocessor } from "../../project/types/website/website-resources.ts";
import { inputFilesDir } from "../../core/render.ts";
import { kResources } from "../../config/constants.ts";
import { resourcesFromMetadata } from "../render/resources.ts";
import { readYamlFromMarkdown } from "../../core/yaml.ts";
import { RenderFlags, RenderResult } from "../render/types.ts";

export const kRenderNone = "none";
export const kRenderDefault = "default";

export async function serveProject(
  projDir: string,
  flags: RenderFlags,
  pandocArgs: string[],
  options: ServeOptions,
) {
  const project = await projectContext(projDir, false, true);
  if (!project?.config) {
    throw new Error(`${projDir} is not a project`);
  }

  // confirm that it's a project type that can be served
  if (!projectIsWebsite(project)) {
    throw new Error(
      `Cannot serve project of type '${project.config.project[kProjectType] ||
        "default"}' (try using project type 'site').`,
    );
  }

  // provide defaults
  options = {
    browse: true,
    watch: true,
    navigate: true,
    ...options,
  };

  // are we rendering?
  const render = options.render !== kRenderNone;
  if (render) {
    info("Rendering:");
  } else {
    info("Preparing to preview");
  }

  // if we are in render 'none' mode then only render files whose output
  // isn't up to date. for those files we aren't rendering, compute their
  // resource files so we can watch them for changes
  const { files, resourceFiles } = render
    ? { files: undefined, resourceFiles: new Array<string>() }
    : await serveFiles(project);

  // render in the main directory
  const renderResult = await renderProject(
    project,
    {
      progress: true,
      useFreezer: !render,
      flags: {
        ...flags,
        ...(render && options.render !== kRenderDefault)
          ? { to: options.render }
          : {},
      },
      pandocArgs,
    },
    files,
  );

  // exit if there was an error
  if (renderResult.error) {
    throw error;
  }

  // create mirror of project for serving
  const serveDir = copyProjectForServe(project, true);
  const serveProject = (await projectContext(serveDir, false, true))!;

  // append resource files from render results
  resourceFiles.push(...ld.uniq(
    renderResult.files.flatMap((file) => file.resourceFiles),
  ) as string[]);

  // create project watcher
  const watcher = await watchProject(
    project,
    serveProject,
    resourceFiles,
    options,
  );

  // create a promise queue so we only do one renderProject at a time
  const renderQueue = new PromiseQueue<RenderResult>();

  // file request handler
  const serveOutputDir = projectOutputDir(serveProject);
  const handler = httpFileRequestHandler({
    //  base dir
    baseDir: serveOutputDir,

    // print all urls
    printUrls: "all",

    // handle websocket upgrade requests
    onRequest: async (req: ServerRequest) => {
      if (watcher.handle(req)) {
        await watcher.connect(req);
        return true;
      } else {
        return false;
      }
    },

    // handle html file requests w/ re-renders
    onFile: async (file: string) => {
      // if this is an html file then re-render (using the freezer)
      if (isHtmlContent(file)) {
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
        if (inputFile) {
          try {
            const result = await renderQueue.enqueue(() =>
              renderProject(
                watcher.serveProject(),
                {
                  useFreezer: true,
                  devServerReload: true,
                  flags: { quiet: true },
                },
                [inputFile!],
              )
            );
            if (result.error) {
              logError(result.error);
            }
          } catch (e) {
            logError(e);
          }
        }

        const fileContents = Deno.readFileSync(file);
        return watcher.injectClient(fileContents);
      } else {
        return undefined;
      }
    },

    // handle 404 by returing site custom 404 page
    on404: (url: string) => {
      const print = !basename(url).startsWith("jupyter-");
      let body: Uint8Array | undefined;
      const custom404 = join(serveOutputDir, kProject404File);
      if (existsSync(custom404)) {
        let content404 = Deno.readTextFileSync(custom404);
        // replace site-path references with / so they work in dev server mode
        const sitePath = websitePath(project.config);
        if (sitePath !== "/") {
          content404 = content404.replaceAll(
            new RegExp('((?:content|ref|src)=")(' + sitePath + ")", "g"),
            "$1/",
          );
        }
        body = new TextEncoder().encode(content404);
      }
      return {
        print,
        body,
      };
    },
  });

  // serve project
  const server = serve({ port: options.port, hostname: options.host });

  // compute site url
  const siteUrl = `http://localhost:${options.port}/`;

  // print status
  if (options.watch) {
    printWatchingForChangesMessage();
  }
  printBrowsePreviewMessage(siteUrl);

  // open browser if requested
  if (options.browse) {
    if (renderResult.baseDir && renderResult.outputDir) {
      const finalOutput = renderResultFinalOutput(renderResult);
      if (finalOutput) {
        const targetPath = pathWithForwardSlashes(relative(
          join(renderResult.baseDir, renderResult.outputDir),
          finalOutput,
        ));
        openUrl(targetPath === "index.html" ? siteUrl : siteUrl + targetPath);
      } else {
        openUrl(siteUrl);
      }
    } else {
      openUrl(siteUrl);
    }
  }

  // wait for requests
  for await (const req of server) {
    handler(req);
  }
}

async function serveFiles(
  project: ProjectContext,
): Promise<{ files: string[]; resourceFiles: string[] }> {
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
        const htmlInput = Deno.readTextFileSync(outputFile);
        const doc = new DOMParser().parseFromString(htmlInput, "text/html")!;
        const resolver = htmlResourceResolverPostprocessor(inputFile, project);
        const files = await resolver(doc);

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
        resourceFiles.push(...resourceFilesFromFile(
          project.dir,
          projRelative,
          { files, globs },
          false, // selfContained,
          [join(dirname(projRelative), inputFilesDir(projRelative))],
          partitioned,
        ));
      }
    } else {
      warning("Unabled to resolve output target for " + inputFile);
    }
  }

  return { files, resourceFiles: ld.uniq(resourceFiles) as string[] };
}
