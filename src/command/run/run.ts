/*
* run.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
* Unless you have received this program directly from RStudio pursuant
* to the terms of a commercial license agreement with RStudio, then
* this program is licensed to you under the terms of version 3 of the
* GNU General Public License. This program is distributed WITHOUT
* ANY EXPRESS OR IMPLIED WARRANTY, INCLUDING THOSE OF NON-INFRINGEMENT,
* MERCHANTABILITY OR FITNESS FOR A PARTICULAR PURPOSE. Please refer to the
* GPL (http://www.gnu.org/licenses/gpl-3.0.txt) for more details.
*
*/

import { Command } from "cliffy/command/mod.ts";

import { consoleWriteLine } from "../../core/console.ts";
import { ProcessResult, processSuccessResult } from "../../core/process.ts";

import {
  computationEngineForFile,
  RunOptions,
} from "../../computation/engine.ts";

import { render } from "../render/render.ts";

export async function run(options: RunOptions): Promise<ProcessResult> {
  const engine = computationEngineForFile(options.input);
  if (engine?.run) {
    // render if requested
    if (options.render) {
      const result = await render({ input: options.input });
      if (!result.success) {
        return result;
      }
    }
    // run (never returns)
    await engine.run(options);
    return processSuccessResult();
  } else {
    return Promise.reject(
      new Error("Unable to run computations for input file"),
    );
  }
}

export const runCommand = new Command()
  .name("run")
  .arguments("<input:string>")
  .option(
    "--render [render:boolean]",
    "Render the document before running.",
    {
      default: true,
    },
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
    try {
      const result = await run({
        input,
        render: options.render,
        port: options.port,
      });

      if (!result.success) {
        // error diagnostics already written to stderr
        Deno.exit(result.code);
      }
    } catch (error) {
      if (error) {
        consoleWriteLine(error.toString());
      }
      Deno.exit(1);
    }
  });
