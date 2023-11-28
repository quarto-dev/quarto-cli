/*
 * output-shared.ts
 *
 * Copyright (C) 2023 Posit Software, PBC
 */

import { dirname, isAbsolute, relative } from "path/mod.ts";

export function normalizeOutputPath(input: string, output: string) {
  if (isAbsolute(output)) {
    return output;
  } else {
    return relative(
      dirname(input),
      output,
    );
  }
}
