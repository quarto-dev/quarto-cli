/*
* preview.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { dirname, join } from "path/mod.ts";

import { info } from "log/mod.ts";

import * as colors from "fmt/colors.ts";

import { serve } from "http/server.ts";

import { render } from "../render/render-shared.ts";
import { inputFilesDir } from "../../core/render.ts";
import { RenderFlags, RenderResultFile } from "../render/types.ts";
import { cssFileResourceReferences } from "../../core/html.ts";
import { logError } from "../../core/log.ts";
import { kLocalhost } from "../../core/port.ts";
import { openUrl } from "../../core/shell.ts";
import { httpFileRequestHandler } from "../../core/http.ts";

interface PreviewOptions {
  port: number;
  browse: boolean;
}

export async function preview(
  file: string,
  flags: RenderFlags,
  pandocArgs: string[],
  options: PreviewOptions,
) {
  // render for preview
  const result = await renderForPreview(file, flags, pandocArgs);

  // serve project (open browser if requested)
  console.log(options);
  const server = serve({ port: options.port, hostname: kLocalhost });
  const siteUrl = `http://localhost:${options.port}/`;
  info("Watching files for reload on changes");
  info(`Browse preview at `, {
    newline: false,
  });
  info(`${siteUrl}`, { format: colors.underline });
  if (options.browse) {
    openUrl(siteUrl);
  }

  // handle requests
  const handler = httpFileRequestHandler({
    baseDir: dirname(file),
    defaultFile: result.outputFile,
  });
  for await (const req of server) {
    await handler(req);
  }
}

async function renderForPreview(
  file: string,
  flags: RenderFlags,
  pandocArgs: string[],
) {
  // render
  const renderResult = await render(file, {
    flags,
    pandocArgs: pandocArgs,
  });

  // determine files to watch for reload (filter out the files dir)
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
    outputFile: renderResult.files[0].file,
    resourceFiles,
  };
}

interface Watch {
  files: string[];
  handler: VoidFunction;
}

function previewWatcher(watches: Watch[]) {
  // accumulate the files to watch
  const files = watches.flatMap((watch) => watch.files);
  const handlerForFile = (file: string) => {
    const watch = watches.find((watch) => watch.files.includes(file));
    return watch?.handler;
  };

  // create the watcher
  const watcher = Deno.watchFs(files);
  const watchForChanges = async () => {
    for await (const event of watcher) {
      try {
        if (event.kind === "modify") {
          const handlers = new Set<VoidFunction>();
          event.paths.forEach((path) => {
            const handler = handlerForFile(path);
            if (handler && !handlers.has(handler)) {
              handlers.add(handler);
            }
          });
          handlers.forEach((handler) => handler());
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
