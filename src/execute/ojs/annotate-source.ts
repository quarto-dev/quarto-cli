/*
* annotate-source.ts
*
* Copyright (C) 2021-2022 Posit Software, PBC
*
*/

import { RenderContext } from "../../command/render/types.ts";

import { lines } from "../../core/text.ts";

import { isJupyterNotebook } from "../../core/jupyter/jupyter.ts";

interface OJSLineNumbersAnnotation {
  ojsBlockLineNumbers: number[];
}

export function annotateOjsLineNumbers(
  context: RenderContext,
): OJSLineNumbersAnnotation {
  const canPatch = !isJupyterNotebook(context.target.source);

  if (canPatch) {
    const source = lines(Deno.readTextFileSync(context.target.source));

    const ojsBlockLineNumbers: number[] = [];
    let lineNumber = 1;

    // we're using a regexp based on knitr, tweaked to what we actually need here:
    // https://github.com/yihui/knitr/blob/3237add034368a3018ff26fa9f4d0ca89a4afd78/R/pattern.R#L32
    const chunkBegin = /^[\t ]*```+\s*\{(ojs( *[ ,].*)?)\}\s*$/;

    source.forEach((line) => {
      lineNumber++;
      if (line.match(chunkBegin)) {
        ojsBlockLineNumbers.push(lineNumber);
      }
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
