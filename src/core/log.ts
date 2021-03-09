/*
* log.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { getenv } from "./env.ts";
import * as colors from "fmt/colors.ts";

export function logError(error: Error) {
  const isDebug = getenv("QUARTO_DEBUG", "false") === "true";
  const errorMessage = isDebug
    ? error.stack || error.message
    : `${error.name}: ${error.message}`;

  Deno.stderr.writeSync(
    new TextEncoder().encode(`\n${colors.red(errorMessage)}\n`),
  );
}
