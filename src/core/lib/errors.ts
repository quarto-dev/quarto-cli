/*
* format-error.ts
*
* functions that help format errors consistently
*
* Copyright (C) 2021 by RStudio, PBC
*
*/

import * as colors from "./external/colors.ts";
import { MappedString } from "./mapped-text.ts";

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

// formats an info message according to the tidyverse style guide
export function tidyverseInfo(msg: string) {
  return `${colors.blue("ℹ")} ${msg}`;
}

// formats an error message according to the tidyverse style guide
export function tidyverseError(msg: string) {
  return `${colors.red("✖")} ${msg}`;
}

export interface ErrorLocation {
  start: {
    line: number;
    column: number;
  };
  end: {
    line: number;
    column: number;
  };
}

export interface TidyverseError {
  heading: string;
  error: string[];
  info: string[];
  fileName?: string;
  location?: ErrorLocation;
  sourceContext?: string;
}

export function tidyverseFormatError(msg: TidyverseError) {
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
    ...info.map(tidyverseInfo),
  ];
  return strings.join("\n");
}

export function quotedStringColor(msg: string) {
  // return colors.rgb24(msg, 0xff7f0e); // d3.schemeCategory10[1]
  return colors.rgb24(msg, 0xbcbd22); // d3.schemeCategory10[8]
}

export function addFileInfo(msg: TidyverseError, src: MappedString) {
  if (src.fileName !== undefined) {
    msg.fileName = src.fileName;
  }
}

export function addInstancePathInfo(msg: TidyverseError, instancePath: string) {
  if (instancePath !== "") {
    const niceInstancePath = instancePath.trim().slice(1).split("/").map((s) =>
      colors.blue(s)
    ).join(":");
    msg.info.push(`The error happened in location ${niceInstancePath}.`);
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
