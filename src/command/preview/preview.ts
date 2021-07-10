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
  // render for preview
  const result = await renderForPreview(file, flags, pandocArgs, options);

  // create client reloader
  const reloader = httpReloader(options.port);

  // create filesystem watcher
  const renderQueue = new PromiseQueue();
  previewWatcher([
    // re-render on source file changed
    {
      files: [file],
      handler: ld.debounce(async () => {
        try {
          if (options.render) {
            await renderQueue.enqueue(() => {
              return renderForPreview(file, flags, pandocArgs, options);
            }, true);
          }
        } catch (e) {
          logError(e);
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
  ]).start();

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

async function renderForPreview(
  file: string,
  flags: RenderFlags,
  pandocArgs: string[],
  options: PreviewOptions,
) {
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
    outputFile: join(dirname(file), renderResult.files[0].file),
    resourceFiles,
  };
}

interface Watch {
  files: string[];
  handler: () => Promise<void>;
}

function previewWatcher(watches: Watch[]) {
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
  const watcher = Deno.watchFs(files);
  const watchForChanges = async () => {
    for await (const event of watcher) {
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
    close: () => watcher.close(),
  };
}
