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
  language: "js" | "ojs",
  errorMessage: string
) {
  if (language === "js") {
    error(
      "Parse error occurred while parsing the following statement in a Javascript code block.",
    );
    error(errorMessage);
    error("---------- Source:");
    error(`\n${ojsSource}`);
  } else {
    error(
      "Parse error occurred while parsing the following statement in an OJS code block.",
    );
    error(errorMessage);
    error("---------- Source:");
    error(`\n${ojsSource}`);
  }
}
