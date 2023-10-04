/*
 * run.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { processSuccessResult } from "../../core/process.ts";
import { ProcessResult } from "../../core/process-types.ts";

import { fileExecutionEngine } from "../../execute/engine.ts";
import { RunOptions } from "../../execute/types.ts";

import { render } from "../render/render-shared.ts";
import { renderServices } from "../render/render-services.ts";

export async function serve(options: RunOptions): Promise<ProcessResult> {
  const engine = await fileExecutionEngine(options.input);
  if (engine?.run) {
    const target = await engine.target(options.input, options.quiet);
    if (target) {
      const services = renderServices();
      try {
        if (options.render) {
          const result = await render(options.input, {
            services,
            flags: {
              execute: true,
            },
          });
          if (result.error) {
            throw result.error;
          }
        }
        await engine.run({ ...options, input: options.input });
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
