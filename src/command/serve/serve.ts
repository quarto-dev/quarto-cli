/*
* run.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { ProcessResult, processSuccessResult } from "../../core/process.ts";
import { makeAbsolutePath } from "../../core/qualified-path.ts";

import { fileExecutionEngine } from "../../execute/engine.ts";
import { RunOptions } from "../../execute/types.ts";

import { render, renderServices } from "../render/render-shared.ts";

export async function serve(options: RunOptions): Promise<ProcessResult> {
  const path = options.input;
  const engine = await fileExecutionEngine(path);
  if (engine?.run) {
    const target = await engine.target(
      path,
      options.quiet,
    );
    if (target) {
      const services = renderServices();
      try {
        if (options.render) {
          const result = await render(target.input, {
            services,
          });
          if (result.error) {
            throw result.error;
          }
        }
        await engine.run({ ...options, input: target.input });
        return processSuccessResult();
      } finally {
        services.cleanup();
      }
    }
  }

  return Promise.reject(
    new Error("Unable to run computations for input file"),
  );
}
