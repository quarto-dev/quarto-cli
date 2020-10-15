import { Command } from "cliffy/command/mod.ts";
import {
  computationEngineForFile,
  RunOptions,
} from "../../computation/engine.ts";
import { consoleWriteLine } from "../../core/console.ts";

import { ProcessResult } from "../../core/process.ts";

export async function run(options: RunOptions): Promise<void> {
  const engine = computationEngineForFile(options.input);
  if (engine) {
    await engine.run(options);
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
    "-p, --port [port:number]",
    "The TCP port that the application should listen on.",
  )
  .description(
    "Run an interactive document.",
  )
  .example(
    "Run an interactive Shiny document.",
    "quarto run dashboard.Rmd",
  )
  // deno-lint-ignore no-explicit-any
  .action(async (options: any, input: string) => {
    try {
      await run({ input, port: options.port });
    } catch (error) {
      if (error) {
        consoleWriteLine(error.toString());
      }
      Deno.exit(1);
    }
  });
