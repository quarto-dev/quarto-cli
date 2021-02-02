/*
* run.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { ProcessResult, processSuccessResult } from "../../core/process.ts";

import { executionEngine, RunOptions } from "../../execute/engine.ts";

import { render } from "../render/render.ts";

export async function run(options: RunOptions): Promise<ProcessResult> {
  const engine = await executionEngine(options.input);
  if (engine?.run) {
    const target = await engine.target(options.input, options.quiet);
    if (target) {
      if (options.render) {
        await render(target.input, {});
      }
      await engine.run({ ...options, input: target.input });
      return processSuccessResult();
    }
  }

  return Promise.reject(
    new Error("Unable to run computations for input file"),
  );
}
