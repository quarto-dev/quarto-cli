/*
* cmd.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import { join } from "path/mod.ts";

import { Command } from "cliffy/command/mod.ts";
import denoliver from "denoliver/mod.ts";

import { kOutputDir, projectContext } from "../../project/project-context.ts";

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
    "--debug",
    "Print debug output.",
  )
  // deno-lint-ignore no-explicit-any
  .action(async (options: any, path: string) => {
    // defaults
    const projDir = path || Deno.cwd();
    const port = parseInt(options.port) || 8080;

    // confirm this is a directory with a project
    const stat = Deno.statSync(projDir);
    if (!stat.isDirectory) {
      throw new Error(`${projDir} is not a directory`);
    }
    const context = projectContext(projDir);
    if (!context.metadata) {
      throw new Error(`${projDir} is not a project`);
    }

    // determine site dir and switch to it
    console.log(context);
    const outputDir = context.metadata?.project?.[kOutputDir];
    const siteDir = outputDir ? join(path, outputDir) : projDir;
    Deno.chdir(siteDir);

    // run the server
    const server = await denoliver({
      root: Deno.realPathSync(Deno.cwd()),
      port,
      debug: options.debug || false,
    });
  });
