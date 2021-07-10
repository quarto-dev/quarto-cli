/*
* preview.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { dirname, join, relative } from "path/mod.ts";

import { info } from "log/mod.ts";

import * as colors from "fmt/colors.ts";

import { serve, ServerRequest } from "http/server.ts";

import { ld } from "lodash/mod.ts";

import { kOutputFile } from "../../config/constants.ts";

import { cssFileResourceReferences } from "../../core/html.ts";
import { logError } from "../../core/log.ts";
import { kLocalhost } from "../../core/port.ts";
import { openUrl } from "../../core/shell.ts";
import { httpFileRequestHandler } from "../../core/http.ts";
import { httpReloader } from "../../core/http-reload.ts";
import { isHtmlContent } from "../../core/mime.ts";
import { PromiseQueue } from "../../core/promise.ts";
import { inputFilesDir } from "../../core/render.ts";

import { render } from "../render/render-shared.ts";
import { RenderFlags, RenderResultFile } from "../render/types.ts";
import { renderFormats } from "../render/render.ts";
import { replacePandocArg } from "../render/flags.ts";

interface PreviewOptions {
  port: number;
  browse: boolean;
  render: boolean;
}

export async function preview(
  file: string,
  flags: RenderFlags,
  pandocArgs: string[],
  options: PreviewOptions,
) {
  // determine the target format if there isn't one in the command line args
  // (current we force the use of an html based format)
  const formats = await renderFormats(file);
  const format = flags.to || Object.keys(formats).find((name) => {
    const format = formats[name];
    return isHtmlContent(format.pandoc[kOutputFile]);
  }) || "html";
  flags.to = format;
  replacePandocArg(pandocArgs, "--to", format);

  // render for preview
  const result = await renderForPreview(file, flags, pandocArgs, options);

  // create client reloader
  const reloader = httpReloader(options.port);

  // create filesystem watcher (re-create if the list of targeted files change)
  const renderQueue = new PromiseQueue();
  let watcher: Watcher | undefined;
  let lastResult = result;
  const syncWatcher = (result: RenderForPreviewResult) => {
    const requiresSync = !watcher || !lastResult ||
      !ld.isEqual(result, lastResult);
    lastResult = result;
    if (requiresSync) {
      if (watcher) {
        watcher.stop();
      }
      watcher = previewWatcher([
        // re-render on source file changed
        {
          files: [file],
          handler: ld.debounce(async () => {
            try {
              if (options.render) {
                await renderQueue.enqueue(async () => {
                  const result = await renderForPreview(
                    file,
                    flags,
                    pandocArgs,
                    options,
                  );
                  syncWatcher(result);
                }, true);
              }
            } catch (e) {
              if (e.message) {
                logError(e);
              }
            }
          }, 50),
        },
        // reload on output or resource changed
        {
          files: [result.outputFile].concat(result.resourceFiles),
          handler: ld.debounce(async () => {
            await reloader.reloadClients();
          }, 50),
        },
      ]);
      watcher.start();
    }
  };
  syncWatcher(result);

  // file request handler (hook clients up to reloader)
  const handler = httpFileRequestHandler({
    baseDir: dirname(file),
    defaultFile: relative(dirname(file), result.outputFile),
    printUrls: "404",
    onRequest: async (req: ServerRequest) => {
      if (reloader.handle(req)) {
        await reloader.connect(req);
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
  });

  // serve project
  const server = serve({ port: options.port, hostname: kLocalhost });
  if (options.browse) {
    openUrl(`http://localhost:${options.port}/`);
  }

  // handle requests
  for await (const req of server) {
    await handler(req);
  }
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
  options: PreviewOptions,
): Promise<RenderForPreviewResult> {
  // render
  const renderResult = await render(file, {
    flags,
    pandocArgs: pandocArgs,
  });
  if (renderResult.error) {
    throw renderResult.error;
  }

  // print status
  const siteUrl = `http://localhost:${options.port}/`;
  info("Watching files for changes");
  info(`Browse at `, {
    newline: false,
  });
  info(`${siteUrl}`, { format: colors.underline });

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
    outputFile: join(dirname(file), renderResult.files[0].file),
    resourceFiles,
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
      files: watch.files.map(Deno.realPathSync),
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
