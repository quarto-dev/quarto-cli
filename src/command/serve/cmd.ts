/*
* cmd.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { Command } from "cliffy/command/mod.ts";

import { kProjectType, projectContext } from "../../project/project-context.ts";
import { projectType } from "../../project/types/project-types.ts";
import { findOpenPort } from "./port.ts";

import { serveProject } from "./serve.ts";

export const serveCommand = new Command()
  .name("serve")
  .arguments("[path:string]")
  .description(
    "Serve a website project for local development. Uses port 4848 by default if it's available,\n" +
      "otherwise chooses a random free port number (use --port to specify a specific port).\n\n" +
      "Automatically opens a browser, watches the filesystem for site changes, and reloads the\n" +
      "browser when changes occur (use --no-browse and --no-watch to disable these behaviors).",
  )
  .option(
    "-p, --port [port:number]",
    "Port to listen on (defaults to 4848).",
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
    const context = await projectContext(projDir);
    if (!context?.config) {
      throw new Error(`${projDir} is not a project`);
    }

    // confirm that it's a project type that can be served
    const type = context.config.project[kProjectType];
    const projType = projectType(type);
    if (!projType.canServe) {
      throw new Error(
        `Cannot serve project of type '${type ||
          "default"}' (try using project type 'site').`,
      );
    }

    // select a port if we need to
    if (!options.port) {
      options.port = findOpenPort();
    } else {
      options.port = parseInt(options.port);
    }

    await serveProject(context, {
      port: options.port,
      browse: options.browse,
      watch: options.watch,
      navigate: options.navigate,
      debug: !!options.debug,
    });
  });
