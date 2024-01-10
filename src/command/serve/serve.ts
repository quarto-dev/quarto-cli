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
import {
  previewURL,
  printBrowsePreviewMessage,
  resolveHostAndPort,
} from "../../core/previewurl.ts";
import { isRStudio, isServerSession } from "../../core/platform.ts";
import { openUrl } from "../../core/shell.ts";
import { notebookContext } from "../../render/notebook/notebook-context.ts";
import { info } from "log/mod.ts";

export async function renderForServe(
  file: string,
  format?: string,
) {
  const services = renderServices(notebookContext());
  try {
    const result = await render(file, {
      services,
      flags: {
        to: format,
        execute: true,
      },
      previewServer: true,
    });
    return result;
  } finally {
    services.cleanup();
  }
}

export async function serve(options: RunOptions): Promise<ProcessResult> {
  const { host, port } = await resolveHostAndPort(options);
  const engine = fileExecutionEngine(options.input);
  if (engine?.run) {
    // render if requested
    if (options.render) {
      const result = await renderForServe(options.input, options.format);
      if (result.error) {
        throw result.error;
      }
    }

    // print message and open browser when ready
    const onReady = async () => {
      if (isRStudio()) {
        // Preserve expected RStudio semantics for shiny doc output
        // (VSCode extension for Quarto handles either text output)
        // https://github.com/quarto-dev/quarto-cli/issues/8186
        const url = previewURL(host, port, "");
        info(`Listening on ${url}`);
      } else {
        printBrowsePreviewMessage(host, port, "");
      }

      if (options.browser && !isServerSession()) {
        await openUrl(previewURL(host, port, ""));
      }
    };

    // run using engine
    await engine.run({
      ...options,
      input: options.input,
      host,
      port,
      onReady,
    });
    return processSuccessResult();
  }

  return Promise.reject(
    new Error("Unable to run computations for input file"),
  );
}
