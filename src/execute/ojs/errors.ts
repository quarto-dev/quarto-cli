/*
* errors.ts
*
* Copyright (C) 2021-2022 Posit Software, PBC
*
*/

import { error } from "../../deno_ral/log.ts";
import { mappedIndexToLineCol } from "../../core/lib/mapped-text.ts";
import { MappedString } from "../../core/lib/text-types.ts";

export function ojsParseError(
  // deno-lint-ignore no-explicit-any
  acornError: any, // we can't use SyntaxError here because acorn injects extra properties
  ojsSource: MappedString,
) {
  const acornMsg = String(acornError).split("\n")[0].trim().replace(
    / *\(\d+:\d+\)$/,
    "",
  );

  const { line, column } = mappedIndexToLineCol(ojsSource)(acornError.pos)!;

  const errLines: string[] = [];
  const ourError = (msg: string) => {
    if (msg.length) {
      errLines.push(msg);
    }
  };

  const errMsg = `OJS parsing failed on line ${line + 1}, column ${column + 1}`;
  ourError(errMsg);
  ourError(acornMsg);
  if (
    acornMsg.endsWith("Unexpected character '#'") &&
    ojsSource.value.slice(acornError.pos, acornError.pos + 2) === "#|"
  ) {
    ourError("\n(Did you mean to use '//|' instead?)\n");
  }
  ourError("----- OJS Source:");
  const ojsSourceSplit = ojsSource.value.split("\n");
  for (let i = 0; i < ojsSourceSplit.length; ++i) {
    ourError(ojsSourceSplit[i]);
    if (i + 1 === acornError.loc.line) {
      ourError(" ".repeat(acornError.loc.column) + "^");
    }
  }
  ourError("-----");

  if (errLines.length) {
    error(errLines.join("\n"));
  }
}

// FIXME Figure out line numbering story for error reporting
export function jsParseError(
  jsSource: string,
  errorMessage: string,
) {
  error(
    "Parse error occurred while parsing the following statement in a Javascript code block.",
  );
  error(errorMessage);
  error("----- Source:");
  error(`\n${jsSource}`);
  error("-----");
}
