/*
* errors.ts
*
* Copyright (C) 2021 by RStudio, PBC
*
*/

import { error } from "log/mod.ts";

export function parseError(
  // JJA: unused argument
  e: Error,
  ojsSource: string,
) {
  error(
    "An error occurred while parsing the following statement in an observable code block:",
  );
  error("----------");
  error(ojsSource);
  error("----------");
}
