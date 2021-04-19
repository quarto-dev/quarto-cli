/*
* cmd.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { Command } from "cliffy/command/mod.ts";

import { projectContext } from "../../project/project-context.ts";

import { serveProject } from "./serve.ts";

export const serveCommand = new Command()
  .name("serve")
  .arguments("[path:string]")
  .description(
    "Serve a website project for local development",
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
    if (!context.config) {
      throw new Error(`${projDir} is not a project`);
    }

    await serveProject(context, {
      port: parseInt(options.port) || 4848,
      browse: options.browse,
      watch: options.watch,
      navigate: options.navigate,
      debug: !!options.debug,
    });
  });
