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

interface OJSLineNumbersAnnotation {
  patchedSource?: string
};

import { dirname } from "path/mod.ts";

export function annotateOjsLineNumbers(
  context: RenderContext
): OJSLineNumbersAnnotation
{
  // FIXME Check for ipynb later
  const canPatch = true;

  if (canPatch) {
    const dir = dirname(context.target.source);
    
    // FIXME use correct extension, we might be ".rmd" or ".md"
    const patchedFileName = Deno.makeTempFileSync({
      dir,
      suffix: ".qmd"
    });
    
    const source = lines(Deno.readTextFileSync(context.target.source));

    const output: string[] = [];
    let waitingForOjs = false;
    let lineNumber = 0;
    source.forEach(line => {
      // FIXME use a better regexp
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
