/*
* cmd.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { existsSync } from "fs/mod.ts";

import * as colors from "fmt/colors.ts";

import { Command } from "cliffy/command/mod.ts";

import { findOpenPort } from "../../core/port.ts";
import { fixupPandocArgs, parseRenderFlags } from "../render/flags.ts";
import { preview } from "./preview.ts";

export const previewCommand = new Command()
  .name("preview")
  .stopEarly()
  .option(
    "-p, --port <port:number>",
    "Port to listen on (defaults to 4848).",
  )
  .option(
    "--no-render",
    "Do not re-render when the source file changes.",
  )
  .option(
    "--no-browse",
    "Don't open a browser to preview the site.",
  )
  .arguments("[file:string] [...args:string]")
  .description(
    "Render and preview a Quarto document. Automatically re-renders the document when the source\n" +
      "file changes. Automatically reloads the browser when document resources (e.g. CSS) change.\n\n" +
      "Pass --no-render to prevent re-rendering when the source file changes (note that even when\n" +
      "this option is provided the document will be rendered once before previewing).\n\n" +
      "You can also include arbitrary command line arguments to be forwarded to " +
      colors.bold("quarto render") + ".",
  )
  .example(
    "Preview document",
    "quarto preview doc.qmd",
  )
  .example(
    "Preview using specific port",
    "quarto preview doc.qmd --port 4444",
  )
  .example(
    "Preview (don't open a browser)",
    "quarto preview doc.qmd --no-browse",
  )
  .example(
    "Preview (don't re-render on source change)",
    "quarto preview doc.qmd --no-render",
  )
  .example(
    "Preview with render command line args",
    "quarto preview doc.qmd --toc --number-sections",
  )
  // deno-lint-ignore no-explicit-any
  .action(async (options: any, file: string, args: string[]) => {
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
    const noBrowsePos = args.indexOf("--no-browse");
    if (noBrowsePos !== -1) {
      options.browse = false;
      args.splice(noBrowsePos, 1);
    }
    const noRenderPos = args.indexOf("--no-render");
    if (noRenderPos !== -1) {
      options.render = false;
      args.splice(noRenderPos, 1);
    }
    // select a port if we need to
    if (!port) {
      port = findOpenPort(4848);
    }

    // extract pandoc flag values we know/care about, then fixup args as
    // necessary (remove our flags that pandoc doesn't know about)
    const flags = parseRenderFlags(args);
    args = fixupPandocArgs(args, flags);

    // run preview
    await preview(file, flags, args, {
      port,
      browse: !!options.browse,
      render: !!options.render,
    });
  });
