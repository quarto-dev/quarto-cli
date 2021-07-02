/*
* errors.ts
*
* Copyright (C) 2021 by RStudio, PBC
*
*/

import { error } from "log/mod.ts";

// FIXME Figure out line numbering story for error reporting
export function parseError(
  ojsSource: string,
) {
  error(
    "An error occurred while parsing the following statement in an OJS code block:",
  );
  error("----------");
  error(ojsSource);
  error("----------");
}
