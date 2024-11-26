/*
 * format-error.ts
 *
 * functions that help format errors consistently
 *
 * Copyright (C) 2021-2022 Posit Software, PBC
 */

import * as colors from "./external/colors.ts";
import { MappedString } from "./text-types.ts";
import { ErrorLocation, TidyverseError } from "./errors-types.ts";
import { isWindows } from "../../deno_ral/platform.ts";

// tidyverse error message styling
// https://style.tidyverse.org/error-messages.html
//
// Currently, the only way in which we disagree with the tidyverse
// style guide is in the phrasing of the "hint" (here, "info") prompts.
// Instead of using question marks, we use actionable, but tentative phrasing.
//
// Where the style guide would suggest "have you tried x instead?"
//
// here, we will say "Try x instead."
//

function platformHasNonAsciiCharacters(): boolean {
  try {
    return !isWindows;
  } catch (_e) {
    return false;
  }
}

// formats an info message according to the tidyverse style guide
export function tidyverseInfo(msg: string) {
  if (platformHasNonAsciiCharacters()) {
    return `${colors.blue("ℹ")} ${msg}`;
  } else {
    return `${colors.blue("i")} ${msg}`;
  }
}

// formats an error message according to the tidyverse style guide
export function tidyverseError(msg: string) {
  if (platformHasNonAsciiCharacters()) {
    return `${colors.red("✖")} ${msg}`;
  } else {
    return `${colors.red("x")} ${msg}`;
  }
}

export function tidyverseFormatError(msg: TidyverseError): string {
  let { heading, error, info } = msg;
  if (msg.location) {
    heading = `${locationString(msg.location)} ${heading}`;
  }
  if (msg.fileName) {
    heading = `In file ${msg.fileName}\n${heading}`;
  }
  const strings = [
    heading,
    msg.sourceContext,
    ...error.map(tidyverseError),
    ...Object.values(info).map(tidyverseInfo),
    "",
  ];
  return strings.join("\n");
}

export function quotedStringColor(msg: string) {
  return colors.blue(msg);
}

export function addFileInfo(msg: TidyverseError, src: MappedString) {
  if (src.fileName !== undefined) {
    msg.fileName = src.fileName;
  }
}

export function addInstancePathInfo(
  msg: TidyverseError,
  instancePath: (number | string)[],
) {
  if (instancePath.length) {
    const niceInstancePath = instancePath.map((s) => colors.blue(String(s)))
      .join(":");
    msg.info["instance-path-location"] =
      `The error happened in location ${niceInstancePath}.`;
  }
}

export function locationString(loc: ErrorLocation) {
  const { start, end } = loc;
  if (start.line === end.line) {
    if (start.column === end.column) {
      return `(line ${start.line + 1}, column ${start.column + 1})`;
    } else {
      return `(line ${start.line + 1}, columns ${start.column + 1}--${
        end.column + 1
      })`;
    }
  } else {
    return `(line ${start.line + 1}, column ${start.column + 1} through line ${
      end.line + 1
    }, column ${end.column + 1})`;
  }
}

function errorKey(err: TidyverseError): string {
  const positionKey = (pos: { line: number; column: number }): string =>
    `${pos.line}-${pos.column}`;
  return `${err.fileName || ""}-${positionKey(err.location!.start)}-${
    positionKey(err.location!.end)
  }`;
}

export function reportOnce(
  reporter: (err: TidyverseError) => unknown,
  reportSet?: Set<string>,
): (err: TidyverseError) => unknown {
  const errorsReported = reportSet || new Set();
  return (err: TidyverseError) => {
    const key = errorKey(err);
    if (errorsReported.has(key)) {
      return;
    }
    errorsReported.add(key);
    reporter(err);
  };
}
