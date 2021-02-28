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
    "The TCP port that the web server should listen on (defaults to 8080).",
  )
  .option(
    "--no-watch",
    "Don't watch for changes and automatically reload browser.",
  )
  .option(
    "--no-open",
    "Don't open the default browser to preview the site.",
  )
  .option(
    "--quiet",
    "Suppress warning and other messages.",
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
    const context = projectContext(projDir);
    if (!context.metadata) {
      throw new Error(`${projDir} is not a project`);
    }

    await serveProject(context, {
      port: parseInt(options.port) || 8080,
      watch: options.watch,
      open: options.open,
      quiet: !!options.quiet,
      debug: !!options.debug,
    });
  });
