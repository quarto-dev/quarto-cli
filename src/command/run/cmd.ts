/*
* cmd.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { Command } from "cliffy/command/mod.ts";

import { run } from "./run.ts";

export const runCommand = new Command()
  .name("run")
  .arguments("<input:string>")
  .option(
    "--no-render",
    "Do not render the document before running.",
  )
  .option(
    "-p, --port [port:number]",
    "The TCP port that the application should listen on.",
  )
  .description(
    "Run an interactive document.\n\nBy default, the document will be rendered first and then run. " +
      "If you have previously rendered the document, pass --no-render to skip the rendering step.",
  )
  .example(
    "Run an interactive Shiny document",
    "quarto run dashboard.Rmd",
  )
  .example(
    "Run a document without rendering",
    "quarto run dashboard.Rmd --no-render",
  )
  // deno-lint-ignore no-explicit-any
  .action(async (options: any, input: string) => {
    const result = await run({
      input,
      render: options.render,
      port: options.port,
    });

    if (!result.success) {
      // error diagnostics already written to stderr
      Deno.exit(result.code);
    }
  });
