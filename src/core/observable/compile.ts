/*
* compile.ts
*
* Copyright (C) 2021 by RStudio, PBC
*
*/

import { Format } from "../../config/format.ts";

import * as ojsSourceIncludes from "../../core/observable/js-source.ts";
import { logError } from "../../core/log.ts";
import { escapeBackticks } from "../../core/text.ts";
import { breakQuartoMd } from "../../core/break-quarto-md.ts";

export interface ObserveableCompileOptions {
  source: string;
  format: Format;
  markdown: string;
  libDir?: string;
}

export interface ObservableCompileResult {
  markdown: string;
}

// TODO decide how source code is presented, we've lost this
// feature from the observable-engine move
export function observableCompile(options: ObserveableCompileOptions): string {
  const { markdown } = options;
  let ojsCellID = 0;
  let needsPreamble = true;

  let output = breakQuartoMd(markdown, "ojs");

  let ls = [];
  // now we convert it back
  for (const cell of output.cells) {
    if (cell.cell_type === "raw" ||
      cell.cell_type === "markdown") {
      ls.push(cell.source.join(""));
    } else if (cell.cell_type?.language === "ojs") {
      ojsCellID += 1;
      const content = [
        '```{=html}\n',
        `<div id='ojs-cell-${ojsCellID}'></div>\n`,
        `<script type='module'>\n`];
      if (needsPreamble) {
        needsPreamble = false;
        content.push(ojsSourceIncludes.imports);
        content.push(ojsSourceIncludes.preamble);
      }
      content.push(`window._ojsRuntime.setTargetElement(document.getElementById("ojs-cell-${ojsCellID}"));\n`)
      content.push("window._ojsRuntime.interpret(`\n");
      content.push(cell.source.map(escapeBackticks).join(""));
      content.push("`);\n</script>\n```\n");
      ls.push(content.join(""));
    } else {
      logError({
        name: "breakQuartoMd",
        message: `Skipping unrecognized cell type: ${JSON.stringify(cell.cell_type)}`
      });
    }
  }
  
  return ls.join("\n");
}
