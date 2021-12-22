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

// formats an info message according to the tidyverse style guide
export function tidyverseInfo(msg: string)
{
  return `${colors.blue("ℹ")} ${msg}`;
}

// formats an error message according to the tidyverse style guide
export function tidyverseError(msg: string)
{
  return `${colors.red("✖")} ${msg}`;
}

export interface TidyverseError {
  heading: string,
  error: string[],
  info: string[]
};

export function tidyverseFormatError(msg: TidyverseError)
{
  const { heading, error, info } = msg;
  const strings =
    [heading,
     ...error.map(tidyverseError),
     ...info.map(tidyverseInfo)];
  return strings.join("\n");
}

export function quotedStringColor(msg: string)
{
  // return colors.rgb24(msg, 0xff7f0e); // d3.schemeCategory10[1]
  return colors.rgb24(msg, 0xbcbd22); // d3.schemeCategory10[8]
}

export function addFileInfo(msg: TidyverseError, src: MappedString)
{
  if (src.fileName !== undefined) {
    msg.heading = `In file ${src.fileName} ${msg.heading}`;
    // msg.info.push(`In file ${src.fileName}:`);
  }
}

export function addInstancePathInfo(msg: TidyverseError, instancePath: string)
{
  if (instancePath !== '') {
    msg.info.push(`The error happened in the field ${instancePath}.`);
  }
}
