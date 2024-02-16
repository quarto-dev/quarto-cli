/*
 * environment.ts
 *
 * Copyright (C) 2024 Posit Software, PBC
 */

import { dirname } from "path/mod.ts";
import { ExecuteOptions } from "./types.ts";
import { InternalError } from "../core/lib/error.ts";

export const setExecuteEnvironment: (options: ExecuteOptions) => void = (
  options,
) => {
  if (options.projectDir) {
    Deno.env.set("QUARTO_PROJECT_ROOT", options.projectDir);
    Deno.env.set("QUARTO_DOCUMENT_PATH", dirname(options.target.source));
  } else {
    if (!options.cwd) {
      throw new InternalError(
        "No project directory or current working directory",
      );
    }
    Deno.env.set("QUARTO_PROJECT_ROOT", options.cwd);
    Deno.env.set("QUARTO_DOCUMENT_PATH", options.cwd);
  }
};
