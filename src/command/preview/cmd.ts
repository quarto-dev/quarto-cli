/*
* cmd.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { existsSync } from "fs/mod.ts";

import * as colors from "fmt/colors.ts";

import { Command } from "cliffy/command/mod.ts";

import { findOpenPort, kLocalhost } from "../../core/port.ts";
import { fixupPandocArgs, parseRenderFlags } from "../render/flags.ts";
import { preview } from "./preview.ts";

export const previewCommand = new Command()
  .name("preview")
  .stopEarly()
  .option(
    "--port [port:number]",
    "Suggested port to listen on (defaults to random value between 3000 and 8000).\n" +
      "If the port is not available then a random port between 3000 and 8000 will be selected.",
  )
  .option(
    "--host [host:string]",
    "Hostname to bind to (defaults to 127.0.0.1)",
  )
  .option(
    "--no-watch",
    "Do not re-render when the source file changes.",
  )
  .option(
    "--no-render",
    "Do not re-render when the source file changes.",
    {
      hidden: true,
    },
  )
  .option(
    "--no-browse",
    "Don't open a browser to preview the site.",
  )
  .arguments("[file:string] [...args:string]")
  .description(
    "Render and preview a Quarto document. Automatically re-renders the document when the source\n" +
      "file changes. Automatically reloads the browser when document resources (e.g. CSS) change.\n\n" +
      "Pass --no-watch to prevent re-rendering when the source file changes (note that even when\n" +
      "this option is provided the document will be rendered once before previewing).\n\n" +
      "You can also include arbitrary command line arguments to be forwarded to " +
      colors.bold("quarto render") + ".",
  )
  .example(
    "Preview document",
    "quarto preview doc.qmd",
  )
  .example(
    "Preview (don't open a browser)",
    "quarto preview doc.qmd --no-browse",
  )
  .example(
    "Preview (don't watch for source changes)",
    "quarto preview doc.qmd --no-watch",
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
    const portPos = args.indexOf("--port");
    if (portPos !== -1) {
      options.port = parseInt(args[portPos + 1]);
      args.splice(portPos, 2);
    }
    // pull out our command line args
    const hostPos = args.indexOf("--host");
    if (hostPos !== -1) {
      options.host = parseInt(args[hostPos + 1]);
      args.splice(hostPos, 2);
    }
    const noBrowsePos = args.indexOf("--no-browse");
    if (noBrowsePos !== -1) {
      options.browse = false;
      args.splice(noBrowsePos, 1);
    }
    const noWatchPos = args.indexOf("--no-watch");
    if (noWatchPos !== -1) {
      options.watch = false;
      args.splice(noWatchPos, 1);
    }
    const noRenderPos = args.indexOf("--no-render");
    if (noRenderPos !== -1) {
      options.watch = false;
      args.splice(noRenderPos, 1);
    }

    // default host if not specified
    options.host = options.host || kLocalhost;

    // select a port
    if (!options.port) {
      options.port = findOpenPort();
    } else {
      options.port = findOpenPort(parseInt(options.port));
    }

    // extract pandoc flag values we know/care about, then fixup args as
    // necessary (remove our flags that pandoc doesn't know about)
    const flags = parseRenderFlags(args);
    args = fixupPandocArgs(args, flags);

    // run preview
    await preview(file, flags, args, {
      port: options.port,
      host: options.host,
      browse: !!options.browse,
      watch: !!options.watch,
    });
  });
