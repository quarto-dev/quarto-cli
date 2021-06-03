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

  function ensurePreamble() {
    if (needsPreamble) {
      needsPreamble = false;
      return `${ojsSourceIncludes.imports}${ojsSourceIncludes.preamble}`;
    } else {
      return ``;
    }
  }

  function interpret(jsSrc: string[], inline: boolean) {
    let inlineStr = inline ? "inline-" : "";
    let content = [
      "window._ojsRuntime.interpret(`",
      jsSrc.map(escapeBackticks).join(""),
      `\`, document.getElementById("ojs-${inlineStr}cell-${ojsCellID}"), ${inline});`];
    return content.join("");
  }
  
  const inlineOJSInterpRE = /\$\{([^}]+)\}([^$])/g;
  function inlineInterpolation(str: string) {
    return str.replaceAll(inlineOJSInterpRE, function(m, g1, g2) {
      ojsCellID += 1;
      let result = [`<span id="ojs-inline-cell-${ojsCellID}" class="ojs-inline"></span>`,
                    `<script type="module">`,
                    ensurePreamble(),
                    interpret([g1], true),
                    `</script>`, g2];
      return result.join("");
    });
  }
  let ls = [];
  // now we convert it back
  for (const cell of output.cells) {
    if (cell.cell_type === "raw" ||
      cell.cell_type === "markdown") {
      ls.push(cell.source.map(inlineInterpolation).join(""));
    } else if (cell.cell_type?.language === "ojs") {
      ojsCellID += 1;
      const content = [
        '```{=html}\n',
        `<div id='ojs-cell-${ojsCellID}'></div>\n`,
        `<script type='module'>\n`,
        ensurePreamble(),
        interpret(cell.source, false),
        '</script>\n```\n'
      ];
      ls.push(content.join(""));
    } else {
      logError({
        name: "breakQuartoMd",
        message: `Skipping unrecognized cell type: ${JSON.stringify(cell.cell_type)}`
      });
    }
  }

  console.log(ls.join("\n"));
  
  return ls.join("\n");
}
