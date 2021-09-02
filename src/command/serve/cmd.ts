/*
* cmd.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { Command } from "cliffy/command/mod.ts";

import { kProjectType } from "../../project/types.ts";
import {
  projectContext,
  projectIsWebsite,
} from "../../project/project-context.ts";
import { findOpenPort, kLocalhost } from "../../core/port.ts";

import { kRenderNone, serveProject } from "./serve.ts";

export const serveCommand = new Command()
  .name("serve")
  .arguments("[path:string]")
  .description(
    "Serve a website or book project for local development.\n\n" +
      "Chooses a random free port number (use --port to specify a specific port).\n\n" +
      "Automatically opens a browser, watches the filesystem for site changes, and reloads the\n" +
      "browser when changes occur (use --no-browse and --no-watch to disable these behaviors)." +
      "\n\n" +
      "By default, the most recent execution results of computational documents are used to render\n" +
      "the site (this is to optimize startup time). If you want to perform a full render prior to\n" +
      'serving pass the --render option with "all" or a comma-separated list of formats to render.\n',
  )
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
    "--render [to:string]",
    "Render to the specified format(s) before serving",
    {
      default: kRenderNone,
    },
  )
  .option(
    "--no-browse",
    "Don't open a browser to preview the site.",
  )
  .option(
    "--no-watch",
    "Don't watch for changes and automatically reload.",
  )
  .option(
    "--no-navigate",
    "Don't navigate the browser automatically.",
  )
  .option(
    "--debug",
    "Print debug output.",
    { hidden: true },
  )
  .example(
    "Serve with most recent execution results",
    "quarto serve",
  )
  .example(
    "Serve on a specific port",
    "quarto serve --port 4444",
  )
  .example(
    "Serve but don't open a browser",
    "quarto serve --no-browse",
  )
  .example(
    "Fully render all formats then serve",
    "quarto --render all",
  )
  .example(
    "Fully render the html format then serve",
    "quarto --render html",
  )
  // deno-lint-ignore no-explicit-any
  .action(async (options: any, path: string) => {
    // defaults
    const projDir = path || Deno.cwd();

    // confirm this is a directory with a project
    const stat = Deno.statSync(projDir);
    if (!stat.isDirectory) {
      throw new Error(`${projDir} is not a directory`);
    }
    const context = await projectContext(projDir, false, true);
    if (!context?.config) {
      throw new Error(`${projDir} is not a project`);
    }

    // confirm that it's a project type that can be served
    if (!projectIsWebsite(context)) {
      throw new Error(
        `Cannot serve project of type '${context.config.project[kProjectType] ||
          "default"}' (try using project type 'site').`,
      );
    }

    // default host if needed
    options.host = options.host || kLocalhost;

    // select a port
    if (!options.port) {
      options.port = findOpenPort();
    } else {
      options.port = findOpenPort(parseInt(options.port));
    }

    await serveProject(context, {
      port: options.port,
      host: options.host,
      render: options.render,
      browse: options.browse,
      watch: options.watch,
      navigate: options.navigate,
    });
  });
