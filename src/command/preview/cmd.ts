/*
* preview.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { existsSync } from "fs/mod.ts";
import { dirname, join } from "path/mod.ts";

import { Command } from "cliffy/command/mod.ts";

import { findOpenPort } from "../../core/port.ts";
import { fixupPandocArgs, parseRenderFlags } from "../render/flags.ts";
import { render } from "../render/render-shared.ts";
import { inputFilesDir } from "../../core/render.ts";
import { RenderResultFile } from "../render/types.ts";
import { cssFileResourceReferences } from "../../core/html.ts";

export const previewCommand = new Command()
  .name("preview")
  .stopEarly()
  .option(
    "-p, --port <port:number>",
    "Port to listen on (defaults to 4848).",
  )
  .arguments("[file:string] [...args:string]")
  .description(
    "Render and preview a Quarto document. Automatically re-renders the document when the source\n" +
      "file changes. Automatically reloads the browser when document resources (e.g. CSS) change.\n\n" +
      "You can pass arbitrary command line arguments to be forwarded to quarto render.",
  )
  .example(
    "Preview document",
    "quarto preview document.qmd",
  )
  .example(
    "Preview document with render command line args",
    "quarto preview document.qmd --toc --number-sections",
  )
  // deno-lint-ignore no-explicit-any
  .action(async (_options: any, file: string, args: string[]) => {
    if (!existsSync(file)) {
      throw new Error(`${file} not found`);
    }
    // provide default args
    args = args || [];

    // pull out our command line args
    let port: number | undefined;
    const portPos = args.indexOf("--port");
    if (portPos !== -1) {
      port = parseInt(args[portPos + 1]);
      args.splice(portPos, 2);
    }

    // select a port if we need to
    if (!port) {
      port = findOpenPort(4848);
    }

    // extract pandoc flag values we know/care about, then fixup args as
    // necessary (remove our flags that pandoc doesn't know about)
    const flags = parseRenderFlags(args);
    args = fixupPandocArgs(args, flags);

    const renderResult = await render(file, {
      flags,
      pandocArgs: args,
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
  });
