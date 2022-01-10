/*
* guess-chunk-options-format.ts
*
* As of knitr 1.35, it's possible to provide chunk options in an
* alternative syntax: https://yihui.org/en/2022/01/knitr-news/
*
* This syntax looks like our YAML syntax. The functions in this
* file are heuristics that attempt to sniff out which of the two
* styles are being used, so we don't attempt to validate or parse
* something that really isn't YAML.
*
* Copyright (C) 2022 by RStudio, PBC
*
*/

import { lines } from "./text.ts";

export function guessChunkOptionsFormat(options: string): "knitr" | "yaml"
{
  // Find all lines without indentation and without a colon
  const noIndentOrColon = /^[^:\s]+[^:]+$/;
  const chunkLines = lines(options);

  if (chunkLines.filter(l => l.match(noIndentOrColon)).length > 0) {
    return "knitr";
  }

  return "yaml";
}
