/*
* annotate-source.ts
*
* Copyright (C) 2021 by RStudio, PBC
*
*/

import {
  inputFilesDir
} from "../../core/render.ts";

import {
  RenderContext
} from "../../command/render/types.ts";

import {
  lines
} from "../../core/text.ts";

import {
  isJupyterNotebook
} from "../../core/jupyter/jupyter.ts";

interface OJSLineNumbersAnnotation {
  patchedSource?: string
};

import { dirname, extname } from "path/mod.ts";

export function annotateOjsLineNumbers(
  context: RenderContext
): OJSLineNumbersAnnotation
{
  const ext = extname(context.target.source);
  const canPatch = !isJupyterNotebook(context.target.source);

  if (canPatch) {
    const dir = dirname(context.target.source);
    
    const patchedFileName = Deno.makeTempFileSync({
      dir,
      suffix: ext
    });
    
    const source = lines(Deno.readTextFileSync(context.target.source));

    const output: string[] = [];
    let waitingForOjs = false;
    let lineNumber = 0;

    // we're using a regexp based on knitr, tweaked to what we actually need here:
    // https://github.com/yihui/knitr/blob/3237add034368a3018ff26fa9f4d0ca89a4afd78/R/pattern.R#L32
    const chunkBegin = /^[\t ]*```+\s*\{(ojs( *[ ,].*)?)\}\s*$/;

    source.forEach(line => {
      if (line === "```{ojs}") {
        waitingForOjs = true;
      } else if (waitingForOjs && !line.startsWith("//|")) {
        output.push(`//| internal-chunk-line-number: ${lineNumber}`);
        waitingForOjs = false;
      }
      lineNumber++;
      output.push(line);
    });

    Deno.writeTextFileSync(patchedFileName, output.join("\n"));

    return {
      patchedSource: patchedFileName,
    };
  } else {
    return {};
  }
}
