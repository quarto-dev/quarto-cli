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
  const { target, engine } = await executionEngine(options.input, false);
  if (engine?.run) {
    // render if requested
    if (options.render) {
      const result = await render(target.input, {});
      if (!result.success) {
        return result;
      }
    }
    // run (never returns)
    await engine.run({ ...options, input: target.input });
    return processSuccessResult();
  } else {
    return Promise.reject(
      new Error("Unable to run computations for input file"),
    );
  }
}
