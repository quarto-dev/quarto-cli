/*
* annotate-source.ts
*
* Copyright (C) 2021 by RStudio, PBC
*
*/

import { RenderContext } from "../../command/render/types.ts";

import { lines } from "../../core/text.ts";

import { isJupyterNotebook } from "../../core/jupyter/jupyter.ts";

interface OJSLineNumbersAnnotation {
  ojsBlockLineNumbers: number[];
}

import { dirname, extname } from "path/mod.ts";

export function annotateOjsLineNumbers(
  context: RenderContext,
): OJSLineNumbersAnnotation {
  const canPatch = !isJupyterNotebook(context.target.input);

  if (canPatch) {
    const source = lines(Deno.readTextFileSync(context.target.input));

    const ojsBlockLineNumbers: number[] = [];
    let waitingForOjs = false;
    let lineNumber = 0;

    // we're using a regexp based on knitr, tweaked to what we actually need here:
    // https://github.com/yihui/knitr/blob/3237add034368a3018ff26fa9f4d0ca89a4afd78/R/pattern.R#L32
    const chunkBegin = /^[\t ]*```+\s*\{(ojs( *[ ,].*)?)\}\s*$/;

    source.forEach((line) => {
      if (line.match(chunkBegin)) {
        waitingForOjs = true;
      } else if (waitingForOjs && !line.startsWith("//|")) {
        waitingForOjs = false;
        ojsBlockLineNumbers.push(lineNumber);
      }
      lineNumber++;
    });

    return {
      ojsBlockLineNumbers,
    };
  } else {
    return {
      ojsBlockLineNumbers: [],
    };
  }
}
