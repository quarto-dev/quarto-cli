/*
 * environment.ts
 *
 * Copyright (C) 2024 Posit Software, PBC
 */

import { basename, dirname } from "../deno_ral/path.ts";
import { ExecuteOptions } from "./types.ts";
import { InternalError } from "../core/lib/error.ts";
import { resolve } from "../deno_ral/path.ts";

export const setExecuteEnvironment: (options: ExecuteOptions) => void = (
  options,
) => {
  if (options.projectDir) {
    Deno.env.set("QUARTO_PROJECT_ROOT", options.projectDir);
    Deno.env.set("QUARTO_DOCUMENT_PATH", dirname(options.target.source));
    Deno.env.set("QUARTO_DOCUMENT_FILE", basename(options.target.source));
  } else {
    // FIXME: This should not be passthrough anymore as singleFileProjectContext always set `options.projectDir`
    // https://github.com/quarto-dev/quarto-cli/pull/8771
    if (!options.cwd) {
      throw new InternalError(
        "No project directory or current working directory",
      );
    }
    Deno.env.set("QUARTO_PROJECT_ROOT", options.cwd);
    Deno.env.set("QUARTO_DOCUMENT_PATH", options.cwd);
    Deno.env.set("QUARTO_DOCUMENT_FILE", basename(options.target.source));
  }

  const executeInfo: Record<string, unknown> = {
    "document-path": resolve(options.target.source),
    format: options.format,
  };

  Deno.env.set(
    "QUARTO_EXECUTE_INFO",
    options.project.temp.createFileFromString(JSON.stringify(executeInfo)),
  );
};
